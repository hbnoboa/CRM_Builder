import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:crm_mobile/core/cache/crm_cache_manager.dart';
import 'package:crm_mobile/core/database/app_database.dart';
import 'package:crm_mobile/core/theme/app_colors.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:crm_mobile/features/data/widgets/image_field_input.dart';
import 'package:crm_mobile/shared/utils/formatters.dart';

/// Renders a field value in read-only mode (detail page).
/// Handles all field types from Entity.fields JSON.
class DynamicFieldDisplay extends StatelessWidget {
  const DynamicFieldDisplay({
    super.key,
    required this.field,
    this.value,
  });

  final Map<String, dynamic> field;
  final dynamic value;

  @override
  Widget build(BuildContext context) {
    final name = field['name'] as String? ?? field['slug'] as String? ?? '';
    final type = (field['type'] as String? ?? 'text').toUpperCase();

    return GestureDetector(
      onLongPress: () => _copyValue(context, type),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            name,
            style: AppTypography.labelMedium.copyWith(
              color: AppColors.mutedForeground,
            ),
          ),
          const SizedBox(height: 4),
          _buildValue(type, context),
        ],
      ),
    );
  }

  void _copyValue(BuildContext context, String type) {
    if (value == null || (value is String && value.toString().isEmpty)) return;

    // Skip non-text types
    const skipTypes = {'IMAGE', 'FILE', 'BOOLEAN', 'RATING', 'SLIDER', 'COLOR', 'SUB_ENTITY'};
    if (skipTypes.contains(type)) return;

    String text;
    if (value is List) {
      text = (value as List).join(', ');
    } else if (value is Map) {
      text = value.toString();
    } else {
      text = value.toString();
    }

    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('Copiado'),
        duration: const Duration(seconds: 1),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Widget _buildValue(String type, BuildContext context) {
    if (value == null || (value is String && value.toString().isEmpty)) {
      return Text(
        '-',
        style: AppTypography.bodyMedium.copyWith(
          color: AppColors.mutedForeground,
        ),
      );
    }

    switch (type) {
      case 'IMAGE':
      case 'FILE':
        final url = value.toString();
        if (url.startsWith('local://')) {
          // Pending upload: show local file preview
          return _LocalImagePreview(queueId: url.replaceFirst('local://', ''));
        }
        if (url.startsWith('http')) {
          return ClipRRect(
            borderRadius: BorderRadius.circular(AppColors.radius),
            child: CachedNetworkImage(
              imageUrl: url,
              cacheManager: CrmCacheManager(),
              height: 200,
              width: double.infinity,
              fit: BoxFit.cover,
              placeholder: (_, __) => Container(
                height: 200,
                color: AppColors.muted,
                child: const Center(child: CircularProgressIndicator()),
              ),
              errorWidget: (_, __, ___) => Container(
                height: 200,
                color: AppColors.muted,
                child: const Icon(Icons.broken_image_outlined, size: 48),
              ),
            ),
          );
        }
        return Text(value.toString(), style: AppTypography.bodyMedium);

      case 'BOOLEAN':
        final boolVal = value == true || value == 'true';
        return Row(
          children: [
            Icon(
              boolVal ? Icons.check_circle : Icons.cancel,
              color: boolVal ? AppColors.success : AppColors.mutedForeground,
              size: 20,
            ),
            const SizedBox(width: 8),
            Text(
              boolVal ? 'Sim' : 'Nao',
              style: AppTypography.bodyMedium,
            ),
          ],
        );

      case 'SELECT':
        return Chip(label: Text(value.toString()));

      case 'MULTI_SELECT':
        if (value is List) {
          return Wrap(
            spacing: 8,
            runSpacing: 4,
            children: (value as List).map<Widget>((v) {
              return Chip(label: Text(v.toString()));
            }).toList(),
          );
        }
        return Text(value.toString(), style: AppTypography.bodyMedium);

      case 'DATE':
        return Text(
          Formatters.date(value.toString()),
          style: AppTypography.bodyMedium,
        );

      case 'DATETIME':
        return Text(
          Formatters.dateTime(value.toString()),
          style: AppTypography.bodyMedium,
        );

      case 'TIME':
        return Text(value.toString(), style: AppTypography.bodyMedium);

      case 'NUMBER':
        return Text(value.toString(), style: AppTypography.bodyMedium);

      case 'CURRENCY':
        final num? numVal = num.tryParse(value.toString());
        return Text(
          numVal != null ? Formatters.currency(numVal) : value.toString(),
          style: AppTypography.bodyMedium,
        );

      case 'PERCENTAGE':
        return Text('${value}%', style: AppTypography.bodyMedium);

      case 'TEXTAREA':
      case 'RICH_TEXT':
        return Text(value.toString(), style: AppTypography.bodyMedium);

      case 'URL':
        return GestureDetector(
          onTap: () => _launchUrl(value.toString()),
          child: Text(
            value.toString(),
            style: AppTypography.bodyMedium.copyWith(
              color: AppColors.info,
              decoration: TextDecoration.underline,
            ),
          ),
        );

      case 'EMAIL':
        return GestureDetector(
          onTap: () => _launchUrl('mailto:${value.toString()}'),
          child: Text(
            value.toString(),
            style: AppTypography.bodyMedium.copyWith(
              color: AppColors.info,
              decoration: TextDecoration.underline,
            ),
          ),
        );

      case 'PHONE':
        return GestureDetector(
          onTap: () => _launchUrl('tel:${value.toString()}'),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.phone, size: 16, color: AppColors.info),
              const SizedBox(width: 6),
              Text(
                value.toString(),
                style: AppTypography.bodyMedium.copyWith(
                  color: AppColors.info,
                  decoration: TextDecoration.underline,
                ),
              ),
            ],
          ),
        );

      case 'CPF':
      case 'CNPJ':
      case 'CEP':
        return Text(value.toString(), style: AppTypography.bodyMedium);

      case 'RATING':
        final rating = (num.tryParse(value.toString()) ?? 0).toInt();
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: List.generate(5, (i) => Icon(
            i < rating ? Icons.star : Icons.star_border,
            color: AppColors.warning,
            size: 20,
          )),
        );

      case 'COLOR':
        final hex = value.toString();
        return Row(
          children: [
            Container(
              width: 24,
              height: 24,
              decoration: BoxDecoration(
                color: _parseColor(hex),
                borderRadius: BorderRadius.circular(4),
                border: Border.all(color: AppColors.border),
              ),
            ),
            const SizedBox(width: 8),
            Text(hex, style: AppTypography.bodyMedium),
          ],
        );

      case 'PASSWORD':
        return Text(
          '••••••••',
          style: AppTypography.bodyMedium.copyWith(
            color: AppColors.mutedForeground,
          ),
        );

      case 'SLIDER':
        final num numVal = num.tryParse(value.toString()) ?? 0;
        return Row(
          children: [
            Expanded(
              child: LinearProgressIndicator(
                value: (numVal / 100).clamp(0.0, 1.0).toDouble(),
                backgroundColor: AppColors.muted,
              ),
            ),
            const SizedBox(width: 8),
            Text('$numVal', style: AppTypography.bodyMedium),
          ],
        );

      case 'JSON':
        return Container(
          width: double.infinity,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.muted,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            value.toString(),
            style: AppTypography.bodySmall.copyWith(
              fontFamily: 'monospace',
            ),
            maxLines: 8,
            overflow: TextOverflow.ellipsis,
          ),
        );

      case 'ARRAY':
        if (value is List) {
          return Wrap(
            spacing: 6,
            runSpacing: 4,
            children: (value as List).map<Widget>((v) {
              return Chip(
                label: Text(v.toString(), style: AppTypography.bodySmall),
                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                visualDensity: VisualDensity.compact,
              );
            }).toList(),
          );
        }
        return Text(value.toString(), style: AppTypography.bodyMedium);

      case 'RELATION':
        // Show related record name if stored as string, or ID
        return Text(value.toString(), style: AppTypography.bodyMedium);

      case 'HIDDEN':
        return const SizedBox.shrink();

      default:
        return Text(value.toString(), style: AppTypography.bodyMedium);
    }
  }
}

