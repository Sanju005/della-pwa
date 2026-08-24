import 'package:flutter/material.dart';

import '../../../core/routing/app_routes.dart';
import '../../../repositories/demo_repository.dart';
import '../../../services/booking_overview_service.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/loading_state.dart';
import '../../../widgets/swiper_app_bar.dart';
import '../../../widgets/swiper_button.dart';

enum BookingFilter { all, today, month, custom }

class BookingOverviewScreen extends StatefulWidget {
  const BookingOverviewScreen({
    super.key,
    required this.repository,
    this.embedded = false,
    this.activeOnly = false,
  });

  final DemoRepository repository;
  final bool embedded;
  final bool activeOnly;

  @override
  State<BookingOverviewScreen> createState() => _BookingOverviewScreenState();
}

class _BookingOverviewScreenState extends State<BookingOverviewScreen> {
  static const _bookingService = BookingOverviewService();
  BookingFilter _filter = BookingFilter.all;
  DateTime? _customStartDate;
  DateTime? _customEndDate;

  @override
  Widget build(BuildContext context) {
    final args = ModalRoute.of(context)?.settings.arguments;
    final created = args is Map && args['created'] == true;

    final content = FutureBuilder<BookingOverviewData?>(
      future: _bookingService.fetchCustomerBookings(),
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const LoadingState(label: 'Loading bookings...');
        }

        if (snapshot.hasError) {
          return const EmptyState(
            title: 'Unable to load bookings',
            subtitle: 'Please try again.',
            icon: Icons.error_outline_rounded,
          );
        }

        final data = snapshot.data;
        if (data == null) {
          return const EmptyState(
            title: 'No bookings yet',
            subtitle: 'Your latest bookings will appear here.',
            icon: Icons.calendar_month_outlined,
          );
        }

        final allRecords = [
          ...data.upcomingBookings,
          ...data.pastBookings,
        ]..sort((a, b) {
            final first = b.booking.createdAt ?? b.booking.scheduledAt ?? DateTime(2000);
            final second = a.booking.createdAt ?? a.booking.scheduledAt ?? DateTime(2000);
            return first.compareTo(second);
          });

        final scopedRecords = widget.activeOnly
            ? allRecords.where((record) => !record.isPast).toList()
            : allRecords;
        final visibleRecords = scopedRecords.where(_matchesFilter).toList();

        return ListView(
          padding: AppSpacing.screenPadding,
          children: [
            if (created) ...[
              Container(
                margin: const EdgeInsets.only(bottom: AppSpacing.md),
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  color: const Color(0xFFF2FBF5),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: const Color(0xFFCBE8D2)),
                ),
                child: const Text(
                  'Booking created successfully.',
                  style: TextStyle(
                    color: Color(0xFF138A36),
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
            if (!widget.activeOnly) ...[
              _filterCard(),
              const SizedBox(height: AppSpacing.lg),
            ],
            if (visibleRecords.isEmpty)
              EmptyState(
                title: widget.activeOnly
                    ? 'No ongoing tasks'
                    : 'No bookings for this filter',
                subtitle: widget.activeOnly
                    ? 'Your pending and ongoing tasks will appear here.'
                    : 'Try another booking date filter.',
                icon: widget.activeOnly
                    ? Icons.task_alt_outlined
                    : Icons.filter_alt_off_outlined,
              )
            else
              for (final record in visibleRecords) ...[
                _bookingCard(context, record),
                const SizedBox(height: AppSpacing.lg),
              ],
          ],
        );
      },
    );

    if (widget.embedded) {
      return content;
    }

    return Scaffold(
      appBar: SwiperAppBar(
        title: widget.activeOnly ? 'Ongoing Task' : 'My Bookings',
        subtitle: widget.activeOnly
            ? 'Pending and ongoing tasks'
            : 'Latest booking first',
        showBack: true,
      ),
      body: content,
    );
  }

  bool _matchesFilter(CustomerBookingRecord record) {
    final now = DateTime.now();
    final date = record.booking.scheduledAt;
    if (date == null) {
      return _filter == BookingFilter.all;
    }

    switch (_filter) {
      case BookingFilter.all:
        return true;
      case BookingFilter.today:
        return date.year == now.year &&
            date.month == now.month &&
            date.day == now.day;
      case BookingFilter.month:
        return date.year == now.year && date.month == now.month;
      case BookingFilter.custom:
        if (_customStartDate == null || _customEndDate == null) {
          return true;
        }
        final rangeStart = DateTime(
          _customStartDate!.year,
          _customStartDate!.month,
          _customStartDate!.day,
        );
        final rangeEnd = DateTime(
          _customEndDate!.year,
          _customEndDate!.month,
          _customEndDate!.day,
          23,
          59,
          59,
        );
        return !date.isBefore(rangeStart) && !date.isAfter(rangeEnd);
    }
  }

