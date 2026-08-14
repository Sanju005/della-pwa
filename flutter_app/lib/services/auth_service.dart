import 'package:supabase_flutter/supabase_flutter.dart';

class AuthService {
  const AuthService();

  SupabaseClient get _client => Supabase.instance.client;

  Future<String?> getCurrentUserRole() async {
    final user = _client.auth.currentUser;
    if (user == null) {
      return null;
    }

    final result = await _client
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

    if (result == null) {
      return null;
    }

    final role = result['role'];
    return role is String ? role : null;
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

  bool isProviderRole(String? role) {
    return role == 'provider' || role == 'service_provider';
  }
}
