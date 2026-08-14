import 'package:supabase_flutter/supabase_flutter.dart';

import 'customer_signup_service.dart';
import 'phone_utils.dart';

class CustomerRecordService {
  const CustomerRecordService();

  SupabaseClient get _client => Supabase.instance.client;

  Future<void> upsertCustomerProfile(
    CustomerSignupPayload payload, {
    String? authUserId,
  }) async {
    if ((authUserId ?? '').isEmpty) {
      throw Exception('Customer auth user was not created yet.');
    }

    await _client.from('customer_profiles').upsert({
      'id': authUserId,
      'first_name': payload.firstName,
      'last_name': payload.lastName,
      'date_of_birth': payload.dateOfBirth,
      'sex': payload.sex,
      'city': payload.city,
      'region': payload.state,
      'state': payload.state,
      'country': payload.country,
      'phone_number': normalizePhoneNumber(payload.phoneNumber),
      'country_code': '+60',
      'emergency_contact_number': normalizePhoneNumber(
        payload.emergencyContactNumber,
      ),
      'verified': false,
      'updated_at': DateTime.now().toIso8601String(),
    }, onConflict: 'id');

    await _client.from('addresses').upsert({
      'user_id': authUserId,
      'label': payload.addressLabel,
      'address_line_1': payload.addressLine1,
      'address_line_2': payload.addressLine2.isEmpty ? null : payload.addressLine2,
      'city': payload.city,
      'state': payload.state,
      'postcode': payload.postcode,
      'country': payload.country,
      'is_default': true,
    }, onConflict: 'user_id,label');
  }
}
