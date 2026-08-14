import 'dart:convert';

import 'package:flutter/foundation.dart';

import 'customer_signup_draft_store_stub.dart'
    if (dart.library.html) 'customer_signup_draft_store_web.dart' as storage;
import 'customer_signup_service.dart';

class DemoCustomerAuthStore {
  DemoCustomerAuthStore._();

  static const String _customersKey = 'demo_customer_accounts';
  static const String _sessionKey = 'demo_customer_session';

  static Map<String, dynamic>? _session;
  static List<Map<String, dynamic>> _customers = <Map<String, dynamic>>[];
  static bool _loaded = false;

  static void _ensureLoaded() {
    if (_loaded) {
      return;
    }
    _loaded = true;
    if (!kIsWeb) {
      return;
    }

    final customersRaw = storage.read(_customersKey);
    if (customersRaw != null && customersRaw.isNotEmpty) {
      try {
        final decoded = jsonDecode(customersRaw);
        if (decoded is List) {
          _customers = decoded
              .whereType<Map>()
              .map(
                (item) => item.map(
                  (key, value) => MapEntry(key.toString(), value),
                ),
              )
              .toList();
        }
      } catch (_) {}
    }

    final sessionRaw = storage.read(_sessionKey);
    if (sessionRaw != null && sessionRaw.isNotEmpty) {
      try {
        final decoded = jsonDecode(sessionRaw);
        if (decoded is Map) {
          _session = decoded.map(
            (key, value) => MapEntry(key.toString(), value),
          );
        }
      } catch (_) {}
    }
  }

  static void _persistCustomers() {
    if (!kIsWeb) {
      return;
    }
    storage.write(_customersKey, jsonEncode(_customers));
  }

  static void _persistSession() {
    if (!kIsWeb) {
      return;
    }
    if (_session == null) {
      storage.remove(_sessionKey);
      return;
    }
    storage.write(_sessionKey, jsonEncode(_session));
  }

  static String normalizePhone(String value) {
    final digits = value.replaceAll(RegExp(r'\D'), '');
    if (digits.startsWith('60')) {
      return digits;
    }
    return '60$digits';
  }

  static Future<void> saveCustomer(CustomerSignupPayload payload) async {
    _ensureLoaded();
    final normalizedPhone = normalizePhone(payload.phoneNumber);
    final record = {
      ...payload.toJson(),
      'phoneNumber': normalizedPhone,
      'role': 'customer',
    };

    _customers.removeWhere(
      (item) => normalizePhone('${item['phoneNumber'] ?? ''}') == normalizedPhone,
    );
    _customers.add(record);
    _persistCustomers();
  }

  static bool hasCustomer(String phoneNumber) {
    _ensureLoaded();
    final normalizedPhone = normalizePhone(phoneNumber);
    return _customers.any(
      (item) => normalizePhone('${item['phoneNumber'] ?? ''}') == normalizedPhone,
    );
  }

  static Future<void> signInWithPhone(String phoneNumber) async {
    _ensureLoaded();
    final normalizedPhone = normalizePhone(phoneNumber);
    final customer = _customers.cast<Map<String, dynamic>?>().firstWhere(
      (item) => item != null &&
          normalizePhone('${item['phoneNumber'] ?? ''}') == normalizedPhone,
      orElse: () => null,
    );

    if (customer == null) {
      throw Exception('No demo customer account found for this phone number.');
    }

    _session = {
      'role': 'customer',
      'phoneNumber': normalizedPhone,
      'email': customer['email'],
    };
    _persistSession();
  }

  static String? currentRole() {
    _ensureLoaded();
    final role = _session?['role'];
    return role is String ? role : null;
  }

  static Map<String, dynamic>? currentCustomer() {
    _ensureLoaded();
    final sessionPhone = _session?['phoneNumber'];
    if (sessionPhone is! String || sessionPhone.isEmpty) {
      return null;
    }

    final normalizedPhone = normalizePhone(sessionPhone);
    for (final customer in _customers) {
      if (normalizePhone('${customer['phoneNumber'] ?? ''}') ==
          normalizedPhone) {
        return customer;
      }
    }

    return null;
  }

  static Future<void> clearSession() async {
    _ensureLoaded();
    _session = null;
    _persistSession();
  }
}
