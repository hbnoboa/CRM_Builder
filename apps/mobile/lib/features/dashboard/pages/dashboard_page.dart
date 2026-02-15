import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:crm_mobile/core/auth/auth_provider.dart';
import 'package:crm_mobile/core/database/app_database.dart';
import 'package:crm_mobile/core/theme/app_colors.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:crm_mobile/features/dashboard/widgets/stat_card.dart';
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
          // Force a sync check
          await ref.read(authProvider.notifier).getProfile();
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Stats row
            FutureBuilder<List<Map<String, dynamic>>>(
              future: Future.wait([
                db.getAll('SELECT COUNT(*) as count FROM Entity'),
                db.getAll('SELECT COUNT(*) as count FROM EntityData'),
                db.getAll(
                    'SELECT COUNT(*) as count FROM Notification WHERE read = 0'),
              ]).then((results) => results.map((r) => r.first).toList()),
              builder: (context, snapshot) {
                final data = snapshot.data;
                final entityCount = data?[0]['count'] ?? 0;
                final dataCount = data?[1]['count'] ?? 0;
                final unreadCount = data?[2]['count'] ?? 0;

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
                            title: 'Nao lidas',
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
          ],
        ),
      ),
    );
  }
}
