import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:crm_mobile/core/permissions/permission_provider.dart';
import 'package:crm_mobile/core/tenant/tenant_provider.dart';
import 'package:crm_mobile/core/theme/app_colors.dart';

/// Banner displayed when a PLATFORM_ADMIN is viewing another tenant's data.
/// Shows the tenant name and a button to go back to their own tenant.
class TenantBanner extends ConsumerWidget {
  const TenantBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final permissions = ref.watch(permissionsProvider);
    final tenantState = ref.watch(tenantSwitchProvider);

    // Only show for PLATFORM_ADMIN with a selected tenant
    if (!permissions.isPlatformAdmin || tenantState.selectedTenantId == null) {
      return const SizedBox.shrink();
    }

    final tenantName = tenantState.selectedTenantName ?? 'Outro tenant';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      color: AppColors.warning.withValues(alpha: 0.15),
      child: Row(
        children: [
          Icon(
            Icons.business,
            size: 16,
            color: AppColors.warning.withValues(alpha: 0.8),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Visualizando: $tenantName',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: AppColors.warning.withValues(alpha: 0.9),
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          SizedBox(
            height: 28,
            child: TextButton(
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              onPressed: tenantState.isSwitching
                  ? null
                  : () => ref.read(tenantSwitchProvider.notifier).clearSelection(),
              child: Text(
                'Voltar',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.warning.withValues(alpha: 0.9),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
