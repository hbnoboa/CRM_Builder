import 'package:flutter/material.dart';
import 'package:crm_mobile/core/theme/app_colors_extension.dart';

/// Composer do chat: campo de texto + botao enviar. (Deteccao de /comando
/// entra na Fase 3.)
class MessageComposer extends StatefulWidget {
  const MessageComposer({super.key, required this.onSend});

  /// Chamado ao enviar texto nao-vazio.
  final Future<void> Function(String text) onSend;

  @override
  State<MessageComposer> createState() => _MessageComposerState();
}

class _MessageComposerState extends State<MessageComposer> {
  final _controller = TextEditingController();
  bool _canSend = false;

  @override
  void initState() {
    super.initState();
    _controller.addListener(() {
      final can = _controller.text.trim().isNotEmpty;
      if (can != _canSend) setState(() => _canSend = can);
    });
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

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final theme = Theme.of(context);
    return SafeArea(
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
                  hintText: 'Mensagem',
                  filled: true,
                  fillColor: colors.muted,
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
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
    );
  }
}
