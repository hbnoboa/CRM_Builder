import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:crm_mobile/core/auth/auth_provider.dart';
import 'package:crm_mobile/core/database/app_database.dart';
import 'package:crm_mobile/core/permissions/permission_provider.dart';
import 'package:crm_mobile/core/tenant/tenant_provider.dart';
import 'package:crm_mobile/core/theme/app_colors_extension.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:crm_mobile/core/theme/theme_provider.dart';

/// Drawer compartilhado com menu e logout.
class AppDrawer extends ConsumerWidget {
  const AppDrawer({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final colors = context.colors;
    final authState = ref.watch(authProvider);
    final user = authState.user;
    final permissions = ref.watch(permissionsProvider);
    final currentPath = GoRouterState.of(context).uri.path;
    final tenantState = ref.watch(tenantSwitchProvider);
    final isPlatformAdmin = user?.customRole?.roleType == 'PLATFORM_ADMIN';

    final currentTenantName = tenantState.selectedTenantName ??
        (user != null ? _getUserTenantName(user) : null);

    return Drawer(
      child: SafeArea(
        child: Column(
          children: [
            // Header with primary color
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: theme.colorScheme.primary,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Avatar
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      color: theme.colorScheme.onPrimary.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(28),
                    ),
                    child: Center(
                      child: Text(
                        (user?.name.isNotEmpty == true)
                            ? user!.name[0].toUpperCase()
                            : 'U',
                        style: AppTypography.h3.copyWith(
                          color: theme.colorScheme.onPrimary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    user?.name ?? 'Usuario',
                    style: AppTypography.labelLarge.copyWith(
                      color: theme.colorScheme.onPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    user?.email ?? '',
                    style: AppTypography.bodySmall.copyWith(
                      color: theme.colorScheme.onPrimary.withValues(alpha: 0.8),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (user?.customRole != null) ...[
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: theme.colorScheme.onPrimary.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        user!.customRole!.name,
                        style: AppTypography.caption.copyWith(
                          color: theme.colorScheme.onPrimary,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),

            // Tenant selector (PLATFORM_ADMIN only)
            if (isPlatformAdmin)
              ListTile(
                dense: true,
                leading: Icon(Icons.swap_horiz, size: 20, color: colors.mutedForeground),
                title: Text(
                  currentTenantName ?? 'Meu tenant',
                  style: AppTypography.bodySmall.copyWith(
                    fontWeight: FontWeight.w500,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                trailing: tenantState.isSwitching
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Icon(Icons.unfold_more, size: 18, color: colors.mutedForeground),
                onTap: () => _showTenantSelector(context, ref),
              ),

            // Menu items
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 8),
                children: [
                  if (permissions.hasModuleAccess('dashboard'))
                    _MenuItem(
                      icon: Icons.dashboard_outlined,
                      label: 'Dashboard',
                      selected: currentPath == '/dashboard',
                      onTap: () {
                        Navigator.pop(context);
                        context.go('/dashboard');
                      },
                    ),
                  if (permissions.hasModuleAccess('data'))
                    _MenuItem(
                      icon: Icons.folder_outlined,
                      label: 'Dados',
                      selected: currentPath.startsWith('/data'),
                      onTap: () {
                        Navigator.pop(context);
                        context.go('/data');
                      },
                    ),
                  const Divider(),
                  _MenuItem(
                    icon: Icons.sync,
                    label: 'Sincronizacao',
                    onTap: () {
                      Navigator.pop(context);
                      _showSyncDialog(context);
                    },
                  ),
                  _ThemeToggleItem(),
                ],
              ),
            ),

            // Logout button
            const Divider(height: 1),
            _MenuItem(
              icon: Icons.logout,
              label: 'Sair',
              isDestructive: true,
              onTap: () => _confirmLogout(context, ref),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  String? _getUserTenantName(User user) => null;

  Future<void> _showTenantSelector(BuildContext context, WidgetRef ref) async {
    final tenantNotifier = ref.read(tenantSwitchProvider.notifier);
    final tenantState = ref.read(tenantSwitchProvider);

    if (tenantState.tenants.isEmpty && !tenantState.isLoading) {
      tenantNotifier.loadTenants();
    }

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _TenantSelectorSheet(parentRef: ref),
    );
  }

  Future<void> _confirmLogout(BuildContext context, WidgetRef ref) async {
    final authNotifier = ref.read(authProvider.notifier);
    final colors = context.colors;

    Navigator.pop(context);
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sair'),
        content: const Text('Deseja realmente sair da sua conta?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: colors.destructive),
            child: const Text('Sair'),
          ),
        ],
      ),
    );
    if (confirm == true) {
      await authNotifier.logout();
    }
  }

  void _showSyncDialog(BuildContext context) {
    final theme = Theme.of(context);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Row(
          children: [
            Icon(Icons.sync, color: theme.colorScheme.primary),
            const SizedBox(width: 8),
            const Text('Sincronizacao'),
          ],
        ),
        content: StreamBuilder<List<Map<String, dynamic>>>(
          stream: AppDatabase.instance.db.watch(
            'SELECT '
            '(SELECT COUNT(*) FROM Entity) as entityCount, '
            '(SELECT COUNT(*) FROM EntityData WHERE deletedAt IS NULL) as dataCount, '
            '(SELECT COUNT(*) FROM CustomRole) as roleCount, '
            '(SELECT COUNT(*) FROM User) as userCount',
          ),
          builder: (context, snapshot) {
            final row = snapshot.data?.firstOrNull;
            return Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _SyncRow(name: 'Entity', count: row?['entityCount'] ?? 0),
                _SyncRow(name: 'EntityData', count: row?['dataCount'] ?? 0),
                _SyncRow(name: 'CustomRole', count: row?['roleCount'] ?? 0),
                _SyncRow(name: 'User', count: row?['userCount'] ?? 0),
              ],
            );
          },
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Fechar'),
          ),
        ],
      ),
    );
  }
}

class _MenuItem extends StatelessWidget {
  const _MenuItem({
    required this.icon,
    required this.label,
    required this.onTap,
    this.selected = false,
    this.isDestructive = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool selected;
  final bool isDestructive;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = context.colors;

    final Color iconColor;
    final Color textColor;

    if (isDestructive) {
      iconColor = colors.destructive;
      textColor = colors.destructive;
    } else if (selected) {
      iconColor = theme.colorScheme.primary;
      textColor = theme.colorScheme.primary;
    } else {
      iconColor = colors.mutedForeground;
      textColor = theme.colorScheme.onSurface;
    }

    return ListTile(
      leading: Icon(icon, color: iconColor),
      title: Text(
        label,
        style: TextStyle(
          color: textColor,
          fontWeight: selected ? FontWeight.w600 : null,
        ),
      ),
      selected: selected,
      onTap: onTap,
    );
  }
}

class _SyncRow extends StatelessWidget {
  const _SyncRow({required this.name, required this.count});

  final String name;
  final int count;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(name, style: AppTypography.bodyMedium),
          Text(
            '$count',
            style: AppTypography.bodyMedium.copyWith(color: colors.mutedForeground),
          ),
        ],
      ),
    );
  }
}

