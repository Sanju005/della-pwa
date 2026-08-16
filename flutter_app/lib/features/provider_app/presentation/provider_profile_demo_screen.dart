import 'package:flutter/material.dart';

import '../../../core/routing/app_routes.dart';
import '../../../repositories/demo_repository.dart';
import '../../../services/provider_workspace_service.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/loading_state.dart';
import '../../../widgets/profile_avatar.dart';
import '../../../widgets/swiper_status_badge.dart';

class ProviderProfileDemoScreen extends StatelessWidget {
  const ProviderProfileDemoScreen({
    super.key,
    required this.repository,
  });

  final DemoRepository repository;
  static const _workspaceService = ProviderWorkspaceService();

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<ProviderWorkspaceProfile>(
      future: _workspaceService.fetchProfile(),
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const LoadingState(label: 'Loading provider profile...');
        }
        if (snapshot.hasError || snapshot.data == null) {
          return const EmptyState(
            title: 'Unable to load provider profile',
            subtitle: 'Please try again.',
            icon: Icons.error_outline_rounded,
          );
        }

        final provider = snapshot.data!;
        final name = provider.marketingName.isEmpty
            ? provider.fullName
            : provider.marketingName;

        return ListView(
          padding: AppSpacing.screenPadding,
          children: [
            Container(
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
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ProfileAvatar(
                        name: name,
                        imageUrl: provider.avatarUrl,
                        radius: 32,
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              name.isEmpty ? 'Provider' : name,
                              style: Theme.of(context)
                                  .textTheme
                                  .headlineSmall
                                  ?.copyWith(
                                    fontWeight: FontWeight.w900,
                                    color: AppColors.textPrimary,
                                  ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              provider.fullName.isEmpty
                                  ? 'Your provider profile'
                                  : provider.fullName,
                              style: Theme.of(context)
                                  .textTheme
                                  .bodyMedium
                                  ?.copyWith(color: AppColors.textSecondary),
                            ),
                            const SizedBox(height: AppSpacing.sm),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                SwiperStatusBadge(
                                  label: provider.approvalStatus,
                                  tone: provider.identityVerified
                                      ? SwiperStatusTone.success
                                      : SwiperStatusTone.warning,
                                ),
                                SwiperStatusBadge(
                                  label: provider.isVisible
                                      ? 'Visible to customers'
                                      : 'Availability paused',
                                  tone: provider.isVisible
                                      ? SwiperStatusTone.success
                                      : SwiperStatusTone.info,
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
                        child: _metricCard(
                          context,
                          value: provider.averageRating.toStringAsFixed(1),
                          label: 'Average rating',
                          subtitle: '${provider.totalReviews} reviews',
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: _metricCard(
                          context,
                          value: '${provider.services.length}',
                          label: 'Live services',
                          subtitle: '${provider.serviceRadiusKm.toStringAsFixed(0)} km radius',
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            _sectionCard(
              context,
              title: 'Verification',
              subtitle: 'Email, phone, and identity verification status',
              child: Column(
                children: [
                  _verificationRow(
                    'Email',
                    provider.emailVerified ? 'Verified' : 'Pending',
                    provider.emailVerified,
                  ),
                  _verificationRow(
                    'Phone',
                    provider.phoneVerified ? 'Verified' : 'Pending',
                    provider.phoneVerified,
                  ),
                  _verificationRow(
                    'Identity',
                    provider.identityVerified
                        ? 'Verified'
                        : _toTitleCase(provider.identityVerificationStatus),
                    provider.identityVerified,
                    isLast: true,
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            _sectionCard(
              context,
              title: 'Provider Workspace',
              subtitle: 'Open the live subpages used to manage your listing',
              child: Column(
                children: [
                  _navTile(
                    context,
                    icon: Icons.work_outline_rounded,
                    title: 'My Services',
                    subtitle: 'Manage service types, pricing, and specialties',
                    onTap: () => Navigator.of(context)
                        .pushNamed(AppRoutes.providerServices),
                  ),
                  _navTile(
                    context,
                    icon: Icons.calendar_month_outlined,
                    title: 'Availability',
                    subtitle: 'Set booking days and working hours',
                    onTap: () => Navigator.of(context)
                        .pushNamed(AppRoutes.providerAvailability),
                  ),
                  _navTile(
                    context,
                    icon: Icons.star_outline_rounded,
                    title: 'Reviews',
                    subtitle: 'Read customer feedback from completed work',
                    onTap: () =>
                        Navigator.of(context).pushNamed(AppRoutes.providerReviews),
                    isLast: true,
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            _sectionCard(
              context,
              title: 'Profile Details',
              subtitle: 'Provider account and listing information',
              child: Column(
                children: [
                  _infoRow('Full Name', provider.fullName),
                  _infoRow('Email', provider.email),
                  _infoRow('Phone', provider.phone),
                  _infoRow('Emergency Contact', provider.emergencyContactNumber),
                  _infoRow('Country', provider.country),
                  _infoRow('Service Location', provider.serviceLocation),
                  _infoRow(
                    'Service Radius',
                    '${provider.serviceRadiusKm.toStringAsFixed(0)} km',
                  ),
                  _infoRow('Account Status', provider.accountStatus, isLast: true),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            _sectionCard(
              context,
              title: 'About',
              subtitle: 'Public provider description shown in the app',
              child: Text(
                provider.bio.isEmpty
                    ? 'No provider bio has been added yet.'
                    : provider.bio,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      height: 1.6,
                    ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _metricCard(
    BuildContext context, {
    required String value,
    required String label,
    required String subtitle,
  }) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.primarySoft,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w900,
                  color: AppColors.primary,
                ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            label,
            style: Theme.of(context)
                .textTheme
                .bodyMedium
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 4),
          Text(
            subtitle,
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }

  Widget _sectionCard(
    BuildContext context, {
    required String title,
    required String subtitle,
    required Widget child,
  }) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: 4),
          Text(
            subtitle,
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: AppColors.textSecondary),
          ),
          const SizedBox(height: AppSpacing.md),
          child,
        ],
      ),
    );
  }

  Widget _verificationRow(
    String label,
    String value,
    bool verified, {
    bool isLast = false,
  }) {
    return _infoRow(
      label,
      value,
      isLast: isLast,
      trailing: SwiperStatusBadge(
        label: verified ? 'Verified' : 'Pending',
        tone: verified ? SwiperStatusTone.success : SwiperStatusTone.warning,
      ),
    );
  }

  Widget _infoRow(
    String label,
    String value, {
    bool isLast = false,
    Widget? trailing,
  }) {
    return Container(
      padding: EdgeInsets.only(bottom: isLast ? 0 : AppSpacing.md),
      margin: EdgeInsets.only(bottom: isLast ? 0 : AppSpacing.md),
      decoration: BoxDecoration(
        border: isLast
            ? null
            : const Border(
                bottom: BorderSide(color: Color(0xFFF0EAF8)),
              ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(color: AppColors.textSecondary),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          if (trailing != null) trailing,
          if (trailing == null)
            Flexible(
              child: Text(
                value.isEmpty ? '-' : value,
                textAlign: TextAlign.right,
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
        ],
      ),
    );
  }

  Widget _navTile(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
    bool isLast = false,
  }) {
    return Container(
      margin: EdgeInsets.only(bottom: isLast ? 0 : AppSpacing.sm),
      decoration: BoxDecoration(
        border: Border(
          bottom: isLast
              ? BorderSide.none
              : const BorderSide(color: Color(0xFFF0EAF8)),
        ),
      ),
      child: ListTile(
        contentPadding: EdgeInsets.zero,
        onTap: onTap,
        leading: Container(
          width: 46,
          height: 46,
          decoration: const BoxDecoration(
            color: AppColors.primarySoft,
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: AppColors.primary),
        ),
        title: Text(
          title,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w800,
              ),
        ),
        subtitle: Text(
          subtitle,
          style: Theme.of(context)
              .textTheme
              .bodySmall
              ?.copyWith(color: AppColors.textSecondary),
        ),
        trailing: const Icon(
          Icons.chevron_right_rounded,
          color: AppColors.primary,
        ),
      ),
    );
  }
}

String _toTitleCase(String value) {
  return value
      .replaceAll('_', ' ')
      .split(' ')
      .where((part) => part.isNotEmpty)
      .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
      .join(' ');
}
