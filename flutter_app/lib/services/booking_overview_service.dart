import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/config/app_config.dart';
import '../models/booking_item.dart';

class CustomerBookingRecord {
  const CustomerBookingRecord({
    required this.booking,
    required this.activeStepIndex,
    required this.paymentStatus,
    required this.paymentMethod,
    required this.paymentAmountLabel,
    required this.paymentDateLabel,
    required this.isPast,
  });

  final BookingItem booking;
  final int activeStepIndex;
  final String paymentStatus;
  final String paymentMethod;
  final String paymentAmountLabel;
  final String paymentDateLabel;
  final bool isPast;
}

class BookingTimelineStep {
  const BookingTimelineStep({
    required this.label,
    required this.status,
  });

  final String label;
  final String status;
}

class CustomerBookingDetail {
  const CustomerBookingDetail({
    required this.id,
    required this.service,
    required this.provider,
    required this.providerFullName,
    required this.schedule,
    required this.location,
    required this.statusGroup,
    required this.workflowStatus,
    required this.statusLabel,
    required this.paymentStatus,
    required this.paymentMethod,
    required this.paymentAmount,
    required this.paymentAmountLabel,
    required this.userReviewStatus,
    required this.createdAt,
    required this.acceptedAt,
    required this.onTheWayAt,
    required this.arrivedAt,
    required this.workFinishedAt,
    required this.workConfirmedByUserAt,
    required this.paymentSentAt,
    required this.cashPaidByUserAt,
    required this.paymentReceivedByProviderAt,
    required this.completedAt,
    required this.notes,
    required this.customerPaymentProofDataUrl,
    required this.customerPaymentProofFileName,
    required this.customerPaymentProofMimeType,
    required this.providerCompanyPaymentProofDataUrl,
    required this.providerCompanyPaymentProofFileName,
    required this.providerCompanyPaymentProofMimeType,
    required this.activitySteps,
  });

  final String id;
  final String service;
  final String provider;
  final String providerFullName;
  final String schedule;
  final String location;
  final String statusGroup;
  final String workflowStatus;
  final String statusLabel;
  final String paymentStatus;
  final String paymentMethod;
  final double paymentAmount;
  final String paymentAmountLabel;
  final String userReviewStatus;
  final String createdAt;
  final String acceptedAt;
  final String onTheWayAt;
  final String arrivedAt;
  final String workFinishedAt;
  final String workConfirmedByUserAt;
  final String paymentSentAt;
  final String cashPaidByUserAt;
  final String paymentReceivedByProviderAt;
  final String completedAt;
  final String notes;
  final String customerPaymentProofDataUrl;
  final String customerPaymentProofFileName;
  final String customerPaymentProofMimeType;
  final String providerCompanyPaymentProofDataUrl;
  final String providerCompanyPaymentProofFileName;
  final String providerCompanyPaymentProofMimeType;
  final List<BookingTimelineStep> activitySteps;
}

class BookingOverviewData {
  const BookingOverviewData({
    required this.upcomingBookings,
    required this.pastBookings,
  });

  final List<CustomerBookingRecord> upcomingBookings;
  final List<CustomerBookingRecord> pastBookings;
}

class BookingOverviewService {
  const BookingOverviewService();

  Future<BookingOverviewData?> fetchCustomerBookings() async {
    final accessToken = Supabase.instance.client.auth.currentSession?.accessToken;
    if (accessToken == null || accessToken.isEmpty) {
      return null;
    }

    final response = await http.get(
      Uri.parse('${AppConfig.appBaseUrl}/api/bookings'),
      headers: <String, String>{
        'Accept': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
    );

    final body = _decode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      if (kDebugMode) {
        debugPrint('Booking overview request failed: ${response.statusCode}');
        debugPrint(response.body);
      }
      throw Exception(_readError(body));
    }

    if (body is! Map<String, dynamic>) {
      return null;
    }

    final rawBookings = body['bookings'] as List<dynamic>? ?? const [];
    if (rawBookings.isEmpty) {
      return null;
    }

    final records = rawBookings
        .whereType<Map>()
        .map(
          (item) => item.map((key, value) => MapEntry(key.toString(), value)),
        )
        .map(_mapBookingRecord)
        .toList();

    final upcoming = records.where((record) => !record.isPast).toList();
    final past = records.where((record) => record.isPast).toList();

    return BookingOverviewData(upcomingBookings: upcoming, pastBookings: past);
  }

