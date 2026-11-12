import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:crm_mobile/core/theme/app_colors_extension.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:crm_mobile/features/chat/data/chat_repository.dart';

/// Rotulo legivel de um registro (primeiros valores de texto do data).
String recordLabel(Map<String, dynamic> data) {
  final vals = data.values
      .where((v) => v is String && v.trim().isNotEmpty)
      .map((v) => v as String)
      .take(3)
      .toList();
  return vals.isEmpty ? '(sem titulo)' : vals.join(' · ');
}

/// Busca + selecao de um registro (pai/alvo de comando), via GET /chat/search.
class RecordSearchField extends ConsumerStatefulWidget {
  const RecordSearchField({
    super.key,
    required this.entitySlug,
    required this.label,
    required this.onPicked,
    this.parentId,
    this.filters,
    this.initial,
  });

  final String entitySlug;
  final String label;
  final String? parentId;

  /// Registro ja selecionado (ex.: rascunho restaurado) — exibe o rotulo.
  final Map<String, dynamic>? initial;

  /// JSON de GlobalFilter[] (parentFilter/searchFilter do comando) — ex.: so
  /// veiculos concluido=false.
  final String? filters;
  final void Function(Map<String, dynamic>? record) onPicked;

  @override
  ConsumerState<RecordSearchField> createState() => _RecordSearchFieldState();
}

class _RecordSearchFieldState extends ConsumerState<RecordSearchField> {
  final _controller = TextEditingController();
  Timer? _debounce;
  List<Map<String, dynamic>> _hits = [];
  Map<String, dynamic>? _selected;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    if (widget.initial != null) {
      _selected = widget.initial;
      _controller.text = recordLabel(
        (widget.initial!['data'] as Map?)?.cast<String, dynamic>() ?? {},
      );
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String q) {
    _debounce?.cancel();
    if (q.trim().length < 2) {
      setState(() => _hits = []);
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 250), () async {
      setState(() => _loading = true);
      try {
        final hits = await ref.read(chatRepositoryProvider).searchRecords(
              widget.entitySlug,
              q.trim(),
              parentId: widget.parentId,
              filters: widget.filters,
            );
        if (mounted) setState(() => _hits = hits);
      } finally {
        if (mounted) setState(() => _loading = false);
      }
    });
  }

  void _pick(Map<String, dynamic> hit) {
    setState(() {
      _selected = hit;
      _hits = [];
      _controller.text = recordLabel(
        (hit['data'] as Map?)?.cast<String, dynamic>() ?? {},
      );
    });
    widget.onPicked(hit);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(widget.label,
            style: AppTypography.caption.copyWith(fontWeight: FontWeight.w600),),
        const SizedBox(height: 4),
        TextField(
          controller: _controller,
          enabled: _selected == null,
          onChanged: _onChanged,
          decoration: InputDecoration(
            hintText: 'Buscar…',
            isDense: true,
            prefixIcon: const Icon(Icons.search, size: 18),
            suffixIcon: _selected != null
                ? IconButton(
                    icon: const Icon(Icons.close, size: 18),
                    onPressed: () {
                      setState(() {
                        _selected = null;
                        _controller.clear();
                      });
                      widget.onPicked(null);
                    },
                  )
                : (_loading
                    ? const Padding(
                        padding: EdgeInsets.all(12),
                        child: SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(strokeWidth: 2),),
                      )
                    : null),
            border: const OutlineInputBorder(),
          ),
        ),
        if (_hits.isNotEmpty)
          Container(
            constraints: const BoxConstraints(maxHeight: 180),
            margin: const EdgeInsets.only(top: 2),
            decoration: BoxDecoration(
              border: Border.all(color: colors.border),
              borderRadius: BorderRadius.circular(6),
            ),
            child: ListView(
              shrinkWrap: true,
              children: _hits.map((h) {
                final data = (h['data'] as Map?)?.cast<String, dynamic>() ?? {};
                return ListTile(
                  dense: true,
                  title: Text(recordLabel(data),
                      maxLines: 1, overflow: TextOverflow.ellipsis,),
                  onTap: () => _pick(h),
                );
              }).toList(),
            ),
          ),
      ],
    );
  }
}
