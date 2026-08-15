import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/config/app_config.dart';
import '../models/provider_summary.dart';

class CustomerProfileApiModel {
  const CustomerProfileApiModel({
    required this.firstName,
    required this.lastName,
    required this.sex,
    required this.dateOfBirth,
    required this.avatarUrl,
    required this.email,
    required this.phoneNumber,
    required this.countryCode,
    required this.emergencyContactNumber,
    required this.city,
    required this.region,
    required this.country,
    required this.emailVerified,
    required this.phoneVerified,
    required this.identityVerificationStatus,
    required this.identityDocumentType,
    required this.identityFrontImageUrl,
    required this.identityBackImageUrl,
    required this.verified,
    required this.completion,
  });

  final String firstName;
  final String lastName;
  final String sex;
  final String dateOfBirth;
  final String avatarUrl;
  final String email;
  final String phoneNumber;
  final String countryCode;
  final String emergencyContactNumber;
  final String city;
  final String region;
  final String country;
  final bool emailVerified;
  final bool phoneVerified;
  final String identityVerificationStatus;
  final String? identityDocumentType;
  final String identityFrontImageUrl;
  final String identityBackImageUrl;
  final bool verified;
  final int completion;

  String get fullName =>
      [firstName, lastName].where((item) => item.trim().isNotEmpty).join(' ');

  factory CustomerProfileApiModel.fromJson(Map<String, dynamic> json) {
    return CustomerProfileApiModel(
      firstName: json['firstName'] as String? ?? '',
      lastName: json['lastName'] as String? ?? '',
      sex: json['sex'] as String? ?? '',
      dateOfBirth: json['dateOfBirth'] as String? ?? '',
      avatarUrl: json['avatarUrl'] as String? ?? '',
      email: json['email'] as String? ?? '',
      phoneNumber: json['phoneNumber'] as String? ?? '',
      countryCode: json['countryCode'] as String? ?? '+60',
      emergencyContactNumber: json['emergencyContactNumber'] as String? ?? '',
      city: json['city'] as String? ?? '',
      region: json['region'] as String? ?? '',
      country: json['country'] as String? ?? 'Malaysia',
      emailVerified: json['emailVerified'] == true,
      phoneVerified: json['phoneVerified'] == true,
      identityVerificationStatus:
          json['identityVerificationStatus'] as String? ?? 'pending',
      identityDocumentType: json['identityDocumentType'] as String?,
      identityFrontImageUrl: json['identityFrontImageUrl'] as String? ?? '',
      identityBackImageUrl: json['identityBackImageUrl'] as String? ?? '',
      verified: json['verified'] == true,
      completion: (json['completion'] as num?)?.round() ?? 80,
    );
  }
}

class CustomerProfileAddressModel {
  const CustomerProfileAddressModel({
    required this.id,
    required this.label,
    required this.line1,
    required this.line2,
    required this.city,
    required this.state,
    required this.isDefault,
    required this.kind,
  });

  final String id;
  final String label;
  final String line1;
  final String line2;
  final String city;
  final String state;
  final bool isDefault;
  final String kind;

  String get fullAddress {
    return [
      line1,
      line2,
      [city, state].where((item) => item.trim().isNotEmpty).join(', '),
    ].where((item) => item.trim().isNotEmpty).join('\n');
  }

  factory CustomerProfileAddressModel.fromJson(Map<String, dynamic> json) {
    return CustomerProfileAddressModel(
      id: json['id'] as String? ?? '',
      label: json['label'] as String? ?? 'Address',
      line1: json['line1'] as String? ?? '',
      line2: json['line2'] as String? ?? '',
      city: json['city'] as String? ?? '',
      state: json['state'] as String? ?? '',
      isDefault: json['isDefault'] == true,
      kind: json['kind'] as String? ?? 'other',
    );
  }
}

class CustomerPaymentHistoryModel {
  const CustomerPaymentHistoryModel({
    required this.id,
    required this.serviceCategory,
    required this.serviceTitle,
    required this.provider,
    required this.amount,
    required this.paidAt,
    required this.paymentMethod,
    required this.status,
  });

