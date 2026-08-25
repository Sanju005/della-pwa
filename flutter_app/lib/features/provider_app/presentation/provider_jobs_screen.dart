import 'package:flutter/material.dart';

import '../../../core/routing/app_routes.dart';
import '../../../repositories/demo_repository.dart';
import '../../../services/browser_file_picker.dart';
import '../../../services/provider_workspace_service.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/loading_state.dart';
import '../../../widgets/swiper_button.dart';
import '../../../widgets/swiper_status_badge.dart';

class ProviderJobsScreen extends StatefulWidget {
  const ProviderJobsScreen({
    super.key,
    required this.repository,
  });

  final DemoRepository repository;

  @override
  State<ProviderJobsScreen> createState() => _ProviderJobsScreenState();
}

class _ProviderJobsScreenState extends State<ProviderJobsScreen> {
  static const _workspaceService = ProviderWorkspaceService();

  late Future<List<ProviderWorkspaceBooking>> _future;
  late DateTime _visibleMonth;
  String _selectedDateKey = _dateKey(DateTime.now());
  String _busyBookingId = '';
  String _message = '';
  String _error = '';

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _visibleMonth = DateTime(now.year, now.month, 1);
    _future = _workspaceService.fetchBookings();
  }

  Future<void> _reload() async {
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
          return const LoadingState(label: 'Loading provider bookings...');
        }
        if (snapshot.hasError) {
          return const EmptyState(
            title: 'Unable to load provider bookings',
            subtitle: 'Please try again.',
            icon: Icons.error_outline_rounded,
          );
        }

        final bookings = snapshot.data ?? const [];
        final selectedDateBookings = _sortBookings(
          bookings.where((booking) => booking.scheduledDate == _selectedDateKey),
        );

        return ListView(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.md,
            AppSpacing.md,
            AppSpacing.md,
            112,
          ),
          children: [
            if (_error.isNotEmpty) ...[
              _noticeCard(_error, AppColors.error, const Color(0xFFFFF1F2)),
            ],
            if (_message.isNotEmpty) ...[
              if (_error.isNotEmpty) const SizedBox(height: AppSpacing.md),
              _noticeCard(
                _message,
                AppColors.success,
                const Color(0xFFF0FDF4),
              ),
            ],
            const SizedBox(height: AppSpacing.md),
            _calendarCard(bookings),
            const SizedBox(height: AppSpacing.md),
            if (selectedDateBookings.isEmpty)
              const EmptyState(
                title: 'No bookings found',
                subtitle: 'No bookings are scheduled for the selected date.',
                icon: Icons.calendar_month_outlined,
              )
            else
              ...selectedDateBookings.map(
                (booking) => Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                  child: _bookingListCard(context, booking),
                ),
              ),
          ],
        );
      },
    );
  }

  Widget _calendarCard(List<ProviderWorkspaceBooking> bookings) {
    final monthLabel = _monthLabel(_visibleMonth);
    final days = _calendarDays(bookings);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFEEE5F7)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x14562687),
            blurRadius: 24,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: const Color(0xFFFCFAFF),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFEEE5F7)),
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
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            'Select a date to load booking cards below.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 12,
                              color: Color(0xFF7B728A),
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
                const SizedBox(height: AppSpacing.md),
                const Row(
                  children: [
                    Expanded(child: Center(child: Text('Sun', style: _dowStyle))),
                    Expanded(child: Center(child: Text('Mon', style: _dowStyle))),
                    Expanded(child: Center(child: Text('Tue', style: _dowStyle))),
                    Expanded(child: Center(child: Text('Wed', style: _dowStyle))),
                    Expanded(child: Center(child: Text('Thu', style: _dowStyle))),
                    Expanded(child: Center(child: Text('Fri', style: _dowStyle))),
                    Expanded(child: Center(child: Text('Sat', style: _dowStyle))),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                GridView.builder(
                  itemCount: days.length,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 7,
                    crossAxisSpacing: 8,
                    mainAxisSpacing: 8,
                    childAspectRatio: 0.9,
                  ),
                  itemBuilder: (context, index) {
                    final day = days[index];
                    if (day == null) {
                      return const SizedBox.shrink();
                    }
                    final active = day.key == _selectedDateKey;
                    return InkWell(
                      borderRadius: BorderRadius.circular(14),
                      onTap: () => setState(() => _selectedDateKey = day.key),
                      child: Container(
                        decoration: BoxDecoration(
                          color: active ? AppColors.primary : Colors.white,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              '${day.day}',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: active
                                    ? Colors.white
                                    : AppColors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${day.count}',
                              style: TextStyle(
                                fontSize: 10,
                                color: active
                                    ? Colors.white70
                                    : day.count > 0
                                        ? AppColors.primary
                                        : const Color(0xFFC4B7D8),
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
          ),
        ],
      ),
    );
  }

  Widget _bookingListCard(
    BuildContext context,
    ProviderWorkspaceBooking booking,
  ) {
    final action = _primaryActionFor(booking);
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: const Color(0xFFFCFAFF),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFEEE5F7)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0D562687),
            blurRadius: 20,
            offset: Offset(0, 8),
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
                child: Text(
                  booking.customerName.isEmpty ? 'Customer' : booking.customerName,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              SwiperStatusBadge(
                label: booking.statusLabel,
                tone: _bookingTone(booking.bookingStatus),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          _infoRow(Icons.schedule_outlined, booking.schedule),
          const SizedBox(height: AppSpacing.xs),
          _infoRow(Icons.place_outlined, booking.location),
          const SizedBox(height: AppSpacing.xs),
          _infoRow(Icons.payments_outlined, _currency(booking.quotedAmount)),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => _showBookingDetailsSheet(context, booking),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.primary,
                    side: const BorderSide(color: Color(0xFFD9C5F1)),
                    minimumSize: const Size.fromHeight(44),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: const Text('View Details'),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: action == null
                    ? Container(
                        height: 44,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Text(
                          _flowLabelFor(booking.bookingStatus),
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF64748B),
                          ),
                        ),
                      )
                    : SwiperButton(
                        label: action.label,
                        onPressed: _busyBookingId.isNotEmpty
                            ? null
                            : () => action.onPressed(context, booking),
                      ),
              ),
            ],
          ),
        ],
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
          backgroundColor: const Color(0xFFF7F2FB),
          appBar: AppBar(
            title: const Text('Task Details'),
            backgroundColor: Colors.white,
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
    final isPending = booking.bookingStatus == 'pending' ||
        booking.bookingStatus == 'pending_provider_response';
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFEEE5F7)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x14562687),
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
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                        letterSpacing: -0.5,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      booking.customerName.isEmpty ? 'Customer' : booking.customerName,
                      style: const TextStyle(
                        fontSize: 13,
                        color: Color(0xFF64748B),
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
                    color: Color(0xFF64748B),
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
                  onPressed: () => Navigator.of(context).pushNamed(
                    AppRoutes.providerMessages,
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.primary,
                    side: const BorderSide(color: Color(0xFFD9C5F1)),
                    minimumSize: const Size.fromHeight(48),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: const Text('Message Customer'),
                ),
              ),
              if (isPending) ...[
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: SwiperButton(
                    label: 'Accept',
                    onPressed: _busyBookingId.isNotEmpty
                        ? null
                        : () => _updateBookingStatus(
                              booking.id,
                              'accepted',
                              notice: 'Booking accepted.',
                              note: 'Provider accepted booking',
                            ),
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
          value: booking.location.isEmpty ? 'Location not provided' : booking.location,
        ),
        const SizedBox(height: AppSpacing.sm),
        _summaryTile(
          icon: Icons.schedule_outlined,
          label: 'Date & Time',
          value: booking.schedule.isEmpty ? 'Schedule not provided' : booking.schedule,
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
        color: const Color(0xFFFBF8FF),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFEEE5F7)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: const BoxDecoration(
              color: Colors.white,
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
        dateLabel: _dateLabel(booking.acceptedAt.isEmpty ? booking.createdAt : booking.acceptedAt),
        timeLabel: _timeLabel(booking.acceptedAt.isEmpty ? booking.createdAt : booking.acceptedAt),
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
        state: booking.providerReviewStatus == 'submitted' ||
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
              color: steps[index].state == _TimelineState.done ||
                      steps[index].state == _TimelineState.current
                  ? AppColors.primary
                  : const Color(0xFFE5E7EB),
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
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFEEE5F7)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 32,
            height: 32,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: step.state == _TimelineState.done ||
                      step.state == _TimelineState.current
                  ? AppColors.primary
                  : Colors.white,
              borderRadius: BorderRadius.circular(999),
              border: Border.all(
                color: waiting ? const Color(0xFFD1D5DB) : AppColors.primary,
                width: 3,
              ),
            ),
            child: Text(
              step.state == _TimelineState.done ? 'OK' : '${step.number}',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w900,
                color: step.state == _TimelineState.done ||
                        step.state == _TimelineState.current
                    ? Colors.white
                    : const Color(0xFF94A3B8),
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
                      color: Color(0xFF64748B),
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
    final background = switch (state) {
      _TimelineState.done => const Color(0xFFFFFFFF),
      _TimelineState.current => const Color(0xFFFFFFFF),
      _TimelineState.waiting => const Color(0xFFFFFFFF),
    };
    final border = switch (state) {
      _TimelineState.done => const Color(0xFFBBF7D0),
      _TimelineState.current => const Color(0xFFDCC7F7),
      _TimelineState.waiting => const Color(0xFFE5E7EB),
    };
    final foreground = switch (state) {
      _TimelineState.done => AppColors.success,
      _TimelineState.current => AppColors.primary,
      _TimelineState.waiting => const Color(0xFF6B7280),
    };
    final label = switch (state) {
      _TimelineState.done => 'Done',
      _TimelineState.current => 'Current Step',
      _TimelineState.waiting => 'Waiting',
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: background,
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
        Icon(icon, size: 14, color: const Color(0xFF64748B)),
        const SizedBox(width: 6),
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            color: Color(0xFF64748B),
          ),
        ),
      ],
    );
  }

  Future<void> _showDeclineDialog(
    BuildContext context,
    ProviderWorkspaceBooking booking,
  ) async {
    final controller = TextEditingController();
    final shouldDecline = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Decline Booking'),
          content: TextField(
            controller: controller,
            minLines: 3,
            maxLines: 4,
            decoration: const InputDecoration(
              hintText: 'Please enter the reason for declining this booking.',
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Decline'),
            ),
          ],
        );
      },
    );

    final note = controller.text.trim();
    controller.dispose();
    if (shouldDecline != true) {
      return;
    }
    if (note.isEmpty) {
      setState(() => _error = 'Decline reason is required.');
      return;
    }

    await _updateBookingStatus(
      booking.id,
      'declined_by_provider',
      note: note,
      notice: 'Booking declined.',
    );
  }

  Future<void> _showWorkFinishedDialog(
    BuildContext context,
    ProviderWorkspaceBooking booking,
  ) async {
    final additionalController = TextEditingController(
      text: booking.additionalCharge > 0
          ? booking.additionalCharge.toStringAsFixed(2)
          : '',
    );
    final noteController = TextEditingController(
      text: booking.additionalChargeDescription.isNotEmpty
          ? booking.additionalChargeDescription
          : booking.paymentNote,
    );
    final images = <String>[...booking.workFinishedImages];
    String? localError;

    final submitted = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            Future<void> addPhotos() async {
              final picked = await pickMultipleBrowserFiles(
                accept: 'image/*,.pdf,application/pdf',
              );
              if (picked.isEmpty) {
                return;
              }
              final remaining = 3 - images.length;
              if (remaining <= 0) {
                setDialogState(() => localError = 'You can upload up to 3 files.');
                return;
              }
              setDialogState(() {
                images.addAll(
                  picked.take(remaining).map((file) => file.dataUrl),
                );
                localError = null;
              });
            }

            return AlertDialog(
              title: const Text('Mark Job Completed'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Fixed Amount: ${_currency(booking.baseAmount)}'),
                    const SizedBox(height: AppSpacing.md),
                    TextField(
                      controller: additionalController,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      decoration: const InputDecoration(
                        labelText: 'Additional Amount (RM)',
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    TextField(
                      controller: noteController,
                      minLines: 3,
                      maxLines: 4,
                      decoration: const InputDecoration(
                        labelText: 'Description',
                        hintText: 'Extra work / additional materials',
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    OutlinedButton(
                      onPressed: addPhotos,
                      child: const Text('Upload Job Photos'),
                    ),
                    if (images.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Wrap(
                        spacing: AppSpacing.sm,
                        runSpacing: AppSpacing.sm,
                        children: List.generate(
                          images.length,
                          (index) => Stack(
                            children: [
                              Container(
                                width: 72,
                                height: 72,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: const Color(0xFFE7DCF7),
                                  ),
                                ),
                                clipBehavior: Clip.antiAlias,
                                child: images[index].startsWith('data:application/pdf')
                                    ? const Center(
                                        child: Text(
                                          'PDF',
                                          style: TextStyle(
                                            fontWeight: FontWeight.w800,
                                            color: AppColors.primary,
                                          ),
                                        ),
                                      )
                                    : Image.network(
                                        images[index],
                                        fit: BoxFit.cover,
                                      ),
                              ),
                              Positioned(
                                right: 0,
                                top: 0,
                                child: InkWell(
                                  onTap: () => setDialogState(() {
                                    images.removeAt(index);
                                  }),
                                  child: Container(
                                    width: 22,
                                    height: 22,
                                    decoration: const BoxDecoration(
                                      color: Colors.black54,
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Icon(
                                      Icons.close_rounded,
                                      size: 14,
                                      color: Colors.white,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                    if (localError != null) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        localError!,
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
                  onPressed: () => Navigator.of(context).pop(false),
                  child: const Text('Cancel'),
                ),
                FilledButton(
                  onPressed: () {
                    if (images.isEmpty) {
                      setDialogState(() {
                        localError =
                            'Please attach at least 1 job image before sending the payment request.';
                      });
                      return;
                    }
                    Navigator.of(context).pop(true);
                  },
                  child: const Text('Send Payment Request'),
                ),
              ],
            );
          },
        );
      },
    );

    if (submitted != true) {
      additionalController.dispose();
      noteController.dispose();
      return;
    }

    final additionalAmount =
        double.tryParse(additionalController.text.trim()) ?? 0;
    final finalAmount = booking.baseAmount + additionalAmount;
    final note = noteController.text.trim();
    additionalController.dispose();
    noteController.dispose();

    if (finalAmount <= 0) {
      setState(() => _error = 'Final amount must be a valid number.');
      return;
    }

    final breakdown = <Map<String, dynamic>>[
      {
        'description': 'Booking Price',
        'amount': booking.baseAmount,
      },
      if (additionalAmount > 0)
        {
          'description':
              note.isEmpty ? 'Additional Charges' : note,
          'amount': additionalAmount,
        },
    ];

    await _updateBookingStatus(
      booking.id,
      'final_payment_sent',
      note: note.isEmpty
          ? 'Provider marked work as finished and sent the final cash payment request.'
          : note,
      finalAmount: finalAmount,
      workFinishedImages: images,
      paymentBreakdown: breakdown,
      notice: 'Payment request sent.',
    );
  }

  Future<void> _showReviewDialog(
    BuildContext context,
    ProviderWorkspaceBooking booking,
  ) async {
    int rating = booking.providerReviewRating > 0 ? booking.providerReviewRating : 5;
    final commentController = TextEditingController(
      text: booking.providerReviewComment,
    );
    final photos = <String>[];
    String? localError;

    final submit = await showDialog<bool>(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            Future<void> addPhotos() async {
              final picked = await pickMultipleBrowserFiles(accept: 'image/*');
              if (picked.isEmpty) {
                return;
              }
              setDialogState(() {
                photos.addAll(picked.take(4 - photos.length).map((e) => e.dataUrl));
              });
            }

            return AlertDialog(
              title: Text('Review ${booking.customerName.isEmpty ? 'Customer' : booking.customerName}'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: List.generate(
                        5,
                        (index) => IconButton(
                          onPressed: () => setDialogState(() => rating = index + 1),
                          icon: Icon(
                            Icons.star_rounded,
                            color: index < rating
                                ? AppColors.primary
                                : const Color(0xFFD1D5DB),
                          ),
                        ),
                      ),
                    ),
                    TextField(
                      controller: commentController,
                      minLines: 4,
                      maxLines: 5,
                      decoration: const InputDecoration(
                        labelText: 'Comment',
                        hintText: 'Write your feedback about this customer.',
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    OutlinedButton(
                      onPressed: photos.length >= 4 ? null : addPhotos,
                      child: const Text('Add Review Photos'),
                    ),
                    if (photos.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Wrap(
                        spacing: AppSpacing.sm,
                        runSpacing: AppSpacing.sm,
                        children: photos
                            .map(
                              (photo) => ClipRRect(
                                borderRadius: BorderRadius.circular(12),
                                child: Image.network(
                                  photo,
                                  width: 60,
                                  height: 60,
                                  fit: BoxFit.cover,
                                ),
                              ),
                            )
                            .toList(growable: false),
                      ),
                    ],
                    if (localError != null) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        localError!,
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
                  onPressed: () => Navigator.of(context).pop(false),
                  child: const Text('Cancel'),
                ),
                FilledButton(
                  onPressed: () {
                    if (rating < 1) {
                      setDialogState(() => localError = 'Please choose a rating.');
                      return;
                    }
                    Navigator.of(context).pop(true);
                  },
                  child: const Text('Submit Review'),
                ),
              ],
            );
          },
        );
      },
    );

    if (submit != true) {
      commentController.dispose();
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
        rating: rating,
        comment: commentController.text.trim(),
        photos: photos,
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
      commentController.dispose();
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
        break;
      case 'Review':
        await _showReviewDialog(context, booking);
        break;
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
        onPressed: (context, booking) => _showWorkFinishedDialog(context, booking),
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

  String _flowLabelFor(String status) {
    if (_isCompletedStatus(status)) {
      return 'Completed flow';
    }
    if (_isCancelledStatus(status)) {
      return 'Canceled flow';
    }
    if (status == 'declined' || status == 'declined_by_provider') {
      return 'Declined flow';
    }
    return 'Live task';
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
      final count = bookings.where((booking) => booking.scheduledDate == key).length;
      days.add(_CalendarDay(day: day, key: key, count: count));
    }
    return days;
  }

  List<ProviderWorkspaceBooking> _sortBookings(
    Iterable<ProviderWorkspaceBooking> bookings,
  ) {
    final list = bookings.toList(growable: false);
    list.sort(
      (a, b) => '${a.scheduledDate}T${a.scheduledStartTime}'
          .compareTo('${b.scheduledDate}T${b.scheduledStartTime}'),
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

  bool _shouldShowStepAction(_TimelineStep step, ProviderWorkspaceBooking booking) {
    return switch (step.title) {
      'On The Way' => booking.bookingStatus == 'accepted',
      'Arrived' => booking.bookingStatus == 'on_the_way',
      'Payment Requested' => booking.bookingStatus == 'arrived',
      'Payment Completed' => booking.bookingStatus == 'final_payment_sent' ||
          booking.bookingStatus == 'cash_paid_by_user' ||
          booking.bookingStatus == 'payment_received_by_provider',
      'Review' => _isCompletedStatus(booking.bookingStatus) &&
          booking.providerReviewStatus != 'submitted' &&
          booking.providerReviewedAt.isEmpty,
      _ => false,
    };
  }

  String _stepActionLabel(_TimelineStep step, ProviderWorkspaceBooking booking) {
    return switch (step.title) {
      'On The Way' => 'Mark As On The Way',
      'Arrived' => 'Mark As Arrived',
      'Payment Requested' => 'Mark Job Completed & Send Payment Request',
      'Payment Completed' => booking.bookingStatus == 'final_payment_sent'
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
    final hour = date.hour == 0 ? 12 : (date.hour > 12 ? date.hour - 12 : date.hour);
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

  Widget _monthArrow({
    required IconData icon,
    required VoidCallback onTap,
  }) {
    return InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: onTap,
      child: Container(
        width: 36,
        height: 36,
        decoration: const BoxDecoration(
          color: Colors.white,
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
            style: const TextStyle(
              fontSize: 13,
              color: Color(0xFF475569),
            ),
          ),
        ),
      ],
    );
  }
}

class _BookingAction {
  const _BookingAction({
    required this.label,
    required this.onPressed,
  });

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
  fontWeight: FontWeight.w500,
  color: Color(0xFF94A3B8),
);

String _dateKey(DateTime date) {
  final month = date.month.toString().padLeft(2, '0');
  final day = date.day.toString().padLeft(2, '0');
  return '${date.year}-$month-$day';
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
      style: TextStyle(
        color: color,
        fontWeight: FontWeight.w600,
      ),
    ),
  );
}
