import 'dart:convert';
import 'dart:typed_data';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../core/config/app_config.dart';

/// General-purpose replacement for the hand-rolled http(s)/data:/empty
/// branching that used to be duplicated across provider cards, booking
/// cards, and provider profile/workspace screens. Disk-caches public
/// http(s) URLs via cached_network_image (stable URL as the cache key —
/// never a timestamp or cache-busting param, since that would defeat the
/// whole point); data: URLs and empty values keep their existing
/// in-memory/fallback behavior and are never written to disk.
///
/// Do not use this for private/signed content (payment proofs, identity
/// documents, support documents) — a signed URL's token changes on every
/// mint, and even where it doesn't, persisting sensitive bytes to an
/// unmanaged disk cache can outlive the URL's intended access window. Those
/// call sites intentionally keep using plain Image.network.
class CachedImage extends StatelessWidget {
  const CachedImage({
    super.key,
    required this.url,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.borderRadius,
    this.shape = BoxShape.rectangle,
    this.placeholder,
    this.errorWidget,
    this.fallback,
  });

  final String url;
  final double? width;
  final double? height;
  final BoxFit fit;
  final BorderRadius? borderRadius;
  final BoxShape shape;
  final WidgetBuilder? placeholder;
  final Widget Function(BuildContext context, Object error)? errorWidget;
  final Widget? fallback;

  static String _resolveHttpUrl(String value) {
    final trimmed = value.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    if (trimmed.startsWith('/')) {
      return '${AppConfig.appBaseUrl}$trimmed';
    }
    return '${AppConfig.appBaseUrl}/$trimmed';
  }

  static Uint8List? _decodeDataUrlBytes(String value) {
    final commaIndex = value.indexOf(',');
    if (!value.startsWith('data:') || commaIndex == -1) {
      return null;
    }
    try {
      return base64Decode(value.substring(commaIndex + 1));
    } catch (_) {
      return null;
    }
  }

  /// For call sites needing an ImageProvider instead of a widget
  /// (CircleAvatar.backgroundImage, DecorationImage, etc.) — same dispatch
  /// logic as the widget form, returns null for empty/unresolvable input so
  /// the caller's existing "null -> show fallback child" pattern keeps
  /// working unchanged.
  static ImageProvider? resolveProvider(String url) {
    final trimmed = url.trim();
    if (trimmed.isEmpty) {
      return null;
    }

    final dataBytes = _decodeDataUrlBytes(trimmed);
    if (dataBytes != null) {
      return MemoryImage(dataBytes);
    }

    return CachedNetworkImageProvider(_resolveHttpUrl(trimmed));
  }

  @override
  Widget build(BuildContext context) {
    final trimmed = url.trim();

    Widget child;
    if (trimmed.isEmpty) {
      child = fallback ?? const SizedBox.shrink();
    } else {
      final dataBytes = _decodeDataUrlBytes(trimmed);
      if (dataBytes != null) {
        child = Image.memory(
          dataBytes,
          width: width,
          height: height,
          fit: fit,
          errorBuilder: errorWidget == null
              ? null
              : (context, error, stackTrace) => errorWidget!(context, error),
        );
      } else {
        child = CachedNetworkImage(
          imageUrl: _resolveHttpUrl(trimmed),
          width: width,
          height: height,
          fit: fit,
          placeholder: placeholder == null
              ? null
              : (context, url) => placeholder!(context),
          errorWidget: errorWidget == null
              ? null
              : (context, url, error) => errorWidget!(context, error),
        );
      }
    }

    if (borderRadius != null) {
      child = ClipRRect(borderRadius: borderRadius!, child: child);
    } else if (shape == BoxShape.circle) {
      child = ClipOval(child: child);
    }

    return child;
  }
}