  final String id;
  final String serviceCategory;
  final String serviceTitle;
  final String provider;
  final double amount;
  final String paidAt;
  final String paymentMethod;
  final String status;

  factory CustomerPaymentHistoryModel.fromJson(Map<String, dynamic> json) {
    return CustomerPaymentHistoryModel(
      id: json['id'] as String? ?? '',
      serviceCategory: json['serviceCategory'] as String? ?? 'Service',
      serviceTitle: json['serviceTitle'] as String? ?? 'Service Payment',
      provider: json['provider'] as String? ?? 'DELLA Provider',
      amount: (json['amount'] as num?)?.toDouble() ?? 0,
      paidAt: json['paidAt'] as String? ?? '',
      paymentMethod: json['paymentMethod'] as String? ?? 'Cash',
      status: json['status'] as String? ?? 'paid',
    );
  }
}

class CustomerFavoriteProviderModel {
  const CustomerFavoriteProviderModel({
    required this.id,
    required this.name,
    required this.role,
    required this.initials,
    required this.serviceKey,
    required this.rating,
    required this.priceLabel,
    required this.portraitSrc,
  });

  final String id;
  final String name;
  final String role;
  final String initials;
  final String serviceKey;
  final double? rating;
  final String? priceLabel;
  final String portraitSrc;

  ProviderSummary toProviderSummary() {
    final serviceLabel = role.replaceFirst(RegExp(r'\s+Provider$', caseSensitive: false), '');
    return ProviderSummary(
      id: id,
      name: name,
      providerName: name,
      serviceKey: serviceKey,
      service: serviceLabel,
      hourlyRate: _parseHourlyRate(priceLabel),
      rating: rating ?? 4.8,
      reviewCount: 0,
      distanceLabel: 'Location unavailable',
      description: '',
      phoneVerified: false,
      identityVerified: false,
      isFavorite: true,
      location: 'Malaysia',
      specialties: const [],
      avatarUrl: portraitSrc,
    );
  }

  factory CustomerFavoriteProviderModel.fromJson(Map<String, dynamic> json) {
    return CustomerFavoriteProviderModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? 'DELLA Provider',
      role: json['role'] as String? ?? 'Provider',
      initials: json['initials'] as String? ?? 'DP',
      serviceKey: json['serviceKey'] as String? ?? '',
      rating: (json['rating'] as num?)?.toDouble(),
      priceLabel: json['priceLabel'] as String?,
      portraitSrc: json['portraitSrc'] as String? ?? '',
    );
  }

  static int _parseHourlyRate(String? label) {
    final match = RegExp(r'(\d+)').firstMatch(label ?? '');
    return int.tryParse(match?.group(1) ?? '') ?? 0;
  }
}

class CustomerProfileApiService {
  const CustomerProfileApiService();

  Future<CustomerProfileApiModel> fetchProfile() async {
    final response = await _get('/api/profile/me');
    final body = _decodeMap(response.body);
    if (_isSuccess(response.statusCode) && body['profile'] is Map<String, dynamic>) {
      return CustomerProfileApiModel.fromJson(
        body['profile'] as Map<String, dynamic>,
      );
    }
    throw Exception(_readError(body));
  }

  Future<CustomerProfileApiModel> updateProfile(
    Map<String, dynamic> payload,
  ) async {
    final response = await _send(
      '/api/profile/me',
      method: 'PATCH',
      body: payload,
    );
    final body = _decodeMap(response.body);
    if (_isSuccess(response.statusCode) && body['profile'] is Map<String, dynamic>) {
      return CustomerProfileApiModel.fromJson(
        body['profile'] as Map<String, dynamic>,
      );
    }
    throw Exception(_readError(body));
  }

  Future<List<CustomerProfileAddressModel>> fetchAddresses() async {
    final response = await _get('/api/profile/addresses');
    final body = _decodeMap(response.body);
    if (_isSuccess(response.statusCode)) {
      final items = (body['addresses'] as List<dynamic>? ?? const [])
          .whereType<Map>()
          .map(
            (item) => item.map(
              (key, value) => MapEntry(key.toString(), value),
            ),
          )
          .map(CustomerProfileAddressModel.fromJson)
          .toList();
      return items;
    }
    throw Exception(_readError(body));
  }

