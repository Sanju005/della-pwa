import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../core/animation/app_motion.dart';
import '../theme/app_colors.dart';

class ProviderSkeletonCard extends StatelessWidget {
  const ProviderSkeletonCard({
    super.key,
    this.width,
  });

  final double? width;

  @override
  Widget build(BuildContext context) {
    final card = Container(
      width: width,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(26),
        border: Border.all(color: const Color(0xFFE7ECE8)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _SkeletonBlock(
                  width: 98,
                  height: 116,
                  radius: 18,
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _SkeletonBlock(width: double.infinity, height: 18),
                      SizedBox(height: 8),
                      _SkeletonBlock(width: 120, height: 14),
                      SizedBox(height: 10),
                      _SkeletonBlock(width: 112, height: 26, radius: 999),
                      SizedBox(height: 8),
                      _SkeletonBlock(width: 72, height: 12),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                _SkeletonBlock(
                  width: 36,
                  height: 36,
                  radius: 999,
                ),
              ],
            ),
            const SizedBox(height: 14),
            const _SkeletonMetricGrid(),
            const SizedBox(height: 12),
            const Row(
              children: [
                Expanded(child: _SkeletonBlock(width: double.infinity, height: 28, radius: 999)),
                SizedBox(width: 6),
                Expanded(child: _SkeletonBlock(width: double.infinity, height: 28, radius: 999)),
                SizedBox(width: 6),
                Expanded(child: _SkeletonBlock(width: double.infinity, height: 28, radius: 999)),
              ],
            ),
            const SizedBox(height: 16),
            const _SkeletonBlock(width: double.infinity, height: 76, radius: 18),
          ],
        ),
      ),
    );

    if (AppMotion.reduceMotion(context)) {
      return card;
    }

    return card.animate(onPlay: (controller) => controller.repeat()).shimmer(
          duration: const Duration(milliseconds: 1300),
          color: Colors.white.withValues(alpha: 0.65),
        );
  }
}

class _SkeletonMetricGrid extends StatelessWidget {
  const _SkeletonMetricGrid();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        border: Border(
          bottom: BorderSide(color: Color(0xFFEDF1EE)),
        ),
      ),
      padding: const EdgeInsets.only(bottom: 12),
      child: GridView.count(
        crossAxisCount: 2,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: 3.4,
        children: const [
          _SkeletonBlock(width: double.infinity, height: 20),
          _SkeletonBlock(width: double.infinity, height: 20),
          _SkeletonBlock(width: double.infinity, height: 20),
          _SkeletonBlock(width: double.infinity, height: 20),
        ],
      ),
    );
  }
}

class _SkeletonBlock extends StatelessWidget {
  const _SkeletonBlock({
    required this.width,
    required this.height,
    this.radius = 12,
  });

  final double width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: AppColors.primarySoft.withValues(alpha: 0.65),
          borderRadius: BorderRadius.circular(radius),
        ),
      ),
    );
  }
}
