import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:crm_mobile/shared/widgets/offline_banner.dart';
import 'package:crm_mobile/shared/widgets/sync_status_indicator.dart';

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
          const OfflineBanner(),
          Expanded(child: child),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: index,
        onTap: (i) => context.go(_tabs[i].path),
        items: _tabs
            .map(
              (t) => BottomNavigationBarItem(
                icon: Icon(t.icon),
                activeIcon: Icon(t.activeIcon),
                label: t.label,
              ),
            )
            .toList(),
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
