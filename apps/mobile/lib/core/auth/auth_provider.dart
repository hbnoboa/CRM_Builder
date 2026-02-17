import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:crm_mobile/core/auth/secure_storage.dart';
import 'package:crm_mobile/core/database/app_database.dart';
import 'package:crm_mobile/core/network/api_client.dart';
import 'package:crm_mobile/core/push/push_notification_service.dart';

part 'auth_provider.g.dart';

/// Hash password for offline storage (SHA-256).
/// Note: This is for offline verification only, not for production auth.
String _hashPassword(String password, String salt) {
  final bytes = utf8.encode('$password:$salt');
  return sha256.convert(bytes).toString();
}

// ═══════════════════════════════════════════════════════
// USER MODEL (matches web-admin User type)
// ═══════════════════════════════════════════════════════

class User {

  factory User.fromJson(Map<String, dynamic> json) => User(
        id: json['id'] as String,
        tenantId: json['tenantId'] as String,
        email: json['email'] as String,
        name: json['name'] as String,
        avatar: json['avatar'] as String?,
        customRole: json['customRole'] != null
            ? CustomRole.fromJson(json['customRole'] as Map<String, dynamic>)
            : null,
        status: json['status'] as String?,
        lastLoginAt: json['lastLoginAt'] as String?,
        createdAt: json['createdAt'] as String?,
      );
  const User({
    required this.id,
    required this.tenantId,
    required this.email,
    required this.name,
    this.avatar,
    this.customRole,
    this.status,
    this.lastLoginAt,
    this.createdAt,
  });

  final String id;
  final String tenantId;
  final String email;
  final String name;
  final String? avatar;
  final CustomRole? customRole;
  final String? status;
  final String? lastLoginAt;
  final String? createdAt;
}

class CustomRole {

  factory CustomRole.fromJson(Map<String, dynamic> json) => CustomRole(
        id: json['id'] as String,
        name: json['name'] as String,
        description: json['description'] as String?,
        color: json['color'] as String?,
        roleType: json['roleType'] as String,
        isSystem: json['isSystem'] as bool? ?? false,
        permissions: json['permissions'] as List<dynamic>?,
        modulePermissions: json['modulePermissions'] as Map<String, dynamic>?,
      );
  const CustomRole({
    required this.id,
    required this.name,
    this.description,
    this.color,
    required this.roleType,
    required this.isSystem,
    this.permissions,
    this.modulePermissions,
  });

  final String id;
  final String name;
  final String? description;
  final String? color;
  final String roleType;
  final bool isSystem;
  final List<dynamic>? permissions;
  final Map<String, dynamic>? modulePermissions;
}

// ═══════════════════════════════════════════════════════
// AUTH STATE
// ═══════════════════════════════════════════════════════

class AuthState {
  const AuthState({
    this.user,
    this.isAuthenticated = false,
    this.isLoading = false,
    this.error,
  });

  final User? user;
  final bool isAuthenticated;
  final bool isLoading;
  final String? error;

  AuthState copyWith({
    User? user,
    bool? isAuthenticated,
    bool? isLoading,
    String? error,
    bool clearError = false,
    bool clearUser = false,
  }) =>
      AuthState(
        user: clearUser ? null : (user ?? this.user),
        isAuthenticated: isAuthenticated ?? this.isAuthenticated,
        isLoading: isLoading ?? this.isLoading,
        error: clearError ? null : (error ?? this.error),
      );
}

// ═══════════════════════════════════════════════════════
// AUTH NOTIFIER (mirrors auth-store.ts)
// ═══════════════════════════════════════════════════════

@riverpod
class Auth extends _$Auth {
  /// Flag to prevent race condition between _checkExistingSession and login/register
  bool _manualAuthInProgress = false;

  @override
  AuthState build() {
    // Schedule session check after state is initialized
    Future.microtask(() => _checkExistingSession());
    return const AuthState(isLoading: true);
  }

