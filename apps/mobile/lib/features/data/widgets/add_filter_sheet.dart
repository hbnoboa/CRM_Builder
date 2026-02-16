import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import 'package:crm_mobile/core/filters/filter_models.dart';
import 'package:crm_mobile/core/network/api_client.dart';
import 'package:crm_mobile/core/theme/app_colors.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:crm_mobile/features/data/providers/filter_provider.dart';

/// Bottom sheet form for creating a new filter (local or global).
class AddFilterSheet extends ConsumerStatefulWidget {
  const AddFilterSheet({
    super.key,
    required this.entitySlug,
    required this.entityId,
    required this.fields,
    required this.canSaveGlobal,
    required this.currentGlobalFilters,
    this.onGlobalFiltersChanged,
  });

  final String entitySlug;
  final String entityId;
  final List<dynamic> fields;
  final bool canSaveGlobal;
  final List<GlobalFilter> currentGlobalFilters;
  final void Function(List<GlobalFilter>)? onGlobalFiltersChanged;

  @override
  ConsumerState<AddFilterSheet> createState() => _AddFilterSheetState();
}

class _AddFilterSheetState extends ConsumerState<AddFilterSheet> {
  String? _selectedFieldSlug;
  Map<String, dynamic>? _selectedField;
  FilterOperator? _selectedOperator;
  dynamic _value;
  dynamic _value2;
  bool _saveAsGlobal = false;
  bool _saving = false;

  /// Filterable field types (exclude non-filterable)
  static const _excludedTypes = {
    'hidden', 'sub_entity', 'sub-entity', 'image', 'file',
    'json', 'array', 'rich_text', 'richtext',
  };

  List<Map<String, dynamic>> get _filterableFields {
    return widget.fields
        .whereType<Map<String, dynamic>>()
        .where((f) {
          final type = (f['type'] as String? ?? '').toLowerCase();
          return !_excludedTypes.contains(type);
        })
        .toList();
  }

  List<FilterOperator> get _availableOperators {
    if (_selectedField == null) return [];
    final type = _selectedField!['type'] as String? ?? 'text';
    return operatorsForFieldType(type);
  }

  bool get _canSubmit {
    if (_selectedFieldSlug == null || _selectedOperator == null) return false;
    if (_selectedOperator == FilterOperator.isEmpty ||
        _selectedOperator == FilterOperator.isNotEmpty) {
      return true;
    }
    if (_value == null || (_value is String && (_value as String).isEmpty)) {
      return false;
    }
    if (_selectedOperator == FilterOperator.between &&
        (_value2 == null || (_value2 is String && (_value2 as String).isEmpty))) {
      return false;
    }
    return true;
  }

