import 'dart:convert';

import 'package:http/http.dart' as http;

import '../core/config/app_config.dart';

class CustomerSignupPayload {
  const CustomerSignupPayload({
    required this.firstName,
    required this.lastName,
    required this.dateOfBirth,
    required this.sex,
    required this.phoneCountryCode,
    required this.phoneNumber,
    this.avatarDataUrl = '',
  });

  final String firstName;
  final String lastName;
  final String dateOfBirth;
  final String sex;
  final String phoneCountryCode;
  final String phoneNumber;
  final String avatarDataUrl;

  Map<String, dynamic> toJson() {
    return {
      'firstName': firstName,
      'lastName': lastName,
      'dateOfBirth': dateOfBirth,
      'sex': sex,
      'phoneCountryCode': phoneCountryCode,
      'phoneNumber': phoneNumber,
      'avatarDataUrl': avatarDataUrl,
    };
  }
}

/// Thrown when the backend rejects registration because a customer account
/// already exists for this phone number (see the duplicate-phone check in
/// app/api/auth/register/customer/route.ts).
class CustomerPhoneAlreadyRegisteredException implements Exception {
  const CustomerPhoneAlreadyRegisteredException();
}

/// The backend generates and returns a one-time password here — the
/// customer never sees or types one — so the caller can immediately sign in
/// with [AuthService.signInWithPhone]. Same trust boundary already used by
/// the returning-customer phone-login flow.
class CustomerRegistrationResult {
  const CustomerRegistrationResult({
    required this.normalizedPhone,
    required this.password,
  });

  final String normalizedPhone;
  final String password;
}

class CustomerSignupService {
  const CustomerSignupService();

  /// [phoneVerificationChallengeId] is the id returned by a successful
  /// `RealOtpService.verifyOtp` call — proof the phone was actually
  /// server-verified. The backend redeems it itself; a missing or stale id
  /// just means the account is created with phoneVerified left false, it
  /// never fails registration outright.
  Future<CustomerRegistrationResult> registerCustomer(
    CustomerSignupPayload payload, {
    String? phoneVerificationChallengeId,
  }) async {
    final uri = Uri.parse('${AppConfig.appBaseUrl}/api/auth/register/customer');
    final response = await http.post(
      uri,
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode({
        ...payload.toJson(),
        if (phoneVerificationChallengeId != null)
          'phoneVerificationChallengeId': phoneVerificationChallengeId,
      }),
    );

    Map<String, dynamic>? body;
    if (response.body.isNotEmpty) {
      try {
        final decoded = jsonDecode(response.body);
        if (decoded is Map<String, dynamic>) {
          body = decoded;
        }
      } catch (_) {
        body = null;
      }
    }

    if (response.statusCode == 409) {
      throw const CustomerPhoneAlreadyRegisteredException();
    }

    if (response.statusCode >= 200 &&
        response.statusCode < 300 &&
        body != null &&
        body['success'] == true) {
      return CustomerRegistrationResult(
        normalizedPhone: body['phone'] as String,
        password: body['password'] as String,
      );
    }

    if (body != null && body['error'] is String) {
      throw Exception(body['error'] as String);
    }

    throw Exception(
      'Unable to create your account. Signup API returned ${response.statusCode}.',
    );
  }
}
