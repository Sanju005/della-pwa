import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';

class BookingTimeline extends StatelessWidget {
  const BookingTimeline({
    super.key,
    required this.steps,
    this.activeIndex = 1,
  });

  final List<String> steps;
  final int activeIndex;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(steps.length, (index) {
        final isDone = index < activeIndex;
        final isActive = index == activeIndex;

        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Column(
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  height: 24,
                  width: 24,
                  decoration: BoxDecoration(
                    color: isDone || isActive ? AppColors.primary : Colors.white,
                    border: Border.all(
                      color: isDone || isActive ? AppColors.primary : AppColors.border,
                      width: 2,
                    ),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    isDone ? Icons.check_rounded : Icons.circle,
                    size: 12,
                    color: isDone || isActive ? Colors.white : AppColors.border,
                  ),
                ),
                if (index != steps.length - 1)
                  Container(
                    width: 2,
                    height: 30,
                    color: AppColors.border,
                  ),
              ],
            ),
            const SizedBox(width: AppSpacing.md),
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(
                steps[index],
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: isActive ? AppColors.textPrimary : AppColors.textSecondary,
                    ),
              ),
            ),
          ],
        );
      }),
    );
  }
}
