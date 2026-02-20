import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:uuid/uuid.dart';
import 'package:crm_mobile/core/location/geolocation_service.dart';
import 'package:crm_mobile/core/theme/app_colors_extension.dart';
import 'package:crm_mobile/core/permissions/permission_provider.dart';
import 'package:crm_mobile/features/data/data/data_repository.dart';
import 'package:crm_mobile/features/data/widgets/dynamic_field.dart';
import 'package:crm_mobile/features/data/widgets/sub_entity_section.dart';

/// Dynamic form for creating/editing entity data records.
/// Renders form fields based on entity.fields JSON schema.
class DataFormPage extends ConsumerStatefulWidget {
  const DataFormPage({
    super.key,
    required this.entitySlug,
    this.recordId,
    this.parentRecordId,
  });

  final String entitySlug;
  final String? recordId;
  final String? parentRecordId;

  bool get isEditing => recordId != null;

  @override
  ConsumerState<DataFormPage> createState() => _DataFormPageState();
}

class _DataFormPageState extends ConsumerState<DataFormPage> {
  final _formKey = GlobalKey<FormState>();
  final Map<String, dynamic> _values = {};
  Map<String, dynamic> _initialValues = {};
  bool _isLoading = false;
  bool _isInitialized = false;
  bool _saved = false;
  List<dynamic> _fields = [];
  String _entityName = '';
  bool _captureLocation = false;

  /// Record ID - either from widget (editing) or pre-generated UUID (new record).
  /// Pre-generating allows image uploads to reference the correct record.
  late final String _recordId;

  @override
  void initState() {
    super.initState();
    // Generate record ID upfront so image uploads can reference it
    _recordId = widget.recordId ?? const Uuid().v4();
    _loadData();
  }

  Future<void> _loadData() async {
    final repo = ref.read(dataRepositoryProvider);

    // Load entity definition
    final entity = await repo.getEntity(widget.entitySlug);
    if (entity == null) return;

    _entityName = entity['name'] as String? ?? widget.entitySlug;

    try {
      _fields = jsonDecode(entity['fields'] as String? ?? '[]');
    } catch (_) {}

    try {
      final settings = jsonDecode(entity['settings'] as String? ?? '{}');
      if (settings is Map<String, dynamic>) {
        _captureLocation = settings['captureLocation'] == true;

        // Reorder fields by columnConfig if set
        final columnConfig = settings['columnConfig'] as Map<String, dynamic>?;
        final visibleColumns = (columnConfig?['visibleColumns'] as List<dynamic>?)
            ?.cast<String>()
            .toList();
        if (visibleColumns != null && visibleColumns.isNotEmpty) {
          final fieldMap = <String, dynamic>{};
          for (final f in _fields) {
            final slug = (f as Map<String, dynamic>)['slug'] as String? ?? '';
            if (slug.isNotEmpty) fieldMap[slug] = f;
          }
          final ordered = <dynamic>[];
          for (final slug in visibleColumns) {
            if (fieldMap.containsKey(slug)) {
              ordered.add(fieldMap.remove(slug));
            }
          }
          ordered.addAll(fieldMap.values);
          _fields = ordered;
        }
      }
    } catch (_) {}

    // If editing, load existing record
    if (widget.isEditing) {
      final record = await repo.getRecord(widget.recordId!);
      if (record != null) {
        try {
          final data = jsonDecode(record['data'] as String? ?? '{}');
          if (data is Map<String, dynamic>) {
            _values.addAll(data);
          }
        } catch (_) {}
      }
    } else {
      // Initialize new records with field default values
      for (final field in _fields) {
        final f = field as Map<String, dynamic>;
        final slug = f['slug'] as String? ?? '';
        final defaultValue = f['default'];
        if (slug.isNotEmpty && defaultValue != null && !_values.containsKey(slug)) {
          _values[slug] = defaultValue;
        }
      }
    }

    _initialValues = Map<String, dynamic>.from(_values);
    setState(() => _isInitialized = true);
  }

