import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:crm_mobile/core/database/app_database.dart';
import 'package:crm_mobile/core/network/api_client.dart';
import 'package:crm_mobile/core/theme/app_colors.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:crm_mobile/shared/widgets/sync_status_indicator.dart';

class NotificationsPage extends ConsumerWidget {
  const NotificationsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final db = AppDatabase.instance.db;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notificacoes'),
        actions: [
          const SyncStatusIndicator(),
          IconButton(
            icon: const Icon(Icons.done_all),
            tooltip: 'Marcar todas como lidas',
            onPressed: () => _markAllRead(ref),
          ),
        ],
      ),
      body: StreamBuilder<List<Map<String, dynamic>>>(
        stream: db.watch(
          'SELECT * FROM Notification ORDER BY createdAt DESC LIMIT 50',
        ),
        builder: (context, snapshot) {
          final notifications = snapshot.data ?? [];

          if (notifications.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.notifications_none,
                      size: 64, color: AppColors.mutedForeground),
                  const SizedBox(height: 16),
                  Text(
                    'Nenhuma notificacao',
                    style: AppTypography.bodyMedium
                        .copyWith(color: AppColors.mutedForeground),
                  ),
                ],
              ),
            );
          }

          return ListView.builder(
            itemCount: notifications.length,
            itemBuilder: (context, index) {
              final notif = notifications[index];
              final isRead = notif['read'] == 1 || notif['read'] == true;
              final type = notif['type'] as String? ?? 'INFO';

              IconData icon;
              Color iconColor;
              switch (type) {
                case 'SUCCESS':
                  icon = Icons.check_circle_outline;
                  iconColor = AppColors.success;
                case 'WARNING':
                  icon = Icons.warning_amber_outlined;
                  iconColor = AppColors.warning;
                case 'ERROR':
                  icon = Icons.error_outline;
                  iconColor = AppColors.error;
                default:
                  icon = Icons.info_outline;
                  iconColor = AppColors.info;
              }

              return ListTile(
                leading: Icon(icon, color: iconColor),
                title: Text(
                  notif['title'] as String? ?? '',
                  style: AppTypography.labelLarge.copyWith(
                    fontWeight: isRead ? FontWeight.w400 : FontWeight.w600,
                  ),
                ),
                subtitle: Text(
                  notif['message'] as String? ?? '',
                  style: AppTypography.bodySmall.copyWith(
                    color: AppColors.mutedForeground,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                trailing: !isRead
                    ? Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(
                          color: AppColors.info,
                          shape: BoxShape.circle,
                        ),
                      )
                    : null,
                onTap: () {
                  if (!isRead) {
                    _markRead(ref, notif['id'] as String);
                  }
                },
              );
            },
          );
        },
      ),
    );
  }

  Future<void> _markRead(WidgetRef ref, String notificationId) async {
    try {
      final dio = ref.read(apiClientProvider);
      await dio.patch('/notifications/$notificationId/read');
    } catch (_) {}
  }

  Future<void> _markAllRead(WidgetRef ref) async {
    try {
      final dio = ref.read(apiClientProvider);
      await dio.patch('/notifications/read-all');
    } catch (_) {}
  }
}
