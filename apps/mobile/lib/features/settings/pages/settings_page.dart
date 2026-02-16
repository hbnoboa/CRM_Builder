import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:local_auth/local_auth.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:crm_mobile/core/auth/secure_storage.dart';
import 'package:crm_mobile/core/cache/crm_cache_manager.dart';
import 'package:crm_mobile/core/database/app_database.dart';
import 'package:crm_mobile/core/theme/app_colors.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:crm_mobile/core/theme/theme_provider.dart';
import 'package:crm_mobile/core/upload/local_file_storage.dart';
import 'package:crm_mobile/core/upload/upload_queue_service.dart';

class SettingsPage extends ConsumerStatefulWidget {
  const SettingsPage({super.key});

  @override
  ConsumerState<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends ConsumerState<SettingsPage> {
  bool _biometricEnabled = false;
  bool _biometricSupported = false;
  String _appVersion = '';
  int _pendingUploads = 0;
  String _uploadQueueSize = '...';

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final bio = await SecureStorage.isBiometricEnabled();
    final info = await PackageInfo.fromPlatform();

    // Check if biometric is supported on this device
    final localAuth = LocalAuthentication();
    final canCheck = await localAuth.canCheckBiometrics;
    final isSupported = await localAuth.isDeviceSupported();

    // Load upload queue info
    final pendingCount = await _getPendingUploadCount();
    final queueSize = await LocalFileStorage.instance.getQueueSize();

    if (mounted) {
      setState(() {
        _biometricEnabled = bio;
        _biometricSupported = canCheck && isSupported;
        _appVersion = '${info.version}+${info.buildNumber}';
        _pendingUploads = pendingCount;
        _uploadQueueSize = _formatBytes(queueSize);
      });
    }
  }

  Future<int> _getPendingUploadCount() async {
    try {
      final db = AppDatabase.instance.db;
      final result = await db.getAll(
        "SELECT COUNT(*) as count FROM file_upload_queue WHERE status IN ('pending', 'failed', 'uploading')",
      );
      return (result.first['count'] as num?)?.toInt() ?? 0;
    } catch (_) {
      return 0;
    }
  }

