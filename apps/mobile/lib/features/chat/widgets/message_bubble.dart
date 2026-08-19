import 'dart:convert';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:crm_mobile/core/config/env.dart';
import 'package:crm_mobile/core/theme/app_colors_extension.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:crm_mobile/features/chat/widgets/chat_format.dart';

/// Resolve uma URL de arquivo relativa (/uploads/...) contra a ORIGEM da API.
Uri? resolveReportUrl(String url) {
  if (url.isEmpty) return null;
  if (RegExp(r'^https?://', caseSensitive: false).hasMatch(url)) {
    return Uri.tryParse(url);
  }
  final base = Uri.tryParse(Env.apiUrl);
  if (base == null) return null;
  return base.replace(path: url, query: null); // origem + caminho absoluto
}

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

    // Cards de comando (form/consulta/relatorio) tem fundo neutro proprio, para
    // ficarem legiveis mesmo quando o autor e o proprio usuario (balao primario).
    final isCard = type == 'form_submission' ||
        type == 'query_result' ||
        type == 'report';
    final bubbleColor = isCard
        ? theme.colorScheme.surface
        : isMine
            ? theme.colorScheme.primary
            : isBot
                ? colors.warning.withValues(alpha: 0.15)
                : colors.muted;
    final onLight = isCard || !isMine;
    final textColor =
        onLight ? theme.colorScheme.onSurface : theme.colorScheme.onPrimary;

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
        border: isCard
            ? Border.all(color: colors.border)
            : isBot
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
              color: (onLight ? colors.mutedForeground : theme.colorScheme.onPrimary)
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
        return _card(context, Icons.assignment_turned_in_outlined);
      case 'query_result':
        return _card(context, Icons.table_chart_outlined);
      case 'report':
        return _reportCard(context);
      default:
        return Text(
          (message['content'] as String?) ?? '',
          style: AppTypography.bodyMedium.copyWith(color: textColor),
        );
    }
  }

  Map<String, dynamic> _meta() {
    final raw = message['meta'];
    if (raw is String && raw.isNotEmpty) {
      try {
        return (jsonDecode(raw) as Map).cast<String, dynamic>();
      } catch (_) {}
    }
    if (raw is Map) return raw.cast<String, dynamic>();
    return const {};
  }

  bool _isImageUrl(String v) =>
      v.startsWith('http') || v.startsWith('/uploads') || v.startsWith('local://');

  /// Valor legivel de uma celula: selects vem como {label,value}; listas juntam.
  String _cellText(dynamic v) {
    if (v is Map) return (v['label'] ?? v['value'] ?? '').toString();
    if (v is List) return v.map(_cellText).where((s) => s.isNotEmpty).join(', ');
    return v.toString();
  }

  /// slug -> "Rotulo Legivel" (troca _ por espaco, capitaliza).
  String _pretty(String s) => s
      .replaceAll('_', ' ')
      .split(' ')
      .where((w) => w.isNotEmpty)
      .map((w) => '${w[0].toUpperCase()}${w.substring(1)}')
      .join(' ');

  /// Card de comando (form_submission / query_result): titulo da acao + chip do
  /// registro + miniaturas das imagens + campos "Rotulo: valor" (sem URLs cruas).
  Widget _card(BuildContext context, IconData icon) {
    final colors = context.colors;
    final theme = Theme.of(context);
    final meta = _meta();
    final values = (meta['values'] as Map?)?.cast<String, dynamic>() ?? {};
    final label = meta['label']?.toString();
    final slug = meta['templateSlug']?.toString() ?? '';
    final isQuery = message['type'] == 'query_result';

    // Secoes em ordem HIERARQUICA: pai(s) -> tabela -> filho(s). Sem `groups`
    // (cards antigos/query), cai numa unica secao com os `values`.
    final groups = (meta['groups'] as List?) ?? const [];
    final sections = groups.isNotEmpty
        ? groups
            .whereType<Map>()
            .map((g) => (
                  title: (g['title'] ?? '').toString(),
                  values: (g['values'] as Map?)?.cast<String, dynamic>() ??
                      const <String, dynamic>{},
                ),)
            .toList()
        : [(title: '', values: values)];

    final title = isQuery
        ? ((message['content'] as String?) ?? 'Consulta')
        : (slug.isNotEmpty ? _pretty(slug) : 'Registro');

    return ConstrainedBox(
      constraints: const BoxConstraints(minWidth: 180, maxWidth: 260),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Cabecalho: icone + acao + chip do registro (chassi).
          Row(children: [
            Container(
              padding: const EdgeInsets.all(5),
              decoration: BoxDecoration(
                color: theme.colorScheme.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, size: 15, color: theme.colorScheme.primary),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.bodyMedium
                      .copyWith(fontWeight: FontWeight.w700),),
            ),
          ],),
          if (label != null && label.isNotEmpty) ...[
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: colors.muted,
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(label,
                  style: AppTypography.caption
                      .copyWith(fontWeight: FontWeight.w600),),
            ),
          ],
          for (final s in sections)
            ..._sectionBody(s.title, s.values, colors, theme),
        ],
      ),
    );
  }

  /// Uma secao do card (pai/tabela/filho): titulo opcional + miniaturas das
  /// imagens + campos "Rotulo: valor" (sem URLs cruas nem vazios).
  List<Widget> _sectionBody(
    String title,
    Map<String, dynamic> values,
    dynamic colors,
    ThemeData theme,
  ) {
    final images = <String>[];
    final rows = <MapEntry<String, dynamic>>[];
    for (final e in values.entries) {
      final v = e.value;
      if (v == null || v.toString().trim().isEmpty) continue;
      if (v is String && _isImageUrl(v)) {
        images.add(v);
      } else {
        rows.add(e);
      }
    }
    if (images.isEmpty && rows.isEmpty) return const [];
    return [
      if (title.isNotEmpty) ...[
        const SizedBox(height: 8),
        Text(title.toUpperCase(),
            style: AppTypography.caption.copyWith(
              color: colors.mutedForeground,
              fontWeight: FontWeight.w700,
              fontSize: 10,
              letterSpacing: 0.5,
            ),),
      ],
      if (images.isNotEmpty) ...[
        const SizedBox(height: 6),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: images.map((u) => _thumb(u, colors)).toList(),
        ),
      ],
      if (rows.isNotEmpty) ...[
        const SizedBox(height: 6),
        ...rows.take(10).map((e) => Padding(
              padding: const EdgeInsets.only(bottom: 3),
              child: RichText(
                text: TextSpan(
                  style: AppTypography.caption
                      .copyWith(color: colors.mutedForeground),
                  children: [
                    TextSpan(text: '${_pretty(e.key)}: '),
                    TextSpan(
                      text: _cellText(e.value),
                      style: TextStyle(
                        color: theme.colorScheme.onSurface,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ),),
      ],
    ];
  }

  Widget _thumb(String url, dynamic colors) {
    final uri = resolveReportUrl(url);
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: CachedNetworkImage(
        imageUrl: uri?.toString() ?? url,
        width: 54,
        height: 54,
        fit: BoxFit.cover,
        placeholder: (_, __) => Container(
          width: 54,
          height: 54,
          color: colors.muted,
          child: const Center(
            child: SizedBox(
                width: 14,
                height: 14,
                child: CircularProgressIndicator(strokeWidth: 2),),
          ),
        ),
        errorWidget: (_, __, ___) => Container(
          width: 54,
          height: 54,
          color: colors.muted,
          child: Icon(Icons.broken_image_outlined,
              size: 18, color: colors.mutedForeground,),
        ),
      ),
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
    final url = meta['url']?.toString();
    final label = meta['filename']?.toString() ??
        (message['content'] as String?) ??
        'Relatório';
    return InkWell(
      onTap: () => _openReport(context, url),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(Icons.download_rounded, size: 18, color: colors.info),
        const SizedBox(width: 6),
        Flexible(
          child: Text(label,
              style: AppTypography.bodyMedium.copyWith(
                color: colors.info,
                decoration: TextDecoration.underline,
              ),),
        ),
      ],),
    );
  }

  Future<void> _openReport(BuildContext context, String? url) async {
    final messenger = ScaffoldMessenger.of(context);
    final uri = url != null ? resolveReportUrl(url) : null;
    if (uri == null) {
      messenger.showSnackBar(const SnackBar(
        content: Text('Relatório sem link de download (gere novamente).'),
      ),);
      return;
    }
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok) {
      messenger.showSnackBar(
        const SnackBar(content: Text('Não foi possível abrir o relatório.')),
      );
    }
  }
}
