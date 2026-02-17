import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:uuid/uuid.dart';
import 'package:crm_mobile/core/auth/secure_storage.dart';
import 'package:crm_mobile/core/database/app_database.dart';
import 'package:crm_mobile/core/filters/filter_models.dart';
import 'package:crm_mobile/core/filters/filter_sql_builder.dart';
import 'package:crm_mobile/core/network/api_client.dart';

part 'data_repository.g.dart';

const _uuid = Uuid();

/// Data repository - 100% offline-first via PowerSync.
///
/// Leituras: SQLite local (real-time via streams)
/// Escritas: SQLite local → PowerSync enfileira → uploadData() envia para API
///
/// Excecao: uploadFile() usa API diretamente (arquivos nao passam pelo PowerSync)
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
      debugPrint('[DataRepo] watchRecords - applying ${globalFilters.length} global filters');
      final filterResult = FilterSqlBuilder.buildFilterClauses(
        globalFilters,
        localFilters,
      );
      debugPrint('[DataRepo] watchRecords - filterResult.where: ${filterResult.where}');
      debugPrint('[DataRepo] watchRecords - filterResult.params: ${filterResult.params}');
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

    debugPrint('[DataRepo] Final SQL: $query');
    debugPrint('[DataRepo] Final params: $params');

    // Debug: count total records vs filtered records
    db.getAll('SELECT COUNT(*) as total FROM EntityData WHERE entityId = ? AND deletedAt IS NULL', [entityId]).then((countResult) {
      final total = countResult.first['total'];
      debugPrint('[DataRepo] DEBUG - Total records (no filter): $total');
    });

    // Debug: test json_extract on first record
    if (globalFilters.isNotEmpty) {
      final testField = globalFilters.first.fieldSlug;
      final testValue = globalFilters.first.value;
      db.getAll('''
        SELECT id,
               json_extract(data, '\$.$testField') as extracted_value,
               CASE
                 WHEN json_extract(data, '\$.$testField') = '$testValue' THEN 'MATCH_UNQUOTED'
                 WHEN json_extract(data, '\$.$testField') = '"$testValue"' THEN 'MATCH_QUOTED'
                 ELSE 'NO_MATCH'
               END as match_type
        FROM EntityData
        WHERE entityId = ?
        LIMIT 5
      ''', [entityId]).then((rows) {
        debugPrint('[DataRepo] DEBUG - Testing filter on field: $testField = $testValue');
        for (final row in rows) {
          debugPrint('[DataRepo] DEBUG - extracted: ${row['extracted_value']} | match: ${row['match_type']}');
        }
      });
    }

    return db.watch(query, parameters: params);
  }

  /// Extract global filters from Entity.settings JSON.
  List<GlobalFilter> extractGlobalFilters(Map<String, dynamic> entity) {
    try {
      final settingsStr = entity['settings'] as String?;
      final settingsPreview = settingsStr != null && settingsStr.length > 200
          ? '${settingsStr.substring(0, 200)}...'
          : settingsStr ?? '(null)';
      debugPrint('[DataRepo] extractGlobalFilters - entity name: ${entity['name']}');
      debugPrint('[DataRepo] extractGlobalFilters - settingsStr preview: $settingsPreview');
      if (settingsStr == null || settingsStr.isEmpty) {
        debugPrint('[DataRepo] extractGlobalFilters - NO SETTINGS, returning empty');
        return [];
      }
      final settings = jsonDecode(settingsStr) as Map<String, dynamic>;
      debugPrint('[DataRepo] extractGlobalFilters - settings keys: ${settings.keys.toList()}');
      final filtersJson = settings['globalFilters'] as List<dynamic>?;
      debugPrint('[DataRepo] extractGlobalFilters - globalFilters raw: $filtersJson');
      if (filtersJson == null || filtersJson.isEmpty) {
        debugPrint('[DataRepo] extractGlobalFilters - NO GLOBAL FILTERS in settings');
        return [];
      }
      final filters = filtersJson
          .whereType<Map<String, dynamic>>()
          .map((json) => GlobalFilter.fromJson(json))
          .toList();
      debugPrint('[DataRepo] extractGlobalFilters - PARSED ${filters.length} filters:');
      for (final f in filters) {
        debugPrint('[DataRepo]   -> ${f.fieldSlug} (${f.fieldType}) ${f.operator.name} "${f.value}"');
      }
      return filters;
    } catch (e, stack) {
      debugPrint('[DataRepo] extractGlobalFilters ERROR: $e');
      debugPrint('[DataRepo] extractGlobalFilters STACK: $stack');
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
  // OFFLINE-FIRST WRITES (100% PowerSync)
  // Todas as escritas vao para SQLite local.
  // PowerSync enfileira e sincroniza via uploadData() quando online.
  // ═══════════════════════════════════════════════════════

  /// Create a record - saves to local SQLite, PowerSync syncs to API.
  /// Optionally accepts a pre-generated [id] (used when images are queued before save).
  Future<Map<String, dynamic>> createRecord({
    required String entitySlug,
    required Map<String, dynamic> data,
    String? parentRecordId,
    String? id,
  }) async {
    final db = AppDatabase.instance.db;
    final entity = await getEntity(entitySlug);
    if (entity == null) throw Exception('Entity not found: $entitySlug');

    final recordId = id ?? _uuid.v4();
    final now = DateTime.now().toIso8601String();
    final tenantId = await _getTenantId();
    final userId = await _getCurrentUserId();

    // Salva localmente - PowerSync enfileira automaticamente para sync
    await db.execute(
      '''INSERT INTO EntityData (id, tenantId, entityId, data, parentRecordId, createdById, updatedById, createdAt, updatedAt, deletedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)''',
      [recordId, tenantId, entity['id'], jsonEncode(data), parentRecordId, userId, userId, now, now],
    );

    return {'id': recordId, 'data': data, 'createdAt': now};
  }

  /// Update a record - saves to local SQLite, PowerSync syncs to API.
  Future<Map<String, dynamic>> updateRecord({
    required String entitySlug,
    required String recordId,
    required Map<String, dynamic> data,
  }) async {
    final db = AppDatabase.instance.db;
    final now = DateTime.now().toIso8601String();
    final userId = await _getCurrentUserId();

    // Atualiza localmente - PowerSync enfileira automaticamente
    await db.execute(
      '''UPDATE EntityData SET data = ?, updatedById = ?, updatedAt = ? WHERE id = ?''',
      [jsonEncode(data), userId, now, recordId],
    );

    return {'id': recordId, 'data': data, 'updatedAt': now};
  }

  /// Delete a record - soft delete in local SQLite, PowerSync syncs to API.
  Future<void> deleteRecord({
    required String entitySlug,
    required String recordId,
  }) async {
    final db = AppDatabase.instance.db;
    final now = DateTime.now().toIso8601String();

    // Soft delete localmente - PowerSync enfileira automaticamente
    await db.execute(
      '''UPDATE EntityData SET deletedAt = ? WHERE id = ?''',
      [now, recordId],
    );
  }

  Future<String> _getTenantId() async {
    // Primeiro tenta o tenant selecionado (para PLATFORM_ADMIN)
    final selected = await SecureStorage.getSelectedTenantId();
    if (selected != null && selected.isNotEmpty) return selected;

    // Senao, pega do token
    final token = await SecureStorage.getAccessToken();
    if (token == null) return '';
    try {
      final parts = token.split('.');
      if (parts.length != 3) return '';
      final payload = utf8.decode(base64Url.decode(base64Url.normalize(parts[1])));
      final map = jsonDecode(payload) as Map<String, dynamic>;
      return map['tenantId'] as String? ?? '';
    } catch (_) {
      return '';
    }
  }

  Future<String?> _getCurrentUserId() async {
    final token = await SecureStorage.getAccessToken();
    if (token == null) return null;
    try {
      final parts = token.split('.');
      if (parts.length != 3) return null;
      final payload = utf8.decode(base64Url.decode(base64Url.normalize(parts[1])));
      final map = jsonDecode(payload) as Map<String, dynamic>;
      return map['sub'] as String?;
    } catch (_) {
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════
  // API READS (quando filtros globais estao ativos)
  // Backend aplica os filtros automaticamente
  // ═══════════════════════════════════════════════════════

  /// Fetch records from API (backend applies global filters automatically).
  /// Use this when entity has globalFilters defined.
  Future<List<Map<String, dynamic>>> fetchRecordsFromApi({
    required String entitySlug,
    String? search,
    String sortBy = 'createdAt',
    String sortOrder = 'desc',
    int page = 1,
    int limit = 50,
    String? parentRecordId,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'page': page,
        'limit': limit,
        'sortBy': sortBy,
        'sortOrder': sortOrder,
      };
      if (search != null && search.isNotEmpty) {
        queryParams['search'] = search;
      }
      if (parentRecordId != null) {
        queryParams['parentRecordId'] = parentRecordId;
      }

      debugPrint('[DataRepo] fetchRecordsFromApi - GET /data/$entitySlug with params: $queryParams');

      final response = await _dio.get(
        '/data/$entitySlug',
        queryParameters: queryParams,
      );

      final data = response.data;
      final records = (data['data'] as List<dynamic>?)
          ?.map((e) => e as Map<String, dynamic>)
          .toList() ?? [];

      debugPrint('[DataRepo] fetchRecordsFromApi - received ${records.length} records (filtered by backend)');

      return records;
    } catch (e) {
      debugPrint('[DataRepo] fetchRecordsFromApi ERROR: $e');
      rethrow;
    }
  }

  /// Stream that fetches from API periodically (for entities with global filters).
  /// Polls every [pollInterval] seconds.
  Stream<List<Map<String, dynamic>>> watchRecordsFromApi({
    required String entitySlug,
    String? search,
    String sortBy = 'createdAt',
    String sortOrder = 'desc',
    int limit = 50,
    Duration pollInterval = const Duration(seconds: 30),
  }) async* {
    // Emit immediately
    try {
      final records = await fetchRecordsFromApi(
        entitySlug: entitySlug,
        search: search,
        sortBy: sortBy,
        sortOrder: sortOrder,
        limit: limit,
      );
      yield records;
    } catch (e) {
      debugPrint('[DataRepo] watchRecordsFromApi initial fetch error: $e');
      yield [];
    }

    // Then poll periodically
    await for (final _ in Stream.periodic(pollInterval)) {
      try {
        final records = await fetchRecordsFromApi(
          entitySlug: entitySlug,
          search: search,
          sortBy: sortBy,
          sortOrder: sortOrder,
          limit: limit,
        );
        yield records;
      } catch (e) {
        debugPrint('[DataRepo] watchRecordsFromApi poll error: $e');
        // Don't yield on error, keep previous data
      }
    }
  }

  // ═══════════════════════════════════════════════════════
  // FILE UPLOAD (usa API diretamente - arquivos nao passam pelo PowerSync)
  // ═══════════════════════════════════════════════════════

  /// Upload a file via API.
  /// Usado apenas quando ONLINE. Se offline, usar UploadQueueService.
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
