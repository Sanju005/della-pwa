import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

/// Auto-generated "About the Service" starter text shared by provider
/// registration and the "Add/Edit Service" screen — [providerName] is
/// optional (registration has it on hand, Add Service doesn't bother
/// threading it through) and falls back to a generic "a service provider"
/// intro when empty.
String generateServiceAboutText({
  required String category,
  required String yearsExperience,
  required List<String> specialties,
  String providerName = '',
}) {
  final name = providerName.trim();
  final years = yearsExperience.trim();
  final trimmedCategory = category.trim();

  final intro = name.isEmpty ? "I'm a service provider" : "I'm $name";
  final field = trimmedCategory.isEmpty
      ? 'this field'
      : '${trimmedCategory.toLowerCase()} field';
  final experiencePart = years.isEmpty
      ? 'working in the $field'
      : 'with $years year${years == '1' ? '' : 's'} of experience in the $field';
  final specialtyPart = specialties.isEmpty
      ? ''
      : ', specialising in ${specialties.join(', ')}';

  return '$intro, $experiencePart$specialtyPart.';
}

/// Real, category-relevant example specialties for the helper text below
/// the input — matches the categories the provider app actually offers
/// (see [SpecialtyChipField]'s `category`), never a generic placeholder
/// unrelated to any service DELLA offers.
String specialtyExamplesFor(String? category) {
  switch (category) {
    case 'Chef':
      return 'Malay, Western, Healthy Meals';
    case 'Maid':
      return 'Deep Cleaning, Laundry, Ironing';
    case 'Driver':
      return 'Airport Pickup, Outstation, School Runs';
    case 'Tutor':
      return 'Mathematics, English, Exam Prep';
    case 'Cleaner':
      return 'Deep Cleaning, Kitchen Cleaning, Bathroom Care';
    case 'Babysitter':
      return 'Toddler Care, Newborn Care, Homework Help';
    case 'Plumber':
      return 'Pipe Repair, Leak Fix, Installation';
    case 'Electrician':
      return 'Wiring, Socket Repair, Lighting';
    default:
      return 'Deep Cleaning, Emergency Callout, Installation';
  }
}

const double _chipFieldRadius = 13;

const TextStyle _chipFieldLabelStyle = TextStyle(
  fontSize: 13,
  fontWeight: FontWeight.w700,
  color: AppColors.textPrimary,
);

const TextStyle _chipFieldHelperStyle = TextStyle(
  fontSize: 11.5,
  color: AppColors.textMuted,
);

OutlineInputBorder _chipFieldBorder(Color color, {double width = 1}) {
  return OutlineInputBorder(
    borderRadius: BorderRadius.circular(_chipFieldRadius),
    borderSide: BorderSide(color: color, width: width),
  );
}

InputDecoration _chipFieldDecoration() {
  return InputDecoration(
    isDense: true,
    filled: true,
    fillColor: Colors.white,
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
    border: _chipFieldBorder(AppColors.border),
    enabledBorder: _chipFieldBorder(AppColors.border),
    focusedBorder: _chipFieldBorder(AppColors.primary, width: 1.4),
  );
}

/// Chip-based specialty picker shared by provider registration and the
/// post-registration "Add/Edit Service" screen, so both flows collect
/// specialties the same way with the same category-aware example text —
/// never a generic or unrelated-category placeholder.
class SpecialtyChipField extends StatefulWidget {
  const SpecialtyChipField({
    super.key,
    required this.specialties,
    required this.onChanged,
    this.category,
  });

  final List<String> specialties;
  final VoidCallback onChanged;
  final String? category;

  @override
  State<SpecialtyChipField> createState() => _SpecialtyChipFieldState();
}

class _SpecialtyChipFieldState extends State<SpecialtyChipField> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _commitPending() {
    final raw = _controller.text.trim();
    _controller.clear();
    if (raw.isEmpty) {
      return;
    }
    final normalized = raw.toLowerCase();
    final isDuplicate = widget.specialties.any(
      (existing) => existing.toLowerCase() == normalized,
    );
    if (isDuplicate) {
      return;
    }
    setState(() => widget.specialties.add(raw));
    widget.onChanged();
  }

  void _removeAt(int index) {
    setState(() => widget.specialties.removeAt(index));
    widget.onChanged();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Specialities', style: _chipFieldLabelStyle),
        const SizedBox(height: 6),
        if (widget.specialties.isNotEmpty) ...[
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: List.generate(widget.specialties.length, (index) {
              return Chip(
                label: Text(widget.specialties[index]),
                deleteIcon: const Icon(Icons.close_rounded, size: 15),
                onDeleted: () => _removeAt(index),
                backgroundColor: AppColors.primarySoft,
                side: BorderSide.none,
                labelStyle: const TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: AppColors.primary,
                ),
              );
            }),
          ),
          const SizedBox(height: 8),
        ],
        TextField(
          controller: _controller,
          onChanged: (value) {
            if (value.endsWith(',')) {
              _controller.text = value.substring(0, value.length - 1);
              _commitPending();
            }
          },
          onSubmitted: (_) => _commitPending(),
          style: const TextStyle(fontSize: 15),
          decoration: _chipFieldDecoration(),
        ),
        const SizedBox(height: 4),
        Text(
          'Type a specialty, then a comma to add it — e.g. ${specialtyExamplesFor(widget.category)}.',
          style: _chipFieldHelperStyle,
        ),
      ],
    );
  }
}
