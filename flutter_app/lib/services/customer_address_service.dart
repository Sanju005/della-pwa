import 'package:supabase_flutter/supabase_flutter.dart';

import 'customer_account_service.dart';

class CustomerAddressInput {
  const CustomerAddressInput({
    required this.label,
    required this.line1,
    required this.line2,
    required this.city,
    required this.state,
    required this.postcode,
    required this.country,
    this.isDefault = false,
  });

  final String label;
  final String line1;
  final String line2;
  final String city;
  final String state;
  final String postcode;
  final String country;
  final bool isDefault;
}

class CustomerAddressService {
  const CustomerAddressService();

  SupabaseClient get _client => Supabase.instance.client;

  Future<List<CustomerAddressSummary>> fetchAddresses() async {
    final user = _client.auth.currentUser;
    if (user == null) {
      return const [];
    }

    final rows = await _client
        .from('addresses')
        .select(
          'label, address_line_1, address_line_2, city, state, postcode, country, is_default',
        )
        .eq('user_id', user.id)
        .order('is_default', ascending: false)
        .order('label', ascending: true);

    return (rows as List<dynamic>).map((row) {
      final data = row as Map<String, dynamic>;
      return CustomerAddressSummary(
        label: data['label']?.toString().trim() ?? 'Address',
        line1: data['address_line_1']?.toString().trim() ?? '',
        line2: data['address_line_2']?.toString().trim() ?? '',
        city: data['city']?.toString().trim() ?? '',
        state: data['state']?.toString().trim() ?? '',
        postcode: data['postcode']?.toString().trim() ?? '',
        country: data['country']?.toString().trim() ?? 'Malaysia',
        isDefault: data['is_default'] == true,
      );
    }).toList();
  }

  Future<void> saveAddress(CustomerAddressInput input) async {
    final user = _client.auth.currentUser;
    if (user == null) {
      throw Exception('Please log in first.');
    }

    if (input.isDefault) {
      await _client
          .from('addresses')
          .update({'is_default': false})
          .eq('user_id', user.id);
    }

    await _client.from('addresses').upsert({
      'user_id': user.id,
      'label': input.label,
      'address_line_1': input.line1,
      'address_line_2': input.line2.isEmpty ? null : input.line2,
      'city': input.city,
      'state': input.state,
      'postcode': input.postcode,
      'country': input.country,
      'is_default': input.isDefault,
    }, onConflict: 'user_id,label');
  }

  Future<void> setDefaultAddress(String label) async {
    final user = _client.auth.currentUser;
    if (user == null) {
      throw Exception('Please log in first.');
    }

    await _client
        .from('addresses')
        .update({'is_default': false})
        .eq('user_id', user.id);

    await _client
        .from('addresses')
        .update({'is_default': true})
        .eq('user_id', user.id)
        .eq('label', label);
  }
}
