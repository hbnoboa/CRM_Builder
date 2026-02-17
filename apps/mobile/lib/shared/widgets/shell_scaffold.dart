import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:crm_mobile/core/auth/auth_provider.dart';
import 'package:crm_mobile/core/permissions/permission_provider.dart';
import 'package:crm_mobile/core/tenant/tenant_provider.dart';
import 'package:crm_mobile/core/theme/app_colors.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:crm_mobile/shared/widgets/offline_banner.dart';

/// Main shell scaffold with bottom navigation.
/// Shows only Dashboard (if permitted) and Data modules.
/// Navigation items are conditional based on user permissions.
class ShellScaffold extends ConsumerWidget {
  const ShellScaffold({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final user = authState.user;
    final permissions = ref.watch(permissionsProvider);
    final currentPath = GoRouterState.of(context).matchedLocation;
    final tenantState = ref.watch(tenantSwitchProvider);

    // Build navigation items based on permissions
    final navItems = <_NavItem>[];

    if (permissions.hasModuleAccess('dashboard')) {
      navItems.add(const _NavItem(
        icon: Icons.dashboard_outlined,
        activeIcon: Icons.dashboard_rounded,
        label: 'Dashboard',
        path: '/dashboard',
      ));
    }

    if (permissions.hasModuleAccess('data')) {
      navItems.add(const _NavItem(
        icon: Icons.folder_outlined,
        activeIcon: Icons.folder_rounded,
        label: 'Dados',
        path: '/data',
      ));
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          // Tenant banner for PLATFORM_ADMIN
          if (user?.customRole?.roleType == 'PLATFORM_ADMIN' &&
              tenantState.selectedTenantId != null)
            _TenantBanner(
              tenantName: tenantState.selectedTenantName ?? 'Tenant',
              onClear: () => ref.read(tenantSwitchProvider.notifier).clearSelection(),
            ),
          const OfflineBanner(),
          Expanded(child: child),
        ],
      ),
      bottomNavigationBar: navItems.length > 1
          ? Container(
              decoration: BoxDecoration(
                color: AppColors.card,
                boxShadow: AppColors.navShadow,
              ),
              child: SafeArea(
                child: NavigationBar(
                  selectedIndex: _getSelectedIndex(currentPath, navItems),
                  onDestinationSelected: (index) {
                    context.go(navItems[index].path);
                  },
                  destinations: navItems.map((item) {
                    return NavigationDestination(
                      icon: Icon(item.icon),
                      selectedIcon: Icon(item.activeIcon),
                      label: item.label,
                    );
                  }).toList(),
                ),
              ),
            )
          : null,
    );
  }

  int _getSelectedIndex(String currentPath, List<_NavItem> items) {
    for (var i = 0; i < items.length; i++) {
      if (_isActive(currentPath, items[i].path)) {
        return i;
      }
    }
    return 0;
  }

  bool _isActive(String currentPath, String itemPath) {
    if (currentPath == itemPath) return true;
    if (itemPath == '/data' && currentPath.startsWith('/data/')) return true;
    return currentPath.startsWith(itemPath) && itemPath != '/data';
  }
}

/// Tenant banner shown when PLATFORM_ADMIN has selected a tenant
class _TenantBanner extends StatelessWidget {
  const _TenantBanner({
    required this.tenantName,
    required this.onClear,
  });