/// Shows a local image from the upload queue with a "pending upload" badge.
class _LocalImagePreview extends StatefulWidget {
  const _LocalImagePreview({required this.queueId});

  final String queueId;

  @override
  State<_LocalImagePreview> createState() => _LocalImagePreviewState();
}

class _LocalImagePreviewState extends State<_LocalImagePreview> {
  File? _file;

  @override
  void initState() {
    super.initState();
    _loadLocalFile();
  }

  Future<void> _loadLocalFile() async {
    try {
      final db = AppDatabase.instance.db;
      final results = await db.getAll(
        'SELECT local_path FROM file_upload_queue WHERE id = ?',
        [widget.queueId],
      );
      if (results.isNotEmpty) {
        final path = results.first['local_path'] as String?;
        if (path != null) {
          final file = File(path);
          if (await file.exists() && mounted) {
            setState(() => _file = file);
          }
        }
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(AppColors.radius),
          child: _file != null
              ? Image.file(
                  _file!,
                  height: 200,
                  width: double.infinity,
                  fit: BoxFit.cover,
                )
              : Container(
                  height: 200,
                  width: double.infinity,
                  color: AppColors.muted,
                  child: const Center(
                    child: Icon(Icons.image_outlined, size: 48),
                  ),
                ),
        ),
        Positioned(
          top: 8,
          left: 8,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.warning,
              borderRadius: BorderRadius.circular(4),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.cloud_upload_outlined, size: 14, color: Colors.white),
                SizedBox(width: 4),
                Text(
                  'Pendente upload',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

Future<void> _launchUrl(String url) async {
  try {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  } catch (_) {}
}

Color _parseColor(String hex) {
  try {
    return Color(int.parse(hex.replaceFirst('#', '0xFF')));
  } catch (_) {
    return AppColors.muted;
  }
}

/// Renders a field input in edit mode (form page).
/// Handles all field types from Entity.fields JSON.
class DynamicFieldInput extends StatelessWidget {
  const DynamicFieldInput({
    super.key,
    required this.field,
    this.value,
    required this.onChanged,
  });

  final Map<String, dynamic> field;
  final dynamic value;
  final ValueChanged<dynamic> onChanged;

  @override
  Widget build(BuildContext context) {
    final name = field['name'] as String? ?? field['slug'] as String? ?? '';
    final type = (field['type'] as String? ?? 'text').toUpperCase();
    final required = field['required'] == true;
    final options = field['options'] as List<dynamic>?;
    final helpText = field['helpText'] as String?;
    final placeholder = field['placeholder'] as String?;

    switch (type) {
      case 'TEXTAREA':
      case 'RICH_TEXT':
        return TextFormField(
          initialValue: value?.toString(),
          maxLines: 4,
          decoration: InputDecoration(
            labelText: name,
            alignLabelWithHint: true,
            hintText: placeholder,
            helperText: helpText,
          ),
          validator: required
              ? (v) => (v == null || v.isEmpty) ? '$name obrigatorio' : null
              : null,
          onChanged: onChanged,
        );

      case 'NUMBER':
      case 'CURRENCY':
        return TextFormField(
          initialValue: value?.toString(),
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: InputDecoration(labelText: name, hintText: placeholder, helperText: helpText),
          validator: required
              ? (v) => (v == null || v.isEmpty) ? '$name obrigatorio' : null
              : null,
          onChanged: (v) => onChanged(num.tryParse(v) ?? v),
        );

      case 'BOOLEAN':
        return SwitchListTile(
          title: Text(name, style: AppTypography.labelLarge),
          value: value == true || value == 'true',
          onChanged: (v) => onChanged(v),
          contentPadding: EdgeInsets.zero,
        );

      case 'SELECT':
        final opts = options?.map((o) {
          if (o is Map) return o['value']?.toString() ?? o.toString();
          return o.toString();
        }).toList() ?? [];

        return DropdownButtonFormField<String>(
          value: value?.toString(),
          decoration: InputDecoration(labelText: name, hintText: placeholder, helperText: helpText),
          items: opts.map((o) {
            return DropdownMenuItem(value: o, child: Text(o));
          }).toList(),
          validator: required
              ? (v) => (v == null || v.isEmpty) ? '$name obrigatorio' : null
              : null,
          onChanged: (v) => onChanged(v),
        );

      case 'DATE':
        return _DateFieldInput(
          label: name,
          value: value?.toString(),
          required: required,
          onChanged: onChanged,
        );

      case 'DATETIME':
        return _DateTimeFieldInput(
          label: name,
          value: value?.toString(),
          required: required,
          onChanged: onChanged,
        );

      case 'EMAIL':
        return TextFormField(
          initialValue: value?.toString(),
          keyboardType: TextInputType.emailAddress,
          decoration: InputDecoration(labelText: name, hintText: placeholder ?? 'email@exemplo.com', helperText: helpText),
          validator: (v) {
            if (required && (v == null || v.isEmpty)) {
              return '$name obrigatorio';
            }
            if (v != null && v.isNotEmpty && !v.contains('@')) {
              return 'Email invalido';
            }
            return null;
          },
          onChanged: onChanged,
        );

      case 'URL':
        return TextFormField(
          initialValue: value?.toString(),
          keyboardType: TextInputType.url,
          decoration: InputDecoration(labelText: name, hintText: placeholder ?? 'https://', helperText: helpText),
          validator: required
              ? (v) => (v == null || v.isEmpty) ? '$name obrigatorio' : null
              : null,
          onChanged: onChanged,
        );

      case 'MULTI_SELECT':
        return _MultiSelectFieldInput(
          label: name,
          options: options,
          value: value is List ? List<String>.from(value) : null,
          required: required,
          onChanged: onChanged,
        );

      case 'IMAGE':
      case 'FILE':
        return ImageFieldInput(
          label: name,
          value: value?.toString(),
          fieldType: type,
          isRequired: required,
          onChanged: onChanged,
        );

      case 'PHONE':
        return TextFormField(
          initialValue: value?.toString(),
          keyboardType: TextInputType.phone,
          decoration: InputDecoration(
            labelText: name,
            prefixIcon: const Icon(Icons.phone),
            hintText: placeholder,
            helperText: helpText,
          ),
          inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[\d\s\-\+\(\)]+'))],
          validator: required
              ? (v) => (v == null || v.isEmpty) ? '$name obrigatorio' : null
              : null,
          onChanged: onChanged,
        );

      case 'CPF':
        return TextFormField(
          initialValue: value?.toString(),
          keyboardType: TextInputType.number,
          decoration: InputDecoration(
            labelText: name,
            hintText: '000.000.000-00',
          ),
          inputFormatters: [
            FilteringTextInputFormatter.digitsOnly,
            LengthLimitingTextInputFormatter(11),
            _CpfInputFormatter(),
          ],
          validator: (v) {
            if (required && (v == null || v.isEmpty)) return '$name obrigatorio';
            if (v != null && v.isNotEmpty) {
              final digits = v.replaceAll(RegExp(r'\D'), '');
              if (digits.length != 11) return 'CPF deve ter 11 digitos';
            }
            return null;
          },
          onChanged: onChanged,
        );

      case 'CNPJ':
        return TextFormField(
          initialValue: value?.toString(),
          keyboardType: TextInputType.number,
          decoration: InputDecoration(
            labelText: name,
            hintText: '00.000.000/0000-00',
          ),
          inputFormatters: [
            FilteringTextInputFormatter.digitsOnly,
            LengthLimitingTextInputFormatter(14),
            _CnpjInputFormatter(),
          ],
          validator: (v) {
            if (required && (v == null || v.isEmpty)) return '$name obrigatorio';
            if (v != null && v.isNotEmpty) {
              final digits = v.replaceAll(RegExp(r'\D'), '');
              if (digits.length != 14) return 'CNPJ deve ter 14 digitos';
            }
            return null;
          },
          onChanged: onChanged,
        );

      case 'CEP':
        return TextFormField(
          initialValue: value?.toString(),
          keyboardType: TextInputType.number,
          decoration: InputDecoration(
            labelText: name,
            hintText: '00000-000',
          ),
          inputFormatters: [
            FilteringTextInputFormatter.digitsOnly,
            LengthLimitingTextInputFormatter(8),
            _CepInputFormatter(),
          ],
          validator: (v) {
            if (required && (v == null || v.isEmpty)) return '$name obrigatorio';
            if (v != null && v.isNotEmpty) {
              final digits = v.replaceAll(RegExp(r'\D'), '');
              if (digits.length != 8) return 'CEP deve ter 8 digitos';
            }
            return null;
          },
          onChanged: onChanged,
        );

      case 'PERCENTAGE':
        return TextFormField(
          initialValue: value?.toString(),
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: InputDecoration(
            labelText: name,
            suffixText: '%',
            hintText: placeholder,
            helperText: helpText,
          ),
          validator: required
              ? (v) => (v == null || v.isEmpty) ? '$name obrigatorio' : null
              : null,
          onChanged: (v) => onChanged(num.tryParse(v) ?? v),
        );

      case 'TIME':
        return _TimeFieldInput(
          label: name,
          value: value?.toString(),
          required: required,
          onChanged: onChanged,
        );

      case 'RATING':
        return _RatingFieldInput(
          label: name,
          value: (num.tryParse(value?.toString() ?? '') ?? 0).toInt(),
          required: required,
          onChanged: onChanged,
        );

      case 'COLOR':
        return _ColorFieldInput(
          label: name,
          value: value?.toString(),
          required: required,
          onChanged: onChanged,
        );

      case 'PASSWORD':
        return _PasswordFieldInput(
          label: name,
          value: value?.toString(),
          required: required,
          onChanged: onChanged,
        );

      case 'SLIDER':
        return _SliderFieldInput(
          label: name,
          value: (num.tryParse(value?.toString() ?? '') ?? 0).toDouble(),
          min: (field['min'] as num?)?.toDouble() ?? 0,
          max: (field['max'] as num?)?.toDouble() ?? 100,
          required: required,
          onChanged: onChanged,
        );

      case 'JSON':
        return TextFormField(
          initialValue: value is String ? value?.toString() : _prettyJson(value),
          maxLines: 6,
          decoration: InputDecoration(
            labelText: name,
            alignLabelWithHint: true,
            hintText: '{"key": "value"}',
          ),
          style: AppTypography.bodySmall.copyWith(fontFamily: 'monospace'),
          validator: (v) {
            if (required && (v == null || v.isEmpty)) return '$name obrigatorio';
            if (v != null && v.isNotEmpty) {
              try {
                jsonDecode(v);
              } catch (_) {
                return 'JSON invalido';
              }
            }
            return null;
          },
          onChanged: onChanged,
        );

      case 'ARRAY':
        return _ArrayFieldInput(
          label: name,
          value: value is List ? List<String>.from(value.map((e) => e.toString())) : null,
          required: required,
          onChanged: onChanged,
        );

      case 'RELATION':
        return _RelationFieldInput(
          label: name,
          value: value?.toString(),
          required: required,
          field: field,
          onChanged: onChanged,
        );

      case 'HIDDEN':
        return const SizedBox.shrink();

      // Default: text input
      default:
        return TextFormField(
          initialValue: value?.toString(),
          decoration: InputDecoration(labelText: name, hintText: placeholder, helperText: helpText),
          validator: required
              ? (v) => (v == null || v.isEmpty) ? '$name obrigatorio' : null
              : null,
          onChanged: onChanged,
        );
    }
  }
}

class _MultiSelectFieldInput extends StatefulWidget {
  const _MultiSelectFieldInput({
    required this.label,
    this.options,
    this.value,
    required this.required,
    required this.onChanged,
  });

  final String label;
  final List<dynamic>? options;
  final List<String>? value;
  final bool required;
  final ValueChanged<dynamic> onChanged;

  @override
  State<_MultiSelectFieldInput> createState() => _MultiSelectFieldInputState();
}

class _MultiSelectFieldInputState extends State<_MultiSelectFieldInput> {
  late List<String> _selected;

  @override
  void initState() {
    super.initState();
    _selected = List<String>.from(widget.value ?? []);
  }

  List<String> get _opts {
    return widget.options?.map((o) {
      if (o is Map) return o['value']?.toString() ?? o.toString();
      return o.toString();
    }).toList() ?? [];
  }

  void _toggle(String option) {
    setState(() {
      if (_selected.contains(option)) {
        _selected.remove(option);
      } else {
        _selected.add(option);
      }
    });
    widget.onChanged(List<String>.from(_selected));
  }

  @override
  Widget build(BuildContext context) {
    return FormField<List<String>>(
      initialValue: _selected,
      validator: widget.required
          ? (v) => (v == null || v.isEmpty)
              ? '${widget.label} obrigatorio'
              : null
          : null,
      builder: (fieldState) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.label, style: AppTypography.labelLarge),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: _opts.map((opt) {
                final isSelected = _selected.contains(opt);
                return FilterChip(
                  label: Text(opt),
                  selected: isSelected,
                  onSelected: (_) => _toggle(opt),
                  selectedColor: AppColors.primary.withValues(alpha: 0.15),
                  checkmarkColor: AppColors.primary,
                );
              }).toList(),
            ),
            if (fieldState.hasError)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  fieldState.errorText!,
                  style: AppTypography.caption.copyWith(color: AppColors.error),
                ),
              ),
          ],
        );
      },
    );
  }
}

