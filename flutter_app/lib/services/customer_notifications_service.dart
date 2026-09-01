import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/config/app_config.dart';
import '../core/routing/app_routes.dart';
import '../models/notification_item.dart';

/// Talks to the existing, already-deployed `/api/notifications` backend —
/// generic for any authenticated user (customer or provider), already
/// populated by real booking/payment/review/message events across the
/// backend. No new endpoint required.
class CustomerNotificationsService {
  const CustomerNotificationsService();

  Future<List<NotificationItem>> fetchNotifications() async {
    final response = await _request('GET', '/api/notifications');
    final body = _decodeMap(response.body);
    if (!_isSuccess(response.statusCode)) {
      throw Exception(_readError(body, 'Unable to load notifications.'));
    }

    final rows = (body['notifications'] as List<dynamic>? ?? const [])
        .whereType<Map>()
        .map(
          (item) => item.map((key, value) => MapEntry(key.toString(), value)),
        );

    return rows.map(_mapNotification).toList(growable: false);
  }

  Future<void> markRead(String notificationId) async {
    if (notificationId.isEmpty) {
      return;
    }
    await _request('PATCH', '/api/notifications/$notificationId');
  }

  NotificationItem _mapNotification(Map<String, dynamic> json) {
    final bookingId = json['bookingId'] as String?;
    return NotificationItem(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? 'Update',
      body: json['body'] as String? ?? '',
      timeLabel: _relativeTime(json['createdAt'] as String?),
      isUnread: json['isRead'] != true,
      targetRoute: bookingId != null && bookingId.isNotEmpty
          ? AppRoutes.bookingDetail
          : null,
      targetArgument: bookingId,
    );
  }

  String _relativeTime(String? iso) {
    final parsed = iso == null ? null : DateTime.tryParse(iso);
    if (parsed == null) {
      return '';
    }
    final diff = DateTime.now().difference(parsed.toLocal());
    if (diff.inMinutes < 1) {
      return 'Just now';
    }
    if (diff.inMinutes < 60) {
      return '${diff.inMinutes} min ago';
    }
    if (diff.inHours < 24) {
      return '${diff.inHours} hr ago';
    }
    if (diff.inDays < 7) {
      return '${diff.inDays} d ago';
    }
    return '${parsed.day}/${parsed.month}/${parsed.year}';
  }

  Future<http.Response> _request(String method, String path) async {
    final accessToken =
        Supabase.instance.client.auth.currentSession?.accessToken;
    if (accessToken == null || accessToken.isEmpty) {
      throw Exception('Please sign in again.');
    }
    final uri = Uri.parse('${AppConfig.appBaseUrl}$path');
    final headers = <String, String>{
      'Accept': 'application/json',
      'Authorization': 'Bearer $accessToken',
    };
    switch (method) {
      case 'GET':
        return http.get(uri, headers: headers);
      case 'PATCH':
        return http.patch(uri, headers: headers);
      default:
        throw UnsupportedError('Unsupported method $method');
    }
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
        debugPrint('Notifications decode failed: $error');
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
