import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:crm_mobile/core/auth/auth_provider.dart';
import 'package:crm_mobile/features/auth/pages/login_page.dart';
import 'package:crm_mobile/features/auth/pages/register_page.dart';
import 'package:crm_mobile/features/auth/pages/forgot_password_page.dart';
import 'package:crm_mobile/features/dashboard/pages/dashboard_page.dart';
import 'package:crm_mobile/features/entities/pages/entities_list_page.dart';
import 'package:crm_mobile/features/data/pages/data_list_page.dart';
import 'package:crm_mobile/features/data/pages/data_detail_page.dart';
import 'package:crm_mobile/features/data/pages/data_form_page.dart';
import 'package:crm_mobile/features/notifications/pages/notifications_page.dart';
import 'package:crm_mobile/features/profile/pages/profile_page.dart';
import 'package:crm_mobile/features/settings/pages/settings_page.dart';
import 'package:crm_mobile/shared/widgets/shell_scaffold.dart';

part 'router.g.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>();
final _shellNavigatorKey = GlobalKey<NavigatorState>();

@riverpod
GoRouter router(Ref ref) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: '/dashboard',
    debugLogDiagnostics: true,
    redirect: (context, state) {
      final isAuthenticated = authState.isAuthenticated;
      final isLoading = authState.isLoading;
      final isAuthRoute = state.matchedLocation.startsWith('/login') ||
          state.matchedLocation.startsWith('/register') ||
          state.matchedLocation.startsWith('/forgot-password');

      // Still loading auth state
      if (isLoading) return null;

      // Not authenticated → go to login
      if (!isAuthenticated && !isAuthRoute) return '/login';

      // Authenticated but on auth route → go to dashboard
      if (isAuthenticated && isAuthRoute) return '/dashboard';

      return null;
    },
    routes: [
      // Auth routes (no bottom nav)
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginPage(),
      ),
      GoRoute(
        path: '/register',
        builder: (context, state) => const RegisterPage(),
      ),
      GoRoute(
        path: '/forgot-password',
        builder: (context, state) => const ForgotPasswordPage(),
      ),

      // Main app shell with bottom navigation
      ShellRoute(
        navigatorKey: _shellNavigatorKey,
        builder: (context, state, child) => ShellScaffold(child: child),
        routes: [
          GoRoute(
            path: '/dashboard',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: DashboardPage(),
            ),
          ),
          GoRoute(
            path: '/entities',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: EntitiesListPage(),
            ),
          ),
          GoRoute(
            path: '/data/:entitySlug',
            builder: (context, state) => DataListPage(
              entitySlug: state.pathParameters['entitySlug']!,
            ),
          ),
          GoRoute(
            path: '/notifications',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: NotificationsPage(),
            ),
          ),
          GoRoute(
            path: '/profile',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: ProfilePage(),
            ),
          ),
          GoRoute(
            path: '/settings',
            builder: (context, state) => const SettingsPage(),
          ),
        ],
      ),

      // Full-screen routes (outside shell, no bottom nav)
      GoRoute(
        path: '/data/:entitySlug/new',
        builder: (context, state) => DataFormPage(
          entitySlug: state.pathParameters['entitySlug']!,
          parentRecordId: state.uri.queryParameters['parentRecordId'],
        ),
      ),
      GoRoute(
        path: '/data/:entitySlug/:recordId',
        builder: (context, state) => DataDetailPage(
          entitySlug: state.pathParameters['entitySlug']!,
          recordId: state.pathParameters['recordId']!,
        ),
      ),
      GoRoute(
        path: '/data/:entitySlug/:recordId/edit',
        builder: (context, state) => DataFormPage(
          entitySlug: state.pathParameters['entitySlug']!,
          recordId: state.pathParameters['recordId'],
        ),
      ),
    ],
  );
}
