import 'package:supabase_flutter/supabase_flutter.dart';

import 'demo_customer_auth_store.dart';

class CurrentCustomerProfile {
  const CurrentCustomerProfile({
    required this.firstName,
    required this.lastName,
  });

  final String firstName;
  final String lastName;

  String get fullName => '$firstName $lastName'.trim();
}

class CurrentCustomerService {
  const CurrentCustomerService();

  SupabaseClient get _client => Supabase.instance.client;

  Future<CurrentCustomerProfile?> fetchCurrentCustomerProfile() async {
    final user = _client.auth.currentUser;

    if (user != null) {
      final customerRow = await _client
          .from('customer_profiles')
          .select('first_name, last_name')
          .eq('id', user.id)
          .maybeSingle();

      final firstName =
          customerRow?['first_name']?.toString().trim() ?? '';
      final lastName =
          customerRow?['last_name']?.toString().trim() ?? '';

      if (firstName.isNotEmpty || lastName.isNotEmpty) {
        return CurrentCustomerProfile(
          firstName: firstName.isNotEmpty ? firstName : 'Customer',
          lastName: lastName,
        );
      }

      final profileRow = await _client
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle();

      final fullName = profileRow?['full_name']?.toString().trim() ?? '';
      if (fullName.isNotEmpty) {
        final parts = fullName.split(RegExp(r'\s+'));
        return CurrentCustomerProfile(
          firstName: parts.first,
          lastName: parts.length > 1 ? parts.skip(1).join(' ') : '',
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
    );
  }
}
