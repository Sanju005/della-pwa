import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';

/// The 8 real service categories DELLA offers, plus a catch-all "Other" —
/// shared by provider registration and the post-registration Add/Edit
/// Service screen so both flows offer exactly the same choices.
const List<String> providerServiceCategories = [
  'Chef',
  'Maid',
  'Driver',
  'Tutor',
  'Cleaner',
  'Babysitter',
  'Plumber',
  'Electrician',
  'Other',
];

IconData serviceCategoryIcon(String category) {
  switch (category) {
    case 'Chef':
      return Icons.restaurant_rounded;
    case 'Maid':
      return Icons.cleaning_services_rounded;
    case 'Driver':
      return Icons.directions_car_filled_rounded;
    case 'Tutor':
      return Icons.menu_book_rounded;
    case 'Cleaner':
      return Icons.cleaning_services_rounded;
    case 'Babysitter':
      return Icons.child_care_rounded;
    case 'Plumber':
      return Icons.plumbing_rounded;
    case 'Electrician':
      return Icons.electrical_services_rounded;
    default:
      return Icons.more_horiz_rounded;
  }
}

const TextStyle _pickerLabelStyle = TextStyle(
  fontSize: 13,
  fontWeight: FontWeight.w700,
  color: AppColors.textPrimary,
);

/// Icon-grid service category picker shared by provider registration and
/// the "Add/Edit Service" screen, so choosing a service category looks and
/// behaves identically in both flows.
class ServiceCategoryPicker extends StatelessWidget {
  const ServiceCategoryPicker({
    super.key,
    required this.categories,
    required this.selectedCategory,
    required this.onSelect,
    this.label = 'Service Category',
    this.enabled = true,
  });

  final List<String> categories;
  final String? selectedCategory;
  final ValueChanged<String> onSelect;
  final String label;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: enabled ? 1 : 0.55,
      child: IgnorePointer(
        ignoring: !enabled,
        child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: _pickerLabelStyle),
        const SizedBox(height: 8),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: categories.map((category) {
            final selected = selectedCategory == category;
            return InkWell(
              onTap: () => onSelect(category),
              borderRadius: BorderRadius.circular(13),
              child: Container(
                width: 84,
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: selected ? AppColors.primarySoft : Colors.white,
                  borderRadius: BorderRadius.circular(13),
                  border: Border.all(
                    color: selected ? AppColors.primary : AppColors.border,
                    width: selected ? 1.4 : 1,
                  ),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      serviceCategoryIcon(category),
                      color: selected ? AppColors.primary : AppColors.textSecondary,
                      size: 22,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      category,
                      style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700,
                        color: selected ? AppColors.primary : AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            );
          }).toList(),
        ),
      ],
        ),
      ),
    );
  }
}
