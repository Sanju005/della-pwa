import 'package:flutter/material.dart';

import '../../../repositories/demo_repository.dart';
import '../../../services/provider_workspace_service.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/loading_state.dart';
import '../../../widgets/profile_avatar.dart';
import '../../../widgets/swiper_status_badge.dart';

class ProviderDashboardScreen extends StatelessWidget {
  const ProviderDashboardScreen({
    super.key,
    required this.repository,
  });

  final DemoRepository repository;
  static const _workspaceService = ProviderWorkspaceService();

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<ProviderWorkspaceSnapshot>(
      future: _workspaceService.fetchWorkspace(),
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const LoadingState(label: 'Loading provider workspace...');
        }
        if (snapshot.hasError || snapshot.data == null) {
          return const EmptyState(
            title: 'Unable to load provider workspace',
            subtitle: 'Please try again.',
            icon: Icons.error_outline_rounded,
          );
        }

        final workspace = snapshot.data!;
        final profile = workspace.profile;
        final bookings = workspace.bookings;
        final active = bookings.where((item) => item.bucket == 'active').length;
        final requests =
            bookings.where((item) => item.bucket == 'requests').length;
        final completed =
            bookings.where((item) => item.bucket == 'completed').length;
        final latest = bookings.isNotEmpty ? bookings.first : null;

        return ListView(
          padding: AppSpacing.screenPadding,
          children: [
            Container(
              padding: const EdgeInsets.all(AppSpacing.lg),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppColors.primaryDeep, AppColors.primary],
                ),
                borderRadius: BorderRadius.circular(24),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _greeting(profile.fullName),
                          style: Theme.of(context).textTheme.headlineMedium
                              ?.copyWith(color: Colors.white),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Text(
                          '${requests.toString()} new booking requests and ${active.toString()} active jobs right now.',
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(color: Colors.white70),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        SwiperStatusBadge(
                          label: profile.approvalStatus,
                          tone: profile.identityVerified
                              ? SwiperStatusTone.success
                              : SwiperStatusTone.info,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  ProfileAvatar(
                    name: profile.fullName.isEmpty
                        ? profile.marketingName
                        : profile.fullName,
                    imageUrl: profile.avatarUrl,
                    radius: 28,
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Row(
              children: [
                Expanded(
                  child: _metricCard(
                    context,
                    label: 'Requests',
                    value: '$requests',
                    icon: Icons.mark_email_unread_outlined,
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: _metricCard(
                    context,
                    label: 'Active Jobs',
                    value: '$active',
                    icon: Icons.work_outline_rounded,
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: _metricCard(
                    context,
                    label: 'Completed',
                    value: '$completed',
                    icon: Icons.task_alt_rounded,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            _sectionCard(
              context,
              title: 'Provider Summary',
              child: Column(
                children: [
                  _summaryRow('Marketing Name', profile.marketingName),
                  _summaryRow('Service Location', profile.serviceLocation),
                  _summaryRow(
                    'Rating',
                    '${profile.averageRating.toStringAsFixed(1)} (${profile.totalReviews} reviews)',
                  ),
                  _summaryRow(
                    'Coverage',
                    '${profile.serviceRadiusKm.toStringAsFixed(0)} km radius',
                    isLast: true,
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            _sectionCard(
              context,
              title: 'Latest Booking',
              child: latest == null
                  ? const EmptyState(
                      title: 'No provider bookings yet',
                      subtitle:
                          'Incoming provider requests and active jobs will appear here.',
                      icon: Icons.assignment_outlined,
                    )
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          latest.customerName,
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.w800,
                              ),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          latest.serviceLabel,
                          style: const TextStyle(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        _bookingInfo(Icons.schedule_outlined, latest.schedule),
                        const SizedBox(height: AppSpacing.xs),
                        _bookingInfo(Icons.place_outlined, latest.location),
                        const SizedBox(height: AppSpacing.xs),
                        _bookingInfo(
                          Icons.payments_outlined,
                          'RM ${latest.quotedAmount.toStringAsFixed(2)}',
                        ),
                        const SizedBox(height: AppSpacing.md),
                        SwiperStatusBadge(
                          label: latest.statusLabel,
                          tone: latest.bucket == 'active'
                              ? SwiperStatusTone.success
                              : latest.bucket == 'requests'
                                  ? SwiperStatusTone.warning
                                  : SwiperStatusTone.info,
                        ),
                      ],
                    ),
            ),
          ],
        );
      },
    );
  }

  String _greeting(String fullName) {
    final hour = DateTime.now().hour;
    final prefix = hour < 12
        ? 'Good Morning'
        : hour < 18
            ? 'Good Afternoon'
            : 'Good Evening';
    final name = fullName.trim().isEmpty ? 'Provider' : fullName.split(' ').first;
    return '$prefix, $name';
  }

  Widget _metricCard(
    BuildContext context, {
    required String label,
    required String value,
    required IconData icon,
  }) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE6ECE7)),
      ),
      child: Column(
        children: [
          Icon(icon, color: AppColors.primary),
          const SizedBox(height: AppSpacing.sm),
          Text(
            value,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            textAlign: TextAlign.center,
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

  Widget _summaryRow(String label, String value, {bool isLast = false}) {
    return Container(
      margin: EdgeInsets.only(bottom: isLast ? 0 : AppSpacing.md),
      padding: EdgeInsets.only(bottom: isLast ? 0 : AppSpacing.md),
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

  Widget _bookingInfo(IconData icon, String label) {
    return Row(
      children: [
        Icon(icon, size: 16, color: AppColors.primary),
        const SizedBox(width: AppSpacing.xs),
        Expanded(child: Text(label.isEmpty ? '-' : label)),
      ],
    );
  }
}
