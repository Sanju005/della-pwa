import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

class RatingBadge extends StatelessWidget {
  const RatingBadge({
    super.key,
    required this.rating,
    required this.reviewCount,
  });

  final double rating;
  final int reviewCount;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.warning.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.star_rounded, color: AppColors.warning, size: 16),
          const SizedBox(width: 4),
          Text(
            '$rating · $reviewCount',
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: AppColors.warning,
                ),
          ),
        ],
      ),
    );
  }
}
