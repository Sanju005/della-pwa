import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// Shared local-notification plumbing. Used for the one-time login-welcome
/// notification and to display FCM pushes while the app is in the
/// foreground (FCM's own `notification` block does not auto-display
/// there). [NotificationRouterService] owns the actual routing decisions;
/// this class only shows notifications and reports raw tap payloads back
/// via [onNotificationTap].
class LocalNotificationService {
  LocalNotificationService._internal();

  static final LocalNotificationService _instance =
      LocalNotificationService._internal();

  factory LocalNotificationService() => _instance;

  static const String channelId = 'swiper_default_channel';
  static const String _channelName = 'Swiper Notifications';
  static const String _channelDescription =
      'Booking, message, and account notifications.';

  final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();

  bool _initialized = false;

  /// Set by [NotificationRouterService] before/after [initialize] — read
  /// lazily on each tap, so registration order doesn't matter. Receives
  /// exactly the payload string passed to [show], never the notification
  /// title/body.
  void Function(String? payload)? onNotificationTap;

  Future<void> initialize() async {
    if (_initialized) {
      return;
    }

    const androidSettings = AndroidInitializationSettings(
      '@mipmap/ic_launcher',
    );
    const initSettings = InitializationSettings(android: androidSettings);

    await _plugin.initialize(
      initSettings,
      onDidReceiveNotificationResponse: (details) {
        onNotificationTap?.call(details.payload);
      },
    );

    const channel = AndroidNotificationChannel(
      channelId,
      _channelName,
      description: _channelDescription,
      importance: Importance.high,
    );

    await _plugin
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.createNotificationChannel(channel);

    _initialized = true;
  }

  Future<void> showLoginWelcomeNotification(String? name) async {
    final trimmedName = name?.trim();
    final title = trimmedName != null && trimmedName.isNotEmpty
        ? 'Welcome back, $trimmedName'
        : 'Welcome back';

    // No payload: tapping this notification has nothing to route to.
    await show(title: title, body: "You're signed in to Swiper.");
  }

  /// Shows a single local notification. [id] should be stable per
  /// event/booking where practical so a duplicate delivery of the same
  /// event doesn't show twice. [payload] carries only routing fields
  /// (type/event/bookingId/...) — never message content — and is handed
  /// back verbatim to [onNotificationTap] on tap.
  Future<void> show({
    required String title,
    required String body,
    int? id,
    String? payload,
  }) async {
    await initialize();

    final androidDetails = AndroidNotificationDetails(
      channelId,
      _channelName,
      channelDescription: _channelDescription,
      importance: Importance.high,
      priority: Priority.high,
      // Expands the notification to show the full body text instead of
      // collapsing it to a single truncated line.
      styleInformation: BigTextStyleInformation(body, contentTitle: title),
    );
    final details = NotificationDetails(android: androidDetails);

    try {
      await _plugin.show(
        id ?? DateTime.now().millisecondsSinceEpoch.remainder(1 << 31),
        title,
        body,
        details,
        payload: payload,
      );
    } catch (e) {
      debugPrint('Failed to show local notification: $e');
    }
  }
}