class _DateFieldInput extends StatelessWidget {
  const _DateFieldInput({
    required this.label,
    this.value,
    required this.required,
    required this.onChanged,
  });

  final String label;
  final String? value;
  final bool required;
  final ValueChanged<dynamic> onChanged;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      readOnly: true,
      controller: TextEditingController(text: value),
      decoration: InputDecoration(
        labelText: label,
        suffixIcon: const Icon(Icons.calendar_today),
      ),
      validator: required
          ? (v) => (v == null || v.isEmpty) ? '$label obrigatorio' : null
          : null,
      onTap: () async {
        final date = await showDatePicker(
          context: context,
          initialDate: DateTime.now(),
          firstDate: DateTime(2000),
          lastDate: DateTime(2100),
        );
        if (date != null) {
          onChanged(date.toIso8601String().split('T').first);
        }
      },
    );
  }
}

class _DateTimeFieldInput extends StatelessWidget {
  const _DateTimeFieldInput({
    required this.label,
    this.value,
    required this.required,
    required this.onChanged,
  });

  final String label;
  final String? value;
  final bool required;
  final ValueChanged<dynamic> onChanged;

  String _formatDisplay(String? val) {
    if (val == null || val.isEmpty) return '';
    try {
      final dt = DateTime.parse(val);
      final date =
          '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year}';
      final time =
          '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
      return '$date $time';
    } catch (_) {
      return val;
    }
  }

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      readOnly: true,
      controller: TextEditingController(text: _formatDisplay(value)),
      decoration: InputDecoration(
        labelText: label,
        suffixIcon: const Icon(Icons.calendar_month),
      ),
      validator: required
          ? (v) => (v == null || v.isEmpty) ? '$label obrigatorio' : null
          : null,
      onTap: () async {
        final now = DateTime.now();
        DateTime initial = now;
        if (value != null && value!.isNotEmpty) {
          try {
            initial = DateTime.parse(value!);
          } catch (_) {}
        }

        final date = await showDatePicker(
          context: context,
          initialDate: initial,
          firstDate: DateTime(2000),
          lastDate: DateTime(2100),
        );
        if (date == null || !context.mounted) return;

        final time = await showTimePicker(
          context: context,
          initialTime: TimeOfDay.fromDateTime(initial),
        );
        if (time == null) return;

        final combined = DateTime(
          date.year,
          date.month,
          date.day,
          time.hour,
          time.minute,
        );
        onChanged(combined.toIso8601String());
      },
    );
  }
}

