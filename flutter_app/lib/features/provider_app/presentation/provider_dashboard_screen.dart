import 'package:flutter/material.dart';

import '../../../repositories/demo_repository.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/booking_card.dart';
import '../../../widgets/swiper_button.dart';
import '../../../widgets/swiper_section_card.dart';
import '../../../widgets/swiper_status_badge.dart';

class ProviderDashboardScreen extends StatelessWidget {
  const ProviderDashboardScreen({
    super.key,
    required this.repository,
  });

  final DemoRepository repository;

  @override
  Widget build(BuildContext context) {
    final booking = repository.getFeaturedBooking();

    return ListView(
      padding: AppSpacing.screenPadding,
      children: [
        Container(
          padding: const EdgeInsets.all(AppSpacing.lg),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [AppColors.primaryDeep, AppColors.primary],
            ),
            borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Good evening, Nur',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      color: Colors.white,
                    ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                'You have 3 active jobs and 2 new booking requests today.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Colors.white70,
                    ),
              ),
              const SizedBox(height: AppSpacing.md),
              const SwiperStatusBadge(
                label: 'Provider Demo Workspace',
                tone: SwiperStatusTone.info,
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        SwiperSectionCard(
          title: 'Today\'s priority job',
          child: BookingCard(booking: booking),
        ),
        const SizedBox(height: AppSpacing.lg),
        SwiperSectionCard(
          title: 'Quick actions',
          child: Column(
            children: const [
              SwiperButton(label: 'Update availability'),
              SizedBox(height: AppSpacing.sm),
              SwiperButton(label: 'Review payouts', isSecondary: true),
            ],
          ),
        ),
      ],
    );
  }
}
