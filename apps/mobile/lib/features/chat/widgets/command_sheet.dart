import 'dart:async';
import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:crm_mobile/core/theme/app_colors_extension.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:crm_mobile/features/data/widgets/dynamic_field.dart';
import 'package:crm_mobile/features/chat/data/chat_repository.dart';
import 'package:crm_mobile/features/chat/data/command_draft_store.dart';
import 'package:crm_mobile/features/chat/widgets/record_search_field.dart';
import 'package:crm_mobile/shared/utils/select_normalize.dart';

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
      // Fechar so intencionalmente (X / voltar): nada de perder o rascunho por
      // um swipe ou toque fora. O DraggableScrollableSheet cuida do resize.
      isDismissible: false,
      enableDrag: false,
      builder: (_) => CommandSheet(channelId: channelId, command: command),
    );
  }

  @override
  ConsumerState<CommandSheet> createState() => _CommandSheetState();
}

class _CommandSheetState extends ConsumerState<CommandSheet>
    with WidgetsBindingObserver {
  List<Map<String, dynamic>> _fields = [];
  List<Map<String, dynamic>> _parentFields = []; // campos da entidade-pai (ex.: veiculos)
  final Map<String, dynamic> _values = {};
  final Map<String, dynamic> _parentValues = {}; // valores dos campos source:'parent'
  final Map<String, ({String? from, String? to})> _range = {};
  Map<String, dynamic>? _parent; // create_record com pai
  Map<String, dynamic>? _record; // update_record
  bool _loading = true;
  bool _submitting = false;
  String? _runningFormat; // key do formato de query em execucao
  String? _error;
  final Set<String> _missing = {}; // slugs obrigatorios vazios (erro por campo)
  int _formVersion = 0; // muda ao "adicionar outra" p/ recriar os campos (reset)
  final List<Map<String, dynamic>> _batch = []; // registros acumulados (1 card so)
  bool _sent = false; // true apos enviar: nao persistir rascunho depois disso
  Timer? _saveDebounce; // salva o rascunho enquanto edita (evita corrida no pause)

  String get _slug => (widget.command['slug'] as String?) ?? '';

  /// Agenda a persistencia do rascunho enquanto o app esta ATIVO (o event loop
  /// pode congelar no `paused`, entao nao da pra confiar so nele). Debounced.
  void _scheduleSave() {
    if (_sent) return;
    _saveDebounce?.cancel();
    _saveDebounce = Timer(const Duration(milliseconds: 400), () {
      if (!_sent && _hasDraft) _persistDraft();
    });
  }

  Map<String, dynamic> get _cfg =>
      (widget.command['actionConfig'] as Map?)?.cast<String, dynamic>() ?? {};
  String get _actionType =>
      (widget.command['actionType'] as String?) ?? 'create_record';
  String get _targetSlug =>
      (widget.command['targetEntitySlug'] as String?) ?? '';
  bool get _isQuery => _actionType == 'query';

  /// Ha conteudo preenchido que seria perdido ao fechar (registro escolhido,
  /// campos preenchidos ou itens ja acumulados no card).
  bool get _hasDraft =>
      _parent != null ||
      _record != null ||
      _values.isNotEmpty ||
      _batch.isNotEmpty;

  /// Fecha o sheet — sem rascunho, direto; com rascunho, pede confirmacao.
  Future<void> _handleClose() async {
    if (!_hasDraft) {
      Navigator.of(context).pop();
      return;
    }
    final nav = Navigator.of(context);
    final ok = await _confirmDiscard();
    if (ok) {
      await _clearDraft();
      if (mounted) nav.pop();
    }
  }

  /// Zera todos os campos do comando (botao reset) e apaga o rascunho salvo.
  void _resetForm() {
    setState(() {
      _parent = null;
      _record = null;
      _values.clear();
      _parentValues.clear();
      _batch.clear();
      _range.clear();
      _missing.clear();
      _error = null;
      _formVersion++;
    });
    _clearDraft();
  }

  /// Dialogo "descartar rascunho?". Retorna true se o usuario confirmar.
  Future<bool> _confirmDiscard() async {
    final colors = context.colors;
    final res = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Descartar rascunho?'),
        content: const Text(
          'Voce preencheu dados neste comando. Se fechar agora, tudo sera perdido.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Continuar editando'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text('Descartar',
                style: TextStyle(color: colors.destructive),),
          ),
        ],
      ),
    );
    return res ?? false;
  }

  /// Codifica um filtro fixo do comando (parentFilter/searchFilter) em JSON
  /// para a busca do registro (ex.: so veiculos concluido=false). Null se vazio.
  String? _encodeFilter(dynamic f) =>
      (f is List && f.isNotEmpty) ? jsonEncode(f) : null;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
  }

  @override
  void dispose() {
    _saveDebounce?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Ao mandar o app pro background, salva o rascunho (cobre "sair e voltar").
    // Nao salva se ja foi enviado (evita ressuscitar um comando concluido).
    if (state == AppLifecycleState.paused && _hasDraft && !_sent) {
      _persistDraft();
    }
  }

  /// Serializa o estado atual do formulario para persistir/restaurar.
  Map<String, dynamic> _draftJson() => {
        'parent': _parent,
        'record': _record,
        'values': _values,
        'parentValues': _parentValues,
        'batch': _batch,
        'range': _range.map(
          (k, v) => MapEntry(k, {'from': v.from, 'to': v.to}),
        ),
      };

  Future<void> _persistDraft() =>
      CommandDraftStore.save(widget.channelId, _slug, _draftJson());

  Future<void> _clearDraft() =>
      CommandDraftStore.clear(widget.channelId, _slug);

  /// Restaura o rascunho salvo (se houver) para os campos do formulario.
  void _restoreDraft(Map<String, dynamic> d) {
    _parent = (d['parent'] as Map?)?.cast<String, dynamic>();
    _record = (d['record'] as Map?)?.cast<String, dynamic>();
    _values
      ..clear()
      ..addAll((d['values'] as Map?)?.cast<String, dynamic>() ?? const {});
    _parentValues
      ..clear()
      ..addAll(
          (d['parentValues'] as Map?)?.cast<String, dynamic>() ?? const {},);
    _batch
      ..clear()
      ..addAll(((d['batch'] as List?) ?? const [])
          .map((e) => (e as Map).cast<String, dynamic>()),);
    _range.clear();
    for (final e in ((d['range'] as Map?) ?? const {}).entries) {
      final m = (e.value as Map?) ?? const {};
      _range[e.key as String] =
          (from: m['from'] as String?, to: m['to'] as String?);
    }
  }

  Future<void> _load() async {
    try {
      final repo = ref.read(chatRepositoryProvider);
      final raw = await repo.entityFields(_targetSlug);
      _fields = raw.map((e) => (e as Map).cast<String, dynamic>()).toList();
      // Campos da entidade-pai (ex.: veiculos) — p/ exibir os campos source:'parent'
      // (ex.: foto do veiculo) no formulario do comando.
      final parentSlug = _cfg['parentEntitySlug'] as String?;
      if (parentSlug != null && parentSlug.isNotEmpty) {
        final praw = await repo.entityFields(parentSlug);
        _parentFields = praw.map((e) => (e as Map).cast<String, dynamic>()).toList();
      }
      // Restaura rascunho salvo (ex.: usuario saiu do app no meio do preenchimento).
      final draft = await CommandDraftStore.load(widget.channelId, _slug);
      if (draft != null) _restoreDraft(draft);
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
    // update_record: usa actionConfig.fields (lista de slugs). Presente e VAZIA
    // significa "nenhum campo editavel" (ex.: /concluido so pede o chassi).
    final only = _cfg['fields'];
    if (only is List) {
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

  bool _isEmptyValue(dynamic v) =>
      v == null ||
      (v is String && v.trim().isEmpty) ||
      (v is List && v.isEmpty) ||
      (v is Map && v.isEmpty);

  /// Slugs dos campos obrigatorios (formFields required) ainda vazios.
  Set<String> _missingRequired() {
    final ff = _cfg['formFields'];
    if (ff is! List) return const {};
    final missing = <String>{};
    for (final f in ff) {
      final m = (f as Map).cast<String, dynamic>();
      if (m['required'] != true) continue;
      final slug = m['slug'] as String? ?? '';
      final isParent = m['source'] == 'parent';
      if (_isEmptyValue((isParent ? _parentValues : _values)[slug])) {
        missing.add(slug);
      }
    }
    return missing;
  }

  /// Extrai a mensagem legivel de um erro (evita mostrar "DioException [...]").
  String _errorMessage(Object e) {
    if (e is DioException) {
      final data = e.response?.data;
      if (data is Map && data['message'] != null) {
        final m = data['message'];
        return m is List ? m.join('\n') : m.toString();
      }
      return e.response?.statusMessage ?? 'Falha ao enviar. Tente de novo.';
    }
    return e.toString();
  }

  /// Envia o comando. `keepOpen` ("Salvar e adicionar outra"): NAO envia — apenas
  /// acumula o registro atual em `_batch` e reseta os campos (mantendo o pai),
  /// para lancar outro. O "Enviar" manda todos os acumulados + o atual num card
  /// so (items[]). Um so registro = card simples (comportamento antigo).
  Future<void> _submit({bool keepOpen = false}) async {
    final parentSlug = _cfg['parentEntitySlug'] as String?;
    if (parentSlug != null && _parent == null) {
      setState(() => _error = 'Selecione o registro.');
      return;
    }
    if (_actionType == 'update_record' && _record == null) {
      setState(() => _error = 'Selecione o registro a editar.');
      return;
    }
    // Valida o form atual quando: acumulando (sempre) OU ha conteudo no atual.
    final hasCurrent = _values.isNotEmpty;
    if (keepOpen || hasCurrent) {
      final missing = _missingRequired();
      if (missing.isNotEmpty) {
        setState(() {
          _missing
            ..clear()
            ..addAll(missing);
          _error = 'Preencha os campos obrigatorios destacados.';
        });
        return;
      }
    }

    if (keepOpen) {
      // Acumula e reseta (mantem _parent/_parentValues — mesmo veiculo/fotos).
      setState(() {
        _batch.add(Map<String, dynamic>.from(_values));
        _values.clear();
        _missing.clear();
        _error = null;
        _formVersion++;
      });
      _scheduleSave();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Adicionado (${_batch.length}). Preencha o proximo.'),
          duration: const Duration(seconds: 1),
        ),
      );
      return;
    }

    // Enviar: junta os acumulados + o atual (se preenchido) num card so.
    // Normaliza os selects para o `value` puro (fidelidade de dado, igual a web).
    final isUpdate = _actionType == 'update_record';
    final items = <Map<String, dynamic>>[
      ..._batch,
      if (hasCurrent) Map<String, dynamic>.from(_values),
    ].map((it) => normalizeSelectValues(it, _fields)).toList();
    // create_record precisa de ao menos 1 registro; update pode ir vazio (ex.:
    // /concluido, que so aplica os fixedValues).
    if (!isUpdate && items.isEmpty) {
      setState(() => _error = 'Preencha ao menos um registro.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    final nav = Navigator.of(context);
    try {
      await ref.read(chatRepositoryProvider).runCommand(
            widget.channelId,
            widget.command['slug'] as String,
            // update usa `values` (1 registro); create usa `items` (batch).
            values: isUpdate ? (items.isNotEmpty ? items.first : const {}) : const {},
            items: isUpdate ? null : items,
            recordId: _record?['id'] as String?,
            parentRecordId: _parent?['id'] as String?,
            parentUpdate: normalizeSelectValues(_parentValues, _parentFields),
          );
      // Enviado: descarta o rascunho e impede re-persistir no lifecycle.
      _sent = true;
      await _clearDraft();
      if (mounted) nav.pop();
    } catch (e) {
      if (mounted) {
        setState(() {
          _submitting = false;
          _error = _errorMessage(e);
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
    return PopScope(
      // Sem rascunho: voltar fecha direto. Com rascunho: intercepta e confirma.
      canPop: !_hasDraft,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final nav = Navigator.of(context);
        final ok = await _confirmDiscard();
        if (ok) {
          await _clearDraft();
          if (mounted) nav.pop();
        }
      },
      child: Padding(
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
                    IconButton(
                      icon: const Icon(Icons.restart_alt),
                      onPressed: _hasDraft ? _resetForm : null,
                      tooltip: 'Limpar campos',
                      visualDensity: VisualDensity.compact,
                    ),
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: _handleClose,
                      tooltip: 'Fechar',
                      visualDensity: VisualDensity.compact,
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
      ),
    );
  }

  List<Widget> _body() {
    if (_isQuery) return _queryBody();

    final widgets = <Widget>[];
    final parentSlug = _cfg['parentEntitySlug'] as String?;
    if (parentSlug != null) {
      widgets.add(RecordSearchField(
        key: ValueKey('rec_${_formVersion}_parent'),
        entitySlug: parentSlug,
        label: 'Registro',
        initial: _parent,
        filters: _encodeFilter(_cfg['parentFilter']),
        onPicked: (r) {
          setState(() {
            _parent = r;
            // Pre-preenche os campos source:'parent' (ex.: fotos do veiculo) com o
            // valor atual do registro; editaveis e enviados como parentUpdate.
            final pdata = (r?['data'] as Map?)?.cast<String, dynamic>() ?? {};
            _parentValues.clear();
            final ff = _cfg['formFields'];
            if (ff is List) {
              for (final f in ff) {
                final m = (f as Map).cast<String, dynamic>();
                if (m['source'] == 'parent') {
                  final s = m['slug'] as String? ?? '';
                  if (s.isNotEmpty) _parentValues[s] = pdata[s];
                }
              }
            }
          });
          _scheduleSave();
        },
      ),);
      widgets.add(const SizedBox(height: 12));
    }
    if (_actionType == 'update_record') {
      widgets.add(RecordSearchField(
        key: ValueKey('rec_${_formVersion}_target'),
        entitySlug: _targetSlug,
        label: 'Registro a editar',
        initial: _record,
        filters: _encodeFilter(_cfg['searchFilter']),
        onPicked: (r) {
          setState(() {
            _record = r;
            final data = (r?['data'] as Map?)?.cast<String, dynamic>() ?? {};
            // Pre-preenche SO os campos editaveis (nao o registro inteiro): o card
            // usa os values enviados, entao /concluido (fields:[]) fica limpo.
            _values.clear();
            for (final def in _targetFieldDefs()) {
              final s = def['slug'] as String? ?? '';
              if (s.isNotEmpty && data.containsKey(s)) _values[s] = data[s];
            }
          });
          _scheduleSave();
        },
      ),);
      widgets.add(const SizedBox(height: 12));
    }

    widgets.addAll(_formFieldWidgets());
    return widgets;
  }

  /// Renderiza os campos do formulario respeitando formFields:
  /// - source:'parent'  -> campo da entidade-pai (ex.: foto do veiculo), EDITAVEL
  ///   e enviado como parentUpdate (atualiza o veiculo). So aparece apos escolher
  ///   o registro-pai.
  /// - source:'target'  -> campo do proprio registro, editavel.
  /// Sem formFields, cai no comportamento antigo (todos os campos alvo editaveis).
  List<Widget> _formFieldWidgets() {
    final colors = context.colors;
    Widget input(
      Map<String, dynamic> def,
      Map<String, dynamic> store,
      List<Map<String, dynamic>> all,
      String entitySlug,
      String recordId,
    ) {
      final slug = def['slug'] as String? ?? '';
      final hasError = _missing.contains(slug);
      return Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            DynamicFieldInput(
              // Key versionada: ao "adicionar outra", recria o campo para reler o
              // valor (o widget de imagem/diagrama so le value no initState).
              key: ValueKey('${_formVersion}_$slug'),
              field: def,
              value: store[slug],
              allFields: all,
              entitySlug: entitySlug,
              recordId: recordId,
              onChanged: (v) {
                store[slug] = v;
                // Limpa o erro do campo assim que for preenchido.
                if (_missing.contains(slug) && !_isEmptyValue(v)) {
                  setState(() => _missing.remove(slug));
                }
                _scheduleSave();
              },
            ),
            if (hasError)
              Padding(
                padding: const EdgeInsets.only(top: 4, left: 4),
                child: Text('Campo obrigatorio',
                    style: TextStyle(color: colors.destructive, fontSize: 12),),
              ),
          ],
        ),
      );
    }

    final ff = _cfg['formFields'];
    if (ff is! List || ff.isEmpty) {
      return [
        for (final def in _targetFieldDefs())
          input(def, _values, _fields, _targetSlug, _record?['id'] as String? ?? ''),
      ];
    }

    final parentSlug = _cfg['parentEntitySlug'] as String? ?? '';
    final out = <Widget>[];
    for (final f in ff) {
      final m = (f as Map).cast<String, dynamic>();
      final slug = m['slug'] as String? ?? '';
      final isParent = m['source'] == 'parent';
      final def = (isParent ? _parentFields : _fields).firstWhere(
        (d) => d['slug'] == slug,
        orElse: () => const {},
      );
      if (def.isEmpty) continue;
      if (isParent) {
        if (_parent == null) continue; // so apos escolher o registro-pai
        out.add(input(def, _parentValues, _parentFields, parentSlug,
            _parent?['id'] as String? ?? '',),);
      } else {
        out.add(input(def, _values, _fields, _targetSlug,
            _record?['id'] as String? ?? '',),);
      }
    }
    return out;
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

    // Opcoes podem vir como String simples ('N/A') ou objeto {label,value}.
    final options = ((f['options'] as List?) ?? const []).map((o) {
      if (o is Map) {
        final m = o.cast<String, dynamic>();
        final v = '${m['value'] ?? m['label'] ?? ''}';
        return {'value': v, 'label': '${m['label'] ?? m['value'] ?? v}'};
      }
      return {'value': '$o', 'label': '$o'};
    }).toList();
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
            onChanged: (v) {
              setState(() => _values[slug] = v ?? '');
              _scheduleSave();
            },
          )
        else
          TextField(
            decoration: InputDecoration(
              isDense: true,
              hintText: 'Filtrar ${label.toLowerCase()}…',
              border: const OutlineInputBorder(),
            ),
            onChanged: (v) {
              _values[slug] = v;
              _scheduleSave();
            },
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
            else ...[
              // Quantos vao no card: acumulados + o atual (se preenchido).
              if (_batch.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Text('${_batch.length} adicionado(s) neste card',
                      style: AppTypography.caption
                          .copyWith(color: colors.mutedForeground),),
                ),
              // allowMultiple: registrar varios (ex.: varias avarias no veiculo).
              if (_actionType == 'create_record' && _cfg['allowMultiple'] == true)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: OutlinedButton.icon(
                    onPressed: _submitting ? null : () => _submit(keepOpen: true),
                    icon: const Icon(Icons.add, size: 18),
                    label: const Text('Salvar e adicionar outra'),
                  ),
                ),
              FilledButton(
                onPressed: _submitting ? null : () => _submit(),
                child: _submitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),)
                    : Text(_batch.isNotEmpty
                        ? 'Enviar (${_batch.length + (_values.isNotEmpty ? 1 : 0)})'
                        : 'Enviar',),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
