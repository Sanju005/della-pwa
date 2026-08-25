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
        AppSpacing.xs,
        AppSpacing.md,
        AppSpacing.sm,
      ),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: const Color(0xFFE9E5F1)),
          boxShadow: const [
            BoxShadow(
              color: Color(0x120F0B1F),
              blurRadius: 18,
              offset: Offset(0, 6),
            ),
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(8, 10, 8, 12),
          child: LayoutBuilder(
            builder: (context, constraints) {
              return Row(
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
      borderRadius: BorderRadius.circular(18),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedScale(
              duration: AppMotion.resolveDuration(context, AppMotion.fast),
              curve: AppMotion.emphasizedCurve,
              scale: selected && !AppMotion.reduceMotion(context) ? 1.03 : 1,
              child: Icon(
                item.icon,
                size: 23,
                color: selected
                    ? AppColors.primary
                    : const Color(0xFF7C7792),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              item.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: selected
                        ? AppColors.primary
                        : const Color(0xFF7C7792),
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  ),
            ),
            const SizedBox(height: 8),
            AnimatedContainer(
              duration: AppMotion.resolveDuration(context, AppMotion.fast),
              curve: AppMotion.emphasizedCurve,
              width: 20,
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
