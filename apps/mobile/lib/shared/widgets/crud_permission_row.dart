import 'package:flutter/material.dart';
import 'package:crm_mobile/core/theme/app_colors_extension.dart';

/// Row widget for displaying CRUD permission toggles.
/// Used in role form for module and entity permissions.
class CrudPermissionRow extends StatelessWidget {
  const CrudPermissionRow({
    super.key,
    required this.canRead,
    required this.canCreate,
    required this.canUpdate,
    required this.canDelete,
    this.onToggle,
    this.enabled = true,
    this.compact = false,
    this.showSelectAll = true,
  });

  final bool canRead;
  final bool canCreate;
  final bool canUpdate;
  final bool canDelete;

  /// Callback when a permission is toggled. Receives action name: 'read', 'create', 'update', 'delete'
  final void Function(String action)? onToggle;

  /// Whether the row is enabled for interaction
  final bool enabled;

  /// Use compact layout for smaller spaces
  final bool compact;

  /// Whether to show the select all checkbox
  final bool showSelectAll;

  bool get _allSelected => canRead && canCreate && canUpdate && canDelete;
  int get _selectedCount =>
      [canRead, canCreate, canUpdate, canDelete].where((b) => b).length;

  @override
  Widget build(BuildContext context) {
    if (compact) {
      return _buildCompact(context);
    }
    return _buildFull(context);
  }

  Widget _buildFull(BuildContext context) {
    return Row(
      children: [
        _PermissionChip(
          label: 'Ler',
          shortLabel: 'R',
          isActive: canRead,
          onTap: enabled ? () => onToggle?.call('read') : null,
          color: Colors.blue,
        ),
        const SizedBox(width: 8),
        _PermissionChip(
          label: 'Criar',
          shortLabel: 'C',
          isActive: canCreate,
          onTap: enabled ? () => onToggle?.call('create') : null,
          color: Colors.green,
        ),
        const SizedBox(width: 8),
        _PermissionChip(
          label: 'Editar',
          shortLabel: 'U',
          isActive: canUpdate,
          onTap: enabled ? () => onToggle?.call('update') : null,
          color: Colors.orange,
        ),
        const SizedBox(width: 8),
        _PermissionChip(
          label: 'Excluir',
          shortLabel: 'D',
          isActive: canDelete,
          onTap: enabled ? () => onToggle?.call('delete') : null,
          color: Colors.red,
        ),
        if (showSelectAll) ...[
          const Spacer(),
          _buildSelectAll(context),
        ],
      ],
    );
  }

  Widget _buildCompact(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _CompactPermissionChip(
          label: 'R',
          isActive: canRead,
          onTap: enabled ? () => onToggle?.call('read') : null,
          color: Colors.blue,
        ),
        _CompactPermissionChip(
          label: 'C',
          isActive: canCreate,
          onTap: enabled ? () => onToggle?.call('create') : null,
          color: Colors.green,
        ),
        _CompactPermissionChip(
          label: 'U',
          isActive: canUpdate,
          onTap: enabled ? () => onToggle?.call('update') : null,
          color: Colors.orange,
        ),
        _CompactPermissionChip(
          label: 'D',
          isActive: canDelete,
          onTap: enabled ? () => onToggle?.call('delete') : null,
          color: Colors.red,
        ),
      ],
    );
  }

  Widget _buildSelectAll(BuildContext context) {
    return GestureDetector(
      onTap: enabled
          ? () {
              // Toggle all to opposite of current state
              final newValue = !_allSelected;
              if (canRead != newValue) onToggle?.call('read');
              if (canCreate != newValue) onToggle?.call('create');
              if (canUpdate != newValue) onToggle?.call('update');
              if (canDelete != newValue) onToggle?.call('delete');
            }
          : null,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            _allSelected
                ? Icons.check_box
                : _selectedCount > 0
                    ? Icons.indeterminate_check_box
                    : Icons.check_box_outline_blank,
            size: 20,
            color: enabled
                ? (_allSelected
                    ? Theme.of(context).colorScheme.primary
                    : context.colors.mutedForeground)
                : context.colors.mutedForeground.withValues(alpha: 0.5),
          ),
          const SizedBox(width: 4),
          Text(
            'Todos',
            style: TextStyle(
              fontSize: 12,
              color: enabled
                  ? context.colors.mutedForeground
                  : context.colors.mutedForeground.withValues(alpha: 0.5),
            ),
          ),
        ],
      ),
    );
  }
}

class _PermissionChip extends StatelessWidget {
  const _PermissionChip({
    required this.label,
    required this.shortLabel,
    required this.isActive,
    required this.color,
    this.onTap,
  });

  final String label;
  final String shortLabel;
  final bool isActive;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isActive ? color.withValues(alpha: 0.15) : context.colors.muted,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(
            color: isActive ? color : context.colors.border,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: isActive ? color : context.colors.mutedForeground,
          ),
        ),
      ),
    );
  }
}

class _CompactPermissionChip extends StatelessWidget {
  const _CompactPermissionChip({
    required this.label,
    required this.isActive,
    required this.color,
    this.onTap,
  });

  final String label;
  final bool isActive;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 28,
        height: 28,
        margin: const EdgeInsets.only(right: 4),
        decoration: BoxDecoration(
          color: isActive ? color.withValues(alpha: 0.15) : Colors.transparent,
          borderRadius: BorderRadius.circular(4),
          border: Border.all(
            color: isActive ? color : context.colors.border,
          ),
        ),
        child: Center(
          child: Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: isActive ? color : context.colors.mutedForeground,
            ),
          ),
        ),
      ),
    );
  }
}

/// Badge showing permission count (e.g., "3/4")
class PermissionCountBadge extends StatelessWidget {
  const PermissionCountBadge({
    super.key,
    required this.active,
    required this.total,
  });

  final int active;
  final int total;

  @override
  Widget build(BuildContext context) {
    final isComplete = active == total;
    final hasAny = active > 0;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: isComplete
            ? Colors.green.shade100
            : hasAny
                ? Colors.amber.shade100
                : context.colors.muted,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        '$active/$total',
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: isComplete
              ? Colors.green.shade700
              : hasAny
                  ? Colors.amber.shade700
                  : context.colors.mutedForeground,
        ),
      ),
    );
  }
}
