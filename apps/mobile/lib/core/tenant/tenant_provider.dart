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

  /// Load all tenants from local database (PLATFORM_ADMIN only).
  /// Uses PowerSync synced Tenant table - works offline.
  /// Fallback: if Tenant table not synced, just clears loading state.
  Future<void> loadTenants() async {
    state = state.copyWith(isLoading: true, clearError: true);

    try {
      final db = AppDatabase.instance.db;

      // Check if Tenant table has data (may not be synced for PLATFORM_ADMIN yet)
      final countResult = await db.get('SELECT COUNT(*) as cnt FROM Tenant');
      final count = countResult['cnt'] as int? ?? 0;

      if (count == 0) {
        // Tenant table not synced - clear loading, no error
        // PLATFORM_ADMIN can still use the app, just can't switch tenants
        debugPrint('[TenantSwitch] Tenant table empty - sync not available for PLATFORM_ADMIN');
        state = state.copyWith(isLoading: false, tenants: []);
        return;
      }

      // Query tenants from local SQLite (synced via PowerSync)
      final rows = await db.getAll(
        'SELECT t.*, (SELECT COUNT(*) FROM User u WHERE u.tenantId = t.id) as userCount '
        'FROM Tenant t WHERE t.status = ? ORDER BY t.name ASC',
        ['ACTIVE'],
      );

      final tenants = rows.map((row) => TenantInfo(
        id: row['id'] as String,
        name: row['name'] as String? ?? '',
        slug: row['slug'] as String? ?? '',
        logo: row['logo'] as String?,
        status: row['status'] as String? ?? 'ACTIVE',
        userCount: row['userCount'] as int? ?? 0,
        createdAt: row['createdAt'] as String?,
      )).toList();

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

      debugPrint('[TenantSwitch] Loaded ${tenants.length} tenants from local DB');
    } catch (e) {
      debugPrint('[TenantSwitch] Failed to load tenants: $e');
      // Don't show error - just clear loading state
      state = state.copyWith(isLoading: false, tenants: []);
    }
  }

  /// Load accessible tenants for multi-tenant users from local database.
  /// Uses PowerSync synced TenantUser + Tenant tables - works offline.
  /// Fallback: if tables not synced, just clears loading state.
  Future<void> loadAccessibleTenants() async {
    state = state.copyWith(isLoading: true, clearError: true);

    try {
      final db = AppDatabase.instance.db;
      final authState = ref.read(authProvider);
      final userId = authState.user?.id;

      if (userId == null) {
        state = state.copyWith(isLoading: false);
        return;
      }

      // Check if TenantUser table has data for this user
      final countResult = await db.get(
        'SELECT COUNT(*) as cnt FROM TenantUser WHERE userId = ?',
        [userId],
      );
      final count = countResult['cnt'] as int? ?? 0;

      if (count == 0) {
        // TenantUser not synced - user only has access to current tenant
        debugPrint('[TenantSwitch] TenantUser table empty for user - multi-tenant sync not available');
        state = state.copyWith(isLoading: false, accessibleTenants: []);
        return;
      }

      // Query accessible tenants from local SQLite (synced via PowerSync)
      final rows = await db.getAll(
        '''
        SELECT t.id, t.name, t.slug, t.logo,
               tu.isHome,
               cr.id as roleId, cr.name as roleName, cr.roleType
        FROM TenantUser tu
        INNER JOIN Tenant t ON t.id = tu.tenantId
        LEFT JOIN CustomRole cr ON cr.id = tu.customRoleId
        WHERE tu.userId = ?
        ORDER BY tu.isHome DESC, t.name ASC
        ''',
        [userId],
      );

      final accessibleTenants = rows.map((row) => AccessibleTenant(
        id: row['id'] as String,
        name: row['name'] as String? ?? '',
        slug: row['slug'] as String? ?? '',
        logo: row['logo'] as String?,
        isHome: (row['isHome'] as int? ?? 0) == 1,
        customRole: AccessibleTenantRole(
          id: row['roleId'] as String? ?? '',
          name: row['roleName'] as String? ?? '',
          roleType: row['roleType'] as String? ?? 'USER',
        ),
      )).toList();

      state = state.copyWith(
        accessibleTenants: accessibleTenants,
        isLoading: false,
      );

      debugPrint('[TenantSwitch] Loaded ${accessibleTenants.length} accessible tenants from local DB');
    } catch (e) {
      debugPrint('[TenantSwitch] Failed to load accessible tenants: $e');
      // Don't show error - just clear loading state
      state = state.copyWith(isLoading: false, accessibleTenants: []);
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
