import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/animation/app_motion.dart';
import '../../../core/routing/app_routes.dart';
import '../../../repositories/demo_repository.dart';
import '../../../services/browser_file_picker.dart';
import '../../../services/image_optimization_service.dart';
import '../../../services/provider_workspace_service.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/app_reveal.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/swiper_button.dart';
import '../../../widgets/swiper_status_badge.dart';
import '../../../widgets/compact_media_picker.dart';
import 'widgets/provider_jobs_skeleton.dart';

/// UI-only filter groups layered over the real booking statuses — no new
/// backend statuses are introduced. Grouping reuses the same
/// [_ProviderJobsScreenState._isCompletedStatus] /
/// [_ProviderJobsScreenState._isCancelledStatus] helpers that already
/// govern action-eligibility elsewhere in this screen, so the filter can
/// never disagree with the existing workflow logic.
enum _StatusFilter { all, pending, ongoing, completed, cancelled }

class ProviderJobsScreen extends StatefulWidget {
  const ProviderJobsScreen({super.key, required this.repository});

  final DemoRepository repository;

  @override
  State<ProviderJobsScreen> createState() => _ProviderJobsScreenState();
}

class _ProviderJobsScreenState extends State<ProviderJobsScreen> {
  static const _workspaceService = ProviderWorkspaceService();
  static const _cardRadius = 20.0;
  static const _tileRadius = 16.0;

  late Future<List<ProviderWorkspaceBooking>> _future;
  late DateTime _visibleMonth;
  String _selectedDateKey = _dateKey(DateTime.now());
  _StatusFilter _statusFilter = _StatusFilter.all;
  String _busyBookingId = '';
  String _message = '';
  String _error = '';
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _visibleMonth = DateTime(now.year, now.month, 1);
    _future = _workspaceService.fetchBookings();
    // This list only refreshed itself right after an action taken on THIS
    // screen — a status change made from elsewhere (a push notification
    // deep link, the dashboard, or simply this screen having been left open
    // a while) never showed up here on its own. Same 5s poll already used
    // by the customer's booking screens.
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      unawaited(_reload(silent: true));
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _reload({bool silent = false}) async {
    // Reassigns the same fetch this screen already uses on load and after
    // every booking action — no new endpoint, no new request shape.
    // _selectedDateKey / _statusFilter / _visibleMonth are untouched, so a
    // pull-to-refresh naturally preserves whatever the user had selected.
    // `silent` only matters to the FutureBuilder below: a fresh Future
    // still briefly reports `waiting`, which would otherwise flash the
    // whole list back to its loading skeleton every 5 seconds.
    if (silent) {
      // A background poll that happens to fail (a dropped connection, a
      // phone with no push/network momentarily) must never disturb the
      // list already on screen -- so unlike the non-silent path below,
      // errors here are swallowed rather than surfaced.
      try {
        final result = await _workspaceService.fetchBookings();
        if (!mounted) {
          return;
        }
        setState(() => _future = Future.value(result));
      } catch (_) {
        // Ignored -- the next 5s tick tries again.
      }
      return;
    }
    setState(() {
      _future = _workspaceService.fetchBookings();
    });
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<ProviderWorkspaceBooking>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const ProviderJobsSkeleton();
        }
        if (snapshot.hasError) {
          return const EmptyState(
            title: 'Unable to load provider bookings',
            subtitle: 'Please try again.',
            icon: Icons.error_outline_rounded,
          );
        }

        final bookings = snapshot.data ?? const [];
        // Computed once per build: calendar-date filter first, then the
        // status-group filter — both purely local over the already-fetched
        // list, no re-fetch either way.
        final selectedDateBookings = _sortBookings(
          bookings.where(
            (booking) =>
                _normalizedDateKey(booking.scheduledDate) == _selectedDateKey,
          ),
        );
        final visibleBookings = _statusFilter == _StatusFilter.all
            ? selectedDateBookings
            : selectedDateBookings
                  .where(
                    (booking) =>
                        _statusGroupFor(booking.bookingStatus) == _statusFilter,
                  )
                  .toList(growable: false);

