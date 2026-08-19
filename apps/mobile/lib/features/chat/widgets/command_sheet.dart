import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:crm_mobile/core/theme/app_colors_extension.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:crm_mobile/features/data/widgets/dynamic_field.dart';
import 'package:crm_mobile/features/chat/data/chat_repository.dart';
import 'package:crm_mobile/features/chat/widgets/record_search_field.dart';

const _dateTypes = ['date', 'datetime', 'time'];

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
  final Map<String, ({String? from, String? to})> _range = {};
  Map<String, dynamic>? _parent; // create_record com pai
  Map<String, dynamic>? _record; // update_record
  bool _loading = true;
  bool _submitting = false;
  String? _runningFormat; // key do formato de query em execucao
  String? _error;

  Map<String, dynamic> get _cfg =>
      (widget.command['actionConfig'] as Map?)?.cast<String, dynamic>() ?? {};
  String get _actionType =>
      (widget.command['actionType'] as String?) ?? 'create_record';
  String get _targetSlug =>
      (widget.command['targetEntitySlug'] as String?) ?? '';
  bool get _isQuery => _actionType == 'query';

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

  /// Campos de filtro de uma query (cfg.filterFields + campos de sistema).
  List<Map<String, dynamic>> _filterDefs() {
    final ff = _cfg['filterFields'];
    if (ff is! List) return const [];
    final lookup = <Map<String, dynamic>>[
      ..._fields,
      {'slug': 'createdAt', 'label': 'Criado em', 'type': 'datetime'},
      {'slug': 'updatedAt', 'label': 'Atualizado em', 'type': 'datetime'},
    ];
    final out = <Map<String, dynamic>>[];
    for (final s in ff) {
      final def =
          lookup.firstWhere((d) => d['slug'] == s, orElse: () => const {});
      if (def.isNotEmpty) out.add(def);
    }
    return out;
  }

  List<Map<String, dynamic>> _buildFilters() {
    final out = <Map<String, dynamic>>[];
    for (final f in _filterDefs()) {
      final slug = f['slug'] as String;
      final type = (f['type'] as String?) ?? 'text';
      if (_dateTypes.contains(type)) {
        final r = _range[slug];
        if (r != null && (r.from != null || r.to != null)) {
          out.add({
            'fieldSlug': slug,
            'fieldType': type,
            'operator': 'between',
            'value': r.from ?? '',
            'value2': r.to ?? '',
          });
        }
      } else {
        final v = (_values[slug] as String?)?.trim() ?? '';
        if (v.isNotEmpty) {
          out.add({
            'fieldSlug': slug,
            'fieldType': type,
            'operator': type == 'select' ? 'equals' : 'contains',
            'value': v,
          });
        }
      }
    }
    return out;
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

  Future<void> _runQuery(String format, String key,
      {String? pdfTemplateId,}) async {
    setState(() {
      _runningFormat = key;
      _error = null;
    });
    try {
      await ref.read(chatRepositoryProvider).runQuery(
            widget.channelId,
            widget.command['slug'] as String,
            filters: _buildFilters(),
            format: format,
            pdfTemplateId: pdfTemplateId,
          );
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) {
        setState(() {
          _runningFormat = null;
          _error = 'Erro ao consultar: $e';
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
              if ((widget.command['description'] as String?)?.isNotEmpty ??
                  false)
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
    if (_isQuery) return _queryBody();

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

  List<Widget> _queryBody() {
    final defs = _filterDefs();
    if (defs.isEmpty) {
      return [
        Text(
          'Consulta em "$_targetSlug". Escolha o formato abaixo.',
          style: AppTypography.bodyMedium,
        ),
      ];
    }
    return [
      for (final f in defs) ...[
        _filterField(f),
        const SizedBox(height: 12),
      ],
    ];
  }

  Widget _filterField(Map<String, dynamic> f) {
    final slug = f['slug'] as String;
    final type = (f['type'] as String?) ?? 'text';
    final label = (f['label'] as String?) ?? (f['name'] as String?) ?? slug;

    if (_dateTypes.contains(type)) {
      final r = _range[slug];
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style:
                  AppTypography.caption.copyWith(fontWeight: FontWeight.w600),),
          const SizedBox(height: 4),
          Row(children: [
            Expanded(child: _datePick('De', r?.from, (v) {
              setState(() => _range[slug] = (from: v, to: r?.to));
            }),),
            const SizedBox(width: 8),
            Expanded(child: _datePick('Até', r?.to, (v) {
              setState(() => _range[slug] = (from: r?.from, to: v));
            }),),
          ],),
        ],
      );
    }

    final options = (f['options'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    final isSelect =
        (type == 'select' || type == 'multiselect') && options.isNotEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: AppTypography.caption.copyWith(fontWeight: FontWeight.w600),),
        const SizedBox(height: 4),
        if (isSelect)
          DropdownButtonFormField<String>(
            initialValue: (_values[slug] as String?)?.isNotEmpty ?? false
                ? _values[slug] as String
                : null,
            isExpanded: true,
            decoration: const InputDecoration(
                isDense: true, border: OutlineInputBorder(),),
            hint: const Text('Todos'),
            items: [
              const DropdownMenuItem(value: '', child: Text('Todos')),
              ...options.map((o) => DropdownMenuItem(
                    value: '${o['value']}',
                    child: Text('${o['label']}',
                        maxLines: 1, overflow: TextOverflow.ellipsis,),
                  ),),
            ],
            onChanged: (v) => setState(() => _values[slug] = v ?? ''),
          )
        else
          TextField(
            decoration: InputDecoration(
              isDense: true,
              hintText: 'Filtrar ${label.toLowerCase()}…',
              border: const OutlineInputBorder(),
            ),
            onChanged: (v) => _values[slug] = v,
          ),
      ],
    );
  }

  Widget _datePick(String sub, String? value, ValueChanged<String?> onPick) {
    final colors = context.colors;
    return InkWell(
      onTap: () async {
        final now = DateTime.now();
        final picked = await showDatePicker(
          context: context,
          initialDate: now,
          firstDate: DateTime(now.year - 5),
          lastDate: DateTime(now.year + 5),
        );
        if (picked != null) {
          final s = '${picked.year.toString().padLeft(4, '0')}-'
              '${picked.month.toString().padLeft(2, '0')}-'
              '${picked.day.toString().padLeft(2, '0')}';
          onPick(s);
        }
      },
      child: InputDecorator(
        decoration: InputDecoration(
          isDense: true,
          labelText: sub,
          border: const OutlineInputBorder(),
        ),
        child: Text(
          value ?? '—',
          style:
              TextStyle(color: value == null ? colors.mutedForeground : null),
        ),
      ),
    );
  }

  /// Botoes de formato da query (card + xlsx/json/pdf + templates PDF).
  List<Widget> _formatButtons() {
    final formats = (_cfg['formats'] as List?)?.cast<String>() ??
        const ['card', 'xlsx', 'json', 'pdf'];
    final pdfTemplates =
        (_cfg['pdfTemplates'] as List?)?.cast<Map<String, dynamic>>() ??
            (_cfg['pdfTemplateId'] != null
                ? [
                    {'id': _cfg['pdfTemplateId'], 'name': 'Template'},
                  ]
                : const []);
    const labels = {
      'card': 'Consultar',
      'xlsx': 'Excel',
      'json': 'JSON',
    };
    final buttons = <Widget>[];
    for (final fmt in formats) {
      if (fmt == 'pdf') {
        buttons.add(_fmtButton('PDF (tabela)', 'pdf', 'pdf'));
        for (final t in pdfTemplates) {
          buttons.add(_fmtButton('PDF · ${t['name']}', 'pdf:${t['id']}', 'pdf',
              pdfTemplateId: '${t['id']}',),);
        }
      } else {
        buttons.add(_fmtButton(labels[fmt] ?? fmt, fmt, fmt));
      }
    }
    return buttons;
  }

  Widget _fmtButton(String label, String key, String format,
      {String? pdfTemplateId,}) {
    final busy = _runningFormat != null;
    final running = _runningFormat == key;
    final isCard = format == 'card';
    final child = running
        ? const SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(strokeWidth: 2),)
        : Text(label);
    return isCard
        ? FilledButton(
            onPressed: busy ? null : () => _runQuery(format, key),
            child: child,
          )
        : OutlinedButton(
            onPressed: busy
                ? null
                : () => _runQuery(format, key, pdfTemplateId: pdfTemplateId),
            child: child,
          );
  }

  Widget _footer(dynamic colors) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child:
                    Text(_error!, style: TextStyle(color: colors.destructive)),
              ),
            if (_isQuery)
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: _formatButtons(),
              )
            else
              FilledButton(
                onPressed: _submitting ? null : _submit,
                child: _submitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),)
                    : const Text('Enviar'),
              ),
          ],
        ),
      ),
    );
  }
}
