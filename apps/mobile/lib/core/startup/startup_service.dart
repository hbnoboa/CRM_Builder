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
        // Just came back online - sync pending data
        debugPrint('[StartupService] Back online - syncing pending data');
        _syncPendingData();
      }

      _wasOffline = !isOnline;
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