  final String tenantName;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: AppColors.spaceMd,
        vertical: AppColors.spaceSm,
      ),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.secondary,
            AppColors.secondary.withValues(alpha: 0.8),
          ],
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.business_rounded,
            size: 16,
            color: Colors.white.withValues(alpha: 0.9),
          ),
          const SizedBox(width: AppColors.spaceSm),
          Expanded(
            child: Text(
              'Visualizando: $tenantName',
              style: AppTypography.labelSmall.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          GestureDetector(
            onTap: onClear,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(AppColors.radiusFull),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.close,
                    size: 14,
                    color: Colors.white,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    'Sair',
                    style: AppTypography.caption.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// User menu button in app bar
class _UserMenuButton extends StatelessWidget {
  const _UserMenuButton({
    required this.user,
    required this.ref,
    required this.tenantState,
  });

  final dynamic user;
  final WidgetRef ref;
  final TenantSwitchState tenantState;

  @override
  Widget build(BuildContext context) {
    final userName = user?.name ?? 'Usuario';
    final initials = userName.isNotEmpty ? userName[0].toUpperCase() : 'U';
    final roleType = user?.customRole?.roleType;
    final roleName = user?.customRole?.name;
    final isPlatformAdmin = roleType == 'PLATFORM_ADMIN';

    return PopupMenuButton<String>(
      offset: const Offset(0, 52),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppColors.radiusMd),
      ),
      elevation: 8,
      shadowColor: AppColors.foreground.withValues(alpha: 0.15),
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppColors.spaceSm,
          vertical: AppColors.spaceXs,
        ),
        decoration: BoxDecoration(
          color: AppColors.surfaceVariant,
          borderRadius: BorderRadius.circular(AppColors.radiusFull),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                gradient: AppColors.primaryGradient,
                borderRadius: BorderRadius.circular(AppColors.radiusFull),
              ),
              child: Center(
                child: Text(
                  initials,
                  style: AppTypography.labelSmall.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
            const SizedBox(width: AppColors.spaceSm),
            Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _truncateName(userName),
                  style: AppTypography.labelSmall.copyWith(
                    fontWeight: FontWeight.w600,
                    color: AppColors.foreground,
                  ),
                ),
                if (roleName != null)
                  Text(
                    roleName,
                    style: AppTypography.caption.copyWith(
                      color: _getRoleColor(roleType ?? ''),
                      fontWeight: FontWeight.w500,
                      fontSize: 10,
                    ),
                  ),
              ],
            ),
            const SizedBox(width: AppColors.spaceXs),
            Icon(
              Icons.keyboard_arrow_down_rounded,
              size: 20,
              color: AppColors.mutedForeground,
            ),
          ],
        ),
      ),
      itemBuilder: (context) => [
        // User info header
        PopupMenuItem<String>(
          enabled: false,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      gradient: AppColors.primaryGradient,
                      borderRadius: BorderRadius.circular(AppColors.radiusFull),
                    ),
                    child: Center(
                      child: Text(
                        initials,
                        style: AppTypography.labelMedium.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: AppColors.spaceMd),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          userName,
                          style: AppTypography.labelMedium.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        if (user?.email != null)
                          Text(
                            user!.email!,
                            style: AppTypography.caption.copyWith(
                              color: AppColors.mutedForeground,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                      ],
                    ),
                  ),
                ],
              ),
              if (roleName != null) ...[
                const SizedBox(height: AppColors.spaceSm),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: _getRoleBgColor(roleType ?? ''),
                    borderRadius: BorderRadius.circular(AppColors.radiusFull),
                  ),
                  child: Text(
                    roleName,
                    style: AppTypography.caption.copyWith(
                      fontWeight: FontWeight.w600,
                      color: _getRoleColor(roleType ?? ''),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
        const PopupMenuDivider(),

        // Tenant selector for PLATFORM_ADMIN
        if (isPlatformAdmin) ...[
          PopupMenuItem<String>(
            value: 'switch_tenant',
            child: Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: AppColors.secondary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(AppColors.radiusSm),
                  ),
                  child: Icon(
                    Icons.business_rounded,
                    size: 18,
                    color: AppColors.secondary,
                  ),
                ),
                const SizedBox(width: AppColors.spaceMd),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Trocar Tenant',
                        style: AppTypography.labelMedium.copyWith(
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      if (tenantState.selectedTenantName != null)
                        Text(
                          tenantState.selectedTenantName!,
                          style: AppTypography.caption.copyWith(
                            color: AppColors.secondary,
                          ),
                        ),
                    ],
                  ),
                ),
                Icon(
                  Icons.chevron_right,
                  size: 20,
                  color: AppColors.mutedForeground,
                ),
              ],
            ),
          ),
          const PopupMenuDivider(),
        ],

        // Logout
        PopupMenuItem<String>(
          value: 'logout',
          child: Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: AppColors.error.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(AppColors.radiusSm),
                ),
                child: Icon(
                  Icons.logout_rounded,
                  size: 18,
                  color: AppColors.error,
                ),
              ),
              const SizedBox(width: AppColors.spaceMd),
              Text(
                'Sair da conta',
                style: AppTypography.labelMedium.copyWith(
                  color: AppColors.error,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ],
      onSelected: (value) async {
        if (value == 'logout') {
          await ref.read(authProvider.notifier).logout();
          if (context.mounted) {
            context.go('/login');
          }
        } else if (value == 'switch_tenant') {
          if (context.mounted) {
            _showTenantSelector(context);
          }
        }
      },
    );
  }

  void _showTenantSelector(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _TenantSelectorSheet(ref: ref),
    );
  }

  String _truncateName(String name) {
    if (name.length <= 12) return name;
    return '${name.substring(0, 10)}...';
  }

  Color _getRoleColor(String roleType) {
    switch (roleType) {
      case 'PLATFORM_ADMIN':
        return AppColors.secondary;
      case 'ADMIN':
        return AppColors.error;
      case 'MANAGER':
        return AppColors.info;
      case 'USER':
        return AppColors.success;
      case 'VIEWER':
        return AppColors.mutedForeground;
      default:
        return AppColors.primary;
    }
  }

  Color _getRoleBgColor(String roleType) {
    switch (roleType) {
      case 'PLATFORM_ADMIN':
        return AppColors.secondary.withValues(alpha: 0.1);
      case 'ADMIN':
        return AppColors.error.withValues(alpha: 0.1);
      case 'MANAGER':
        return AppColors.info.withValues(alpha: 0.1);
      case 'USER':
        return AppColors.success.withValues(alpha: 0.1);
      case 'VIEWER':
        return AppColors.muted;
      default:
        return AppColors.primary.withValues(alpha: 0.1);
    }
  }
}

