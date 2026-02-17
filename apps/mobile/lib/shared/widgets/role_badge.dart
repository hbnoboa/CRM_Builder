import 'package:flutter/material.dart';

/// Badge widget for displaying user roles.
/// Matches web-admin styling with role-specific colors.
class RoleBadge extends StatelessWidget {
  const RoleBadge({
    super.key,
    required this.roleType,
    this.roleName,
    this.color,
    this.size = RoleBadgeSize.medium,
  });

  /// The role type (PLATFORM_ADMIN, ADMIN, MANAGER, USER, VIEWER, CUSTOM)
  final String roleType;

  /// Optional custom role name to display
  final String? roleName;

  /// Optional custom color (hex string like #6366f1)
  final String? color;

  final RoleBadgeSize size;

  @override
  Widget build(BuildContext context) {
    final config = _getRoleConfig(roleType, color);
    final displayName = roleName ?? _getDefaultName(roleType);

    final double fontSize;
    final double horizontalPadding;
    final double verticalPadding;

    switch (size) {
      case RoleBadgeSize.small:
        fontSize = 10;
        horizontalPadding = 6;
        verticalPadding = 2;
      case RoleBadgeSize.medium:
        fontSize = 12;
        horizontalPadding = 8;
        verticalPadding = 4;
      case RoleBadgeSize.large:
        fontSize = 14;
        horizontalPadding = 12;
        verticalPadding = 6;
    }

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: horizontalPadding,
        vertical: verticalPadding,
      ),
      decoration: BoxDecoration(
        color: config.backgroundColor,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        displayName,
        style: TextStyle(
          fontSize: fontSize,
          fontWeight: FontWeight.w500,
          color: config.textColor,
        ),
      ),
    );
  }

  _RoleConfig _getRoleConfig(String roleType, String? customColor) {
    // If custom color is provided, use it
    if (customColor != null && customColor.isNotEmpty) {
      try {
        final color = Color(
          int.parse(customColor.replaceFirst('#', '0xFF')),
        );
        return _RoleConfig(
          backgroundColor: color.withValues(alpha: 0.15),
          textColor: color,
        );
      } catch (_) {
        // Fall through to default handling
      }
    }

    switch (roleType.toUpperCase()) {
      case 'PLATFORM_ADMIN':
        return _RoleConfig(
          backgroundColor: Colors.purple.shade100,
          textColor: Colors.purple.shade700,
        );
      case 'ADMIN':
        return _RoleConfig(
          backgroundColor: Colors.red.shade100,
          textColor: Colors.red.shade700,
        );
      case 'MANAGER':
        return _RoleConfig(
          backgroundColor: Colors.blue.shade100,
          textColor: Colors.blue.shade700,
        );
      case 'USER':
        return _RoleConfig(
          backgroundColor: Colors.green.shade100,
          textColor: Colors.green.shade700,
        );
      case 'VIEWER':
        return _RoleConfig(
          backgroundColor: Colors.grey.shade200,
          textColor: Colors.grey.shade700,
        );
      case 'CUSTOM':
      default:
        return _RoleConfig(
          backgroundColor: Colors.indigo.shade100,
          textColor: Colors.indigo.shade700,
        );
    }
  }

  String _getDefaultName(String roleType) {
    switch (roleType.toUpperCase()) {
      case 'PLATFORM_ADMIN':
        return 'Platform Admin';
      case 'ADMIN':
        return 'Admin';
      case 'MANAGER':
        return 'Gerente';
      case 'USER':
        return 'Usuario';
      case 'VIEWER':
        return 'Visualizador';
      case 'CUSTOM':
        return 'Customizado';
      default:
        return roleType;
    }
  }
}

class _RoleConfig {
  const _RoleConfig({
    required this.backgroundColor,
    required this.textColor,
  });

  final Color backgroundColor;
  final Color textColor;
}

enum RoleBadgeSize { small, medium, large }
