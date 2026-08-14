import 'app_origin_stub.dart'
    if (dart.library.html) 'app_origin_web.dart';

class AppConfig {
  const AppConfig._();

  static const String _configuredAppBaseUrl = String.fromEnvironment(
    'APP_BASE_URL',
    defaultValue: '',
  );

  static String get appBaseUrl {
    if (_configuredAppBaseUrl.isNotEmpty) {
      return _configuredAppBaseUrl;
    }

    final origin = currentAppOrigin();
    if (origin != null && origin.isNotEmpty) {
      return origin;
    }

    return 'https://app.dellaapp.com';
  }

  static const String supabaseUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://exsoqkvwzzwmaqxkkoab.supabase.co',
  );

  static const String supabaseAnonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue:
        'sb_publishable_U53GpB48pe3fIBAOCbozoA_OFV4qBj1',
  );
}
