import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

class ProfileAvatar extends StatelessWidget {
  const ProfileAvatar({
    super.key,
    required this.name,
    this.radius = 26,
  });

  final String name;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final initials = name
        .split(' ')
        .where((part) => part.isNotEmpty)
        .take(2)
        .map((part) => part.characters.first.toUpperCase())
        .join();

    return CircleAvatar(
      radius: radius,
      backgroundColor: AppColors.primarySoft,
      child: Text(
        initials.isEmpty ? 'S' : initials,
        style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: AppColors.primary,
            ),
      ),
    );
  }
}
