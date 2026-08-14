import 'dart:convert';

import 'package:flutter/foundation.dart';

import 'customer_signup_service.dart';
import 'customer_signup_draft_store_stub.dart'
    if (dart.library.html) 'customer_signup_draft_store_web.dart' as storage;

class CustomerSignupDraftStore {
  CustomerSignupDraftStore._();

  static CustomerSignupPayload? _memoryDraft;
  static const String _storageKey = 'customer_signup_draft';

  static Future<void> save(CustomerSignupPayload payload) async {
    _memoryDraft = payload;
    if (!kIsWeb) {
      return;
    }

    storage.write(_storageKey, jsonEncode(payload.toJson()));
  }

  static CustomerSignupPayload? load() {
    if (_memoryDraft != null) {
      return _memoryDraft;
    }
    if (!kIsWeb) {
      return null;
    }

    final raw = storage.read(_storageKey);
    if (raw == null || raw.isEmpty) {
      return null;
    }

    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map<String, dynamic>) {
        return null;
      }
      final payload = CustomerSignupPayload.fromJson(decoded);
      _memoryDraft = payload;
      return payload;
    } catch (_) {
      return null;
    }
  }

  static Future<void> clear() async {
    _memoryDraft = null;
    if (!kIsWeb) {
      return;
    }

    storage.remove(_storageKey);
  }
}
