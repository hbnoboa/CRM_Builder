import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:uuid/uuid.dart';
import 'package:crm_mobile/core/auth/secure_storage.dart';
import 'package:crm_mobile/core/database/app_database.dart';
import 'package:crm_mobile/core/network/api_client.dart';

part 'chat_repository.g.dart';

const _uuid = Uuid();

/// Repositorio do chat — offline-first via PowerSync (espelha DataRepository).
///
/// Leituras: SQLite local (streams reativos). O PowerSync sincroniza TODO o
/// historico dos canais acessiveis (buckets de mensagem sem LIMIT) -> paginacao
/// e local. Envio de TEXTO: insert local otimista -> uploadData -> POST.
/// Comandos/consultas/busca: Dio direto (o servidor cria registro + card, que
/// volta pelo sync). Lista de canais: hibrida (cache local + GET hidratado).
class ChatRepository {
  ChatRepository(this._dio);

  final Dio _dio;

  // ═══════════════════════════════════════════════════════
  // LOCAL READS (PowerSync SQLite)
  // ═══════════════════════════════════════════════════════

  /// Canais visiveis (cache local do PowerSync). Ordena por atividade recente.
  Stream<List<Map<String, dynamic>>> watchChannels() {
    final db = AppDatabase.instance.db;
    return db.watch(
      'SELECT * FROM Channel WHERE deletedAt IS NULL ORDER BY updatedAt DESC',
    );
  }

  /// Mensagens de um canal (mais recentes primeiro; a UI inverte). `limit`
  /// cresce para paginar o historico — que ja esta 100% local via sync.
  Stream<List<Map<String, dynamic>>> watchMessages(
    String channelId, {
    int limit = 50,
  }) {
    final db = AppDatabase.instance.db;
    return db.watch(
      'SELECT * FROM Message WHERE channelId = ? ORDER BY createdAt DESC LIMIT ?',
      parameters: [channelId, limit],
    );
  }

  /// Total de mensagens do canal (para saber se ha mais a paginar).
  Future<int> messageCount(String channelId) async {
    final db = AppDatabase.instance.db;
    final rows = await db.getAll(
      'SELECT COUNT(*) AS n FROM Message WHERE channelId = ?',
      [channelId],
    );
    return (rows.first['n'] as int?) ?? 0;
  }

  Future<Map<String, dynamic>?> getChannel(String channelId) async {
    final db = AppDatabase.instance.db;
    final rows = await db.getAll(
      'SELECT * FROM Channel WHERE id = ?',
      [channelId],
    );
    return rows.isEmpty ? null : rows.first;
  }

  /// Membros de um canal (para nome do "outro" na DM / avatares).
  Future<List<Map<String, dynamic>>> channelMembers(String channelId) async {
    final db = AppDatabase.instance.db;
    return db.getAll(
      'SELECT * FROM ChannelMember WHERE channelId = ?',
      [channelId],
    );
  }

  /// Definicoes de campo de uma entidade (do Entity local sincronizado). Usado
  /// pelo formulario dinamico do comando (reusa DynamicFieldInput).
  Future<List<dynamic>> entityFields(String slug) async {
    final db = AppDatabase.instance.db;
    final rows =
        await db.getAll('SELECT fields FROM Entity WHERE slug = ?', [slug]);
    if (rows.isEmpty) return const [];
    final raw = rows.first['fields'];
    if (raw is String && raw.isNotEmpty) {
      try {
        return jsonDecode(raw) as List<dynamic>;
      } catch (_) {}
    }
    return const [];
  }

  // ═══════════════════════════════════════════════════════
  // LOCAL WRITE (otimista) — TEXTO
  // ═══════════════════════════════════════════════════════

