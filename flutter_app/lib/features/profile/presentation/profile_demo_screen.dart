import 'package:flutter/material.dart';

import '../../../repositories/demo_repository.dart';
import '../../../services/customer_account_service.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/notification_card.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/loading_state.dart';
import '../../../widgets/profile_avatar.dart';
import '../../../widgets/swiper_section_card.dart';
import '../../../widgets/swiper_status_badge.dart';

class ProfileDemoScreen extends StatelessWidget {
  const ProfileDemoScreen({
    super.key,
    required this.repository,
  });

  final DemoRepository repository;
  static const _accountService = CustomerAccountService();

  @override
  Widget build(BuildContext context) {
    final notifications = repository.getNotifications();
    return FutureBuilder(
      future: _accountService.fetchOverview(),
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const LoadingState(label: 'Loading customer profile...');
        }

        if (snapshot.hasError) {
          return EmptyState(
            title: 'Unable to load profile',
            subtitle: snapshot.error.toString(),
            icon: Icons.error_outline_rounded,
          );
        }

        final overview = snapshot.data;
        if (overview == null) {
          return const EmptyState(
            title: 'No customer profile',
            subtitle: 'Sign in to view your customer profile.',
            icon: Icons.person_outline_rounded,
          );
        }

        final primaryAddress =
            overview.addresses.isNotEmpty ? overview.addresses.first : null;
        final displayName =
            overview.fullName.trim().isNotEmpty ? overview.fullName : 'Customer';

        return ListView(
          padding: AppSpacing.screenPadding,
          children: [
            SwiperSectionCard(
              title: displayName,
              subtitle: 'Your signed-in customer profile',
              trailing: SwiperStatusBadge(
                label: overview.verification.verified ? 'Verified' : 'Pending',
                tone: overview.verification.verified
                    ? SwiperStatusTone.success
                    : SwiperStatusTone.pending,
              ),
              child: Row(
                children: [
                  ProfileAvatar(name: displayName, radius: 28),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            SwiperSectionCard(
              title: 'Verification',
              subtitle: 'Email, phone, and identity verification status',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Email: ${overview.verification.emailVerified ? 'Verified' : 'Pending'}',
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    'Phone: ${overview.verification.phoneVerified ? 'Verified' : 'Pending'}',
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text('Identity: ${overview.verification.identityStatusLabel}'),
                  const SizedBox(height: AppSpacing.sm),
                  Text('Profile completion: ${overview.completion}%'),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            SwiperSectionCard(
              title: 'Bookings summary',
              subtitle: 'Live customer task counts from Supabase',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Pending: ${overview.bookingSummary.pending}'),
                  const SizedBox(height: AppSpacing.sm),
                  Text('Ongoing: ${overview.bookingSummary.ongoing}'),
                  const SizedBox(height: AppSpacing.sm),
                  Text('Completed: ${overview.bookingSummary.completed}'),
                  const SizedBox(height: AppSpacing.sm),
                  Text('Cancelled: ${overview.bookingSummary.cancelled}'),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            SwiperSectionCard(
              title: 'Payments',
              subtitle: overview.paymentSummary.lastPaymentLabel,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Total paid: ${overview.paymentSummary.totalPaidLabel}'),
                  if (overview.paymentSummary.recentPayments.isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.md),
                    for (final payment in overview.paymentSummary.recentPayments.take(3)) ...[
                      Text(
                        '${payment.serviceTitle} • ${payment.providerName}',
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        '${payment.amountLabel} • ${payment.paymentMethod} • ${payment.statusLabel}',
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(payment.paidAtLabel),
                      const SizedBox(height: AppSpacing.md),
                    ],
                  ],
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            SwiperSectionCard(
              title: 'Contact details',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Email: ${overview.email.isEmpty ? 'Not provided' : overview.email}'),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    'Phone: ${overview.phoneNumber.isEmpty ? 'Not provided' : '${overview.countryCode} ${overview.phoneNumber}'}',
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    'Emergency contact: ${overview.emergencyContactNumber.isEmpty ? 'Not provided' : overview.emergencyContactNumber}',
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text('Date of birth: ${overview.dateOfBirth}'),
                  const SizedBox(height: AppSpacing.sm),
                  Text('Sex: ${overview.sex.isEmpty ? '-' : overview.sex}'),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            SwiperSectionCard(
              title: primaryAddress?.label ?? 'Saved address',
              child: Text(
                primaryAddress == null || primaryAddress.formattedAddress.isEmpty
                    ? 'No address saved yet.'
                    : primaryAddress.formattedAddress,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            SwiperSectionCard(
              title: 'Recent notifications',
              child: Column(
                children: [
                  for (final notification in notifications) ...[
                    NotificationCard(notification: notification),
                    const SizedBox(height: AppSpacing.sm),
                  ],
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}
