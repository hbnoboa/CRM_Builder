import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:powersync/powersync.dart';
import 'package:crm_mobile/core/auth/secure_storage.dart';
import 'package:crm_mobile/core/config/env.dart';
import 'package:crm_mobile/core/network/api_client.dart';
import 'package:logger/logger.dart';

final _logger = Logger(printer: SimplePrinter());

/// Connects PowerSync to the backend:
/// - fetchCredentials: provides JWT for PowerSync Service auth
/// - uploadData: sends offline mutations to NestJS API
class CrmPowerSyncConnector extends PowerSyncBackendConnector {
  CrmPowerSyncConnector();

  @override
  Future<PowerSyncCredentials?> fetchCredentials() async {
    var token = await SecureStorage.getAccessToken();
    if (token == null) return null;

    // Check if token is expired or about to expire (within 30s)
    if (_isTokenExpired(token)) {
      token = await _refreshToken();
      if (token == null) return null;
    }

    return PowerSyncCredentials(
      endpoint: Env.powerSyncUrl,
      token: token,
    );
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
  /// Sends each operation to the NestJS API.
  @override
  Future<void> uploadData(PowerSyncDatabase database) async {
    final tx = await database.getCrudBatch();
    if (tx == null) return;

    final dio = createApiClient();

    for (final op in tx.crud) {
      try {
        final table = op.table;
        final data = op.opData;

        if (table == 'EntityData') {
          switch (op.op) {
            case UpdateType.put:
              // Create new record
              final entitySlug = data?['entitySlug'] as String?;
              if (entitySlug != null) {
                await dio.post('/data/$entitySlug', data: data);
              }
              break;
            case UpdateType.patch:
              // Update existing record
              final entitySlug = data?['entitySlug'] as String?;
              if (entitySlug != null) {
                await dio.patch('/data/$entitySlug/${op.id}', data: data);
              }
              break;
            case UpdateType.delete:
              // Delete record
              final entitySlug = data?['entitySlug'] as String?;
              if (entitySlug != null) {
                await dio.delete('/data/$entitySlug/${op.id}');
              }
              break;
          }
        } else if (table == 'Notification') {
          // Mark notification as read
          if (op.op == UpdateType.patch) {
            await dio.patch('/notifications/${op.id}/read');
          }
        }
      } catch (e) {
        _logger.e('Failed to upload mutation: ${op.table} ${op.op}', error: e);
        // Check if it's a client error (4xx) - skip and continue
        // For server errors (5xx) or network errors - rethrow to retry later
        if (e is DioException &&
            e.response?.statusCode != null &&
            e.response!.statusCode! >= 400 &&
            e.response!.statusCode! < 500) {
          _logger.w('Skipping failed mutation (client error ${e.response!.statusCode})');
          continue;
        }
        rethrow;
      }
    }

    await tx.complete();
  }
}
