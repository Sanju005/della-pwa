import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

class VerifiedBadge extends StatelessWidget {
  const VerifiedBadge({
    super.key,
    required this.label,
    required this.verified,
  });

  final String label;
  final bool verified;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          verified ? Icons.verified_rounded : Icons.schedule_rounded,
          size: 16,
          color: verified ? AppColors.success : AppColors.warning,
        ),
        const SizedBox(width: 4),
        Text(
          label,
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: verified ? AppColors.success : AppColors.warning,
              ),
        ),
      ],
    );
  }
}
