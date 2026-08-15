import 'package:flutter/material.dart';

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
        return ListView(
          padding: AppSpacing.screenPadding,
          children: [
            Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFFE6ECE7)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ProfileAvatar(
                    name: provider.fullName.isEmpty
                        ? provider.marketingName
                        : provider.fullName,
                    imageUrl: provider.avatarUrl,
                    radius: 34,
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          provider.marketingName.isEmpty
                              ? provider.fullName
                              : provider.marketingName,
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                fontWeight: FontWeight.w800,
                              ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          provider.fullName,
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                color: AppColors.textSecondary,
                              ),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            SwiperStatusBadge(
                              label: provider.emailVerified
                                  ? 'Email Verified'
                                  : 'Email Pending',
                              tone: provider.emailVerified
                                  ? SwiperStatusTone.success
                                  : SwiperStatusTone.warning,
                            ),
                            SwiperStatusBadge(
                              label: provider.phoneVerified
                                  ? 'Phone Verified'
                                  : 'Phone Pending',
                              tone: provider.phoneVerified
                                  ? SwiperStatusTone.success
                                  : SwiperStatusTone.warning,
                            ),
                            SwiperStatusBadge(
                              label: provider.identityVerified
                                  ? 'Identity Verified'
                                  : 'Identity Pending',
                              tone: provider.identityVerified
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
            ),
            const SizedBox(height: AppSpacing.lg),
            _sectionCard(
              context,
              title: 'Provider Details',
              child: Column(
                children: [
                  _row('Full Name', provider.fullName),
                  _row('Email', provider.email),
                  _row('Phone', provider.phone),
                  _row(
                    'Emergency Contact',
                    provider.emergencyContactNumber,
                  ),
                  _row('Country', provider.country, isLast: true),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            _sectionCard(
              context,
              title: 'Listing Details',
              child: Column(
                children: [
                  _row('Service Location', provider.serviceLocation),
                  _row(
                    'Service Radius',
                    '${provider.serviceRadiusKm.toStringAsFixed(0)} km',
                  ),
                  _row('Approval Status', provider.approvalStatus),
                  _row(
                    'Profile Visibility',
                    provider.isVisible ? 'Visible' : 'Hidden',
                    isLast: true,
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            _sectionCard(
              context,
              title: 'About',
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

  Widget _sectionCard(
    BuildContext context, {
    required String title,
    required Widget child,
  }) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE6ECE7)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: AppSpacing.md),
          child,
        ],
      ),
    );
  }

  Widget _row(String label, String value, {bool isLast = false}) {
    return Container(
      padding: EdgeInsets.only(bottom: isLast ? 0 : AppSpacing.md),
      margin: EdgeInsets.only(bottom: isLast ? 0 : AppSpacing.md),
      decoration: BoxDecoration(
        border: isLast
            ? null
            : const Border(
                bottom: BorderSide(color: Color(0xFFEDF1EF)),
              ),
      ),
      child: Row(
        children: [
          Expanded(child: Text(label)),
          const SizedBox(width: AppSpacing.sm),
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
}
