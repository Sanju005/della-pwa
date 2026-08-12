import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

enum SwiperStatusTone { info, success, warning, error }

class SwiperStatusBadge extends StatelessWidget {
  const SwiperStatusBadge({
    super.key,
    required this.label,
    this.tone = SwiperStatusTone.info,
  });

  final String label;
  final SwiperStatusTone tone;

  @override
  Widget build(BuildContext context) {
    final (background, foreground) = switch (tone) {
      SwiperStatusTone.success => (AppColors.success.withValues(alpha: 0.12), AppColors.success),
      SwiperStatusTone.warning => (AppColors.warning.withValues(alpha: 0.16), AppColors.warning),
      SwiperStatusTone.error => (AppColors.error.withValues(alpha: 0.12), AppColors.error),
      SwiperStatusTone.info => (AppColors.primarySoft, AppColors.primary),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(color: foreground),
      ),
    );
  }
}
