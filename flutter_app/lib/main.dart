import 'services/local_notification_service.dart';
import 'services/notification_router_service.dart';
import 'services/push_notification_service.dart';
import 'package:flutter/widgets.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:firebase_core/firebase_core.dart';

import 'app.dart';
import 'core/config/app_config.dart';
import 'firebase_options.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  await initializeDateFormatting('en_MY');

  await Supabase.initialize(
    url: AppConfig.supabaseUrl,
    publishableKey: AppConfig.supabaseAnonKey,
  );

  // Creates the notification channel before FCM or the permission prompt
  // can touch it, so the channel FCM ends up using is this exact one.
  await LocalNotificationService().initialize();
  await PushNotificationService().initialize();
  // Registers the app's only Firebase Messaging listeners and checks for a
  // launch notification. Any resulting navigation runs fire-and-forget so
  // this never blocks startup — see NotificationRouterService.
  await NotificationRouterService().initialize();

  runApp(const SwiperApp());
}
