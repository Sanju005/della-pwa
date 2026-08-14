import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../models/provider_summary.dart';
import 'customer_signup_draft_store_stub.dart'
    if (dart.library.html) 'customer_signup_draft_store_web.dart' as storage;

class ProviderDirectoryStore {
  ProviderDirectoryStore._();

  static const String _providersKey = 'registered_providers';
  static List<ProviderSummary> _providers = <ProviderSummary>[];
  static bool _loaded = false;

  static void _ensureLoaded() {
    if (_loaded) {
      return;
    }
    _loaded = true;
    if (!kIsWeb) {
      return;
    }

    final raw = storage.read(_providersKey);
    if (raw == null || raw.isEmpty) {
      return;
    }

    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List) {
        return;
      }
      _providers = decoded
          .whereType<Map>()
          .map(
            (item) => item.map(
              (key, value) => MapEntry(key.toString(), value),
            ),
          )
          .map(ProviderSummary.fromJson)
          .toList();
    } catch (_) {}
  }

  static void _persist() {
    if (!kIsWeb) {
      return;
    }
    storage.write(
      _providersKey,
      jsonEncode(_providers.map((provider) => provider.toJson()).toList()),
    );
  }

  static List<ProviderSummary> getProviders() {
    _ensureLoaded();
    return List.unmodifiable(_providers);
  }

  static Future<void> saveProvider(ProviderSummary provider) async {
    _ensureLoaded();
    _providers.removeWhere(
      (item) => item.name == provider.name && item.location == provider.location,
    );
    _providers.insert(0, provider);
    _persist();
  }
}
