import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';

import '../models/service_category.dart';
import '../previews/widget_preview_helpers.dart';
import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';

class ServiceCategoryChip extends StatelessWidget {
  const ServiceCategoryChip({super.key, required this.category, this.onTap});

  final ServiceCategory category;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
      onTap: onTap,
      child: Ink(
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          border: Border.all(color: AppColors.border),
        ),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                height: 44,
                width: 44,
                decoration: BoxDecoration(
                  color: AppColors.primarySoft,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(category.icon, color: AppColors.primary),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                category.label,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.labelLarge,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

@Preview(
  name: 'Service Category',
  size: Size(180, 180),
  wrapper: previewSurface,
)
Widget serviceCategoryChipPreview() {
  const category = ServiceCategory(
    label: 'Chef',
    icon: Icons.restaurant_rounded,
  );

  return const ServiceCategoryChip(category: category);
}
