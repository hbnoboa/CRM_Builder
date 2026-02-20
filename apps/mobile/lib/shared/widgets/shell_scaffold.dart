import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:crm_mobile/core/permissions/permission_provider.dart';
import 'package:crm_mobile/core/theme/app_colors_extension.dart';
import 'package:crm_mobile/shared/widgets/offline_banner.dart';

/// Main shell scaffold with bottom navigation.
/// Shows only Dashboard (if permitted) and Data modules.
/// Navigation items are conditional based on user permissions.
class ShellScaffold extends ConsumerWidget {
  const ShellScaffold({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final colors = context.colors;
    final permissions = ref.watch(permissionsProvider);
    final currentPath = GoRouterState.of(context).matchedLocation;

    // Build navigation items based on permissions
    final navItems = <_NavItem>[];

    if (permissions.hasModuleAccess('dashboard')) {
      navItems.add(const _NavItem(
        icon: Icons.dashboard_outlined,
        activeIcon: Icons.dashboard_rounded,
        label: 'Dashboard',
        path: '/dashboard',
      ),);
    }

    if (permissions.hasModuleAccess('data')) {
      navItems.add(const _NavItem(
        icon: Icons.folder_outlined,
        activeIcon: Icons.folder_rounded,
        label: 'Dados',
        path: '/data',
      ),);
    }

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      body: Column(
        children: [
          const OfflineBanner(),
          Expanded(child: child),
        ],
      ),
      bottomNavigationBar: navItems.length > 1
          ? Container(
              decoration: BoxDecoration(
                color: colors.card,
                boxShadow: [
                  BoxShadow(
                    color: theme.shadowColor.withValues(alpha: 0.1),
                    blurRadius: 8,
                    offset: const Offset(0, -2),
                  ),
                ],
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
