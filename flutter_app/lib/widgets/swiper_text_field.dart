import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';

import '../previews/widget_preview_helpers.dart';

class SwiperTextField extends StatelessWidget {
  const SwiperTextField({
    super.key,
    required this.label,
    this.hintText,
    this.prefixIcon,
    this.controller,
    this.keyboardType,
    this.maxLines = 1,
    this.textInputAction,
    this.focusNode,
    this.onChanged,
    this.onSubmitted,
    this.validator,
    this.autofillHints,
  });

  final String label;
  final String? hintText;
  final Widget? prefixIcon;
  final TextEditingController? controller;
  final TextInputType? keyboardType;
  final int maxLines;
  final TextInputAction? textInputAction;
  final FocusNode? focusNode;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final FormFieldValidator<String>? validator;
  final Iterable<String>? autofillHints;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      focusNode: focusNode,
      keyboardType: keyboardType,
      maxLines: maxLines,
      textInputAction: textInputAction,
      onChanged: onChanged,
      onFieldSubmitted: onSubmitted,
      validator: validator,
      autofillHints: autofillHints,
      decoration: InputDecoration(
        labelText: label,
        hintText: hintText,
        prefixIcon: prefixIcon,
      ),
    );
  }
}

@Preview(name: 'Name Field', size: Size(360, 140), wrapper: previewSurface)
Widget swiperTextFieldNamePreview() {
  return SwiperTextField(
    label: 'Service address',
    hintText: 'Enter your condo or street address',
    prefixIcon: const Icon(Icons.place_outlined),
    controller: TextEditingController(text: 'Mont Kiara Residence'),
  );
}

@Preview(name: 'Notes Field', size: Size(360, 220), wrapper: previewSurface)
Widget swiperTextFieldNotesPreview() {
  return SwiperTextField(
    label: 'Special instructions',
    hintText: 'Add allergies, parking notes, or access instructions',
    prefixIcon: const Icon(Icons.edit_note_rounded),
    maxLines: 4,
    controller: TextEditingController(
      text: 'Please call when you arrive. Visitor parking is beside Tower B.',
    ),
  );
}
