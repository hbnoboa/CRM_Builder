import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:crm_mobile/core/database/app_database.dart';
import 'package:crm_mobile/core/permissions/permission_provider.dart';
import 'package:crm_mobile/core/theme/app_colors.dart';
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
    final perms = ref.watch(permissionsProvider);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        actions: [
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
              icon: const Icon(Icons.delete_outlined,
                  color: AppColors.destructive),
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

          // Use StreamBuilder for real-time record updates
          return StreamBuilder<List<Map<String, dynamic>>>(
            stream: AppDatabase.instance.db.watch(
              'SELECT * FROM EntityData WHERE id = ?',
              parameters: [recordId],
            ),
            builder: (context, recordSnapshot) {
              final record = recordSnapshot.data?.firstOrNull;
              if (record == null) {
                return const Center(child: CircularProgressIndicator());
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
                        Icon(Icons.access_time, size: 14, color: AppColors.mutedForeground),
                        const SizedBox(width: 4),
                        Text(
                          'Criado ${Formatters.dateTime(record['createdAt'] as String?)}',
                          style: AppTypography.caption.copyWith(
                            color: AppColors.mutedForeground,
                          ),
                        ),
                      ],
                    ),
                    if (record['updatedAt'] != null &&
                        record['updatedAt'] != record['createdAt']) ...[
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Icon(Icons.edit_outlined, size: 14, color: AppColors.mutedForeground),
                          const SizedBox(width: 4),
                          Text(
                            'Atualizado ${Formatters.dateTime(record['updatedAt'] as String?)}',
                            style: AppTypography.caption.copyWith(
                              color: AppColors.mutedForeground,
                            ),
                          ),
                        ],
                      ),
                    ],
                    const Divider(height: 32),

                    // Field values (excluding sub-entity fields)
                    ...fields
                        .where((f) =>
                            (f as Map<String, dynamic>)['type'] != 'sub-entity')
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
      List<dynamic> fields, String parentRecordId) {
    final subFields = fields.where(
      (f) => (f as Map<String, dynamic>)['type'] == 'sub-entity',
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
