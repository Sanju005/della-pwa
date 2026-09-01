import 'package:flutter/material.dart';

import '../core/animation/app_motion.dart';
import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';

class SwiperBottomNavItem {
  const SwiperBottomNavItem({required this.label, required this.icon});

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
    // Edge-to-edge native bar: full-width surface flush with the screen
    // bottom, a hairline top divider instead of a floating card's
    // border+shadow, and SafeArea only protecting the bottom system inset.
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.divider)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(
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
    final color = selected ? AppColors.primary : AppColors.textSecondary;
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxs),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedScale(
              duration: AppMotion.resolveDuration(context, AppMotion.fast),
              curve: AppMotion.emphasizedCurve,
              scale: selected && !AppMotion.reduceMotion(context) ? 1.03 : 1,
              child: Icon(item.icon, size: 22, color: color),
            ),
            const SizedBox(height: AppSpacing.xxs),
            Text(
              item.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: color,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
            const SizedBox(height: AppSpacing.xxs),
            AnimatedContainer(
              duration: AppMotion.resolveDuration(context, AppMotion.fast),
              curve: AppMotion.emphasizedCurve,
              width: 18,
              height: 3,
              decoration: BoxDecoration(
                color: selected ? AppColors.primary : Colors.transparent,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
