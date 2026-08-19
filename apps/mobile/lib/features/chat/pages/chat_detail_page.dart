import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:crm_mobile/core/auth/auth_provider.dart';
import 'package:crm_mobile/core/theme/app_colors_extension.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:crm_mobile/features/chat/data/chat_repository.dart';
import 'package:crm_mobile/features/chat/providers/chat_providers.dart';
import 'package:crm_mobile/features/chat/widgets/chat_format.dart';
import 'package:crm_mobile/features/chat/widgets/message_bubble.dart';
import 'package:crm_mobile/features/chat/widgets/message_composer.dart';

/// Conversa de um canal: mensagens (offline via PowerSync) + composer.
class ChatDetailPage extends ConsumerWidget {
  const ChatDetailPage({super.key, required this.channelId});

  final String channelId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final messagesAsync = ref.watch(chatMessagesProvider(channelId));
    final currentUserId = ref.watch(authProvider).user?.id ?? '';

    // Nome do canal a partir da lista ja carregada (cache local).
    final title = ref.watch(chatChannelsProvider).maybeWhen(
          data: (chs) {
            final c = chs.firstWhere(
              (e) => e['id'] == channelId,
              orElse: () => const <String, dynamic>{},
            );
            final n = (c['name'] as String?)?.trim();
            return (n != null && n.isNotEmpty) ? n : 'Chat';
          },
          orElse: () => 'Chat',
        );

    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Column(
        children: [
          Expanded(
            child: messagesAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(
                child: Text('Erro: $e',
                    style: TextStyle(color: colors.destructive),),
              ),
              data: (msgs) {
                if (msgs.isEmpty) {
                  return Center(
                    child: Text('Sem mensagens ainda',
                        style: TextStyle(color: colors.mutedForeground),),
                  );
                }
                // msgs em DESC (mais recente primeiro) -> reverse:true poe o
                // mais recente embaixo. O "vizinho mais antigo" e msgs[i+1].
                return ListView.builder(
                  reverse: true,
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  itemCount: msgs.length,
                  itemBuilder: (context, i) {
                    final m = msgs[i];
                    final older = i + 1 < msgs.length ? msgs[i + 1] : null;
                    final cur = parseTs(m['createdAt']);
                    // older != null nos termos abaixo (short-circuit por `older == null`).
                    final showDivider = older == null ||
                        !isSameDay(cur, parseTs(older['createdAt']));
                    final firstOfGroup = older == null ||
                        older['senderId'] != m['senderId'] ||
                        showDivider ||
                        cur
                                .difference(parseTs(older['createdAt']))
                                .inMinutes
                                .abs() >
                            5;
                    return Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (showDivider) _DateDivider(cur),
                        MessageBubble(
                          message: m,
                          isMine: m['senderId'] == currentUserId,
                          firstOfGroup: firstOfGroup,
                        ),
                      ],
                    );
                  },
                );
              },
            ),
          ),
          MessageComposer(
            onSend: (text) async {
              await ref.read(chatRepositoryProvider).sendText(channelId, text);
            },
          ),
        ],
      ),
    );
  }
}

class _DateDivider extends StatelessWidget {
  const _DateDivider(this.date);
  final DateTime date;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
          decoration: BoxDecoration(
            color: colors.muted,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Text(
            dayLabel(date),
            style: AppTypography.caption.copyWith(color: colors.mutedForeground),
          ),
        ),
      ),
    );
  }
}
