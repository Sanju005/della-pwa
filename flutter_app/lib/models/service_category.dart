import 'package:flutter/material.dart';

class ServiceCategory {
  const ServiceCategory({
    required this.label,
    required this.icon,
    this.key = '',
    this.description = '',
  });

  final String label;
  final IconData icon;

  /// Lowercase service key matching `provider_services.service_type` /
  /// the `service` query param on `GET /api/providers` (e.g. `'chef'`).
  /// Falls back to `label.toLowerCase()` when empty (existing callers that
  /// built a [ServiceCategory] before this field existed still work).
  final String key;
  final String description;

  String get serviceKey => key.isNotEmpty ? key : label.toLowerCase();
}
