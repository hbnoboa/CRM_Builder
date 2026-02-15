import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:crm_mobile/core/config/constants.dart';

/// Secure token storage using Keychain (iOS) / Keystore (Android).
/// Replaces web-admin's localStorage for tokens.
class SecureStorage {
  SecureStorage._();

  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );

  // ═══════════════════════════════════════════════════════
  // TOKENS
  // ═══════════════════════════════════════════════════════

  static Future<String?> getAccessToken() async {
    return _storage.read(key: AppConstants.keyAccessToken);
  }

  static Future<String?> getRefreshToken() async {
    return _storage.read(key: AppConstants.keyRefreshToken);
  }

  static Future<void> setTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await Future.wait([
      _storage.write(key: AppConstants.keyAccessToken, value: accessToken),
      _storage.write(key: AppConstants.keyRefreshToken, value: refreshToken),
    ]);
  }

  // ═══════════════════════════════════════════════════════
  // USER CONTEXT
  // ═══════════════════════════════════════════════════════

  static Future<String?> getUserId() async {
    return _storage.read(key: AppConstants.keyUserId);
  }

  static Future<void> setUserId(String userId) async {
    await _storage.write(key: AppConstants.keyUserId, value: userId);
  }

  static Future<String?> getTenantId() async {
    return _storage.read(key: AppConstants.keyTenantId);
  }

  static Future<void> setTenantId(String tenantId) async {
    await _storage.write(key: AppConstants.keyTenantId, value: tenantId);
  }

  // ═══════════════════════════════════════════════════════
  // PLATFORM_ADMIN cross-tenant (mirrors sessionStorage)
  // ═══════════════════════════════════════════════════════

  static const _keySelectedTenantId = 'selectedTenantId';

  static Future<String?> getSelectedTenantId() async {
    return _storage.read(key: _keySelectedTenantId);
  }

  static Future<void> setSelectedTenantId(String? tenantId) async {
    if (tenantId == null) {
      await _storage.delete(key: _keySelectedTenantId);
    } else {
      await _storage.write(key: _keySelectedTenantId, value: tenantId);
    }
  }

  // ═══════════════════════════════════════════════════════
  // BIOMETRIC
  // ═══════════════════════════════════════════════════════

  static Future<bool> isBiometricEnabled() async {
    final value = await _storage.read(key: AppConstants.keyBiometricEnabled);
    return value == 'true';
  }

  static Future<void> setBiometricEnabled(bool enabled) async {
    await _storage.write(
      key: AppConstants.keyBiometricEnabled,
      value: enabled.toString(),
    );
  }

  // ═══════════════════════════════════════════════════════
  // CLEAR ALL (on logout)
  // ═══════════════════════════════════════════════════════

  static Future<void> clearAll() async {
    await _storage.deleteAll();
  }
}
