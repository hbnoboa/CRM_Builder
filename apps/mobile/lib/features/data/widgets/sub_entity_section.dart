import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:crm_mobile/core/permissions/permission_provider.dart';
import 'package:crm_mobile/core/theme/app_colors.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:crm_mobile/features/data/data/data_repository.dart';
import 'package:crm_mobile/shared/widgets/permission_gate.dart';

/// Displays child records (sub-entity) within a parent record detail page.
/// Shows an expandable list of child records with create button.
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

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header with expand toggle and create button
        Container(
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(AppColors.radiusSm),
            border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
          ),
          child: Row(
            children: [
              InkWell(
                onTap: () => setState(() => _isExpanded = !_isExpanded),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      _isExpanded
                          ? Icons.keyboard_arrow_down
                          : Icons.keyboard_arrow_right,
                      color: AppColors.primary,
                    ),
                    const SizedBox(width: 4),
                    StreamBuilder<List<Map<String, dynamic>>>(
                      stream: repo.watchChildRecords(
                        parentRecordId: widget.parentRecordId,
                        entityId: widget.subEntityId,
                      ),
                      builder: (context, snapshot) {
                        final count = snapshot.data?.length ?? 0;
                        return Text(
                          '${widget.label} ($count)',
                          style: AppTypography.labelLarge.copyWith(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w600,
                          ),
                        );
                      },
                    ),
                  ],
                ),
              ),
              const Spacer(),
              PermissionGate(
                entitySlug: widget.subEntitySlug,
                entityAction: 'canCreate',
                child: TextButton.icon(
                  onPressed: () {
                    context.push(
                      '/data/${widget.subEntitySlug}/new?parentRecordId=${widget.parentRecordId}',
                    );
                  },
                  icon: const Icon(Icons.add, size: 18),
                  label: const Text('Adicionar'),
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.primary,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    visualDensity: VisualDensity.compact,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),

        // Child records list
        if (_isExpanded)
          StreamBuilder<List<Map<String, dynamic>>>(
            stream: repo.watchChildRecords(
              parentRecordId: widget.parentRecordId,
              entityId: widget.subEntityId,
            ),
            builder: (context, snapshot) {
              final records = snapshot.data ?? [];

              if (records.isEmpty) {
                return Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceVariant,
                    borderRadius: BorderRadius.circular(AppColors.radiusMd),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    children: [
                      Icon(
                        Icons.inbox_outlined,
                        size: 40,
                        color: AppColors.mutedForeground,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Nenhum registro',
                        style: AppTypography.bodyMedium.copyWith(
                          color: AppColors.mutedForeground,
                        ),
                      ),
                      const SizedBox(height: 12),
                      PermissionGate(
                        entitySlug: widget.subEntitySlug,
                        entityAction: 'canCreate',
                        child: ElevatedButton.icon(
                          onPressed: () {
                            context.push(
                              '/data/${widget.subEntitySlug}/new?parentRecordId=${widget.parentRecordId}',
                            );
                          },
                          icon: const Icon(Icons.add, size: 18),
                          label: Text('Adicionar ${widget.label}'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            foregroundColor: Colors.white,
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              }

              return FutureBuilder<Map<String, dynamic>?>(
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
              );
            },
          ),
      ],
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

    // Get display values based on displayFields or fallback to first 2 fields
    final fieldsToShow = displayFields ?? _defaultDisplayFields();
    final values = <String>[];
    for (final slug in fieldsToShow) {
      final val = data[slug];
      if (val != null && val.toString().isNotEmpty) {
        values.add(val.toString());
      }
    }

    final title = values.isNotEmpty ? values.first : 'Registro';
    final subtitle = values.length > 1 ? values.sublist(1).join(' · ') : null;
    final recordId = record['id'] as String;

    return Card(
      margin: const EdgeInsets.only(bottom: 4),
      child: ListTile(
        dense: true,
        title: Text(title, style: AppTypography.bodyMedium),
        subtitle: subtitle != null
            ? Text(
                subtitle,
                style: AppTypography.caption.copyWith(
                  color: AppColors.mutedForeground,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              )
            : null,
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (perms.hasEntityPermission(entitySlug, 'canUpdate'))
              IconButton(
                icon: const Icon(Icons.edit_outlined, size: 18),
                visualDensity: VisualDensity.compact,
                onPressed: () =>
                    context.push('/data/$entitySlug/$recordId/edit'),
              ),
            if (perms.hasEntityPermission(entitySlug, 'canDelete'))
              IconButton(
                icon: const Icon(Icons.delete_outlined,
                    size: 18, color: AppColors.destructive,),
                visualDensity: VisualDensity.compact,
                onPressed: () => _confirmDelete(context, ref, recordId),
              ),
            const Icon(Icons.chevron_right, size: 20),
          ],
        ),
        onTap: () {
          context.push('/data/$entitySlug/$recordId');
        },
      ),
    );
  }

  Future<void> _confirmDelete(
      BuildContext context, WidgetRef ref, String recordId,) async {
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
            style: TextButton.styleFrom(
              foregroundColor: AppColors.destructive,
            ),
            child: const Text('Excluir'),
          ),
        ],
      ),
    );

    if (confirmed == true && context.mounted) {
      try {
        final repo = ref.read(dataRepositoryProvider);
        await repo.deleteRecord(
          entitySlug: entitySlug,
          recordId: recordId,
        );
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
    // Use first 2 text/number fields as default display
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
