import 'package:flutter/material.dart';

import '../../../repositories/demo_repository.dart';
import '../../../services/booking_overview_service.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/booking_card.dart';
import '../../../widgets/booking_timeline.dart';
import '../../../widgets/loading_state.dart';
import '../../../widgets/swiper_app_bar.dart';
import '../../../widgets/swiper_section_card.dart';

class BookingOverviewScreen extends StatelessWidget {
  const BookingOverviewScreen({
    super.key,
    required this.repository,
    this.embedded = false,
  });

  final DemoRepository repository;
  final bool embedded;
  static const _bookingService = BookingOverviewService();

  @override
  Widget build(BuildContext context) {
    final content = FutureBuilder(
      future: _bookingService.fetchCustomerBookings(),
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const LoadingState(label: 'Loading bookings...');
        }

        if (snapshot.hasError) {
          return EmptyState(
            title: 'Unable to load bookings',
            subtitle: snapshot.error.toString(),
            icon: Icons.error_outline_rounded,
          );
        }

        final data = snapshot.data;
        if (data == null) {
          return const EmptyState(
            title: 'No bookings yet',
            subtitle:
                'When this customer has real bookings in Supabase, past and future tasks will appear here.',
            icon: Icons.calendar_month_outlined,
          );
        }

        return ListView(
          padding: AppSpacing.screenPadding,
          children: [
            if (data.upcomingBookings.isNotEmpty) ...[
              SwiperSectionCard(
                title: 'Upcoming tasks',
                subtitle: 'Future and active customer bookings',
                child: Column(
                  children: [
                    for (final record in data.upcomingBookings) ...[
                      BookingCard(booking: record.booking),
                      const SizedBox(height: AppSpacing.md),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
            ],
            if (data.upcomingBookings.isNotEmpty) ...[
              SwiperSectionCard(
                title: 'Current task timeline',
                subtitle: 'Live task progression from booking status',
                child: BookingTimeline(
                  steps: data.upcomingBookings.first.booking.steps,
                  activeIndex: data.upcomingBookings.first.activeStepIndex,
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              SwiperSectionCard(
                title: 'Current payment details',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Status: ${data.upcomingBookings.first.paymentStatus}',
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      'Method: ${data.upcomingBookings.first.paymentMethod}',
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      'Amount: ${data.upcomingBookings.first.paymentAmountLabel}',
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      'Paid at: ${data.upcomingBookings.first.paymentDateLabel}',
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
            ],
            SwiperSectionCard(
              title: 'Past tasks',
              subtitle: 'Completed, cancelled, and older bookings',
              child: data.pastBookings.isEmpty
                  ? const EmptyState(
                      title: 'No past tasks',
                      subtitle:
                          'Completed or older customer bookings will appear here.',
                      icon: Icons.history_rounded,
                    )
                  : Column(
                      children: [
                        for (final record in data.pastBookings) ...[
                          BookingCard(booking: record.booking),
                          const SizedBox(height: AppSpacing.md),
                        ],
                      ],
                    ),
            ),
          ],
        );
      },
    );

    if (embedded) {
      return content;
    }

    return Scaffold(
      appBar: const SwiperAppBar(
        title: 'Booking Overview',
        subtitle: 'Customer booking demo',
        showBack: true,
      ),
      body: content,
    );
  }
}
