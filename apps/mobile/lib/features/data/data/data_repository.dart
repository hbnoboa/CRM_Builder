import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:crm_mobile/core/database/app_database.dart';
import 'package:crm_mobile/core/filters/filter_models.dart';
import 'package:crm_mobile/core/filters/filter_sql_builder.dart';
import 'package:crm_mobile/core/network/api_client.dart';

part 'data_repository.g.dart';

/// Data repository that reads from local PowerSync DB
/// and writes through the API (mirrors data.service.ts).
class DataRepository {
  DataRepository(this._dio);

  final Dio _dio;

  // ═══════════════════════════════════════════════════════
  // LOCAL READS (PowerSync SQLite)
  // ═══════════════════════════════════════════════════════

  /// Watch all records for an entity (real-time from SQLite).
  Stream<List<Map<String, dynamic>>> watchRecords({
    required String entityId,
    String? search,
    String orderBy = 'createdAt DESC',
    int limit = 10,
    int offset = 0,
    List<GlobalFilter> globalFilters = const [],
    List<LocalFilter> localFilters = const [],
    String? createdById,
  }) {
    final db = AppDatabase.instance.db;

    var query =
        'SELECT * FROM EntityData WHERE entityId = ? AND deletedAt IS NULL';
    final params = <dynamic>[entityId];

    // Scope 'own': only show records created by this user
    if (createdById != null) {
      query += ' AND createdById = ?';
      params.add(createdById);
    }

    // Apply global + local filters via json_extract
    if (globalFilters.isNotEmpty || localFilters.isNotEmpty) {
      final filterResult = FilterSqlBuilder.buildFilterClauses(
        globalFilters,
        localFilters,
      );
      if (filterResult.where.isNotEmpty) {
        query += filterResult.where;
        params.addAll(filterResult.params);
      }
    }

    if (search != null && search.isNotEmpty) {
      query += ' AND data LIKE ?';
      params.add('%$search%');
    }

    query += ' ORDER BY $orderBy LIMIT ? OFFSET ?';
    params.addAll([limit, offset]);

    return db.watch(query, parameters: params);
  }

  /// Extract global filters from Entity.settings JSON.
  List<GlobalFilter> extractGlobalFilters(Map<String, dynamic> entity) {
    try {
      final settingsStr = entity['settings'] as String?;
      if (settingsStr == null || settingsStr.isEmpty) return [];
      final settings = jsonDecode(settingsStr) as Map<String, dynamic>;
      final filtersJson = settings['globalFilters'] as List<dynamic>?;
      if (filtersJson == null) return [];
      return filtersJson
          .whereType<Map<String, dynamic>>()
          .map((json) => GlobalFilter.fromJson(json))
          .toList();
    } catch (_) {
      return [];
    }
  }

  /// Extract visible column slugs (ordered) from Entity.settings JSON.
  List<String> extractVisibleColumns(Map<String, dynamic> entity) {
    try {
      final settingsStr = entity['settings'] as String?;
      if (settingsStr == null || settingsStr.isEmpty) return [];
      final settings = jsonDecode(settingsStr) as Map<String, dynamic>;
      final columnConfig = settings['columnConfig'] as Map<String, dynamic>?;
      final visibleColumns = columnConfig?['visibleColumns'] as List<dynamic>?;
      if (visibleColumns == null) return [];
      return visibleColumns.cast<String>().toList();
    } catch (_) {
      return [];
    }
  }

  /// Get a single record by ID (local).
  Future<Map<String, dynamic>?> getRecord(String recordId) async {
    final db = AppDatabase.instance.db;
    final results = await db.getAll(
      'SELECT * FROM EntityData WHERE id = ? AND deletedAt IS NULL',
      [recordId],
    );
    return results.isNotEmpty ? results.first : null;
  }

  /// Watch child records (sub-entities).
  Stream<List<Map<String, dynamic>>> watchChildRecords({
    required String parentRecordId,
    required String entityId,
  }) {
    final db = AppDatabase.instance.db;
    return db.watch(
      'SELECT * FROM EntityData WHERE parentRecordId = ? AND entityId = ? AND deletedAt IS NULL ORDER BY createdAt DESC',
      parameters: [parentRecordId, entityId],
    );
  }

  /// Get entity definition by slug (local).
  Future<Map<String, dynamic>?> getEntity(String slug) async {
    final db = AppDatabase.instance.db;
    final results = await db.getAll(
      'SELECT * FROM Entity WHERE slug = ?',
      [slug],
    );
    return results.isNotEmpty ? results.first : null;
  }

  /// Watch entity definition.
  Stream<List<Map<String, dynamic>>> watchEntity(String slug) {
    final db = AppDatabase.instance.db;
    return db.watch(
      'SELECT * FROM Entity WHERE slug = ?',
      parameters: [slug],
    );
  }

  // ═══════════════════════════════════════════════════════
  // REMOTE WRITES (API)
  // ═══════════════════════════════════════════════════════

  /// Create a record via API (mirrors data.service.ts create).
  Future<Map<String, dynamic>> createRecord({
    required String entitySlug,
    required Map<String, dynamic> data,
    String? parentRecordId,
  }) async {
    final response = await _dio.post(
      '/data/$entitySlug',
      data: {
        'data': data,
        if (parentRecordId != null) 'parentRecordId': parentRecordId,
      },
    );
    return response.data as Map<String, dynamic>;
  }

  /// Update a record via API.
  Future<Map<String, dynamic>> updateRecord({
    required String entitySlug,
    required String recordId,
    required Map<String, dynamic> data,
  }) async {
    final response = await _dio.patch(
      '/data/$entitySlug/$recordId',
      data: {'data': data},
    );
    return response.data as Map<String, dynamic>;
  }

  /// Delete a record via API.
  Future<void> deleteRecord({
    required String entitySlug,
    required String recordId,
  }) async {
    await _dio.delete('/data/$entitySlug/$recordId');
  }

  // ═══════════════════════════════════════════════════════
  // FILE UPLOAD
  // ═══════════════════════════════════════════════════════

  /// Upload a file via API (mirrors upload service).
  Future<String> uploadFile({
    required String filePath,
    required String fileName,
    String folder = 'data',
    void Function(int sent, int total)? onProgress,
  }) async {
    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(filePath, filename: fileName),
      'folder': folder,
    });

    final response = await _dio.post(
      '/upload/file',
      data: formData,
      onSendProgress: onProgress,
    );
    return response.data['url'] as String;
  }
}

@riverpod
DataRepository dataRepository(Ref ref) {
  return DataRepository(ref.watch(apiClientProvider));
}