  Future<void> _checkExistingSession() async {
    // If a manual auth action (login/register) already happened, skip
    if (_manualAuthInProgress || state.isAuthenticated) {
      return;
    }

    final token = await SecureStorage.getAccessToken();
    if (token == null) {
      // Only update state if no manual auth happened meanwhile
      if (!_manualAuthInProgress && !state.isAuthenticated) {
        state = const AuthState(isLoading: false);
      }
      return;
    }

    try {
      // Double-check before calling getProfile
      if (_manualAuthInProgress || state.isAuthenticated) {
        return;
      }
      await _restoreSession();
    } catch (_) {
      // Only update state if no manual auth happened meanwhile
      if (!_manualAuthInProgress && !state.isAuthenticated) {
        state = const AuthState(isLoading: false);
      }
    }
  }

  /// Restore session from stored token (used by _checkExistingSession and biometric login)
  Future<void> _restoreSession() async {
    try {
      final dio = ref.read(apiClientProvider);
      final response = await dio.get('/auth/me');
      final user = User.fromJson(response.data as Map<String, dynamic>);

      // Only update if no manual auth happened meanwhile
      if (!_manualAuthInProgress) {
        state = AuthState(
          user: user,
          isAuthenticated: true,
          isLoading: false,
        );

        // Connect PowerSync if not already connected
        await AppDatabase.instance.connect();

        // Re-register device token on session restore
        PushNotificationService.instance.registerDeviceToken();
      }
    } catch (_) {
      // Only clear if no manual auth happened
      if (!_manualAuthInProgress && !state.isAuthenticated) {
        await SecureStorage.clearAll();
        await AppDatabase.instance.clearData();
        state = const AuthState(isLoading: false);
      }
      rethrow;
    }
  }

  /// Restore session using biometric authentication
  Future<bool> restoreSessionWithBiometrics() async {
    final token = await SecureStorage.getAccessToken();
    if (token == null) return false;

    _manualAuthInProgress = true;
    state = state.copyWith(isLoading: true, clearError: true);

    try {
      await _restoreSession();
      _manualAuthInProgress = false;
      return true;
    } catch (_) {
      _manualAuthInProgress = false;
      state = const AuthState(isLoading: false);
      return false;
    }
  }

  /// Login with email/password. Supports offline login with cached credentials.
  Future<void> login({
    required String email,
    required String password,
    bool rememberMe = false,
  }) async {
    // Set flag to prevent race condition with _checkExistingSession
    _manualAuthInProgress = true;
    state = state.copyWith(isLoading: true, clearError: true);

    // Check connectivity first
    final connectivity = await Connectivity().checkConnectivity();
    final isOnline = !connectivity.contains(ConnectivityResult.none) &&
        connectivity.isNotEmpty;

    // If offline, try offline login directly
    if (!isOnline) {
      debugPrint('[Auth] Offline - attempting offline login');
      await _offlineLogin(email: email, password: password);
      return;
    }

    try {
      final dio = ref.read(apiClientProvider);
      final response = await dio.post('/auth/login', data: {
        'email': email,
        'password': password,
      },);

      final data = response.data as Map<String, dynamic>;
      final user = User.fromJson(data['user'] as Map<String, dynamic>);
      final accessToken = data['accessToken'] as String;
      final refreshToken = data['refreshToken'] as String;

      await SecureStorage.setTokens(
        accessToken: accessToken,
        refreshToken: refreshToken,
      );
      await SecureStorage.setUserId(user.id);
      await SecureStorage.setTenantId(user.tenantId);

      // Cache credentials for offline login (use tenantId as salt)
      final passwordHash = _hashPassword(password, user.tenantId);
      await SecureStorage.cacheCredentials(
        email: email,
        passwordHash: passwordHash,
        userJson: jsonEncode(data['user']),
      );

      // Save remember me preference for biometric login
      if (rememberMe) {
        await SecureStorage.setBiometricEnabled(true);
      }

      debugPrint('[Auth] Login success, setting state isAuthenticated=true');
      state = AuthState(
        user: user,
        isAuthenticated: true,
        isLoading: false,
      );
      debugPrint('[Auth] State updated: isAuthenticated=${state.isAuthenticated}');

      _manualAuthInProgress = false;

      // Connect PowerSync to start syncing data (non-blocking)
      AppDatabase.instance.connect().catchError((e) {
        // PowerSync connection failure should not block login
        debugPrint('[Auth] PowerSync connect failed: $e');
      });

      // Register device for push notifications (non-blocking)
      PushNotificationService.instance.registerDeviceToken();
    } on DioException catch (e) {
      // Network error - try offline login as fallback
      if (_isNetworkError(e)) {
        debugPrint('[Auth] Network error - attempting offline login fallback');
        await _offlineLogin(email: email, password: password);
        return;
      }

      _manualAuthInProgress = false;
      final message = _extractErrorMessage(e, 'Falha no login');
      state = state.copyWith(
        isLoading: false,
        error: message,
      );
      rethrow;
    } catch (e) {
      _manualAuthInProgress = false;
      final message = _extractErrorMessage(e, 'Falha no login');
      state = state.copyWith(
        isLoading: false,
        error: message,
      );
      rethrow;
    }
  }

