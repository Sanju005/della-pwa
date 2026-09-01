import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../../../../core/animation/app_motion.dart';
import '../../../../theme/app_colors.dart';
import '../../../../theme/app_spacing.dart';

/// Full-page placeholder for [ProviderEarningsScreen] shown while its
/// first fetch is in flight, roughly mirroring the tabs/filters, financial
/// summary, payable card, and transaction rows so the screen reads as
/// "already there" instead of a blank spinner.
class ProviderEarningsSkeleton extends StatelessWidget {
  const ProviderEarningsSkeleton({super.key});

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
        _SkeletonBlock(height: 44, radius: 14),
        SizedBox(height: AppSpacing.md),
        _SkeletonChipRow(),
        SizedBox(height: AppSpacing.lg),
        _SkeletonBlock(height: 170, radius: 20),
        SizedBox(height: AppSpacing.md),
        _SkeletonBlock(height: 150, radius: 20),
        SizedBox(height: AppSpacing.lg),
        _SkeletonBlock(height: 90, radius: 16),
        SizedBox(height: AppSpacing.sm),
        _SkeletonBlock(height: 90, radius: 16),
        SizedBox(height: AppSpacing.sm),
        _SkeletonBlock(height: 90, radius: 16),
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

class _SkeletonChipRow extends StatelessWidget {
  const _SkeletonChipRow();

  @override
  Widget build(BuildContext context) {
    return const Row(
      children: [
        _SkeletonBlock(width: 74, height: 30, radius: 999),
        SizedBox(width: AppSpacing.xs),
        _SkeletonBlock(width: 88, height: 30, radius: 999),
        SizedBox(width: AppSpacing.xs),
        _SkeletonBlock(width: 100, height: 30, radius: 999),
      ],
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
