import 'dart:convert';
import 'dart:math' as math;

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:powersync/powersync.dart';
import 'package:crm_mobile/core/auth/secure_storage.dart';
import 'package:crm_mobile/core/config/env.dart';
import 'package:crm_mobile/core/network/api_client.dart';
import 'package:logger/logger.dart';

final _logger = Logger(printer: SimplePrinter());

/// Exponential backoff helper for retries
class _ExponentialBackoff {
  static const _initialDelay = Duration(milliseconds: 500);
  static const _maxDelay = Duration(seconds: 30);
  static const _maxRetries = 5;

  int _retryCount = 0;

  /// Calculate delay with exponential backoff + jitter
  Duration get nextDelay {
    final exponentialDelay = _initialDelay * math.pow(2, _retryCount);
    final jitter = Duration(
      milliseconds: (math.Random().nextDouble() * 500).toInt(),
    );
    final delay = exponentialDelay + jitter;
    return delay > _maxDelay ? _maxDelay : delay;
  }

  /// Returns true if we should retry, false if max retries exceeded
  bool shouldRetry() {
    if (_retryCount >= _maxRetries) return false;
    _retryCount++;
    return true;
  }

  void reset() => _retryCount = 0;
}

/// Connects PowerSync to the backend:
/// - fetchCredentials: calls /sync/credentials to get a PowerSync-specific JWT
///   that includes the effective tenantId (supports PLATFORM_ADMIN tenant switching)
/// - uploadData: sends offline mutations to NestJS API
class CrmPowerSyncConnector extends PowerSyncBackendConnector {
  CrmPowerSyncConnector();

  @override
  Future<PowerSyncCredentials?> fetchCredentials() async {
    // Check connectivity first - if offline, don't try to get credentials
    final connectivity = await Connectivity().checkConnectivity();
    final isOffline = connectivity.contains(ConnectivityResult.none) ||
        connectivity.isEmpty;

    if (isOffline) {
      _logger.i('PowerSync: offline - skipping credential fetch');
      return null;
    }

    final accessToken = await SecureStorage.getAccessToken();
    if (accessToken == null) {
      _logger.i('PowerSync: no access token available');
      return null;
    }

    // Ensure access token is fresh for the API call
    var token = accessToken;
    if (_isTokenExpired(token)) {
      final refreshed = await _refreshToken();
      if (refreshed == null) {
        _logger.w('PowerSync: token expired and refresh failed');
        return null;
      }
      token = refreshed;
    }

    try {
      // Call /sync/credentials to get a PowerSync-specific JWT.
      // This endpoint returns a token with the effective tenantId
      // (supports PLATFORM_ADMIN tenant override via selectedTenantId).
      final dio = createApiClient();
      final selectedTenantId = await SecureStorage.getSelectedTenantId();

      final response = await dio.post('/sync/credentials', data: {
        if (selectedTenantId != null) 'tenantId': selectedTenantId,
      },);

      final data = response.data as Map<String, dynamic>;

      // Get endpoint from response, but fallback to Env.powerSyncUrl if localhost
      // (server may not have POWERSYNC_URL configured)
      var endpoint = data['endpoint'] as String? ?? Env.powerSyncUrl;
      if (endpoint.contains('localhost')) {
        _logger.w('PowerSync: backend returned localhost, using Env.powerSyncUrl instead');
        endpoint = Env.powerSyncUrl;
      }

      final tokenString = data['token'] as String;
      final userId = _extractUserIdFromToken(tokenString);
      final expiresAtString = data['expiresAt'] as String?;
      final expiresAt = expiresAtString != null
          ? DateTime.parse(expiresAtString)
          : null;

      _logger.i('PowerSync: connecting to $endpoint (userId: $userId)');

      return PowerSyncCredentials(
        endpoint: endpoint,
        token: tokenString,
        userId: userId,
        expiresAt: expiresAt,
      );
    } catch (e) {
      _logger.e('PowerSync: failed to get sync credentials', error: e);
      // Fallback: use access token directly (won't have tenant override)
      final userId = _extractUserIdFromToken(token);
      _logger.w('PowerSync: using fallback credentials (userId: $userId)');

      return PowerSyncCredentials(
        endpoint: Env.powerSyncUrl,
        token: token,
        userId: userId,
        // No expiresAt in fallback - will use token's exp claim
      );
    }
  }

