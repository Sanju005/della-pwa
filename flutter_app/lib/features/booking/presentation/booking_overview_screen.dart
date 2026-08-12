import 'package:flutter/material.dart';

import '../../../repositories/demo_repository.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/booking_card.dart';
import '../../../widgets/booking_timeline.dart';
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

  @override
  Widget build(BuildContext context) {
    final booking = repository.getFeaturedBooking();

    final content = ListView(
      padding: AppSpacing.screenPadding,
      children: [
        BookingCard(booking: booking),
        const SizedBox(height: AppSpacing.lg),
        SwiperSectionCard(
          title: 'Timeline',
          subtitle: 'Shared booking progression component',
          child: BookingTimeline(steps: booking.steps, activeIndex: 1),
        ),
        const SizedBox(height: AppSpacing.lg),
        SwiperSectionCard(
          title: 'Booking summary',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Provider: ${booking.providerName}'),
              const SizedBox(height: AppSpacing.xs),
              Text('Schedule: ${booking.schedule}'),
              const SizedBox(height: AppSpacing.xs),
              Text('Location: ${booking.location}'),
              const SizedBox(height: AppSpacing.xs),
              Text('Estimated total: ${booking.amountLabel}'),
            ],
          ),
        ),
      ],
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
