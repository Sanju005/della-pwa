import 'local_notification_service.dart';
import 'push_notification_service.dart';
import 'device_identity_service.dart';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/config/app_config.dart';
import 'demo_customer_auth_store.dart';

/// Debug-build-only visibility into a phone-login response, for real-device
/// testing. Only ever logs the response's boolean flags — never the
/// password, PIN, or OTP code that may also be in [body]. A no-op in any
/// release build (kDebugMode is compiled out entirely, not just false).
void _debugLogPhoneLoginResponse(String route, Map<String, dynamic>? body) {
  if (!kDebugMode || body == null) {
    return;
  }
  debugPrint(
    '[AuthDebug] $route -> success=${body['success'] == true} '
    'requiresPin=${body['requiresPin'] == true} '
    'pinFailed=${body['pinFailed'] == true} '
    'accountRecoveryRequired=${body['accountRecoveryRequired'] == true} '
    'pinSetupRequired=${body['pinSetupRequired'] == true} '
    'pinSetupMandatory=${body['pinSetupMandatory'] == true}',
  );
}

/// Thrown by [AuthService.signInProviderWithVerifiedPhone] when no provider
/// account exists for the given phone number, so callers (the login screen)
/// can fall back to the real customer phone-login path instead of surfacing
/// a confusing "provider login failed" message for what might just be a
/// customer signing in.
class ProviderPhoneAccountNotFoundException implements Exception {
  const ProviderPhoneAccountNotFoundException();
}

/// Thrown by [AuthService.signInCustomerWithVerifiedPhone] when no customer
/// account exists for the given phone number.
class CustomerPhoneAccountNotFoundException implements Exception {
  const CustomerPhoneAccountNotFoundException();
}

/// Thrown when phone OTP alone was not enough — this device has never been
/// trusted for this account, and the account already has a Swiper PIN, so
/// the caller must collect a PIN and retry the same sign-in call with it.
/// This is the exception that makes the recycled-number attack fail: an
/// attacker who receives the SMS but doesn't know the PIN gets stuck here.
class PhoneLoginPinRequiredException implements Exception {
  const PhoneLoginPinRequiredException();
}

/// Thrown when a supplied PIN was wrong. Distinct from a generic Exception
/// so the PIN-entry step can retry in place (like OtpStepView does for a
/// wrong code) instead of resetting the whole login flow.
class PhoneLoginPinIncorrectException implements Exception {
  const PhoneLoginPinIncorrectException(this.message);
  final String message;

  @override
  String toString() => message;
}

/// Thrown for Case B: an unknown device signing into an account that has no
/// Swiper PIN yet. Phone OTP alone is never enough here — this is exactly
/// the recycled-number scenario, so no session and no device trust are
/// granted. [recoveryEmail] is the account's own verified recovery email,
/// revealed only because phone ownership was already proven by the OTP
/// that got the caller this far; it's null when the account has no
/// verified recovery email at all, meaning there is no self-service path
/// and manual account recovery is required.
class AccountRecoveryRequiredException implements Exception {
  const AccountRecoveryRequiredException({this.recoveryEmail});
  final String? recoveryEmail;
}

/// The result of a successful phone-login call.
///
/// [pinSetupRequired] + [pinSetupMandatory] both true = Case A: this was
/// already a trusted device, but the account predates the PIN system —
/// the caller MUST show a non-skippable Create PIN screen right after this
/// returns, before any other navigation. [pinSetupRequired] true with
/// [pinSetupMandatory] false doesn't currently occur (kept distinct from
/// the mandatory case so a future soft-prompt path has somewhere to live
/// without another shape change).
typedef PhoneLoginResult = ({
  String? role,
  bool pinSetupRequired,
  bool pinSetupMandatory,
});

/// The shape of [AuthService.signInProviderWithVerifiedPhone] /
/// [AuthService.signInCustomerWithVerifiedPhone] — captured as a value so
/// the login screen can pick the right one (provider vs customer) once and
/// have both the PIN step and [AccountRecoveryRequiredException] handling
/// retry the exact same call with different follow-up fields.
typedef PendingPhoneSignIn =
    Future<PhoneLoginResult> Function({
      String? pin,
      String? emailChallengeId,
      String? newPin,
    });

class AuthService {
  const AuthService();

  SupabaseClient get _client => Supabase.instance.client;

