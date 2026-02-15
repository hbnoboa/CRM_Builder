import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:crm_mobile/core/database/app_database.dart';
import 'package:crm_mobile/core/permissions/permission_provider.dart';
import 'package:crm_mobile/core/theme/app_colors.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:crm_mobile/shared/widgets/sync_status_indicator.dart';

/// Lists all entities the user has access to.
/// Tapping an entity navigates to its data list.
class EntitiesListPage extends ConsumerWidget {
  const EntitiesListPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final perms = ref.watch(permissionsProvider);
    final db = AppDatabase.instance.db;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Dados'),
        actions: const [SyncStatusIndicator()],
      ),
      body: StreamBuilder<List<Map<String, dynamic>>>(
        stream: db.watch(
          'SELECT * FROM Entity ORDER BY name ASC',
        ),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting &&
              !snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }

          final entities = snapshot.data ?? [];

          if (entities.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.inbox_outlined,
                      size: 64, color: AppColors.mutedForeground),
                  const SizedBox(height: 16),
                  Text(
                    'Nenhuma entidade encontrada',
                    style: AppTypography.bodyMedium
                        .copyWith(color: AppColors.mutedForeground),
                  ),
                ],
              ),
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: entities.length,
            itemBuilder: (context, index) {
              final entity = entities[index];
              final slug = entity['slug'] as String;
              final name = entity['name'] as String;
              final namePlural = entity['namePlural'] as String;
              final description = entity['description'] as String?;
              final icon = entity['icon'] as String?;
              final color = entity['color'] as String?;

              // Check permission
              if (!perms.hasEntityPermission(slug, 'canRead') &&
                  !perms.hasModuleAccess('data')) {
                return const SizedBox.shrink();
              }

              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: color != null
                        ? Color(
                            int.parse(color.replaceFirst('#', '0xFF')))
                        : AppColors.primary,
                    child: Icon(
                      Icons.folder_outlined,
                      color: AppColors.primaryForeground,
                      size: 20,
                    ),
                  ),
                  title: Text(namePlural, style: AppTypography.labelLarge),
                  subtitle: description != null
                      ? Text(
                          description,
                          style: AppTypography.caption
                              .copyWith(color: AppColors.mutedForeground),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        )
                      : null,
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/data/$slug'),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
