import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/config/app_config.dart';

List<String> _providerWorkspaceStringList(dynamic value) {
  return (value as List<dynamic>? ?? const [])
      .map((item) => item?.toString() ?? '')
      .where((item) => item.trim().isNotEmpty)
      .toList(growable: false);
}

class ProviderWorkspaceServiceModel {
  const ProviderWorkspaceServiceModel({
    required this.id,
    required this.serviceType,
    required this.yearsExperience,
    required this.hourlyRate,
    required this.dailyRate,
    required this.specialties,
    required this.imageDataUrls,
    required this.imageCaptions,
    required this.certificateDataUrls,
    required this.certificateCaptions,
  });

  final String id;
  final String serviceType;
  final String yearsExperience;
  final double hourlyRate;
  final double dailyRate;
  final List<String> specialties;
  final List<String> imageDataUrls;
  final List<String> imageCaptions;
  final List<String> certificateDataUrls;
  final List<String> certificateCaptions;

  factory ProviderWorkspaceServiceModel.fromJson(Map<String, dynamic> json) {
    return ProviderWorkspaceServiceModel(
      id: json['id'] as String? ?? '',
      serviceType: json['serviceType'] as String? ?? '',
      yearsExperience: json['yearsExperience'] as String? ?? '',
      hourlyRate: (json['hourlyRate'] as num?)?.toDouble() ?? 0,
      dailyRate: (json['dailyRate'] as num?)?.toDouble() ?? 0,
      specialties: _providerWorkspaceStringList(json['specialties']),
      imageDataUrls: _providerWorkspaceStringList(json['imageDataUrls']),
      imageCaptions: _providerWorkspaceStringList(json['imageCaptions']),
      certificateDataUrls:
          _providerWorkspaceStringList(json['certificateDataUrls']),
      certificateCaptions:
          _providerWorkspaceStringList(json['certificateCaptions']),
    );
  }
}

class ProviderWorkspaceProfile {
  const ProviderWorkspaceProfile({
    required this.providerId,
    required this.fullName,
    required this.email,
    required this.phone,
    required this.emergencyContactNumber,
    required this.avatarUrl,
    required this.accountStatus,
    required this.marketingName,
    required this.serviceLocation,
    required this.serviceRadiusKm,
    required this.country,
    required this.bio,
    required this.averageRating,
    required this.totalReviews,
    required this.approvalStatus,
    required this.isVisible,
    required this.emailVerified,
    required this.phoneVerified,
    required this.identityVerified,
    required this.identityVerificationStatus,
    required this.identityDocumentType,
    required this.identityFrontImageUrl,
    required this.identityBackImageUrl,
    required this.kycVerified,
    required this.backgroundCheckVerified,
    required this.services,
  });

  final String providerId;
  final String fullName;
  final String email;
  final String phone;
  final String emergencyContactNumber;
  final String avatarUrl;
  final String accountStatus;
  final String marketingName;
  final String serviceLocation;
  final double serviceRadiusKm;
  final String country;
  final String bio;
  final double averageRating;
  final int totalReviews;
  final String approvalStatus;
  final bool isVisible;
  final bool emailVerified;
  final bool phoneVerified;
  final bool identityVerified;
  final String identityVerificationStatus;
  final String identityDocumentType;
  final String identityFrontImageUrl;
  final String identityBackImageUrl;
  final bool kycVerified;
  final bool backgroundCheckVerified;
  final List<ProviderWorkspaceServiceModel> services;