  /// Envia texto: insere localmente (aparece na hora) e o PowerSync enfileira
  /// -> uploadData -> POST /chat/channels/:id/messages (com este id, upsert
  /// idempotente). Retorna o id da mensagem criada.
  Future<String> sendText(String channelId, String content) async {
    final text = content.trim();
    if (text.isEmpty) return '';
    final db = AppDatabase.instance.db;
    final id = _uuid.v4();
    final now = DateTime.now().toIso8601String();
    final tenantId = await _getTenantId();
    final userId = await _getCurrentUserId();
    await db.execute(
      'INSERT INTO Message (id, tenantId, channelId, senderId, type, content, meta, createdAt) '
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, tenantId, channelId, userId, 'text', text, null, now],
    );
    return id;
  }

  // ═══════════════════════════════════════════════════════
  // API (Dio) — lista hidratada, comandos, busca, execucao
  // ═══════════════════════════════════════════════════════

  /// Lista de canais hidratada do servidor ({ groups, threads, dms } achatado
  /// com `kind`). Traz nome do "outro" no DM, unread, meta da entidade.
  Future<List<Map<String, dynamic>>> fetchChannels() async {
    final r = await _dio.get<Map<String, dynamic>>('/chat/channels');
    final data = r.data ?? {};
    final out = <Map<String, dynamic>>[];
    for (final kind in const ['groups', 'threads', 'dms']) {
      for (final c in (data[kind] as List? ?? [])) {
        out.add({...(c as Map).cast<String, dynamic>(), 'kind': kind});
      }
    }
    return out;
  }

  /// Abre (ou encontra) o chat de um registro. Online: o servidor confirma que
  /// o usuario ENXERGA o registro (canRead + scope + dataFilters) e devolve o
  /// canal; a linha do Channel volta pelo PowerSync. Retorna o channelId.
  Future<String?> openRecordChannel(String entitySlug, String recordId) async {
    final r = await _dio.post<Map<String, dynamic>>(
      '/chat/channels/record/$entitySlug/$recordId',
    );
    return r.data?['id'] as String?;
  }

  /// Renomeia o canal (backend valida: criador do canal ou quem gerencia chat).
  Future<void> renameChannel(String channelId, String name) async {
    await _dio.patch('/chat/channels/$channelId', data: {'name': name});
  }

  /// Exclui o canal (soft-delete no servidor; some da lista via sync).
  Future<void> deleteChannel(String channelId) async {
    await _dio.delete('/chat/channels/$channelId');
  }

  /// Comandos disponiveis no canal (filtrados por permissao no servidor).
  Future<List<Map<String, dynamic>>> fetchCommands(String channelId) async {
    final r = await _dio.get<List<dynamic>>(
      '/chat/commands',
      queryParameters: {'channelId': channelId},
    );
    return (r.data ?? []).map((e) => (e as Map).cast<String, dynamic>()).toList();
  }

  /// Autocomplete de registros (pai/alvo de comando).
  Future<List<Map<String, dynamic>>> searchRecords(
    String entitySlug,
    String q, {
    String? parentId,
  }) async {
    final r = await _dio.get<List<dynamic>>(
      '/chat/search',
      queryParameters: {
        'entitySlug': entitySlug,
        'q': q,
        if (parentId != null) 'parentId': parentId,
      },
    );
    return (r.data ?? []).map((e) => (e as Map).cast<String, dynamic>()).toList();
  }

  /// Busca no historico do canal (trigram/unaccent — feito no Postgres).
  Future<List<Map<String, dynamic>>> searchMessages(
    String channelId,
    String q,
  ) async {
    final r = await _dio.get<List<dynamic>>(
      '/chat/channels/$channelId/messages/search',
      queryParameters: {'q': q},
    );
    return (r.data ?? []).map((e) => (e as Map).cast<String, dynamic>()).toList();
  }

  /// Executa um comando-formulario (create_record/update_record). Online: o
  /// servidor cria o registro + posta o card, que chega pelo sync.
  Future<Map<String, dynamic>> runCommand(
    String channelId,
    String slug, {
    Map<String, dynamic> values = const {},
    String? recordId,
    String? parentRecordId,
  }) async {
    final r = await _dio.post<Map<String, dynamic>>(
      '/chat/channels/$channelId/commands/$slug',
      data: {
        'values': values,
        if (recordId != null) 'recordId': recordId,
        if (parentRecordId != null) 'parentRecordId': parentRecordId,
      },
    );
    return r.data ?? {};
  }

  /// Executa uma consulta/relatorio (card ou arquivo).
  Future<Map<String, dynamic>> runQuery(
    String channelId,
    String slug, {
    List<Map<String, dynamic>> filters = const [],
    String format = 'card',
    String? pdfTemplateId,
    String? scopeParentId,
  }) async {
    final r = await _dio.post<Map<String, dynamic>>(
      '/chat/channels/$channelId/query/$slug',
      data: {
        'filters': filters,
        'format': format,
        if (pdfTemplateId != null) 'pdfTemplateId': pdfTemplateId,
        if (scopeParentId != null) 'scopeParentId': scopeParentId,
      },
    );
    return r.data ?? {};
  }

  // ═══════════════════════════════════════════════════════
  // Helpers (id do tenant/usuario a partir do token)
  // ═══════════════════════════════════════════════════════

  Future<String> _getTenantId() async {
    final selected = await SecureStorage.getSelectedTenantId();
    if (selected != null && selected.isNotEmpty) return selected;
    return (await _claim('tenantId')) ?? '';
  }

  Future<String?> _getCurrentUserId() async => _claim('sub');

  Future<String?> _claim(String key) async {
    final token = await SecureStorage.getAccessToken();
    if (token == null) return null;
    try {
      final parts = token.split('.');
      if (parts.length != 3) return null;
      final payload =
          utf8.decode(base64Url.decode(base64Url.normalize(parts[1])));
      final map = jsonDecode(payload) as Map<String, dynamic>;
      return map[key] as String?;
    } catch (_) {
      return null;
    }
  }
}

@riverpod
ChatRepository chatRepository(Ref ref) {
  return ChatRepository(ref.watch(apiClientProvider));
}
