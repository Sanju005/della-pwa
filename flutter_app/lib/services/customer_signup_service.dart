import 'dart:convert';

import 'package:http/http.dart' as http;

import '../core/config/app_config.dart';

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

  Future<void> registerCustomer(CustomerSignupPayload payload) async {
    final uri = Uri.parse('${AppConfig.appBaseUrl}/api/auth/register/customer');
    final response = await http.post(
      uri,
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode(payload.toJson()),
    );

    final dynamic body = response.body.isEmpty
        ? null
        : jsonDecode(response.body);
    if (response.statusCode >= 200 &&
        response.statusCode < 300 &&
        body is Map<String, dynamic> &&
        body['success'] == true) {
      return;
    }

    if (body is Map<String, dynamic> && body['error'] is String) {
      throw Exception(body['error'] as String);
    }

    throw Exception('Unable to create your account.');
  }
}
