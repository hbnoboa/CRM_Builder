import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:crm_mobile/core/theme/app_colors_extension.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:crm_mobile/features/chat/widgets/chat_format.dart';

/// Balao de mensagem estilo WhatsApp. Roteia por `type`:
/// text | form_submission | query_result | report | bot | system.
class MessageBubble extends StatelessWidget {
  const MessageBubble({
    super.key,
    required this.message,
    required this.isMine,
    required this.firstOfGroup,
    this.senderName,
    this.highlighted = false,
  });

  final Map<String, dynamic> message;
  final bool isMine;
  final bool firstOfGroup;
  final String? senderName;

  /// Realce temporario apos "pular para" pela busca.
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final theme = Theme.of(context);
    final senderId = message['senderId'] as String?;
    final isBot = senderId == null;
    final type = (message['type'] as String?) ?? 'text';
    final created = parseTs(message['createdAt']);

    // Mensagens de sistema: centralizada, discreta.
    if (type == 'system') {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Center(
          child: Text(
            (message['content'] as String?) ?? '',
            style: AppTypography.caption.copyWith(color: colors.mutedForeground),
          ),
        ),
      );
    }

    final bubbleColor = isMine
        ? theme.colorScheme.primary
        : isBot
            ? colors.warning.withValues(alpha: 0.15)
            : colors.muted;
    final textColor =
        isMine ? theme.colorScheme.onPrimary : theme.colorScheme.onSurface;

    final content = _content(context, type, textColor);

    final bubble = Container(
      constraints: BoxConstraints(
        maxWidth: MediaQuery.of(context).size.width * 0.78,
      ),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: bubbleColor,
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(isMine ? 14 : 4),
          topRight: Radius.circular(isMine ? 4 : 14),
          bottomLeft: const Radius.circular(14),
          bottomRight: const Radius.circular(14),
        ),
        border: isBot
            ? Border.all(color: colors.warning.withValues(alpha: 0.4))
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (firstOfGroup && !isMine && (isBot || senderName != null))
            Padding(
              padding: const EdgeInsets.only(bottom: 2),
              child: Text(
                isBot ? 'Bot' : senderName!,
                style: AppTypography.caption.copyWith(
                  fontWeight: FontWeight.w600,
                  color: isBot
                      ? colors.warning
                      : HSLColor.fromAHSL(
                          1, hueFor(senderId).toDouble(), .55, .45,)
                          .toColor(),
                ),
              ),
            ),
          content,
          const SizedBox(height: 2),
          Text(
            hhmm(created),
            style: AppTypography.caption.copyWith(
              fontSize: 10,
              color: (isMine ? theme.colorScheme.onPrimary : colors.mutedForeground)
                  .withValues(alpha: 0.7),
            ),
          ),
        ],
      ),
    );

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      color: highlighted
          ? theme.colorScheme.primary.withValues(alpha: 0.12)
          : Colors.transparent,
      padding: EdgeInsets.only(
        top: firstOfGroup ? 8 : 2,
        left: 8,
        right: 8,
        bottom: 2,
      ),
      child: Row(
        mainAxisAlignment:
            isMine ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!isMine)
            Padding(
              padding: const EdgeInsets.only(right: 6, bottom: 2),
              child: firstOfGroup
                  ? CircleAvatar(
                      radius: 14,
                      backgroundColor: avatarColor(senderId),
                      child: Text(
                        isBot ? '🤖' : initials(senderName),
                        style: const TextStyle(
                            fontSize: 11, color: Colors.white,),
                      ),
                    )
                  : const SizedBox(width: 28),
            ),
          Flexible(child: bubble),
        ],
      ),
    );
  }

  Widget _content(BuildContext context, String type, Color textColor) {
    switch (type) {
      case 'form_submission':
        return _card(context, Icons.edit_note, message['content'] as String?);
      case 'query_result':
        return _card(context, Icons.table_chart_outlined,
            message['content'] as String?,);
      case 'report':
        return _reportCard(context);
      default:
        return Text(
          (message['content'] as String?) ?? '',
          style: AppTypography.bodyMedium.copyWith(color: textColor),
        );
    }
  }

  Widget _card(BuildContext context, IconData icon, String? label) {
    final colors = context.colors;
    Map<String, dynamic> meta = {};
    final raw = message['meta'];
    if (raw is String && raw.isNotEmpty) {
      try {
        meta = (jsonDecode(raw) as Map).cast<String, dynamic>();
      } catch (_) {}
    } else if (raw is Map) {
      meta = raw.cast<String, dynamic>();
    }
    final values = (meta['values'] as Map?)?.cast<String, dynamic>() ?? {};
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 16, color: colors.mutedForeground),
          const SizedBox(width: 4),
          Flexible(
            child: Text(
              label ?? meta['label']?.toString() ?? 'Registro',
              style: AppTypography.bodyMedium
                  .copyWith(fontWeight: FontWeight.w600),
            ),
          ),
        ],),
        if (values.isNotEmpty) const SizedBox(height: 4),
        ...values.entries.take(6).map(
              (e) => Text(
                '${e.key}: ${e.value}',
                style: AppTypography.caption
                    .copyWith(color: colors.mutedForeground),
              ),
            ),
      ],
    );
  }

  Widget _reportCard(BuildContext context) {
    final colors = context.colors;
    Map<String, dynamic> meta = {};
    final raw = message['meta'];
    if (raw is String && raw.isNotEmpty) {
      try {
        meta = (jsonDecode(raw) as Map).cast<String, dynamic>();
      } catch (_) {}
    } else if (raw is Map) {
      meta = raw.cast<String, dynamic>();
    }
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(Icons.download_rounded, size: 18, color: colors.info),
      const SizedBox(width: 6),
      Flexible(
        child: Text(
          meta['filename']?.toString() ??
              (message['content'] as String?) ??
              'Relatório',
          style: AppTypography.bodyMedium,
        ),
      ),
    ],);
  }
}
