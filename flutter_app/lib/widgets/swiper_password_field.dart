import 'package:flutter/material.dart';

class SwiperPasswordField extends StatefulWidget {
  const SwiperPasswordField({
    super.key,
    required this.label,
    this.controller,
    this.hintText,
  });

  final String label;
  final TextEditingController? controller;
  final String? hintText;

  @override
  State<SwiperPasswordField> createState() => _SwiperPasswordFieldState();
}

class _SwiperPasswordFieldState extends State<SwiperPasswordField> {
  bool _obscured = true;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: widget.controller,
      obscureText: _obscured,
      decoration: InputDecoration(
        labelText: widget.label,
        hintText: widget.hintText,
        prefixIcon: const Icon(Icons.lock_outline_rounded),
        suffixIcon: IconButton(
          onPressed: () => setState(() => _obscured = !_obscured),
          icon: Icon(
            _obscured ? Icons.visibility_off_rounded : Icons.visibility_rounded,
          ),
        ),
      ),
    );
  }
}