/// Bottom sheet for selecting a tenant (PLATFORM_ADMIN only).
class _TenantSelectorSheet extends ConsumerStatefulWidget {
  const _TenantSelectorSheet({required this.parentRef});

  final WidgetRef parentRef;

  @override
  ConsumerState<_TenantSelectorSheet> createState() => _TenantSelectorSheetState();
}

class _TenantSelectorSheetState extends ConsumerState<_TenantSelectorSheet> {
  String _search = '';

  @override
  void initState() {
    super.initState();
    final state = ref.read(tenantSwitchProvider);
    if (state.tenants.isEmpty && !state.isLoading) {
      ref.read(tenantSwitchProvider.notifier).loadTenants();
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = context.colors;
    final tenantState = ref.watch(tenantSwitchProvider);
    final filteredTenants = tenantState.tenants.where((t) {
      if (_search.isEmpty) return true;
      final searchLower = _search.toLowerCase();
      return t.name.toLowerCase().contains(searchLower) ||
          t.slug.toLowerCase().contains(searchLower);
    }).toList();

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.7,
      ),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 12),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: colors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Icon(Icons.business, color: theme.colorScheme.primary),
                const SizedBox(width: 12),
                const Text('Selecionar Tenant', style: AppTypography.h4),
                const Spacer(),
                if (tenantState.selectedTenantId != null)
                  TextButton(
                    onPressed: () async {
                      await ref.read(tenantSwitchProvider.notifier).clearSelection();
                      if (context.mounted) Navigator.pop(context);
                    },
                    child: const Text('Limpar'),
                  ),
              ],
            ),
          ),

          // Search
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Buscar tenant...',
                prefixIcon: const Icon(Icons.search),
                filled: true,
                fillColor: colors.muted,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
              onChanged: (v) => setState(() => _search = v),
            ),
          ),

          const SizedBox(height: 8),

          // List
          Flexible(
            child: tenantState.isLoading
                ? const Center(
                    child: Padding(
                      padding: EdgeInsets.all(32),
                      child: CircularProgressIndicator(),
                    ),
                  )
                : tenantState.error != null
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(32),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.error_outline, color: colors.destructive, size: 48),
                              const SizedBox(height: 16),
                              Text(
                                tenantState.error!,
                                style: AppTypography.bodyMedium,
                                textAlign: TextAlign.center,
                              ),
                              const SizedBox(height: 16),
                              ElevatedButton(
                                onPressed: () {
                                  ref.read(tenantSwitchProvider.notifier).loadTenants();
                                },
                                child: const Text('Tentar novamente'),
                              ),
                            ],
                          ),
                        ),
                      )
                    : filteredTenants.isEmpty
                        ? Center(
                            child: Padding(
                              padding: const EdgeInsets.all(32),
                              child: Text(
                                _search.isEmpty
                                    ? 'Nenhum tenant disponivel'
                                    : 'Nenhum tenant encontrado',
                                style: AppTypography.bodyMedium.copyWith(
                                  color: colors.mutedForeground,
                                ),
                              ),
                            ),
                          )
                        : ListView.builder(
                            shrinkWrap: true,
                            padding: const EdgeInsets.only(bottom: 16),
                            itemCount: filteredTenants.length,
                            itemBuilder: (ctx, index) {
                              final tenant = filteredTenants[index];
                              final isSelected = tenant.id == tenantState.selectedTenantId;

                              return ListTile(
                                leading: Container(
                                  width: 40,
                                  height: 40,
                                  decoration: BoxDecoration(
                                    color: isSelected
                                        ? theme.colorScheme.primary.withValues(alpha: 0.1)
                                        : colors.muted,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Center(
                                    child: Text(
                                      tenant.name.isNotEmpty
                                          ? tenant.name[0].toUpperCase()
                                          : 'T',
                                      style: AppTypography.labelLarge.copyWith(
                                        color: isSelected
                                            ? theme.colorScheme.primary
                                            : colors.mutedForeground,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                ),
                                title: Text(
                                  tenant.name,
                                  style: TextStyle(
                                    fontWeight: isSelected ? FontWeight.w600 : null,
                                    color: isSelected ? theme.colorScheme.primary : null,
                                  ),
                                ),
                                subtitle: Text(
                                  tenant.slug,
                                  style: AppTypography.caption.copyWith(
                                    color: colors.mutedForeground,
                                  ),
                                ),
                                trailing: isSelected
                                    ? Icon(Icons.check_circle, color: theme.colorScheme.primary)
                                    : tenantState.isSwitching
                                        ? const SizedBox(
                                            width: 20,
                                            height: 20,
                                            child: CircularProgressIndicator(strokeWidth: 2),
                                          )
                                        : null,
                                onTap: tenantState.isSwitching
                                    ? null
                                    : () async {
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

/// Theme toggle item for light/dark/system mode.
class _ThemeToggleItem extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final colors = context.colors;
    final themeMode = ref.watch(themeModeNotifierProvider);

    final IconData icon;
    final String label;

    switch (themeMode) {
      case ThemeMode.light:
        icon = Icons.light_mode;
        label = 'Tema Claro';
      case ThemeMode.dark:
        icon = Icons.dark_mode;
        label = 'Tema Escuro';
      case ThemeMode.system:
        icon = Icons.brightness_auto;
        label = 'Tema do Sistema';
    }

    return ListTile(
      leading: Icon(icon, color: colors.mutedForeground),
      title: Text(label),
      trailing: PopupMenuButton<ThemeMode>(
        icon: Icon(Icons.arrow_drop_down, color: colors.mutedForeground),
        onSelected: (mode) {
          ref.read(themeModeNotifierProvider.notifier).setThemeMode(mode);
        },
        itemBuilder: (context) => [
          PopupMenuItem(
            value: ThemeMode.light,
            child: Row(
              children: [
                Icon(
                  Icons.light_mode,
                  color: themeMode == ThemeMode.light
                      ? theme.colorScheme.primary
                      : colors.mutedForeground,
                  size: 20,
                ),
                const SizedBox(width: 12),
                Text(
                  'Claro',
                  style: TextStyle(
                    color: themeMode == ThemeMode.light
                        ? theme.colorScheme.primary
                        : null,
                    fontWeight: themeMode == ThemeMode.light
                        ? FontWeight.w600
                        : null,
                  ),
                ),
              ],
            ),
          ),
          PopupMenuItem(
            value: ThemeMode.dark,
            child: Row(
              children: [
                Icon(
                  Icons.dark_mode,
                  color: themeMode == ThemeMode.dark
                      ? theme.colorScheme.primary
                      : colors.mutedForeground,
                  size: 20,
                ),
                const SizedBox(width: 12),
                Text(
                  'Escuro',
                  style: TextStyle(
                    color: themeMode == ThemeMode.dark
                        ? theme.colorScheme.primary
                        : null,
                    fontWeight: themeMode == ThemeMode.dark
                        ? FontWeight.w600
                        : null,
                  ),
                ),
              ],
            ),
          ),
          PopupMenuItem(
            value: ThemeMode.system,
            child: Row(
              children: [
                Icon(
                  Icons.brightness_auto,
                  color: themeMode == ThemeMode.system
                      ? theme.colorScheme.primary
                      : colors.mutedForeground,
                  size: 20,
                ),
                const SizedBox(width: 12),
                Text(
                  'Sistema',
                  style: TextStyle(
                    color: themeMode == ThemeMode.system
                        ? theme.colorScheme.primary
                        : null,
                    fontWeight: themeMode == ThemeMode.system
                        ? FontWeight.w600
                        : null,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      onTap: () {
        ref.read(themeModeNotifierProvider.notifier).toggleTheme();
      },
    );
  }
}
