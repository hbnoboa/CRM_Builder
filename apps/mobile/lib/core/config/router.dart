import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:crm_mobile/core/auth/auth_provider.dart';
import 'package:crm_mobile/core/permissions/device_permissions_provider.dart';
import 'package:crm_mobile/features/auth/pages/login_page.dart';
import 'package:crm_mobile/features/auth/pages/register_page.dart';
import 'package:crm_mobile/features/auth/pages/forgot_password_page.dart';
import 'package:crm_mobile/features/auth/pages/permissions_onboarding_page.dart';
import 'package:crm_mobile/features/dashboard/pages/dashboard_page.dart';
import 'package:crm_mobile/features/entities/pages/entities_list_page.dart';
import 'package:crm_mobile/features/data/pages/data_list_page.dart';
import 'package:crm_mobile/features/data/pages/data_detail_page.dart';
import 'package:crm_mobile/features/data/pages/data_form_page.dart';
import 'package:crm_mobile/features/notifications/pages/notifications_page.dart';
import 'package:crm_mobile/features/profile/pages/profile_page.dart';
import 'package:crm_mobile/features/settings/pages/settings_page.dart';
import 'package:crm_mobile/features/tenants/pages/tenant_selector_page.dart';
import 'package:crm_mobile/core/push/push_notification_service.dart';
import 'package:crm_mobile/shared/widgets/shell_scaffold.dart';

part 'router.g.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>();
final _shellNavigatorKey = GlobalKey<NavigatorState>();

/// Listenable that notifies GoRouter when auth state changes
class _AuthStateListenable extends ChangeNotifier {
  _AuthStateListenable(this._ref) {
    _ref.listen(authProvider, (prev, next) {
      debugPrint('[Router] Auth state changed: isAuth=${next.isAuthenticated}, isLoading=${next.isLoading}');
      notifyListeners();
    });
    _ref.listen(devicePermissionsProvider, (prev, next) {
      debugPrint('[Router] Device permissions changed: allGranted=${next.allGranted}, onboarding=${next.onboardingCompleted}');
      notifyListeners();
    });
  }
  final Ref _ref;
}

@riverpod
GoRouter router(Ref ref) {
  // Wire navigator key for push notification deep linking
  PushNotificationService.navigatorKey = _rootNavigatorKey;

  // Create a listenable that notifies when auth changes
  final authListenable = _AuthStateListenable(ref);
  ref.onDispose(() => authListenable.dispose());

  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: '/login',
    debugLogDiagnostics: true,
    refreshListenable: authListenable,
    redirect: (context, state) {
      // Read auth state fresh on each redirect
      final authState = ref.read(authProvider);
      final isAuthenticated = authState.isAuthenticated;
      final isLoading = authState.isLoading;
      final isAuthRoute = state.matchedLocation.startsWith('/login') ||
          state.matchedLocation.startsWith('/register') ||
          state.matchedLocation.startsWith('/forgot-password');
      final isOnboardingRoute =
          state.matchedLocation == '/permissions-onboarding';

      debugPrint('[Router] redirect called: location=${state.matchedLocation}, isAuth=$isAuthenticated, isLoading=$isLoading');

      // Still loading auth state - stay on auth routes or redirect to login
      if (isLoading) {
        debugPrint('[Router] Still loading, staying on auth route');
        if (!isAuthRoute) return '/login';
        return null;
      }

      // Not authenticated → go to login (allow auth routes + onboarding)
      if (!isAuthenticated && !isAuthRoute && !isOnboardingRoute) {
        debugPrint('[Router] Not authenticated, redirecting to /login');
        return '/login';
      }

      // Authenticated → check permissions onboarding
      if (isAuthenticated) {
        final devicePerms = ref.read(devicePermissionsProvider);
        final needsOnboarding = !devicePerms.onboardingCompleted;

        // Needs onboarding and not on that page → redirect
        if (needsOnboarding && !isOnboardingRoute && !isAuthRoute) {
          debugPrint('[Router] Needs permissions onboarding, redirecting');
          return '/permissions-onboarding';
        }

        // Completed onboarding but still on that page → go to dashboard
        if (!needsOnboarding && isOnboardingRoute) {
          debugPrint('[Router] Onboarding done, redirecting to /dashboard');
          return '/dashboard';
        }

        // On auth route → go to dashboard (or onboarding if needed)
        if (isAuthRoute) {
          if (needsOnboarding) {
            debugPrint('[Router] Authenticated, needs onboarding');
            return '/permissions-onboarding';
          }
          debugPrint('[Router] Authenticated on auth route, redirecting to /dashboard');
          return '/dashboard';
        }
      }

      debugPrint('[Router] No redirect needed');
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
          GoRoute(
            path: '/tenants',
            builder: (context, state) => const TenantSelectorPage(),
          ),
        ],
      ),

      // Permissions onboarding (full-screen, no bottom nav)
      GoRoute(
        path: '/permissions-onboarding',
        builder: (context, state) => const PermissionsOnboardingPage(),
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
