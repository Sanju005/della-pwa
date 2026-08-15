import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/config/app_config.dart';

class ProviderBookingRequest {
  const ProviderBookingRequest({
    required this.providerId,
    required this.providerName,
    required this.serviceKey,
    required this.serviceLabel,
    required this.location,
    required this.bookingMode,
    required this.dateLabel,
    required this.startTimeLabel,
    required this.endTimeLabel,
    required this.timeLabel,
    required this.durationHours,
    required this.notes,
    required this.hourlyRate,
    required this.dailyRate,
    required this.totalAmount,
  });

  final String providerId;
  final String providerName;
  final String serviceKey;
  final String serviceLabel;
  final String location;
  final String bookingMode;
  final String dateLabel;
  final String startTimeLabel;
  final String endTimeLabel;
  final String timeLabel;
  final int durationHours;
  final String notes;
  final int hourlyRate;
  final int dailyRate;
  final int totalAmount;

  Map<String, dynamic> toJson() {
    return {
      'providerId': providerId,
      'providerName': providerName,
      'serviceKey': serviceKey,
      'serviceLabel': serviceLabel,
      'location': location,
      'bookingMode': bookingMode,
      'dateLabel': dateLabel,
      'startTimeLabel': startTimeLabel,
      'endTimeLabel': endTimeLabel,
      'timeLabel': timeLabel,
      'durationHours': durationHours,
      'notes': notes,
      'hourlyRate': hourlyRate,
      'dailyRate': dailyRate,
      'totalAmount': totalAmount,
    };
  }
}

class ProviderBookingService {
  const ProviderBookingService();

  Future<void> createBooking(ProviderBookingRequest request) async {
    final accessToken = Supabase.instance.client.auth.currentSession?.accessToken;
    if (accessToken == null || accessToken.isEmpty) {
      throw Exception('Please log in before scheduling a booking.');
    }

    final response = await http.post(
      Uri.parse('${AppConfig.appBaseUrl}/api/bookings'),
      headers: <String, String>{
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
      body: jsonEncode(request.toJson()),
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return;
    }

    if (kDebugMode) {
      debugPrint('Create booking failed: ${response.statusCode}');
      debugPrint(response.body);
    }

    throw Exception(_readError(response.body));
  }

  String _readError(String body) {
    if (body.isNotEmpty) {
      try {
        final decoded = jsonDecode(body);
        if (decoded is Map<String, dynamic>) {
          final error = decoded['error'];
          if (error is String && error.trim().isNotEmpty) {
            return error;
          }
        }
      } catch (_) {
        // Keep the user-facing message friendly.
      }
    }

    return 'Unable to schedule booking. Please try again.';
  }
}
