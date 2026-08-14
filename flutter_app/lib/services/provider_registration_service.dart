import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/config/app_config.dart';

class ProviderRegistrationResult {
  const ProviderRegistrationResult({
    required this.id,
    required this.status,
    required this.phoneVerified,
    required this.emailVerified,
    required this.identityVerified,
    required this.verificationSetupFailed,
  });

  final String id;
  final String status;
  final bool phoneVerified;
  final bool emailVerified;
  final bool identityVerified;
  final bool verificationSetupFailed;

  factory ProviderRegistrationResult.fromJson(Map<String, dynamic> json) {
    return ProviderRegistrationResult(
      id: json['id'] as String? ?? '',
      status: json['status'] as String? ?? '',
      phoneVerified: json['phoneVerified'] as bool? ?? false,
      emailVerified: json['emailVerified'] as bool? ?? false,
      identityVerified: json['identityVerified'] as bool? ?? false,
      verificationSetupFailed:
          json['verificationSetupFailed'] as bool? ?? false,
    );
  }
}

class ProviderRegistrationService {
  const ProviderRegistrationService();

  Future<ProviderRegistrationResult> registerProvider(
    Map<String, dynamic> payload,
  ) async {
    final uri = Uri.parse('${AppConfig.appBaseUrl}/api/provider/register');
    final response = await http.post(
      uri,
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode(payload),
    );

    final body = _decodeBody(response.body);
    if (response.statusCode >= 200 &&
        response.statusCode < 300 &&
        body is Map<String, dynamic> &&
        body['id'] is String) {
      return ProviderRegistrationResult.fromJson(body);
    }

    throw Exception(_readError(body, response.statusCode));
  }

  Future<void> submitIdentityVerification(
    Map<String, dynamic> payload,
  ) async {
    final accessToken = Supabase.instance.client.auth.currentSession?.accessToken;
    if (accessToken == null || accessToken.isEmpty) {
      throw Exception('Your provider session expired. Please log in again.');
    }

    final uri = Uri.parse('${AppConfig.appBaseUrl}/api/provider/me');
    final response = await http.patch(
      uri,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
      body: jsonEncode(payload),
    );

    final body = _decodeBody(response.body);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return;
    }

    throw Exception(_readError(body, response.statusCode));
  }

  Object? _decodeBody(String body) {
    if (body.isEmpty) {
      return null;
    }

    try {
      return jsonDecode(body);
    } catch (_) {
      return null;
    }
  }

  String _readError(Object? body, int statusCode) {
    if (body is Map<String, dynamic>) {
      final error = body['error'];
      if (error is String && error.trim().isNotEmpty) {
        return error;
      }

      final detail = body['detail'];
      if (detail is String && detail.trim().isNotEmpty) {
        return detail;
      }
    }

    return 'Unable to complete provider registration. API returned $statusCode.';
  }
}
