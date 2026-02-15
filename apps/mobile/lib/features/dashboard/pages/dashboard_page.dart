import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:crm_mobile/core/auth/auth_provider.dart';
import 'package:crm_mobile/core/database/app_database.dart';
import 'package:crm_mobile/core/theme/app_colors.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:crm_mobile/features/dashboard/widgets/stat_card.dart';
import 'package:crm_mobile/shared/utils/formatters.dart';
import 'package:crm_mobile/shared/widgets/sync_status_indicator.dart';

class DashboardPage extends ConsumerWidget {
  const DashboardPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final user = authState.user;
    final db = AppDatabase.instance.db;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Ola, ${user?.name.split(' ').first ?? ''}',
              style: AppTypography.h4,
            ),
            Text(
              user?.customRole?.name ?? '',
              style: AppTypography.caption.copyWith(
                color: AppColors.mutedForeground,
              ),
            ),
          ],
        ),
        actions: const [
          SyncStatusIndicator(),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          await ref.read(authProvider.notifier).getProfile();
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Stats row
            StreamBuilder<List<Map<String, dynamic>>>(
              stream: db.watch(
                'SELECT '
                '(SELECT COUNT(*) FROM Entity) as entityCount, '
                '(SELECT COUNT(*) FROM EntityData WHERE deletedAt IS NULL) as dataCount, '
                '(SELECT COUNT(*) FROM Notification WHERE read = 0) as unreadCount',
              ),
              builder: (context, snapshot) {
                final row = snapshot.data?.firstOrNull;
                final entityCount = row?['entityCount'] ?? 0;
                final dataCount = row?['dataCount'] ?? 0;
                final unreadCount = row?['unreadCount'] ?? 0;

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Resumo', style: AppTypography.h3),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: StatCard(
                            title: 'Entidades',
                            value: '$entityCount',
                            icon: Icons.category_outlined,
                            color: AppColors.info,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: StatCard(
                            title: 'Registros',
                            value: '$dataCount',
                            icon: Icons.storage_outlined,
                            color: AppColors.success,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: StatCard(
                            title: 'Notificacoes',
                            value: '$unreadCount',
                            icon: Icons.notifications_outlined,
                            color: AppColors.warning,
                          ),
                        ),
                        const Expanded(child: SizedBox()),
                      ],
                    ),
                  ],
                );
              },
            ),

            const SizedBox(height: 24),

            // Quick access - entities list
            StreamBuilder<List<Map<String, dynamic>>>(
              stream: db.watch(
                'SELECT e.*, (SELECT COUNT(*) FROM EntityData WHERE entityId = e.id AND deletedAt IS NULL) as recordCount '
                'FROM Entity e ORDER BY e.name ASC',
              ),
              builder: (context, snapshot) {
                final entities = snapshot.data ?? [];
                if (entities.isEmpty) return const SizedBox.shrink();

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Acesso rapido', style: AppTypography.h3),
                        TextButton(
                          onPressed: () => context.go('/entities'),
                          child: const Text('Ver tudo'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    SizedBox(
                      height: 90,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: entities.length,
                        separatorBuilder: (_, __) => const SizedBox(width: 12),
                        itemBuilder: (context, index) {
                          final entity = entities[index];
                          final slug = entity['slug'] as String;
                          final name = entity['name'] as String;
                          final color = entity['color'] as String?;
                          final recordCount = entity['recordCount'] ?? 0;

                          return GestureDetector(
                            onTap: () => context.push('/data/$slug'),
                            child: Container(
                              width: 110,
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: color != null
                                    ? Color(int.parse(
                                            color.replaceFirst('#', '0xFF')))
                                        .withValues(alpha: 0.1)
                                    : AppColors.muted,
                                borderRadius:
                                    BorderRadius.circular(AppColors.radius),
                                border: Border.all(
                                  color: color != null
                                      ? Color(int.parse(
                                              color.replaceFirst('#', '0xFF')))
                                          .withValues(alpha: 0.3)
                                      : AppColors.border,
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    name,
                                    style: AppTypography.labelMedium,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  Text(
                                    '$recordCount registros',
                                    style: AppTypography.caption.copyWith(
                                      color: AppColors.mutedForeground,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ],
                );
              },
            ),

            const SizedBox(height: 24),

            // Recent records
            StreamBuilder<List<Map<String, dynamic>>>(
              stream: db.watch(
                'SELECT ed.*, e.name as entityName, e.slug as entitySlug, e.color as entityColor, e.fields as entityFields '
                'FROM EntityData ed '
                'JOIN Entity e ON ed.entityId = e.id '
                'WHERE ed.parentRecordId IS NULL AND ed.deletedAt IS NULL '
                'ORDER BY ed.updatedAt DESC LIMIT 10',
              ),
              builder: (context, snapshot) {
                final records = snapshot.data ?? [];
                if (records.isEmpty) return const SizedBox.shrink();

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Atividade recente', style: AppTypography.h3),
                    const SizedBox(height: 12),
                    ...records.map((record) {
                      final entityName =
                          record['entityName'] as String? ?? '';
                      final entitySlug =
                          record['entitySlug'] as String? ?? '';
                      final entityColor =
                          record['entityColor'] as String?;
                      final recordId = record['id'] as String;
                      final updatedAt = record['updatedAt'] as String?;

                      // Parse record data to get display name
                      String displayName = 'Registro';
                      try {
                        final fields = jsonDecode(
                            record['entityFields'] as String? ?? '[]');
                        final data = jsonDecode(
                            record['data'] as String? ?? '{}');
                        if (fields is List && fields.isNotEmpty && data is Map) {
                          final firstField = fields.first as Map<String, dynamic>;
                          final slug = firstField['slug'] as String? ??
                              firstField['name'] as String? ??
                              '';
                          final val = data[slug];
                          if (val != null && val.toString().isNotEmpty) {
                            displayName = val.toString();
                          }
                        }
                      } catch (_) {}

                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: ListTile(
                          dense: true,
                          leading: CircleAvatar(
                            radius: 18,
                            backgroundColor: entityColor != null
                                ? Color(int.parse(entityColor
                                        .replaceFirst('#', '0xFF')))
                                    .withValues(alpha: 0.15)
                                : AppColors.muted,
                            child: Icon(
                              Icons.article_outlined,
                              size: 18,
                              color: entityColor != null
                                  ? Color(int.parse(entityColor
                                      .replaceFirst('#', '0xFF')))
                                  : AppColors.primary,
                            ),
                          ),
                          title: Text(
                            displayName,
                            style: AppTypography.labelMedium,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          subtitle: Text(
                            '$entityName · ${Formatters.timeAgo(updatedAt)}',
                            style: AppTypography.caption.copyWith(
                              color: AppColors.mutedForeground,
                            ),
                          ),
                          trailing: const Icon(
                            Icons.chevron_right,
                            size: 18,
                          ),
                          onTap: () => context.push(
                            '/data/$entitySlug/$recordId',
                          ),
                        ),
                      );
                    }),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