  Future<String?> getCurrentUserRole() async {
    final user = _client.auth.currentUser;
    if (user != null) {
      final role = await _getRoleFromAppTables(user);
      if (role != null) {
        return role;
      }
    }

    final demoRole = DemoCustomerAuthStore.currentRole();
    if (demoRole != null) {
      return demoRole;
    }

    return null;
  }

  Future<String?> signIn({
    required String email,
    required String password,
  }) async {
    try {
      final response = await _client.auth.signInWithPassword(
        email: email,
        password: password,
      );

      if (response.user == null) {
        return null;
      }

      await _completeSuccessfulLogin(response.user!);

      return getCurrentUserRole();
    } on AuthException catch (error) {
      if (!_isInvalidLoginCredentials(error)) {
        rethrow;
      }

      final recoveredRole = await _recoverLegacyProviderLogin(
        email: email,
        password: password,
      );
      if (recoveredRole != null) {
        return recoveredRole;
      }

      rethrow;
    }
  }

  /// Providers now register with a verified phone number as their Supabase
  /// Auth identifier — no email exists yet at that point. Used only right
  /// after registration to establish the session; the existing email+
  /// password [signIn] stays as-is for the regular login screen.
  Future<String?> signInWithPhone({
    required String normalizedPhone,
    required String password,
  }) async {
    final response = await _client.auth.signInWithPassword(
      phone: normalizedPhone,
      password: password,
    );

    if (response.user == null) {
      return null;
    }

    await _completeSuccessfulLogin(response.user!);

    return getCurrentUserRole();
  }

  /// Signs a returning provider in using their phone number. Providers never
  /// see/choose a password (a random one is generated once at registration),
  /// so this can't be a normal password prompt — the caller (the login
  /// screen) must first redeem a real, server-verified OTP challenge (see
  /// [RealOtpService]) and pass the resulting [challengeId], which the
  /// backend independently re-verifies before doing anything. The backend
  /// then resets the matched account's password to a fresh value it knows
  /// and hands it back here so we can sign in with it immediately; the
  /// password is never shown to the provider or stored anywhere.
  /// Throws [ProviderPhoneAccountNotFoundException] if no provider account
  /// exists for this phone number, so the caller can fall back to the
  /// customer login path.
  Future<PhoneLoginResult> signInProviderWithVerifiedPhone({
    required String phoneCountryCode,
    required String phoneNumber,
    required String challengeId,
    String? pin,
    String? emailChallengeId,
    String? newPin,
  }) async {
    final uri = Uri.parse('${AppConfig.appBaseUrl}/api/provider/login/phone');
    final deviceContext = await _deviceLoginContext();
    final response = await http.post(
      uri,
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode({
        'phoneCountryCode': phoneCountryCode,
        'phoneNumber': phoneNumber,
        'challengeId': challengeId,
        if (pin != null) 'pin': pin,
        if (emailChallengeId != null) 'emailChallengeId': emailChallengeId,
        if (newPin != null) 'newPin': newPin,
        ...deviceContext,
      }),
    );

    // The server should always answer with JSON, but a platform-level error
    // (a route that isn't deployed yet, a gateway timeout, ...) can hand
    // back an HTML error page instead — decode defensively so that shows up
    // as a normal "try again" message rather than the raw HTML crashing the
    // sign-in attempt.
    Map<String, dynamic>? body;
    try {
      final decoded = jsonDecode(response.body.isEmpty ? '{}' : response.body);
      if (decoded is Map<String, dynamic>) {
        body = decoded;
      }
    } catch (_) {
      body = null;
    }
    _debugLogPhoneLoginResponse('provider/login/phone', body);

    if (response.statusCode == 404 && body != null) {
      throw const ProviderPhoneAccountNotFoundException();
    }

    if (response.statusCode == 200 && body?['requiresPin'] == true) {
      throw const PhoneLoginPinRequiredException();
    }

    if (response.statusCode == 401 && body?['pinFailed'] == true) {
      throw PhoneLoginPinIncorrectException(
        body?['error']?.toString() ?? 'Incorrect PIN.',
      );
    }

    if (response.statusCode == 409 && body?['accountRecoveryRequired'] == true) {
      throw AccountRecoveryRequiredException(
        recoveryEmail: body?['recoveryEmail'] as String?,
      );
    }

    if (response.statusCode < 200 ||
        response.statusCode >= 300 ||
        body == null) {
      throw Exception(
        body?['error']?.toString() ??
            'Unable to sign in right now. Please try again.',
      );
    }

    final normalizedPhone = body['phone'] as String;
    final password = body['password'] as String;
    final pinSetupRequired = body['pinSetupRequired'] == true;
    final pinSetupMandatory = body['pinSetupMandatory'] == true;
    final role = await signInWithPhone(
      normalizedPhone: normalizedPhone,
      password: password,
    );
    return (
      role: role,
      pinSetupRequired: pinSetupRequired,
      pinSetupMandatory: pinSetupMandatory,
    );
  }

