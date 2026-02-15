import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:crm_mobile/core/auth/secure_storage.dart';
import 'package:crm_mobile/core/database/app_database.dart';
import 'package:crm_mobile/core/network/api_client.dart';
import 'package:crm_mobile/core/push/push_notification_service.dart';

part 'auth_provider.g.dart';

// ═══════════════════════════════════════════════════════
// USER MODEL (matches web-admin User type)
// ═══════════════════════════════════════════════════════

class User {
  const User({
    required this.id,
    required this.tenantId,
    required this.email,
    required this.name,
    this.avatar,
    this.customRole,
    required this.status,
    this.lastLoginAt,
    required this.createdAt,
  });

  final String id;
  final String tenantId;
  final String email;
  final String name;
  final String? avatar;
  final CustomRole? customRole;
  final String status;
  final String? lastLoginAt;
  final String createdAt;

  factory User.fromJson(Map<String, dynamic> json) => User(
        id: json['id'] as String,
        tenantId: json['tenantId'] as String,
        email: json['email'] as String,
        name: json['name'] as String,
        avatar: json['avatar'] as String?,
        customRole: json['customRole'] != null
            ? CustomRole.fromJson(json['customRole'] as Map<String, dynamic>)
            : null,
        status: json['status'] as String,
        lastLoginAt: json['lastLoginAt'] as String?,
        createdAt: json['createdAt'] as String,
      );
}

class CustomRole {
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
  @override
  AuthState build() {
    // Check for existing session on startup
    _checkExistingSession();
    return const AuthState(isLoading: true);
  }

  Future<void> _checkExistingSession() async {
    final token = await SecureStorage.getAccessToken();
    if (token == null) {
      state = const AuthState(isLoading: false);
      return;
    }

    try {
      await getProfile();
    } catch (_) {
      state = const AuthState(isLoading: false);
    }
  }

  /// Login with email/password. Mirrors auth-store.ts login().
  Future<void> login({
    required String email,
    required String password,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true);

    try {
      final dio = ref.read(apiClientProvider);
      final response = await dio.post('/auth/login', data: {
        'email': email,
        'password': password,
      });

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

      // Connect PowerSync to start syncing data
      await AppDatabase.instance.connect();

      // Register device for push notifications
      PushNotificationService.instance.registerDeviceToken();
    } catch (e) {
      final message = _extractErrorMessage(e, 'Falha no login');
      state = state.copyWith(
        isLoading: false,
        error: message,
      );
      rethrow;
    }
  }

  /// Register new user. Mirrors auth-store.ts register().
  Future<void> register({
    required String name,
    required String email,
    required String password,
    required String tenantName,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true);

    try {
      final dio = ref.read(apiClientProvider);
      final response = await dio.post('/auth/register', data: {
        'name': name,
        'email': email,
        'password': password,
        'tenantName': tenantName,
      });

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

      // Connect PowerSync to start syncing data
      await AppDatabase.instance.connect();

      // Register device for push notifications
      PushNotificationService.instance.registerDeviceToken();
    } catch (e) {
      final message = _extractErrorMessage(e, 'Falha no registro');
      state = state.copyWith(
        isLoading: false,
        error: message,
      );
      rethrow;
    }
  }

  /// Logout. Mirrors auth-store.ts logout().
  Future<void> logout() async {
    // Unregister push token before logout
    await PushNotificationService.instance.unregisterDeviceToken();

    try {
      final dio = ref.read(apiClientProvider);
      await dio.post('/auth/logout');
    } catch (_) {
      // Ignore logout errors (same as web-admin)
    } finally {
      await AppDatabase.instance.clearData();
      await SecureStorage.clearAll();
      state = const AuthState();
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