  bool get _hasUnsavedChanges {
    if (_saved) return false;
    if (_initialValues.length != _values.length) return true;
    for (final key in _values.keys) {
      if (_values[key]?.toString() != _initialValues[key]?.toString()) {
        return true;
      }
    }
    return false;
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    final perms = ref.read(permissionsProvider);
    final editableFields = perms.getEditableFields(widget.entitySlug);

    // Check required fields have values (skip non-editable fields)
    final missingFields = <String>[];
    for (final field in _fields) {
      final f = field as Map<String, dynamic>;
      final type = (f['type'] as String? ?? '').toUpperCase().replaceAll('-', '_');
      if (type == 'SUB_ENTITY') continue;
      final slug = f['slug'] as String? ?? '';
      // Skip required check for fields the user cannot edit
      if (editableFields != null && !editableFields.contains(slug)) continue;
      final required = f['required'] == true;
      if (!required) continue;

      final value = _values[slug];
      if (value == null || value.toString().trim().isEmpty) {
        missingFields.add(f['label'] as String? ?? f['name'] as String? ?? slug);
      }
    }

    if (missingFields.isNotEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Campos obrigatorios: ${missingFields.join(', ')}'),
          ),
        );
      }
      return;
    }

    // Dismiss keyboard before submitting
    FocusScope.of(context).unfocus();

    setState(() => _isLoading = true);

    try {
      final repo = ref.read(dataRepositoryProvider);

      // Only send editable fields to avoid overwriting restricted data
      final dataToSend = editableFields != null
          ? Map<String, dynamic>.fromEntries(
              _values.entries.where((e) => editableFields.contains(e.key)),
            )
          : Map<String, dynamic>.from(_values);

      // Auto-capture geolocation if entity has captureLocation enabled
      // Injected after permission filtering so _geolocation is always included
      if (_captureLocation) {
        try {
          final locationData = await GeolocationService.captureLocation();
          dataToSend['_geolocation'] = locationData;
        } catch (e) {
          debugPrint('[DataForm] Falha ao capturar localizacao: $e');
        }
      }

      if (widget.isEditing) {
        await repo.updateRecord(
          entitySlug: widget.entitySlug,
          recordId: widget.recordId!,
          data: dataToSend,
        );
      } else {
        await repo.createRecord(
          entitySlug: widget.entitySlug,
          data: dataToSend,
          parentRecordId: widget.parentRecordId,
          id: _recordId, // Use pre-generated ID so image uploads can reference it
        );
      }

      _saved = true;
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              widget.isEditing
                  ? 'Registro atualizado'
                  : 'Registro criado',
            ),
          ),
        );
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  List<Widget> _buildSubEntitySections() {
    final subFields = _fields.where(
      (f) => (f as Map<String, dynamic>)['type']?.toString().toUpperCase().replaceAll('-', '_') == 'SUB_ENTITY',
    );
    if (subFields.isEmpty) return [];

    return [
      const Divider(height: 32),
      ...subFields.map<Widget>((field) {
        final f = field as Map<String, dynamic>;
        final subEntitySlug = f['subEntitySlug'] as String? ?? '';
        final subEntityId = f['subEntityId'] as String? ?? '';
        final label = f['label'] as String? ?? f['name'] as String? ?? '';
        final displayFields = (f['subEntityDisplayFields'] as List<dynamic>?)
            ?.map((e) => e.toString())
            .toList();

        if (subEntitySlug.isEmpty || subEntityId.isEmpty) {
          return const SizedBox.shrink();
        }

        return Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: SubEntitySection(
            parentRecordId: widget.recordId!,
            subEntitySlug: subEntitySlug,
            subEntityId: subEntityId,
            subEntityDisplayFields: displayFields,
            label: label,
          ),
        );
      }),
    ];
  }

  @override
  Widget build(BuildContext context) {
    if (!_isInitialized) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    return PopScope(
      canPop: !_hasUnsavedChanges,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final discard = await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Descartar alteracoes?'),
            content: const Text(
              'Voce tem alteracoes nao salvas. Deseja descarta-las?',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(false),
                child: const Text('Continuar editando'),
              ),
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(true),
                style: TextButton.styleFrom(
                  foregroundColor: ctx.colors.destructive,
                ),
                child: const Text('Descartar'),
              ),
            ],
          ),
        );
        if (discard == true && context.mounted) {
          Navigator.of(context).pop();
        }
      },
      child: Scaffold(
      appBar: AppBar(
        title: Text(
          widget.isEditing ? 'Editar $_entityName' : 'Novo $_entityName',
        ),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () {
            if (_hasUnsavedChanges) {
              // Trigger the PopScope handler
              Navigator.of(context).maybePop();
            } else {
              context.pop();
            }
          },
        ),
        actions: [
          TextButton(
            onPressed: _isLoading ? null : _handleSubmit,
            child: _isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Salvar'),
          ),
        ],
      ),
      body: Builder(
        builder: (context) {
          final perms = ref.watch(permissionsProvider);
          final visibleFields = perms.getVisibleFields(widget.entitySlug);
          final editableFields = perms.getEditableFields(widget.entitySlug);

          return Form(
            key: _formKey,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                ..._fields
                    .where((f) {
                      final fieldMap = f as Map<String, dynamic>;
                      final type = (fieldMap['type']?.toString().toUpperCase() ?? '').replaceAll('-', '_');
                      if (type == 'SUB_ENTITY') return false;
                      // Field-level permissions: hide non-visible fields
                      if (visibleFields != null) {
                        final slug = fieldMap['slug'] as String? ?? '';
                        return visibleFields.contains(slug);
                      }
                      return true;
                    })
                    .map<Widget>((field) {
                  final fieldMap = field as Map<String, dynamic>;
                  final slug = fieldMap['slug'] as String? ?? '';
                  final canEdit = editableFields == null || editableFields.contains(slug);
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: DynamicFieldInput(
                      field: fieldMap,
                      value: _values[slug],
                      enabled: canEdit,
                      allFields: _fields,
                      entitySlug: widget.entitySlug,
                      recordId: _recordId,
                      onChanged: (value) {
                        setState(() => _values[slug] = value);
                      },
                      onAutoFill: (updates) {
                        setState(() => _values.addAll(updates));
                      },
                    ),
                  );
                }),
            // Sub-entity sections (only when editing - child records need parent to exist)
            if (widget.isEditing)
              ..._buildSubEntitySections(),
            const SizedBox(height: 16),
            SizedBox(
              height: 48,
              child: ElevatedButton(
                onPressed: _isLoading ? null : _handleSubmit,
                child: _isLoading
                    ? SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Theme.of(context).colorScheme.onPrimary,
                        ),
                      )
                    : Text(widget.isEditing ? 'Salvar alteracoes' : 'Criar'),
              ),
            ),
              ],
            ),
          );
        },
      ),
    ),
    );
  }
}
