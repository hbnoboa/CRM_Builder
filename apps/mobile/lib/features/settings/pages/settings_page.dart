import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:local_auth/local_auth.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:crm_mobile/core/auth/secure_storage.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:crm_mobile/core/theme/theme_provider.dart';

class SettingsPage extends ConsumerStatefulWidget {
  const SettingsPage({super.key});

  @override
  ConsumerState<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends ConsumerState<SettingsPage> {
  bool _biometricEnabled = false;
  bool _biometricSupported = false;
  String _appVersion = '';

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

    if (mounted) {
      setState(() {
        _biometricEnabled = bio;
        _biometricSupported = canCheck && isSupported;
        _appVersion = '${info.version}+${info.buildNumber}';
      });
    }
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
