import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/config/app_config.dart';

/// Mirrors ProviderConversationMessage in provider_workspace_service.dart —
/// the backend (lib/booking-messages.ts) returns the identical shape for
/// both roles, just scoped by whichever `/api/*/messages` path is called.
class CustomerConversationMessage {
  const CustomerConversationMessage({
    required this.id,
    required this.bookingId,
    required this.senderId,
    required this.senderRole,
    required this.senderName,
    required this.messageText,
    required this.attachmentDataUrl,
    required this.attachmentFileName,
    required this.attachmentMimeType,
    required this.createdAt,
    required this.isOwnMessage,
  });

  final String id;
  final String bookingId;
  final String senderId;
  final String senderRole;
  final String senderName;
  final String messageText;
  final String attachmentDataUrl;
  final String attachmentFileName;
  final String attachmentMimeType;
  final String createdAt;
  final bool isOwnMessage;

  factory CustomerConversationMessage.fromJson(Map<String, dynamic> json) {
    return CustomerConversationMessage(
      id: json['id'] as String? ?? '',
      bookingId: json['bookingId'] as String? ?? '',
      senderId: json['senderId'] as String? ?? '',
      senderRole: json['senderRole'] as String? ?? 'system',
      senderName: json['senderName'] as String? ?? 'Provider',
      messageText: json['messageText'] as String? ?? '',
      attachmentDataUrl: json['attachmentDataUrl'] as String? ?? '',
      attachmentFileName: json['attachmentFileName'] as String? ?? '',
      attachmentMimeType: json['attachmentMimeType'] as String? ?? '',
      createdAt: json['createdAt'] as String? ?? '',
      isOwnMessage: json['isOwnMessage'] == true,
    );
  }
}

class CustomerConversationDetail {
  const CustomerConversationDetail({
    required this.bookingId,
    required this.counterpartId,
    required this.counterpartName,
    required this.serviceLabel,
    required this.location,
    required this.schedule,
    required this.messages,
    required this.unreadCount,
    required this.canSendMessages,
    required this.bookingStatus,
  });

  final String bookingId;
  final String counterpartId;
  final String counterpartName;
  final String serviceLabel;
  final String location;
  final String schedule;
  final List<CustomerConversationMessage> messages;
  final int unreadCount;
  final bool canSendMessages;
  final String bookingStatus;

  factory CustomerConversationDetail.fromJson(Map<String, dynamic> json) {
    return CustomerConversationDetail(
      bookingId: json['bookingId'] as String? ?? '',
      counterpartId: json['counterpartId'] as String? ?? '',
      counterpartName: json['counterpartName'] as String? ?? 'Provider',
      serviceLabel: json['serviceLabel'] as String? ?? 'Service',
      location: json['location'] as String? ?? '',
      schedule: json['schedule'] as String? ?? '',
      messages: (json['messages'] as List<dynamic>? ?? const [])
          .whereType<Map>()
          .map(
            (item) => item.map((key, value) => MapEntry(key.toString(), value)),
          )
          .map(CustomerConversationMessage.fromJson)
          .toList(growable: false),
      unreadCount: (json['unreadCount'] as num?)?.toInt() ?? 0,
      canSendMessages: json['canSendMessages'] == true,
      bookingStatus: json['bookingStatus'] as String? ?? 'pending',
    );
  }
}

/// Talks to the existing `/api/profile/messages` backend (the same
/// lib/booking-messages.ts logic already used and proven by the Provider
/// Flutter app via ProviderWorkspaceService) — no new backend endpoint.
class CustomerMessagesService {
  const CustomerMessagesService();

  Future<CustomerConversationDetail> fetchThreadDetail(String bookingId) async {
    final response = await _request('GET', '/api/profile/messages/$bookingId');
    final body = _decodeMap(response.body);
    if (_isSuccess(response.statusCode)) {
      final thread = body['thread'];
      if (thread is Map) {
        return CustomerConversationDetail.fromJson(
          thread.map((key, value) => MapEntry(key.toString(), value)),
        );
      }
    }
    throw Exception(_readError(body, 'Unable to load conversation.'));
  }

  Future<CustomerConversationDetail> sendMessage({
    required String bookingId,
    required String messageText,
    String attachmentDataUrl = '',
    String attachmentFileName = '',
    String attachmentMimeType = '',
  }) async {
    final response = await _request(
      'POST',
      '/api/profile/messages/$bookingId',
      body: {
        'messageText': messageText,
        'attachmentDataUrl': attachmentDataUrl,
        'attachmentFileName': attachmentFileName,
        'attachmentMimeType': attachmentMimeType,
      },
    );
    final body = _decodeMap(response.body);
    if (_isSuccess(response.statusCode)) {
      final thread = body['thread'];
      if (thread is Map) {
        return CustomerConversationDetail.fromJson(
          thread.map((key, value) => MapEntry(key.toString(), value)),
        );
      }
    }
    throw Exception(_readError(body, 'Unable to send message.'));
  }

  Future<void> markConversationRead(String bookingId) async {
    final response = await _request(
      'PATCH',
      '/api/profile/messages/$bookingId',
    );
    final body = _decodeMap(response.body);
    if (!_isSuccess(response.statusCode)) {
      throw Exception(_readError(body, 'Unable to mark conversation as read.'));
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
      default:
        throw UnsupportedError('Unsupported request method: $method');
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
        debugPrint('Customer messages decode failed: $error');
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
