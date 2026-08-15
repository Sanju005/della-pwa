import 'dart:convert';

import 'package:flutter/foundation.dart';

import 'customer_signup_draft_store_stub.dart'
    if (dart.library.html) 'service_location_store_web.dart' as storage;

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

  List<String> get searchTokens => [
        city,
        state,
        country,
      ]
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
    if (!kIsWeb) {
      return;
    }
    storage.write(_storageKey, jsonEncode(selection.toJson()));
  }

  static ServiceLocationSelection? load() {
    if (!kIsWeb) {
      return null;
    }

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

  static Future<void> clear() async {
    if (!kIsWeb) {
      return;
    }
    storage.remove(_storageKey);
  }
}
