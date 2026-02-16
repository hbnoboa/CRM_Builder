/// App-wide constants.
class AppConstants {
  AppConstants._();

  static const String appName = 'CRM Builder';
  static const int defaultPageSize = 10;

  // Secure storage keys
  static const String keyAccessToken = 'accessToken';
  static const String keyRefreshToken = 'refreshToken';
  static const String keyUserId = 'userId';
  static const String keyTenantId = 'tenantId';
  static const String keyBiometricEnabled = 'biometricEnabled';
  static const String keyPermissionsOnboarding = 'permissionsOnboardingCompleted';

  // Upload
  static const int maxUploadSizeMb = 10;
  static const List<String> allowedImageTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
  ];
}
