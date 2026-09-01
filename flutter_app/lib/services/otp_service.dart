import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/config/app_config.dart';

/// Abstraction over OTP delivery/verification so the registration UI never
/// depends on how a code is actually sent or checked. Swap the implementation
/// (e.g. to a future TwilioOtpService) without touching any screen.
abstract class OtpService {
  Future<void> sendOtp(String normalizedPhone);
  Future<bool> verifyOtp(String normalizedPhone, String code);
}

/// Development-only stand-in: no SMS is sent, the only valid code is
/// [validCode]. Used only by the shared login screen's OTP-box step (see
/// [RealOtpService] for the server-verified path used by registration and
/// profile verification).
class DevelopmentOtpService implements OtpService {
  const DevelopmentOtpService();

  static const validCode = '123456';

  @override
  Future<void> sendOtp(String normalizedPhone) async {}

  @override
  Future<bool> verifyOtp(String normalizedPhone, String code) async {
    return code == validCode;
  }
}

/// Backend-verified OTP: the code is generated and checked server-side
/// (`/api/auth/otp/send` + `/api/auth/otp/verify`) — this class never decides
/// "correct" on its own, it only reports what the server decided. When a
/// Supabase session exists (profile verification), the server flips the
/// caller's own emailVerified/phoneVerified flag directly as a side effect
/// of a successful verify; when there's no session yet (registration), the
/// caller must instead pass [lastChallengeId] to the registration endpoint,
/// which redeems it server-side.
class RealOtpService implements OtpService {
  RealOtpService({required this.purpose})
    : assert(purpose == 'phone' || purpose == 'email');

  /// `'phone'` or `'email'`.
  final String purpose;

  /// Set by a successful [verifyOtp] call.
  String? lastChallengeId;

  @override
  Future<void> sendOtp(String target) async {
    final response = await http.post(
      Uri.parse('${AppConfig.appBaseUrl}/api/auth/otp/send'),
      headers: await _headers(),
      body: jsonEncode({'purpose': purpose, 'target': target}),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        _readError(response.body) ?? 'Unable to send verification code.',
      );
    }
  }

  @override
  Future<bool> verifyOtp(String target, String code) async {
    final response = await http.post(
      Uri.parse('${AppConfig.appBaseUrl}/api/auth/otp/verify'),
      headers: await _headers(),
      body: jsonEncode({'purpose': purpose, 'target': target, 'code': code}),
    );

    Map<String, dynamic>? body;
    try {
      final decoded = jsonDecode(response.body.isEmpty ? '{}' : response.body);
      if (decoded is Map<String, dynamic>) {
        body = decoded;
      }
    } catch (_) {
      body = null;
    }

    if (response.statusCode < 200 ||
        response.statusCode >= 300 ||
        body == null) {
      return false;
    }

    lastChallengeId = body['challengeId'] as String?;
    return body['verified'] == true;
  }

  Future<Map<String, String>> _headers() async {
    final headers = <String, String>{'Content-Type': 'application/json'};
    final accessToken =
        Supabase.instance.client.auth.currentSession?.accessToken;
    if (accessToken != null && accessToken.isNotEmpty) {
      headers['Authorization'] = 'Bearer $accessToken';
    }
    return headers;
  }

  String? _readError(String body) {
    try {
      final decoded = jsonDecode(body.isEmpty ? '{}' : body);
      if (decoded is Map && decoded['error'] is String) {
        return decoded['error'] as String;
      }
    } catch (_) {
      // fall through
    }
    return null;
  }
}