  /// Check if error is a network-related error.
  bool _isNetworkError(DioException e) {
    return e.type == DioExceptionType.connectionError ||
        e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.sendTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.error.toString().contains('SocketException') ||
        e.error.toString().contains('Network is unreachable');
  }

  /// Offline login using cached credentials.
  Future<void> _offlineLogin({
    required String email,
    required String password,
  }) async {
    try {
      // Check if we have cached credentials
      final hasCache = await SecureStorage.hasOfflineCredentials();
      if (!hasCache) {
        _manualAuthInProgress = false;
        state = state.copyWith(
          isLoading: false,
          error: 'Sem conexao e sem credenciais salvas. Faca login online primeiro.',
        );
        return;
      }

      // Verify email matches
      final cachedEmail = await SecureStorage.getCachedEmail();
      if (cachedEmail?.toLowerCase() != email.toLowerCase()) {
        _manualAuthInProgress = false;
        state = state.copyWith(
          isLoading: false,
          error: 'Email nao corresponde ao usuario salvo offline.',
        );
        return;
      }

      // Get cached user data to extract tenantId for hash verification
      final cachedUserJson = await SecureStorage.getCachedUserJson();
      if (cachedUserJson == null) {
        _manualAuthInProgress = false;
        state = state.copyWith(
          isLoading: false,
          error: 'Dados do usuario nao encontrados.',
        );
        return;
      }

      final userData = jsonDecode(cachedUserJson) as Map<String, dynamic>;
      final tenantId = userData['tenantId'] as String;

      // Verify password hash
      final cachedHash = await SecureStorage.getCachedPasswordHash();
      final inputHash = _hashPassword(password, tenantId);

      if (cachedHash != inputHash) {
        _manualAuthInProgress = false;
        state = state.copyWith(
          isLoading: false,
          error: 'Senha incorreta.',
        );
        return;
      }

      // Password verified - restore user from cache
      final user = User.fromJson(userData);

      await SecureStorage.setUserId(user.id);
      await SecureStorage.setTenantId(user.tenantId);

      debugPrint('[Auth] Offline login success for ${user.email}');
      state = AuthState(
        user: user,
        isAuthenticated: true,
        isLoading: false,
      );

      _manualAuthInProgress = false;

      // Database already has local data from previous sync
      // PowerSync will auto-sync when connection is restored
    } catch (e) {
      _manualAuthInProgress = false;
      debugPrint('[Auth] Offline login error: $e');
      state = state.copyWith(
        isLoading: false,
        error: 'Falha no login offline.',
      );
    }
  }

