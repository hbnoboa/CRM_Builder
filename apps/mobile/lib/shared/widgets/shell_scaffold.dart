import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:crm_mobile/core/auth/auth_provider.dart';
import 'package:crm_mobile/core/database/app_database.dart';
import 'package:crm_mobile/core/permissions/permission_provider.dart';
import 'package:crm_mobile/core/theme/app_colors.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:crm_mobile/features/tenants/widgets/tenant_banner.dart';
import 'package:crm_mobile/shared/widgets/offline_banner.dart';
import 'package:crm_mobile/shared/widgets/sync_status_indicator.dart';

/// Main shell scaffold with drawer navigation (like web-admin).
class ShellScaffold extends ConsumerStatefulWidget {
  const ShellScaffold({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<ShellScaffold> createState() => _ShellScaffoldState();
}

class _ShellScaffoldState extends ConsumerState<ShellScaffold> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  static const _navItems = [
    _NavItem(
      icon: Icons.dashboard_outlined,
      activeIcon: Icons.dashboard,
      label: 'Dashboard',
      path: '/dashboard',
    ),
    _NavItem(
      icon: Icons.folder_outlined,
      activeIcon: Icons.folder,
      label: 'Dados',
      path: '/entities',
    ),
    _NavItem(
      icon: Icons.notifications_outlined,
      activeIcon: Icons.notifications,
      label: 'Notificacoes',
      path: '/notifications',
    ),
    _NavItem(
      icon: Icons.settings_outlined,
      activeIcon: Icons.settings,
      label: 'Configuracoes',
      path: '/settings',
    ),
  ];

  String _currentPath(BuildContext context) {
    return GoRouterState.of(context).matchedLocation;
  }

  bool _isActive(String currentPath, String itemPath) {
    if (currentPath == itemPath) return true;
    if (itemPath == '/entities' && currentPath.startsWith('/data')) return true;
    return currentPath.startsWith(itemPath) && itemPath != '/dashboard';
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final user = authState.user;
    final permissions = ref.watch(permissionsProvider);
    final currentPath = _currentPath(context);

    return Scaffold(
      key: _scaffoldKey,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.menu),
          onPressed: () => _scaffoldKey.currentState?.openDrawer(),
        ),
        title: _buildTitle(currentPath),
        actions: [
          if (permissions.isPlatformAdmin)
            IconButton(
              icon: const Icon(Icons.swap_horiz),
              tooltip: 'Trocar tenant',
              onPressed: () => context.push('/tenants'),
            ),
          const SyncStatusIndicator(),
          const SizedBox(width: 8),
        ],
      ),
      drawer: Drawer(
        child: SafeArea(
          child: Column(
            children: [
              // Header with tenant/logo
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  border: Border(
                    bottom: BorderSide(color: AppColors.border),
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [AppColors.primary, AppColors.primary.withValues(alpha: 0.7)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Center(
                        child: Text(
                          'C',
                          style: TextStyle(
                            color: AppColors.primaryForeground,
                            fontWeight: FontWeight.bold,
                            fontSize: 18,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'CRM Builder',
                        style: AppTypography.h4,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
              ),

              // Navigation items
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
                  children: [
                    for (final item in _navItems)
                      _buildNavItem(context, item, currentPath),
                  ],
                ),
              ),

              // User profile at bottom
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.muted.withValues(alpha: 0.3),
                  border: Border(
                    top: BorderSide(color: AppColors.border),
                  ),
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 20,
                      backgroundColor: AppColors.primary,
                      child: Text(
                        user?.name.isNotEmpty == true
                            ? user!.name[0].toUpperCase()
                            : 'U',
                        style: TextStyle(
                          color: AppColors.primaryForeground,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            user?.name ?? 'Usuario',
                            style: AppTypography.labelMedium,
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (user?.customRole != null)
                            Container(
                              margin: const EdgeInsets.only(top: 2),
                              padding: const EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: _getRoleColor(user!.customRole!.roleType),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                user.customRole!.name,
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w500,
                                  color: _getRoleTextColor(user.customRole!.roleType),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: Icon(
                        Icons.logout,
                        color: AppColors.mutedForeground,
                        size: 20,
                      ),
                      onPressed: () async {
                        Navigator.of(context).pop();
                        await ref.read(authProvider.notifier).logout();
                        if (context.mounted) {
                          context.go('/login');
                        }
                      },
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
      body: Column(
        children: [
          const TenantBanner(),
          const OfflineBanner(),
          Expanded(child: widget.child),
        ],
      ),
      // Bottom nav for quick access
      bottomNavigationBar: StreamBuilder<List<Map<String, dynamic>>>(
        stream: AppDatabase.instance.db.watch(
          'SELECT COUNT(*) as count FROM Notification WHERE read = 0',
        ),
        builder: (context, snapshot) {
          final unreadCount =
              snapshot.data?.firstOrNull?['count'] as int? ?? 0;

          return NavigationBar(
            selectedIndex: _getBottomNavIndex(currentPath),
            onDestinationSelected: (i) => context.go(_bottomNavPaths[i]),
            destinations: [
              const NavigationDestination(
                icon: Icon(Icons.dashboard_outlined),
                selectedIcon: Icon(Icons.dashboard),
                label: 'Home',
              ),
              const NavigationDestination(
                icon: Icon(Icons.folder_outlined),
                selectedIcon: Icon(Icons.folder),
                label: 'Dados',
              ),
              NavigationDestination(
                icon: Badge(
                  isLabelVisible: unreadCount > 0,
                  label: Text(
                    unreadCount > 99 ? '99+' : '$unreadCount',
                    style: const TextStyle(fontSize: 10),
                  ),
                  child: const Icon(Icons.notifications_outlined),
                ),
                selectedIcon: Badge(
                  isLabelVisible: unreadCount > 0,
                  label: Text(
                    unreadCount > 99 ? '99+' : '$unreadCount',
                    style: const TextStyle(fontSize: 10),
                  ),
                  child: const Icon(Icons.notifications),
                ),
                label: 'Avisos',
              ),
              const NavigationDestination(
                icon: Icon(Icons.person_outline),
                selectedIcon: Icon(Icons.person),
                label: 'Perfil',
              ),
            ],
          );
        },
      ),
    );
  }

  static const _bottomNavPaths = [
    '/dashboard',
    '/entities',
    '/notifications',
    '/profile',
  ];

  int _getBottomNavIndex(String currentPath) {
    if (currentPath.startsWith('/dashboard')) return 0;
    if (currentPath.startsWith('/entities') ||
        currentPath.startsWith('/data')) return 1;
    if (currentPath.startsWith('/notifications')) return 2;
    if (currentPath.startsWith('/profile') ||
        currentPath.startsWith('/settings')) return 3;
    return 0;
  }

  Widget _buildTitle(String currentPath) {
    String title = 'CRM Builder';
    if (currentPath.startsWith('/dashboard')) {
      title = 'Dashboard';
    } else if (currentPath.startsWith('/entities') ||
        currentPath.startsWith('/data')) {
      title = 'Dados';
    } else if (currentPath.startsWith('/notifications')) {
      title = 'Notificacoes';
    } else if (currentPath.startsWith('/profile')) {
      title = 'Perfil';
    } else if (currentPath.startsWith('/settings')) {
      title = 'Configuracoes';
    }
    return Text(title);
  }

  Widget _buildNavItem(
      BuildContext context, _NavItem item, String currentPath) {
    final isActive = _isActive(currentPath, item.path);
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: ListTile(
        leading: Icon(
          isActive ? item.activeIcon : item.icon,
          color: isActive ? AppColors.primaryForeground : AppColors.mutedForeground,
        ),
        title: Text(
          item.label,
          style: TextStyle(
            fontWeight: isActive ? FontWeight.w600 : FontWeight.w500,
            color: isActive ? AppColors.primaryForeground : AppColors.foreground,
          ),
        ),
        selected: isActive,
        selectedTileColor: AppColors.primary,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
        ),
        onTap: () {
          Navigator.of(context).pop();
          context.go(item.path);
        },
      ),
    );
  }

  Color _getRoleColor(String roleType) {
    switch (roleType) {
      case 'PLATFORM_ADMIN':
        return Colors.purple.shade100;
      case 'ADMIN':
        return Colors.red.shade100;
      case 'MANAGER':
        return Colors.blue.shade100;
      case 'USER':
        return Colors.green.shade100;
      case 'VIEWER':
        return Colors.grey.shade200;
      default:
        return Colors.indigo.shade100;
    }
  }

  Color _getRoleTextColor(String roleType) {
    switch (roleType) {
      case 'PLATFORM_ADMIN':
        return Colors.purple.shade700;
      case 'ADMIN':
        return Colors.red.shade700;
      case 'MANAGER':
        return Colors.blue.shade700;
      case 'USER':
        return Colors.green.shade700;
      case 'VIEWER':
        return Colors.grey.shade700;
      default:
        return Colors.indigo.shade700;
    }
  }
}

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
