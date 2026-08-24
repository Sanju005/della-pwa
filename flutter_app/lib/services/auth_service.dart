import 'package:supabase_flutter/supabase_flutter.dart';

import 'demo_customer_auth_store.dart';

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
          'marketing_name': legacyProvider['marketing_name']
              ?.toString()
              .trim(),
          'country': legacyProvider['country']?.toString().trim(),
          'emergency_contact_number': legacyProvider['emergency_contact_number']
              ?.toString()
              .trim(),
        },
      );

      final sessionUser =
          signUpResponse.user ?? _client.auth.currentUser;
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

  Future<Map<String, dynamic>?> _findLegacyProviderByEmail(
    String email,
  ) async {
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
    final phoneNumber =
        legacyProvider['phone_number']?.toString().trim() ?? '';
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
      await _client.from('provider_profiles').update({
        'id': userId,
        'role': isProviderRole(role) ? role : 'provider',
        'email': email,
      }).eq('email', email);
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
