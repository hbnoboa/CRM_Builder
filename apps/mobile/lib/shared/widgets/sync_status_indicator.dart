import 'package:flutter/material.dart';
import 'package:crm_mobile/core/database/app_database.dart';
import 'package:crm_mobile/core/theme/app_colors.dart';
import 'package:powersync/powersync.dart';

/// Small indicator showing PowerSync sync status + pending uploads badge.
/// Used in AppBar actions.
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

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<SyncStatus>(
      stream: AppDatabase.instance.db.statusStream,
      builder: (context, syncSnapshot) {
        final status = syncSnapshot.data;
        final connected = status?.connected ?? false;
        final uploading = status?.uploading ?? false;
        final downloading = status?.downloading ?? false;

        Color color;
        IconData icon;
        String tooltip;

        if (!connected) {
          color = AppColors.syncOffline;
          icon = Icons.cloud_off;
          tooltip = 'Offline';
        } else if (uploading || downloading) {
          color = AppColors.syncSyncing;
          icon = Icons.sync;
          tooltip = 'Sincronizando...';
        } else {
          color = AppColors.syncOnline;
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
                        decoration: const BoxDecoration(
                          color: AppColors.warning,
                          shape: BoxShape.circle,
                        ),
                        constraints: const BoxConstraints(
                          minWidth: 16,
                          minHeight: 16,
                        ),
                        child: Text(
                          pendingCount > 9 ? '9+' : '$pendingCount',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 9,
                            fontWeight: FontWeight.bold,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}
