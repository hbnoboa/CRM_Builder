import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:crm_mobile/core/auth/auth_provider.dart';
import 'package:crm_mobile/core/tenant/tenant_provider.dart';
import 'package:crm_mobile/core/theme/app_colors.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';


class TenantSelectorPage extends ConsumerStatefulWidget {
  const TenantSelectorPage({super.key});

  @override
  ConsumerState<TenantSelectorPage> createState() => _TenantSelectorPageState();
}

class _TenantSelectorPageState extends ConsumerState<TenantSelectorPage> {
  final _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    // Load tenants on page open
    Future.microtask(() {
      ref.read(tenantSwitchProvider.notifier).loadTenants();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tenantState = ref.watch(tenantSwitchProvider);
    final authState = ref.watch(authProvider);
    final userTenantId = authState.user?.tenantId;

    // Filter tenants by search query
    final tenants = _searchQuery.isEmpty
        ? tenantState.tenants
        : tenantState.tenants
            .where((t) =>
                t.name.toLowerCase().contains(_searchQuery.toLowerCase()) ||
                t.slug.toLowerCase().contains(_searchQuery.toLowerCase()))
            .toList();

    return Stack(
      children: [
        Scaffold(
          appBar: AppBar(
            title: const Text('Selecionar Tenant'),
          ),
          body: Column(
            children: [
              // Search bar
              Padding(
                padding: const EdgeInsets.all(16),
                child: TextField(
                  controller: _searchController,
                  decoration: InputDecoration(
                    hintText: 'Buscar tenant...',
                    prefixIcon: const Icon(Icons.search, size: 20),
                    suffixIcon: _searchQuery.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear, size: 20),
                            onPressed: () {
                              _searchController.clear();
                              setState(() => _searchQuery = '');
                            },
                          )
                        : null,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppColors.radius),
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                  ),
                  onChanged: (value) => setState(() => _searchQuery = value),
                ),
              ),

              // "My tenant" option at top
              if (tenantState.selectedTenantId != null)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Card(
                    color: AppColors.info.withValues(alpha: 0.08),
                    child: ListTile(
                      leading: const CircleAvatar(
                        backgroundColor: AppColors.info,
                        child: Icon(Icons.home, color: Colors.white, size: 20),
                      ),
                      title: Text(
                        'Meu tenant',
                        style: AppTypography.labelMedium.copyWith(
                          color: AppColors.info,
                        ),
                      ),
                      subtitle: const Text('Voltar ao tenant original'),
                      trailing: const Icon(
                        Icons.arrow_forward_ios,
                        size: 16,
                        color: AppColors.info,
                      ),
                      onTap: () async {
                        await ref
                            .read(tenantSwitchProvider.notifier)
                            .clearSelection();
                        if (context.mounted) context.go('/dashboard');
                      },
                    ),
                  ),
                ),

              if (tenantState.selectedTenantId != null)
                const SizedBox(height: 8),

              // Tenant list
              Expanded(
                child: tenantState.isLoading
                    ? const Center(child: CircularProgressIndicator())
                    : tenantState.error != null
                        ? Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  tenantState.error!,
                                  style: AppTypography.bodyMedium.copyWith(
                                    color: AppColors.destructive,
                                  ),
                                ),
                                const SizedBox(height: 16),
                                FilledButton.icon(
                                  onPressed: () => ref
                                      .read(tenantSwitchProvider.notifier)
                                      .loadTenants(),
                                  icon: const Icon(Icons.refresh, size: 18),
                                  label: const Text('Tentar novamente'),
                                ),
                              ],
                            ),
                          )
                        : tenants.isEmpty
                            ? Center(
                                child: Text(
                                  'Nenhum tenant encontrado',
                                  style: AppTypography.bodyMedium.copyWith(
                                    color: AppColors.mutedForeground,
                                  ),
                                ),
                              )
                            : ListView.builder(
                                padding: const EdgeInsets.symmetric(horizontal: 16),
                                itemCount: tenants.length,
                                itemBuilder: (context, index) {
                                  final tenant = tenants[index];
                                  final isSelected =
                                      tenant.id == tenantState.selectedTenantId;
                                  final isOwnTenant = tenant.id == userTenantId &&
                                      tenantState.selectedTenantId == null;

                                  return Card(
                                    margin: const EdgeInsets.only(bottom: 8),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(
                                          AppColors.radius),
                                      side: (isSelected || isOwnTenant)
                                          ? const BorderSide(
                                              color: AppColors.primary,
                                              width: 1.5,
                                            )
                                          : BorderSide.none,
                                    ),
                                    child: ListTile(
                                      leading: CircleAvatar(
                                        backgroundColor: AppColors.primary
                                            .withValues(alpha: 0.1),
                                        child: Text(
                                          tenant.name.isNotEmpty
                                              ? tenant.name[0].toUpperCase()
                                              : '?',
                                          style: AppTypography.labelMedium.copyWith(
                                            color: AppColors.primary,
                                          ),
                                        ),
                                      ),
                                      title: Text(
                                        tenant.name,
                                        style: AppTypography.labelMedium,
                                      ),
                                      subtitle: Text(
                                        '${tenant.userCount} usuarios · ${tenant.status}',
                                        style: AppTypography.caption.copyWith(
                                          color: AppColors.mutedForeground,
                                        ),
                                      ),
                                      trailing: (isSelected || isOwnTenant)
                                          ? const Icon(
                                              Icons.check_circle,
                                              color: AppColors.primary,
                                              size: 22,
                                            )
                                          : const Icon(
                                              Icons.arrow_forward_ios,
                                              size: 16,
                                              color: AppColors.mutedForeground,
                                            ),
                                      onTap: () async {
                                        if (isSelected || isOwnTenant) return;
                                        await ref
                                            .read(tenantSwitchProvider.notifier)
                                            .switchTenant(tenant.id, tenant.name);
                                        if (context.mounted) {
                                          context.go('/dashboard');
                                        }
                                      },
                                    ),
                                  );
                                },
                              ),
              ),
            ],
          ),
        ),

        // Loading overlay during tenant switch
        if (tenantState.isSwitching)
          Container(
            color: Colors.black54,
            child: const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircularProgressIndicator(color: Colors.white),
                  SizedBox(height: 16),
                  Text(
                    'Trocando tenant...',
                    style: TextStyle(color: Colors.white, fontSize: 16),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