  Widget _filterCard() {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A111720),
            blurRadius: 16,
            offset: Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Filter by Date',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    SizedBox(height: AppSpacing.xxs),
                    Text(
                      'Sorted by latest booking first',
                      style: TextStyle(color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: AppColors.primarySoft,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: const Text(
                  'Latest',
                  style: TextStyle(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              _filterChip('All', BookingFilter.all),
              _filterChip('Today', BookingFilter.today),
              _filterChip('Month', BookingFilter.month),
              _filterChip('Custom', BookingFilter.custom),
            ],
          ),
          if (_filter == BookingFilter.custom) ...[
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Expanded(
                  child: _dateField(
                    label: 'From',
                    value: _customStartDate,
                    onTap: () => _pickCustomDate(isStart: true),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: _dateField(
                    label: 'To',
                    value: _customEndDate,
                    onTap: () => _pickCustomDate(isStart: false),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _filterChip(String label, BookingFilter filter) {
    final selected = _filter == filter;
    return InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: () => setState(() {
        _filter = filter;
        if (filter != BookingFilter.custom) {
          _customStartDate = null;
          _customEndDate = null;
        } else {
          _customStartDate ??= DateTime.now().subtract(const Duration(days: 7));
          _customEndDate ??= DateTime.now();
        }
      }),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOutCubic,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary : Colors.white,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: selected ? AppColors.primary : AppColors.border,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? Colors.white : AppColors.textSecondary,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }

  Widget _dateField({
    required String label,
    required DateTime? value,
    required VoidCallback onTap,
  }) {
    return InkWell(
      borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFFF9F7FF),
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                Expanded(
                  child: Text(
                    value == null ? 'Select date' : _formatDate(value),
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                const Icon(
                  Icons.calendar_month_rounded,
                  color: AppColors.primary,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickCustomDate({required bool isStart}) async {
    final now = DateTime.now();
    final initialDate = isStart
        ? (_customStartDate ?? now)
        : (_customEndDate ?? _customStartDate ?? now);
    final firstDate = DateTime(now.year - 2);
    final lastDate = DateTime(now.year + 2, 12, 31);

    final picked = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: firstDate,
      lastDate: lastDate,
    );

    if (picked == null || !mounted) {
      return;
    }

    setState(() {
      if (isStart) {
        _customStartDate = picked;
        if (_customEndDate != null && _customEndDate!.isBefore(picked)) {
          _customEndDate = picked;
        }
      } else {
        _customEndDate = picked;
        if (_customStartDate != null && picked.isBefore(_customStartDate!)) {
          _customStartDate = picked;
        }
      }
    });
  }

  String _formatDate(DateTime value) {
    final monthNames = [
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
    return '${value.day} ${monthNames[value.month - 1]} ${value.year}';
  }

  Widget _bookingCard(BuildContext context, CustomerBookingRecord record) {
    final booking = record.booking;
    final statusLabel = _reactStatusLabel(booking.status);
    final statusColor = booking.status == 'Pending'
        ? AppColors.warning
        : booking.status == 'Completed'
            ? AppColors.success
            : AppColors.primary;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A111720),
            blurRadius: 16,
            offset: Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            children: [
              _BookingProviderAvatar(
                providerName: booking.providerName,
                providerImageUrl: booking.providerImageUrl,
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      booking.providerName,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: AppSpacing.xxs),
                    Text(
                      booking.title,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            color: AppColors.textSecondary,
                          ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(
                    color: statusColor.withValues(alpha: 0.28),
                  ),
                ),
                child: Text(
                  statusLabel,
                  style: TextStyle(
                    color: statusColor,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          _detailTile(
            icon: Icons.calendar_today_rounded,
            text: booking.schedule,
          ),
          _detailTile(
            icon: Icons.place_outlined,
            text: booking.location,
          ),
          _detailTile(
            icon: Icons.account_balance_wallet_outlined,
            text: booking.amountLabel,
            emphasize: true,
          ),
          const SizedBox(height: AppSpacing.sm),
          SizedBox(
            width: double.infinity,
            child: SwiperButton(
              label: 'Track Task',
              icon: const Icon(Icons.arrow_forward_rounded),
              onPressed: () {
                Navigator.of(context).pushNamed(
                  AppRoutes.bookingDetail,
                  arguments: booking.id,
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _detailTile({
    required IconData icon,
    required String text,
    bool emphasize = false,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.sm,
      ),
      margin: const EdgeInsets.only(bottom: AppSpacing.xs),
      decoration: BoxDecoration(
        color: const Color(0xFFF9F8FC),
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: const BoxDecoration(
              color: AppColors.primarySoft,
              borderRadius: BorderRadius.all(Radius.circular(12)),
            ),
            child: Icon(icon, color: AppColors.primary, size: 20),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: emphasize ? 16 : 15,
                fontWeight: emphasize ? FontWeight.w800 : FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _reactStatusLabel(String status) {
    final normalized = status.trim().toLowerCase();
    if (normalized == 'pending') {
      return 'Booking Sent';
    }
    if (normalized == 'completed' || normalized == 'paid') {
      return 'Completed';
    }
    if (normalized == 'accepted' || normalized == 'confirmed') {
      return 'Accepted';
    }
    return status;
  }
}

class _BookingProviderAvatar extends StatelessWidget {
  const _BookingProviderAvatar({
    required this.providerName,
    required this.providerImageUrl,
  });

  final String providerName;
  final String providerImageUrl;

  @override
  Widget build(BuildContext context) {
    final imageUrl = _resolveImageUrl(providerImageUrl);
    if (imageUrl.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(999),
        child: Image.network(
          imageUrl,
          width: 72,
          height: 72,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => _fallbackAvatar(),
        ),
      );
    }

    return _fallbackAvatar();
  }

  Widget _fallbackAvatar() {
    return Container(
      width: 72,
      height: 72,
      decoration: const BoxDecoration(
        color: AppColors.primarySoft,
        shape: BoxShape.circle,
      ),
      alignment: Alignment.center,
      child: Text(
        providerName.isNotEmpty ? providerName.characters.first.toUpperCase() : 'P',
        style: const TextStyle(
          color: AppColors.primary,
          fontSize: 26,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  String _resolveImageUrl(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) {
      return '';
    }
    if (trimmed.startsWith('http://') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('data:')) {
      return trimmed;
    }
    return '';
  }
}
