import 'dart:convert';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:uuid/uuid.dart';
import 'package:crm_mobile/core/database/app_database.dart';
import 'package:crm_mobile/core/filters/filter_models.dart';
import 'package:crm_mobile/core/network/api_client.dart';
import 'package:logger/logger.dart';

part 'global_filter_sync_service.g.dart';

const _uuid = Uuid();
final _logger = Logger(printer: SimplePrinter());

/// Service to queue and sync global filter updates.
/// Global filters are stored in Entity.settings which is read-only in PowerSync.
/// This service queues updates locally and syncs them when online.
class GlobalFilterSyncService {
  GlobalFilterSyncService(this._dio);

  final Dio _dio;

  /// Queue a global filter update for later sync
  Future<void> queueFilterUpdate({
    required String entityId,
    required List<GlobalFilter> filters,
  }) async {
    final db = AppDatabase.instance.db;
    final now = DateTime.now().toIso8601String();
    final id = _uuid.v4();

    // Check if there's already a pending update for this entity
    final existing = await db.getAll(
      "SELECT id FROM global_filter_queue WHERE entity_id = ? AND status = 'pending'",
      [entityId],
    );

    if (existing.isNotEmpty) {
      // Update existing pending entry
      await db.execute(
        '''UPDATE global_filter_queue
           SET filters_json = ?, updated_at = ?
           WHERE entity_id = ? AND status = 'pending' ''',
        [jsonEncode(filters.map((f) => f.toJson()).toList()), now, entityId],
      );
      _logger.i('Updated existing pending global filter update for entity $entityId');
    } else {
      // Create new entry
      await db.execute(
        '''INSERT INTO global_filter_queue
           (id, entity_id, filters_json, status, retry_count, error, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', 0, NULL, ?, ?)''',
        [id, entityId, jsonEncode(filters.map((f) => f.toJson()).toList()), now, now],
      );
      _logger.i('Queued new global filter update for entity $entityId');
    }

    // Try to sync immediately if online
    await _trySyncPendingUpdates();
  }

  /// Try to sync all pending global filter updates
  Future<void> _trySyncPendingUpdates() async {
    // Check connectivity
    final connectivity = await Connectivity().checkConnectivity();
    if (connectivity.contains(ConnectivityResult.none)) {
      _logger.i('Offline - skipping global filter sync');
      return;
    }

    final db = AppDatabase.instance.db;
    final pending = await db.getAll(
      "SELECT * FROM global_filter_queue WHERE status = 'pending' ORDER BY created_at ASC",
    );

    for (final item in pending) {
      final id = item['id'] as String;
      final entityId = item['entity_id'] as String;
      final filtersJson = item['filters_json'] as String;
      final retryCount = (item['retry_count'] as int?) ?? 0;

      try {
        // Mark as syncing
        await db.execute(
          "UPDATE global_filter_queue SET status = 'syncing', updated_at = ? WHERE id = ?",
          [DateTime.now().toIso8601String(), id],
        );

        // Parse filters
        final filtersData = jsonDecode(filtersJson) as List<dynamic>;

        // Send to API
        await _dio.patch(
          '/entities/$entityId/global-filters',
          data: {'globalFilters': filtersData},
        );

        // Mark as completed and delete
        await db.execute(
          "DELETE FROM global_filter_queue WHERE id = ?",
          [id],
        );
        _logger.i('Synced global filter update for entity $entityId');
      } catch (e) {
        _logger.e('Failed to sync global filter for entity $entityId', error: e);

        String errorMessage = e.toString();
        String newStatus = 'pending';

        // Check if it's a client error (4xx) - don't retry
        if (e is DioException &&
            e.response?.statusCode != null &&
            e.response!.statusCode! >= 400 &&
            e.response!.statusCode! < 500) {
          newStatus = 'failed';
          errorMessage = 'Client error: ${e.response!.statusCode}';
        } else if (retryCount >= 5) {
          // Max retries exceeded
          newStatus = 'failed';
          errorMessage = 'Max retries exceeded';
        }

        await db.execute(
          '''UPDATE global_filter_queue
             SET status = ?, retry_count = ?, error = ?, updated_at = ?
             WHERE id = ?''',
          [newStatus, retryCount + 1, errorMessage, DateTime.now().toIso8601String(), id],
        );
      }
    }
  }

  /// Process pending updates (call this on app start and connectivity change)
  Future<void> processPendingUpdates() async {
    await _trySyncPendingUpdates();
  }

  /// Get count of pending updates
  Future<int> getPendingCount() async {
    final db = AppDatabase.instance.db;
    final result = await db.getAll(
      "SELECT COUNT(*) as count FROM global_filter_queue WHERE status = 'pending'",
    );
    return (result.first['count'] as int?) ?? 0;
  }

  /// Clear failed updates (for cleanup)
  Future<void> clearFailed() async {
    final db = AppDatabase.instance.db;
    await db.execute("DELETE FROM global_filter_queue WHERE status = 'failed'");
  }
}

@riverpod
GlobalFilterSyncService globalFilterSyncService(Ref ref) {
  return GlobalFilterSyncService(ref.watch(apiClientProvider));
}
