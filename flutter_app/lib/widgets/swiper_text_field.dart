import 'package:flutter/material.dart';

class SwiperTextField extends StatelessWidget {
  const SwiperTextField({
    super.key,
    required this.label,
    this.hintText,
    this.prefixIcon,
    this.controller,
    this.keyboardType,
    this.maxLines = 1,
  });

  final String label;
  final String? hintText;
  final Widget? prefixIcon;
  final TextEditingController? controller;
  final TextInputType? keyboardType;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      maxLines: maxLines,
      decoration: InputDecoration(
        labelText: label,
        hintText: hintText,
        prefixIcon: prefixIcon,
      ),
    );
  }
}
