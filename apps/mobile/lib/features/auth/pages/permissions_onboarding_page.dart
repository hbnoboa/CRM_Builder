import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:crm_mobile/core/permissions/device_permissions_provider.dart';
import 'package:crm_mobile/core/theme/app_colors.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';

class PermissionsOnboardingPage extends ConsumerStatefulWidget {
  const PermissionsOnboardingPage({super.key});

  @override
  ConsumerState<PermissionsOnboardingPage> createState() =>
      _PermissionsOnboardingPageState();
}

class _PermissionsOnboardingPageState
    extends ConsumerState<PermissionsOnboardingPage>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Check current status on open
    Future.microtask(() {
      ref.read(devicePermissionsProvider.notifier).checkAll();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Re-check permissions when returning from settings
    if (state == AppLifecycleState.resumed) {
      ref.read(devicePermissionsProvider.notifier).checkAll();
    }
  }

  @override
  Widget build(BuildContext context) {
    final permsState = ref.watch(devicePermissionsProvider);

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Icon
                const Icon(
                  Icons.security_outlined,
                  size: 48,
                  color: AppColors.primary,
                ),
                const SizedBox(height: 16),

                // Title
                Text(
                  'Permissoes necessarias',
                  style: AppTypography.h2.copyWith(
                    color: AppColors.foreground,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  'Para funcionar corretamente, precisamos das seguintes permissoes:',
                  style: AppTypography.bodyMedium.copyWith(
                    color: AppColors.mutedForeground,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 32),

                // Permission cards
                _PermissionCard(
                  icon: Icons.location_on_outlined,
                  title: 'Localizacao',
                  description:
                      'Captura automatica de coordenadas nos formularios',
                  granted: permsState.locationGranted,
                ),
                const SizedBox(height: 12),
                _PermissionCard(
                  icon: Icons.camera_alt_outlined,
                  title: 'Camera',
                  description: 'Tirar fotos para anexar aos registros',
                  granted: permsState.cameraGranted,
                ),
                const SizedBox(height: 12),
                _PermissionCard(
                  icon: Icons.notifications_outlined,
                  title: 'Notificacoes',
                  description:
                      'Receber alertas sobre atualizacoes nos registros',
                  granted: permsState.notificationsGranted,
                ),
                const SizedBox(height: 32),

                // Grant permissions button
                if (!permsState.allGranted) ...[
                  SizedBox(
                    height: 48,
                    child: ElevatedButton(
                      onPressed: permsState.isChecking
                          ? null
                          : () async {
                              await ref
                                  .read(devicePermissionsProvider.notifier)
                                  .requestAll();
                            },
                      child: permsState.isChecking
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: AppColors.primaryForeground,
                              ),
                            )
                          : const Text('Conceder Permissoes'),
                    ),
                  ),

                  // Open settings button (if permanently denied)
                  if (permsState.hasPermanentlyDenied) ...[
                    const SizedBox(height: 12),
                    SizedBox(
                      height: 48,
                      child: OutlinedButton.icon(
                        onPressed: () {
                          ref
                              .read(devicePermissionsProvider.notifier)
                              .openSettings();
                        },
                        icon: const Icon(Icons.settings_outlined),
                        label: const Text('Abrir Configuracoes'),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Algumas permissoes foram negadas permanentemente. Abra as configuracoes para concede-las manualmente.',
                      style: AppTypography.caption.copyWith(
                        color: AppColors.mutedForeground,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],

                  // Check again button
                  const SizedBox(height: 12),
                  TextButton(
                    onPressed: permsState.isChecking
                        ? null
                        : () {
                            ref
                                .read(devicePermissionsProvider.notifier)
                                .checkAll();
                          },
                    child: const Text('Verificar Novamente'),
                  ),

                  // Exit button
                  const SizedBox(height: 4),
                  TextButton(
                    onPressed: () => SystemNavigator.pop(),
                    child: Text(
                      'Sair',
                      style: AppTypography.bodySmall.copyWith(
                        color: AppColors.mutedForeground,
                      ),
                    ),
                  ),
                ],

                // All granted - success message (router will redirect)
                if (permsState.allGranted) ...[
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(AppColors.radius),
                      border: Border.all(
                        color: AppColors.primary.withValues(alpha: 0.3),
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.check_circle, color: AppColors.primary),
                        const SizedBox(width: 8),
                        Text(
                          'Todas as permissoes concedidas!',
                          style: AppTypography.bodyMedium.copyWith(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Center(
                    child: SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PermissionCard extends StatelessWidget {
  const _PermissionCard({
    required this.icon,
    required this.title,
    required this.description,
    required this.granted,
  });

  final IconData icon;
  final String title;
  final String description;
  final bool granted;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppColors.radius),
        border: Border.all(
          color: granted
              ? AppColors.primary.withValues(alpha: 0.3)
              : AppColors.border,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: (granted ? AppColors.primary : AppColors.muted)
                  .withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(AppColors.radius),
            ),
            child: Icon(
              icon,
              color: granted ? AppColors.primary : AppColors.mutedForeground,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: AppTypography.labelLarge.copyWith(
                    color: AppColors.foreground,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  description,
                  style: AppTypography.caption.copyWith(
                    color: AppColors.mutedForeground,
                  ),
                ),
              ],
            ),
          ),
          Icon(
            granted ? Icons.check_circle : Icons.circle_outlined,
            color: granted ? AppColors.primary : AppColors.mutedForeground,
            size: 24,
          ),
        ],
      ),
    );
  }
}