class _TimeFieldInput extends StatelessWidget {
  const _TimeFieldInput({
    required this.label,
    this.value,
    required this.required,
    required this.onChanged,
  });

  final String label;
  final String? value;
  final bool required;
  final ValueChanged<dynamic> onChanged;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      readOnly: true,
      controller: TextEditingController(text: value ?? ''),
      decoration: InputDecoration(
        labelText: label,
        suffixIcon: const Icon(Icons.access_time),
      ),
      validator: required
          ? (v) => (v == null || v.isEmpty) ? '$label obrigatorio' : null
          : null,
      onTap: () async {
        TimeOfDay initial = TimeOfDay.now();
        if (value != null && value!.contains(':')) {
          final parts = value!.split(':');
          initial = TimeOfDay(
            hour: int.tryParse(parts[0]) ?? 0,
            minute: int.tryParse(parts[1]) ?? 0,
          );
        }

        final time = await showTimePicker(
          context: context,
          initialTime: initial,
        );
        if (time != null) {
          final formatted =
              '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
          onChanged(formatted);
        }
      },
    );
  }
}

class _RatingFieldInput extends StatefulWidget {
  const _RatingFieldInput({
    required this.label,
    required this.value,
    required this.required,
    required this.onChanged,
  });

  final String label;
  final int value;
  final bool required;
  final ValueChanged<dynamic> onChanged;

