import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:crm_mobile/core/auth/auth_provider.dart';

part 'permission_provider.g.dart';

/// Port of web-admin's use-permissions.ts hook to Riverpod.
/// Provides RBAC permission checks for modules and entities.

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

class ModulePermission {
  const ModulePermission({
    this.canRead = false,
    this.canCreate = false,
    this.canUpdate = false,
    this.canDelete = false,
  });

  final bool canRead;
  final bool canCreate;
  final bool canUpdate;
  final bool canDelete;

  factory ModulePermission.fromJson(dynamic value) {
    if (value is bool) {
      return value ? fullCrud : noCrud;
    }
    if (value is Map<String, dynamic>) {
      return ModulePermission(
        canRead: value['canRead'] as bool? ?? false,
        canCreate: value['canCreate'] as bool? ?? false,
        canUpdate: value['canUpdate'] as bool? ?? false,
        canDelete: value['canDelete'] as bool? ?? false,
      );
    }
    return noCrud;
  }

  static const fullCrud = ModulePermission(
    canRead: true,
    canCreate: true,
    canUpdate: true,
    canDelete: true,
  );

  static const noCrud = ModulePermission();

  static const readOnly = ModulePermission(canRead: true);
}

class FieldPermission {
  const FieldPermission({
    required this.fieldSlug,
    this.canView = true,
    this.canEdit = true,
  });

  final String fieldSlug;
  final bool canView;
  final bool canEdit;

  factory FieldPermission.fromJson(Map<String, dynamic> json) =>
      FieldPermission(
        fieldSlug: json['fieldSlug'] as String,
        canView: json['canView'] as bool? ?? true,
        canEdit: json['canEdit'] as bool? ?? true,
      );
}

class EntityPermission {
  const EntityPermission({
    required this.entitySlug,
    this.canCreate = false,
    this.canRead = false,
    this.canUpdate = false,
    this.canDelete = false,
    this.scope = 'all',
    this.fieldPermissions = const [],
  });

  final String entitySlug;
  final bool canCreate;
  final bool canRead;
  final bool canUpdate;
  final bool canDelete;
  final String scope;
  final List<FieldPermission> fieldPermissions;

  factory EntityPermission.fromJson(Map<String, dynamic> json) {
    final fpList = json['fieldPermissions'] as List<dynamic>?;
    return EntityPermission(
      entitySlug: json['entitySlug'] as String,
      canCreate: json['canCreate'] as bool? ?? false,
      canRead: json['canRead'] as bool? ?? false,
      canUpdate: json['canUpdate'] as bool? ?? false,
      canDelete: json['canDelete'] as bool? ?? false,
      scope: json['scope'] as String? ?? 'all',
      fieldPermissions: fpList
              ?.whereType<Map<String, dynamic>>()
              .map(FieldPermission.fromJson)
              .toList() ??
          const [],
    );
  }
}

// ═══════════════════════════════════════════════════════
// DEFAULT PERMISSIONS (mirrors use-permissions.ts)
// ═══════════════════════════════════════════════════════

const _fullCrud = ModulePermission.fullCrud;
const _noCrud = ModulePermission.noCrud;
const _readOnly = ModulePermission.readOnly;

const _dataReadCreate = ModulePermission(
  canRead: true,
  canCreate: true,
  canUpdate: true,
  canDelete: false,
);

