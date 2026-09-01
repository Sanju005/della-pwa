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
    this.latitude,
    this.longitude,
  });

  final String label;
  final String line1;
  final String line2;
  final String city;
  final String state;
  final String postcode;
  final String country;
  final bool isDefault;
  final double? latitude;
  final double? longitude;
}

class CustomerAddressService {
  const CustomerAddressService();

  SupabaseClient get _client => Supabase.instance.client;

  Future<List<CustomerAddressSummary>> fetchAddresses() async {
    final user = _client.auth.currentUser;
    if (user == null) {
      return const [];
    }

    // latitude/longitude are a newer, optional pair of columns — fall back
    // to the older column list on any project where that migration hasn't
    // been applied yet, rather than breaking the whole addresses list.
    List<dynamic> rows;
    try {
      rows = await _client
          .from('addresses')
          .select(
            'label, address_line_1, address_line_2, city, state, postcode, country, is_default, latitude, longitude',
          )
          .eq('user_id', user.id)
          .order('is_default', ascending: false)
          .order('label', ascending: true);
    } catch (_) {
      rows = await _client
          .from('addresses')
          .select(
            'label, address_line_1, address_line_2, city, state, postcode, country, is_default',
          )
          .eq('user_id', user.id)
          .order('is_default', ascending: false)
          .order('label', ascending: true);
    }

    return rows.map((row) {
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
        latitude: (data['latitude'] as num?)?.toDouble(),
        longitude: (data['longitude'] as num?)?.toDouble(),
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

    final basePayload = {
      'user_id': user.id,
      'label': input.label,
      'address_line_1': input.line1,
      'address_line_2': input.line2.isEmpty ? null : input.line2,
      'city': input.city,
      'state': input.state,
      'postcode': input.postcode,
      'country': input.country,
      'is_default': input.isDefault,
    };

    // Doesn't use upsert(onConflict: ...) — that requires a unique
    // constraint on (user_id, label) that may not exist on every project's
    // addresses table (it predates this app's migrations). Looking up the
    // row first and choosing insert vs update works regardless.
    final existing = await _client
        .from('addresses')
        .select('id')
        .eq('user_id', user.id)
        .eq('label', input.label)
        .maybeSingle();
    final existingId = existing?['id'] as String?;

    Future<void> write(Map<String, dynamic> payload) {
      if (existingId != null) {
        return _client.from('addresses').update(payload).eq('id', existingId);
      }
      return _client.from('addresses').insert(payload);
    }

    try {
      await write({
        ...basePayload,
        'latitude': input.latitude,
        'longitude': input.longitude,
      });
    } catch (_) {
      // latitude/longitude columns aren't on this project yet — save
      // everything else rather than losing the whole address.
      await write(basePayload);
    }
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
