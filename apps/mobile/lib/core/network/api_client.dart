import 'package:dio/dio.dart';
import 'package:crm_mobile/core/config/env.dart';
import 'package:crm_mobile/core/network/auth_interceptor.dart';
import 'package:crm_mobile/core/network/tenant_interceptor.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:logger/logger.dart';

part 'api_client.g.dart';

final _logger = Logger(printer: SimplePrinter());

/// Dio HTTP client configured to match web-admin's lib/api.ts.
/// - Base URL from environment
/// - Auth interceptor (JWT + auto-refresh)
/// - Tenant interceptor (cross-tenant for PLATFORM_ADMIN)
/// - Timeout configuration
Dio createApiClient() {
  final dio = Dio(
    BaseOptions(
      baseURL: Env.apiUrl,
      connectTimeout: const Duration(milliseconds: Env.apiTimeout),
      receiveTimeout: const Duration(milliseconds: Env.apiTimeout),
      headers: {
        'Content-Type': 'application/json',
      },
    ),
  );

  // Order matters: tenant first, then auth
  dio.interceptors.addAll([
    TenantInterceptor(),
    AuthInterceptor(dio),
    LogInterceptor(
      requestBody: true,
      responseBody: true,
      logPrint: (o) => _logger.d(o),
    ),
  ]);

  return dio;
}

@riverpod
Dio apiClient(Ref ref) {
  return createApiClient();
}
