import 'package:flutter/material.dart';
import 'package:crm_mobile/core/database/app_database.dart';
import 'package:crm_mobile/core/theme/app_colors_extension.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:powersync/powersync.dart' hide Column;

/// Small indicator showing PowerSync sync status + pending uploads badge.
/// Used in AppBar actions. Tap to see debug info.
class SyncStatusIndicator extends StatelessWidget {
  const SyncStatusIndicator({super.key});

  /// Watch pending upload count directly from the local-only table.
  Stream<int> _watchPendingUploads() {
    return AppDatabase.instance.db
        .watch(
          "SELECT COUNT(*) as count FROM file_upload_queue WHERE status IN ('pending', 'failed', 'uploading')",
        )
        .map((rows) => (rows.first['count'] as num?)?.toInt() ?? 0);
  }

  void _showDebugDialog(BuildContext context, SyncStatus? status) {
    final colors = context.colors;

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: Row(
            children: [
              Icon(
                status?.connected == true ? Icons.cloud_done : Icons.cloud_off,
                color: status?.connected == true ? colors.success : colors.destructive,
              ),
              const SizedBox(width: 8),
              const Text('PowerSync'),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildStatusRow(ctx, 'Conectado', status?.connected == true ? 'Sim' : 'Nao',
                  status?.connected == true ? colors.success : colors.destructive),
              _buildStatusRow(ctx, 'Uploading', status?.uploading == true ? 'Sim' : 'Nao',
                  status?.uploading == true ? colors.warning : null),
              _buildStatusRow(ctx, 'Downloading', status?.downloading == true ? 'Sim' : 'Nao',
                  status?.downloading == true ? colors.warning : null),
              _buildStatusRow(ctx, 'Ultimo sync',
                  status?.lastSyncedAt != null ? _formatDate(status!.lastSyncedAt!) : '-'),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () async {
                Navigator.pop(ctx);
                await AppDatabase.instance.db.disconnect();
                await AppDatabase.instance.connect();
              },
              child: const Text('Reconectar'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Fechar'),
            ),
          ],
        );
      },
    );
  }

  Widget _buildStatusRow(BuildContext context, String label, String value, [Color? valueColor]) {
    final onSurface = Theme.of(context).colorScheme.onSurface;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: AppTypography.bodySmall),
          Text(
            value,
            style: AppTypography.labelSmall.copyWith(
              color: valueColor ?? onSurface,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  String _formatDate(DateTime dt) {
    return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}:${dt.second.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<SyncStatus>(
      stream: AppDatabase.instance.db.statusStream,
      builder: (context, syncSnapshot) {
        final status = syncSnapshot.data;
        final connected = status?.connected ?? false;
        final uploading = status?.uploading ?? false;
        final downloading = status?.downloading ?? false;

        final colors = context.colors;

        Color color;
        IconData icon;
        String tooltip;

        if (!connected) {
          color = colors.destructive;
          icon = Icons.cloud_off;
          tooltip = 'Offline';
        } else if (uploading || downloading) {
          color = colors.warning;
          icon = Icons.sync;
          tooltip = 'Sincronizando...';
        } else {
          color = colors.success;
          icon = Icons.cloud_done;
          tooltip = 'Sincronizado';
        }

        return StreamBuilder<int>(
          stream: _watchPendingUploads(),
          initialData: 0,
          builder: (context, uploadSnapshot) {
            final pendingCount = uploadSnapshot.data ?? 0;

            return Tooltip(
              message: pendingCount > 0
                  ? '$tooltip ($pendingCount uploads pendentes)'
                  : tooltip,
              child: GestureDetector(
                onTap: () => _showDebugDialog(context, status),
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(8.0),
                      child: Icon(icon, color: color, size: 20),
                    ),
                    if (pendingCount > 0)
                      Positioned(
                        top: 2,
                        right: 2,
                        child: Container(
                          padding: const EdgeInsets.all(3),
                          decoration: BoxDecoration(
                            color: colors.warning,
                            shape: BoxShape.circle,
                          ),
                          constraints: const BoxConstraints(
                            minWidth: 16,
                            minHeight: 16,
                          ),
                          child: Text(
                            pendingCount > 9 ? '9+' : '$pendingCount',
                            style: TextStyle(
                              color: colors.warningForeground,
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}
