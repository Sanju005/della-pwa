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

class ProviderProfileDemoScreen extends StatefulWidget {
  const ProviderProfileDemoScreen({
    super.key,
    required this.repository,
  });

  final DemoRepository repository;

  @override
  State<ProviderProfileDemoScreen> createState() =>
      _ProviderProfileDemoScreenState();
}

class _ProviderProfileDemoScreenState extends State<ProviderProfileDemoScreen> {
  static const _workspaceService = ProviderWorkspaceService();

  late Future<ProviderWorkspaceSnapshot> _future;

  @override
  void initState() {
    super.initState();
    _future = _workspaceService.fetchWorkspace();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<ProviderWorkspaceSnapshot>(
      future: _future,
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

        final workspace = snapshot.data!;
        final profile = workspace.profile;
        final serviceCount = profile.services.length;
        final displayName = profile.marketingName.trim().isEmpty
            ? profile.fullName.trim().isEmpty
                ? 'Provider'
                : profile.fullName.trim()
            : profile.marketingName.trim();
        final location = profile.serviceLocation.trim().isEmpty
            ? 'Set your service area'
            : profile.serviceLocation.trim();
        final verificationPendingCount = [
          !profile.emailVerified,
          !profile.phoneVerified,
          !profile.identityVerified,
        ].where((item) => item).length;
        final verificationTone = verificationPendingCount == 0
            ? SwiperStatusTone.success
            : SwiperStatusTone.warning;
        final verificationLabel = verificationPendingCount == 0
            ? 'Verified'
            : 'Pending';

        return ListView(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.md,
            AppSpacing.md,
            AppSpacing.md,
            112,
          ),
          children: [
            _profileCard(
              context,
              title: 'Personal Card',
              subtitle: 'Profile picture, provider name, and live location',
              onTap: () => Navigator.of(context).pushNamed(
                AppRoutes.providerPersonalDetails,
              ),
              leading: ProfileAvatar(
                name: displayName,
                imageUrl: profile.avatarUrl,
                radius: 28,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    displayName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(
                        Icons.location_on_outlined,
                        size: 16,
                        color: AppColors.textSecondary,
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          location,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 13,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            _profileCard(
              context,
              title: 'Verification',
              subtitle: 'Check which items are verified or pending',
              onTap: () => Navigator.of(context).pushNamed(
                AppRoutes.providerVerificationHub,
              ),
              leading: _iconBadge(
                icon: Icons.verified_user_outlined,
                colors: const [
                  Color(0xFFB88CFF),
                  Color(0xFF8E5EB5),
                ],
              ),
              trailing: SwiperStatusBadge(
                label: verificationLabel,
                tone: verificationTone,
              ),
              child: Text(
                verificationPendingCount == 0
                    ? 'Phone, email, and identity are verified.'
                    : '$verificationPendingCount item${verificationPendingCount == 1 ? '' : 's'} still need attention.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppColors.textSecondary,
                      height: 1.45,
                    ),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            _profileCard(
              context,
              title: 'Services',
              subtitle: 'Manage service items, photos, specialties, and rates',
              onTap: () => Navigator.of(context).pushNamed(
                AppRoutes.providerServices,
              ),
              leading: _iconBadge(
                icon: Icons.work_outline_rounded,
                colors: const [
                  Color(0xFFC8F1DE),
                  Color(0xFF7ED7AF),
                ],
                iconColor: const Color(0xFF146B48),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$serviceCount live service${serviceCount == 1 ? '' : 's'}',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    serviceCount == 0
                        ? 'Add your first provider service with image, pricing, and specialties.'
                        : 'Open the service workspace to edit rates, specialties, images, and add new services.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: AppColors.textSecondary,
                          height: 1.45,
                        ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            _profileCard(
              context,
              title: 'Availability',
              subtitle: 'Edit working days and time presets',
              onTap: () => Navigator.of(context).pushNamed(
                AppRoutes.providerAvailability,
              ),
              leading: _iconBadge(
                icon: Icons.calendar_month_rounded,
                colors: const [
                  Color(0xFFE5EEFF),
                  Color(0xFFC4D6FF),
                ],
                iconColor: const Color(0xFF264E9B),
              ),
              child: Text(
                'Update weekly schedule and availability slots from your live provider workspace.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppColors.textSecondary,
                      height: 1.45,
                    ),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            _profileCard(
              context,
              title: 'Service Area',
              subtitle: 'Radius slider, location pin, and service coverage',
              onTap: () => Navigator.of(context).pushNamed(
                AppRoutes.providerServiceArea,
              ),
              leading: _iconBadge(
                icon: Icons.map_outlined,
                colors: const [
                  Color(0xFFFFE9C8),
                  Color(0xFFFFD89B),
                ],
                iconColor: const Color(0xFF9B5D00),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${profile.serviceRadiusKm.toStringAsFixed(0)} km radius',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    location,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: AppColors.textSecondary,
                          height: 1.45,
                        ),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _profileCard(
    BuildContext context, {
    required String title,
    required String subtitle,
    required VoidCallback onTap,
    required Widget leading,
    required Widget child,
    Widget? trailing,
  }) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.96, end: 1),
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOutCubic,
      builder: (context, value, widgetChild) {
        return Transform.scale(
          scale: value,
          child: widgetChild,
        );
      },
      child: InkWell(
        borderRadius: BorderRadius.circular(26),
        onTap: onTap,
        child: Ink(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Color(0xFFFFFFFF),
                Color(0xFFFDFBFF),
              ],
            ),
            borderRadius: BorderRadius.circular(26),
            border: Border.all(color: const Color(0xFFEAE2F6)),
            boxShadow: const [
              BoxShadow(
                color: Color(0x14562687),
                blurRadius: 24,
                offset: Offset(0, 12),
              ),
            ],
          ),
          child: Column(
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  leading,
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: Theme.of(context)
                              .textTheme
                              .titleLarge
                              ?.copyWith(
                                fontWeight: FontWeight.w800,
                                color: AppColors.textPrimary,
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
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  trailing ??
                      Container(
                        width: 34,
                        height: 34,
                        decoration: BoxDecoration(
                          color: const Color(0xFFF6F0FF),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: const Icon(
                          Icons.chevron_right_rounded,
                          color: AppColors.primary,
                        ),
                      ),
                ],
              ),
              const SizedBox(height: 16),
              child,
            ],
          ),
        ),
      ),
    );
  }

  Widget _iconBadge({
    required IconData icon,
    required List<Color> colors,
    Color iconColor = Colors.white,
  }) {
    return Container(
      width: 58,
      height: 58,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: colors,
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Icon(icon, color: iconColor, size: 28),
    );
  }
}
