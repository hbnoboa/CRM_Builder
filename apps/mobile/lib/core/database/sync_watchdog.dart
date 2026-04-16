import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:powersync/powersync.dart';
import 'package:crm_mobile/core/database/powersync_connector.dart';
import 'package:logger/logger.dart';

final _logger = Logger(printer: SimplePrinter());

/// Watchdog que monitora o status do sync stream e reconecta automaticamente
/// quando detecta que o stream travou (problema após editar registros).
///
/// Funciona verificando periodicamente se houve atividade de sync.
/// Se não houver atividade por [maxInactivityDuration], força reconexão.
class SyncWatchdog {
  SyncWatchdog({
    required this.database,
    this.checkInterval = const Duration(seconds: 30),
    this.maxInactivityDuration = const Duration(minutes: 2),
  });

  final PowerSyncDatabase database;
  final Duration checkInterval;
  final Duration maxInactivityDuration;

  Timer? _watchdogTimer;
  StreamSubscription? _statusSubscription;
  DateTime? _lastSyncActivity;
  bool _isReconnecting = false;
  SyncStatus? _lastStatus;

  /// Inicia o monitoramento
  void start() {
    if (_watchdogTimer != null) {
      _logger.w('Watchdog: já está rodando');
      return;
    }

    _logger.i('Watchdog: iniciando monitoramento (check: ${checkInterval.inSeconds}s, timeout: ${maxInactivityDuration.inMinutes}min)');
    _lastSyncActivity = DateTime.now();

    // Monitora mudanças no status do PowerSync
    _statusSubscription = database.statusStream.listen(
      _onStatusChange,
      onError: (error) {
        _logger.e('Watchdog: erro no statusStream', error: error);
      },
    );

    // Timer periódico para verificar inatividade
    _watchdogTimer = Timer.periodic(checkInterval, _checkHealth);
  }

  /// Para o monitoramento
  void stop() {
    _logger.i('Watchdog: parando monitoramento');
    _watchdogTimer?.cancel();
    _watchdogTimer = null;
    _statusSubscription?.cancel();
    _statusSubscription = null;
    _lastSyncActivity = null;
    _isReconnecting = false;
  }

  /// Callback quando o status do PowerSync muda
  void _onStatusChange(SyncStatus status) {
    _lastStatus = status;

    // Atualiza timestamp quando há atividade de sync
    if (status.connected || status.downloading || status.uploading) {
      _lastSyncActivity = DateTime.now();

      if (kDebugMode) {
        _logger.d('Watchdog: atividade detectada (connected: ${status.connected}, downloading: ${status.downloading}, uploading: ${status.uploading})');
      }
    }

    // Se estava reconectando e agora está conectado, resetar flag
    if (_isReconnecting && status.connected) {
      _logger.i('Watchdog: reconexão bem-sucedida');
      _isReconnecting = false;
    }
  }

  /// Verifica a saúde da conexão periodicamente
  void _checkHealth(Timer timer) async {
    // Não verificar se já está reconectando
    if (_isReconnecting) {
      return;
    }

    final now = DateTime.now();
    final lastActivity = _lastSyncActivity ?? now;
    final inactiveDuration = now.difference(lastActivity);

    if (kDebugMode) {
      _logger.d('Watchdog: última atividade há ${inactiveDuration.inSeconds}s');
    }

    // Se passou muito tempo sem atividade E está conectado mas não sincronizando
    // (indicador de stream travado), força reconexão
    if (inactiveDuration > maxInactivityDuration) {
      final isConnected = _lastStatus?.connected ?? false;
      final isSyncing = (_lastStatus?.downloading ?? false) ||
                        (_lastStatus?.uploading ?? false);

      if (isConnected && !isSyncing) {
        _logger.w('Watchdog: stream travado detectado (${inactiveDuration.inMinutes}min sem atividade)');
        await _forceReconnect();
      } else if (!isConnected) {
        _logger.i('Watchdog: desconectado, aguardando reconexão automática do SDK');
        // Reseta timestamp para não ficar triggering sempre
        _lastSyncActivity = now;
      }
    }
  }

  /// Força reconexão do PowerSync
  Future<void> _forceReconnect() async {
    if (_isReconnecting) {
      return;
    }

    _isReconnecting = true;
    _logger.i('Watchdog: forçando reconexão...');

    try {
      // Disconnect
      _logger.d('Watchdog: desconectando...');
      await database.disconnect();

      // Aguarda um pouco antes de reconectar
      await Future.delayed(const Duration(milliseconds: 500));

      // Reconnect com novo connector
      _logger.d('Watchdog: reconectando...');
      final connector = CrmPowerSyncConnector();
      await database.connect(connector: connector);

      _logger.i('Watchdog: reconexão iniciada');
      _lastSyncActivity = DateTime.now();
    } catch (e) {
      _logger.e('Watchdog: erro ao reconectar', error: e);
      _isReconnecting = false;

      // Reseta timestamp para tentar novamente no próximo ciclo
      _lastSyncActivity = DateTime.now();
    }
  }

  /// Getter para saber se está rodando
  bool get isRunning => _watchdogTimer?.isActive ?? false;

  /// Getter para última atividade (para debug/UI)
  DateTime? get lastSyncActivity => _lastSyncActivity;

  /// Getter para tempo desde última atividade
  Duration? get timeSinceLastActivity {
    final last = _lastSyncActivity;
    if (last == null) return null;
    return DateTime.now().difference(last);
  }
}