  @override
  State<_RatingFieldInput> createState() => _RatingFieldInputState();
}

class _RatingFieldInputState extends State<_RatingFieldInput> {
  late int _rating;

  @override
  void initState() {
    super.initState();
    _rating = widget.value;
  }

  @override
  Widget build(BuildContext context) {
    return FormField<int>(
      initialValue: _rating,
      validator: widget.required
          ? (v) => (v == null || v == 0) ? '${widget.label} obrigatorio' : null
          : null,
      builder: (fieldState) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(widget.label, style: AppTypography.labelLarge),
          const SizedBox(height: 8),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: List.generate(5, (i) {
              final starIndex = i + 1;
              return GestureDetector(
                onTap: () {
                  setState(() => _rating = starIndex);
                  widget.onChanged(starIndex);
                },
                child: Icon(
                  starIndex <= _rating ? Icons.star : Icons.star_border,
                  color: AppColors.warning,
                  size: 32,
                ),
              );
            }),
          ),
          if (fieldState.hasError)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                fieldState.errorText!,
                style: AppTypography.caption.copyWith(color: AppColors.error),
              ),
            ),
        ],
      ),
    );
  }
}

class _ColorFieldInput extends StatelessWidget {
  const _ColorFieldInput({
    required this.label,
    this.value,
    required this.required,
    required this.onChanged,
  });

