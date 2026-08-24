import 'dart:ui_web' as ui_web;

import 'package:flutter/material.dart';
import 'package:web/web.dart' as web;

class AddressLiveMap extends StatelessWidget {
  const AddressLiveMap({
    super.key,
    required this.address,
    this.latitude,
    this.longitude,
    this.height = 180,
  });

  final String address;
  final double? latitude;
  final double? longitude;
  final double height;

  @override
  Widget build(BuildContext context) {
    final trimmed = address.trim();
    if (trimmed.isEmpty && (latitude == null || longitude == null)) {
      return SizedBox(
        height: height,
        child: const Center(
          child: Text('Type an address to see it on the map.'),
        ),
      );
    }

    final viewType =
        'address-live-map-${trimmed.hashCode}-${latitude?.toStringAsFixed(5) ?? 'na'}-${longitude?.toStringAsFixed(5) ?? 'na'}-${height.toInt()}';
    final src = latitude != null && longitude != null
        ? 'https://www.google.com/maps?q=${latitude!.toStringAsFixed(6)},${longitude!.toStringAsFixed(6)}&z=17&output=embed'
        : 'https://www.google.com/maps?q=${Uri.encodeComponent(trimmed)}&output=embed';

    ui_web.platformViewRegistry.registerViewFactory(viewType, (int _) {
      final iframe = web.HTMLIFrameElement()
        ..src = src
        ..style.border = '0'
        ..style.width = '100%'
        ..style.height = '100%'
        ..loading = 'lazy'
        ..referrerPolicy = 'no-referrer-when-downgrade';
      return iframe;
    });

    return SizedBox(
      height: height,
      child: HtmlElementView(viewType: viewType),
    );
  }
}
