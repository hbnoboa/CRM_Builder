import 'package:flutter/material.dart';
import 'package:crm_mobile/core/database/app_database.dart';
import 'package:crm_mobile/core/config/env.dart';
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

  Future<Map<String, int>> _getTableCounts() async {
    final db = AppDatabase.instance.db;
    final results = <String, int>{};

    try {
      final entities = await db.getAll('SELECT COUNT(*) as count FROM Entity');
      results['Entity'] = (entities.first['count'] as num?)?.toInt() ?? 0;
    } catch (_) {
      results['Entity'] = -1;
    }

    try {
      final data = await db.getAll('SELECT COUNT(*) as count FROM EntityData WHERE deletedAt IS NULL');
      results['EntityData'] = (data.first['count'] as num?)?.toInt() ?? 0;
    } catch (_) {
      results['EntityData'] = -1;
    }

    try {
      final roles = await db.getAll('SELECT COUNT(*) as count FROM CustomRole');
      results['CustomRole'] = (roles.first['count'] as num?)?.toInt() ?? 0;
    } catch (_) {
      results['CustomRole'] = -1;
    }

    try {
      final users = await db.getAll('SELECT COUNT(*) as count FROM User');
      results['User'] = (users.first['count'] as num?)?.toInt() ?? 0;
    } catch (_) {
      results['User'] = -1;
    }

    return results;
  }

  void _showDebugDialog(BuildContext context, SyncStatus? status) async {
    final counts = await _getTableCounts();

    if (!context.mounted) return;

    showDialog(
      context: context,
      builder: (ctx) {
        final colors = ctx.colors;

        return AlertDialog(
          title: Row(
            children: [
              Icon(
                status?.connected == true ? Icons.cloud_done : Icons.cloud_off,
                color: status?.connected == true ? colors.success : colors.destructive,
              ),
              const SizedBox(width: 8),
              const Text('PowerSync Debug'),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // URLs de configuracao
                const Text('Configuracao:', style: AppTypography.labelMedium),
                const SizedBox(height: 4),
                _buildStatusRow(ctx, 'API URL', Env.apiUrl, colors.mutedForeground),
                _buildStatusRow(ctx, 'PowerSync URL', Env.powerSyncUrl, colors.mutedForeground),
                const Divider(height: 24),

                // Status de conexao
                const Text('Status:', style: AppTypography.labelMedium),
                const SizedBox(height: 4),
                _buildStatusRow(ctx, 'Conectado', status?.connected == true ? 'Sim' : 'Nao'),
                _buildStatusRow(ctx, 'Uploading', status?.uploading == true ? 'Sim' : 'Nao'),
                _buildStatusRow(ctx, 'Downloading', status?.downloading == true ? 'Sim' : 'Nao'),
                if (status?.lastSyncedAt != null)
                  _buildStatusRow(ctx, 'Ultimo sync', _formatDate(status!.lastSyncedAt!)),
                const Divider(height: 24),

                // Contagem de tabelas
                const Text('Tabelas Locais:', style: AppTypography.labelMedium),
                const SizedBox(height: 8),
                ...counts.entries.map((e) => _buildStatusRow(
                  ctx,
                  e.key,
                  e.value >= 0 ? '${e.value} registros' : 'Erro',
                  e.value == 0 ? colors.warning : null,
                ),),
                const Divider(height: 24),

                // Alerta se sem dados
                if (counts.values.every((v) => v == 0))
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: colors.warning.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.warning, color: colors.warning, size: 20),
                            const SizedBox(width: 8),
                            Text(
                              'Nenhum dado sincronizado!',
                              style: AppTypography.labelSmall.copyWith(
                                color: colors.warning,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Possiveis causas:\n'
                          '- PowerSync service offline\n'
                          '- JWT secret incorreto\n'
                          '- Sync rules com erro\n'
                          '- Sem dados no tenant',
                          style: AppTypography.caption.copyWith(color: colors.warning),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () async {
                Navigator.pop(ctx);
                // Force reconnect
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
