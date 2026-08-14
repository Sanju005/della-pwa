import 'package:flutter/material.dart';

import '../../../repositories/demo_repository.dart';
import '../../../services/demo_customer_auth_store.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/notification_card.dart';
import '../../../widgets/profile_avatar.dart';
import '../../../widgets/swiper_section_card.dart';
import '../../../widgets/swiper_status_badge.dart';

class ProfileDemoScreen extends StatelessWidget {
  const ProfileDemoScreen({
    super.key,
    required this.repository,
  });

  final DemoRepository repository;

  @override
  Widget build(BuildContext context) {
    final notifications = repository.getNotifications();
    final customer = DemoCustomerAuthStore.currentCustomer();
    final firstName = (customer?['firstName'] as String?)?.trim() ?? '';
    final lastName = (customer?['lastName'] as String?)?.trim() ?? '';
    final fullName = [firstName, lastName]
        .where((item) => item.isNotEmpty)
        .join(' ')
        .trim();
    final email = (customer?['email'] as String?)?.trim() ?? 'Not provided';
    final phone = (customer?['phoneNumber'] as String?)?.trim() ?? 'Not provided';
    final emergencyContact =
        (customer?['emergencyContactNumber'] as String?)?.trim() ??
        'Not provided';
    final city = (customer?['city'] as String?)?.trim() ?? '';
    final state = (customer?['state'] as String?)?.trim() ?? '';
    final country = (customer?['country'] as String?)?.trim() ?? '';
    final addressLine1 = (customer?['addressLine1'] as String?)?.trim() ?? '';
    final addressLine2 = (customer?['addressLine2'] as String?)?.trim() ?? '';
    final address = [
      addressLine1,
      addressLine2,
      [city, state, country].where((item) => item.isNotEmpty).join(', '),
    ].where((item) => item.isNotEmpty).join('\n');
    final displayName = fullName.isEmpty ? 'Customer' : fullName;

    return ListView(
      padding: AppSpacing.screenPadding,
      children: [
        SwiperSectionCard(
          title: displayName,
          subtitle: customer != null
              ? 'Your signed-in customer profile'
              : 'Customer profile demo',
          trailing: const SwiperStatusBadge(
            label: 'Verified',
            tone: SwiperStatusTone.success,
          ),
          child: Row(
            children: [
              ProfileAvatar(name: displayName, radius: 28),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        SwiperSectionCard(
          title: 'Contact details',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Email: $email'),
              const SizedBox(height: AppSpacing.sm),
              Text('Phone: $phone'),
              const SizedBox(height: AppSpacing.sm),
              Text('Emergency contact: $emergencyContact'),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        SwiperSectionCard(
          title: 'Saved address',
          child: Text(
            address.isEmpty ? 'No address saved yet.' : address,
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
  }
}
