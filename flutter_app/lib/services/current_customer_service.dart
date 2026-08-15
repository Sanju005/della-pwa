import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter/foundation.dart';

import 'demo_customer_auth_store.dart';

class CurrentCustomerProfile {
  const CurrentCustomerProfile({
    required this.firstName,
    required this.lastName,
    required this.avatarUrl,
  });

  final String firstName;
  final String lastName;
  final String avatarUrl;

  String get fullName => '$firstName $lastName'.trim();
}

class CurrentCustomerService {
  const CurrentCustomerService();

  SupabaseClient get _client => Supabase.instance.client;

  Future<CurrentCustomerProfile?> fetchCurrentCustomerProfile() async {
    final user = _client.auth.currentUser;

    if (user != null) {
      Map<String, dynamic>? customerRow;
      try {
        customerRow = await _client
            .from('customer_profiles')
            .select('first_name, last_name')
            .eq('id', user.id)
            .maybeSingle();
      } catch (error, stackTrace) {
        if (kDebugMode) {
          debugPrint('Current customer profile query failed: $error');
          debugPrintStack(stackTrace: stackTrace);
        }
      }

      final firstName =
          customerRow?['first_name']?.toString().trim() ?? '';
      final lastName =
          customerRow?['last_name']?.toString().trim() ?? '';

      if (firstName.isNotEmpty || lastName.isNotEmpty) {
        final profileRow = await _client
            .from('profiles')
            .select('avatar_url')
            .eq('id', user.id)
            .maybeSingle();
        return CurrentCustomerProfile(
          firstName: firstName.isNotEmpty ? firstName : 'Customer',
          lastName: lastName,
          avatarUrl: profileRow?['avatar_url']?.toString().trim() ?? '',
        );
      }

      final profileRow = await _client
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', user.id)
          .maybeSingle();

      final fullName = profileRow?['full_name']?.toString().trim() ?? '';
      if (fullName.isNotEmpty) {
        final parts = fullName.split(RegExp(r'\s+'));
        return CurrentCustomerProfile(
          firstName: parts.first,
          lastName: parts.length > 1 ? parts.skip(1).join(' ') : '',
          avatarUrl: profileRow?['avatar_url']?.toString().trim() ?? '',
        );
      }
    }

    final demoCustomer = DemoCustomerAuthStore.currentCustomer();
    final firstName = demoCustomer?['firstName']?.toString().trim() ?? '';
    final lastName = demoCustomer?['lastName']?.toString().trim() ?? '';

    if (firstName.isEmpty && lastName.isEmpty) {
      return null;
    }

    return CurrentCustomerProfile(
      firstName: firstName.isNotEmpty ? firstName : 'Customer',
      lastName: lastName,
      avatarUrl: '',
    );
  }
}
