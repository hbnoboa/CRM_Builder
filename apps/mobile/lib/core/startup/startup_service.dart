import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:crm_mobile/core/auth/auth_provider.dart';
import 'package:crm_mobile/core/filters/global_filter_sync_service.dart';
import 'package:crm_mobile/core/upload/upload_queue_service.dart';

part 'startup_service.g.dart';

/// Startup service that handles background sync tasks when:
/// - App starts (and user is authenticated)
/// - Connectivity changes from offline to online
@riverpod
class StartupService extends _$StartupService {
  StreamSubscription<List<ConnectivityResult>>? _connectivitySub;
  bool _wasOffline = false;

  @override
  void build() {
    // Listen to auth state changes
    ref.listen(authProvider, (prev, next) {
      if (next.isAuthenticated && prev?.isAuthenticated != true) {
        // User just logged in - run startup tasks
        _runStartupTasks();
      }
    });

    // Listen to connectivity changes
    _connectivitySub = Connectivity().onConnectivityChanged.listen((results) {
      final isOnline = !results.contains(ConnectivityResult.none);

      if (isOnline && _wasOffline) {
        // Just came back online - reconecta a sessao (aberta offline) e sincroniza
        debugPrint('[StartupService] Back online - resuming session and syncing');
        ref.read(authProvider.notifier).resumeOnline();
        _syncPendingData();
      }

      _wasOffline = !isOnline;
    });

    // Estado inicial: o app pode ter aberto sem rede (o stream so avisa mudancas).
    Connectivity().checkConnectivity().then((results) {
      _wasOffline = results.isEmpty || results.contains(ConnectivityResult.none);
    });

    // Cleanup subscription on dispose
    ref.onDispose(() {
      _connectivitySub?.cancel();
    });

    // Run initial tasks if already authenticated
    final authState = ref.read(authProvider);
    if (authState.isAuthenticated) {
      _runStartupTasks();
    }
  }

  void _runStartupTasks() {
    debugPrint('[StartupService] Running startup tasks');
    _syncPendingData();
  }

  Future<void> _syncPendingData() async {
    try {
      // Process pending global filter updates
      final filterSync = ref.read(globalFilterSyncServiceProvider);
      await filterSync.processPendingUpdates();

      // Process pending file uploads
      final uploadQueue = ref.read(uploadQueueServiceProvider);
      await uploadQueue.processQueue();
    } catch (e) {
      debugPrint('[StartupService] Error syncing pending data: $e');
    }
  }
}

/// Initialize startup service - call this in app widget
void initializeStartupService(WidgetRef ref) {
  // Just accessing the provider will initialize it
  ref.read(startupServiceProvider);
}
