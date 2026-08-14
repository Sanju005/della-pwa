class AppConfig {
  const AppConfig._();

  static const String appBaseUrl = String.fromEnvironment(
    'APP_BASE_URL',
    defaultValue: 'https://app.dellaapp.com',
  );

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
