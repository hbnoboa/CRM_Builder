import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:uuid/uuid.dart';

import 'package:crm_mobile/core/database/app_database.dart';
import 'package:crm_mobile/core/network/api_client.dart';
import 'package:crm_mobile/core/upload/local_file_storage.dart';

part 'upload_queue_service.g.dart';

final _logger = Logger(printer: SimplePrinter());

/// Manages the offline upload queue.
/// Files are enqueued locally, then uploaded when online.
/// Timer.periodic(30s) + connectivity listener for processing.
class UploadQueueService {
  UploadQueueService(this._dio);

  final Dio _dio;
  Timer? _timer;
  StreamSubscription<List<ConnectivityResult>>? _connectivitySub;
  bool _processing = false;

  static const _processInterval = Duration(seconds: 30);
  static const _maxRetries = 5;

  /// Start the upload queue processor.
  void init() {
    // Reset any stuck 'uploading' items from a previous session
    _resetStuckItems();

    // Periodic processing
    _timer = Timer.periodic(_processInterval, (_) => processQueue());

    // Process immediately when connectivity changes to online
    _connectivitySub = Connectivity().onConnectivityChanged.listen((results) {
      final isOnline = !results.contains(ConnectivityResult.none) &&
          results.isNotEmpty;
      if (isOnline) {
        processQueue();
      }
    });
  }

  /// Stop the upload queue processor.
  void dispose() {
    _timer?.cancel();
    _connectivitySub?.cancel();
    _timer = null;
    _connectivitySub = null;
  }

  /// Enqueue a file for upload.
  /// Returns the queue item ID (for tracking / local:// URL).
  Future<String> enqueue({
    required String localPath,
    required String fileName,
    String folder = 'data',
    required String entitySlug,
    required String recordId,
    required String fieldSlug,
    required String mimeType,
    required int fileSize,
  }) async {
    final db = AppDatabase.instance.db;
    final id = const Uuid().v4();
    final now = DateTime.now().toIso8601String();

    await db.execute(
      '''INSERT INTO file_upload_queue
         (id, local_path, file_name, folder, entity_slug, record_id, field_slug,
          status, remote_url, retry_count, error, mime_type, file_size, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', '', 0, '', ?, ?, ?)''',
      [id, localPath, fileName, folder, entitySlug, recordId, fieldSlug,
       mimeType, fileSize, now,],
    );

    _logger.i('Enqueued upload: $fileName (queue id: $id)');

    // Try to process immediately
    processQueue();

    return id;
  }

  /// Process all pending/failed items in the queue.
  Future<void> processQueue() async {
    if (_processing) return;
    _processing = true;

    try {
      // Check connectivity first
      final connectivityResult = await Connectivity().checkConnectivity();
      final isOnline = !connectivityResult.contains(ConnectivityResult.none) &&
          connectivityResult.isNotEmpty;
      if (!isOnline) {
        _logger.d('Offline - skipping queue processing');
        return;
      }

      final db = AppDatabase.instance.db;
      final items = await db.getAll(
        '''SELECT * FROM file_upload_queue
           WHERE status IN ('pending', 'failed')
             AND retry_count < ?
           ORDER BY created_at ASC''',
        [_maxRetries],
      );

      if (items.isEmpty) return;

      _logger.i('Processing upload queue: ${items.length} items');

      for (final item in items) {
        await _uploadOne(item);
      }
    } catch (e) {
      _logger.e('Queue processing error: $e');
    } finally {
      _processing = false;
    }
  }

  /// Upload a single queue item.
  Future<void> _uploadOne(Map<String, dynamic> item) async {
    final db = AppDatabase.instance.db;
    final id = item['id'] as String;
    final localPath = item['local_path'] as String;
    final fileName = item['file_name'] as String;
    final folder = item['folder'] as String;
    final entitySlug = item['entity_slug'] as String;
    final recordId = item['record_id'] as String;
    final fieldSlug = item['field_slug'] as String;
    final retryCount = (item['retry_count'] as num?)?.toInt() ?? 0;

    // TODO: Apply exponential backoff when last_attempt tracking is implemented
    // For now, we process items immediately regardless of retry count

    try {
      // Mark as uploading
      await db.execute(
        "UPDATE file_upload_queue SET status = 'uploading' WHERE id = ?",
        [id],
      );

      // Upload via API
      final formData = FormData.fromMap({
        'file': await MultipartFile.fromFile(localPath, filename: fileName),
        'folder': folder,
      });

      final response = await _dio.post('/upload/file', data: formData);
      final remoteUrl = response.data['url'] as String;

      // Mark as completed
      await db.execute(
        "UPDATE file_upload_queue SET status = 'completed', remote_url = ? WHERE id = ?",
        [remoteUrl, id],
      );

      _logger.i('Upload completed: $fileName → $remoteUrl');

      // Update the EntityData record with the real URL
      await _updateEntityData(entitySlug, recordId, fieldSlug, id, remoteUrl);

      // Clean up local file
      await LocalFileStorage.instance.deleteFile(localPath);
    } on DioException catch (e) {
      await _handleError(id, retryCount, e);
    } catch (e) {
      await _handleError(id, retryCount, e);
    }
  }

