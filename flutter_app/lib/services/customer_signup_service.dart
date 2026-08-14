import 'package:supabase_flutter/supabase_flutter.dart';

class CustomerSignupPayload {
  const CustomerSignupPayload({
    required this.firstName,
    required this.lastName,
    required this.dateOfBirth,
    required this.sex,
    required this.email,
    required this.phoneNumber,
    required this.emergencyContactNumber,
    required this.password,
    required this.confirmPassword,
    required this.addressLabel,
    required this.addressLine1,
    required this.addressLine2,
    required this.postcode,
    required this.city,
    required this.state,
    required this.country,
  });

  final String firstName;
  final String lastName;
  final String dateOfBirth;
  final String sex;
  final String email;
  final String phoneNumber;
  final String emergencyContactNumber;
  final String password;
  final String confirmPassword;
  final String addressLabel;
  final String addressLine1;
  final String addressLine2;
  final String postcode;
  final String city;
  final String state;
  final String country;

  Map<String, dynamic> toJson() {
    return {
      'firstName': firstName,
      'lastName': lastName,
      'dateOfBirth': dateOfBirth,
      'sex': sex,
      'email': email,
      'phoneNumber': phoneNumber,
      'emergencyContactNumber': emergencyContactNumber,
      'password': password,
      'confirmPassword': confirmPassword,
      'addressLabel': addressLabel,
      'addressLine1': addressLine1,
      'addressLine2': addressLine2,
      'postcode': postcode,
      'city': city,
      'state': state,
      'country': country,
    };
  }
}

class CustomerSignupService {
  const CustomerSignupService();

  SupabaseClient get _client => Supabase.instance.client;

  Future<void> registerCustomer(CustomerSignupPayload payload) async {
    if (payload.password != payload.confirmPassword) {
      throw Exception('Passwords do not match.');
    }

    final response = await _client.auth.signUp(
      email: payload.email,
      password: payload.password,
      data: payload.toJson(),
    );

    final user = response.user;
    if (user == null) {
      throw Exception('Unable to create your account.');
    }

    await _client.from('profiles').upsert({
      'id': user.id,
      'email': payload.email,
      'first_name': payload.firstName,
      'last_name': payload.lastName,
      'phone_number': payload.phoneNumber,
      'role': 'customer',
    });

    if (response.session != null) {
      await _client.auth.signOut();
    }

    if (response.user != null) {
      return;
    }

    throw Exception('Unable to create your account.');
  }
}
