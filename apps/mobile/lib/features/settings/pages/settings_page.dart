import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:crm_mobile/core/auth/secure_storage.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';

class SettingsPage extends ConsumerStatefulWidget {
  const SettingsPage({super.key});

  @override
  ConsumerState<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends ConsumerState<SettingsPage> {
  bool _biometricEnabled = false;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final bio = await SecureStorage.isBiometricEnabled();
    setState(() => _biometricEnabled = bio);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Configuracoes')),
      body: ListView(
        children: [
          const SizedBox(height: 8),
          _SectionHeader(title: 'Seguranca'),
          SwitchListTile(
            title: const Text('Biometria'),
            subtitle: const Text('Desbloquear com digital/face'),
            value: _biometricEnabled,
            onChanged: (value) async {
              await SecureStorage.setBiometricEnabled(value);
              setState(() => _biometricEnabled = value);
            },
          ),
          const Divider(),

          _SectionHeader(title: 'Sobre'),
          const ListTile(
            title: Text('Versao'),
            trailing: Text('1.0.0'),
          ),
        ],
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
