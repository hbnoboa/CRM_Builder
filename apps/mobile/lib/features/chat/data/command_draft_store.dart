import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';

/// Persistencia LOCAL do rascunho de um comando (por canal + slug). Guarda o
/// que o usuario preencheu para que, ao sair do app e voltar (ou reabrir o
/// comando), nada se perca. Nao e sincronizado nem sensivel — um arquivo JSON
/// por rascunho em `command_drafts/`. O rascunho e apagado ao ENVIAR o comando,
/// ao descartar e no reset.
class CommandDraftStore {
  static Future<Directory> _dir() async {
    final base = await getApplicationDocumentsDirectory();
    final dir = Directory('${base.path}/command_drafts');
    if (!await dir.exists()) await dir.create(recursive: true);
    return dir;
  }

  static String _fileName(String channelId, String slug) {
    final safe =
        '${channelId}__$slug'.replaceAll(RegExp(r'[^A-Za-z0-9_.-]'), '_');
    return '$safe.json';
  }

  static Future<File> _file(String channelId, String slug) async =>
      File('${(await _dir()).path}/${_fileName(channelId, slug)}');

  static Future<void> save(
    String channelId,
    String slug,
    Map<String, dynamic> draft,
  ) async {
    try {
      final f = await _file(channelId, slug);
      await f.writeAsString(jsonEncode(draft));
    } catch (_) {}
  }

  static Future<Map<String, dynamic>?> load(
    String channelId,
    String slug,
  ) async {
    try {
      final f = await _file(channelId, slug);
      if (!await f.exists()) return null;
      final raw = await f.readAsString();
      if (raw.isEmpty) return null;
      return jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  static Future<void> clear(String channelId, String slug) async {
    try {
      final f = await _file(channelId, slug);
      if (await f.exists()) await f.delete();
    } catch (_) {}
  }
}
