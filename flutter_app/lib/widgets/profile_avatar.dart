import 'dart:convert';
import 'dart:typed_data';

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

  /// A freshly-picked avatar (not yet saved) is a `data:<mime>;base64,...`
  /// URL, not a real network path — decodes to bytes for [MemoryImage].
  /// Returns null for anything that isn't a data URL.
  Uint8List? _decodeDataUrlBytes(String value) {
    final trimmed = value.trim();
    final commaIndex = trimmed.indexOf(',');
    if (!trimmed.startsWith('data:') || commaIndex == -1) {
      return null;
    }
    try {
      return base64Decode(trimmed.substring(commaIndex + 1));
    } catch (_) {
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final initials = name
        .split(' ')
        .where((part) => part.isNotEmpty)
        .take(2)
        .map((part) => part.characters.first.toUpperCase())
        .join();
    final dataUrlBytes = _decodeDataUrlBytes(imageUrl);
    final resolvedImageUrl = dataUrlBytes == null
        ? _resolveImageUrl(imageUrl)
        : '';
    final ImageProvider? backgroundImage = dataUrlBytes != null
        ? MemoryImage(dataUrlBytes)
        : (resolvedImageUrl.isNotEmpty ? NetworkImage(resolvedImageUrl) : null);

    return CircleAvatar(
      radius: radius,
      backgroundColor: AppColors.primarySoft,
      backgroundImage: backgroundImage,
      child: backgroundImage != null
          ? null
          : Text(
              initials.isEmpty ? 'S' : initials,
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(color: AppColors.primary),
            ),
    );
  }
}