  /// Decode JWT and check if it's expired or expiring within 30 seconds.
  bool _isTokenExpired(String token) {
    try {
      final parts = token.split('.');
      if (parts.length != 3) return true;

      final payload = parts[1];
      // Add padding if needed
      final normalized = base64Url.normalize(payload);
      final decoded = utf8.decode(base64Url.decode(normalized));
      final map = jsonDecode(decoded) as Map<String, dynamic>;

      final exp = map['exp'] as int?;
      if (exp == null) return true;

      final expiresAt = DateTime.fromMillisecondsSinceEpoch(exp * 1000);
      // Refresh 30 seconds before expiry
      return DateTime.now().isAfter(expiresAt.subtract(const Duration(seconds: 30)));
    } catch (_) {
      return true;
    }
  }

  /// Extract userId from JWT token (uses 'user_id' or fallback to 'sub')
  String? _extractUserIdFromToken(String token) {
    try {
      final parts = token.split('.');
      if (parts.length != 3) return null;

      final payload = parts[1];
      final normalized = base64Url.normalize(payload);
      final decoded = utf8.decode(base64Url.decode(normalized));
      final map = jsonDecode(decoded) as Map<String, dynamic>;

      // PowerSync JWT uses 'user_id', but 'sub' is standard fallback
      return map['user_id'] as String? ?? map['sub'] as String?;
    } catch (e) {
      _logger.w('PowerSync: failed to extract userId from token', error: e);
      return null;
    }
  }

  /// Use refresh token to get new access token.
  Future<String?> _refreshToken() async {
    try {
      final refreshToken = await SecureStorage.getRefreshToken();
      if (refreshToken == null) return null;

      final refreshDio = Dio(BaseOptions(baseUrl: Env.apiUrl));
      final response = await refreshDio.post(
        '/auth/refresh',
        data: {'refreshToken': refreshToken},
      );

      final newAccessToken = response.data['accessToken'] as String;
      final newRefreshToken = response.data['refreshToken'] as String;

      await SecureStorage.setTokens(
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      );

      _logger.i('PowerSync: token refreshed successfully');
      return newAccessToken;
    } catch (e) {
      _logger.e('PowerSync: failed to refresh token', error: e);
      return null;
    }
  }

