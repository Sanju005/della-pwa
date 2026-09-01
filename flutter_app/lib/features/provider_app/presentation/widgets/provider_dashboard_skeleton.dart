import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../../../../core/animation/app_motion.dart';
import '../../../../theme/app_colors.dart';
import '../../../../theme/app_spacing.dart';

/// Full-page placeholder for [ProviderDashboardScreen] shown while its
/// first fetch is in flight, roughly mirroring the real layout so the
/// screen reads as "already there" instead of a blank spinner.
class ProviderDashboardSkeleton extends StatelessWidget {
  const ProviderDashboardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final content = ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.md,
        AppSpacing.md,
        112,
      ),
      children: const [
        _SkeletonBlock(height: 260, radius: 28),
        SizedBox(height: AppSpacing.lg),
        _SkeletonBlock(height: 220, radius: 24),
        SizedBox(height: AppSpacing.lg),
        _SkeletonBlock(height: 250, radius: 24),
        SizedBox(height: AppSpacing.lg),
        _SkeletonBlock(height: 190, radius: 24),
        SizedBox(height: AppSpacing.md),
        _SkeletonMetricRow(),
        SizedBox(height: AppSpacing.lg),
        _SkeletonBlock(width: 160, height: 18, radius: 8),
        SizedBox(height: AppSpacing.md),
        _SkeletonReviewRow(),
      ],
    );

    if (AppMotion.reduceMotion(context)) {
      return content;
    }

    return content
        .animate(onPlay: (controller) => controller.repeat())
        .shimmer(
          duration: const Duration(milliseconds: 1300),
          color: Colors.white.withValues(alpha: 0.6),
        );
  }
}

class _SkeletonMetricRow extends StatelessWidget {
  const _SkeletonMetricRow();

  @override
  Widget build(BuildContext context) {
    return const Row(
      children: [
        Expanded(child: _SkeletonBlock(height: 84, radius: 16)),
        SizedBox(width: AppSpacing.sm),
        Expanded(child: _SkeletonBlock(height: 84, radius: 16)),
        SizedBox(width: AppSpacing.sm),
        Expanded(child: _SkeletonBlock(height: 84, radius: 16)),
      ],
    );
  }
}

class _SkeletonReviewRow extends StatelessWidget {
  const _SkeletonReviewRow();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      height: 150,
      child: Row(
        children: [
          Expanded(child: _SkeletonBlock(height: 150, radius: 20)),
          SizedBox(width: AppSpacing.sm),
          Expanded(child: _SkeletonBlock(height: 150, radius: 20)),
        ],
      ),
    );
  }
}

class _SkeletonBlock extends StatelessWidget {
  const _SkeletonBlock({this.width, required this.height, this.radius = 16});

  final double? width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: AppColors.primarySurface.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(radius),
      ),
    );
  }
}
