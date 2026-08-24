import 'dart:async';
import 'dart:convert';
import 'dart:js_interop';

import 'package:http/http.dart' as http;
import 'package:web/web.dart' as web;

import 'current_location_service.dart';

Future<CurrentLocationResult> fetchCurrentLocationImpl() {
  final completer = Completer<CurrentLocationResult>();
  final geolocation = web.window.navigator.geolocation;

  geolocation.getCurrentPosition(
    ((web.GeolocationPosition position) {
      final latitude = position.coords.latitude;
      final longitude = position.coords.longitude;
      () async {
        try {
          final label = await _reverseGeocode(latitude, longitude);
          completer.complete(
            CurrentLocationResult(
              label: label,
              latitude: latitude,
              longitude: longitude,
            ),
          );
        } catch (_) {
          completer.complete(
            CurrentLocationResult(
              label: 'Current location selected',
              latitude: latitude,
              longitude: longitude,
            ),
          );
        }
      }();
    }).toJS,
    ((web.GeolocationPositionError error) {
      final message = error.message;
      completer.completeError(
        Exception(
          message.trim().isEmpty
              ? 'Location permission was denied or unavailable.'
              : message,
        ),
      );
    }).toJS,
    web.PositionOptions(
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    ),
  );

  return completer.future;
}

Future<String> _reverseGeocode(double latitude, double longitude) async {
  final uri = Uri.parse(
    'https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=$latitude&lon=$longitude',
  );
  final response = await http.get(
    uri,
    headers: const {
      'Accept': 'application/json',
    },
  );
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
