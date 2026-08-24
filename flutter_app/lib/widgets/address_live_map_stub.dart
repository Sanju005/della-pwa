import 'package:flutter/material.dart';

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
    return Container(
      height: height,
      alignment: Alignment.center,
      child: const Text('Live map preview is available on web.'),
    );
  }
}
