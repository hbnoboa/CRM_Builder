import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:crm_mobile/core/theme/app_colors_extension.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:crm_mobile/features/data/widgets/dynamic_field.dart';
import 'package:crm_mobile/features/chat/data/chat_repository.dart';
import 'package:crm_mobile/features/chat/widgets/record_search_field.dart';

/// Bottom-sheet do formulario de um comando do chat. Roteia por actionType:
/// create_record / update_record (form dinamico reusando DynamicFieldInput) e
/// query (filtros + formato). A submissao e ONLINE (Dio); o card resultante
/// volta pelo PowerSync.
class CommandSheet extends ConsumerStatefulWidget {
  const CommandSheet({
    super.key,
    required this.channelId,
    required this.command,
  });

  final String channelId;
  final Map<String, dynamic> command;

  static Future<void> show(
    BuildContext context,
    String channelId,
    Map<String, dynamic> command,
  ) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => CommandSheet(channelId: channelId, command: command),
    );
  }

  @override
  ConsumerState<CommandSheet> createState() => _CommandSheetState();
}

class _CommandSheetState extends ConsumerState<CommandSheet> {
  List<Map<String, dynamic>> _fields = [];
  final Map<String, dynamic> _values = {};
  Map<String, dynamic>? _parent; // create_record com pai
  Map<String, dynamic>? _record; // update_record
  bool _loading = true;
  bool _submitting = false;
  String? _error;

  Map<String, dynamic> get _cfg =>
      (widget.command['actionConfig'] as Map?)?.cast<String, dynamic>() ?? {};
  String get _actionType =>
      (widget.command['actionType'] as String?) ?? 'create_record';
  String get _targetSlug =>
      (widget.command['targetEntitySlug'] as String?) ?? '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final raw = await ref.read(chatRepositoryProvider).entityFields(_targetSlug);
      _fields = raw.map((e) => (e as Map).cast<String, dynamic>()).toList();
    } catch (e) {
      _error = 'Falha ao carregar campos: $e';
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Campos-alvo a renderizar (ordem do formFields; senao todos).
  List<Map<String, dynamic>> _targetFieldDefs() {
    final ff = _cfg['formFields'];
    if (ff is List && ff.isNotEmpty) {
      final out = <Map<String, dynamic>>[];
      for (final f in ff) {
        final m = (f as Map).cast<String, dynamic>();
        if (m['source'] == 'parent') continue;
        final def = _fields.firstWhere(
          (d) => d['slug'] == m['slug'],
          orElse: () => const {},
        );
        if (def.isNotEmpty) out.add(def);
      }
      if (out.isNotEmpty) return out;
    }
    // update_record: usa actionConfig.fields (slugs) se houver.
    final only = _cfg['fields'];
    if (only is List && only.isNotEmpty) {
      return _fields.where((d) => only.contains(d['slug'])).toList();
    }
    return _fields;
  }

  Future<void> _submit() async {
    final parentSlug = _cfg['parentEntitySlug'] as String?;
    if (parentSlug != null && _parent == null) {
      setState(() => _error = 'Selecione o registro.');
      return;
    }
    if (_actionType == 'update_record' && _record == null) {
      setState(() => _error = 'Selecione o registro a editar.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ref.read(chatRepositoryProvider).runCommand(
            widget.channelId,
            widget.command['slug'] as String,
            values: Map<String, dynamic>.from(_values),
            recordId: _record?['id'] as String?,
            parentRecordId: _parent?['id'] as String?,
          );
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) {
        setState(() {
          _submitting = false;
          _error = 'Erro ao enviar: $e';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: bottom),
      child: DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.7,
        maxChildSize: 0.95,
        builder: (context, scroll) {
          return Column(
            children: [
              const SizedBox(height: 8),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: colors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                child: Row(
                  children: [
                    const Icon(Icons.bolt, size: 18),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        '/${widget.command['slug']}',
                        style: AppTypography.h4,
                      ),
                    ),
                  ],
                ),
              ),
              if ((widget.command['description'] as String?)?.isNotEmpty ?? false)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      widget.command['description'] as String,
                      style: AppTypography.caption
                          .copyWith(color: colors.mutedForeground),
                    ),
                  ),
                ),
              const Divider(height: 1),
              Expanded(
                child: _loading
                    ? const Center(child: CircularProgressIndicator())
                    : ListView(
                        controller: scroll,
                        padding: const EdgeInsets.all(16),
                        children: _body(),
                      ),
              ),
              _footer(colors),
            ],
          );
        },
      ),
    );
  }

  List<Widget> _body() {
    if (_actionType == 'query') {
      return [
        Text(
          'Consulta em "$_targetSlug". Toque em Executar para o resultado no chat.',
          style: AppTypography.bodyMedium,
        ),
        // Filtros do query entram na proxima iteracao; MVP roda sem filtros.
      ];
    }

    final widgets = <Widget>[];
    final parentSlug = _cfg['parentEntitySlug'] as String?;
    if (parentSlug != null) {
      widgets.add(RecordSearchField(
        entitySlug: parentSlug,
        label: 'Registro',
        onPicked: (r) => setState(() => _parent = r),
      ),);
      widgets.add(const SizedBox(height: 12));
    }
    if (_actionType == 'update_record') {
      widgets.add(RecordSearchField(
        entitySlug: _targetSlug,
        label: 'Registro a editar',
        onPicked: (r) {
          setState(() {
            _record = r;
            final data = (r?['data'] as Map?)?.cast<String, dynamic>() ?? {};
            _values
              ..clear()
              ..addAll(data);
          });
        },
      ),);
      widgets.add(const SizedBox(height: 12));
    }

    for (final def in _targetFieldDefs()) {
      final slug = def['slug'] as String? ?? '';
      widgets.add(Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: DynamicFieldInput(
          field: def,
          value: _values[slug],
          allFields: _fields,
          entitySlug: _targetSlug,
          onChanged: (v) => _values[slug] = v,
        ),
      ),);
    }
    return widgets;
  }

  Widget _footer(dynamic colors) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(_error!,
                    style: TextStyle(color: colors.destructive),),
              ),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _submitting ? null : _submit,
                child: _submitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),)
                    : Text(_actionType == 'query' ? 'Executar' : 'Enviar'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