  /// Register new user. Mirrors auth-store.ts register().
  Future<void> register({
    required String name,
    required String email,
    required String password,
    required String tenantName,
  }) async {
    // Set flag to prevent race condition with _checkExistingSession
    _manualAuthInProgress = true;
    state = state.copyWith(isLoading: true, clearError: true);

    try {
      final dio = ref.read(apiClientProvider);
      final response = await dio.post('/auth/register', data: {
        'name': name,
        'email': email,
        'password': password,
        'tenantName': tenantName,
      },);

      final data = response.data as Map<String, dynamic>;
      final user = User.fromJson(data['user'] as Map<String, dynamic>);
      final accessToken = data['accessToken'] as String;
      final refreshToken = data['refreshToken'] as String;

      await SecureStorage.setTokens(
        accessToken: accessToken,
        refreshToken: refreshToken,
      );
      await SecureStorage.setUserId(user.id);
      await SecureStorage.setTenantId(user.tenantId);

      state = AuthState(
        user: user,
        isAuthenticated: true,
        isLoading: false,
      );

      _manualAuthInProgress = false;

      // Connect PowerSync to start syncing data (non-blocking)
      AppDatabase.instance.connect().catchError((e) {
        debugPrint('[Auth] PowerSync connect failed: $e');
      });

      // Register device for push notifications (non-blocking)
      PushNotificationService.instance.registerDeviceToken();
    } catch (e) {
      _manualAuthInProgress = false;
      final message = _extractErrorMessage(e, 'Falha no registro');
      state = state.copyWith(
        isLoading: false,
        error: message,
      );
      rethrow;
    }
  }

  /// Logout. Works offline - clears session but keeps credential cache.
  Future<void> logout({bool clearOfflineCache = false}) async {
    // Unregister push token before logout (non-blocking, may fail offline)
    PushNotificationService.instance.unregisterDeviceToken().catchError((_) {});

    try {
      final dio = ref.read(apiClientProvider);
      await dio.post('/auth/logout');
    } catch (_) {
      // Ignore logout errors - works offline
      debugPrint('[Auth] Logout API call failed (offline mode)');
    } finally {
      // Disconnect PowerSync
      await AppDatabase.instance.disconnect();

      if (clearOfflineCache) {
        // Full clear - remove everything including offline credentials
        await AppDatabase.instance.clearData();
        await SecureStorage.clearAll();
      } else {
        // Normal logout - keep offline credentials for future offline login
        // Keep local database so user can view data offline after re-login
        await SecureStorage.clearSession();
      }

      state = const AuthState();
      debugPrint('[Auth] Logout complete (clearOfflineCache=$clearOfflineCache)');
    }
  }

  /// Get current user profile. Mirrors auth-store.ts getProfile().
  Future<void> getProfile() async {
    state = state.copyWith(isLoading: true);

    try {
      final dio = ref.read(apiClientProvider);
      final response = await dio.get('/auth/me');
      final user = User.fromJson(response.data as Map<String, dynamic>);

      state = AuthState(
        user: user,
        isAuthenticated: true,
        isLoading: false,
      );

      // Connect PowerSync if not already connected
      await AppDatabase.instance.connect();

      // Re-register device token on profile refresh
      PushNotificationService.instance.registerDeviceToken();
    } catch (_) {
      await SecureStorage.clearAll();
      await AppDatabase.instance.clearData();
      state = const AuthState(isLoading: false);
    }
  }

  void clearError() {
    state = state.copyWith(clearError: true);
  }

  String _extractErrorMessage(dynamic error, String fallback) {
    if (error is Exception) {
      try {
        final dynamic dioError = error;
        final response = (dioError as dynamic).response;
        if (response != null) {
          final data = response.data;
          if (data is Map && data.containsKey('message')) {
            return data['message'] as String;
          }
        }
      } catch (_) {}
    }
    return fallback;
  }
}
