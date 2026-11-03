import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:crm_mobile/core/push/push_notification_service.dart';

/// Por que a sessao foi encerrada pela API (nao pelo usuario).
enum SessionEndReason { tenantSuspended, mobileDisabled }

/// Erros de negocio do plano/empresa que a API devolve no campo `code`
/// (mesmos codigos que o web-admin trata em lib/api.ts):
/// - TENANT_SUSPENDED: empresa suspensa/cancelada pelo console da plataforma
/// - FEATURE_DISABLED: funcao fora do plano (feature 'mobile' = app inteiro)
/// - PLAN_LIMIT: limite de usuarios/registros/armazenamento atingido
class PlanErrors {
  PlanErrors._();

  static final _sessionEnded = StreamController<SessionEndReason>.broadcast();

  /// O AuthNotifier escuta e faz o logout completo com a mensagem certa.
  static Stream<SessionEndReason> get sessionEnded => _sessionEnded.stream;

  static Map<dynamic, dynamic>? _data(Object error) {
    if (error is! DioException) return null;
    final data = error.response?.data;
    return data is Map ? data : null;
  }

  static String? code(Object error) => _data(error)?['code'] as String?;

  /// Mensagem da API (ou [fallback]) — nunca o toString() cru do DioException.
  static String message(Object error, String fallback) {
    final message = _data(error)?['message'];
    return message is String && message.isNotEmpty ? message : fallback;
  }

  /// Chamado pelo AuthInterceptor em toda resposta de erro.
  static void handle(DioException err) {
    if (err.response?.statusCode != 403) return;
    final data = _data(err);
    switch (data?['code']) {
      case 'TENANT_SUSPENDED':
        _sessionEnded.add(SessionEndReason.tenantSuspended);
      case 'FEATURE_DISABLED':
        if (data?['feature'] == 'mobile') {
          _sessionEnded.add(SessionEndReason.mobileDisabled);
        }
    }
  }

  /// Erro de plano que faz o servidor recusar uma mudanca feita offline.
  static bool isPlanRejection(Object error) {
    final c = code(error);
    return c == 'PLAN_LIMIT' || c == 'FEATURE_DISABLED';
  }

  static String sessionEndMessage(SessionEndReason reason) {
    switch (reason) {
      case SessionEndReason.tenantSuspended:
        return 'O acesso desta empresa está suspenso. Fale com o administrador ou com o suporte.';
      case SessionEndReason.mobileDisabled:
        return 'O app mobile não está incluído no plano da sua empresa. Use o sistema pelo navegador.';
    }
  }

  /// Aviso global (fora de qualquer tela), ex.: sincronizacao em segundo plano.
  static void showSnack(String text) {
    PushNotificationService.scaffoldMessengerKey.currentState?.showSnackBar(
      SnackBar(content: Text(text), duration: const Duration(seconds: 6)),
    );
  }
}