  factory ProviderWorkspaceProfile.fromJson(Map<String, dynamic> json) {
    return ProviderWorkspaceProfile(
      providerId: json['providerId'] as String? ?? '',
      fullName: json['fullName'] as String? ?? '',
      email: json['email'] as String? ?? '',
      phone: json['phone'] as String? ?? '',
      emergencyContactNumber:
          json['emergencyContactNumber'] as String? ?? '',
      avatarUrl: json['avatarUrl'] as String? ?? '',
      accountStatus: json['accountStatus'] as String? ?? 'Pending',
      marketingName: json['marketingName'] as String? ?? '',
      serviceLocation: json['serviceLocation'] as String? ?? '',
      serviceRadiusKm: (json['serviceRadiusKm'] as num?)?.toDouble() ?? 0,
      country: json['country'] as String? ?? 'Malaysia',
      bio: json['bio'] as String? ?? '',
      averageRating: (json['averageRating'] as num?)?.toDouble() ?? 0,
      totalReviews: (json['totalReviews'] as num?)?.toInt() ?? 0,
      approvalStatus: json['approvalStatus'] as String? ?? 'Pending',
      isVisible: json['isVisible'] == true,
      emailVerified: json['emailVerified'] == true,
      phoneVerified: json['phoneVerified'] == true,
      identityVerified: json['identityVerified'] == true,
      identityVerificationStatus:
          json['identityVerificationStatus'] as String? ?? 'pending',
      identityDocumentType: json['identityDocumentType'] as String? ?? '',
      identityFrontImageUrl: json['identityFrontImageUrl'] as String? ?? '',
      identityBackImageUrl: json['identityBackImageUrl'] as String? ?? '',
      kycVerified: json['kycVerified'] == true,
      backgroundCheckVerified: json['backgroundCheckVerified'] == true,
      services: (json['services'] as List<dynamic>? ?? const [])
          .whereType<Map>()
          .map(
            (item) => item.map(
              (key, value) => MapEntry(key.toString(), value),
            ),
          )
          .map(ProviderWorkspaceServiceModel.fromJson)
          .toList(growable: false),
    );
  }
}

class ProviderWorkspaceBooking {
  const ProviderWorkspaceBooking({
    required this.id,
    required this.customerName,
    required this.serviceLabel,
    required this.location,
    required this.bookingStatus,
    required this.statusLabel,
    required this.customerStatusLabel,
    required this.bucket,
    required this.schedule,
    required this.quotedAmount,
    required this.paymentStatus,
    required this.companyCommissionAmount,
    required this.providerNetAmount,
    required this.createdAt,
  });

  final String id;
  final String customerName;
  final String serviceLabel;
  final String location;
  final String bookingStatus;
  final String statusLabel;
  final String customerStatusLabel;
  final String bucket;
  final String schedule;
  final double quotedAmount;
  final String paymentStatus;
  final double companyCommissionAmount;
  final double providerNetAmount;
  final String createdAt;

  factory ProviderWorkspaceBooking.fromJson(Map<String, dynamic> json) {
    return ProviderWorkspaceBooking(
      id: json['id'] as String? ?? '',
      customerName: json['customerName'] as String? ?? 'Customer',
      serviceLabel: json['serviceLabel'] as String? ?? 'Service',
      location: json['location'] as String? ?? '',
      bookingStatus: json['bookingStatus'] as String? ?? 'pending',
      statusLabel: json['statusLabel'] as String? ?? 'Pending',
      customerStatusLabel: json['customerStatusLabel'] as String? ?? 'Pending',
      bucket: json['bucket'] as String? ?? 'active',
      schedule: json['schedule'] as String? ?? '',
      quotedAmount: (json['quotedAmount'] as num?)?.toDouble() ?? 0,
      paymentStatus: json['paymentStatus'] as String? ?? 'pending',
      companyCommissionAmount:
          (json['companyCommissionAmount'] as num?)?.toDouble() ?? 0,
      providerNetAmount: (json['providerNetAmount'] as num?)?.toDouble() ?? 0,
      createdAt: json['createdAt'] as String? ?? '',
    );
  }
}

class ProviderAvailabilityEntry {
  const ProviderAvailabilityEntry({
    required this.id,
    required this.day,
    required this.dayKey,
    required this.timeMode,
    required this.startTime,
    required this.endTime,
  });

  final String id;
  final String day;
  final String dayKey;
  final String timeMode;
  final String startTime;
  final String endTime;

