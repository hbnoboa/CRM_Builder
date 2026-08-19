import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:crm_mobile/core/auth/auth_provider.dart';
import 'package:crm_mobile/core/theme/app_colors_extension.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:crm_mobile/features/chat/data/chat_repository.dart';
import 'package:crm_mobile/features/chat/providers/chat_providers.dart';
import 'package:crm_mobile/features/chat/widgets/chat_format.dart';
import 'package:crm_mobile/features/chat/widgets/command_sheet.dart';
import 'package:crm_mobile/features/chat/widgets/message_bubble.dart';
import 'package:crm_mobile/features/chat/widgets/message_composer.dart';

/// Conversa de um canal: mensagens (offline via PowerSync) + composer + busca.
class ChatDetailPage extends ConsumerStatefulWidget {
  const ChatDetailPage({super.key, required this.channelId});

  final String channelId;

  @override
  ConsumerState<ChatDetailPage> createState() => _ChatDetailPageState();
}

class _ChatDetailPageState extends ConsumerState<ChatDetailPage> {
  // Janela ampla: o historico ja esta 100% local (sync sem LIMIT), entao
  // carregar bastante barato viabiliza o "pular para" da busca.
  static const _window = 500;

  final _scrollCtrl = ScrollController();
  final _searchCtrl = TextEditingController();
  final Map<String, GlobalKey> _keys = {};

  bool _searching = false;
  bool _searchLoading = false;
  List<Map<String, dynamic>> _results = const [];
  String? _highlightId;

