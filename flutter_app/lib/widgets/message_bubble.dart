import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';

class MessageBubble extends StatelessWidget {
  const MessageBubble({
    super.key,
    required this.text,
    required this.timeLabel,
    required this.isMine,
  });

  final String text;
  final String timeLabel;
  final bool isMine;

  @override
  Widget build(BuildContext context) {
    final alignment = isMine ? CrossAxisAlignment.end : CrossAxisAlignment.start;
    final bubbleColor = isMine ? AppColors.primary : AppColors.surface;
    final textColor = isMine ? Colors.white : AppColors.textPrimary;

    return Column(
      crossAxisAlignment: alignment,
      children: [
        Container(
          constraints: const BoxConstraints(maxWidth: 280),
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          decoration: BoxDecoration(
            color: bubbleColor,
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            border: isMine ? null : Border.all(color: AppColors.border),
          ),
          child: Text(
            text,
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: textColor),
          ),
        ),
        const SizedBox(height: 4),
        Text(timeLabel, style: Theme.of(context).textTheme.labelMedium),
      ],
    );
  }
}
