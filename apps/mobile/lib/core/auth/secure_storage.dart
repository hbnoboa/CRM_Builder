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
  // GENERIC KEY-VALUE
  // ═══════════════════════════════════════════════════════

  static Future<String?> getString(String key) async {
    return _storage.read(key: key);
  }

  static Future<void> setString(String key, String value) async {
    await _storage.write(key: key, value: value);
  }

  // ═══════════════════════════════════════════════════════
  // OFFLINE AUTH CACHE
  // ═══════════════════════════════════════════════════════

  /// Cache credentials for offline login and silent re-auth.
  /// Stores email, password (encrypted by Keychain/Keystore), hash, and user JSON.
  static Future<void> cacheCredentials({
    required String email,
    required String password,
    required String passwordHash,
    required String userJson,
  }) async {
    await Future.wait([
      _storage.write(key: AppConstants.keyCachedEmail, value: email.toLowerCase()),
      _storage.write(key: AppConstants.keyCachedPassword, value: password),
      _storage.write(key: AppConstants.keyCachedPasswordHash, value: passwordHash),
      _storage.write(key: AppConstants.keyCachedUserJson, value: userJson),
    ]);
  }

  /// Get cached password for silent re-authentication.
  static Future<String?> getCachedPassword() async {
    return _storage.read(key: AppConstants.keyCachedPassword);
  }

  /// Get cached email for offline login.
  static Future<String?> getCachedEmail() async {
    return _storage.read(key: AppConstants.keyCachedEmail);
  }

  /// Get cached password hash for offline verification.
  static Future<String?> getCachedPasswordHash() async {
    return _storage.read(key: AppConstants.keyCachedPasswordHash);
  }

  /// Get cached user JSON for offline login.
  static Future<String?> getCachedUserJson() async {
    return _storage.read(key: AppConstants.keyCachedUserJson);
  }

  /// Check if offline credentials are cached.
  static Future<bool> hasOfflineCredentials() async {
    final email = await getCachedEmail();
    final hash = await getCachedPasswordHash();
    final user = await getCachedUserJson();
    return email != null && hash != null && user != null;
  }

  // ═══════════════════════════════════════════════════════
  // CLEAR ALL (on logout)
  // ═══════════════════════════════════════════════════════

  /// Clear session data (tokens) but KEEP offline credentials cache.
  /// Used for normal logout so user can login again offline.
  static Future<void> clearSession() async {
    await Future.wait([
      _storage.delete(key: AppConstants.keyAccessToken),
      _storage.delete(key: AppConstants.keyRefreshToken),
      _storage.delete(key: _keySelectedTenantId),
    ]);
  }

  /// Clear ALL data including offline credentials.
  /// Used when user explicitly wants to remove all cached data.
  static Future<void> clearAll() async {
    await _storage.deleteAll();
  }
}
