import 'package:flutter/material.dart';

import '../../../core/routing/app_routes.dart';
import '../../../models/provider_summary.dart';
import '../../../repositories/demo_repository.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/empty_state.dart';
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
    final args = ModalRoute.of(context)?.settings.arguments;
    final provider = args is ProviderSummary ? args : null;

    return Scaffold(
      appBar: const SwiperAppBar(
        title: 'Provider Profile',
        subtitle: 'Live provider details',
        showBack: true,
      ),
      body: provider == null
          ? const EmptyState(
              title: 'No provider selected',
              subtitle: 'Open this screen from the live providers list.',
              icon: Icons.storefront_outlined,
            )
          : ListView(
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
                      ProfileAvatar(name: provider.name, radius: 34),
                      const SizedBox(height: AppSpacing.md),
                      if (provider.providerName.isNotEmpty) ...[
                        Text(
                          provider.providerName,
                          style: Theme.of(context).textTheme.titleSmall,
                        ),
                        const SizedBox(height: AppSpacing.sm),
                      ],
                      Text(
                        provider.description,
                        style: Theme.of(context).textTheme.bodyLarge,
                      ),
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
                    children: (provider.specialties.isNotEmpty
                            ? provider.specialties
                            : provider.services)
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
                      if (provider.dailyRate > 0) ...[
                        const SizedBox(height: AppSpacing.xs),
                        Text('Daily rate: RM ${provider.dailyRate}/day'),
                      ],
                      if (provider.yearsExperience.isNotEmpty) ...[
                        const SizedBox(height: AppSpacing.xs),
                        Text('Experience: ${provider.yearsExperience}'),
                      ],
                      if (provider.services.isNotEmpty) ...[
                        const SizedBox(height: AppSpacing.xs),
                        Text('Services: ${provider.services.join(', ')}'),
                      ],
                      if (provider.approvalStatus.isNotEmpty) ...[
                        const SizedBox(height: AppSpacing.xs),
                        Text('Approval: ${provider.approvalStatus}'),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                SwiperButton(
                  label: 'Continue to booking demo',
                  icon: const Icon(Icons.arrow_forward_rounded),
              onPressed: () =>
                      Navigator.of(context).pushNamed(AppRoutes.bookingOverview),
                ),
              ],
            ),
    );
  }
}
