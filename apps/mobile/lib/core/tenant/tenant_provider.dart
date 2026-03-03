import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
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

/// Basic tenant info (for PLATFORM_ADMIN listing all tenants)
class TenantInfo {
  const TenantInfo({
    required this.id,
    required this.name,
    required this.slug,
    this.logo,
    this.status = 'ACTIVE',
    this.userCount = 0,
    this.createdAt,
  });

  factory TenantInfo.fromJson(Map<String, dynamic> json) => TenantInfo(
        id: json['id'] as String,
        name: json['name'] as String,
        slug: json['slug'] as String,
        logo: json['logo'] as String?,
        status: json['status'] as String? ?? 'ACTIVE',
        userCount: (json['_count'] as Map<String, dynamic>?)?['users'] as int? ?? 0,
        createdAt: json['createdAt'] as String?,
      );

  final String id;
  final String name;
  final String slug;
  final String? logo;
  final String status;
  final int userCount;
  final String? createdAt;
}

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
        roleType: json['roleType'] as String,
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
    this.selectedTenantId,
    this.selectedTenantName,
    this.tenants = const [],
    this.accessibleTenants = const [],
    this.isLoading = false,
    this.isSwitching = false,
    this.error,
  });

  /// Currently selected tenant ID (for PLATFORM_ADMIN or after switch)
  final String? selectedTenantId;
  final String? selectedTenantName;

  /// All tenants (PLATFORM_ADMIN only)
  final List<TenantInfo> tenants;

  /// Tenants accessible to this user (multi-tenant users)
  final List<AccessibleTenant> accessibleTenants;

  final bool isLoading;
  final bool isSwitching;
  final String? error;

  TenantSwitchState copyWith({
    String? selectedTenantId,
    String? selectedTenantName,
    List<TenantInfo>? tenants,
    List<AccessibleTenant>? accessibleTenants,
    bool? isLoading,
    bool? isSwitching,
    String? error,
    bool clearSelection = false,
    bool clearError = false,
  }) =>
      TenantSwitchState(
        selectedTenantId: clearSelection ? null : (selectedTenantId ?? this.selectedTenantId),
        selectedTenantName: clearSelection ? null : (selectedTenantName ?? this.selectedTenantName),
        tenants: tenants ?? this.tenants,
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
    _init();
    return const TenantSwitchState();
  }

  /// Restore previously selected tenant from SecureStorage (PLATFORM_ADMIN only).
  Future<void> _init() async {
    final selectedId = await SecureStorage.getSelectedTenantId();
    if (selectedId != null) {
      state = state.copyWith(selectedTenantId: selectedId);
    }
  }

  /// Load all tenants from the API (PLATFORM_ADMIN only).
  Future<void> loadTenants() async {
    state = state.copyWith(isLoading: true, clearError: true);

    try {
      final dio = ref.read(apiClientProvider);
      final response = await dio.get('/tenants', queryParameters: {
        'limit': 100,
      });

      final data = response.data['data'] as List;
      final tenants = data
          .map((t) => TenantInfo.fromJson(t as Map<String, dynamic>))
          .toList();

      // If we have a selectedTenantId but no name, resolve it
      String? tenantName = state.selectedTenantName;
      if (state.selectedTenantId != null && tenantName == null) {
        final match = tenants.where((t) => t.id == state.selectedTenantId).firstOrNull;
        tenantName = match?.name;
      }

      state = state.copyWith(
        tenants: tenants,
        isLoading: false,
        selectedTenantName: tenantName,
      );
    } catch (e) {
      debugPrint('[TenantSwitch] Failed to load tenants: $e');
      state = state.copyWith(
        isLoading: false,
        error: 'Falha ao carregar tenants',
      );
    }
  }

  /// Load accessible tenants for multi-tenant users.
  Future<void> loadAccessibleTenants() async {
    state = state.copyWith(isLoading: true, clearError: true);

    try {
      final dio = ref.read(apiClientProvider);
      final response = await dio.get('/auth/accessible-tenants');

      final data = response.data as List;
      final accessibleTenants = data
          .map((t) => AccessibleTenant.fromJson(t as Map<String, dynamic>))
          .toList();

      state = state.copyWith(
        accessibleTenants: accessibleTenants,
        isLoading: false,
      );

      debugPrint('[TenantSwitch] Loaded ${accessibleTenants.length} accessible tenants');
    } catch (e) {
      debugPrint('[TenantSwitch] Failed to load accessible tenants: $e');
      state = state.copyWith(
        isLoading: false,
        error: 'Falha ao carregar tenants acessiveis',
      );
    }
  }

  /// Switch tenant for PLATFORM_ADMIN (session-based, no JWT change).
  /// Uses SecureStorage and clears PowerSync data.
  Future<void> switchTenant(String tenantId, String tenantName) async {
    if (tenantId == state.selectedTenantId) return;

    state = state.copyWith(isSwitching: true);

    try {
      await SecureStorage.setSelectedTenantId(tenantId);

      // Clear local data and reconnect PowerSync.
      await AppDatabase.instance.clearData();
      await AppDatabase.instance.connect();

      state = state.copyWith(
        selectedTenantId: tenantId,
        selectedTenantName: tenantName,
        isSwitching: false,
      );

      debugPrint('[TenantSwitch] PLATFORM_ADMIN switched to tenant: $tenantName ($tenantId)');
    } catch (e) {
      debugPrint('[TenantSwitch] Failed to switch tenant: $e');
      state = state.copyWith(
        isSwitching: false,
        error: 'Falha ao trocar tenant',
      );
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
      });

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
        selectedTenantId: tenantId,
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

  /// Clear tenant selection (go back to user's own tenant).
  Future<void> clearSelection() async {
    state = state.copyWith(isSwitching: true);

    try {
      await SecureStorage.setSelectedTenantId(null);
      await AppDatabase.instance.clearData();
      await AppDatabase.instance.connect();

      state = state.copyWith(
        clearSelection: true,
        isSwitching: false,
      );

      debugPrint('[TenantSwitch] Cleared tenant selection');
    } catch (e) {
      debugPrint('[TenantSwitch] Failed to clear selection: $e');
      state = state.copyWith(
        isSwitching: false,
        error: 'Falha ao restaurar tenant',
      );
    }
  }
}