const Map<String, Map<String, ModulePermission>> _defaultModulePermissions = {
  'PLATFORM_ADMIN': {
    'dashboard': _fullCrud,
    'users': _fullCrud,
    'settings': _fullCrud,
    'apis': _fullCrud,

    'entities': _fullCrud,
    'tenants': _fullCrud,
    'data': _fullCrud,
    'roles': _fullCrud,
  },
  'ADMIN': {
    'dashboard': _fullCrud,
    'users': _fullCrud,
    'settings': _fullCrud,
    'apis': _fullCrud,

    'entities': _fullCrud,
    'tenants': _noCrud,
    'data': _fullCrud,
    'roles': _fullCrud,
  },
  'MANAGER': {
    'dashboard': _readOnly,
    'users': _readOnly,
    'settings': _noCrud,
    'apis': _noCrud,

    'entities': _noCrud,
    'tenants': _noCrud,
    'data': _dataReadCreate,
    'roles': _readOnly,
  },
  'USER': {
    'dashboard': _readOnly,
    'users': _readOnly,
    'settings': _readOnly,
    'apis': _noCrud,

    'entities': _dataReadCreate,
    'tenants': _noCrud,
    'data': _dataReadCreate,
    'roles': _noCrud,
  },
  'VIEWER': {
    'dashboard': _readOnly,
    'users': _noCrud,
    'settings': _readOnly,
    'apis': _noCrud,

    'entities': _noCrud,
    'tenants': _noCrud,
    'data': _readOnly,
    'roles': _noCrud,
  },
  'CUSTOM': {
    'dashboard': _readOnly,
    'users': _noCrud,
    'settings': _noCrud,
    'apis': _noCrud,

    'entities': _noCrud,
    'tenants': _noCrud,
    'data': _noCrud,
    'roles': _noCrud,
  },
};

const _moduleKeys = [
  'dashboard',
  'users',
  'settings',
  'apis',
  'entities',
  'tenants',
  'data',
  'roles',
];

// ═══════════════════════════════════════════════════════
// PERMISSIONS STATE
// ═══════════════════════════════════════════════════════

class PermissionsState {
  const PermissionsState({
    this.roleType,
    this.modulePermissions = const {},
    this.entityPermissions = const [],
    this.isAdmin = false,
    this.isPlatformAdmin = false,
  });

  final String? roleType;
  final Map<String, ModulePermission> modulePermissions;
  final List<EntityPermission> entityPermissions;
  final bool isAdmin;
  final bool isPlatformAdmin;

  /// Check if user has read access to a module.
  bool hasModuleAccess(String moduleKey) {
    if (roleType == null) return false;
    if (isPlatformAdmin) return true;

    final perm = modulePermissions[moduleKey];
    return perm?.canRead ?? false;
  }

  /// Check CRUD permission on a module.
  bool hasModulePermission(String moduleKey, String action) {
    if (roleType == null) return false;
    if (isPlatformAdmin) return true;

    final perm = modulePermissions[moduleKey];
    if (perm == null) return false;

    switch (action) {
      case 'canRead':
        return perm.canRead;
      case 'canCreate':
        return perm.canCreate;
      case 'canUpdate':
        return perm.canUpdate;
      case 'canDelete':
        return perm.canDelete;
      default:
        return false;
    }
  }

  /// Check CRUD permission on an entity.
  bool hasEntityPermission(String entitySlug, String action) {
    if (roleType == null) return false;
    if (isPlatformAdmin || roleType == 'ADMIN') return true;

    // Non-CUSTOM roles: use defaults
    if (roleType != 'CUSTOM') {
      final defaults = <String, Map<String, bool>>{
        'MANAGER': {
          'canCreate': true,
          'canRead': true,
          'canUpdate': true,
          'canDelete': true,
        },
        'USER': {
          'canCreate': true,
          'canRead': true,
          'canUpdate': true,
          'canDelete': false,
        },
        'VIEWER': {
          'canCreate': false,
          'canRead': true,
          'canUpdate': false,
          'canDelete': false,
        },
      };
      return defaults[roleType]?[action] ?? false;
    }

    // CUSTOM: use entity-specific permissions
    final perm = entityPermissions.where((p) => p.entitySlug == entitySlug).firstOrNull;
    if (perm == null) return false;

    switch (action) {
      case 'canCreate':
        return perm.canCreate;
      case 'canRead':
        return perm.canRead;
      case 'canUpdate':
        return perm.canUpdate;
      case 'canDelete':
        return perm.canDelete;
      default:
        return false;
    }
  }

