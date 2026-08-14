import 'package:supabase_flutter/supabase_flutter.dart';

import 'demo_customer_auth_store.dart';

class AuthService {
  const AuthService();

  SupabaseClient get _client => Supabase.instance.client;

  Future<String?> getCurrentUserRole() async {
    final user = _client.auth.currentUser;
    if (user != null) {
      final result = await _client
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

      if (result != null) {
        final role = result['role'];
        if (role is String) {
          return role;
        }
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
    final response = await _client.auth.signInWithPassword(
      email: email,
      password: password,
    );

    if (response.user == null) {
      return null;
    }

    return getCurrentUserRole();
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
}
