import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:crm_mobile/core/auth/auth_provider.dart';
import 'package:crm_mobile/core/permissions/device_permissions_provider.dart';
import 'package:crm_mobile/core/permissions/permission_provider.dart';
import 'package:crm_mobile/features/auth/pages/login_page.dart';
import 'package:crm_mobile/features/auth/pages/register_page.dart';
import 'package:crm_mobile/features/auth/pages/forgot_password_page.dart';
import 'package:crm_mobile/features/auth/pages/permissions_onboarding_page.dart';
import 'package:crm_mobile/features/auth/pages/splash_page.dart';
import 'package:crm_mobile/features/dashboard/pages/dashboard_page.dart';
import 'package:crm_mobile/features/data/pages/data_entities_page.dart';
import 'package:crm_mobile/features/data/pages/data_list_page.dart';
import 'package:crm_mobile/features/data/pages/data_detail_page.dart';
import 'package:crm_mobile/features/chat/pages/chat_list_page.dart';
import 'package:crm_mobile/features/chat/pages/chat_detail_page.dart';
import 'package:crm_mobile/features/data/pages/data_form_page.dart';
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
    _ref.listen(permissionsProvider, (prev, next) {
      debugPrint('[Router] User permissions changed');
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
    initialLocation: '/splash',
    debugLogDiagnostics: true,
    refreshListenable: authListenable,
    redirect: (context, state) {
      // Read auth state fresh on each redirect
      final authState = ref.read(authProvider);
      final permissions = ref.read(permissionsProvider);
      final isAuthenticated = authState.isAuthenticated;
      final isLoading = authState.isLoading;
      final isAuthRoute = state.matchedLocation.startsWith('/login') ||
          state.matchedLocation.startsWith('/register') ||
          state.matchedLocation.startsWith('/forgot-password');
      final isOnboardingRoute =
          state.matchedLocation == '/permissions-onboarding';
      final isSplash = state.matchedLocation == '/splash';

      debugPrint('[Router] redirect called: location=${state.matchedLocation}, isAuth=$isAuthenticated, isLoading=$isLoading');

      // Restaurando a sessao (cold start): mostra o splash em vez de piscar o
      // formulario de login. Excecao: se o usuario ja esta numa rota de auth
      // (login manual em andamento), fica la para exibir o spinner do botao.
      if (isLoading) {
        debugPrint('[Router] Still loading auth state');
        if (isAuthRoute) return null;
        return isSplash ? null : '/splash';
      }

      // Terminou de carregar: sai do splash para o destino certo.
      if (isSplash) {
        if (!isAuthenticated) return '/login';
        final devicePerms = ref.read(devicePermissionsProvider);
        return devicePerms.onboardingCompleted
            ? _getDefaultRoute(permissions)
            : '/permissions-onboarding';
      }

      // Not authenticated -> go to login (allow auth routes + onboarding)
      if (!isAuthenticated && !isAuthRoute && !isOnboardingRoute) {
        debugPrint('[Router] Not authenticated, redirecting to /login');
        return '/login';
      }

      // Authenticated -> check permissions onboarding
      if (isAuthenticated) {
        final devicePerms = ref.read(devicePermissionsProvider);
        final needsOnboarding = !devicePerms.onboardingCompleted;

        // Needs onboarding and not on that page -> redirect
        if (needsOnboarding && !isOnboardingRoute && !isAuthRoute) {
          debugPrint('[Router] Needs permissions onboarding, redirecting');
          return '/permissions-onboarding';
        }

        // Completed onboarding but still on that page -> go based on permissions
        if (!needsOnboarding && isOnboardingRoute) {
          return _getDefaultRoute(permissions);
        }

        // On auth route -> go based on permissions
        if (isAuthRoute) {
          if (needsOnboarding) {
            debugPrint('[Router] Authenticated, needs onboarding');
            return '/permissions-onboarding';
          }
          return _getDefaultRoute(permissions);
        }

        // Check permission for dashboard access
        if (state.matchedLocation == '/dashboard' &&
            !permissions.hasModuleAccess('dashboard')) {
          debugPrint('[Router] No dashboard permission, redirecting to /data');
          return '/data';
        }

        // Check permission for data access
        if (state.matchedLocation.startsWith('/data') &&
            !permissions.hasModuleAccess('data')) {
          debugPrint('[Router] No data permission, redirecting to /dashboard');
          return '/dashboard';
        }

        // Check permission for chat access
        if (state.matchedLocation.startsWith('/chat') &&
            !permissions.hasModuleAccess('chat')) {
          return _getDefaultRoute(permissions);
        }
      }

      debugPrint('[Router] No redirect needed');
      return null;
    },
    routes: [
      // Splash / restauracao de sessao (sem bottom nav)
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashPage(),
      ),
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

      // Permissions onboarding (full-screen, no bottom nav)
      GoRoute(
        path: '/permissions-onboarding',
        builder: (context, state) => const PermissionsOnboardingPage(),
      ),

      // Main app shell with bottom navigation
      ShellRoute(
        navigatorKey: _shellNavigatorKey,
        builder: (context, state, child) => ShellScaffold(child: child),
        routes: [
          // Dashboard - shows only if user has dashboard permission
          GoRoute(
            path: '/dashboard',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: DashboardPage(),
            ),
          ),
          // Data entities selector
          GoRoute(
            path: '/data',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: DataEntitiesPage(),
            ),
          ),
          // Data list for specific entity
          GoRoute(
            path: '/data/:entitySlug',
            builder: (context, state) => DataListPage(
              entitySlug: state.pathParameters['entitySlug']!,
            ),
          ),
          // Chat — lista de canais
          GoRoute(
            path: '/chat',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: ChatListPage(),
            ),
          ),
          // Chat — conversa de um canal
          GoRoute(
            path: '/chat/:channelId',
            builder: (context, state) => ChatDetailPage(
              channelId: state.pathParameters['channelId']!,
            ),
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

/// Get default route based on user permissions
String _getDefaultRoute(PermissionsState permissions) {
  // Prefer dashboard if user has access
  if (permissions.hasModuleAccess('dashboard')) {
    debugPrint('[Router] Has dashboard permission, redirecting to /dashboard');
    return '/dashboard';
  }
  // Fallback to data if user has access
  if (permissions.hasModuleAccess('data')) {
    debugPrint('[Router] Has data permission, redirecting to /data');
    return '/data';
  }
  // No permissions - stay on login (edge case)
  debugPrint('[Router] No module permissions, staying on /login');
  return '/login';
}