  Future<void> _submit() async {
    if (!_canSubmit) return;

    final fieldName = _selectedField!['name'] as String? ?? _selectedFieldSlug!;
    final fieldType = _selectedField!['type'] as String? ?? 'text';

    if (_saveAsGlobal) {
      setState(() => _saving = true);
      try {
        final newFilter = GlobalFilter(
          fieldSlug: _selectedFieldSlug!,
          fieldName: fieldName,
          fieldType: fieldType,
          operator: _selectedOperator!,
          value: _value,
          value2: _value2,
          createdAt: DateTime.now().toIso8601String(),
        );
        final updated = [...widget.currentGlobalFilters, newFilter];
        final dio = ref.read(apiClientProvider);
        await dio.patch(
          '/entities/${widget.entityId}/global-filters',
          data: {
            'globalFilters': updated.map((f) => f.toJson()).toList(),
          },
        );
        widget.onGlobalFiltersChanged?.call(updated);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Filtro global salvo')),
          );
          Navigator.of(context).pop();
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Erro ao salvar: $e')),
          );
        }
      } finally {
        if (mounted) setState(() => _saving = false);
      }
    } else {
      final filter = LocalFilter(
        id: const Uuid().v4(),
        fieldSlug: _selectedFieldSlug!,
        fieldName: fieldName,
        fieldType: fieldType,
        operator: _selectedOperator!,
        value: _value,
        value2: _value2,
      );
      ref
          .read(entityLocalFiltersProvider.notifier)
          .addFilter(widget.entitySlug, filter);
      if (mounted) {
        Navigator.of(context).pop();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding:
          EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.background,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
        ),
        padding: const EdgeInsets.all(16),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Handle
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),

              Text('Adicionar Filtro', style: AppTypography.h4),
              const SizedBox(height: 16),

              // Field picker
              DropdownButtonFormField<String>(
                decoration: const InputDecoration(
                  labelText: 'Campo',
                  border: OutlineInputBorder(),
                  contentPadding:
                      EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                ),
                value: _selectedFieldSlug,
                items: _filterableFields.map((f) {
                  final slug = f['slug'] as String? ?? '';
                  final name = f['name'] as String? ?? slug;
                  return DropdownMenuItem(value: slug, child: Text(name));
                }).toList(),
                onChanged: (value) {
                  setState(() {
                    _selectedFieldSlug = value;
                    _selectedField = _filterableFields.firstWhere(
                      (f) => f['slug'] == value,
                      orElse: () => <String, dynamic>{},
                    );
                    _selectedOperator = null;
                    _value = null;
                    _value2 = null;
                  });
                },
              ),
              const SizedBox(height: 12),

              // Operator picker
              if (_selectedFieldSlug != null) ...[
                DropdownButtonFormField<FilterOperator>(
                  decoration: const InputDecoration(
                    labelText: 'Operador',
                    border: OutlineInputBorder(),
                    contentPadding:
                        EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  ),
                  value: _selectedOperator,
                  items: _availableOperators
                      .map((op) => DropdownMenuItem(
                          value: op, child: Text(op.label)))
                      .toList(),
                  onChanged: (value) {
                    setState(() {
                      _selectedOperator = value;
                      _value = null;
                      _value2 = null;
                    });
                  },
                ),
                const SizedBox(height: 12),
              ],

              // Value input
              if (_selectedOperator != null &&
                  _selectedOperator != FilterOperator.isEmpty &&
                  _selectedOperator != FilterOperator.isNotEmpty) ...[
                _buildValueInput(),
                const SizedBox(height: 12),
              ],

              // Between second value
              if (_selectedOperator == FilterOperator.between) ...[
                _buildSecondValueInput(),
                const SizedBox(height: 12),
              ],

              // Save as global switch
              if (widget.canSaveGlobal) ...[
                const Divider(),
                SwitchListTile(
                  value: _saveAsGlobal,
                  onChanged: (v) => setState(() => _saveAsGlobal = v),
                  title: const Text('Salvar como filtro global'),
                  subtitle: const Text('Aplica a todos os usuarios'),
                  secondary: Icon(Icons.public,
                      color: _saveAsGlobal
                          ? AppColors.primary
                          : AppColors.mutedForeground),
                  contentPadding: EdgeInsets.zero,
                ),
                const SizedBox(height: 8),
              ],

              // Submit button
              ElevatedButton(
                onPressed: _canSubmit && !_saving ? _submit : null,
                child: _saving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(_saveAsGlobal
                        ? 'Salvar filtro global'
                        : 'Adicionar filtro'),
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildValueInput() {
    final fieldType = (_selectedField?['type'] as String? ?? 'text').toLowerCase();

    // Boolean
    if (fieldType == 'boolean') {
      return DropdownButtonFormField<bool>(
        decoration: const InputDecoration(
          labelText: 'Valor',
          border: OutlineInputBorder(),
          contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        ),
        value: _value as bool?,
        items: const [
          DropdownMenuItem(value: true, child: Text('Sim')),
          DropdownMenuItem(value: false, child: Text('Nao')),
        ],
        onChanged: (v) => setState(() => _value = v),
      );
    }

    // Number types
    if (['number', 'currency', 'percentage', 'rating', 'slider']
        .contains(fieldType)) {
      return TextFormField(
        decoration: const InputDecoration(
          labelText: 'Valor',
          border: OutlineInputBorder(),
          contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        ),
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        onChanged: (v) => setState(() => _value = num.tryParse(v)),
      );
    }

    // Date
    if (fieldType == 'date' || fieldType == 'datetime') {
      return InkWell(
        onTap: () async {
          final date = await showDatePicker(
            context: context,
            initialDate: DateTime.now(),
            firstDate: DateTime(2000),
            lastDate: DateTime(2100),
          );
          if (date != null) {
            setState(() {
              _value = date.toIso8601String().split('T')[0];
            });
          }
        },
        child: InputDecorator(
          decoration: const InputDecoration(
            labelText: 'Valor',
            border: OutlineInputBorder(),
            contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            suffixIcon: Icon(Icons.calendar_today, size: 18),
          ),
          child: Text(
            _value != null ? '$_value' : 'Selecionar data',
            style: _value != null ? null : TextStyle(color: AppColors.mutedForeground),
          ),
        ),
      );
    }

    // Select
    if (fieldType == 'select' || fieldType == 'multiselect') {
      final options = _selectedField?['options'] as List<dynamic>? ?? [];
      return DropdownButtonFormField<String>(
        decoration: const InputDecoration(
          labelText: 'Valor',
          border: OutlineInputBorder(),
          contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        ),
        value: _value as String?,
        items: options.map((opt) {
          final String value;
          final String label;
          if (opt is String) {
            value = opt;
            label = opt;
          } else if (opt is Map) {
            value = (opt['value'] ?? '') as String;
            label = (opt['label'] ?? opt['value'] ?? '') as String;
          } else {
            value = '$opt';
            label = '$opt';
          }
          return DropdownMenuItem(value: value, child: Text(label));
        }).toList(),
        onChanged: (v) => setState(() => _value = v),
      );
    }

    // Default: text input
    return TextFormField(
      decoration: const InputDecoration(
        labelText: 'Valor',
        border: OutlineInputBorder(),
        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      ),
      onChanged: (v) => setState(() => _value = v),
    );
  }

  Widget _buildSecondValueInput() {
    final fieldType = (_selectedField?['type'] as String? ?? 'text').toLowerCase();

    if (['number', 'currency', 'percentage', 'rating', 'slider']
        .contains(fieldType)) {
      return TextFormField(
        decoration: const InputDecoration(
          labelText: 'Ate',
          border: OutlineInputBorder(),
          contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        ),
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        onChanged: (v) => setState(() => _value2 = num.tryParse(v)),
      );
    }

    if (fieldType == 'date' || fieldType == 'datetime') {
      return InkWell(
        onTap: () async {
          final date = await showDatePicker(
            context: context,
            initialDate: DateTime.now(),
            firstDate: DateTime(2000),
            lastDate: DateTime(2100),
          );
          if (date != null) {
            setState(() {
              _value2 = date.toIso8601String().split('T')[0];
            });
          }
        },
        child: InputDecorator(
          decoration: const InputDecoration(
            labelText: 'Ate',
            border: OutlineInputBorder(),
            contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            suffixIcon: Icon(Icons.calendar_today, size: 18),
          ),
          child: Text(
            _value2 != null ? '$_value2' : 'Selecionar data',
            style: _value2 != null ? null : TextStyle(color: AppColors.mutedForeground),
          ),
        ),
      );
    }

    return TextFormField(
      decoration: const InputDecoration(
        labelText: 'Ate',
        border: OutlineInputBorder(),
        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      ),
      onChanged: (v) => setState(() => _value2 = v),
    );
  }
}