  final String label;
  final String? value;
  final bool required;
  final ValueChanged<dynamic> onChanged;

  static const _presetColors = [
    '#EF4444', '#F97316', '#EAB308', '#22C55E',
    '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899',
    '#1E293B', '#64748B', '#FFFFFF',
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: AppTypography.labelLarge),
        const SizedBox(height: 8),
        Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: value != null ? _parseColor(value!) : AppColors.muted,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.border),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: TextFormField(
                initialValue: value,
                decoration: const InputDecoration(hintText: '#000000'),
                validator: required
                    ? (v) => (v == null || v.isEmpty)
                        ? '$label obrigatorio'
                        : null
                    : null,
                onChanged: onChanged,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: _presetColors.map((hex) => GestureDetector(
            onTap: () => onChanged(hex),
            child: Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                color: _parseColor(hex),
                borderRadius: BorderRadius.circular(4),
                border: Border.all(
                  color: value == hex ? AppColors.primary : AppColors.border,
                  width: value == hex ? 2 : 1,
                ),
              ),
            ),
          )).toList(),
        ),
      ],
    );
  }
}

/// Brazilian CPF mask: 000.000.000-00
class _CpfInputFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final digits = newValue.text.replaceAll(RegExp(r'\D'), '');
    final buf = StringBuffer();
    for (var i = 0; i < digits.length && i < 11; i++) {
      if (i == 3 || i == 6) buf.write('.');
      if (i == 9) buf.write('-');
      buf.write(digits[i]);
    }
    return TextEditingValue(
      text: buf.toString(),
      selection: TextSelection.collapsed(offset: buf.length),
    );
  }
}

/// Brazilian CNPJ mask: 00.000.000/0000-00
class _CnpjInputFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final digits = newValue.text.replaceAll(RegExp(r'\D'), '');
    final buf = StringBuffer();
    for (var i = 0; i < digits.length && i < 14; i++) {
      if (i == 2 || i == 5) buf.write('.');
      if (i == 8) buf.write('/');
      if (i == 12) buf.write('-');
      buf.write(digits[i]);
    }
    return TextEditingValue(
      text: buf.toString(),
      selection: TextSelection.collapsed(offset: buf.length),
    );
  }
}

/// Brazilian CEP mask: 00000-000
class _CepInputFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final digits = newValue.text.replaceAll(RegExp(r'\D'), '');
    final buf = StringBuffer();
    for (var i = 0; i < digits.length && i < 8; i++) {
      if (i == 5) buf.write('-');
      buf.write(digits[i]);
    }
    return TextEditingValue(
      text: buf.toString(),
      selection: TextSelection.collapsed(offset: buf.length),
    );
  }
}

