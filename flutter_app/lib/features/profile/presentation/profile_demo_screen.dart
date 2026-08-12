import 'package:flutter/material.dart';

import '../../../repositories/demo_repository.dart';
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

    return ListView(
      padding: AppSpacing.screenPadding,
      children: [
        SwiperSectionCard(
          title: 'Sarah Lim',
          subtitle: 'Customer profile demo',
          trailing: const SwiperStatusBadge(
            label: 'Verified',
            tone: SwiperStatusTone.success,
          ),
          child: const Row(
            children: [
              ProfileAvatar(name: 'Sarah Lim', radius: 28),
            ],
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