  CustomerBookingRecord _mapBookingRecord(Map<String, dynamic> row) {
    final statusGroup = row['status']?.toString().trim().toLowerCase() ?? 'pending';
    final statusLabel = row['statusLabel']?.toString().trim().isNotEmpty == true
        ? row['statusLabel'] as String
        : 'Booking Sent';

    final paymentAmount = (row['paymentAmount'] as num?)?.toDouble();

    return CustomerBookingRecord(
      booking: BookingItem(
        id: row['id']?.toString() ?? '',
        title: row['service']?.toString().trim().isNotEmpty == true
            ? row['service'] as String
            : 'Service Booking',
        providerName: row['provider']?.toString().trim().isNotEmpty == true
            ? row['provider'] as String
            : 'DELLA Provider',
        schedule: row['schedule']?.toString().trim().isNotEmpty == true
            ? row['schedule'] as String
            : 'Upcoming booking',
        location: row['location']?.toString().trim().isNotEmpty == true
            ? row['location'] as String
            : 'No location stored',
        status: statusLabel,
        amountLabel: paymentAmount == null
            ? 'RM 0.00'
            : 'RM ${paymentAmount.toStringAsFixed(2)}',
        steps: _stepsForStatus(statusGroup),
        createdAt: DateTime.tryParse(row['createdAt']?.toString() ?? ''),
      ),
      activeStepIndex: _activeIndexForStatusGroup(statusGroup),
      paymentStatus: _humanize(row['paymentStatus']?.toString()),
      paymentMethod: row['paymentMethod']?.toString().trim().isNotEmpty == true
          ? row['paymentMethod'] as String
          : 'Pending',
      paymentAmountLabel: paymentAmount == null
          ? 'RM 0.00'
          : 'RM ${paymentAmount.toStringAsFixed(2)}',
      paymentDateLabel: row['paidAt']?.toString().trim().isNotEmpty == true
          ? row['paidAt'] as String
          : '-',
      isPast: statusGroup == 'completed' || statusGroup == 'cancelled',
    );
  }

  Future<CustomerBookingDetail?> fetchBookingDetail(String bookingId) async {
    final accessToken = _currentAccessToken;
    if (accessToken == null) {
      return null;
    }

    final response = await http.get(_bookingsUri, headers: _authHeaders(accessToken));

    final body = _decode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      if (kDebugMode) {
        debugPrint('Booking detail request failed: ${response.statusCode}');
        debugPrint(response.body);
      }
      throw Exception(_readError(body));
    }

    if (body is! Map<String, dynamic>) {
      return null;
    }

    final rawBookings = body['bookings'] as List<dynamic>? ?? const [];
    final match = rawBookings.whereType<Map>().map(
      (item) => item.map((key, value) => MapEntry(key.toString(), value)),
    ).cast<Map<String, dynamic>?>().firstWhere(
      (item) => item != null && item['id']?.toString() == bookingId,
      orElse: () => null,
    );

    if (match == null) {
      return null;
    }

    final paymentAmount = (match['paymentAmount'] as num?)?.toDouble() ?? 0;
    final steps = (match['activitySteps'] as List<dynamic>? ?? const [])
        .whereType<Map>()
        .map(
          (item) => item.map((key, value) => MapEntry(key.toString(), value)),
        )
        .map(
          (item) => BookingTimelineStep(
            label: item['label']?.toString() ?? 'Step',
            status: item['status']?.toString() ?? 'waiting',
          ),
        )
        .toList();

