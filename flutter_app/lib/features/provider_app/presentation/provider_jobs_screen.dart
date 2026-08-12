import 'package:flutter/material.dart';

import '../../../repositories/demo_repository.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/booking_card.dart';
import '../../../widgets/swiper_section_card.dart';
import '../../../widgets/swiper_status_badge.dart';

class ProviderJobsScreen extends StatelessWidget {
  const ProviderJobsScreen({
    super.key,
    required this.repository,
  });

  final DemoRepository repository;

  @override
  Widget build(BuildContext context) {
    final bookings = repository.getBookings();

    return ListView(
      padding: AppSpacing.screenPadding,
      children: [
        SwiperSectionCard(
          title: 'Job card example',
          subtitle: 'This screen exists specifically for the Phase 2 provider job-card preview.',
          trailing: const SwiperStatusBadge(
            label: '2 Active',
            tone: SwiperStatusTone.warning,
          ),
          child: Column(
            children: [
              for (final booking in bookings) ...[
                BookingCard(booking: booking),
                const SizedBox(height: AppSpacing.md),
              ],
            ],
          ),
        ),
      ],
    );
  }
}
