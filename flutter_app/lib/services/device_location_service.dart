import 'dart:convert';

import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;

class DeviceLocationResult {
  const DeviceLocationResult({
    required this.label,
    required this.latitude,
    required this.longitude,
  });

  final String label;
  final double latitude;
  final double longitude;
}

/// Fetches the device's current GPS position (requesting permission if
/// needed) and reverse-geocodes it into a human-readable label via the same
/// free Nominatim endpoint the web build already uses for this — no API key.
Future<DeviceLocationResult> fetchDeviceLocation() async {
  var permission = await Geolocator.checkPermission();
  if (permission == LocationPermission.denied) {
    permission = await Geolocator.requestPermission();
  }

  if (permission == LocationPermission.denied ||
      permission == LocationPermission.deniedForever) {
    throw Exception('Location permission was denied.');
  }

  if (!await Geolocator.isLocationServiceEnabled()) {
    throw Exception('Turn on location services to use your current location.');
  }

  final position = await Geolocator.getCurrentPosition(
    locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
  );

  final label = await _reverseGeocode(position.latitude, position.longitude);
  return DeviceLocationResult(
    label: label,
    latitude: position.latitude,
    longitude: position.longitude,
  );
}

Future<String> _reverseGeocode(double latitude, double longitude) async {
  try {
    final uri = Uri.parse(
      'https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=$latitude&lon=$longitude',
    );
    final response = await http.get(
      uri,
      headers: const {
        'Accept': 'application/json',
        'User-Agent': 'DellaSwiperProviderApp/1.0',
      },
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      return 'Current location';
    }

    final body = jsonDecode(response.body);
    if (body is Map<String, dynamic>) {
      final displayName = body['display_name']?.toString().trim() ?? '';
      if (displayName.isNotEmpty) {
        return displayName;
      }
    }
  } catch (_) {
    // Fall through to the generic label below.
  }
  return 'Current location';
}
