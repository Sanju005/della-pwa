import 'package:flutter/material.dart';

import '../../../core/config/app_config.dart';
import '../../../core/routing/app_routes.dart';
import '../../../models/provider_summary.dart';
import '../../../repositories/demo_repository.dart';
import '../../../services/provider_detail_service.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/loading_state.dart';
import '../../../widgets/swiper_button.dart';
import '../../../widgets/swiper_app_bar.dart';

class ProviderProfileScreen extends StatelessWidget {
  const ProviderProfileScreen({
    super.key,
    required this.repository,
  });

  final DemoRepository repository;
  static const _detailService = ProviderDetailService();

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
      bottomNavigationBar: provider == null
          ? null
          : SafeArea(
              minimum: const EdgeInsets.fromLTRB(
                AppSpacing.md,
                AppSpacing.xs,
                AppSpacing.md,
                AppSpacing.md,
              ),
              child: Container(
                padding: const EdgeInsets.all(AppSpacing.xs),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x14111720),
                      blurRadius: 20,
                      offset: Offset(0, 8),
                    ),
                  ],
                ),
                child: SwiperButton(
                  label: 'Book Now',
                  icon: const Icon(Icons.calendar_month_rounded),
                  onPressed: () => Navigator.of(context).pushNamed(
                    AppRoutes.providerBooking,
                    arguments: provider,
                  ),
                ),
              ),
            ),
      body: provider == null
          ? const EmptyState(
              title: 'No provider selected',
              subtitle: 'Open this screen from the live providers list.',
              icon: Icons.storefront_outlined,
            )
          : FutureBuilder<ProviderDetailModel>(
              future: _detailService.fetchProviderDetail(
                id: provider.id,
                service: provider.serviceKey,
              ),
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return const LoadingState(
                    label: 'Loading provider profile...',
                  );
                }

                if (snapshot.hasError || snapshot.data == null) {
                  return const EmptyState(
                    title: 'Unable to load provider profile',
                    subtitle: 'Please try again.',
                    icon: Icons.error_outline_rounded,
                  );
                }

                final detail = snapshot.data!;
                return ListView(
                  padding: AppSpacing.screenPadding,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(22),
                          child: detail.profileImage.trim().isNotEmpty
                              ? Image.network(
                                  _resolveImageUrl(detail.profileImage),
                                  width: 118,
                                  height: 162,
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, __, ___) =>
                                      _profileFallback(detail),
                                )
                              : _profileFallback(detail),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      detail.name,
                                      style: Theme.of(context)
                                          .textTheme
                                          .titleLarge
                                          ?.copyWith(
                                            fontWeight: FontWeight.w800,
                                          ),
                                    ),
                                  ),
                                  if (detail.verified)
                                    const Icon(
                                      Icons.verified_rounded,
                                      color: AppColors.primary,
                                      size: 18,
                                    ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text(
                                detail.title,
                                style: Theme.of(context).textTheme.bodyMedium
                                    ?.copyWith(color: AppColors.textSecondary),
                              ),
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  const Icon(
                                    Icons.star_rounded,
                                    size: 16,
                                    color: Color(0xFFF59E0B),
                                  ),
                                  const SizedBox(width: 4),
                                  Expanded(
                                    child: Text(
                                      detail.reviewsLabel,
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodySmall
                                          ?.copyWith(
                                            fontWeight: FontWeight.w600,
                                          ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  const Icon(
                                    Icons.place_outlined,
                                    size: 16,
                                    color: AppColors.primary,
                                  ),
                                  const SizedBox(width: 4),
                                  Expanded(
                                    child: Text(
                                      '${detail.distanceKm.toStringAsFixed(1)} km away',
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodySmall
                                          ?.copyWith(
                                            color: AppColors.primary,
                                            fontWeight: FontWeight.w600,
                                          ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              Wrap(
                                spacing: 10,
                                runSpacing: 8,
                                children: [
                                  _miniStatus(
                                    icon: Icons.badge_outlined,
                                    label: detail.identityVerified
                                        ? 'IC Verified'
                                        : 'IC Pending',
                                    color: detail.identityVerified
                                        ? AppColors.success
                                        : AppColors.warning,
                                  ),
                                  _miniStatus(
                                    icon: Icons.call_outlined,
                                    label: detail.phoneVerified
                                        ? 'Mobile Verified'
                                        : 'Mobile Pending',
                                    color: detail.phoneVerified
                                        ? AppColors.success
                                        : AppColors.warning,
                                  ),
                                  _miniStatus(
                                    icon: Icons.verified_outlined,
                                    label: detail.yearsExperience,
                                    color: AppColors.primary,
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    Row(
                      children: [
                        Expanded(
                          child: _statCard(
                            context,
                            icon: Icons.verified_rounded,
                            value: '${detail.jobsCompleted}',
                            label: 'Completed Jobs',
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: _statCard(
                            context,
                            icon: Icons.thumb_up_alt_rounded,
                            value: '98%',
                            label: 'Recommended',
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    _sectionCard(
                      context,
                      title: 'Recent Works',
                      subtitle: detail.hasUploadedGallery
                          ? 'Provider has uploaded recent work photos'
                          : 'This provider has not uploaded recent work photos yet',
                      child: const EmptyState(
                        title: 'No recent works yet',
                        subtitle:
                            'Uploaded work photos will appear here after the provider adds them to their profile.',
                        icon: Icons.image_not_supported_outlined,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    _sectionCard(
                      context,
                      title: '${detail.serviceLabel} Service',
                      actionLabel: detail.verified ? 'Verified' : 'Pending Review',
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(AppSpacing.md),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: const Color(0xFFE7ECE7)),
                            ),
                            child: Row(
                              children: [
                                Expanded(
                                  child: _priceMetric(
                                    context,
                                    label: 'Per Hour Price',
                                    value: 'RM ${detail.hourlyRate}',
                                    suffix: '/ hour',
                                  ),
                                ),
                                Container(
                                  width: 1,
                                  height: 48,
                                  color: const Color(0xFFE8ECE8),
                                ),
                                Expanded(
                                  child: Padding(
                                    padding: const EdgeInsets.only(left: 12),
                                    child: _priceMetric(
                                      context,
                                      label: 'Per Day Price',
                                      value: 'RM ${detail.dailyRate}',
                                      suffix: '/ day',
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: AppSpacing.md),
                          Text(
                            'Specialities',
                            style: Theme.of(context).textTheme.titleSmall,
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: detail.specialties
                                .map(
                                  (specialty) => Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 12,
                                      vertical: 7,
                                    ),
                                    decoration: BoxDecoration(
                                      color: AppColors.primarySoft,
                                      borderRadius: BorderRadius.circular(999),
                                    ),
                                    child: Text(
                                      specialty,
                                      style: Theme.of(context)
                                          .textTheme
                                          .labelSmall
                                          ?.copyWith(
                                            color: AppColors.primary,
                                            fontWeight: FontWeight.w600,
                                          ),
                                    ),
                                  ),
                                )
                                .toList(),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    _sectionCard(
                      context,
                      title: 'About ${detail.name}',
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            detail.about,
                            style: Theme.of(context).textTheme.bodyMedium
                                ?.copyWith(height: 1.6),
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          TextButton(
                            onPressed: () {},
                            child: const Text('Read more'),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    _sectionCard(
                      context,
                      title: 'Customer Reviews',
                      subtitle: 'Real feedback from completed bookings',
                      actionLabel: '${detail.rating.toStringAsFixed(1)} / 5',
                      child: detail.customerReviews.isEmpty
                          ? const EmptyState(
                              title: 'No reviews yet',
                              subtitle:
                                  'This provider has not received a customer review yet.',
                              icon: Icons.reviews_outlined,
                            )
                          : SizedBox(
                              height: 170,
                              child: ListView.separated(
                                scrollDirection: Axis.horizontal,
                                itemCount: detail.customerReviews.length,
                                separatorBuilder: (_, _) =>
                                    const SizedBox(width: AppSpacing.sm),
                                itemBuilder: (context, index) {
                                  final review = detail.customerReviews[index];
                                  return Container(
                                    width: 260,
                                    padding: const EdgeInsets.all(
                                      AppSpacing.sm,
                                    ),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFFBFCFB),
                                      borderRadius: BorderRadius.circular(16),
                                      border: Border.all(
                                        color: const Color(0xFFE7ECE7),
                                      ),
                                    ),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Expanded(
                                              child: Text(
                                                review['customerName']
                                                        ?.toString() ??
                                                    'Customer',
                                                style: Theme.of(context)
                                                    .textTheme
                                                    .titleSmall
                                                    ?.copyWith(
                                                      fontWeight:
                                                          FontWeight.w700,
                                                    ),
                                              ),
                                            ),
                                            Text(
                                              review['postedLabel']
                                                      ?.toString() ??
                                                  'Recently',
                                              style: Theme.of(context)
                                                  .textTheme
                                                  .labelSmall
                                                  ?.copyWith(
                                                    color: AppColors
                                                        .textSecondary,
                                                  ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 4),
                                        Row(
                                          children: [
                                            const Icon(
                                              Icons.star_rounded,
                                              size: 14,
                                              color: Color(0xFFF59E0B),
                                            ),
                                            const SizedBox(width: 4),
                                            Text(
                                              (review['rating'] as num?)
                                                      ?.toStringAsFixed(1) ??
                                                  '5.0',
                                              style: Theme.of(context)
                                                  .textTheme
                                                  .labelMedium,
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 8),
                                        Expanded(
                                          child: Text(
                                            review['comment']?.toString() ?? '',
                                            style: Theme.of(context)
                                                .textTheme
                                                .bodySmall,
                                          ),
                                        ),
                                      ],
                                    ),
                                  );
                                },
                              ),
                            ),
                    ),
                    const SizedBox(height: 120),
                  ],
                );
              },
            ),
    );
  }

  Widget _profileFallback(ProviderDetailModel detail) {
    return Container(
      width: 118,
      height: 162,
      color: AppColors.primarySoft,
      alignment: Alignment.center,
      child: Text(
        detail.name.isNotEmpty ? detail.name.characters.first : 'P',
        style: const TextStyle(
          color: AppColors.primary,
          fontWeight: FontWeight.w800,
          fontSize: 36,
        ),
      ),
    );
  }

  String _resolveImageUrl(String raw) {
    final value = raw.trim();
    if (value.isEmpty) {
      return '';
    }
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }
    if (value.startsWith('/')) {
      return '${AppConfig.appBaseUrl}$value';
    }
    return '${AppConfig.appBaseUrl}/$value';
  }

  Widget _miniStatus({
    required IconData icon,
    required String label,
    required Color color,
  }) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: color),
        const SizedBox(width: 4),
        Text(
          label,
          style: TextStyle(
            color: color,
            fontSize: 11,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }

  Widget _statCard(
    BuildContext context, {
    required IconData icon,
    required String value,
    required String label,
  }) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE6ECE7)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0F172A0A),
            blurRadius: 24,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: const BoxDecoration(
              color: AppColors.primarySoft,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: AppColors.primary),
          ),
          const SizedBox(height: 12),
          Text(
            value,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.textSecondary,
                ),
          ),
        ],
      ),
    );
  }

  Widget _sectionCard(
    BuildContext context, {
    required String title,
    String? subtitle,
    String? actionLabel,
    required Widget child,
  }) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE6ECE7)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0F172A0A),
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
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: AppColors.textSecondary,
                            ),
                      ),
                    ],
                  ],
                ),
              ),
              if (actionLabel != null)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.primarySoft,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    actionLabel,
                    style: const TextStyle(
                      color: AppColors.primary,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          child,
        ],
      ),
    );
  }

  Widget _priceMetric(
    BuildContext context, {
    required String label,
    required String value,
    required String suffix,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppColors.textSecondary,
              ),
        ),
        const SizedBox(height: 8),
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              value,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w800,
                  ),
            ),
            const SizedBox(width: 4),
            Padding(
              padding: const EdgeInsets.only(bottom: 2),
              child: Text(
                suffix,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
          ],
        ),
      ],
    );
  }
}
