import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:crm_mobile/features/chat/data/chat_repository.dart';

part 'chat_providers.g.dart';

/// Stream reativo dos canais visiveis (cache local do PowerSync).
@riverpod
Stream<List<Map<String, dynamic>>> chatChannels(Ref ref) {
  return ref.watch(chatRepositoryProvider).watchChannels();
}

/// Stream reativo das mensagens de um canal. O historico ja esta local (sync
/// sem LIMIT), entao paginar = aumentar `limit` deste family.
@riverpod
Stream<List<Map<String, dynamic>>> chatMessages(
  Ref ref,
  String channelId, {
  int limit = 100,
}) {
  return ref.watch(chatRepositoryProvider).watchMessages(channelId, limit: limit);
}

/// Comandos disponiveis no canal (Dio, online; filtrados por permissao).
@riverpod
Future<List<Map<String, dynamic>>> chatCommands(Ref ref, String channelId) {
  return ref.watch(chatRepositoryProvider).fetchCommands(channelId);
}

/// Lista de canais hidratada do servidor (unread, nome do "outro" no DM, etc.).
@riverpod
Future<List<Map<String, dynamic>>> chatChannelsHydrated(Ref ref) {
  return ref.watch(chatRepositoryProvider).fetchChannels();
}