  /// Get field-level permissions for an entity.
  /// Returns null if no restrictions (ADMIN/PLATFORM_ADMIN or no fieldPermissions defined).
  /// Returns the list of FieldPermission otherwise.
  List<FieldPermission>? getFieldPermissions(String entitySlug) {
    if (roleType == null) return null;
    if (isPlatformAdmin || isAdmin) return null;
    if (roleType != 'CUSTOM') return null;

    final perm = entityPermissions
        .where((p) => p.entitySlug == entitySlug)
        .firstOrNull;
    if (perm == null || perm.fieldPermissions.isEmpty) return null;
    return perm.fieldPermissions;
  }

  /// Get visible field slugs for an entity.
  /// Returns null if no restrictions (all fields visible).
  Set<String>? getVisibleFields(String entitySlug) {
    final fp = getFieldPermissions(entitySlug);
    if (fp == null) return null;
    return fp.where((f) => f.canView).map((f) => f.fieldSlug).toSet();
  }

  /// Get editable field slugs for an entity.
  /// Returns null if no restrictions (all fields editable).
  Set<String>? getEditableFields(String entitySlug) {
    final fp = getFieldPermissions(entitySlug);
    if (fp == null) return null;
    return fp.where((f) => f.canEdit).map((f) => f.fieldSlug).toSet();
  }

  /// Get scope for an entity (all | own).
  String getEntityScope(String entitySlug) {
    if (roleType == null) return 'own';
    if (isPlatformAdmin || isAdmin) return 'all';
    if (roleType == 'MANAGER' || roleType == 'VIEWER') return 'all';
    if (roleType == 'USER') return 'own';

    // CUSTOM: use scope from permissions
    final perm = entityPermissions.where((p) => p.entitySlug == entitySlug).firstOrNull;
    return perm?.scope ?? 'all';
  }
}

// ═══════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════

@riverpod
PermissionsState permissions(Ref ref) {
  final authState = ref.watch(authProvider);
  final user = authState.user;

  if (user == null) return const PermissionsState();

  final roleType = user.customRole?.roleType;
  if (roleType == null) return const PermissionsState();

  final isPlatformAdmin = roleType == 'PLATFORM_ADMIN';
  final isAdmin = isPlatformAdmin || roleType == 'ADMIN';

  // Build module permissions
  Map<String, ModulePermission> modulePerms;

  if (isPlatformAdmin) {
    modulePerms = _defaultModulePermissions['PLATFORM_ADMIN']!;
  } else if (user.customRole?.modulePermissions != null) {
    // Normalize from customRole (boolean → CRUD)
    final mp = user.customRole!.modulePermissions!;
    modulePerms = {};
    for (final key in _moduleKeys) {
      modulePerms[key] = ModulePermission.fromJson(mp[key]);
    }
  } else {
    // Fallback to defaults for roleType
    modulePerms = _defaultModulePermissions[roleType] ??
        _defaultModulePermissions['VIEWER']!;
  }

  // Build entity permissions
  List<EntityPermission> entityPerms = [];
  if (user.customRole?.permissions != null) {
    entityPerms = user.customRole!.permissions!
        .whereType<Map<String, dynamic>>()
        .map(EntityPermission.fromJson)
        .toList();
  }

  // CUSTOM roles: if any entity has canRead, grant data module access
  if (roleType == 'CUSTOM' && entityPerms.any((e) => e.canRead)) {
    final currentData = modulePerms['data'] ?? _noCrud;
    if (!currentData.canRead) {
      modulePerms = Map<String, ModulePermission>.from(modulePerms);
      modulePerms['data'] = ModulePermission(
        canRead: true,
        canCreate: entityPerms.any((e) => e.canCreate),
        canUpdate: entityPerms.any((e) => e.canUpdate),
        canDelete: entityPerms.any((e) => e.canDelete),
      );
    }
  }

  return PermissionsState(
    roleType: roleType,
    modulePermissions: modulePerms,
    entityPermissions: entityPerms,
    isAdmin: isAdmin,
    isPlatformAdmin: isPlatformAdmin,
  );
}