  @override
  void dispose() {
    _scrollCtrl.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  GlobalKey _keyFor(String id) => _keys.putIfAbsent(id, () => GlobalKey());

  Future<void> _runSearch(String q) async {
    final term = q.trim();
    if (term.length < 2) {
      setState(() => _results = const []);
      return;
    }
    setState(() => _searchLoading = true);
    try {
      final hits =
          await ref.read(chatRepositoryProvider).searchMessages(widget.channelId, term);
      if (mounted) setState(() => _results = hits);
    } finally {
      if (mounted) setState(() => _searchLoading = false);
    }
  }

  /// Sai da busca e rola ate a mensagem, realçando-a por instantes.
  void _jumpTo(String messageId, List<Map<String, dynamic>> msgs) {
    setState(() {
      _searching = false;
      _results = const [];
      _searchCtrl.clear();
      _highlightId = messageId;
    });
    final idx = msgs.indexWhere((m) => m['id'] == messageId);
    if (idx < 0) return;
    // Estimativa (lista reverse: offset 0 = mais recente) + ensureVisible fino.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollCtrl.hasClients && msgs.isNotEmpty) {
        final frac = idx / msgs.length;
        _scrollCtrl.jumpTo((frac * _scrollCtrl.position.maxScrollExtent)
            .clamp(0.0, _scrollCtrl.position.maxScrollExtent),);
      }
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final ctx = _keys[messageId]?.currentContext;
        if (ctx != null) {
          Scrollable.ensureVisible(ctx,
              alignment: 0.3, duration: const Duration(milliseconds: 300),);
        }
      });
    });
    // Remove o realce depois de um tempo.
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted && _highlightId == messageId) {
        setState(() => _highlightId = null);
      }
    });
  }

  Future<void> _renameChannel(String current) async {
    final ctrl = TextEditingController(text: current);
    final messenger = ScaffoldMessenger.of(context);
    final name = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Renomear canal'),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          decoration: const InputDecoration(hintText: 'Nome do canal'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(ctrl.text.trim()),
            child: const Text('Salvar'),
          ),
        ],
      ),
    );
    if (name == null || name.isEmpty || name == current) return;
    try {
      await ref.read(chatRepositoryProvider).renameChannel(widget.channelId, name);
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text('Erro ao renomear: $e')));
    }
  }

  Future<void> _deleteChannel() async {
    final messenger = ScaffoldMessenger.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Excluir canal'),
        content: const Text(
            'Excluir este canal? O historico e preservado, mas ele some da lista.',),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancelar'),
          ),
          TextButton(
            style: TextButton.styleFrom(
                foregroundColor: context.colors.destructive,),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Excluir'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(chatRepositoryProvider).deleteChannel(widget.channelId);
      if (mounted) context.pop();
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text('Erro ao excluir: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final messagesAsync =
        ref.watch(chatMessagesProvider(widget.channelId, limit: _window));
    final currentUserId = ref.watch(authProvider).user?.id ?? '';
    final commands =
        ref.watch(chatCommandsProvider(widget.channelId)).valueOrNull ?? const [];

    final channel = ref.watch(chatChannelsProvider).maybeWhen(
          data: (chs) => chs.firstWhere(
            (e) => e['id'] == widget.channelId,
            orElse: () => const <String, dynamic>{},
          ),
          orElse: () => const <String, dynamic>{},
        );
    final chName = (channel['name'] as String?)?.trim();
    final title = (chName != null && chName.isNotEmpty) ? chName : 'Chat';
    final iCreated = channel['createdById'] == currentUserId;

    return Scaffold(
      appBar: AppBar(
        title: _searching
            ? TextField(
                controller: _searchCtrl,
                autofocus: true,
                decoration: const InputDecoration(
                  hintText: 'Buscar nas mensagens…',
                  border: InputBorder.none,
                ),
                onChanged: _runSearch,
                textInputAction: TextInputAction.search,
              )
            : Text(title),
        actions: [
          IconButton(
            icon: Icon(_searching ? Icons.close : Icons.search),
            tooltip: _searching ? 'Fechar busca' : 'Buscar',
            onPressed: () => setState(() {
              _searching = !_searching;
              if (!_searching) {
                _searchCtrl.clear();
                _results = const [];
              }
            }),
          ),
          if (!_searching && iCreated)
            PopupMenuButton<String>(
              onSelected: (v) {
                if (v == 'rename') _renameChannel(title);
                if (v == 'delete') _deleteChannel();
              },
              itemBuilder: (_) => const [
                PopupMenuItem(value: 'rename', child: Text('Renomear')),
                PopupMenuItem(value: 'delete', child: Text('Excluir canal')),
              ],
            ),
        ],
      ),
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
                if (_searching) return _searchPanel(msgs, colors);
                if (msgs.isEmpty) {
                  return Center(
                    child: Text('Sem mensagens ainda',
                        style: TextStyle(color: colors.mutedForeground),),
                  );
                }
                return ListView.builder(
                  controller: _scrollCtrl,
                  reverse: true,
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  itemCount: msgs.length,
                  itemBuilder: (context, i) {
                    final m = msgs[i];
                    final id = m['id'] as String? ?? '$i';
                    final older = i + 1 < msgs.length ? msgs[i + 1] : null;
                    final cur = parseTs(m['createdAt']);
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
                      key: _keyFor(id),
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (showDivider) _DateDivider(cur),
                        MessageBubble(
                          message: m,
                          isMine: m['senderId'] == currentUserId,
                          firstOfGroup: firstOfGroup,
                          highlighted: id == _highlightId,
                        ),
                      ],
                    );
                  },
                );
              },
            ),
          ),
          if (!_searching)
            MessageComposer(
              commands: commands,
              onSend: (text) async {
                final repo = ref.read(chatRepositoryProvider);
                // "@bot ..." pergunta ao bot (read-only); resposta volta pelo sync.
                if (RegExp(r'^@bot\b', caseSensitive: false).hasMatch(text)) {
                  await repo.askBot(widget.channelId, text);
                } else {
                  await repo.sendText(widget.channelId, text);
                }
              },
              onCommandSelected: (command) {
                CommandSheet.show(context, widget.channelId, command);
              },
            ),
        ],
      ),
    );
  }

  Widget _searchPanel(List<Map<String, dynamic>> msgs, dynamic colors) {
    if (_searchLoading) {
      return const Center(child: CircularProgressIndicator());
    }
    final term = _searchCtrl.text.trim();
    if (term.length < 2) {
      return Center(
        child: Text('Digite ao menos 2 caracteres',
            style: TextStyle(color: colors.mutedForeground),),
      );
    }
    if (_results.isEmpty) {
      return Center(
        child: Text('Nenhuma mensagem encontrada',
            style: TextStyle(color: colors.mutedForeground),),
      );
    }
    return ListView.separated(
      itemCount: _results.length,
      separatorBuilder: (_, __) => Divider(height: 1, color: colors.border),
      itemBuilder: (_, i) {
        final r = _results[i];
        final id = r['id'] as String? ?? '';
        final content = (r['content'] as String?) ?? '';
        final loaded = msgs.any((m) => m['id'] == id);
        return ListTile(
          dense: true,
          title: _highlightedText(content, term, colors),
          subtitle: Text(
            '${dayLabel(parseTs(r['createdAt']))} · ${hhmm(parseTs(r['createdAt']))}'
            '${loaded ? '' : '  (fora da janela)'}',
            style: AppTypography.caption.copyWith(color: colors.mutedForeground),
          ),
          onTap: loaded ? () => _jumpTo(id, msgs) : null,
        );
      },
    );
  }

  Widget _highlightedText(String content, String term, dynamic colors) {
    final lc = content.toLowerCase();
    final lt = term.toLowerCase();
    final idx = lc.indexOf(lt);
    if (idx < 0) {
      return Text(content, maxLines: 2, overflow: TextOverflow.ellipsis);
    }
    return RichText(
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
      text: TextSpan(
        style: AppTypography.bodyMedium.copyWith(color: colors.foreground),
        children: [
          TextSpan(text: content.substring(0, idx)),
          TextSpan(
            text: content.substring(idx, idx + term.length),
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          TextSpan(text: content.substring(idx + term.length)),
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
