import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:crm_mobile/core/network/api_client.dart';

part 'auth_repository.g.dart';

/// Additional auth operations beyond login/register/logout
/// (which are handled in AuthProvider directly).
class AuthRepository {
  AuthRepository(this._dio);

  final Dio _dio;

  Future<void> updateProfile({
    required String name,
    String? avatar,
  }) async {
    await _dio.patch('/auth/profile', data: {
      'name': name,
      if (avatar != null) 'avatar': avatar,
    });
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    await _dio.post('/auth/change-password', data: {
      'currentPassword': currentPassword,
      'newPassword': newPassword,
    });
  }
}

@riverpod
AuthRepository authRepository(Ref ref) {
  return AuthRepository(ref.watch(apiClientProvider));
}