    return CustomerBookingDetail(
      id: match['id']?.toString() ?? bookingId,
      service: match['service']?.toString() ?? 'Service Booking',
      provider: match['provider']?.toString() ?? 'DELLA Provider',
      providerFullName: match['providerFullName']?.toString().trim().isNotEmpty == true
          ? match['providerFullName'] as String
          : (match['provider']?.toString() ?? 'DELLA Provider'),
      schedule: match['schedule']?.toString() ?? 'Upcoming booking',
      location: match['location']?.toString() ?? 'No location stored',
      statusGroup: match['status']?.toString() ?? 'pending',
      workflowStatus: match['workflowStatus']?.toString() ?? 'pending_provider_response',
      statusLabel: match['statusLabel']?.toString() ?? 'Booking Sent',
      paymentStatus: match['paymentStatus']?.toString() ?? '',
      paymentMethod: match['paymentMethod']?.toString() ?? 'Cash',
      paymentAmount: paymentAmount,
      paymentAmountLabel: 'RM ${paymentAmount.toStringAsFixed(2)}',
      userReviewStatus: match['userReviewStatus']?.toString() ?? '',
      createdAt: match['createdAt']?.toString() ?? '',
      acceptedAt: match['acceptedAt']?.toString() ?? '',
      onTheWayAt: match['onTheWayAt']?.toString() ?? '',
      arrivedAt: match['arrivedAt']?.toString() ?? '',
      workFinishedAt: match['workFinishedAt']?.toString() ?? '',
      workConfirmedByUserAt: match['workConfirmedByUserAt']?.toString() ?? '',
      paymentSentAt: match['paymentSentAt']?.toString() ?? '',
      cashPaidByUserAt: match['cashPaidByUserAt']?.toString() ?? '',
      paymentReceivedByProviderAt: match['paymentReceivedByProviderAt']?.toString() ?? '',
      completedAt: match['completedAt']?.toString() ?? '',
      notes: match['notes']?.toString() ?? '',
      customerPaymentProofDataUrl:
          match['customerPaymentProofDataUrl']?.toString() ?? '',
      customerPaymentProofFileName:
          match['customerPaymentProofFileName']?.toString() ?? '',
      customerPaymentProofMimeType:
          match['customerPaymentProofMimeType']?.toString() ?? '',
      providerCompanyPaymentProofDataUrl:
          match['providerCompanyPaymentProofDataUrl']?.toString() ?? '',
      providerCompanyPaymentProofFileName:
          match['providerCompanyPaymentProofFileName']?.toString() ?? '',
      providerCompanyPaymentProofMimeType:
          match['providerCompanyPaymentProofMimeType']?.toString() ?? '',
      activitySteps: steps,
    );
  }

  Future<void> confirmCashPayment(
    String bookingId, {
    String? proofDataUrl,
    String? proofFileName,
    String? proofMimeType,
  }) async {
    final accessToken = _currentAccessToken;
    if (accessToken == null) {
      throw Exception('Please sign in again.');
    }

    final response = await http.post(
      Uri.parse('${AppConfig.appBaseUrl}/api/bookings/$bookingId/cash-pay'),
      headers: _authHeaders(accessToken),
      body: jsonEncode(<String, dynamic>{
        'proofDataUrl': proofDataUrl,
        'proofFileName': proofFileName,
        'proofMimeType': proofMimeType,
      }),
    );

    final body = _decode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      if (kDebugMode) {
        debugPrint('Cash payment request failed: ${response.statusCode}');
        debugPrint(response.body);
      }
      throw Exception(_readError(body, fallback: 'Unable to confirm payment.'));
    }
  }

  Future<void> submitReview(
    String bookingId, {
    required int rating,
    String? comment,
    List<String> photos = const [],
    List<String> tags = const [],
    bool recommend = true,
  }) async {
    final accessToken = _currentAccessToken;
    if (accessToken == null) {
      throw Exception('Please sign in again.');
    }

    final response = await http.post(
      Uri.parse('${AppConfig.appBaseUrl}/api/bookings/$bookingId/review'),
      headers: _authHeaders(accessToken),
      body: jsonEncode(<String, dynamic>{
        'rating': rating,
        'comment': comment ?? '',
        'photos': photos,
        'tags': tags,
        'recommend': recommend,
      }),
    );

    final body = _decode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      if (kDebugMode) {
        debugPrint('Submit review request failed: ${response.statusCode}');
        debugPrint(response.body);
      }
      throw Exception(_readError(body, fallback: 'Unable to submit review.'));
    }
  }

  Future<void> submitIssueReport(
    CustomerBookingDetail booking, {
    required String message,
  }) async {
    final accessToken = _currentAccessToken;
    if (accessToken == null) {
      throw Exception('Please sign in again.');
    }

    final response = await http.post(
      Uri.parse('${AppConfig.appBaseUrl}/api/reports'),
      headers: _authHeaders(accessToken),
      body: jsonEncode(<String, dynamic>{
        'bookingId': booking.id,
        'bookingTitle': '${booking.service} - ${booking.providerFullName}',
        'providerName': booking.providerFullName,
        'schedule': booking.schedule,
        'location': booking.location,
        'paymentAmount': booking.paymentAmount,
        'paymentMethod': booking.paymentMethod,
        'message': message,
      }),
    );

    final body = _decode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      if (kDebugMode) {
        debugPrint('Issue report request failed: ${response.statusCode}');
        debugPrint(response.body);
      }
      throw Exception(_readError(body, fallback: 'Unable to submit issue report.'));
    }
  }

  List<String> _stepsForStatus(String statusGroup) {
    switch (statusGroup) {
      case 'completed':
        return const ['Booking Sent', 'Accepted', 'Completed'];
      case 'cancelled':
        return const ['Booking Sent', 'Cancelled'];
      case 'ongoing':
        return const ['Booking Sent', 'Accepted', 'In Progress'];
      default:
        return const ['Booking Sent', 'Accepted', 'In Progress', 'Completed'];
    }
  }

  int _activeIndexForStatusGroup(String statusGroup) {
    switch (statusGroup) {
      case 'completed':
        return 2;
      case 'cancelled':
        return 1;
      case 'ongoing':
        return 2;
      default:
        return 0;
    }
  }

  String _humanize(String? value) {
    final normalized = value?.trim() ?? '';
    if (normalized.isEmpty) {
      return 'Pending';
    }

    return normalized
        .split(RegExp(r'[_\s]+'))
        .where((part) => part.isNotEmpty)
        .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
        .join(' ');
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

  String _readError(
    Object? body, {
    String fallback = 'Unable to load bookings. Please try again.',
  }) {
    if (body is Map<String, dynamic>) {
      final error = body['error'];
      if (error is String && error.trim().isNotEmpty) {
        return error;
      }
    }

    return fallback;
  }

  String? get _currentAccessToken {
    final accessToken = Supabase.instance.client.auth.currentSession?.accessToken;
    if (accessToken == null || accessToken.isEmpty) {
      return null;
    }
    return accessToken;
  }

  Uri get _bookingsUri => Uri.parse('${AppConfig.appBaseUrl}/api/bookings');

  Map<String, String> _authHeaders(String accessToken) => <String, String>{
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      };
}
