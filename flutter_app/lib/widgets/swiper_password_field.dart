import 'package:flutter/material.dart';

class SwiperPasswordField extends StatefulWidget {
  const SwiperPasswordField({
    super.key,
    required this.label,
    this.controller,
    this.hintText,
    this.focusNode,
    this.onChanged,
    this.onSubmitted,
    this.validator,
    this.textInputAction,
    this.autofillHints,
  });

  final String label;
  final TextEditingController? controller;
  final String? hintText;
  final FocusNode? focusNode;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final FormFieldValidator<String>? validator;
  final TextInputAction? textInputAction;
  final Iterable<String>? autofillHints;

  @override
  State<SwiperPasswordField> createState() => _SwiperPasswordFieldState();
}

class _SwiperPasswordFieldState extends State<SwiperPasswordField> {
  bool _obscured = true;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: widget.controller,
      focusNode: widget.focusNode,
      obscureText: _obscured,
      onChanged: widget.onChanged,
      onFieldSubmitted: widget.onSubmitted,
      validator: widget.validator,
      textInputAction: widget.textInputAction,
      autofillHints: widget.autofillHints,
      decoration: InputDecoration(
        labelText: widget.label,
        hintText: widget.hintText,
        prefixIcon: const Icon(Icons.lock_outline_rounded),
        suffixIcon: IconButton(
          splashRadius: 20,
          onPressed: () => setState(() => _obscured = !_obscured),
          icon: Icon(
            _obscured ? Icons.visibility_off_rounded : Icons.visibility_rounded,
          ),
          tooltip: _obscured ? 'Show password' : 'Hide password',
        ),
      ),
    );
  }
}
