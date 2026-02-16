import 'package:flutter/foundation.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:crm_mobile/core/auth/secure_storage.dart';
import 'package:crm_mobile/core/database/app_database.dart';
import 'package:crm_mobile/core/network/api_client.dart';

part 'tenant_provider.g.dart';

// ═══════════════════════════════════════════════════════
// TENANT MODEL
// ═══════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════
// TENANT SWITCH STATE
// ═══════════════════════════════════════════════════════

class TenantSwitchState {
  const TenantSwitchState({
    this.selectedTenantId,
    this.selectedTenantName,
    this.tenants = const [],
    this.isLoading = false,
    this.isSwitching = false,
    this.error,
  });

  final String? selectedTenantId;
  final String? selectedTenantName;
  final List<TenantInfo> tenants;
  final bool isLoading;
  final bool isSwitching;
  final String? error;

  TenantSwitchState copyWith({
    String? selectedTenantId,
    String? selectedTenantName,
    List<TenantInfo>? tenants,
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

  /// Restore previously selected tenant from SecureStorage.
  Future<void> _init() async {
    final selectedId = await SecureStorage.getSelectedTenantId();
    if (selectedId != null) {
      state = state.copyWith(selectedTenantId: selectedId);
      // We don't know the name yet; it will be set when loadTenants() is called
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

  /// Switch to a different tenant. Clears local PowerSync data
  /// and reconnects with the new tenantId.
  Future<void> switchTenant(String tenantId, String tenantName) async {
    if (tenantId == state.selectedTenantId) return;

    state = state.copyWith(isSwitching: true);

    try {
      await SecureStorage.setSelectedTenantId(tenantId);

      // Clear local data and reconnect PowerSync.
      // PowerSync connector's fetchCredentials will now include
      // the new tenantId in the /sync/credentials request.
      await AppDatabase.instance.clearData();
      await AppDatabase.instance.connect();

      state = state.copyWith(
        selectedTenantId: tenantId,
        selectedTenantName: tenantName,
        isSwitching: false,
      );

      debugPrint('[TenantSwitch] Switched to tenant: $tenantName ($tenantId)');
    } catch (e) {
      debugPrint('[TenantSwitch] Failed to switch tenant: $e');
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

      state = const TenantSwitchState();

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