  Future<CustomerProfileAddressModel> addAddress(
    Map<String, dynamic> payload,
  ) async {
    final response = await _send(
      '/api/profile/addresses',
      method: 'POST',
      body: payload,
    );
    final body = _decodeMap(response.body);
    if (_isSuccess(response.statusCode) && body['address'] is Map<String, dynamic>) {
      return CustomerProfileAddressModel.fromJson(
        body['address'] as Map<String, dynamic>,
      );
    }
    throw Exception(_readError(body));
  }

  Future<List<CustomerPaymentHistoryModel>> fetchPayments() async {
    final response = await _get('/api/profile/payments');
    final body = _decodeMap(response.body);
    if (_isSuccess(response.statusCode)) {
      return (body['payments'] as List<dynamic>? ?? const [])
          .whereType<Map>()
          .map(
            (item) => item.map(
              (key, value) => MapEntry(key.toString(), value),
            ),
          )
          .map(CustomerPaymentHistoryModel.fromJson)
          .toList();
    }
    throw Exception(_readError(body));
  }

  Future<List<CustomerFavoriteProviderModel>> fetchFavorites() async {
    final response = await _get('/api/profile/favorites');
    final body = _decodeMap(response.body);
    if (_isSuccess(response.statusCode)) {
      return (body['favoriteProviders'] as List<dynamic>? ?? const [])
          .whereType<Map>()
          .map(
            (item) => item.map(
              (key, value) => MapEntry(key.toString(), value),
            ),
          )
          .map(CustomerFavoriteProviderModel.fromJson)
          .toList();
    }
    throw Exception(_readError(body));
  }

  Future<void> removeFavorite(String providerId) async {
    final response = await _send(
      '/api/profile/favorites',
      method: 'DELETE',
      body: {'providerId': providerId},
    );
    if (_isSuccess(response.statusCode)) {
      return;
    }
    throw Exception(_readError(_decodeMap(response.body)));
  }

  Future<http.Response> _get(String path) async {
    final uri = Uri.parse('${AppConfig.appBaseUrl}$path');
    return http.get(uri, headers: await _headers());
  }

  Future<http.Response> _send(
    String path, {
    required String method,
    required Map<String, dynamic> body,
  }) async {
    final uri = Uri.parse('${AppConfig.appBaseUrl}$path');
    final headers = await _headers(includeJson: true);
    final encodedBody = jsonEncode(body);
    switch (method.toUpperCase()) {
      case 'POST':
        return http.post(uri, headers: headers, body: encodedBody);
      case 'PATCH':
        return http.patch(uri, headers: headers, body: encodedBody);
      case 'DELETE':
        return http.delete(uri, headers: headers, body: encodedBody);
      default:
        throw UnsupportedError('Unsupported method $method');
    }
  }

  Future<Map<String, String>> _headers({bool includeJson = false}) async {
    final headers = <String, String>{
      'Accept': 'application/json',
      if (includeJson) 'Content-Type': 'application/json',
    };
    final session = Supabase.instance.client.auth.currentSession;
    final accessToken = session?.accessToken;
    if (accessToken == null || accessToken.isEmpty) {
      throw Exception('Please sign in again.');
    }
    headers['Authorization'] = 'Bearer $accessToken';
    return headers;
  }

  bool _isSuccess(int statusCode) => statusCode >= 200 && statusCode < 300;

  Map<String, dynamic> _decodeMap(String body) {
    if (body.isEmpty) {
      return const {};
    }
    try {
      final decoded = jsonDecode(body);
      if (decoded is Map<String, dynamic>) {
        return decoded;
      }
    } catch (error, stackTrace) {
      if (kDebugMode) {
        debugPrint('Customer profile API decode failed: $error');
        debugPrintStack(stackTrace: stackTrace);
      }
    }
    return const {};
  }

  String _readError(Map<String, dynamic> body) {
    final error = body['error'];
    if (error is String && error.trim().isNotEmpty) {
      return error;
    }
    return 'Unable to load data. Please try again.';
  }
}
