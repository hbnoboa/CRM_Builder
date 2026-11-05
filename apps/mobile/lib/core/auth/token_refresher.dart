import 'package:dio/dio.dart';
import 'package:crm_mobile/core/auth/secure_storage.dart';
import 'package:crm_mobile/core/config/env.dart';

/// Renovacao UNICA do token para o app todo (interceptor HTTP, PowerSync e
/// abertura do app). O refresh token e de uso unico e gira a cada renovacao:
/// duas renovacoes ao mesmo tempo faziam a segunda ser recusada e a sessao cair.
/// Quem chega enquanto uma renovacao esta em andamento espera a mesma.
class TokenRefresher {
  TokenRefresher._();

  static Future<String>? _inflight;

  /// Devolve o access token novo. Lanca o erro do servidor (ex.: SESSION_REVOKED)
  /// ou [StateError] se nao houver refresh token.
  static Future<String> refresh() {
    final running = _inflight;
    if (running != null) return running;
    final future = _doRefresh();
    _inflight = future;
    // Libera para a proxima renovacao quando esta terminar (com sucesso ou erro).
    future.then((_) {}, onError: (Object _) {}).whenComplete(() => _inflight = null);
    return future;
  }

  static Future<String> _doRefresh() async {
    final refreshToken = await SecureStorage.getRefreshToken();
    if (refreshToken == null) throw StateError('Sem refresh token');
    final dio = Dio(BaseOptions(baseUrl: Env.apiUrl));
    final response = await dio.post<Map<String, dynamic>>(
      '/auth/refresh',
      data: {'refreshToken': refreshToken},
    );
    final data = response.data ?? const <String, dynamic>{};
    final accessToken = data['accessToken'] as String;
    await SecureStorage.setTokens(
      accessToken: accessToken,
      refreshToken: data['refreshToken'] as String,
    );
    return accessToken;
  }
}
