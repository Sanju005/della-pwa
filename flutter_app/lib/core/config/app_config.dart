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
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4c29xa3Z3enp3bWFxeGtrb2FiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNDU0NzUsImV4cCI6MjA5NTYyMTQ3NX0.xRV4Y4wBM2qicS4HEDQMWXBIfOFDA6tq9svKvVlaKvc',
  );
}
