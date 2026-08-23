import 'package:flutter/material.dart';

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
    return Container(
      height: height,
      alignment: Alignment.center,
      child: const Text('Live map preview is available on web.'),
    );
  }
}