  /// Called when the app has offline mutations to upload.
  /// Sends each operation to the NestJS API with exponential backoff retry.
  @override
  Future<void> uploadData(PowerSyncDatabase database) async {
    _logger.i('PowerSync: uploadData() chamado');
    final uploadStartTime = DateTime.now();

    final tx = await database.getCrudBatch();
    if (tx == null) {
      _logger.d('PowerSync: nenhuma operação pendente para upload');
      return;
    }

    _logger.i('PowerSync: ${tx.crud.length} operações para upload');

    final dio = createApiClient();
    final backoff = _ExponentialBackoff();

    // Cache de entityId -> slug para evitar queries repetidas
    final entitySlugCache = <String, String>{};

    for (final op in tx.crud) {
      backoff.reset();
      var success = false;

      while (!success) {
        try {
          final table = op.table;
          final opData = op.opData ?? {};

          _logger.i('PowerSync upload: $table ${op.op} ${op.id}');

          if (table == 'EntityData') {
            // Busca o entityId - pode estar no opData (PUT) ou precisamos buscar do banco (PATCH/DELETE)
            var entityId = opData['entityId'] as String?;

            // Para PATCH e DELETE, entityId nao vem no opData pois nao foi alterado
            // Precisamos buscar do registro local
            if (entityId == null) {
              final record = await database.getAll(
                'SELECT entityId FROM EntityData WHERE id = ?',
                [op.id],
              );
              if (record.isNotEmpty) {
                entityId = record.first['entityId'] as String?;
              }
            }

            if (entityId == null) {
              _logger.w('EntityData without entityId (record ${op.id}), skipping');
              success = true;
              continue;
            }

            // Cache do slug
            if (!entitySlugCache.containsKey(entityId)) {
              final entities = await database.getAll(
                'SELECT slug FROM Entity WHERE id = ?',
                [entityId],
              );
              if (entities.isNotEmpty) {
                entitySlugCache[entityId] = entities.first['slug'] as String;
              }
            }

            final entitySlug = entitySlugCache[entityId];
            if (entitySlug == null) {
              _logger.w('Entity not found for id $entityId, skipping');
              success = true;
              continue;
            }

            // Prepara os dados para a API
            var recordData = opData['data'];

            // Para PATCH, se data nao vier no opData, busca do registro local
            if (recordData == null && op.op == UpdateType.patch) {
              final record = await database.getAll(
                'SELECT data FROM EntityData WHERE id = ?',
                [op.id],
              );
              if (record.isNotEmpty) {
                recordData = record.first['data'];
              }
            }

            final parsedData = recordData is String ? jsonDecode(recordData) : recordData;

            switch (op.op) {
              case UpdateType.put:
                // Create new record
                await dio.post('/data/$entitySlug', data: {
                  'id': op.id,
                  'data': parsedData,
                  if (opData['parentRecordId'] != null) 'parentRecordId': opData['parentRecordId'],
                },);
                _logger.i('Created record ${op.id} in $entitySlug');
                break;
              case UpdateType.patch:
                // Update existing record
                if (parsedData == null) {
                  _logger.w('No data found for PATCH on record ${op.id}, skipping');
                  success = true;
                  continue;
                }
                await dio.patch('/data/$entitySlug/${op.id}', data: {
                  'data': parsedData,
                },);
                _logger.i('Updated record ${op.id} in $entitySlug');
                break;
              case UpdateType.delete:
                // Delete record (soft delete via deletedAt)
                await dio.delete('/data/$entitySlug/${op.id}');
                _logger.i('Deleted record ${op.id} from $entitySlug');
                break;
            }
            success = true;
          } else if (table == 'Notification') {
            // Mark notification as read
            if (op.op == UpdateType.patch) {
              await dio.patch('/notifications/${op.id}/read');
            }
            success = true;
          } else {
            // Log unhandled tables - Entity, CustomRole, User are read-only (sync from server)
            // If mutations happen on these tables, they're likely client bugs
            _logger.w('Unhandled table for upload: $table ${op.op} ${op.id}');
            // Skip but don't fail - these tables are server-managed
            success = true;
            continue;
          }
        } catch (e) {
          _logger.e('Failed to upload mutation: ${op.table} ${op.op}', error: e);

          // Check if it's a client error (4xx) - skip and continue (no retry)
          if (e is DioException &&
              e.response?.statusCode != null &&
              e.response!.statusCode! >= 400 &&
              e.response!.statusCode! < 500) {
            _logger.w('Skipping failed mutation (client error ${e.response!.statusCode})');
            success = true;
            continue;
          }

          // Server errors (5xx) or network errors - retry with exponential backoff
          if (backoff.shouldRetry()) {
            final delay = backoff.nextDelay;
            _logger.w('Retrying in ${delay.inMilliseconds}ms...');
            await Future.delayed(delay);
            // Continue to retry
          } else {
            // Max retries exceeded - rethrow to let PowerSync handle
            _logger.e('Max retries exceeded for ${op.table} ${op.op} ${op.id}');
            rethrow;
          }
        }
      }
    }

    _logger.d('PowerSync: chamando tx.complete()...');
    await tx.complete();

    final uploadDuration = DateTime.now().difference(uploadStartTime);
    _logger.i('PowerSync: batch upload complete em ${uploadDuration.inMilliseconds}ms');
    _logger.i('PowerSync: ⚠️  MONITORAR: sync stream deve continuar funcionando após este ponto');
  }
}