String _prettyJson(dynamic value) {
  if (value == null) return '';
  try {
    const encoder = JsonEncoder.withIndent('  ');
    if (value is String) return encoder.convert(jsonDecode(value));
    return encoder.convert(value);
  } catch (_) {
    return value.toString();
  }
}

class _PasswordFieldInput extends StatefulWidget {
  const _PasswordFieldInput({
    required this.label,
    this.value,
    required this.required,
    required this.onChanged,
  });

  final String label;
  final String? value;
  final bool required;
  final ValueChanged<dynamic> onChanged;

  @override
  State<_PasswordFieldInput> createState() => _PasswordFieldInputState();
}

class _PasswordFieldInputState extends State<_PasswordFieldInput> {
  bool _obscure = true;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      initialValue: widget.value,
      obscureText: _obscure,
      decoration: InputDecoration(
        labelText: widget.label,
        suffixIcon: IconButton(
          icon: Icon(_obscure ? Icons.visibility_off : Icons.visibility),
          onPressed: () => setState(() => _obscure = !_obscure),
        ),
      ),
      validator: widget.required
          ? (v) => (v == null || v.isEmpty)
              ? '${widget.label} obrigatorio'
              : null
          : null,
      onChanged: widget.onChanged,
    );
  }
}

class _SliderFieldInput extends StatefulWidget {
  const _SliderFieldInput({
    required this.label,
    required this.value,
    required this.min,
    required this.max,
    required this.required,
    required this.onChanged,
  });

  final String label;
  final double value;
  final double min;
  final double max;
  final bool required;
  final ValueChanged<dynamic> onChanged;

  @override
  State<_SliderFieldInput> createState() => _SliderFieldInputState();
}

class _SliderFieldInputState extends State<_SliderFieldInput> {
  late double _value;

  @override
  void initState() {
    super.initState();
    _value = widget.value.clamp(widget.min, widget.max);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(widget.label, style: AppTypography.labelLarge),
            Text(
              _value.round().toString(),
              style: AppTypography.bodyMedium.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        Slider(
          value: _value,
          min: widget.min,
          max: widget.max,
          divisions: (widget.max - widget.min).round(),
          onChanged: (v) {
            setState(() => _value = v);
            widget.onChanged(v.round());
          },
        ),
      ],
    );
  }
}

class _ArrayFieldInput extends StatefulWidget {
  const _ArrayFieldInput({
    required this.label,
    this.value,
    required this.required,
    required this.onChanged,
  });

  final String label;
  final List<String>? value;
  final bool required;
  final ValueChanged<dynamic> onChanged;

  @override
  State<_ArrayFieldInput> createState() => _ArrayFieldInputState();
}

class _ArrayFieldInputState extends State<_ArrayFieldInput> {
  late List<String> _items;
  final _controller = TextEditingController();

  @override
  void initState() {
    super.initState();
    _items = List<String>.from(widget.value ?? []);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _addItem() {
    final text = _controller.text.trim();
    if (text.isEmpty) return;
    setState(() => _items.add(text));
    _controller.clear();
    widget.onChanged(List<String>.from(_items));
  }

  void _removeItem(int index) {
    setState(() => _items.removeAt(index));
    widget.onChanged(List<String>.from(_items));
  }

  @override
  Widget build(BuildContext context) {
    return FormField<List<String>>(
      initialValue: _items,
      validator: widget.required
          ? (v) => (v == null || v.isEmpty)
              ? '${widget.label} obrigatorio'
              : null
          : null,
      builder: (fieldState) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(widget.label, style: AppTypography.labelLarge),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _controller,
                  decoration: const InputDecoration(
                    hintText: 'Adicionar item...',
                    isDense: true,
                  ),
                  onSubmitted: (_) => _addItem(),
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                icon: const Icon(Icons.add_circle_outline),
                onPressed: _addItem,
              ),
            ],
          ),
          const SizedBox(height: 8),
          ...List.generate(_items.length, (i) => Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Row(
              children: [
                Expanded(
                  child: Chip(
                    label: Text(_items[i]),
                    deleteIcon: const Icon(Icons.close, size: 16),
                    onDeleted: () => _removeItem(i),
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                ),
              ],
            ),
          )),
          if (fieldState.hasError)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                fieldState.errorText!,
                style: AppTypography.caption.copyWith(color: AppColors.error),
              ),
            ),
        ],
      ),
    );
  }
}

/// Relation field: searches and selects a record from another entity.
class _RelationFieldInput extends StatefulWidget {
  const _RelationFieldInput({
    required this.label,
    this.value,
    required this.required,
    required this.field,
    required this.onChanged,
  });

  final String label;
  final String? value;
  final bool required;
  final Map<String, dynamic> field;
  final ValueChanged<dynamic> onChanged;

  @override
  State<_RelationFieldInput> createState() => _RelationFieldInputState();
}

