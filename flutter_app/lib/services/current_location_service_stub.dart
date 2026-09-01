import 'dart:convert';

import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;

import 'current_location_service.dart';

/// Native (Android/iOS) implementation — this file is the default import in
/// current_location_service.dart and is only swapped out for the browser
/// geolocation API when compiling for web (dart.library.js_interop).
Future<CurrentLocationResult> fetchCurrentLocationImpl() async {
  var permission = await Geolocator.checkPermission();
  if (permission == LocationPermission.denied) {
    permission = await Geolocator.requestPermission();
  }
  if (permission == LocationPermission.denied) {
    throw Exception('Location permission was denied.');
  }
  if (permission == LocationPermission.deniedForever) {
    throw Exception(
      'Location permission is permanently denied. Enable it from your device Settings.',
    );
  }

  final serviceEnabled = await Geolocator.isLocationServiceEnabled();
  if (!serviceEnabled) {
    throw Exception(
      'Location services are turned off. Enable GPS to use your current location.',
    );
  }

  final position = await Geolocator.getCurrentPosition(
    locationSettings: const LocationSettings(
      accuracy: LocationAccuracy.high,
      timeLimit: Duration(seconds: 15),
    ),
  );

  try {
    final label = await _reverseGeocode(position.latitude, position.longitude);
    return CurrentLocationResult(
      label: label,
      latitude: position.latitude,
      longitude: position.longitude,
    );
  } catch (_) {
    return CurrentLocationResult(
      label: 'Current location selected',
      latitude: position.latitude,
      longitude: position.longitude,
    );
  }
}

Future<String> _reverseGeocode(double latitude, double longitude) async {
  final uri = Uri.parse(
    'https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=$latitude&lon=$longitude',
  );
  final response = await http
      .get(
        uri,
        headers: const {
          'Accept': 'application/json',
          'User-Agent': 'DellaSwiperApp/1.0 (support@myswiper.my)',
        },
      )
      .timeout(const Duration(seconds: 8));

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw Exception('Unable to reverse geocode current location.');
  }

  final body = jsonDecode(response.body);
  if (body is! Map<String, dynamic>) {
    throw Exception('Invalid reverse geocode response.');
  }

  final displayName = body['display_name']?.toString().trim() ?? '';
  if (displayName.isEmpty) {
    throw Exception('Reverse geocode returned no address.');
  }
  return displayName;
}
