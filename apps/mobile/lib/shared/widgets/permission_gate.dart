import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:crm_mobile/core/permissions/permission_provider.dart';

/// Port of web-admin's PermissionGate component.
/// Conditionally renders children based on RBAC permissions.
class PermissionGate extends ConsumerWidget {
  const PermissionGate({
    super.key,
    this.module,
    this.action,
    this.entitySlug,
    this.entityAction,
    this.requireAdmin = false,
    this.requirePlatformAdmin = false,
    this.fallback,
    required this.child,
  });

  /// Module key (dashboard, users, data, etc.)
  final String? module;

  /// CRUD action: canRead, canCreate, canUpdate, canDelete
  final String? action;

  /// Entity slug for entity-level permissions
  final String? entitySlug;

  /// Entity CRUD action
  final String? entityAction;

  /// Require ADMIN or PLATFORM_ADMIN
  final bool requireAdmin;

  /// Require PLATFORM_ADMIN only
  final bool requirePlatformAdmin;

  /// Widget to show when no permission (default: nothing)
  final Widget? fallback;

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final perms = ref.watch(permissionsProvider);

    bool hasAccess = true;

    if (requirePlatformAdmin) {
      hasAccess = perms.isPlatformAdmin;
    } else if (requireAdmin) {
      hasAccess = perms.isAdmin;
    } else if (module != null && action != null) {
      hasAccess = perms.hasModulePermission(module!, action!);
    } else if (module != null) {
      hasAccess = perms.hasModuleAccess(module!);
    } else if (entitySlug != null && entityAction != null) {
      hasAccess = perms.hasEntityPermission(entitySlug!, entityAction!);
    }

    if (hasAccess) return child;
    return fallback ?? const SizedBox.shrink();
  }
}
