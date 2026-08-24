import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';

import '../models/provider_summary.dart';
import '../previews/widget_preview_helpers.dart';
import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';

String providerHeroTag(ProviderSummary provider) {
  final normalizedId = provider.id.trim().isNotEmpty
      ? provider.id.trim()
      : '${provider.serviceKey}-${provider.name}'
          .toLowerCase()
          .replaceAll(RegExp(r'[^a-z0-9]+'), '-');
  return 'provider-avatar-$normalizedId';
}

class ProviderCard extends StatelessWidget {
  const ProviderCard({super.key, required this.provider, this.onTap});

  final ProviderSummary provider;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final jobsCompleted = (provider.reviewCount * 2 + 68).clamp(120, 9999);
    final repeatCustomers =
        (provider.reviewCount * 0.61).round().clamp(24, 9999);
    final rankingBadge = provider.rating >= 4.8
        ? 'Top Rated Provider'
        : 'Popular Provider';
    final serviceTags = <String>[
      if (provider.specialties.isNotEmpty) provider.specialties[0],
      if (provider.specialties.length > 1) provider.specialties[1],
      if (provider.specialties.length > 2) provider.specialties[2],
      if (provider.specialties.isEmpty) 'Emergency Repair',
      if (provider.specialties.length <= 1) 'Socket Repair',
      if (provider.specialties.length <= 2) 'Wiring',
    ].take(3).toList();

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A172A10),
            blurRadius: 16,
            offset: Offset(0, 6),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.sm),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _Portrait(provider: provider),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      provider.name,
                                      style: Theme.of(context)
                                          .textTheme
                                          .titleMedium
                                          ?.copyWith(
                                            fontWeight: FontWeight.w800,
                                            color: const Color(0xFF1F2C44),
                                            height: 1.1,
                                          ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      provider.providerName.isNotEmpty
                                          ? provider.providerName
                                          : provider.service,
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodyMedium
                                          ?.copyWith(
                                            fontWeight: FontWeight.w600,
                                            color: const Color(0xFF1F2C44),
                                          ),
                                    ),
                                    const SizedBox(height: AppSpacing.xs),
                                    _RankingBadge(label: rankingBadge),
                                    const SizedBox(height: AppSpacing.xxs),
                                    Text(
                                      provider.identityVerified &&
                                              provider.phoneVerified
                                          ? 'Verified'
                                          : 'Pending',
                                      style: Theme.of(context)
                                          .textTheme
                                          .labelMedium
                                          ?.copyWith(
                                            color:
                                                provider.identityVerified &&
                                                        provider.phoneVerified
                                                    ? const Color(0xFF138A36)
                                                    : const Color(0xFFD97706),
                                            fontWeight: FontWeight.w700,
                                          ),
                                    ),
                                  ],
                                ),
                              ),
                              Container(
                                width: 36,
                                height: 36,
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: const Color(0xFFEEF2EF),
                                  ),
                                  boxShadow: const [
                                    BoxShadow(
                                      color: Color(0x0F172A0D),
                                    blurRadius: 10,
                                    offset: Offset(0, 4),
                                    ),
                                  ],
                                ),
                                child: Icon(
                                  provider.isFavorite
                                      ? Icons.favorite_rounded
                                      : Icons.favorite_border_rounded,
                                  size: 18,
                                  color: provider.isFavorite
                                      ? AppColors.error
                                      : const Color(0xFF667085),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                Container(
                  decoration: const BoxDecoration(
                    border: Border(
                      bottom: BorderSide(color: Color(0xFFEDF1EE)),
                    ),
                  ),
                  padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                  child: GridView.count(
                    crossAxisCount: 2,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    mainAxisSpacing: 10,
                    crossAxisSpacing: 10,
                    childAspectRatio: 3.4,
                    children: [
                      _Metric(
                        icon: Icons.star_rounded,
                        iconColor: const Color(0xFFF5B301),
                        value: provider.rating.toStringAsFixed(1),
                        suffix: '(${provider.reviewCount} Reviews)',
                      ),
                      const _Metric(
                        icon: Icons.thumb_up_alt_rounded,
                        iconColor: AppColors.primary,
                        value: '98%',
                        suffix: 'On-Time',
                      ),
                      _Metric(
                        icon: Icons.place_outlined,
                        iconColor: const Color(0xFF667085),
                        value: provider.distanceLabel,
                      ),
                      _Metric(
                        icon: Icons.work_outline_rounded,
                        iconColor: const Color(0xFF667085),
                        value:
                            '${provider.yearsExperience.isEmpty ? 'New' : provider.yearsExperience} Experience',
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                Row(
                  children: serviceTags
                      .map(
                        (tag) => Expanded(
                          child: Container(
                            margin: EdgeInsets.only(
                              right: tag == serviceTags.last ? 0 : 6,
                            ),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF3EBFC),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              tag,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              textAlign: TextAlign.center,
                              style: Theme.of(context)
                                  .textTheme
                                  .labelSmall
                                  ?.copyWith(
                                    color: AppColors.primary,
                                    fontWeight: FontWeight.w600,
                                  ),
                            ),
                          ),
                        ),
                      )
                      .toList(),
                ),
                const SizedBox(height: AppSpacing.sm),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 4,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFBFDFB),
                    borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: _StatPill(
                          icon: Icons.schedule_outlined,
                          label: 'Replies in',
                          value: '~5 min',
                        ),
                      ),
                      Expanded(
                        child: _StatPill(
                          icon: Icons.work_outline_rounded,
                          label: 'Jobs Completed',
                          value: '$jobsCompleted',
                          showDivider: true,
                        ),
                      ),
                      Expanded(
                        child: _StatPill(
                          icon: Icons.person_outline_rounded,
                          label: 'Repeat Customers',
                          value: '$repeatCustomers',
                          showDivider: true,
                        ),
                      ),
                      Expanded(
                        child: _StatPill(
                          icon: Icons.schedule_outlined,
                          label: 'Active',
                          value: provider.availabilityLabel.isNotEmpty
                              ? '10 min ago'
                              : 'Recently',
                          showDivider: true,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Portrait extends StatelessWidget {
  const _Portrait({required this.provider});

  final ProviderSummary provider;

  @override
  Widget build(BuildContext context) {
    final imageUrl = provider.avatarUrl.trim();

    return Hero(
      tag: providerHeroTag(provider),
      child: Material(
        color: Colors.transparent,
        child: Container(
          width: 98,
          height: 116,
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            color: const Color(0xFFEEF4EF),
            borderRadius: BorderRadius.circular(18),
          ),
          child: imageUrl.isNotEmpty
              ? Image.network(
                  imageUrl,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) =>
                      _PortraitFallback(name: provider.name),
                )
              : _PortraitFallback(name: provider.name),
        ),
      ),
    );
  }
}

class _PortraitFallback extends StatelessWidget {
  const _PortraitFallback({required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    final initials = name
        .split(' ')
        .where((part) => part.isNotEmpty)
        .take(2)
        .map((part) => part.characters.first.toUpperCase())
        .join();

    return Container(
      color: AppColors.primarySoft,
      alignment: Alignment.center,
      child: Text(
        initials.isEmpty ? 'P' : initials,
        style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              color: AppColors.primary,
              fontWeight: FontWeight.w800,
            ),
      ),
    );
  }
}

class _RankingBadge extends StatelessWidget {
  const _RankingBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: const Color(0xFFF3EBFC),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.shield_outlined,
            size: 12,
            color: AppColors.primary,
          ),
          const SizedBox(width: 4),
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w600,
                ),
          ),
        ],
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({
    required this.icon,
    required this.iconColor,
    required this.value,
    this.suffix,
  });

  final IconData icon;
  final Color iconColor;
  final String value;
  final String? suffix;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 18, color: iconColor),
        const SizedBox(width: 8),
        Expanded(
          child: RichText(
            text: TextSpan(
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: const Color(0xFF1F2C44),
                    fontWeight: FontWeight.w700,
                  ),
              children: [
                TextSpan(text: value),
                if (suffix != null)
                  TextSpan(
                    text: ' $suffix',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: const Color(0xFF475467),
                          fontWeight: FontWeight.w600,
                        ),
                  ),
              ],
            ),
            maxLines: 2,
          ),
        ),
      ],
    );
  }
}

