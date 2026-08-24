import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';

class MalaysiaStateAutocompleteField extends StatelessWidget {
  MalaysiaStateAutocompleteField({
    super.key,
    required this.controller,
    this.label = 'State',
    this.hintText = 'Type state',
    this.validator,
    this.onChanged,
  });

  final TextEditingController controller;
  final String label;
  final String hintText;
  final String? Function(String?)? validator;
  final ValueChanged<String>? onChanged;

  static const List<String> malaysianStates = <String>[
    'Johor',
    'Kedah',
    'Kelantan',
    'Kuala Lumpur',
    'Labuan',
    'Malacca',
    'Negeri Sembilan',
    'Pahang',
    'Penang',
    'Perak',
    'Perlis',
    'Putrajaya',
    'Sabah',
    'Sarawak',
    'Selangor',
    'Terengganu',
  ];

  final GlobalKey<FormFieldState<String>> _fieldKey =
      GlobalKey<FormFieldState<String>>();

  @override
  Widget build(BuildContext context) {
    return Autocomplete<String>(
      initialValue: TextEditingValue(text: controller.text),
      optionsBuilder: (textEditingValue) {
        final query = textEditingValue.text.trim().toLowerCase();
        if (query.isEmpty) {
          return const Iterable<String>.empty();
        }

        return malaysianStates.where((state) {
          final normalized = state.toLowerCase();
          return normalized.startsWith(query) || normalized.contains(query);
        });
      },
      onSelected: (value) {
        controller.text = value;
        _fieldKey.currentState?.didChange(value);
        onChanged?.call(value);
      },
      fieldViewBuilder: (context, textEditingController, focusNode, onSubmitted) {
        if (textEditingController.text != controller.text) {
          textEditingController.value = TextEditingValue(
            text: controller.text,
            selection: TextSelection.collapsed(offset: controller.text.length),
          );
        }

        textEditingController.addListener(() {
          if (controller.text != textEditingController.text) {
            controller.value = textEditingController.value;
            _fieldKey.currentState?.didChange(textEditingController.text);
            onChanged?.call(textEditingController.text);
          }
        });

        return TextFormField(
          key: _fieldKey,
          controller: textEditingController,
          focusNode: focusNode,
          validator: validator,
          decoration: InputDecoration(
            labelText: label,
            hintText: hintText,
          ),
        );
      },
      optionsViewBuilder: (context, onSelected, options) {
        return Align(
          alignment: Alignment.topLeft,
          child: Material(
            elevation: 8,
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            child: ConstrainedBox(
              constraints: const BoxConstraints(
                maxWidth: 320,
                maxHeight: 220,
              ),
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
                shrinkWrap: true,
                itemCount: options.length,
                separatorBuilder: (_, _) =>
                    const Divider(height: 1, color: AppColors.border),
                itemBuilder: (context, index) {
                  final option = options.elementAt(index);
                  return InkWell(
                    onTap: () => onSelected(option),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.md,
                        vertical: AppSpacing.sm,
                      ),
                      child: Text(
                        option,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
        );
      },
    );
  }
}
