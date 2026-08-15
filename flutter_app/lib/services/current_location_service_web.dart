import 'dart:async';
import 'dart:js_interop';

import 'package:web/web.dart' as web;

import 'current_location_service.dart';

Future<CurrentLocationResult> fetchCurrentLocationImpl() {
  final completer = Completer<CurrentLocationResult>();
  final geolocation = web.window.navigator.geolocation;

  geolocation.getCurrentPosition(
    ((web.GeolocationPosition position) {
      final latitude = position.coords.latitude;
      final longitude = position.coords.longitude;
      completer.complete(
        CurrentLocationResult(
          label:
              'Current location\nLat: ${latitude.toStringAsFixed(6)}, Lng: ${longitude.toStringAsFixed(6)}',
          latitude: latitude,
          longitude: longitude,
        ),
      );
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
