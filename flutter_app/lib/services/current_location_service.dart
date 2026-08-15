import 'current_location_service_stub.dart'
    if (dart.library.js_interop) 'current_location_service_web.dart';

class CurrentLocationResult {
  const CurrentLocationResult({
    required this.label,
    required this.latitude,
    required this.longitude,
  });

  final String label;
  final double latitude;
  final double longitude;
}

Future<CurrentLocationResult> fetchCurrentLocation() => fetchCurrentLocationImpl();