        return RefreshIndicator(
          color: AppColors.primary,
          onRefresh: _reload,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.md,
              AppSpacing.md,
              AppSpacing.md,
              112,
            ),
            children: [
              if (_error.isNotEmpty) ...[
                _noticeCard(_error, AppColors.error, AppColors.errorSurface),
              ],
              if (_message.isNotEmpty) ...[
                if (_error.isNotEmpty) const SizedBox(height: AppSpacing.md),
                _noticeCard(
                  _message,
                  AppColors.success,
                  AppColors.successSurface,
                ),
              ],
              if (_error.isNotEmpty || _message.isNotEmpty)
                const SizedBox(height: AppSpacing.md),
              AppReveal(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _calendarCard(bookings),
                    const SizedBox(height: AppSpacing.md),
                    _statusFilterRow(),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              AppReveal(
                delay: const Duration(milliseconds: 60),
                child: visibleBookings.isEmpty
                    ? EmptyState(
                        title: _emptyTitle(),
                        subtitle: _emptySubtitle(),
                        icon: Icons.calendar_month_outlined,
                      )
                    : Column(
                        children: [
                          for (final booking in visibleBookings)
                            Padding(
                              padding: const EdgeInsets.only(
                                bottom: AppSpacing.sm,
                              ),
                              child: _bookingListCard(context, booking),
                            ),
                        ],
                      ),
              ),
            ],
          ),
        );
      },
    );
  }

  // Reuses the SAME completed/cancelled definitions the rest of this
  // screen already relies on for action-eligibility and flow labels, so
  // the new filter groups can't drift from existing behavior. Any status
  // not explicitly pending/completed/cancelled falls into "ongoing"
  // (accepted, on_the_way, arrived, final_payment_sent, cash_paid_by_user,
  // payment_received_by_provider) — the safest catch-all group.
  _StatusFilter _statusGroupFor(String status) {
    if (_isCancelledStatus(status)) {
      return _StatusFilter.cancelled;
    }
    if (_isCompletedStatus(status)) {
      return _StatusFilter.completed;
    }
    if (status == 'pending' || status == 'pending_provider_response') {
      return _StatusFilter.pending;
    }
    return _StatusFilter.ongoing;
  }

  String _statusFilterLabel(_StatusFilter filter) {
    return switch (filter) {
      _StatusFilter.all => 'All',
      _StatusFilter.pending => 'Pending',
      _StatusFilter.ongoing => 'Ongoing',
      _StatusFilter.completed => 'Completed',
      _StatusFilter.cancelled => 'Cancelled',
    };
  }

  String _emptyTitle() {
    if (_statusFilter == _StatusFilter.all) {
      return 'No bookings found';
    }
    return 'No ${_statusFilterLabel(_statusFilter).toLowerCase()} bookings';
  }

  String _emptySubtitle() {
    if (_statusFilter == _StatusFilter.all) {
      return 'No bookings are scheduled for the selected date.';
    }
    return 'No ${_statusFilterLabel(_statusFilter).toLowerCase()} bookings for the selected date.';
  }

  Widget _statusFilterRow() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final filter in _StatusFilter.values) ...[
            _statusChip(filter),
            if (filter != _StatusFilter.values.last)
              const SizedBox(width: AppSpacing.xs),
          ],
        ],
      ),
    );
  }

  Widget _statusChip(_StatusFilter filter) {
    final selected = filter == _statusFilter;
    return InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: () => setState(() => _statusFilter = filter),
      child: AnimatedContainer(
        duration: AppMotion.resolveDuration(context, AppMotion.fast),
        curve: AppMotion.emphasizedCurve,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? AppColors.primarySurface : AppColors.surface,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: selected ? AppColors.primary : AppColors.border,
          ),
        ),
        child: Text(
          _statusFilterLabel(filter),
          style: TextStyle(
            fontSize: 13,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            color: selected ? AppColors.primary : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }

  Widget _calendarCard(List<ProviderWorkspaceBooking> bookings) {
    final monthLabel = _monthLabel(_visibleMonth);
    final days = _calendarDays(bookings);
    final todayKey = _dateKey(DateTime.now());

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(_cardRadius),
        border: Border.all(color: AppColors.border),
        boxShadow: const [
          BoxShadow(
            color: AppColors.shadow,
            blurRadius: 20,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            children: [
              _monthArrow(
                icon: Icons.chevron_left_rounded,
                onTap: () => setState(() {
                  _visibleMonth = DateTime(
                    _visibleMonth.year,
                    _visibleMonth.month - 1,
                    1,
                  );
                }),
              ),
              Expanded(
                child: Column(
                  children: [
                    Text(
                      monthLabel,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    const Text(
                      'Select a date to view bookings',
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 11,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              _monthArrow(
                icon: Icons.chevron_right_rounded,
                onTap: () => setState(() {
                  _visibleMonth = DateTime(
                    _visibleMonth.year,
                    _visibleMonth.month + 1,
                    1,
                  );
                }),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          const Row(
            children: [
              Expanded(
                child: Center(child: Text('Sun', style: _dowStyle)),
              ),
              Expanded(
                child: Center(child: Text('Mon', style: _dowStyle)),
              ),
              Expanded(
                child: Center(child: Text('Tue', style: _dowStyle)),
              ),
              Expanded(
                child: Center(child: Text('Wed', style: _dowStyle)),
              ),
              Expanded(
                child: Center(child: Text('Thu', style: _dowStyle)),
              ),
              Expanded(
                child: Center(child: Text('Fri', style: _dowStyle)),
              ),
              Expanded(
                child: Center(child: Text('Sat', style: _dowStyle)),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          GridView.builder(
            itemCount: days.length,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 7,
              crossAxisSpacing: 6,
              mainAxisSpacing: 6,
              childAspectRatio: 0.9,
            ),
            itemBuilder: (context, index) {
              final day = days[index];
              if (day == null) {
                return const SizedBox.shrink();
              }
              final selected = day.key == _selectedDateKey;
              final isToday = day.key == todayKey;
              return InkWell(
                borderRadius: BorderRadius.circular(_tileRadius - 2),
                onTap: () => setState(() => _selectedDateKey = day.key),
                child: Container(
                  decoration: BoxDecoration(
                    color: selected ? AppColors.primary : AppColors.surface,
                    borderRadius: BorderRadius.circular(_tileRadius - 2),
                    border: !selected && isToday
                        ? Border.all(color: AppColors.primary, width: 1.4)
                        : null,
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        '${day.day}',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: selected
                              ? Colors.white
                              : AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        '${day.count}',
                        style: TextStyle(
                          fontSize: 10,
                          color: selected
                              ? Colors.white70
                              : day.count > 0
                              ? AppColors.primary
                              : AppColors.textMuted,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _bookingListCard(
    BuildContext context,
    ProviderWorkspaceBooking booking,
  ) {
    return InkWell(
      borderRadius: BorderRadius.circular(_tileRadius + 2),
      onTap: () => _showBookingDetailsSheet(context, booking),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(_tileRadius + 2),
          border: Border.all(color: AppColors.border),
          boxShadow: const [
            BoxShadow(
              color: AppColors.shadow,
              blurRadius: 16,
              offset: Offset(0, 6),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SwiperStatusBadge(
              label: booking.statusLabel,
              tone: _bookingTone(booking.bookingStatus),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              booking.serviceLabel,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              booking.customerName.isEmpty ? 'Customer' : booking.customerName,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 13,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            _infoRow(Icons.schedule_outlined, booking.schedule),
            const SizedBox(height: 4),
            _infoRow(Icons.place_outlined, booking.location),
            const SizedBox(height: AppSpacing.sm),
            Text(
              _currency(booking.quotedAmount),
              style: const TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w800,
                color: AppColors.primary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showBookingDetailsSheet(
    BuildContext context,
    ProviderWorkspaceBooking booking,
  ) {
    return Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (context) => Scaffold(
          backgroundColor: AppColors.background,
          appBar: AppBar(
            title: const Text('Task Details'),
            backgroundColor: AppColors.surface,
            foregroundColor: AppColors.textPrimary,
            elevation: 0,
          ),
          body: SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.md,
                AppSpacing.md,
                AppSpacing.md,
                AppSpacing.xl,
              ),
              child: _bookingDetailCard(
                context,
                booking,
                showCloseButton: false,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _bookingDetailCard(
    BuildContext context,
    ProviderWorkspaceBooking booking, {
    bool showCloseButton = true,
  }) {
    final isPending =
        booking.bookingStatus == 'pending' ||
        booking.bookingStatus == 'pending_provider_response';
    final isCancellable =
        booking.bookingStatus == 'accepted' ||
        booking.bookingStatus == 'on_the_way';
    final action = _primaryActionFor(booking);
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.border),
        boxShadow: const [
          BoxShadow(
            color: AppColors.shadow,
            blurRadius: 24,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isPending ? 'Booking Request' : 'Booking Details',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1,
                        color: AppColors.primary,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      booking.serviceLabel,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                        letterSpacing: -0.5,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      booking.customerName.isEmpty
                          ? 'Customer'
                          : booking.customerName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              if (showCloseButton)
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(
                    Icons.close_rounded,
                    color: AppColors.textSecondary,
                  ),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          _taskDetailSummary(booking),
          const SizedBox(height: AppSpacing.md),
          _taskPath(booking),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.of(
                    context,
                  ).pushNamed(AppRoutes.providerMessages),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.primary,
                    side: const BorderSide(color: AppColors.border),
                    minimumSize: const Size.fromHeight(48),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: const Text(
                    'Message Customer',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
              if (action != null) ...[
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: SwiperButton(
                    label: action.label,
                    onPressed: _busyBookingId.isNotEmpty
                        ? null
                        : () async {
                            await action.onPressed(context, booking);
                            // Same stale-snapshot problem as
                            // _handleStepAction above -- this button (Accept,
                            // On The Way, Arrived, Work Finished, Review)
                            // reaches the exact same result via a different
                            // code path, so it needs the exact same fix.
                            if (context.mounted) {
                              _closeDetailsPageAfterSuccess(context);
                            }
                          },
                  ),
                ),
              ],
            ],
          ),
          if (isPending) ...[
            const SizedBox(height: AppSpacing.sm),
            SizedBox(
              width: double.infinity,
              child: SwiperButton(
                label: 'Decline',
                isSecondary: true,
                onPressed: _busyBookingId.isNotEmpty
                    ? null
                    : () => _showDeclineDialog(context, booking),
              ),
            ),
          ],
          if (isCancellable) ...[
            const SizedBox(height: AppSpacing.sm),
            SizedBox(
              width: double.infinity,
              child: SwiperButton(
                label: 'Cancel Booking',
                isSecondary: true,
                onPressed: _busyBookingId.isNotEmpty
                    ? null
                    : () => _showCancelDialog(context, booking),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _taskDetailSummary(ProviderWorkspaceBooking booking) {
    return Column(
      children: [
        _summaryTile(
          icon: Icons.person_outline_rounded,
          label: 'User Detail',
          value:
              '${booking.customerName.isEmpty ? 'Customer' : booking.customerName}\nBooking ID: ${booking.id}',
        ),
        const SizedBox(height: AppSpacing.sm),
        _summaryTile(
          icon: Icons.place_outlined,
          label: 'Location',
          value: booking.location.isEmpty
              ? 'Location not provided'
              : booking.location,
        ),
        const SizedBox(height: AppSpacing.sm),
        _summaryTile(
          icon: Icons.schedule_outlined,
          label: 'Date & Time',
          value: booking.schedule.isEmpty
              ? 'Schedule not provided'
              : booking.schedule,
        ),
        const SizedBox(height: AppSpacing.sm),
        _summaryTile(
          icon: Icons.payments_outlined,
          label: 'Payment',
          value:
              'Provider net ${_currency(booking.providerNetAmount)} / Commission ${_currency(booking.companyCommissionAmount)}',
        ),
        const SizedBox(height: AppSpacing.sm),
        _summaryTile(
          icon: Icons.info_outline_rounded,
          label: 'User Notes',
          value: booking.customerNote.trim().isEmpty
              ? 'No notes from user.'
              : booking.customerNote.trim(),
        ),
      ],
    );
  }

  Widget _summaryTile({
    required IconData icon,
    required String label,
    required String value,
  }) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surfaceSoft,
        borderRadius: BorderRadius.circular(_tileRadius + 2),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: const BoxDecoration(
              color: AppColors.surface,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 18, color: AppColors.primary),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1,
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 13,
                    height: 1.4,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _taskPath(ProviderWorkspaceBooking booking) {
    final steps = [
      _TimelineStep(
        number: 1,
        title: 'Confirmed',
        state: _stepState(
          booking.bookingStatus,
          done: const [
            'accepted',
            'on_the_way',
            'arrived',
            'final_payment_sent',
            'cash_paid_by_user',
            'payment_received_by_provider',
            'completed',
            'paid',
            'review_requested',
            'reviewed',
          ],
          current: const ['pending', 'pending_provider_response'],
        ),
        dateLabel: _dateLabel(
          booking.acceptedAt.isEmpty ? booking.createdAt : booking.acceptedAt,
        ),
        timeLabel: _timeLabel(
          booking.acceptedAt.isEmpty ? booking.createdAt : booking.acceptedAt,
        ),
      ),
      _TimelineStep(
        number: 2,
        title: 'On The Way',
        state: _stepState(
          booking.bookingStatus,
          done: const [
            'on_the_way',
            'arrived',
            'final_payment_sent',
            'cash_paid_by_user',
            'payment_received_by_provider',
            'completed',
            'paid',
            'review_requested',
            'reviewed',
          ],
          current: const ['accepted'],
        ),
        dateLabel: _dateLabel(booking.onTheWayAt),
        timeLabel: _timeLabel(booking.onTheWayAt),
      ),
      _TimelineStep(
        number: 3,
        title: 'Arrived',
        state: _stepState(
          booking.bookingStatus,
          done: const [
            'arrived',
            'final_payment_sent',
            'cash_paid_by_user',
            'payment_received_by_provider',
            'completed',
            'paid',
            'review_requested',
            'reviewed',
          ],
          current: const ['on_the_way'],
        ),
        dateLabel: _dateLabel(booking.arrivedAt),
        timeLabel: _timeLabel(booking.arrivedAt),
      ),
      _TimelineStep(
        number: 4,
        title: 'Payment Requested',
        state: _stepState(
          booking.bookingStatus,
          done: const [
            'final_payment_sent',
            'cash_paid_by_user',
            'payment_received_by_provider',
            'completed',
            'paid',
            'review_requested',
            'reviewed',
          ],
          current: const ['arrived'],
        ),
        dateLabel: _dateLabel(booking.completedAt),
        timeLabel: _timeLabel(booking.completedAt),
      ),
      _TimelineStep(
        number: 5,
        title: 'Payment Completed',
        state: _stepState(
          booking.bookingStatus,
          done: const [
            'cash_paid_by_user',
            'payment_received_by_provider',
            'completed',
            'paid',
            'review_requested',
            'reviewed',
          ],
          current: const ['final_payment_sent'],
        ),
        dateLabel: _dateLabel(booking.paidAt),
        timeLabel: _timeLabel(booking.paidAt),
      ),
      _TimelineStep(
        number: 6,
        title: 'Review',
        state:
            booking.providerReviewStatus == 'submitted' ||
                booking.providerReviewedAt.isNotEmpty
            ? _TimelineState.done
            : _isCompletedStatus(booking.bookingStatus)
            ? _TimelineState.current
            : _TimelineState.waiting,
        dateLabel: _dateLabel(
          booking.providerReviewedAt.isEmpty
              ? booking.reviewedAt
              : booking.providerReviewedAt,
        ),
        timeLabel: _timeLabel(
          booking.providerReviewedAt.isEmpty
              ? booking.reviewedAt
              : booking.providerReviewedAt,
        ),
      ),
    ];

    return Column(
      children: [
        for (var index = 0; index < steps.length; index++) ...[
          _timelineCard(context, booking, steps[index]),
          if (index != steps.length - 1)
            Container(
              width: 2,
              height: 18,
              color:
                  steps[index].state == _TimelineState.done ||
                      steps[index].state == _TimelineState.current
                  ? AppColors.primary
                  : AppColors.divider,
            ),
        ],
      ],
    );
  }

  Widget _timelineCard(
    BuildContext context,
    ProviderWorkspaceBooking booking,
    _TimelineStep step,
  ) {
    final waiting = step.state == _TimelineState.waiting;
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 32,
            height: 32,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color:
                  step.state == _TimelineState.done ||
                      step.state == _TimelineState.current
                  ? AppColors.primary
                  : AppColors.surface,
              borderRadius: BorderRadius.circular(999),
              border: Border.all(
                color: waiting ? AppColors.disabled : AppColors.primary,
                width: 3,
              ),
            ),
            child: Text(
              step.state == _TimelineState.done ? 'OK' : '${step.number}',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w900,
                color:
                    step.state == _TimelineState.done ||
                        step.state == _TimelineState.current
                    ? Colors.white
                    : AppColors.textMuted,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        '${step.number}. ${step.title}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                    _timelineStateChip(step.state),
                  ],
                ),
                if (step.dateLabel.isNotEmpty || step.timeLabel.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Wrap(
                    spacing: AppSpacing.md,
                    runSpacing: AppSpacing.xs,
                    children: [
                      if (step.dateLabel.isNotEmpty)
                        _inlineMeta(Icons.event_outlined, step.dateLabel),
                      if (step.timeLabel.isNotEmpty)
                        _inlineMeta(Icons.schedule_outlined, step.timeLabel),
                    ],
                  ),
                ],
                if (step.title == 'Payment Completed' &&
                    booking.customerPaymentProofDataUrl.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    'Customer payment slip',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.network(
                      booking.customerPaymentProofDataUrl,
                      height: 140,
                      fit: BoxFit.cover,
                      errorBuilder: (context, error, stackTrace) =>
                          const SizedBox.shrink(),
                    ),
                  ),
                ],
                if (_shouldShowStepAction(step, booking)) ...[
                  const SizedBox(height: AppSpacing.md),
                  SizedBox(
                    width: double.infinity,
                    child: SwiperButton(
                      label: _stepActionLabel(step, booking),
                      onPressed: _busyBookingId.isNotEmpty
                          ? null
                          : () => _handleStepAction(context, step, booking),
                    ),
                  ),
                ],
                if (step.title == 'Review' &&
                    (booking.providerReviewStatus == 'submitted' ||
                        booking.providerReviewedAt.isNotEmpty)) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    'Your rating: ${booking.providerReviewRating}/5${booking.providerReviewComment.trim().isEmpty ? '' : '\n${booking.providerReviewComment.trim()}'}',
                    style: const TextStyle(
                      fontSize: 13,
                      height: 1.5,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _timelineStateChip(_TimelineState state) {
    final border = switch (state) {
      _TimelineState.done => AppColors.success.withValues(alpha: 0.35),
      _TimelineState.current => AppColors.primary.withValues(alpha: 0.35),
      _TimelineState.waiting => AppColors.border,
    };
    final foreground = switch (state) {
      _TimelineState.done => AppColors.success,
      _TimelineState.current => AppColors.primary,
      _TimelineState.waiting => AppColors.textSecondary,
    };
    final label = switch (state) {
      _TimelineState.done => 'Done',
      _TimelineState.current => 'Current Step',
      _TimelineState.waiting => 'Waiting',
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: border),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: foreground,
        ),
      ),
    );
  }

  Widget _inlineMeta(IconData icon, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: AppColors.textSecondary),
        const SizedBox(width: 6),
        Flexible(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 12,
              color: AppColors.textSecondary,
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _showDeclineDialog(
    BuildContext context,
    ProviderWorkspaceBooking booking,
  ) async {
    final reason = await showDialog<String>(
      context: context,
      builder: (_) => const _ReasonDialog(
        title: 'Decline Booking',
        hint: 'Please enter the reason for declining this booking.',
        requiredMessage: 'Decline reason is required.',
        dismissLabel: 'Cancel',
        confirmLabel: 'Decline',
      ),
    );
    if (reason == null || !mounted) {
      return;
    }

    await _updateBookingStatus(
      booking.id,
      'declined_by_provider',
      note: reason,
      notice: 'Booking declined.',
    );
    if (!context.mounted) {
      return;
    }
    _closeDetailsPageAfterSuccess(context);
  }

  Future<void> _showCancelDialog(
    BuildContext context,
    ProviderWorkspaceBooking booking,
  ) async {
    final reason = await showDialog<String>(
      context: context,
      builder: (_) => const _ReasonDialog(
        title: 'Cancel Booking',
        hint: 'Please enter the reason for cancelling this booking.',
        requiredMessage: 'Cancellation reason is required.',
        dismissLabel: 'Keep Booking',
        confirmLabel: 'Cancel Booking',
      ),
    );
    if (reason == null || !mounted) {
      return;
    }

    await _updateBookingStatus(
      booking.id,
      'cancelled',
      note: reason,
      notice: 'Booking cancelled.',
    );
    if (!context.mounted) {
      return;
    }
    _closeDetailsPageAfterSuccess(context);
  }

  /// The Task Details page is pushed with the booking as it was when opened,
  /// so after a decline/cancel it would keep showing the old status (and the
  /// same buttons). Close it once the change actually went through; on an
  /// error it stays open so the message is visible.
  void _closeDetailsPageAfterSuccess(BuildContext context) {
    if (!mounted || _error.isNotEmpty || !context.mounted) {
      return;
    }
    Navigator.of(context).maybePop();
  }

  Future<void> _showWorkFinishedDialog(
    BuildContext context,
    ProviderWorkspaceBooking booking,
  ) async {
    final result = await showDialog<_WorkFinishedResult>(
      context: context,
      barrierDismissible: false,
      builder: (_) => _WorkFinishedDialog(
        baseAmount: booking.baseAmount,
        initialImages: booking.workFinishedImages,
        initialAdditionalAmount: booking.additionalCharge,
        initialNote: booking.additionalChargeDescription.isNotEmpty
            ? booking.additionalChargeDescription
            : booking.paymentNote,
      ),
    );

    if (result == null || !mounted) {
      return;
    }

    final finalAmount = booking.baseAmount + result.additionalAmount;

    if (finalAmount <= 0) {
      setState(() => _error = 'Final amount must be a valid number.');
      return;
    }

    final breakdown = <Map<String, dynamic>>[
      {'description': 'Booking Price', 'amount': booking.baseAmount},
      if (result.additionalAmount > 0)
        {
          'description': result.note.isEmpty
              ? 'Additional Charges'
              : result.note,
          'amount': result.additionalAmount,
        },
    ];

    await _updateBookingStatus(
      booking.id,
      'final_payment_sent',
      note: result.note.isEmpty
          ? 'Provider marked work as finished and sent the final cash payment request.'
          : result.note,
      finalAmount: finalAmount,
      workFinishedImages: result.images,
      paymentBreakdown: breakdown,
      notice: 'Payment request sent.',
    );
  }

  Future<void> _showReviewDialog(
    BuildContext context,
    ProviderWorkspaceBooking booking,
  ) async {
    final result = await showDialog<_ReviewResult>(
      context: context,
      builder: (_) => _ReviewDialog(
        customerName: booking.customerName,
        initialRating: booking.providerReviewRating > 0
            ? booking.providerReviewRating
            : 5,
        initialComment: booking.providerReviewComment,
      ),
    );

    if (result == null || !mounted) {
      return;
    }

    setState(() {
      _busyBookingId = booking.id;
      _error = '';
      _message = '';
    });

    try {
      await _workspaceService.submitProviderReview(
        bookingId: booking.id,
        rating: result.rating,
        comment: result.comment,
        photos: result.photos,
      );
      await _reload();
      if (!mounted) {
        return;
      }
      setState(() {
        _message = 'Provider review submitted successfully.';
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = error.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() => _busyBookingId = '');
      }
    }
  }

  Future<void> _updateBookingStatus(
    String bookingId,
    String status, {
    required String notice,
    String note = '',
    double? finalAmount,
    List<String>? workFinishedImages,
    List<Map<String, dynamic>>? paymentBreakdown,
  }) async {
    setState(() {
      _busyBookingId = bookingId;
      _error = '';
      _message = '';
    });

    try {
      await _workspaceService.updateBookingStatus(
        bookingId: bookingId,
        status: status,
        note: note,
        finalAmount: finalAmount,
        workFinishedImages: workFinishedImages,
        paymentBreakdown: paymentBreakdown,
      );
      await _reload();
      if (!mounted) {
        return;
      }
      setState(() => _message = notice);
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = error.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() => _busyBookingId = '');
      }
    }
  }

  Future<void> _handleStepAction(
    BuildContext context,
    _TimelineStep step,
    ProviderWorkspaceBooking booking,
  ) async {
    switch (step.title) {
      case 'On The Way':
        await _updateBookingStatus(
          booking.id,
          'on_the_way',
          note: 'Provider started travel to customer',
          notice: 'Marked as on the way.',
        );
        break;
      case 'Arrived':
        await _updateBookingStatus(
          booking.id,
          'arrived',
          note: 'Provider arrived at customer location',
          notice: 'Marked as arrived.',
        );
        break;
      case 'Payment Requested':
        await _showWorkFinishedDialog(context, booking);
        break;
      case 'Payment Completed':
        await _updateBookingStatus(
          booking.id,
          'completed',
          note: 'Provider confirmed payment received and completed the task.',
          notice: 'Payment received.',
        );
        if (context.mounted && booking.providerReviewStatus != 'submitted') {
          await _showReviewDialog(context, booking);
        }
        break;
      case 'Review':
        await _showReviewDialog(context, booking);
        break;
    }

    // This whole page is a snapshot of the booking taken when it was
    // opened -- it never learns about a status change made from its own
    // buttons. Closing it after a successful action (same as
    // Cancel/Decline already do) sends the provider back to the list,
    // which reloads fresh; staying open would keep showing the old status
    // and the wrong action button (e.g. still "Accept" after the booking
    // was already accepted).
    if (context.mounted) {
      _closeDetailsPageAfterSuccess(context);
    }
  }

  _BookingAction? _primaryActionFor(ProviderWorkspaceBooking booking) {
    if (booking.bookingStatus == 'pending' ||
        booking.bookingStatus == 'pending_provider_response') {
      return _BookingAction(
        label: 'Accept',
        onPressed: (context, booking) => _updateBookingStatus(
          booking.id,
          'accepted',
          note: 'Provider accepted booking',
          notice: 'Booking accepted.',
        ),
      );
    }
    if (booking.bookingStatus == 'accepted') {
      return _BookingAction(
        label: 'On The Way',
        onPressed: (context, booking) => _updateBookingStatus(
          booking.id,
          'on_the_way',
          note: 'Provider started travel to customer',
          notice: 'Marked as on the way.',
        ),
      );
    }
    if (booking.bookingStatus == 'on_the_way') {
      return _BookingAction(
        label: 'Arrived',
        onPressed: (context, booking) => _updateBookingStatus(
          booking.id,
          'arrived',
          note: 'Provider arrived at customer location',
          notice: 'Marked as arrived.',
        ),
      );
    }
    if (booking.bookingStatus == 'arrived') {
      return _BookingAction(
        label: 'Work Finished',
        onPressed: (context, booking) =>
            _showWorkFinishedDialog(context, booking),
      );
    }
    if (_isCompletedStatus(booking.bookingStatus) &&
        booking.providerReviewStatus != 'submitted' &&
        booking.providerReviewedAt.isEmpty) {
      return _BookingAction(
        label: 'Review User',
        onPressed: (context, booking) => _showReviewDialog(context, booking),
      );
    }
    return null;
  }

  List<_CalendarDay?> _calendarDays(List<ProviderWorkspaceBooking> bookings) {
    final firstDay = DateTime(_visibleMonth.year, _visibleMonth.month, 1);
    final daysInMonth = DateUtils.getDaysInMonth(
      _visibleMonth.year,
      _visibleMonth.month,
    );
    final leadingEmpty = firstDay.weekday % 7;
    final days = <_CalendarDay?>[];

    for (var i = 0; i < leadingEmpty; i++) {
      days.add(null);
    }
    for (var day = 1; day <= daysInMonth; day++) {
      final date = DateTime(_visibleMonth.year, _visibleMonth.month, day);
      final key = _dateKey(date);
      final count = bookings
          .where((booking) => _normalizedDateKey(booking.scheduledDate) == key)
          .length;
      days.add(_CalendarDay(day: day, key: key, count: count));
    }
    return days;
  }

  List<ProviderWorkspaceBooking> _sortBookings(
    Iterable<ProviderWorkspaceBooking> bookings,
  ) {
    final list = bookings.toList(growable: false);
    list.sort(
      (a, b) => '${a.scheduledDate}T${a.scheduledStartTime}'.compareTo(
        '${b.scheduledDate}T${b.scheduledStartTime}',
      ),
    );
    return list;
  }

  _TimelineState _stepState(
    String bookingStatus, {
    required List<String> done,
    required List<String> current,
  }) {
    if (done.contains(bookingStatus)) {
      return _TimelineState.done;
    }
    if (current.contains(bookingStatus)) {
      return _TimelineState.current;
    }
    return _TimelineState.waiting;
  }

  bool _shouldShowStepAction(
    _TimelineStep step,
    ProviderWorkspaceBooking booking,
  ) {
    return switch (step.title) {
      'On The Way' => booking.bookingStatus == 'accepted',
      'Arrived' => booking.bookingStatus == 'on_the_way',
      'Payment Requested' => booking.bookingStatus == 'arrived',
      'Payment Completed' =>
        booking.bookingStatus == 'final_payment_sent' ||
            booking.bookingStatus == 'cash_paid_by_user' ||
            booking.bookingStatus == 'payment_received_by_provider',
      'Review' =>
        _isCompletedStatus(booking.bookingStatus) &&
            booking.providerReviewStatus != 'submitted' &&
            booking.providerReviewedAt.isEmpty,
      _ => false,
    };
  }

  String _stepActionLabel(
    _TimelineStep step,
    ProviderWorkspaceBooking booking,
  ) {
    return switch (step.title) {
      'On The Way' => 'Mark As On The Way',
      'Arrived' => 'Mark As Arrived',
      'Payment Requested' => 'Mark Job Completed & Send Payment Request',
      'Payment Completed' =>
        booking.bookingStatus == 'final_payment_sent'
            ? 'Payment Received'
            : 'Complete Job',
      'Review' => 'Review User',
      _ => 'Continue',
    };
  }

  String _monthLabel(DateTime month) {
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    return '${months[month.month - 1]} ${month.year}';
  }

  String _dateLabel(String value) {
    final date = DateTime.tryParse(value);
    if (date == null) {
      return '';
    }
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return '${date.day.toString().padLeft(2, '0')} ${months[date.month - 1]} ${date.year}';
  }

  String _timeLabel(String value) {
    final date = DateTime.tryParse(value);
    if (date == null) {
      return '';
    }
    final hour = date.hour == 0
        ? 12
        : (date.hour > 12 ? date.hour - 12 : date.hour);
    final minutes = date.minute.toString().padLeft(2, '0');
    final suffix = date.hour >= 12 ? 'PM' : 'AM';
    return '$hour:$minutes $suffix';
  }

  String _currency(double value) => 'RM ${value.toStringAsFixed(2)}';

  bool _isCompletedStatus(String status) {
    return const [
      'completed',
      'paid',
      'review_requested',
      'reviewed',
    ].contains(status);
  }

  bool _isCancelledStatus(String status) {
    return const [
      'cancelled',
      'declined',
      'declined_by_provider',
    ].contains(status);
  }

  SwiperStatusTone _bookingTone(String status) {
    if (_isCompletedStatus(status)) {
      return SwiperStatusTone.success;
    }
    if (_isCancelledStatus(status)) {
      return SwiperStatusTone.error;
    }
    if (status == 'pending' || status == 'pending_provider_response') {
      return SwiperStatusTone.warning;
    }
    return SwiperStatusTone.info;
  }

  Widget _monthArrow({required IconData icon, required VoidCallback onTap}) {
    return InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: onTap,
      child: Container(
        width: 36,
        height: 36,
        decoration: const BoxDecoration(
          color: AppColors.surfaceSoft,
          shape: BoxShape.circle,
        ),
        child: Icon(icon, color: AppColors.primary),
      ),
    );
  }

  Widget _infoRow(IconData icon, String label) {
    return Row(
      children: [
        Icon(icon, size: 16, color: AppColors.primary),
        const SizedBox(width: AppSpacing.xs),
        Expanded(
          child: Text(
            label.isEmpty ? '-' : label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 13,
              color: AppColors.textSecondary,
            ),
          ),
        ),
      ],
    );
  }
}

class _WorkFinishedResult {
  const _WorkFinishedResult({
    required this.images,
    required this.additionalAmount,
    required this.note,
  });

  final List<String> images;
  final double additionalAmount;
  final String note;
}

/// Owns its own controllers and disposes them via normal widget lifecycle
/// (State.dispose) instead of the caller manually calling .dispose() right
/// after showDialog() returns -- that pattern disposes a controller still
/// wired to a text field that may not have finished animating off screen
/// yet, which is what caused the crash on this exact dialog (same root
/// cause already fixed for the Cancel/Decline dialogs via _ReasonDialog).
class _WorkFinishedDialog extends StatefulWidget {
  const _WorkFinishedDialog({
    required this.baseAmount,
    required this.initialImages,
    required this.initialAdditionalAmount,
    required this.initialNote,
  });

  final double baseAmount;
  final List<String> initialImages;
  final double initialAdditionalAmount;
  final String initialNote;

  @override
  State<_WorkFinishedDialog> createState() => _WorkFinishedDialogState();
}

class _WorkFinishedDialogState extends State<_WorkFinishedDialog> {
  late final TextEditingController _additionalController;
  late final TextEditingController _noteController;
  late List<String> _images;
  String? _localError;

  @override
  void initState() {
    super.initState();
    _additionalController = TextEditingController(
      text: widget.initialAdditionalAmount > 0
          ? widget.initialAdditionalAmount.toStringAsFixed(2)
          : '',
    );
    _noteController = TextEditingController(text: widget.initialNote);
    _images = [...widget.initialImages];
  }

  @override
  void dispose() {
    _additionalController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _addPhotos() async {
    final picked = await pickMultipleBrowserFiles(
      accept: 'image/*,.pdf,application/pdf',
    );
    if (picked.isEmpty || !mounted) {
      return;
    }
    final remaining = 3 - _images.length;
    if (remaining <= 0) {
      setState(() => _localError = 'You can upload up to 3 files.');
      return;
    }
    final toAdd = picked.take(remaining).toList();
    // PDFs (allowed by the accept string above) pass through
    // optimizePublicImage untouched -- only raster images get resized.
    final optimized = await Future.wait(
      toAdd.map(
        (file) =>
            optimizePublicImage(file, maxDimension: kMediumImageMaxDimension),
      ),
    );
    if (!mounted) {
      return;
    }
    setState(() {
      _images = [..._images, ...optimized.map((file) => file.dataUrl)];
      _localError = null;
    });
  }

  void _removePhoto(int index) {
    setState(() {
      _images = List<String>.from(_images)..removeAt(index);
    });
  }

  void _submit() {
    if (_images.isEmpty) {
      setState(() {
        _localError =
            'Please attach at least 1 job image before sending the payment request.';
      });
      return;
    }
    Navigator.of(context).pop(
      _WorkFinishedResult(
        images: _images,
        additionalAmount:
            double.tryParse(_additionalController.text.trim()) ?? 0,
        note: _noteController.text.trim(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Mark Job Completed'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Fixed Amount: RM ${widget.baseAmount.toStringAsFixed(2)}'),
            const SizedBox(height: AppSpacing.md),
            TextField(
              controller: _additionalController,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: const InputDecoration(
                labelText: 'Additional Amount (RM)',
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            TextField(
              controller: _noteController,
              minLines: 3,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Description',
                hintText: 'Extra work / additional materials',
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            CompactMediaPicker(
              title: 'Job Completion Photos',
              subtitle: 'Upload up to 3 photos showing the finished work.',
              emptyLabel: 'Tap to upload job photos',
              dataUrls: _images,
              onPick: _addPhotos,
              onRemove: _removePhoto,
            ),
            if (_localError != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                _localError!,
                style: const TextStyle(
                  color: AppColors.error,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        FilledButton(onPressed: _submit, child: const Text('Send Payment Request')),
      ],
    );
  }
}

class _ReviewResult {
  const _ReviewResult({
    required this.rating,
    required this.comment,
    required this.photos,
  });

  final int rating;
  final String comment;
  final List<String> photos;
}

/// Same fix as _WorkFinishedDialog above: owns and disposes its own
/// controller via normal widget lifecycle instead of the caller manually
/// disposing it right after showDialog() returns.
class _ReviewDialog extends StatefulWidget {
  const _ReviewDialog({
    required this.customerName,
    required this.initialRating,
    required this.initialComment,
  });

  final String customerName;
  final int initialRating;
  final String initialComment;

  @override
  State<_ReviewDialog> createState() => _ReviewDialogState();
}

class _ReviewDialogState extends State<_ReviewDialog> {
  late final TextEditingController _commentController;
  late int _rating;
  List<String> _photos = [];
  String? _localError;

  @override
  void initState() {
    super.initState();
    _rating = widget.initialRating;
    _commentController = TextEditingController(text: widget.initialComment);
  }

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _addPhotos() async {
    final picked = await pickMultipleBrowserFiles(accept: 'image/*');
    if (picked.isEmpty || !mounted) {
      return;
    }
    final remaining = 4 - _photos.length;
    if (remaining <= 0) {
      return;
    }
    final toAdd = picked.take(remaining).toList();
    final optimized = await Future.wait(
      toAdd.map(
        (file) =>
            optimizePublicImage(file, maxDimension: kMediumImageMaxDimension),
      ),
    );
    if (!mounted) {
      return;
    }
    setState(() {
      _photos = [..._photos, ...optimized.map((file) => file.dataUrl)];
    });
  }

  void _removePhoto(int index) {
    setState(() {
      _photos = List<String>.from(_photos)..removeAt(index);
    });
  }

  void _submit() {
    if (_rating < 1) {
      setState(() => _localError = 'Please choose a rating.');
      return;
    }
    Navigator.of(context).pop(
      _ReviewResult(
        rating: _rating,
        comment: _commentController.text.trim(),
        photos: _photos,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(
        'Review ${widget.customerName.isEmpty ? 'Customer' : widget.customerName}',
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: List.generate(
                5,
                (index) => IconButton(
                  onPressed: () => setState(() => _rating = index + 1),
                  icon: Icon(
                    Icons.star_rounded,
                    color: index < _rating
                        ? AppColors.primary
                        : AppColors.disabled,
                  ),
                ),
              ),
            ),
            TextField(
              controller: _commentController,
              minLines: 4,
              maxLines: 5,
              decoration: const InputDecoration(
                labelText: 'Comment',
                hintText: 'Write your feedback about this customer.',
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            CompactMediaPicker(
              title: 'Review Photos',
              subtitle: 'Optional — up to 4 photos.',
              emptyLabel: 'Tap to add review photos',
              dataUrls: _photos,
              onPick: _addPhotos,
              onRemove: _removePhoto,
              maxFiles: 4,
            ),
            if (_localError != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                _localError!,
                style: const TextStyle(
                  color: AppColors.error,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        FilledButton(onPressed: _submit, child: const Text('Submit Review')),
      ],
    );
  }
}

class _BookingAction {
  const _BookingAction({required this.label, required this.onPressed});

  final String label;
  final Future<void> Function(BuildContext, ProviderWorkspaceBooking) onPressed;
}

class _CalendarDay {
  const _CalendarDay({
    required this.day,
    required this.key,
    required this.count,
  });

  final int day;
  final String key;
  final int count;
}

class _TimelineStep {
  const _TimelineStep({
    required this.number,
    required this.title,
    required this.state,
    required this.dateLabel,
    required this.timeLabel,
  });

  final int number;
  final String title;
  final _TimelineState state;
  final String dateLabel;
  final String timeLabel;
}

enum _TimelineState { done, current, waiting }

const TextStyle _dowStyle = TextStyle(
  fontSize: 11,
  fontWeight: FontWeight.w600,
  color: AppColors.textMuted,
);

String _dateKey(DateTime date) {
  final month = date.month.toString().padLeft(2, '0');
  final day = date.day.toString().padLeft(2, '0');
  return '${date.year}-$month-$day';
}

/// Normalizes a booking's raw `scheduledDate` value to a plain `yyyy-MM-dd`
/// key so the calendar's per-day count and the selected-date list filter
/// always compare the same shape of value — even if the backend returns a
/// full timestamp (e.g. "2026-08-15T00:00:00.000Z") for some bookings and a
/// plain date (e.g. "2026-08-15") for others. Pure string slicing, no
/// DateTime parsing or timezone conversion, so it can't shift the date.
String _normalizedDateKey(String rawDate) {
  final trimmed = rawDate.trim();
  if (trimmed.length >= 10) {
    return trimmed.substring(0, 10);
  }
  return trimmed;
}

Widget _noticeCard(String message, Color color, Color background) {
  return Container(
    padding: const EdgeInsets.symmetric(
      horizontal: AppSpacing.md,
      vertical: AppSpacing.sm,
    ),
    decoration: BoxDecoration(
      color: background,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: color.withValues(alpha: 0.3)),
    ),
    child: Text(
      message,
      style: TextStyle(color: color, fontWeight: FontWeight.w600),
    ),
  );
}


/// Asks for a required reason. Owns its own text controller so the text field
/// is never torn down while the dialog is still animating closed. Pops with
/// the trimmed reason, or null if dismissed.
class _ReasonDialog extends StatefulWidget {
  const _ReasonDialog({
    required this.title,
    required this.hint,
    required this.requiredMessage,
    required this.dismissLabel,
    required this.confirmLabel,
  });

  final String title;
  final String hint;
  final String requiredMessage;
  final String dismissLabel;
  final String confirmLabel;

  @override
  State<_ReasonDialog> createState() => _ReasonDialogState();
}

class _ReasonDialogState extends State<_ReasonDialog> {
  final _controller = TextEditingController();
  String? _reasonError;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.title),
      content: TextField(
        controller: _controller,
        autofocus: true,
        minLines: 3,
        maxLines: 4,
        decoration: InputDecoration(
          hintText: widget.hint,
          errorText: _reasonError,
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(widget.dismissLabel),
        ),
        FilledButton(
          onPressed: () {
            final reason = _controller.text.trim();
            if (reason.isEmpty) {
              setState(() => _reasonError = widget.requiredMessage);
              return;
            }
            Navigator.of(context).pop(reason);
          },
          child: Text(widget.confirmLabel),
        ),
      ],
    );
  }
}
