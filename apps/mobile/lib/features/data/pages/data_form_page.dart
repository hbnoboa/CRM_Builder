import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:crm_mobile/core/theme/app_colors.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:crm_mobile/features/data/data/data_repository.dart';
import 'package:crm_mobile/features/data/widgets/dynamic_field.dart';

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
  bool _isLoading = false;
  bool _isInitialized = false;
  List<dynamic> _fields = [];
  String _entityName = '';

  @override
  void initState() {
    super.initState();
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
    }

    setState(() => _isInitialized = true);
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    // Check required fields have values
    final missingFields = <String>[];
    for (final field in _fields) {
      final f = field as Map<String, dynamic>;
      final type = (f['type'] as String? ?? '').toUpperCase();
      if (type == 'SUB_ENTITY') continue;
      final required = f['required'] == true;
      if (!required) continue;

      final slug = f['slug'] as String? ?? '';
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

      if (widget.isEditing) {
        await repo.updateRecord(
          entitySlug: widget.entitySlug,
          recordId: widget.recordId!,
          data: _values,
        );
      } else {
        await repo.createRecord(
          entitySlug: widget.entitySlug,
          data: _values,
          parentRecordId: widget.parentRecordId,
        );
      }

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

  @override
  Widget build(BuildContext context) {
    if (!_isInitialized) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.isEditing ? 'Editar $_entityName' : 'Novo $_entityName',
        ),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => context.pop(),
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
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            ..._fields
                .where((f) =>
                    (f as Map<String, dynamic>)['type']?.toString().toUpperCase() !=
                    'SUB_ENTITY')
                .map<Widget>((field) {
              final fieldMap = field as Map<String, dynamic>;
              return Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: DynamicFieldInput(
                  field: fieldMap,
                  value: _values[fieldMap['slug']],
                  onChanged: (value) {
                    _values[fieldMap['slug'] as String] = value;
                  },
                ),
              );
            }),
            const SizedBox(height: 16),
            SizedBox(
              height: 48,
              child: ElevatedButton(
                onPressed: _isLoading ? null : _handleSubmit,
                child: _isLoading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppColors.primaryForeground,
                        ),
                      )
                    : Text(widget.isEditing ? 'Salvar alteracoes' : 'Criar'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
