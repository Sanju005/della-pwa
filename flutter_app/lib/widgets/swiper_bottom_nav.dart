import 'package:flutter/material.dart';

import '../core/animation/app_motion.dart';
import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';

class SwiperBottomNavItem {
  const SwiperBottomNavItem({
    required this.label,
    required this.icon,
  });

  final String label;
  final IconData icon;
}

class SwiperBottomNav extends StatelessWidget {
  const SwiperBottomNav({
    super.key,
    required this.currentIndex,
    required this.items,
    required this.onTap,
  });

  final int currentIndex;
  final List<SwiperBottomNavItem> items;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      minimum: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.sm,
        AppSpacing.md,
        AppSpacing.sm,
      ),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          border: Border.all(color: AppColors.border),
          boxShadow: const [
            BoxShadow(
              color: AppColors.shadow,
              blurRadius: 24,
              offset: Offset(0, 10),
            ),
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.xs,
            vertical: AppSpacing.xs,
          ),
          child: LayoutBuilder(
            builder: (context, constraints) {
              final itemWidth = constraints.maxWidth / items.length;
              return Stack(
                children: [
                  AnimatedPositioned(
                    duration: AppMotion.resolveDuration(context, AppMotion.normal),
                    curve: AppMotion.emphasizedCurve,
                    left: (itemWidth * currentIndex) + 4,
                    top: 4,
                    width: itemWidth - 8,
                    bottom: 4,
                    child: IgnorePointer(
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          color: AppColors.primarySoft,
                          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                        ),
                      ),
                    ),
                  ),
                  Row(
                    children: [
                      for (var index = 0; index < items.length; index++)
                        Expanded(
                          child: _BottomNavButton(
                            item: items[index],
                            selected: index == currentIndex,
                            onTap: () => onTap(index),
                          ),
                        ),
                    ],
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

class _BottomNavButton extends StatelessWidget {
  const _BottomNavButton({
    required this.item,
    required this.selected,
    required this.onTap,
  });

  final SwiperBottomNavItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 4),
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedScale(
              duration: AppMotion.resolveDuration(context, AppMotion.fast),
              curve: AppMotion.emphasizedCurve,
              scale: selected && !AppMotion.reduceMotion(context) ? 1.08 : 1,
              child: Icon(
                item.icon,
                color: selected ? AppColors.primary : AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 4),
            AnimatedOpacity(
              duration: AppMotion.resolveDuration(context, AppMotion.fast),
              curve: AppMotion.enterCurve,
              opacity: selected ? 1 : 0.78,
              child: Text(
                item.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: selected ? AppColors.primary : AppColors.textSecondary,
                    ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