  /// Update the EntityData record, replacing the local:// placeholder with the real URL.
  Future<void> _updateEntityData(
    String entitySlug,
    String recordId,
    String fieldSlug,
    String queueId,
    String remoteUrl,
  ) async {
    try {
      // PATCH the record via API so PowerSync propagates the change
      final currentRecord = await AppDatabase.instance.db.getAll(
        'SELECT data FROM EntityData WHERE id = ?',
        [recordId],
      );

      if (currentRecord.isEmpty) {
        _logger.w('Record $recordId not found - skipping EntityData update');
        return;
      }

      // Parse current data, replace local:// URL with remote URL
      final rawData = currentRecord.first['data'] as String?;
      if (rawData == null) return;

      // Update the field with remote URL via API
      await _dio.patch(
        '/data/$entitySlug/$recordId',
        data: {
          'data': {fieldSlug: remoteUrl},
        },
      );

      _logger.i('Updated EntityData $recordId field $fieldSlug with remote URL');
    } catch (e) {
      _logger.e('Failed to update EntityData: $e');
      // Don't fail the upload - the URL is stored in the queue item
    }
  }

  /// Handle upload error with retry logic.
  Future<void> _handleError(String id, int retryCount, dynamic error) async {
    final db = AppDatabase.instance.db;
    String errorMessage = error.toString();
    String newStatus = 'failed';

    if (error is DioException) {
      final statusCode = error.response?.statusCode;
      errorMessage = 'HTTP $statusCode: ${error.message}';

      // 4xx errors (except 401/429): permanent failure, don't retry
      if (statusCode != null &&
          statusCode >= 400 &&
          statusCode < 500 &&
          statusCode != 401 &&
          statusCode != 429) {
        newStatus = 'failed';
        // Set retry_count to max so it won't be retried
        await db.execute(
          'UPDATE file_upload_queue SET status = ?, error = ?, retry_count = ? WHERE id = ?',
          [newStatus, errorMessage, _maxRetries, id],
        );
        _logger.e('Upload permanently failed (HTTP $statusCode): $errorMessage');
        return;
      }
    }

    // Retryable error: increment retry count
    await db.execute(
      'UPDATE file_upload_queue SET status = ?, error = ?, retry_count = ? WHERE id = ?',
      [newStatus, errorMessage, retryCount + 1, id],
    );

    _logger.w('Upload failed (attempt ${retryCount + 1}/$_maxRetries): $errorMessage');
  }

  /// Reset items stuck in 'uploading' state (from app crash/restart).
  Future<void> _resetStuckItems() async {
    final db = AppDatabase.instance.db;
    await db.execute(
      "UPDATE file_upload_queue SET status = 'pending' WHERE status = 'uploading'",
    );
  }

  /// Get count of pending uploads.
  Future<int> getPendingCount() async {
    final db = AppDatabase.instance.db;
    final result = await db.getAll(
      "SELECT COUNT(*) as count FROM file_upload_queue WHERE status IN ('pending', 'failed', 'uploading')",
    );
    return (result.first['count'] as num?)?.toInt() ?? 0;
  }

  /// Watch pending upload count as a stream.
  Stream<int> watchPendingCount() {
    final db = AppDatabase.instance.db;
    return db
        .watch(
          "SELECT COUNT(*) as count FROM file_upload_queue WHERE status IN ('pending', 'failed', 'uploading')",
        )
        .map((rows) => (rows.first['count'] as num?)?.toInt() ?? 0);
  }

  /// Force retry all failed items.
  Future<void> retryAll() async {
    final db = AppDatabase.instance.db;
    await db.execute(
      "UPDATE file_upload_queue SET status = 'pending', retry_count = 0, error = '' WHERE status = 'failed'",
    );
    processQueue();
  }

  /// Check if a queue item has completed and return its remote URL.
  Future<String?> getRemoteUrl(String queueId) async {
    final db = AppDatabase.instance.db;
    final results = await db.getAll(
      "SELECT remote_url FROM file_upload_queue WHERE id = ? AND status = 'completed'",
      [queueId],
    );
    if (results.isEmpty) return null;
    final url = results.first['remote_url'] as String?;
    return (url != null && url.isNotEmpty) ? url : null;
  }

  /// Clean up completed items older than the given duration.
  Future<int> cleanupCompleted({Duration olderThan = const Duration(days: 7)}) async {
    final db = AppDatabase.instance.db;
    final cutoff = DateTime.now().subtract(olderThan).toIso8601String();
    final result = await db.getAll(
      "SELECT COUNT(*) as count FROM file_upload_queue WHERE status = 'completed' AND created_at < ?",
      [cutoff],
    );
    final count = (result.first['count'] as num?)?.toInt() ?? 0;

    if (count > 0) {
      await db.execute(
        "DELETE FROM file_upload_queue WHERE status = 'completed' AND created_at < ?",
        [cutoff],
      );
    }
    return count;
  }
}

@Riverpod(keepAlive: true)
UploadQueueService uploadQueueService(Ref ref) {
  final dio = ref.watch(apiClientProvider);
  final service = UploadQueueService(dio);
  service.init();
  ref.onDispose(() => service.dispose());
  return service;
}