  /// Gathers the deviceId (stable, app-generated, never a hardware serial),
  /// a best-effort friendly device name, platform, and current FCM token —
  /// sent with every phone-login attempt so the backend can decide whether
  /// this device has been trusted for this account before.
  Future<Map<String, dynamic>> _deviceLoginContext() async {
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

  /// Signs a returning customer in using their phone number — the real
  /// replacement for the old fake `signInWithDemoPhone`/`DemoCustomerAuthStore`
  /// path. Mirrors [signInProviderWithVerifiedPhone]'s exact trust model and
  /// backend contract (see /api/customer/login/phone): the caller must first
  /// redeem a real, server-verified OTP challenge and pass the resulting
  /// [challengeId], which the backend independently re-verifies. Throws
  /// [CustomerPhoneAccountNotFoundException] if no customer account exists
  /// for this phone number.
  Future<PhoneLoginResult> signInCustomerWithVerifiedPhone({
    required String phoneCountryCode,
    required String phoneNumber,
    required String challengeId,
    String? pin,
    String? emailChallengeId,
    String? newPin,
  }) async {
    final uri = Uri.parse('${AppConfig.appBaseUrl}/api/customer/login/phone');
    final deviceContext = await _deviceLoginContext();
    final response = await http.post(
      uri,
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode({
        'phoneCountryCode': phoneCountryCode,
        'phoneNumber': phoneNumber,
        'challengeId': challengeId,
        if (pin != null) 'pin': pin,
        if (emailChallengeId != null) 'emailChallengeId': emailChallengeId,
        if (newPin != null) 'newPin': newPin,
        ...deviceContext,
      }),
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
    _debugLogPhoneLoginResponse('customer/login/phone', body);

    if (response.statusCode == 404 && body != null) {
      throw const CustomerPhoneAccountNotFoundException();
    }

    if (response.statusCode == 200 && body?['requiresPin'] == true) {
      throw const PhoneLoginPinRequiredException();
    }

    if (response.statusCode == 401 && body?['pinFailed'] == true) {
      throw PhoneLoginPinIncorrectException(
        body?['error']?.toString() ?? 'Incorrect PIN.',
      );
    }

    if (response.statusCode == 409 && body?['accountRecoveryRequired'] == true) {
      throw AccountRecoveryRequiredException(
        recoveryEmail: body?['recoveryEmail'] as String?,
      );
    }

    if (response.statusCode < 200 ||
        response.statusCode >= 300 ||
        body == null) {
      throw Exception(
        body?['error']?.toString() ??
            'Unable to sign in right now. Please try again.',
      );
    }

    final normalizedPhone = body['phone'] as String;
    final password = body['password'] as String;
    final pinSetupRequired = body['pinSetupRequired'] == true;
    final pinSetupMandatory = body['pinSetupMandatory'] == true;
    final role = await signInWithPhone(
      normalizedPhone: normalizedPhone,
      password: password,
    );
    return (
      role: role,
      pinSetupRequired: pinSetupRequired,
      pinSetupMandatory: pinSetupMandatory,
    );
  }


  /// Runs once, right after Supabase confirms a genuine, successful sign-in
  /// (never on app-startup session restore, since that path never calls
  /// this): registers this device's FCM token and shows the one-time
  /// local "Welcome back" notification.
  Future<void> _completeSuccessfulLogin(User user) async {
    await PushNotificationService().registerCurrentDevice();

    final name = (user.userMetadata?['full_name'] as String?)?.trim();
    await LocalNotificationService().showLoginWelcomeNotification(name);
  }

  bool isProviderRole(String? role) {
    return role == 'provider' || role == 'service_provider';
  }

  bool _isInvalidLoginCredentials(AuthException error) {
    final message = error.message.trim().toLowerCase();
    return message.contains('invalid login credentials');
  }

  Future<String?> _recoverLegacyProviderLogin({
    required String email,
    required String password,
  }) async {
    final normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail.isEmpty) {
      return null;
    }

    final legacyProvider = await _findLegacyProviderByEmail(normalizedEmail);
    if (legacyProvider == null) {
      return null;
    }

    try {
      final signUpResponse = await _client.auth.signUp(
        email: normalizedEmail,
        password: password,
        data: {
          'full_name': _legacyFullName(legacyProvider),
          'role': 'provider',
          'marketing_name': legacyProvider['marketing_name']?.toString().trim(),
          'country': legacyProvider['country']?.toString().trim(),
          'emergency_contact_number': legacyProvider['emergency_contact_number']
              ?.toString()
              .trim(),
        },
      );

      final sessionUser = signUpResponse.user ?? _client.auth.currentUser;
      if (sessionUser == null) {
        return null;
      }

      if (signUpResponse.session == null) {
        final retryResponse = await _client.auth.signInWithPassword(
          email: normalizedEmail,
          password: password,
        );
        if (retryResponse.user == null) {
          return null;
        }
      }

      await _bootstrapLegacyProviderProfile(
        userId: sessionUser.id,
        email: normalizedEmail,
        legacyProvider: legacyProvider,
      );

      await _completeSuccessfulLogin(sessionUser);

      return getCurrentUserRole();
    } on AuthException {
      return null;
    }
  }

  Future<Map<String, dynamic>?> _findLegacyProviderByEmail(String email) async {
    try {
      return await _client
          .from('provider_profiles')
          .select(
            'id, first_name, last_name, marketing_name, email, phone_number, emergency_contact_number, country, status, role',
          )
          .eq('email', email)
          .maybeSingle();
    } catch (_) {
      return null;
    }
  }

  String _legacyFullName(Map<String, dynamic> legacyProvider) {
    final firstName = legacyProvider['first_name']?.toString().trim() ?? '';
    final lastName = legacyProvider['last_name']?.toString().trim() ?? '';
    final marketingName =
        legacyProvider['marketing_name']?.toString().trim() ?? '';
    final fullName = '$firstName $lastName'.trim();
    if (fullName.isNotEmpty) {
      return fullName;
    }
    return marketingName;
  }

  Future<void> _bootstrapLegacyProviderProfile({
    required String userId,
    required String email,
    required Map<String, dynamic> legacyProvider,
  }) async {
    final role = legacyProvider['role']?.toString().trim();
    final status = legacyProvider['status']?.toString().trim();
    final phoneNumber = legacyProvider['phone_number']?.toString().trim() ?? '';
    final fullName = _legacyFullName(legacyProvider);

    try {
      await _client.from('profiles').upsert({
        'id': userId,
        'full_name': fullName,
        'email': email,
        'role': isProviderRole(role) ? role : 'provider',
        'phone': phoneNumber.isEmpty ? null : phoneNumber,
        'status': status?.isNotEmpty == true ? status : 'pending',
      }, onConflict: 'id');
    } catch (_) {}

    try {
      await _client
          .from('provider_profiles')
          .update({
            'id': userId,
            'role': isProviderRole(role) ? role : 'provider',
            'email': email,
          })
          .eq('email', email);
    } catch (_) {}
  }

  Future<String?> _getRoleFromAppTables(User user) async {
    final email = user.email?.trim().toLowerCase() ?? '';

    try {
      final customerById = await _client
          .from('customer_profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
      final customerRole = _readRole(customerById);
      if (customerRole != null) {
        return customerRole;
      }
    } catch (_) {}

    try {
      final customerByAuthUserId = await _client
          .from('customer_profiles')
          .select('role')
          .eq('auth_user_id', user.id)
          .maybeSingle();
      final customerRole = _readRole(customerByAuthUserId);
      if (customerRole != null) {
        return customerRole;
      }
    } catch (_) {}

    if (email.isNotEmpty) {
      try {
        final customerByEmail = await _client
            .from('customer_profiles')
            .select('role')
            .eq('email', email)
            .maybeSingle();
        final customerRole = _readRole(customerByEmail);
        if (customerRole != null) {
          return customerRole;
        }
      } catch (_) {}

      try {
        final providerByEmail = await _client
            .from('provider_profiles')
            .select('role')
            .eq('email', email)
            .maybeSingle();
        final providerRole = _readRole(providerByEmail);
        if (providerRole != null) {
          return providerRole;
        }
      } catch (_) {}
    }

    try {
      final legacyProfile = await _client
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
      return _readRole(legacyProfile);
    } catch (_) {
      return null;
    }
  }

  String? _readRole(Map<String, dynamic>? row) {
    if (row == null) {
      return null;
    }
    final role = row['role'];
    if (role is String && role.trim().isNotEmpty) {
      return role.trim();
    }
    return null;
  }
}
