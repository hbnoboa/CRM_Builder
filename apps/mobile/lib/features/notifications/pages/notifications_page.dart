import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:crm_mobile/core/database/app_database.dart';
import 'package:crm_mobile/core/network/api_client.dart';
import 'package:crm_mobile/core/theme/app_colors.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:crm_mobile/shared/utils/formatters.dart';
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

          return ListView.separated(
            itemCount: notifications.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (context, index) {
              final notif = notifications[index];
              final isRead = notif['read'] == 1 || notif['read'] == true;
              final type = notif['type'] as String? ?? 'INFO';
              final createdAt = notif['createdAt'] as String?;

              // Parse data/metadata for deep linking
              String? entitySlug = notif['entitySlug'] as String?;
              String? recordId;
              try {
                final dataJson = notif['data'];
                if (dataJson is String && dataJson.isNotEmpty) {
                  final meta = jsonDecode(dataJson) as Map<String, dynamic>;
                  entitySlug ??= meta['entitySlug'] as String?;
                  recordId = meta['recordId'] as String?;
                }
              } catch (_) {}

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

              final hasLink = entitySlug != null && recordId != null;

              return ListTile(
                leading: Icon(icon, color: iconColor),
                title: Text(
                  notif['title'] as String? ?? '',
                  style: AppTypography.labelLarge.copyWith(
                    fontWeight: isRead ? FontWeight.w400 : FontWeight.w600,
                  ),
                ),
                subtitle: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      notif['message'] as String? ?? '',
                      style: AppTypography.bodySmall.copyWith(
                        color: AppColors.mutedForeground,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      Formatters.timeAgo(createdAt),
                      style: AppTypography.caption.copyWith(
                        color: AppColors.mutedForeground,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (!isRead)
                      Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(
                          color: AppColors.info,
                          shape: BoxShape.circle,
                        ),
                      ),
                    if (hasLink) ...[
                      const SizedBox(width: 8),
                      const Icon(Icons.chevron_right, size: 18),
                    ],
                  ],
                ),
                onTap: () {
                  if (!isRead) {
                    _markRead(ref, notif['id'] as String);
                  }
                  if (hasLink) {
                    context.push('/data/$entitySlug/$recordId');
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
