import 'package:flutter/material.dart';

import '../models/notification_item.dart';
import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';

class NotificationCard extends StatelessWidget {
  const NotificationCard({
    super.key,
    required this.notification,
  });

  final NotificationItem notification;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      decoration: BoxDecoration(
        color: notification.isUnread ? AppColors.primarySoft : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(color: AppColors.border),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.xs,
        ),
        leading: Container(
          height: 42,
          width: 42,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
          ),
          child: const Icon(Icons.notifications_active_outlined, color: AppColors.primary),
        ),
        title: Text(notification.title, style: Theme.of(context).textTheme.titleMedium),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Text(notification.body),
        ),
        trailing: Text(notification.timeLabel, style: Theme.of(context).textTheme.labelMedium),
      ),
    );
  }
}
