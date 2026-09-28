import 'dart:async';
import 'dart:convert';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';

import '../core/app_navigator.dart';
import '../core/routing/app_routes.dart';
import 'auth_service.dart';
import 'local_notification_service.dart';

/// The single owner of every Firebase Messaging listener in the app —
/// `onMessage`, `onMessageOpenedApp`, and `getInitialMessage()` all live
/// here so no screen registers its own listener. Routing decisions are
/// made only from the structured data payload (`type`/`event`/`bookingId`/
/// `conversationId`), never from notification title/body text.
class NotificationRouterService {
  NotificationRouterService._internal();

  static final NotificationRouterService _instance =
      NotificationRouterService._internal();

  factory NotificationRouterService() => _instance;

  final LocalNotificationService _localNotifications =
      LocalNotificationService();
  final AuthService _authService = const AuthService();

  bool _initialized = false;

  Future<void> initialize() async {
    if (_initialized) {
      return;
    }
    _initialized = true;

    _localNotifications.onNotificationTap = _handleLocalNotificationTap;

    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);
    FirebaseMessaging.onMessageOpenedApp.listen(
      (message) => _routeFromData(message.data),
    );

    // Only ever read once per process — `_initialized` above guards this
    // whole method from running twice, so there's no separate flag needed.
    final initialMessage = await FirebaseMessaging.instance.getInitialMessage();
    if (initialMessage != null) {
      unawaited(_routeFromData(initialMessage.data));
    }
  }

  Future<void> _handleForegroundMessage(RemoteMessage message) async {
    final data = message.data;
    final title =
        message.notification?.title ?? data['title']?.toString() ?? 'Swiper';
    final body = message.notification?.body ?? data['body']?.toString() ?? '';

    // Foreground FCM messages never auto-display — this is the one and
    // only place a notification is shown for them, so there is never a
    // second (Firebase-drawn) notification alongside it.
    await _localNotifications.show(
      id: _stableIdFor(data),
      title: title,
      body: body,
      payload: _encodeRoutingPayload(data),
    );
  }

  Future<void> _handleLocalNotificationTap(String? payload) async {
    if (payload == null || payload.isEmpty) {
      return;
    }

    try {
      final decoded = jsonDecode(payload);
      if (decoded is Map) {
        await _routeFromData(
          decoded.map((key, value) => MapEntry(key.toString(), value)),
        );
      }
    } catch (e) {
      debugPrint('Failed to parse local notification payload: $e');
    }
  }

  int _stableIdFor(Map<String, dynamic> data) {
    final bookingId = data['bookingId']?.toString() ?? '';
    final event = data['event']?.toString() ?? '';
    final key = bookingId.isNotEmpty
        ? 'booking:$bookingId:$event'
        : (event.isNotEmpty ? 'event:$event' : 'swiper');
    return key.hashCode & 0x7fffffff;
  }

  String _encodeRoutingPayload(Map<String, dynamic> data) {
    final type = data['type']?.toString() ?? '';
    final event = data['event']?.toString() ?? '';
    final bookingId = data['bookingId']?.toString() ?? '';
    final conversationId = data['conversationId']?.toString() ?? '';
    final senderId = data['senderId']?.toString() ?? '';

    return jsonEncode({
      if (type.isNotEmpty) 'type': type,
      if (event.isNotEmpty) 'event': event,
      if (bookingId.isNotEmpty) 'bookingId': bookingId,
      if (conversationId.isNotEmpty) 'conversationId': conversationId,
      if (senderId.isNotEmpty) 'senderId': senderId,
    });
  }

  /// Shared by `onMessageOpenedApp`, `getInitialMessage()`, and a tapped
  /// foreground local notification — every entry point routes through this
  /// one method, and it only ever navigates. It never shows a notification.
  Future<void> _routeFromData(Map<String, dynamic> data) async {
    final type = data['type']?.toString() ?? '';
    if (type.isEmpty) {
      return;
    }

    final bookingId = data['bookingId']?.toString() ?? '';
    final conversationId = data['conversationId']?.toString() ?? '';

    final navigator = await _waitForNavigator();
    if (navigator == null) {
      return;
    }

    String? role;
    try {
      role = await _authService.getCurrentUserRole();
    } catch (e) {
      debugPrint('Failed to resolve role for notification routing: $e');
    }

    if (role != null && _authService.isProviderRole(role)) {
      _routeProvider(navigator, type);
      return;
    }

    _routeCustomer(navigator, type, bookingId, conversationId);
  }

  void _routeProvider(NavigatorState navigator, String type) {
    switch (type) {
      case 'booking':
        // Index 1 = the Bookings tab in ProviderShellScreen. First-cut
        // deep link: lands on the tab, not the specific booking's
        // task-path sheet (that needs separate, larger surgery).
        navigator.pushNamed(AppRoutes.providerShell, arguments: 1);
      case 'payment':
        // Index 2 = the Payments tab.
        navigator.pushNamed(AppRoutes.providerShell, arguments: 2);
      case 'message':
        navigator.pushNamed(AppRoutes.providerMessages);
    }
  }

  void _routeCustomer(
    NavigatorState navigator,
    String type,
    String bookingId,
    String conversationId,
  ) {
    switch (type) {
      case 'booking':
      case 'payment':
        if (bookingId.isNotEmpty) {
          navigator.pushNamed(AppRoutes.bookingDetail, arguments: bookingId);
        } else {
          navigator.pushNamed(AppRoutes.bookingOverview);
        }
      case 'message':
        // Customer chat is embedded inside BookingDetailScreen itself —
        // there is no separate conversation screen to deep-link into, so
        // this already opens the exact conversation, not just a list.
        final targetId = bookingId.isNotEmpty ? bookingId : conversationId;
        if (targetId.isNotEmpty) {
          navigator.pushNamed(AppRoutes.bookingDetail, arguments: targetId);
        } else {
          navigator.pushNamed(AppRoutes.bookingOverview);
        }
    }
  }

  Future<NavigatorState?> _waitForNavigator() async {
    for (var attempt = 0; attempt < 50; attempt++) {
      final state = rootNavigatorKey.currentState;
      if (state != null) {
        return state;
      }
      await Future<void>.delayed(const Duration(milliseconds: 100));
    }
    return null;
  }
}