/// Tenant selector bottom sheet
class _TenantSelectorSheet extends ConsumerStatefulWidget {
  const _TenantSelectorSheet({required this.ref});

  final WidgetRef ref;

  @override
  ConsumerState<_TenantSelectorSheet> createState() => _TenantSelectorSheetState();
}

class _TenantSelectorSheetState extends ConsumerState<_TenantSelectorSheet> {
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    // Load tenants when sheet opens
    Future.microtask(() {
      ref.read(tenantSwitchProvider.notifier).loadTenants();
    });
  }

  @override
  Widget build(BuildContext context) {
    final tenantState = ref.watch(tenantSwitchProvider);
    final filteredTenants = tenantState.tenants.where((t) {
      if (_searchQuery.isEmpty) return true;
      final query = _searchQuery.toLowerCase();
      return t.name.toLowerCase().contains(query) ||
          t.slug.toLowerCase().contains(query);
    }).toList();

    return Container(
      height: MediaQuery.of(context).size.height * 0.7,
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(AppColors.radiusXl),
        ),
      ),
      child: Column(
        children: [
          // Handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 12),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.all(AppColors.spaceMd),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [AppColors.secondary, AppColors.primary],
                        ),
                        borderRadius: BorderRadius.circular(AppColors.radiusMd),
                      ),
                      child: const Icon(
                        Icons.business_rounded,
                        color: Colors.white,
                        size: 22,
                      ),
                    ),
                    const SizedBox(width: AppColors.spaceMd),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Selecionar Tenant',
                          style: AppTypography.h4.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Text(
                          '${tenantState.tenants.length} tenants disponiveis',
                          style: AppTypography.caption.copyWith(
                            color: AppColors.mutedForeground,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: AppColors.spaceMd),

                // Search
                TextField(
                  decoration: InputDecoration(
                    hintText: 'Buscar tenant...',
                    hintStyle: AppTypography.bodyMedium.copyWith(
                      color: AppColors.mutedForeground,
                    ),
                    prefixIcon: Icon(
                      Icons.search,
                      color: AppColors.mutedForeground,
                    ),
                    filled: true,
                    fillColor: AppColors.surfaceVariant,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppColors.radiusFull),
                      borderSide: BorderSide.none,
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: AppColors.spaceMd,
                      vertical: AppColors.spaceSm,
                    ),
                  ),
                  onChanged: (value) => setState(() => _searchQuery = value),
                ),
              ],
            ),
          ),

          // Clear selection button
          if (tenantState.selectedTenantId != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppColors.spaceMd),
              child: GestureDetector(
                onTap: () async {
                  await ref.read(tenantSwitchProvider.notifier).clearSelection();
                  if (context.mounted) {
                    Navigator.pop(context);
                  }
                },
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(AppColors.spaceMd),
                  decoration: BoxDecoration(
                    color: AppColors.warning.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(AppColors.radiusMd),
                    border: Border.all(
                      color: AppColors.warning.withValues(alpha: 0.3),
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.undo_rounded,
                        size: 18,
                        color: AppColors.warning,
                      ),
                      const SizedBox(width: AppColors.spaceSm),
                      Text(
                        'Voltar ao meu tenant',
                        style: AppTypography.labelMedium.copyWith(
                          color: AppColors.warning,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

          const SizedBox(height: AppColors.spaceSm),

          // Loading or list
          Expanded(
            child: tenantState.isLoading
                ? const Center(child: CircularProgressIndicator())
                : tenantState.isSwitching
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const CircularProgressIndicator(),
                            const SizedBox(height: AppColors.spaceMd),
                            Text(
                              'Trocando tenant...',
                              style: AppTypography.bodyMedium.copyWith(
                                color: AppColors.mutedForeground,
                              ),
                            ),
                          ],
                        ),
                      )
                    : filteredTenants.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  Icons.search_off,
                                  size: 48,
                                  color: AppColors.mutedForeground,
                                ),
                                const SizedBox(height: AppColors.spaceMd),
                                Text(
                                  'Nenhum tenant encontrado',
                                  style: AppTypography.bodyMedium.copyWith(
                                    color: AppColors.mutedForeground,
                                  ),
                                ),
                              ],
                            ),
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.symmetric(
                              horizontal: AppColors.spaceMd,
                            ),
                            itemCount: filteredTenants.length,
                            itemBuilder: (context, index) {
                              final tenant = filteredTenants[index];
                              final isSelected =
                                  tenant.id == tenantState.selectedTenantId;

                              return _TenantCard(
                                tenant: tenant,
                                isSelected: isSelected,
                                onTap: () async {
                                  await ref
                                      .read(tenantSwitchProvider.notifier)
                                      .switchTenant(tenant.id, tenant.name);
                                  if (context.mounted) {
                                    Navigator.pop(context);
                                  }
                                },
                              );
                            },
                          ),
          ),
        ],
      ),
    );
  }
}

