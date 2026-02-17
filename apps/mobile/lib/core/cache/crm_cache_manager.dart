import 'package:flutter_cache_manager/flutter_cache_manager.dart';
import 'package:crm_mobile/core/auth/secure_storage.dart';
import 'package:crm_mobile/core/config/env.dart';

/// Custom cache manager for CRM images/files.
/// Long TTL (365 days), auth headers, max 1000 files.
class CrmCacheManager extends CacheManager with ImageCacheManager {

  factory CrmCacheManager() => _instance;

  CrmCacheManager._()
      : super(
          Config(
            key,
            stalePeriod: const Duration(days: 365),
            maxNrOfCacheObjects: 1000,
            fileService: _AuthenticatedHttpFileService(),
          ),
        );
  static const key = 'crmCacheManager';

  static final CrmCacheManager _instance = CrmCacheManager._();

  /// Clear all cached files.
  Future<void> clearCache() async {
    await emptyCache();
  }
}

/// HTTP file service that injects Authorization header for API URLs.
class _AuthenticatedHttpFileService extends HttpFileService {
  _AuthenticatedHttpFileService() : super();

  @override
  Future<FileServiceResponse> get(String url,
      {Map<String, String>? headers,}) async {
    final mergedHeaders = <String, String>{...?headers};

    // Only add auth header for our own API URLs
    if (url.startsWith(Env.apiUrl) || url.contains('/upload/')) {
      final token = await SecureStorage.getAccessToken();
      if (token != null) {
        mergedHeaders['Authorization'] = 'Bearer $token';
      }
    }

    return super.get(url, headers: mergedHeaders);
  }
}
