import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'device_identity_service.dart';

class PushNotificationService {
  static const _deviceIdentity = DeviceIdentityService();
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;

  // Only meaningful on the long-lived instance that owns the
  // `onTokenRefresh` subscription (created once in `initialize()` at app
  // startup) — that's the only place a token rotation is actually observed,
  // so this is what lets us delete this device's own stale row without
  // touching any other device belonging to the user.
  String? _lastSavedToken;

  SupabaseClient get _supabase => Supabase.instance.client;

  Future<void> initialize() async {
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    debugPrint('Notification permission: ${settings.authorizationStatus}');

    // Push is optional: getToken() fails on devices without Google Play
    // services, without network, or when FCM is temporarily unavailable.
    // That must never stop the app from starting (main() awaits this), so
    // it is logged and skipped; onTokenRefresh below picks the token up
    // later once FCM becomes available.
    try {
      final token = await _messaging.getToken();

      if (token != null) {
        // Try to save immediately if user is already logged in.
        await _saveToken(token);
      }
    } catch (error) {
      debugPrint('FCM token unavailable, continuing without push: $error');
    }

    FirebaseMessaging.instance.onTokenRefresh.listen((newToken) async {
      await _saveToken(newToken);
    });
  }

  Future<void> registerCurrentDevice() async {
    final String? token;
    try {
      token = await _messaging.getToken();
    } catch (error) {
      debugPrint('FCM token unavailable, skipping device registration: $error');
      return;
    }

    if (token == null) {
      debugPrint('FCM token is null.');
      return;
    }

    await _saveToken(token);
  }

  /// Exposes the current FCM token so the phone-login flow can send it
  /// along with the deviceId/PIN payload — lets a brand-new device's
  /// `user_devices` row get its push token set at the moment trust is
  /// first established, instead of racing a separate registration call.
  Future<String?> getToken() async {
    try {
      return await _messaging.getToken();
    } catch (error) {
      debugPrint('FCM token unavailable: $error');
      return null;
    }
  }

  String _resolvePlatform() {
    if (kIsWeb) {
      return 'web';
    }

    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return 'android';
      case TargetPlatform.iOS:
        return 'ios';
      default:
        return 'other';
    }
  }

  Future<void> _saveToken(String token) async {
    final user = _supabase.auth.currentUser;

    if (user == null) {
      debugPrint('User is not logged in yet. FCM token will not be saved.');
      return;
    }

    final previousToken = _lastSavedToken;

    try {
      final deviceId = await _deviceIdentity.getDeviceId();
      await _supabase.from('user_devices').upsert({
        'user_id': user.id,
        'device_id': deviceId,
        'fcm_token': token,
        'platform': _resolvePlatform(),
        'last_seen_at': DateTime.now().toIso8601String(),
      }, onConflict: 'user_id,device_id');

      _lastSavedToken = token;
      debugPrint('FCM token saved to Supabase.');

      if (previousToken != null && previousToken != token) {
        // Token rotated (e.g. app reinstall/data clear) — remove only this
        // device's previous row, scoped to this exact (user, token) pair so
        // no other device is ever touched.
        await _supabase
            .from('user_devices')
            .delete()
            .eq('user_id', user.id)
            .eq('fcm_token', previousToken);
      }
    } catch (e) {
      debugPrint('Failed to save FCM token to Supabase: $e');
    }
  }
}
