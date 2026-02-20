import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:crm_mobile/core/push/push_notification_service.dart';
import 'package:crm_mobile/core/startup/startup_service.dart';
import 'package:crm_mobile/core/theme/theme_provider.dart';
import 'package:crm_mobile/core/config/router.dart';
import 'package:crm_mobile/shared/widgets/auto_logout_wrapper.dart';

class CrmApp extends ConsumerWidget {
  const CrmApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    final themeState = ref.watch(tenantThemeProvider);
    final themeMode = ref.watch(themeModeNotifierProvider);

    // Initialize startup service (handles background sync on auth/connectivity changes)
    initializeStartupService(ref);

    return AutoLogoutWrapper(
      child: MaterialApp.router(
        title: 'CRM Builder',
        debugShowCheckedModeBanner: false,
        scaffoldMessengerKey: PushNotificationService.scaffoldMessengerKey,
        theme: themeState.light,
        darkTheme: themeState.dark,
        themeMode: themeMode,
        routerConfig: router,
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: const [
          Locale('pt', 'BR'),
          Locale('en', 'US'),
        ],
        locale: const Locale('pt', 'BR'),
      ),
    );
  }
}
