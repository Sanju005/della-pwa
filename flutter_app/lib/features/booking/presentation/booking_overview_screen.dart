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
  });

  final DemoRepository repository;
  final bool embedded;

  @override
  State<BookingOverviewScreen> createState() => _BookingOverviewScreenState();
}

class _BookingOverviewScreenState extends State<BookingOverviewScreen> {
  static const _bookingService = BookingOverviewService();
  BookingFilter _filter = BookingFilter.all;

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

        final visibleRecords = allRecords.where(_matchesFilter).toList();

        if (visibleRecords.isEmpty) {
          return const EmptyState(
            title: 'No bookings for this filter',
            subtitle: 'Try another booking date filter.',
            icon: Icons.filter_alt_off_outlined,
          );
        }

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
            _filterCard(),
            const SizedBox(height: AppSpacing.lg),
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
      appBar: const SwiperAppBar(
        title: 'My Bookings',
        subtitle: 'Latest booking first',
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
        return !date.isBefore(now);
    }
  }

  Widget _filterCard() {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: Colors.white,
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
                    SizedBox(height: 4),
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
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(child: _filterChip('All', BookingFilter.all)),
              const SizedBox(width: AppSpacing.xs),
              Expanded(child: _filterChip('Today', BookingFilter.today)),
              const SizedBox(width: AppSpacing.xs),
              Expanded(child: _filterChip('Month', BookingFilter.month)),
              const SizedBox(width: AppSpacing.xs),
              Expanded(child: _filterChip('Custom', BookingFilter.custom)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _filterChip(String label, BookingFilter filter) {
    final selected = _filter == filter;
    return InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: () => setState(() => _filter = filter),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary : Colors.white,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: selected ? AppColors.primary : AppColors.border,
          ),
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: selected ? Colors.white : AppColors.textSecondary,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
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
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: AppColors.border),
        boxShadow: const [
          BoxShadow(
            color: AppColors.shadow,
            blurRadius: 28,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: const BoxDecoration(
                  color: AppColors.primarySoft,
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Text(
                  booking.providerName.isNotEmpty
                      ? booking.providerName.characters.first.toUpperCase()
                      : 'P',
                  style: const TextStyle(
                    color: AppColors.primary,
                    fontSize: 26,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      booking.providerName,
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                            fontWeight: FontWeight.w900,
                          ),
                    ),
                    const SizedBox(height: 4),
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
                  horizontal: 14,
                  vertical: 10,
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
          const SizedBox(height: AppSpacing.lg),
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
          const SizedBox(height: AppSpacing.lg),
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
      padding: const EdgeInsets.all(AppSpacing.md),
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: const BoxDecoration(
              color: AppColors.primarySoft,
              borderRadius: BorderRadius.all(Radius.circular(18)),
            ),
            child: Icon(icon, color: AppColors.primary),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                color: emphasize ? AppColors.textPrimary : AppColors.textPrimary,
                fontSize: emphasize ? 16 : 15,
                fontWeight: emphasize ? FontWeight.w900 : FontWeight.w600,
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
