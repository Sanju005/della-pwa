import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';

import '../models/provider_summary.dart';
import '../previews/widget_preview_helpers.dart';
import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';
import 'profile_avatar.dart';
import 'rating_badge.dart';
import 'verified_badge.dart';

class ProviderCard extends StatelessWidget {
  const ProviderCard({super.key, required this.provider, this.onTap});

  final ProviderSummary provider;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ProfileAvatar(name: provider.name, radius: 28),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          provider.name,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          provider.service,
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        RatingBadge(
                          rating: provider.rating,
                          reviewCount: provider.reviewCount,
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    provider.isFavorite
                        ? Icons.favorite_rounded
                        : Icons.favorite_border_rounded,
                    color: provider.isFavorite
                        ? AppColors.error
                        : AppColors.textSecondary,
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                provider.description,
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(color: AppColors.textPrimary),
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
                    label: 'ID verified',
                    verified: provider.identityVerified,
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              Wrap(
                spacing: AppSpacing.xs,
                runSpacing: AppSpacing.xs,
                children: provider.specialties
                    .map(
                      (specialty) => Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceMuted,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          specialty,
                          style: Theme.of(context).textTheme.labelMedium,
                        ),
                      ),
                    )
                    .toList(),
              ),
              const SizedBox(height: AppSpacing.md),
              Row(
                children: [
                  const Icon(
                    Icons.place_outlined,
                    size: 18,
                    color: AppColors.textSecondary,
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      provider.distanceLabel,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ),
                  Text(
                    'RM ${provider.hourlyRate}/hr',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: AppColors.primaryDeep,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

@Preview(
  name: 'Featured Provider',
  size: Size(420, 360),
  wrapper: previewSurface,
)
Widget providerCardPreview() {
  const provider = ProviderSummary(
    name: 'Nur Aisyah',
    service: 'Private Chef',
    hourlyRate: 95,
    rating: 4.9,
    reviewCount: 124,
    distanceLabel: '2.3 km away',
    description: 'Home-cooked Malay and fusion meals for busy families.',
    phoneVerified: true,
    identityVerified: true,
    isFavorite: true,
    location: 'Mont Kiara, Kuala Lumpur',
    specialties: ['Malay Cuisine', 'Healthy Meals', 'Family Events'],
  );

  return const ProviderCard(provider: provider);
}
