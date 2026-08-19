import 'package:flutter/material.dart';
import 'package:crm_mobile/core/theme/app_colors_extension.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';

/// Composer do chat: campo de texto + botao enviar, com deteccao de `/comando`.
/// Ao digitar `/` no inicio, filtra `commands` (do canal) e mostra um seletor
/// acima do campo; escolher um comando limpa o texto e dispara onCommandSelected.
class MessageComposer extends StatefulWidget {
  const MessageComposer({
    super.key,
    required this.onSend,
    this.commands = const [],
    this.onCommandSelected,
  });

  /// Chamado ao enviar texto nao-vazio.
  final Future<void> Function(String text) onSend;

  /// Comandos disponiveis no canal (para o seletor de `/`).
  final List<Map<String, dynamic>> commands;

  /// Chamado ao escolher um comando no seletor.
  final void Function(Map<String, dynamic> command)? onCommandSelected;

  @override
  State<MessageComposer> createState() => _MessageComposerState();
}

class _MessageComposerState extends State<MessageComposer> {
  final _controller = TextEditingController();
  bool _canSend = false;
  String _slashQuery = ''; // != null-vazio => seletor aberto

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onChanged);
  }

  void _onChanged() {
    final text = _controller.text;
    final can = text.trim().isNotEmpty;
    // Seletor de comando: texto comeca com '/' e nao tem espaco ainda.
    final isSlash = text.startsWith('/') && !text.contains(' ');
    final q = isSlash ? text.substring(1).toLowerCase() : '';
    if (can != _canSend || q != _slashQuery) {
      setState(() {
        _canSend = can;
        _slashQuery = isSlash ? (q.isEmpty ? ' ' : q) : '';
      });
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    if (text.isEmpty) return;
    _controller.clear();
    await widget.onSend(text);
  }

  List<Map<String, dynamic>> get _filtered {
    if (_slashQuery.isEmpty) return const [];
    final q = _slashQuery.trim();
    return widget.commands.where((c) {
      final slug = (c['slug'] as String?)?.toLowerCase() ?? '';
      final name = (c['name'] as String?)?.toLowerCase() ?? '';
      return q.isEmpty || slug.contains(q) || name.contains(q);
    }).toList();
  }

  void _pickCommand(Map<String, dynamic> c) {
    _controller.clear();
    setState(() => _slashQuery = '');
    widget.onCommandSelected?.call(c);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final theme = Theme.of(context);
    final picker = _filtered;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (_slashQuery.isNotEmpty && picker.isNotEmpty)
          Container(
            constraints: const BoxConstraints(maxHeight: 220),
            margin: const EdgeInsets.fromLTRB(8, 0, 8, 4),
            decoration: BoxDecoration(
              color: colors.card,
              border: Border.all(color: colors.border),
              borderRadius: BorderRadius.circular(10),
            ),
            child: ListView.separated(
              shrinkWrap: true,
              padding: EdgeInsets.zero,
              itemCount: picker.length,
              separatorBuilder: (_, __) => Divider(height: 1, color: colors.border),
              itemBuilder: (_, i) {
                final c = picker[i];
                return ListTile(
                  dense: true,
                  leading: const Icon(Icons.bolt, size: 18),
                  title: Text('/${c['slug']}',
                      style: AppTypography.bodyMedium
                          .copyWith(fontWeight: FontWeight.w600),),
                  subtitle: (c['description'] as String?)?.isNotEmpty ?? false
                      ? Text(c['description'] as String,
                          maxLines: 1, overflow: TextOverflow.ellipsis,)
                      : null,
                  onTap: () => _pickCommand(c),
                );
              },
            ),
          ),
        SafeArea(
          top: false,
          child: Container(
            padding: const EdgeInsets.fromLTRB(8, 6, 8, 6),
            decoration: BoxDecoration(
              color: colors.card,
              border: Border(top: BorderSide(color: colors.border)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: TextField(
                    controller: _controller,
                    minLines: 1,
                    maxLines: 5,
                    textInputAction: TextInputAction.newline,
                    decoration: InputDecoration(
                      hintText: 'Mensagem ou /comando',
                      filled: true,
                      fillColor: colors.muted,
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 10,),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(22),
                        borderSide: BorderSide.none,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 6),
                Material(
                  color: _canSend
                      ? theme.colorScheme.primary
                      : colors.mutedForeground.withValues(alpha: 0.4),
                  shape: const CircleBorder(),
                  child: InkWell(
                    customBorder: const CircleBorder(),
                    onTap: _canSend ? _send : null,
                    child: Padding(
                      padding: const EdgeInsets.all(10),
                      child: Icon(Icons.send_rounded,
                          size: 20, color: theme.colorScheme.onPrimary,),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
