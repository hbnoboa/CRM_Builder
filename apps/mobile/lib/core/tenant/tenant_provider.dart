import 'package:flutter/foundation.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:crm_mobile/core/auth/auth_provider.dart';
import 'package:crm_mobile/core/auth/secure_storage.dart';
import 'package:crm_mobile/core/database/app_database.dart';
import 'package:crm_mobile/core/network/api_client.dart';
import 'package:crm_mobile/core/theme/theme_provider.dart';

part 'tenant_provider.g.dart';

// ═══════════════════════════════════════════════════════
// TENANT MODELS
// ═══════════════════════════════════════════════════════

/// Accessible tenant info (for multi-tenant users)
/// Includes isHome flag and customRole for that tenant
class AccessibleTenant {
  const AccessibleTenant({
    required this.id,
    required this.name,
    required this.slug,
    this.logo,
    required this.isHome,
    required this.customRole,
  });

  factory AccessibleTenant.fromJson(Map<String, dynamic> json) => AccessibleTenant(
        id: json['id'] as String,
        name: json['name'] as String,
        slug: json['slug'] as String,
        logo: json['logo'] as String?,
        isHome: json['isHome'] as bool? ?? false,
        customRole: AccessibleTenantRole.fromJson(
          json['customRole'] as Map<String, dynamic>,
        ),
      );

  final String id;
  final String name;
  final String slug;
  final String? logo;
  final bool isHome;
  final AccessibleTenantRole customRole;
}

class AccessibleTenantRole {
  const AccessibleTenantRole({
    required this.id,
    required this.name,
    required this.roleType,
  });

  factory AccessibleTenantRole.fromJson(Map<String, dynamic> json) =>
      AccessibleTenantRole(
        id: json['id'] as String,
        name: json['name'] as String,
        // Modelo permission-driven removeu roleType do backend; default seguro.
        roleType: json['roleType'] as String? ?? 'CUSTOM',
      );

  final String id;
  final String name;
  final String roleType;
}

// ═══════════════════════════════════════════════════════
// TENANT SWITCH STATE
// ═══════════════════════════════════════════════════════

class TenantSwitchState {
  const TenantSwitchState({
    this.selectedTenantName,
    this.accessibleTenants = const [],
    this.isLoading = false,
    this.isSwitching = false,
    this.error,
  });

  /// Name of the tenant the user switched to via /auth/switch-tenant
  final String? selectedTenantName;

  /// Tenants accessible to this user (multi-tenant users)
  final List<AccessibleTenant> accessibleTenants;

  final bool isLoading;
  final bool isSwitching;
  final String? error;

  TenantSwitchState copyWith({
    String? selectedTenantName,
    List<AccessibleTenant>? accessibleTenants,
    bool? isLoading,
    bool? isSwitching,
    String? error,
    bool clearError = false,
  }) =>
      TenantSwitchState(
        selectedTenantName: selectedTenantName ?? this.selectedTenantName,
        accessibleTenants: accessibleTenants ?? this.accessibleTenants,
        isLoading: isLoading ?? this.isLoading,
        isSwitching: isSwitching ?? this.isSwitching,
        error: clearError ? null : (error ?? this.error),
      );
}

// ═══════════════════════════════════════════════════════
// PROVIDER (mirrors web-admin TenantContext)
// ═══════════════════════════════════════════════════════

@Riverpod(keepAlive: true)
class TenantSwitch extends _$TenantSwitch {
  @override
  TenantSwitchState build() {
    return const TenantSwitchState();
  }

  /// Load accessible tenants for multi-tenant users.
  /// Fetches from API since Tenant/TenantUser tables are not synced via PowerSync.
  Future<void> loadAccessibleTenants() async {
    state = state.copyWith(isLoading: true, clearError: true);

    try {
      final dio = ref.read(apiClientProvider);
      final response = await dio.get('/auth/accessible-tenants');

      final items = (response.data as List<dynamic>?) ?? [];

      final accessibleTenants = items.map((json) {
        final map = json as Map<String, dynamic>;
        final tenant = map['tenant'] as Map<String, dynamic>? ?? map;
        final role = map['customRole'] as Map<String, dynamic>?;

        return AccessibleTenant(
          id: tenant['id'] as String,
          name: tenant['name'] as String? ?? '',
          slug: tenant['slug'] as String? ?? '',
          logo: tenant['logo'] as String?,
          isHome: map['isHome'] as bool? ?? false,
          customRole: AccessibleTenantRole(
            id: role?['id'] as String? ?? '',
            name: role?['name'] as String? ?? '',
            roleType: role?['roleType'] as String? ?? 'USER',
          ),
        );
      }).toList();

      state = state.copyWith(
        accessibleTenants: accessibleTenants,
        isLoading: false,
      );

      debugPrint('[TenantSwitch] Loaded ${accessibleTenants.length} accessible tenants from API');
    } catch (e) {
      debugPrint('[TenantSwitch] Failed to load accessible tenants from API: $e');
      state = state.copyWith(isLoading: false, accessibleTenants: []);
    }
  }

  /// Switch tenant for multi-tenant users (JWT-based).
  /// Calls /auth/switch-tenant endpoint which returns new tokens.
  Future<void> switchTenantWithJwt(String tenantId) async {
    final authState = ref.read(authProvider);
    if (authState.user?.tenantId == tenantId) {
      debugPrint('[TenantSwitch] Already on tenant $tenantId');
      return;
    }

    state = state.copyWith(isSwitching: true);

    try {
      final dio = ref.read(apiClientProvider);
      final response = await dio.post('/auth/switch-tenant', data: {
        'tenantId': tenantId,
      },);

      final data = response.data as Map<String, dynamic>;
      final user = User.fromJson(data['user'] as Map<String, dynamic>);
      final accessToken = data['accessToken'] as String;
      final refreshToken = data['refreshToken'] as String;

      // Store new tokens
      await SecureStorage.setTokens(
        accessToken: accessToken,
        refreshToken: refreshToken,
      );
      await SecureStorage.setTenantId(user.tenantId);

      // Extract and apply tenant brand color
      final tenantData = data['user']?['tenant'] as Map<String, dynamic>?;
      String? brandColor;
      if (tenantData != null) {
        final settings = tenantData['settings'];
        if (settings is Map<String, dynamic>) {
          final theme = settings['theme'];
          if (theme is Map<String, dynamic>) {
            brandColor = theme['brandColor'] as String?;
          }
        }
      }
      if (brandColor != null && brandColor.isNotEmpty) {
        await SecureStorage.setString('brandColor', brandColor);
      } else {
        await SecureStorage.setString('brandColor', '');
      }
      ref.read(tenantThemeProvider.notifier).applyBrandColor(brandColor);

      // Clear local data and reconnect PowerSync with new tenant
      await AppDatabase.instance.clearData();
      await AppDatabase.instance.connect();

      // Update auth state with new user
      ref.read(authProvider.notifier).updateUser(user);

      // Find tenant name from accessible tenants
      final tenant = state.accessibleTenants.where((t) => t.id == tenantId).firstOrNull;

      state = state.copyWith(
        selectedTenantName: tenant?.name,
        isSwitching: false,
      );

      debugPrint('[TenantSwitch] Switched to tenant: ${tenant?.name} ($tenantId)');
    } catch (e) {
      debugPrint('[TenantSwitch] Failed to switch tenant with JWT: $e');
      state = state.copyWith(
        isSwitching: false,
        error: 'Falha ao trocar tenant',
      );
    }
  }
}
