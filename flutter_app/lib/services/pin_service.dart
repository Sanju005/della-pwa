import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/config/app_config.dart';
import 'device_identity_service.dart';
import 'push_notification_service.dart';

/// Backend calls for the Swiper Security PIN — creating/changing one while
/// signed in, and the "forgot PIN" recovery path. Login-time PIN
/// verification itself is not here; that's folded into the phone-login
/// endpoints in [AuthService], since the PIN there is one input among
/// several (device id, challengeId) the login call already sends.
class PinService {
  const PinService();

  String? get _accessToken =>
      Supabase.instance.client.auth.currentSession?.accessToken;

  Map<String, String> _authHeaders() => {
    'Content-Type': 'application/json',
    if (_accessToken != null) 'Authorization': 'Bearer $_accessToken',
  };

  Object? _decode(String body) {
    if (body.isEmpty) {
      return null;
    }
    try {
      return jsonDecode(body);
    } catch (_) {
      return null;
    }
  }

  String _readError(Object? body, {String fallback = 'Something went wrong.'}) {
    if (body is Map<String, dynamic> && body['error'] is String) {
      return body['error'] as String;
    }
    return fallback;
  }

  Future<Map<String, dynamic>> _deviceContext() async {
    const deviceIdentity = DeviceIdentityService();
    final deviceId = await deviceIdentity.getDeviceId();
    final deviceName = await deviceIdentity.getDeviceName();
    String? fcmToken;
    try {
      fcmToken = await PushNotificationService().getToken();
    } catch (_) {
      fcmToken = null;
    }
    return {
      'deviceId': deviceId,
      'deviceName': deviceName,
      'platform': deviceIdentity.platform,
      if (fcmToken != null) 'fcmToken': fcmToken,
    };
  }

  /// Creates the PIN for the first time, or changes an existing one
  /// (requires [currentPin] if one is already set — the backend enforces
  /// this regardless of what's passed). The current device is marked
  /// trusted server-side only after the PIN is saved successfully — see
  /// app/api/auth/pin/create/route.ts.
  Future<void> createOrChangePin({required String newPin, String? currentPin}) async {
    final deviceContext = await _deviceContext();
    final response = await http.post(
      Uri.parse('${AppConfig.appBaseUrl}/api/auth/pin/create'),
      headers: _authHeaders(),
      body: jsonEncode({
        'pin': newPin,
        if (currentPin != null) 'currentPin': currentPin,
        ...deviceContext,
      }),
    );

    final body = _decode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      if (kDebugMode) {
        debugPrint('Create/change PIN failed: ${response.statusCode} ${response.body}');
      }
      throw Exception(_readError(body, fallback: 'Unable to save your PIN.'));
    }
  }

  /// Step 2 of "forgot PIN" — after the phone OTP is verified, reveals the
  /// account's verified recovery email so the UI knows where to send the
  /// second OTP. Throws [AccountRecoveryRequiredException] if the account
  /// has no verified recovery email at all.
  Future<String> lookupRecoveryEmail({
    required String phoneCountryCode,
    required String phoneNumber,
    required String phoneChallengeId,
  }) async {
    final response = await http.post(
      Uri.parse('${AppConfig.appBaseUrl}/api/auth/pin/reset/lookup'),
      headers: _authHeaders(),
      body: jsonEncode({
        'phoneCountryCode': phoneCountryCode,
        'phoneNumber': phoneNumber,
        'phoneChallengeId': phoneChallengeId,
      }),
    );

    final body = _decode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      if (body is Map<String, dynamic> && body['accountRecoveryRequired'] == true) {
        throw const AccountRecoveryRequiredException();
      }
      throw Exception(_readError(body, fallback: 'Unable to look up recovery email.'));
    }

    return (body as Map<String, dynamic>)['email'] as String;
  }

  /// "Forgot PIN" — requires a fresh OTP challenge already redeemed for
  /// both the phone number and the account's verified recovery email.
  Future<void> resetPin({
    required String phoneCountryCode,
    required String phoneNumber,
    required String phoneChallengeId,
    required String emailChallengeId,
    required String newPin,
  }) async {
    final response = await http.post(
      Uri.parse('${AppConfig.appBaseUrl}/api/auth/pin/reset'),
      headers: _authHeaders(),
      body: jsonEncode({
        'phoneCountryCode': phoneCountryCode,
        'phoneNumber': phoneNumber,
        'phoneChallengeId': phoneChallengeId,
        'emailChallengeId': emailChallengeId,
        'newPin': newPin,
      }),
    );

    final body = _decode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      if (kDebugMode) {
        debugPrint('Reset PIN failed: ${response.statusCode} ${response.body}');
      }
      if (body is Map<String, dynamic> && body['accountRecoveryRequired'] == true) {
        throw const AccountRecoveryRequiredException();
      }
      throw Exception(_readError(body, fallback: 'Unable to reset your PIN.'));
    }
  }
}

extension PhoneChangeApi on PinService {
  /// Secure phone-number change: requires an authenticated session, the
  /// account's own Swiper PIN, proof of the CURRENT identity (either
  /// [currentPhoneChallengeId] or, for someone who's lost that phone,
  /// [currentEmailChallengeId] — exactly one must be supplied), and a fresh
  /// OTP to the NEW phone — never "verify the new number, replace the old
  /// one" (that would let anyone who receives one SMS on a new SIM take
  /// over a phone-number-keyed account).
  Future<String> changePhoneNumber({
    required String pin,
    String? currentPhoneChallengeId,
    String? currentEmailChallengeId,
    required String newPhoneCountryCode,
    required String newPhoneNumber,
    required String newPhoneChallengeId,
  }) async {
    assert(
      (currentPhoneChallengeId == null) != (currentEmailChallengeId == null),
      'Provide exactly one of currentPhoneChallengeId or currentEmailChallengeId.',
    );
    final response = await http.post(
      Uri.parse('${AppConfig.appBaseUrl}/api/profile/phone/change'),
      headers: _authHeaders(),
      body: jsonEncode({
        'pin': pin,
        if (currentPhoneChallengeId != null)
          'currentPhoneChallengeId': currentPhoneChallengeId,
        if (currentEmailChallengeId != null)
          'currentEmailChallengeId': currentEmailChallengeId,
        'newPhoneCountryCode': newPhoneCountryCode,
        'newPhoneNumber': newPhoneNumber,
        'newPhoneChallengeId': newPhoneChallengeId,
      }),
    );

    final body = _decode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(_readError(body, fallback: 'Unable to change phone number.'));
    }

    return (body as Map<String, dynamic>)['phone'] as String;
  }

  /// Fetches the account's own verified recovery email, for the "I don't
  /// have access to my current number" fallback in the phone-change flow.
  /// Only reachable with a valid session (the caller already passed the
  /// PIN step in the same flow), so it's safe to reveal here — unlike the
  /// anonymous login-recovery path, which reveals it only because phone
  /// ownership was separately proven by OTP.
  Future<String?> fetchPhoneChangeRecoveryEmail() async {
    final response = await http.get(
      Uri.parse('${AppConfig.appBaseUrl}/api/profile/phone/change/recovery-email'),
      headers: _authHeaders(),
    );

    final body = _decode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(_readError(body, fallback: 'Unable to check recovery email.'));
    }

    return (body as Map<String, dynamic>)['recoveryEmail'] as String?;
  }
}

/// Thrown when the account has no verified recovery email, so a PIN reset
/// cannot be done automatically — matches the backend's explicit refusal
/// to silently weaken security with an insecure fallback.
class AccountRecoveryRequiredException implements Exception {
  const AccountRecoveryRequiredException();
}