  factory ProviderAvailabilityEntry.fromJson(Map<String, dynamic> json) {
    return ProviderAvailabilityEntry(
      id: json['id'] as String? ?? '',
      day: json['day'] as String? ?? '',
      dayKey: json['dayKey'] as String? ?? '',
      timeMode: json['timeMode'] as String? ?? 'custom',
      startTime: json['startTime'] as String? ?? '08:00',
      endTime: json['endTime'] as String? ?? '20:00',
    );
  }
}

class ProviderAvailabilitySnapshot {
  const ProviderAvailabilitySnapshot({
    required this.enabled,
    required this.entries,
  });

  final bool enabled;
  final List<ProviderAvailabilityEntry> entries;

  factory ProviderAvailabilitySnapshot.fromJson(Map<String, dynamic> json) {
    return ProviderAvailabilitySnapshot(
      enabled: json['enabled'] == true,
      entries: (json['entries'] as List<dynamic>? ?? const [])
          .whereType<Map>()
          .map(
            (item) => item.map(
              (key, value) => MapEntry(key.toString(), value),
            ),
          )
          .map(ProviderAvailabilityEntry.fromJson)
          .toList(growable: false),
    );
  }
}

class ProviderReviewItem {
  const ProviderReviewItem({
    required this.id,
    required this.customerName,
    required this.rating,
    required this.comment,
    required this.createdAt,
    required this.createdLabel,
  });

  final String id;
  final String customerName;
  final int rating;
  final String comment;
  final String createdAt;
  final String createdLabel;

  factory ProviderReviewItem.fromJson(Map<String, dynamic> json) {
    return ProviderReviewItem(
      id: json['id'] as String? ?? '',
      customerName: json['customerName'] as String? ?? 'Customer',
      rating: (json['rating'] as num?)?.toInt() ?? 5,
      comment: json['comment'] as String? ?? 'Shared feedback',
      createdAt: json['createdAt'] as String? ?? '',
      createdLabel: json['createdLabel'] as String? ?? '',
    );
  }
}

class ProviderWorkspaceSnapshot {
  const ProviderWorkspaceSnapshot({
    required this.profile,
    required this.bookings,
  });

  final ProviderWorkspaceProfile profile;
  final List<ProviderWorkspaceBooking> bookings;
}

class ProviderWorkspaceService {
  const ProviderWorkspaceService();

  Future<ProviderWorkspaceSnapshot> fetchWorkspace() async {
    final results = await Future.wait<Object>([
      fetchProfile(),
      fetchBookings(),
    ]);
    return ProviderWorkspaceSnapshot(
      profile: results[0] as ProviderWorkspaceProfile,
      bookings: results[1] as List<ProviderWorkspaceBooking>,
    );
  }

  Future<ProviderWorkspaceProfile> fetchProfile() async {
    final response = await _request('GET', '/api/provider/me');
    final body = _decodeMap(response.body);
    if (_isSuccess(response.statusCode)) {
      return ProviderWorkspaceProfile.fromJson(body);
    }
    throw Exception(_readError(body, 'Unable to load provider profile.'));
  }

  Future<List<ProviderWorkspaceBooking>> fetchBookings() async {
    final response = await _request('GET', '/api/provider/bookings');
    final body = _decodeMap(response.body);
    if (_isSuccess(response.statusCode)) {
      return _listOfMaps(body['bookings'])
          .map(ProviderWorkspaceBooking.fromJson)
          .toList(growable: false);
    }
    throw Exception(_readError(body, 'Unable to load provider bookings.'));
  }

  Future<ProviderAvailabilitySnapshot> fetchAvailability() async {
    final response = await _request('GET', '/api/provider/availability');
    final body = _decodeMap(response.body);
    if (_isSuccess(response.statusCode)) {
      return ProviderAvailabilitySnapshot.fromJson(body);
    }
    throw Exception(_readError(body, 'Unable to load provider availability.'));
  }

  Future<void> saveAvailability({
    required bool enabled,
    required List<ProviderAvailabilityEntry> entries,
  }) async {
    final response = await _request(
      'PUT',
      '/api/provider/availability',
      body: {
        'enabled': enabled,
        'entries': entries
            .map(
              (entry) => {
                'day': entry.day,
                'startTime': entry.startTime,
                'endTime': entry.endTime,
                'timeMode': entry.timeMode,
              },
            )
            .toList(growable: false),
      },
    );
    final data = _decodeMap(response.body);
    if (!_isSuccess(response.statusCode)) {
      throw Exception(_readError(data, 'Unable to save provider availability.'));
    }
  }

