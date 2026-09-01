import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/config/app_config.dart';
import 'service_location_store.dart';

class ProviderAvailabilitySlot {
  const ProviderAvailabilitySlot({
    required this.isoDate,
    required this.dayLabel,
    required this.dateLabel,
    required this.startTimeLabel,
    required this.endTimeLabel,
    required this.timeLabel,
    required this.state,
  });

  final String isoDate;
  final String dayLabel;
  final String dateLabel;
  final String startTimeLabel;
  final String endTimeLabel;
  final String timeLabel;
  final String state;

  bool get isAvailable => state.toLowerCase() == 'available';

  factory ProviderAvailabilitySlot.fromJson(Map<String, dynamic> json) {
    final startTimeLabel = json['startTimeLabel'] as String? ?? '';
    final endTimeLabel = json['endTimeLabel'] as String? ?? '';

    return ProviderAvailabilitySlot(
      isoDate: json['isoDate'] as String? ?? '',
      dayLabel: json['dayLabel'] as String? ?? '',
      dateLabel: json['dateLabel'] as String? ?? '',
      startTimeLabel: startTimeLabel,
      endTimeLabel: endTimeLabel,
      timeLabel: json['timeLabel'] as String? ??
          [startTimeLabel, endTimeLabel]
              .where((item) => item.trim().isNotEmpty)
              .join(' - '),
      state: json['state'] as String? ?? '',
    );
  }
}

class ProviderBookedTimeRange {
  const ProviderBookedTimeRange({
    required this.startTimeLabel,
    required this.endTimeLabel,
  });

  final String startTimeLabel;
  final String endTimeLabel;

  factory ProviderBookedTimeRange.fromJson(Map<String, dynamic> json) {
    return ProviderBookedTimeRange(
      startTimeLabel: json['startTimeLabel'] as String? ?? '',
      endTimeLabel: json['endTimeLabel'] as String? ?? '',
    );
  }
}

class ProviderDetailModel {
  const ProviderDetailModel({
    required this.id,
    required this.name,
    required this.title,
    required this.serviceLabel,
    required this.serviceKey,
    required this.profileImage,
    required this.reviewsLabel,
    required this.rating,
    required this.distanceKm,
    required this.identityVerified,
    required this.phoneVerified,
    required this.yearsExperience,
    required this.jobsCompleted,
    required this.hourlyRate,
    required this.dailyRate,
    required this.specialties,
    required this.about,
    required this.locationFull,
    required this.verified,
    required this.customerReviews,
    required this.hasUploadedGallery,
    required this.gallery,
    required this.availabilityLabel,
    required this.availability,
    required this.bookedTimeRangesByDate,
  });

  final String id;
  final String name;
  final String title;
  final String serviceLabel;
  final String serviceKey;
  final String profileImage;
  final String reviewsLabel;
  final double rating;
  final double distanceKm;
  final bool identityVerified;
  final bool phoneVerified;
  final String yearsExperience;
  final int jobsCompleted;
  final int hourlyRate;
  final int dailyRate;
  final List<String> specialties;
  final String about;
  final String locationFull;
  final bool verified;
  final List<Map<String, dynamic>> customerReviews;
  final bool hasUploadedGallery;
  final List<Map<String, String>> gallery;
  final String availabilityLabel;
  final List<ProviderAvailabilitySlot> availability;
  final Map<String, List<ProviderBookedTimeRange>> bookedTimeRangesByDate;

