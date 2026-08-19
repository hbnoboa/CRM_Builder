import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:crm_mobile/core/theme/app_colors_extension.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:crm_mobile/features/chat/providers/chat_providers.dart';

/// Lista de canais (cache local do PowerSync — offline-first).
class ChatListPage extends ConsumerWidget {
  const ChatListPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final channelsAsync = ref.watch(chatChannelsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Chat')),
      body: channelsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Text('Erro ao carregar canais: $e',
              style: TextStyle(color: colors.destructive),),
        ),
        data: (channels) {
          if (channels.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.forum_outlined,
                      size: 48, color: colors.mutedForeground,),
                  const SizedBox(height: 8),
                  Text('Nenhum canal ainda',
                      style: TextStyle(color: colors.mutedForeground),),
                ],
              ),
            );
          }
          return ListView.builder(
            itemCount: channels.length,
            itemBuilder: (context, i) => _ChannelTile(channel: channels[i]),
          );
        },
      ),
    );
  }
}

class _ChannelTile extends StatelessWidget {
  const _ChannelTile({required this.channel});

  final Map<String, dynamic> channel;

  IconData get _icon {
    switch (channel['type'] as String?) {
      case 'dm':
        return Icons.person_outline;
      case 'record':
        return Icons.description_outlined;
      default:
        return Icons.tag; // group
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final theme = Theme.of(context);
    final name = (channel['name'] as String?)?.trim();
    final type = channel['type'] as String?;
    final title = (name != null && name.isNotEmpty)
        ? name
        : (type == 'dm' ? 'Conversa' : 'Canal');
    return ListTile(
      leading: CircleAvatar(
        backgroundColor: theme.colorScheme.primary.withValues(alpha: 0.12),
        child: Icon(_icon, color: theme.colorScheme.primary, size: 20),
      ),
      title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
      subtitle: Text(
        type == 'record' ? 'Chat do registro' : (type == 'dm' ? 'Direta' : 'Tabela'),
        style: AppTypography.caption.copyWith(color: colors.mutedForeground),
      ),
      onTap: () => context.go('/chat/${channel['id']}'),
    );
  }
}
