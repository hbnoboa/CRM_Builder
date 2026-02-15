import 'package:flutter/material.dart';
import 'package:crm_mobile/core/database/app_database.dart';
import 'package:crm_mobile/core/theme/app_colors.dart';
import 'package:powersync/powersync.dart';

/// Small indicator showing PowerSync sync status.
/// Used in AppBar actions.
class SyncStatusIndicator extends StatelessWidget {
  const SyncStatusIndicator({super.key});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<SyncStatus>(
      stream: AppDatabase.instance.db.statusStream,
      builder: (context, snapshot) {
        final status = snapshot.data;
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

        return Tooltip(
          message: tooltip,
          child: Padding(
            padding: const EdgeInsets.all(8.0),
            child: Icon(icon, color: color, size: 20),
          ),
        );
      },
    );
  }
}