  factory ProviderDetailModel.fromJson(Map<String, dynamic> json) {
    final availability =
        (json['availability'] as List<dynamic>? ?? const [])
            .whereType<Map>()
            .map(
              (item) => item.map(
                (key, value) => MapEntry(key.toString(), value),
              ),
            )
            .map(ProviderAvailabilitySlot.fromJson)
            .toList();

    final bookedTimeRangesByDate = <String, List<ProviderBookedTimeRange>>{};
    final bookedRangesJson = json['bookedTimeRangesByDate'];
    if (bookedRangesJson is Map) {
      for (final entry in bookedRangesJson.entries) {
        final dateKey = entry.key.toString();
        final ranges = (entry.value as List<dynamic>? ?? const [])
            .whereType<Map>()
            .map(
              (item) => item.map(
                (key, value) => MapEntry(key.toString(), value),
              ),
            )
            .map(ProviderBookedTimeRange.fromJson)
            .toList();
        bookedTimeRangesByDate[dateKey] = ranges;
      }
    }

    final gallery =
        (json['gallery'] as List<dynamic>? ?? const [])
            .whereType<Map>()
            .map(
              (item) => item.map(
                (key, value) => MapEntry(key.toString(), value?.toString() ?? ''),
              ),
            )
            .map(
              (item) => <String, String>{
                'src': item['src']?.toString() ?? '',
                'alt': item['alt']?.toString() ?? '',
                'caption': item['caption']?.toString() ?? '',
              },
            )
            .where((item) => item['src']!.trim().isNotEmpty)
            .toList();

    return ProviderDetailModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? 'Provider',
      title: json['title'] as String? ?? '',
      serviceLabel: json['serviceLabel'] as String? ?? '',
      serviceKey: json['serviceKey'] as String? ?? '',
      profileImage: json['profileImage'] as String? ?? '',
      reviewsLabel: json['reviewsLabel'] as String? ?? '',
      rating: (json['rating'] as num?)?.toDouble() ?? 0,
      distanceKm: (json['distanceKm'] as num?)?.toDouble() ?? 0,
      identityVerified: json['identityVerified'] as bool? ?? false,
      phoneVerified: json['phoneVerified'] as bool? ?? false,
      yearsExperience: json['yearsExperience'] as String? ?? '',
      jobsCompleted: (json['jobsCompleted'] as num?)?.toInt() ?? 0,
      hourlyRate: (json['hourlyRate'] as num?)?.toInt() ?? 0,
      dailyRate: (json['dailyRate'] as num?)?.toInt() ?? 0,
      specialties:
          (json['specialties'] as List?)
              ?.map((item) => item.toString())
              .where((item) => item.isNotEmpty)
              .toList() ??
          const [],
      about: json['about'] as String? ?? '',
      locationFull: json['locationFull'] as String? ?? '',
      verified: json['verified'] as bool? ?? false,
      customerReviews:
          (json['customerReviews'] as List?)
              ?.whereType<Map>()
              .map(
                (item) => item.map(
                  (key, value) => MapEntry(key.toString(), value),
                ),
              )
              .toList() ??
          const [],
      hasUploadedGallery: json['hasUploadedGallery'] as bool? ?? false,
      gallery: gallery,
      availabilityLabel: json['availabilityLabel'] as String? ?? '',
      availability: availability,
      bookedTimeRangesByDate: bookedTimeRangesByDate,
    );
  }
}

class ProviderDetailService {
  const ProviderDetailService();

  Future<ProviderDetailModel> fetchProviderDetail({
    required String id,
    String? service,
  }) async {
    final selection = ServiceLocationStore.load();

    final uri = Uri.parse('${AppConfig.appBaseUrl}/api/providers/$id').replace(
      queryParameters: {
        if (service != null && service.trim().isNotEmpty)
          'service': service.trim().toLowerCase(),
        if (selection?.latitude != null) 'lat': selection!.latitude.toString(),
        if (selection?.longitude != null) 'lng': selection!.longitude.toString(),
      },
    );

    final headers = <String, String>{'Accept': 'application/json'};
    final accessToken = Supabase.instance.client.auth.currentSession?.accessToken;
    if (accessToken != null && accessToken.isNotEmpty) {
      headers['Authorization'] = 'Bearer $accessToken';
    }

    final response = await http.get(uri, headers: headers);
    final body = _decode(response.body);

    if (response.statusCode >= 200 &&
        response.statusCode < 300 &&
        body is Map<String, dynamic>) {
      return ProviderDetailModel.fromJson(body);
    }

    if (kDebugMode) {
      debugPrint('Provider detail request failed: ${response.statusCode}');
      debugPrint(response.body);
    }

    throw Exception('Unable to load provider profile. Please try again.');
  }

  Object? _decode(String body) {
    if (body.isEmpty) {
      return null;
    }
    try {
      return jsonDecode(body);
    } catch (_) {
      return null;
    }
  }
}