  String _formatBytes(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  @override
  Widget build(BuildContext context) {
    final themeMode = ref.watch(themeModeNotifierProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Configuracoes')),
      body: ListView(
        children: [
          const SizedBox(height: 8),

          // Appearance
          const _SectionHeader(title: 'Aparencia'),
          ListTile(
            leading: Icon(_themeIcon(themeMode)),
            title: const Text('Tema'),
            subtitle: Text(_themeLabel(themeMode)),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => _showThemePicker(context),
          ),
          const Divider(),

          // Security
          const _SectionHeader(title: 'Seguranca'),
          SwitchListTile(
            secondary: const Icon(Icons.fingerprint),
            title: const Text('Biometria'),
            subtitle: Text(
              _biometricSupported
                  ? 'Desbloquear com digital/face'
                  : 'Nao suportado neste dispositivo',
            ),
            value: _biometricEnabled,
            onChanged: _biometricSupported
                ? (value) async {
                    await SecureStorage.setBiometricEnabled(value);
                    setState(() => _biometricEnabled = value);
                  }
                : null,
          ),
          const Divider(),

          // Uploads
          const _SectionHeader(title: 'Uploads'),
          ListTile(
            leading: const Icon(Icons.cloud_upload_outlined),
            title: const Text('Uploads pendentes'),
            subtitle: Text('$_pendingUploads pendentes ($_uploadQueueSize)'),
            trailing: _pendingUploads > 0
                ? TextButton(
                    onPressed: _retryUploads,
                    child: const Text('Tentar'),
                  )
                : null,
          ),
          const Divider(),

          // Cache
          const _SectionHeader(title: 'Cache de Imagens'),
          ListTile(
            leading: const Icon(Icons.photo_library_outlined),
            title: const Text('Cache de imagens'),
            subtitle: const Text('Imagens baixadas para acesso offline'),
            trailing: TextButton(
              onPressed: _clearImageCache,
              child: const Text('Limpar'),
            ),
          ),
          const Divider(),

          // Data
          const _SectionHeader(title: 'Dados'),
          ListTile(
            leading: Icon(Icons.cached, color: AppColors.warning),
            title: const Text('Limpar cache local'),
            subtitle: const Text('Remove dados locais e re-sincroniza'),
            onTap: () => _confirmClearCache(context),
          ),
          const Divider(),

          // About
          const _SectionHeader(title: 'Sobre'),
          ListTile(
            leading: const Icon(Icons.info_outline),
            title: const Text('Versao'),
            trailing: Text(
              _appVersion.isNotEmpty ? _appVersion : '...',
            ),
          ),
        ],
      ),
    );
  }

  IconData _themeIcon(ThemeMode mode) {
    return switch (mode) {
      ThemeMode.system => Icons.brightness_auto,
      ThemeMode.light => Icons.light_mode,
      ThemeMode.dark => Icons.dark_mode,
    };
  }

  String _themeLabel(ThemeMode mode) {
    return switch (mode) {
      ThemeMode.system => 'Sistema',
      ThemeMode.light => 'Claro',
      ThemeMode.dark => 'Escuro',
    };
  }

  Future<void> _retryUploads() async {
    try {
      final queueService = ref.read(uploadQueueServiceProvider);
      await queueService.retryAll();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Tentando enviar uploads...')),
        );
        // Refresh counts
        final count = await _getPendingUploadCount();
        setState(() => _pendingUploads = count);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro: $e')),
        );
      }
    }
  }

  Future<void> _clearImageCache() async {
    try {
      await CrmCacheManager().clearCache();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Cache de imagens limpo')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro ao limpar cache: $e')),
        );
      }
    }
  }

  Future<void> _confirmClearCache(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Limpar cache'),
        content: const Text(
          'Todos os dados locais serao removidos e re-sincronizados do servidor. Deseja continuar?',
        ),
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
            child: const Text('Limpar'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      final messenger = ScaffoldMessenger.of(context);
      try {
        await AppDatabase.instance.db.disconnectAndClear();
        await AppDatabase.instance.connect();
        if (mounted) {
          messenger.showSnackBar(
            const SnackBar(content: Text('Cache limpo com sucesso')),
          );
        }
      } catch (e) {
        if (mounted) {
          messenger.showSnackBar(
            SnackBar(content: Text('Erro ao limpar cache: $e')),
          );
        }
      }
    }
  }

  void _showThemePicker(BuildContext context) {
    final themeMode = ref.read(themeModeNotifierProvider);

    showModalBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text('Tema', style: AppTypography.h4),
            ),
            RadioListTile<ThemeMode>(
              title: const Text('Sistema'),
              subtitle: const Text('Segue a configuracao do dispositivo'),
              value: ThemeMode.system,
              groupValue: themeMode,
              onChanged: (v) {
                ref
                    .read(themeModeNotifierProvider.notifier)
                    .setThemeMode(v!);
                Navigator.of(ctx).pop();
              },
            ),
            RadioListTile<ThemeMode>(
              title: const Text('Claro'),
              value: ThemeMode.light,
              groupValue: themeMode,
              onChanged: (v) {
                ref
                    .read(themeModeNotifierProvider.notifier)
                    .setThemeMode(v!);
                Navigator.of(ctx).pop();
              },
            ),
            RadioListTile<ThemeMode>(
              title: const Text('Escuro'),
              value: ThemeMode.dark,
              groupValue: themeMode,
              onChanged: (v) {
                ref
                    .read(themeModeNotifierProvider.notifier)
                    .setThemeMode(v!);
                Navigator.of(ctx).pop();
              },
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Text(
        title,
        style: AppTypography.labelMedium.copyWith(
          color: Theme.of(context).colorScheme.primary,
        ),
      ),
    );
  }
}
