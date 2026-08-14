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
    await _client.from('customer_profiles').upsert({
      'auth_user_id': authUserId,
      'first_name': payload.firstName,
      'last_name': payload.lastName,
      'date_of_birth': payload.dateOfBirth,
      'sex': payload.sex,
      'email': payload.email.trim().toLowerCase(),
      'phone_number': normalizePhoneNumber(payload.phoneNumber),
      'emergency_contact_number': normalizePhoneNumber(
        payload.emergencyContactNumber,
      ),
      'address_label': payload.addressLabel,
      'address_line_1': payload.addressLine1,
      'address_line_2': payload.addressLine2,
      'postcode': payload.postcode,
      'city': payload.city,
      'state': payload.state,
      'country': payload.country,
      'role': 'customer',
      'source': 'flutter_app',
    }, onConflict: 'phone_number');
  }
}
