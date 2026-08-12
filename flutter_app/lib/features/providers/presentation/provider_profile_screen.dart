import 'package:flutter/material.dart';

import '../../../repositories/demo_repository.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/profile_avatar.dart';
import '../../../widgets/rating_badge.dart';
import '../../../widgets/swiper_app_bar.dart';
import '../../../widgets/swiper_button.dart';
import '../../../widgets/swiper_section_card.dart';
import '../../../widgets/verified_badge.dart';

class ProviderProfileScreen extends StatelessWidget {
  const ProviderProfileScreen({
    super.key,
    required this.repository,
  });

  final DemoRepository repository;

  @override
  Widget build(BuildContext context) {
    final provider = repository.getFeaturedProvider();

    return Scaffold(
      appBar: const SwiperAppBar(
        title: 'Provider Profile',
        subtitle: 'Customer-facing detail demo',
        showBack: true,
      ),
      body: ListView(
        padding: AppSpacing.screenPadding,
        children: [
          SwiperSectionCard(
            title: provider.name,
            subtitle: provider.service,
            trailing: RatingBadge(
              rating: provider.rating,
              reviewCount: provider.reviewCount,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const ProfileAvatar(name: 'Nur Aisyah', radius: 34),
                const SizedBox(height: AppSpacing.md),
                Text(provider.description, style: Theme.of(context).textTheme.bodyLarge),
                const SizedBox(height: AppSpacing.md),
                Wrap(
                  spacing: AppSpacing.md,
                  runSpacing: AppSpacing.xs,
                  children: [
                    VerifiedBadge(
                      label: 'Phone verified',
                      verified: provider.phoneVerified,
                    ),
                    VerifiedBadge(
                      label: 'Identity verified',
                      verified: provider.identityVerified,
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          SwiperSectionCard(
            title: 'Specialties',
            child: Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xs,
              children: provider.specialties
                  .map(
                    (specialty) => Chip(
                      label: Text(specialty),
                    ),
                  )
                  .toList(),
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          SwiperSectionCard(
            title: 'Service details',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Location: ${provider.location}'),
                const SizedBox(height: AppSpacing.xs),
                Text('Distance: ${provider.distanceLabel}'),
                const SizedBox(height: AppSpacing.xs),
                Text('Rate: RM ${provider.hourlyRate}/hour'),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          SwiperButton(
            label: 'Continue to booking demo',
            icon: const Icon(Icons.arrow_forward_rounded),
            onPressed: () => Navigator.of(context).pushNamed('/booking-overview'),
          ),
        ],
      ),
    );
  }
}