class _RelationFieldInputState extends State<_RelationFieldInput> {
  List<Map<String, dynamic>> _options = [];
  String? _selectedId;
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    _selectedId = widget.value;
    _loadRelatedRecords();
  }

  Future<void> _loadRelatedRecords() async {
    final relatedEntityId = widget.field['relationEntityId'] as String?;
    if (relatedEntityId == null) {
      setState(() => _loaded = true);
      return;
    }

    final db = AppDatabase.instance.db;
    final records = await db.getAll(
      'SELECT id, data FROM EntityData WHERE entityId = ? AND parentRecordId IS NULL AND deletedAt IS NULL ORDER BY createdAt DESC LIMIT 100',
      [relatedEntityId],
    );

    setState(() {
      _options = records;
      _loaded = true;
    });
  }

  String _getRecordLabel(Map<String, dynamic> record) {
    try {
      final data = jsonDecode(record['data'] as String? ?? '{}');
      if (data is Map) {
        // Use first non-empty value as label
        for (final v in data.values) {
          if (v != null && v.toString().isNotEmpty) {
            return v.toString();
          }
        }
      }
    } catch (_) {}
    return record['id'] as String? ?? 'Registro';
  }

  String? get _selectedLabel {
    if (_selectedId == null) return null;
    for (final r in _options) {
      if (r['id'] == _selectedId) return _getRecordLabel(r);
    }
    return _selectedId;
  }

  Future<void> _showSearchPicker(BuildContext context) async {
    final result = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _RelationSearchSheet(
        options: _options,
        selectedId: _selectedId,
        getLabel: _getRecordLabel,
        label: widget.label,
      ),
    );
    if (result != null) {
      setState(() => _selectedId = result);
      widget.onChanged(result);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_loaded) {
      return InputDecorator(
        decoration: InputDecoration(labelText: widget.label),
        child: const SizedBox(
          height: 20,
          child: LinearProgressIndicator(minHeight: 2),
        ),
      );
    }

    // For few items use simple dropdown, for many use searchable sheet
    if (_options.length <= 10) {
      final items = _options.map((r) {
        final id = r['id'] as String;
        return DropdownMenuItem(
          value: id,
          child: Text(
            _getRecordLabel(r),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        );
      }).toList();

      return DropdownButtonFormField<String>(
        value: _selectedId,
        decoration: InputDecoration(labelText: widget.label),
        isExpanded: true,
        items: items,
        validator: widget.required
            ? (v) => (v == null || v.isEmpty)
                ? '${widget.label} obrigatorio'
                : null
            : null,
        onChanged: (v) {
          setState(() => _selectedId = v);
          widget.onChanged(v);
        },
      );
    }

    // Searchable picker for many items
    return FormField<String>(
      initialValue: _selectedId,
      validator: widget.required
          ? (v) => (v == null || v.isEmpty)
              ? '${widget.label} obrigatorio'
              : null
          : null,
      builder: (fieldState) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: () => _showSearchPicker(context),
            child: InputDecorator(
              decoration: InputDecoration(
                labelText: widget.label,
                suffixIcon: const Icon(Icons.search),
                errorText: fieldState.errorText,
              ),
              child: Text(
                _selectedLabel ?? 'Selecionar...',
                style: _selectedLabel != null
                    ? AppTypography.bodyMedium
                    : AppTypography.bodyMedium.copyWith(color: AppColors.mutedForeground),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _RelationSearchSheet extends StatefulWidget {
  const _RelationSearchSheet({
    required this.options,
    this.selectedId,
    required this.getLabel,
    required this.label,
  });

  final List<Map<String, dynamic>> options;
  final String? selectedId;
  final String Function(Map<String, dynamic>) getLabel;
  final String label;

  @override
  State<_RelationSearchSheet> createState() => _RelationSearchSheetState();
}

class _RelationSearchSheetState extends State<_RelationSearchSheet> {
  String _search = '';

  List<Map<String, dynamic>> get _filtered {
    if (_search.isEmpty) return widget.options;
    final q = _search.toLowerCase();
    return widget.options.where((r) {
      return widget.getLabel(r).toLowerCase().contains(q);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      minChildSize: 0.3,
      maxChildSize: 0.9,
      expand: false,
      builder: (context, scrollController) => Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: TextField(
              autofocus: true,
              decoration: InputDecoration(
                hintText: 'Buscar ${widget.label}...',
                prefixIcon: const Icon(Icons.search),
                isDense: true,
              ),
              onChanged: (v) => setState(() => _search = v),
            ),
          ),
          Expanded(
            child: ListView.builder(
              controller: scrollController,
              itemCount: _filtered.length,
              itemBuilder: (context, index) {
                final record = _filtered[index];
                final id = record['id'] as String;
                final isSelected = id == widget.selectedId;
                return ListTile(
                  title: Text(
                    widget.getLabel(record),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  trailing: isSelected
                      ? const Icon(Icons.check, color: AppColors.primary)
                      : null,
                  selected: isSelected,
                  onTap: () => Navigator.of(context).pop(id),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
