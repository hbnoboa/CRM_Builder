// Resolve a URL de um arquivo (imagem/anexo) para uma URL ABSOLUTA carregavel.
//
// O backend grava/retorna o caminho RELATIVO do upload (ex.: `/uploads/<tenant>/
// data/<uuid>.jpg`) — tanto no upload mobile quanto no que vem da web. Para
// exibir no app precisamos resolver contra a ORIGEM da API (sem o sufixo
// `/api/v1`). URLs ja absolutas (http/https) passam inalteradas.

import 'package:crm_mobile/core/config/env.dart';

/// Retorna a URL absoluta para carregar o arquivo, ou `null` se vazia/invalida.
/// `local://...` (upload pendente) NAO e resolvido aqui — trate antes.
String? resolveFileUrl(String? url) {
  if (url == null || url.isEmpty) return null;
  if (RegExp(r'^https?://', caseSensitive: false).hasMatch(url)) return url;
  final base = Uri.tryParse(Env.apiUrl);
  if (base == null) return null;
  final path = url.startsWith('/') ? url : '/$url';
  // origem (scheme+host+porta) + caminho absoluto, descartando o `/api/v1`.
  return base.replace(path: path, query: null).toString();
}
