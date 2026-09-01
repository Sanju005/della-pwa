import 'dart:convert';

import 'service_location_store_stub.dart'
    if (dart.library.io) 'service_location_store_io.dart'
    if (dart.library.js_interop) 'service_location_store_web.dart'
    as storage;

class ServiceLocationSelection {
  const ServiceLocationSelection({
    required this.type,
    required this.label,
    this.address = '',
    this.city = '',
    this.state = '',
    this.country = '',
    this.latitude,
    this.longitude,
  });

  final String type;
  final String label;
  final String address;
  final String city;
  final String state;
  final String country;
  final double? latitude;
  final double? longitude;

  List<String> get searchTokens => [city, state, country]
      .map((item) => item.trim().toLowerCase())
      .where((item) => item.isNotEmpty)
      .toList();

  Map<String, dynamic> toJson() {
    return {
      'type': type,
      'label': label,
      'address': address,
      'city': city,
      'state': state,
      'country': country,
      'latitude': latitude,
      'longitude': longitude,
    };
  }

  factory ServiceLocationSelection.fromJson(Map<String, dynamic> json) {
    return ServiceLocationSelection(
      type: json['type'] as String? ?? 'saved',
      label: json['label'] as String? ?? 'Saved location',
      address: json['address'] as String? ?? '',
      city: json['city'] as String? ?? '',
      state: json['state'] as String? ?? '',
      country: json['country'] as String? ?? '',
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
    );
  }
}

class ServiceLocationStore {
  ServiceLocationStore._();

  static const _storageKey = 'active_service_location';

  static Future<void> save(ServiceLocationSelection selection) async {
    storage.write(_storageKey, jsonEncode(selection.toJson()));
  }

  /// Best-effort synchronous read — reflects whatever [storage] has primed
  /// so far. On native, that's only guaranteed after [loadAsync] (or
  /// [ensureLoaded]) has resolved at least once this app run; on web it's
  /// always immediately available (backed by `localStorage`).
  static ServiceLocationSelection? load() {
    final raw = storage.read(_storageKey);
    if (raw == null || raw.isEmpty) {
      return null;
    }

    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map) {
        return ServiceLocationSelection.fromJson(
          decoded.map((key, value) => MapEntry(key.toString(), value)),
        );
      }
    } catch (_) {}

    return null;
  }

  /// Primes native's on-disk cache (a no-op on web) then returns [load]'s
  /// result — use this for the first read after a screen mounts, so a
  /// previously-saved location survives an app restart instead of only
  /// reappearing after the next [save].
  static Future<ServiceLocationSelection?> loadAsync() async {
    await storage.ensureLoaded();
    return load();
  }

  static Future<void> clear() async {
    storage.remove(_storageKey);
  }
}
