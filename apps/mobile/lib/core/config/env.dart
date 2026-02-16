/// Environment configuration.
/// Values are read from compile-time constants (--dart-define).
class Env {
  Env._();

  static const String apiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://136.114.109.222/api/v1',
  );

  static const String powerSyncUrl = String.fromEnvironment(
    'POWERSYNC_URL',
    defaultValue: 'http://136.114.109.222:8080',
  );

  /// Timeout for API calls in milliseconds.
  static const int apiTimeout = 30000;

  /// Max image dimension for compression (px).
  static const int maxImageDimension = 1200;

  /// Image compression quality (0-100).
  static const int imageQuality = 80;

  /// Image cache size limit in MB.
  static const int imageCacheLimitMb = 200;

  /// Auto-logout timeout in minutes.
  static const int autoLogoutMinutes = 30;

  /// Background sync interval in minutes.
  static const int backgroundSyncMinutes = 15;
}
