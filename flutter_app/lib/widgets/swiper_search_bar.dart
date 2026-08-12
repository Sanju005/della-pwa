import 'package:flutter/material.dart';

class SwiperSearchBar extends StatelessWidget {
  const SwiperSearchBar({
    super.key,
    this.hintText = 'Search services or providers',
  });

  final String hintText;

  @override
  Widget build(BuildContext context) {
    return TextField(
      readOnly: true,
      decoration: InputDecoration(
        hintText: hintText,
        prefixIcon: const Icon(Icons.search_rounded),
        suffixIcon: const Icon(Icons.tune_rounded),
      ),
    );
  }
}
