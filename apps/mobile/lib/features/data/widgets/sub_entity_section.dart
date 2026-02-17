import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:crm_mobile/core/permissions/permission_provider.dart';
import 'package:crm_mobile/core/theme/app_colors.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:crm_mobile/features/data/data/data_repository.dart';

/// Compact sub-entity section for parent record forms.
class SubEntitySection extends ConsumerStatefulWidget {
  const SubEntitySection({
    super.key,
    required this.parentRecordId,
    required this.subEntitySlug,
    required this.subEntityId,
    this.subEntityDisplayFields,
    required this.label,
  });

  final String parentRecordId;
  final String subEntitySlug;
  final String subEntityId;
  final List<String>? subEntityDisplayFields;
  final String label;

  @override
  ConsumerState<SubEntitySection> createState() => _SubEntitySectionState();
}

class _SubEntitySectionState extends ConsumerState<SubEntitySection> {
  bool _isExpanded = true;

  @override
  Widget build(BuildContext context) {
    final repo = ref.watch(dataRepositoryProvider);
    final perms = ref.watch(permissionsProvider);
    final canCreate = perms.hasEntityPermission(widget.subEntitySlug, 'canCreate');

    return StreamBuilder<List<Map<String, dynamic>>>(
      stream: repo.watchChildRecords(
        parentRecordId: widget.parentRecordId,
        entityId: widget.subEntityId,
      ),
      builder: (context, snapshot) {
        final records = snapshot.data ?? [];
        final count = records.length;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            // Header row - simple and compact
            InkWell(
              onTap: () => setState(() => _isExpanded = !_isExpanded),
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Row(
                  children: [
                    Icon(
                      _isExpanded ? Icons.expand_more : Icons.chevron_right,
                      size: 20,
                      color: AppColors.mutedForeground,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      widget.label,
                      style: AppTypography.labelLarge.copyWith(
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(width: 8),
                    // Count badge
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: count > 0
                            ? AppColors.primary.withValues(alpha: 0.1)
                            : AppColors.muted,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        '$count',
                        style: AppTypography.caption.copyWith(
                          color: count > 0 ? AppColors.primary : AppColors.mutedForeground,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    const Spacer(),
                    // Add button - small icon only
                    if (canCreate)
                      IconButton(
                        icon: const Icon(Icons.add_circle_outline, size: 22),
                        color: AppColors.primary,
                        visualDensity: VisualDensity.compact,
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                        tooltip: 'Adicionar ${widget.label}',
                        onPressed: () {
                          context.push(
                            '/data/${widget.subEntitySlug}/new?parentRecordId=${widget.parentRecordId}',
                          );
                        },
                      ),
                  ],
                ),
              ),
            ),

            // Records list
            if (_isExpanded) ...[
              if (records.isEmpty)
                Padding(
                  padding: const EdgeInsets.only(left: 24, top: 4, bottom: 8),
                  child: Text(
                    'Nenhum registro',
                    style: AppTypography.bodySmall.copyWith(
                      color: AppColors.mutedForeground,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                )
              else
                FutureBuilder<Map<String, dynamic>?>(
                  future: repo.getEntity(widget.subEntitySlug),
                  builder: (context, entitySnap) {
                    List<dynamic> childFields = [];
                    if (entitySnap.data != null) {
                      try {
                        childFields = jsonDecode(
                          entitySnap.data!['fields'] as String? ?? '[]',
                        );
                      } catch (_) {}
                    }

                    return Column(
                      children: records.map((record) {
                        return _ChildRecordTile(
                          record: record,
                          fields: childFields,
                          displayFields: widget.subEntityDisplayFields,
                          entitySlug: widget.subEntitySlug,
                        );
                      }).toList(),
                    );
                  },
                ),
            ],
          ],
        );
      },
    );
  }
}

class _ChildRecordTile extends ConsumerWidget {
  const _ChildRecordTile({
    required this.record,
    required this.fields,
    this.displayFields,
    required this.entitySlug,
  });

  final Map<String, dynamic> record;
  final List<dynamic> fields;
  final List<String>? displayFields;
  final String entitySlug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final perms = ref.watch(permissionsProvider);
    Map<String, dynamic> data = {};
    try {
      data = jsonDecode(record['data'] as String? ?? '{}');
    } catch (_) {}

    final fieldsToShow = displayFields ?? _defaultDisplayFields();
    final values = <String>[];
    for (final slug in fieldsToShow) {
      final val = data[slug];
      if (val != null && val.toString().isNotEmpty) {
        values.add(val.toString());
      }
    }

    final title = values.isNotEmpty ? values.first : 'Registro';
    final subtitle = values.length > 1 ? values.sublist(1).join(' - ') : null;
    final recordId = record['id'] as String;

    return Padding(
      padding: const EdgeInsets.only(left: 8),
      child: Container(
        margin: const EdgeInsets.only(bottom: 4),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppColors.border),
        ),
        child: InkWell(
          onTap: () => context.push('/data/$entitySlug/$recordId'),
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        title,
                        style: AppTypography.bodyMedium,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (subtitle != null)
                        Text(
                          subtitle,
                          style: AppTypography.caption.copyWith(
                            color: AppColors.mutedForeground,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                    ],
                  ),
                ),
                // Action buttons - compact
                if (perms.hasEntityPermission(entitySlug, 'canUpdate'))
                  _SmallIconButton(
                    icon: Icons.edit_outlined,
                    onPressed: () => context.push('/data/$entitySlug/$recordId/edit'),
                  ),
                if (perms.hasEntityPermission(entitySlug, 'canDelete'))
                  _SmallIconButton(
                    icon: Icons.delete_outline,
                    color: AppColors.destructive,
                    onPressed: () => _confirmDelete(context, ref, recordId),
                  ),
                Icon(
                  Icons.chevron_right,
                  size: 18,
                  color: AppColors.mutedForeground,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _confirmDelete(
      BuildContext context, WidgetRef ref, String recordId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Excluir registro'),
        content: const Text('Tem certeza que deseja excluir este registro?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: TextButton.styleFrom(foregroundColor: AppColors.destructive),
            child: const Text('Excluir'),
          ),
        ],
      ),
    );

    if (confirmed == true && context.mounted) {
      try {
        final repo = ref.read(dataRepositoryProvider);
        await repo.deleteRecord(entitySlug: entitySlug, recordId: recordId);
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Registro excluido')),
          );
        }
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Erro ao excluir: $e')),
          );
        }
      }
    }
  }

  List<String> _defaultDisplayFields() {
    final result = <String>[];
    for (final field in fields) {
      final f = field as Map<String, dynamic>;
      final type = (f['type'] as String? ?? '').toUpperCase();
      if (['TEXT', 'NUMBER', 'EMAIL', 'SELECT'].contains(type)) {
        result.add(f['slug'] as String? ?? '');
        if (result.length >= 2) break;
      }
    }
    return result;
  }
}

class _SmallIconButton extends StatelessWidget {
  const _SmallIconButton({
    required this.icon,
    required this.onPressed,
    this.color,
  });

  final IconData icon;
  final VoidCallback onPressed;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 28,
      height: 28,
      child: IconButton(
        icon: Icon(icon, size: 16),
        color: color ?? AppColors.mutedForeground,
        padding: EdgeInsets.zero,
        visualDensity: VisualDensity.compact,
        onPressed: onPressed,
      ),
    );
  }
}
