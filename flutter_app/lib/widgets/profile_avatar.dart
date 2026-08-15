import 'package:flutter/material.dart';

import '../core/config/app_config.dart';
import '../theme/app_colors.dart';

class ProfileAvatar extends StatelessWidget {
  const ProfileAvatar({
    super.key,
    required this.name,
    this.imageUrl = '',
    this.radius = 26,
  });

  final String name;
  final String imageUrl;
  final double radius;

  String _resolveImageUrl(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) {
      return '';
    }
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    if (trimmed.startsWith('/')) {
      return '${AppConfig.appBaseUrl}$trimmed';
    }
    return '${AppConfig.appBaseUrl}/$trimmed';
  }

  @override
  Widget build(BuildContext context) {
    final initials = name
        .split(' ')
        .where((part) => part.isNotEmpty)
        .take(2)
        .map((part) => part.characters.first.toUpperCase())
        .join();
    final resolvedImageUrl = _resolveImageUrl(imageUrl);

    return CircleAvatar(
      radius: radius,
      backgroundColor: AppColors.primarySoft,
      backgroundImage: resolvedImageUrl.isNotEmpty
          ? NetworkImage(resolvedImageUrl)
          : null,
      child: resolvedImageUrl.isNotEmpty
          ? null
          : Text(
              initials.isEmpty ? 'S' : initials,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: AppColors.primary,
                  ),
            ),
    );
  }
}
