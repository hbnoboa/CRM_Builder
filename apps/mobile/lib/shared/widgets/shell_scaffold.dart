import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:crm_mobile/core/database/app_database.dart';
import 'package:crm_mobile/features/tenants/widgets/tenant_banner.dart';
import 'package:crm_mobile/shared/widgets/offline_banner.dart';

/// Main shell scaffold with bottom navigation bar.
/// Mirrors web-admin's dashboard layout sidebar as bottom nav.
class ShellScaffold extends StatelessWidget {
  const ShellScaffold({super.key, required this.child});

  final Widget child;

  static const _tabs = [
    _Tab(icon: Icons.dashboard_outlined, activeIcon: Icons.dashboard, label: 'Home', path: '/dashboard'),
    _Tab(icon: Icons.list_alt_outlined, activeIcon: Icons.list_alt, label: 'Dados', path: '/entities'),
    _Tab(icon: Icons.notifications_outlined, activeIcon: Icons.notifications, label: 'Avisos', path: '/notifications'),
    _Tab(icon: Icons.person_outline, activeIcon: Icons.person, label: 'Perfil', path: '/profile'),
  ];

  int _currentIndex(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    for (var i = 0; i < _tabs.length; i++) {
      if (location.startsWith(_tabs[i].path)) return i;
    }
    // Data routes → highlight "Dados" tab
    if (location.startsWith('/data')) return 1;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final index = _currentIndex(context);

    return Scaffold(
      body: Column(
        children: [
          const TenantBanner(),
          const OfflineBanner(),
          Expanded(child: child),
        ],
      ),
      bottomNavigationBar: StreamBuilder<List<Map<String, dynamic>>>(
        stream: AppDatabase.instance.db.watch(
          'SELECT COUNT(*) as count FROM Notification WHERE read = 0',
        ),
        builder: (context, snapshot) {
          final unreadCount = snapshot.data?.firstOrNull?['count'] as int? ?? 0;

          return BottomNavigationBar(
            currentIndex: index,
            onTap: (i) => context.go(_tabs[i].path),
            items: _tabs.asMap().entries.map((entry) {
              final i = entry.key;
              final t = entry.value;

              // Notifications tab (index 2) gets a badge
              if (i == 2 && unreadCount > 0) {
                return BottomNavigationBarItem(
                  icon: Badge(
                    label: Text(
                      unreadCount > 99 ? '99+' : '$unreadCount',
                      style: const TextStyle(fontSize: 10),
                    ),
                    child: Icon(t.icon),
                  ),
                  activeIcon: Badge(
                    label: Text(
                      unreadCount > 99 ? '99+' : '$unreadCount',
                      style: const TextStyle(fontSize: 10),
                    ),
                    child: Icon(t.activeIcon),
                  ),
                  label: t.label,
                );
              }

              return BottomNavigationBarItem(
                icon: Icon(t.icon),
                activeIcon: Icon(t.activeIcon),
                label: t.label,
              );
            }).toList(),
          );
        },
      ),
    );
  }
}

class _Tab {
  const _Tab({
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
