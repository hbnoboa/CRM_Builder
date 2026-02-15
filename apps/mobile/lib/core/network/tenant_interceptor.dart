import 'package:dio/dio.dart';
import 'package:crm_mobile/core/auth/secure_storage.dart';

/// Mirrors web-admin's api.ts tenant injection for PLATFORM_ADMIN.
/// Auto-injects selectedTenantId into query params and body.
class TenantInterceptor extends Interceptor {
  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final selectedTenantId = await SecureStorage.getSelectedTenantId();

    if (selectedTenantId != null) {
      // Add to query params (for GET, DELETE)
      options.queryParameters['tenantId'] ??= selectedTenantId;

      // Add to body (for POST, PUT, PATCH)
      final method = options.method.toUpperCase();
      if (method == 'POST' || method == 'PUT' || method == 'PATCH') {
        if (options.data is Map<String, dynamic>) {
          final data = options.data as Map<String, dynamic>;
          data['tenantId'] ??= selectedTenantId;
        }
      }
    }

    handler.next(options);
  }
}