class _StatPill extends StatelessWidget {
  const _StatPill({
    required this.icon,
    required this.label,
    required this.value,
    this.showDivider = false,
  });

  final IconData icon;
  final String label;
  final String value;
  final bool showDivider;

  @override
  Widget build(BuildContext context) {
    final child = Padding(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.circle,
                size: 0,
                color: Colors.transparent,
              ),
              Icon(icon, size: 14, color: AppColors.primary),
              const SizedBox(width: 4),
              Flexible(
                child: Text(
                  label,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: const Color(0xFF667085),
                        fontSize: 10,
                      ),
                  maxLines: 2,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            value,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: const Color(0xFF111827),
                  fontWeight: FontWeight.w700,
                ),
          ),
        ],
      ),
    );

    if (!showDivider) {
      return child;
    }

    return Container(
      decoration: const BoxDecoration(
        border: Border(left: BorderSide(color: Color(0xFFE8EEEA))),
      ),
      child: child,
    );
  }
}

@Preview(
  name: 'Featured Provider',
  size: Size(420, 520),
  wrapper: previewSurface,
)
Widget providerCardPreview() {
  const provider = ProviderSummary(
    name: 'Latha Chef',
    providerName: 'Latha Vijaya',
    service: 'Chef',
    hourlyRate: 95,
    dailyRate: 240,
    rating: 5.0,
    reviewCount: 4,
    distanceLabel: '24 m away',
    description: 'Top-rated DELLA chef for full home care and recurring visits.',
    phoneVerified: false,
    identityVerified: false,
    isFavorite: false,
    location: 'Kuala Lumpur',
    specialties: ['Indian', 'Socket Repair', 'Wiring', 'Switch Board Repair'],
    yearsExperience: '5 Years',
    availabilityLabel: 'Available Today',
  );

  return const ProviderCard(provider: provider);
}