/// Tenant card in the selector
class _TenantCard extends StatelessWidget {
  const _TenantCard({
    required this.tenant,
    required this.isSelected,
    required this.onTap,
  });

  final TenantInfo tenant;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppColors.spaceSm),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(AppColors.spaceMd),
          decoration: BoxDecoration(
            color: isSelected
                ? AppColors.primary.withValues(alpha: 0.05)
                : AppColors.surface,
            borderRadius: BorderRadius.circular(AppColors.radiusMd),
            border: Border.all(
              color: isSelected ? AppColors.primary : AppColors.border,
              width: isSelected ? 2 : 1,
            ),
          ),
          child: Row(
            children: [
              // Logo/Avatar
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(AppColors.radiusSm),
                ),
                child: Center(
                  child: Text(
                    tenant.name.isNotEmpty ? tenant.name[0].toUpperCase() : 'T',
                    style: AppTypography.labelLarge.copyWith(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: AppColors.spaceMd),

              // Info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      tenant.name,
                      style: AppTypography.labelMedium.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.surfaceVariant,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            tenant.slug,
                            style: AppTypography.caption.copyWith(
                              color: AppColors.mutedForeground,
                              fontFamily: 'monospace',
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Icon(
                          Icons.people_outline,
                          size: 12,
                          color: AppColors.mutedForeground,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          '${tenant.userCount}',
                          style: AppTypography.caption.copyWith(
                            color: AppColors.mutedForeground,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              // Status / Selected
              if (isSelected)
                Container(
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(AppColors.radiusFull),
                  ),
                  child: const Icon(
                    Icons.check,
                    size: 16,
                    color: Colors.white,
                  ),
                )
              else
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: tenant.status == 'ACTIVE'
                        ? AppColors.success.withValues(alpha: 0.1)
                        : AppColors.muted,
                    borderRadius: BorderRadius.circular(AppColors.radiusFull),
                  ),
                  child: Text(
                    tenant.status == 'ACTIVE' ? 'Ativo' : tenant.status,
                    style: AppTypography.caption.copyWith(
                      color: tenant.status == 'ACTIVE'
                          ? AppColors.success
                          : AppColors.mutedForeground,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Navigation item configuration
class _NavItem {
  const _NavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.path,
  });

  final IconData icon;
  final IconData activeIcon;
  final String label;
  final String path;
}
