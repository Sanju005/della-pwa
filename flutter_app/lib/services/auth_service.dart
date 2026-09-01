import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/config/app_config.dart';
import 'demo_customer_auth_store.dart';

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

    return getCurrentUserRole();
  }

  /// Signs a returning provider in using just their phone number. Providers
  /// never see/choose a password (a random one is generated once at
  /// registration), so this can't be a normal password prompt — the caller
  /// (the login screen) must already have checked the phone-OTP locally
  /// (same dev-mode check used at registration) before calling this. The
  /// backend resets the matched account's password to a fresh value it
  /// knows and hands it back here so we can sign in with it immediately;
  /// the password is never shown to the provider or stored anywhere.
  /// Throws [ProviderPhoneAccountNotFoundException] if no provider account
  /// exists for this phone number, so the caller can fall back to the
  /// customer demo-phone path.
  Future<String?> signInProviderWithVerifiedPhone({
    required String phoneCountryCode,
    required String phoneNumber,
  }) async {
    final uri = Uri.parse('${AppConfig.appBaseUrl}/api/provider/login/phone');
    final response = await http.post(
      uri,
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode({
        'phoneCountryCode': phoneCountryCode,
        'phoneNumber': phoneNumber,
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

    if (response.statusCode == 404 && body != null) {
      throw const ProviderPhoneAccountNotFoundException();
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
    return signInWithPhone(
      normalizedPhone: normalizedPhone,
      password: password,
    );
  }

  /// Signs a returning customer in using just their phone number — the real
  /// replacement for the old fake `signInWithDemoPhone`/`DemoCustomerAuthStore`
  /// path. Mirrors [signInProviderWithVerifiedPhone]'s exact trust model and
  /// backend contract (see /api/customer/login/phone), applied to customers:
  /// the caller must already have checked the phone-OTP locally before
  /// calling this. Throws [CustomerPhoneAccountNotFoundException] if no
  /// customer account exists for this phone number.
  Future<String?> signInCustomerWithVerifiedPhone({
    required String phoneCountryCode,
    required String phoneNumber,
  }) async {
    final uri = Uri.parse('${AppConfig.appBaseUrl}/api/customer/login/phone');
    final response = await http.post(
      uri,
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode({
        'phoneCountryCode': phoneCountryCode,
        'phoneNumber': phoneNumber,
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

    if (response.statusCode == 404 && body != null) {
      throw const CustomerPhoneAccountNotFoundException();
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
    return signInWithPhone(
      normalizedPhone: normalizedPhone,
      password: password,
    );
  }

  Future<String> signInWithDemoPhone({
    required String phoneNumber,
    required String otpCode,
  }) async {
    if (otpCode != '123456') {
      throw Exception('Use OTP code `123456` to continue.');
    }

    await DemoCustomerAuthStore.signInWithPhone(phoneNumber);
    return 'customer';
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
