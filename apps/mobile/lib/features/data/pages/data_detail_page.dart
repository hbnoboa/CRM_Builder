import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:crm_mobile/core/database/app_database.dart';
import 'package:crm_mobile/core/permissions/permission_provider.dart';
import 'package:crm_mobile/core/theme/app_colors_extension.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:crm_mobile/features/data/data/data_repository.dart';
import 'package:crm_mobile/features/data/widgets/dynamic_field.dart';
import 'package:crm_mobile/features/data/widgets/sub_entity_section.dart';
import 'package:crm_mobile/shared/utils/formatters.dart';
import 'package:crm_mobile/shared/widgets/permission_gate.dart';

class DataDetailPage extends ConsumerWidget {
  const DataDetailPage({
    super.key,
    required this.entitySlug,
    required this.recordId,
  });

  final String entitySlug;
  final String recordId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final repo = ref.watch(dataRepositoryProvider);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        actions: [
          // Share button
          IconButton(
            icon: const Icon(Icons.share_outlined),
            tooltip: 'Compartilhar',
            onPressed: () => _shareRecord(context, ref),
          ),
          // Edit button
          PermissionGate(
            entitySlug: entitySlug,
            entityAction: 'canUpdate',
            child: IconButton(
              icon: const Icon(Icons.edit_outlined),
              onPressed: () =>
                  context.push('/data/$entitySlug/$recordId/edit'),
            ),
          ),
          // Delete button
          PermissionGate(
            entitySlug: entitySlug,
            entityAction: 'canDelete',
            child: IconButton(
              icon: Icon(Icons.delete_outlined,
                  color: context.colors.destructive,),
              onPressed: () => _confirmDelete(context, ref),
            ),
          ),
        ],
      ),
      body: FutureBuilder<Map<String, dynamic>?>(
        future: repo.getEntity(entitySlug),
        builder: (context, entitySnapshot) {
          final entity = entitySnapshot.data;
          if (entity == null) {
            return const Center(child: CircularProgressIndicator());
          }

          List<dynamic> fields = [];
          try {
            fields = jsonDecode(entity['fields'] as String? ?? '[]');
          } catch (_) {}

          // Extract visible column order from entity settings
          final columnOrder = repo.extractVisibleColumns(entity);

          // Reorder fields by columnConfig if set
          if (columnOrder.isNotEmpty) {
            final fieldMap = <String, dynamic>{};
            for (final f in fields) {
              final slug = (f as Map<String, dynamic>)['slug'] as String? ?? '';
              if (slug.isNotEmpty) fieldMap[slug] = f;
            }
            final ordered = <dynamic>[];
            for (final slug in columnOrder) {
              if (fieldMap.containsKey(slug)) {
                ordered.add(fieldMap.remove(slug));
              }
            }
            // Append remaining fields not in columnOrder
            ordered.addAll(fieldMap.values);
            fields = ordered;
          }


          // Use StreamBuilder for real-time record updates
          return StreamBuilder<List<Map<String, dynamic>>>(
            stream: AppDatabase.instance.db.watch(
              'SELECT * FROM EntityData WHERE id = ? AND deletedAt IS NULL',
              parameters: [recordId],
            ),
            builder: (context, recordSnapshot) {
              // Distinguish loading vs deleted
              if (recordSnapshot.connectionState == ConnectionState.waiting &&
                  !recordSnapshot.hasData) {
                return const Center(child: CircularProgressIndicator());
              }

              final record = recordSnapshot.data?.firstOrNull;
              if (record == null) {
                return Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.delete_outline,
                          size: 48, color: context.colors.mutedForeground,),
                      const SizedBox(height: 16),
                      const Text('Registro nao encontrado',
                          style: AppTypography.h4,),
                      const SizedBox(height: 8),
                      Text(
                        'Este registro pode ter sido removido.',
                        style: AppTypography.bodySmall
                            .copyWith(color: context.colors.mutedForeground),
                      ),
                      const SizedBox(height: 24),
                      OutlinedButton(
                        onPressed: () => context.pop(),
                        child: const Text('Voltar'),
                      ),
                    ],
                  ),
                );
              }

              Map<String, dynamic> data = {};
              try {
                data = jsonDecode(record['data'] as String? ?? '{}');
              } catch (_) {}

              return RefreshIndicator(
                onRefresh: () async {
                  await Future.delayed(const Duration(milliseconds: 500));
                },
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    // Record title (first text field value)
                    Text(
                      _getTitle(data, fields),
                      style: AppTypography.h3,
                    ),
                    const SizedBox(height: 8),
                    // Timestamps
                    Row(
                      children: [
                        Icon(Icons.access_time, size: 14, color: context.colors.mutedForeground),
                        const SizedBox(width: 4),
                        Text(
                          'Criado ${Formatters.dateTime(record['createdAt'] as String?)}',
                          style: AppTypography.caption.copyWith(
                            color: context.colors.mutedForeground,
                          ),
                        ),
                      ],
                    ),
                    if (record['updatedAt'] != null &&
                        record['updatedAt'] != record['createdAt']) ...[
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Icon(Icons.edit_outlined, size: 14, color: context.colors.mutedForeground),
                          const SizedBox(width: 4),
                          Text(
                            'Atualizado ${Formatters.dateTime(record['updatedAt'] as String?)}',
                            style: AppTypography.caption.copyWith(
                              color: context.colors.mutedForeground,
                            ),
                          ),
                        ],
                      ),
                    ],
                    const Divider(height: 32),

                    // Field values (excluding sub-entity and non-visible fields)
                    ...fields
                        .where((f) {
                          final fieldMap = f as Map<String, dynamic>;
                          final type = (fieldMap['type']?.toString().toUpperCase() ?? '').replaceAll('-', '_');
                          if (type == 'SUB_ENTITY') return false;
                          // Field-level permissions
                          final visibleFields = ref.read(permissionsProvider)
                              .getVisibleFields(entitySlug);
                          if (visibleFields != null) {
                            final slug = fieldMap['slug'] as String? ?? '';
                            return visibleFields.contains(slug);
                          }
                          return true;
                        })
                        .map<Widget>((field) {
                      final fieldMap = field as Map<String, dynamic>;
                      final slug = fieldMap['slug'] as String? ?? '';
                      final value = data[slug];

                      return Padding(
                        padding: const EdgeInsets.only(bottom: 16),
                        child: DynamicFieldDisplay(
                          field: fieldMap,
                          value: value,
                        ),
                      );
                    }),

                    // Sub-entity sections
                    ..._buildSubEntitySections(fields, recordId),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }

  List<Widget> _buildSubEntitySections(
      List<dynamic> fields, String parentRecordId,) {
    final subFields = fields.where(
      (f) => (f as Map<String, dynamic>)['type']?.toString().toUpperCase().replaceAll('-', '_') == 'SUB_ENTITY',
    );

    if (subFields.isEmpty) return [];

    return [
      const Divider(height: 32),
      ...subFields.map<Widget>((field) {
        final f = field as Map<String, dynamic>;
        final subEntitySlug = f['subEntitySlug'] as String? ?? '';
        final subEntityId = f['subEntityId'] as String? ?? '';
        final label = f['label'] as String? ?? f['name'] as String? ?? '';
        final displayFields = (f['subEntityDisplayFields'] as List<dynamic>?)
            ?.map((e) => e.toString())
            .toList();

        if (subEntitySlug.isEmpty || subEntityId.isEmpty) {
          return const SizedBox.shrink();
        }

        return Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: SubEntitySection(
            parentRecordId: parentRecordId,
            subEntitySlug: subEntitySlug,
            subEntityId: subEntityId,
            subEntityDisplayFields: displayFields,
            label: label,
          ),
        );
      }),
    ];
  }

  String _getTitle(Map<String, dynamic> data, List<dynamic> fields) {
    // Use first text field as title
    for (final field in fields) {
      final f = field as Map<String, dynamic>;
      final type = f['type'] as String? ?? '';
      if (type == 'text' || type == 'TEXT') {
        final slug = f['slug'] as String? ?? '';
        final value = data[slug];
        if (value != null && value.toString().isNotEmpty) {
          return value.toString();
        }
      }
    }
    return 'Registro';
  }

  Future<void> _shareRecord(BuildContext context, WidgetRef ref) async {
    try {
      final repo = ref.read(dataRepositoryProvider);
      final entity = await repo.getEntity(entitySlug);
      final record = await repo.getRecord(recordId);

      if (entity == null || record == null) return;

      List<dynamic> fields = [];
      try {
        fields = jsonDecode(entity['fields'] as String? ?? '[]');
      } catch (_) {}

      Map<String, dynamic> data = {};
      try {
        data = jsonDecode(record['data'] as String? ?? '{}');
      } catch (_) {}

      final entityName = entity['name'] as String? ?? entitySlug;
      final visibleFields = ref.read(permissionsProvider)
          .getVisibleFields(entitySlug);
      final buffer = StringBuffer();
      buffer.writeln('$entityName - ${_getTitle(data, fields)}');
      buffer.writeln('---');

      for (final field in fields) {
        final f = field as Map<String, dynamic>;
        final type = (f['type'] as String? ?? '').toUpperCase().replaceAll('-', '_');
        if (type == 'SUB_ENTITY' || type == 'IMAGE' || type == 'FILE') continue;

        final slug = f['slug'] as String? ?? '';
        // Respect field-level visibility
        if (visibleFields != null && !visibleFields.contains(slug)) continue;

        final name = f['name'] as String? ?? f['label'] as String? ?? slug;
        final val = data[slug];
        if (val != null && val.toString().isNotEmpty) {
          buffer.writeln('$name: $val');
        }
      }

      await Clipboard.setData(ClipboardData(text: buffer.toString()));
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Registro copiado para area de transferencia')),
        );
      }
    } catch (_) {}
  }

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref) async {
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
              foregroundColor: ctx.colors.destructive,
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
          context.pop();
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
}