  Future<List<ProviderReviewItem>> fetchReviews() async {
    final response = await _request('GET', '/api/provider/reviews');
    final body = _decodeMap(response.body);
    if (_isSuccess(response.statusCode)) {
      return _listOfMaps(body['reviews'])
          .map(ProviderReviewItem.fromJson)
          .toList(growable: false);
    }
    throw Exception(_readError(body, 'Unable to load provider reviews.'));
  }

  Future<void> createService({
    required String serviceType,
    required String yearsExperience,
    required double hourlyRate,
    required double dailyRate,
    required List<String> specialties,
    required List<String> imageDataUrls,
    required List<String> imageCaptions,
  }) async {
    final response = await _request(
      'POST',
      '/api/provider/services',
      body: {
        'serviceType': serviceType,
        'yearsExperience': yearsExperience,
        'hourlyRate': hourlyRate,
        'dailyRate': dailyRate,
        'specialties': specialties,
        'imageDataUrls': imageDataUrls,
        'imageCaptions': imageCaptions,
      },
    );
    final data = _decodeMap(response.body);
    if (!_isSuccess(response.statusCode)) {
      throw Exception(_readError(data, 'Unable to add provider service.'));
    }
  }

  Future<void> updateService({
    required String serviceId,
    required String yearsExperience,
    required double hourlyRate,
    required double dailyRate,
    required List<String> specialties,
    required List<String> imageDataUrls,
    required List<String> imageCaptions,
  }) async {
    final response = await _request(
      'PATCH',
      '/api/provider/services/$serviceId',
      body: {
        'yearsExperience': yearsExperience,
        'hourlyRate': hourlyRate,
        'dailyRate': dailyRate,
        'specialties': specialties,
        'imageDataUrls': imageDataUrls,
        'imageCaptions': imageCaptions,
      },
    );
    final data = _decodeMap(response.body);
    if (!_isSuccess(response.statusCode)) {
      throw Exception(_readError(data, 'Unable to update provider service.'));
    }
  }

  Future<http.Response> _request(
    String method,
    String path, {
    Map<String, dynamic>? body,
  }) async {
    final session = Supabase.instance.client.auth.currentSession;
    final accessToken = session?.accessToken;
    if (accessToken == null || accessToken.isEmpty) {
      throw Exception('Please sign in again.');
    }

    final uri = Uri.parse('${AppConfig.appBaseUrl}$path');
    final headers = <String, String>{
      'Accept': 'application/json',
      'Authorization': 'Bearer $accessToken',
    };
    if (body != null) {
      headers['Content-Type'] = 'application/json';
    }

    switch (method.toUpperCase()) {
      case 'GET':
        return http.get(uri, headers: headers);
      case 'POST':
        return http.post(uri, headers: headers, body: jsonEncode(body));
      case 'PATCH':
        return http.patch(uri, headers: headers, body: jsonEncode(body));
      case 'PUT':
        return http.put(uri, headers: headers, body: jsonEncode(body));
      default:
        throw UnsupportedError('Unsupported request method: $method');
    }
  }

  List<Map<String, dynamic>> _listOfMaps(dynamic value) {
    return (value as List<dynamic>? ?? const [])
        .whereType<Map>()
        .map(
          (item) => item.map(
            (key, data) => MapEntry(key.toString(), data),
          ),
        )
        .toList(growable: false);
  }

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
        debugPrint('Provider workspace decode failed: $error');
        debugPrintStack(stackTrace: stackTrace);
      }
    }
    return const {};
  }

  bool _isSuccess(int statusCode) => statusCode >= 200 && statusCode < 300;

  String _readError(Map<String, dynamic> body, String fallback) {
    final error = body['error'];
    if (error is String && error.trim().isNotEmpty) {
      return error;
    }
    return fallback;
  }
}
