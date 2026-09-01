import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class PushNotificationService {
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;

  SupabaseClient get _supabase => Supabase.instance.client;

  Future<void> initialize() async {
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    print(
      'Notification permission: ${settings.authorizationStatus}',
    );

    final token = await _messaging.getToken();

    if (token != null) {
      print('FCM TOKEN: $token');

      // Try to save immediately if user is already logged in.
      await _saveToken(token);
    }

    FirebaseMessaging.instance.onTokenRefresh.listen((newToken) async {
      print('NEW FCM TOKEN: $newToken');

      await _saveToken(newToken);
    });
  }

  Future<void> registerCurrentDevice() async {
    final token = await _messaging.getToken();

    if (token == null) {
      print('FCM token is null.');
      return;
    }

    print('Registering current device with FCM token.');

    await _saveToken(token);
  }

  Future<void> _saveToken(String token) async {
    final user = _supabase.auth.currentUser;

    if (user == null) {
      print(
        'User is not logged in yet. FCM token will not be saved.',
      );
      return;
    }

    try {
      await _supabase.from('user_devices').upsert(
        {
          'user_id': user.id,
          'fcm_token': token,
          'platform': 'android',
        },
        onConflict: 'fcm_token',
      );

      print('FCM token saved to Supabase.');
    } catch (e) {
      print('Failed to save FCM token to Supabase: $e');
    }
  }
}