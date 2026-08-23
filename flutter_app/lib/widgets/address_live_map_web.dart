import 'dart:ui_web' as ui_web;

import 'package:flutter/material.dart';
import 'package:web/web.dart' as web;

class AddressLiveMap extends StatelessWidget {
  const AddressLiveMap({
    super.key,
    required this.address,
    this.height = 180,
  });

  final String address;
  final double height;

  @override
  Widget build(BuildContext context) {
    final trimmed = address.trim();
    if (trimmed.isEmpty) {
      return SizedBox(
        height: height,
        child: const Center(
          child: Text('Type an address to see it on the map.'),
        ),
      );
    }

    final viewType =
        'address-live-map-${trimmed.hashCode}-${height.toInt()}';
    final src =
        'https://www.google.com/maps?q=${Uri.encodeComponent(trimmed)}&output=embed';

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
