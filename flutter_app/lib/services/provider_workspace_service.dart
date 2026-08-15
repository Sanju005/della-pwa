import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/config/app_config.dart';

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
    final results = await Future.wait([
      fetchProfile(),
      fetchBookings(),
    ]);
    return ProviderWorkspaceSnapshot(
      profile: results[0] as ProviderWorkspaceProfile,
      bookings: results[1] as List<ProviderWorkspaceBooking>,
    );
  }

  Future<ProviderWorkspaceProfile> fetchProfile() async {
    final response = await _get('/api/provider/me');
    final body = _decodeMap(response.body);
    if (_isSuccess(response.statusCode)) {
      return ProviderWorkspaceProfile.fromJson(body);
    }
    throw Exception(_readError(body, 'Unable to load provider profile.'));
  }

  Future<List<ProviderWorkspaceBooking>> fetchBookings() async {
    final response = await _get('/api/provider/bookings');
    final body = _decodeMap(response.body);
    if (_isSuccess(response.statusCode)) {
      return (body['bookings'] as List<dynamic>? ?? const [])
          .whereType<Map>()
          .map(
            (item) => item.map(
              (key, value) => MapEntry(key.toString(), value),
            ),
          )
          .map(ProviderWorkspaceBooking.fromJson)
          .toList();
    }
    throw Exception(_readError(body, 'Unable to load provider bookings.'));
  }

  Future<http.Response> _get(String path) async {
    final session = Supabase.instance.client.auth.currentSession;
    final accessToken = session?.accessToken;
    if (accessToken == null || accessToken.isEmpty) {
      throw Exception('Please sign in again.');
    }

    final uri = Uri.parse('${AppConfig.appBaseUrl}$path');
    return http.get(
      uri,
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
    );
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
