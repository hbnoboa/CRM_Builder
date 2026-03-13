import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:crm_mobile/core/auth/secure_storage.dart';
import 'package:crm_mobile/core/cache/crm_cache_manager.dart';
import 'package:crm_mobile/core/config/env.dart';
import 'package:crm_mobile/core/database/app_database.dart';
import 'package:crm_mobile/core/theme/app_colors.dart';
import 'package:crm_mobile/core/theme/app_colors_extension.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:crm_mobile/features/data/widgets/image_field_input.dart';
import 'package:crm_mobile/features/data/widgets/map_field_input.dart';
import 'package:crm_mobile/features/data/widgets/zone_diagram_field.dart';
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
    // Prioridade: label > name > slug formatado
    final slug = field['slug'] as String? ?? '';
    var name = field['label'] as String? ?? field['name'] as String?;
    if (name == null || name.isEmpty) {
      name = slug.replaceAll('_', ' ');
      if (name.isNotEmpty) {
        name = name[0].toUpperCase() + name.substring(1);
      }
    }
    final type = (field['type'] as String? ?? 'text').toUpperCase().replaceAll('-', '_');

    return GestureDetector(
      onLongPress: () => _copyValue(context, type),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            name,
            style: AppTypography.labelMedium.copyWith(
              color: context.colors.mutedForeground,
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
      const SnackBar(
        content: Text('Copiado'),
        duration: Duration(seconds: 1),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Widget _buildValue(String type, BuildContext context) {
    if (value == null || (value is String && value.toString().isEmpty)) {
      return Text(
        '-',
        style: AppTypography.bodyMedium.copyWith(
          color: context.colors.mutedForeground,
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
              placeholder: (ctx, __) => Container(
                height: 200,
                color: ctx.colors.muted,
                child: const Center(child: CircularProgressIndicator()),
              ),
              errorWidget: (ctx, __, ___) => Container(
                height: 200,
                color: ctx.colors.muted,
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
              color: boolVal ? context.colors.success : context.colors.mutedForeground,
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
      case 'API_SELECT':
        // Handle {label, value} objects
        String selectLabel;
        if (value is Map<String, dynamic>) {
          selectLabel = value['label']?.toString() ?? value['value']?.toString() ?? '-';
        } else {
          selectLabel = value.toString();
        }
        return Chip(label: Text(selectLabel));

      case 'MULTI_SELECT':
        if (value is List) {
          return Wrap(
            spacing: 8,
            runSpacing: 4,
            children: (value as List).map<Widget>((v) {
              // Handle {label, value} objects in array
              String itemLabel;
              if (v is Map<String, dynamic>) {
                itemLabel = v['label']?.toString() ?? v['value']?.toString() ?? '';
              } else {
                itemLabel = v.toString();
              }
              return Chip(label: Text(itemLabel));
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
        return Text('$value%', style: AppTypography.bodyMedium);

      case 'TEXTAREA':
      case 'RICH_TEXT':
        return Text(value.toString(), style: AppTypography.bodyMedium);

      case 'URL':
        return GestureDetector(
          onTap: () => _launchUrl(value.toString()),
          child: Text(
            value.toString(),
            style: AppTypography.bodyMedium.copyWith(
              color: context.colors.info,
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
              color: context.colors.info,
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
              Icon(Icons.phone, size: 16, color: context.colors.info),
              const SizedBox(width: 6),
              Text(
                value.toString(),
                style: AppTypography.bodyMedium.copyWith(
                  color: context.colors.info,
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
            color: context.colors.warning,
            size: 20,
          ),),
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
                border: Border.all(color: context.colors.border),
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
            color: context.colors.mutedForeground,
          ),
        );

      case 'SLIDER':
        final num numVal = num.tryParse(value.toString()) ?? 0;
        return Row(
          children: [
            Expanded(
              child: LinearProgressIndicator(
                value: (numVal / 100).clamp(0.0, 1.0).toDouble(),
                backgroundColor: context.colors.muted,
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
            color: context.colors.muted,
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
        // Handle {label, value} objects for relations
        String relationLabel;
        if (value is Map<String, dynamic>) {
          relationLabel = value['label']?.toString() ?? value['value']?.toString() ?? '-';
        } else {
          relationLabel = value.toString();
        }
        return Text(relationLabel, style: AppTypography.bodyMedium);

      case 'MAP':
        return MapFieldDisplay(
          value: value,
          fieldName: '',
        );

      case 'ZONE-DIAGRAM':
      case 'ZONE_DIAGRAM':
        return ZoneDiagramFieldDisplay(
          field: field,
          value: value,
        );

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
                  color: context.colors.muted,
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
              color: context.colors.warning,
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

Color _parseColor(String hex, [BuildContext? context]) {
  try {
    return Color(int.parse(hex.replaceFirst('#', '0xFF')));
  } catch (_) {
    return context?.colors.muted ?? AppColors.muted;
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
    this.enabled = true,
    this.onAutoFill,
    this.allFields,
    this.entitySlug = '',
    this.recordId = '',
  });

  final Map<String, dynamic> field;
  final dynamic value;
  final ValueChanged<dynamic> onChanged;
  final bool enabled;

  /// Callback to auto-fill other form fields (used by api-select).
  /// Receives a map of { fieldSlug: value } to update.
  final void Function(Map<String, dynamic>)? onAutoFill;

  /// All entity fields (needed for api-select to resolve autoFillFields targets).
  final List<dynamic>? allFields;

  /// Context for image upload queue (needed to update record after upload).
  final String entitySlug;
  final String recordId;

  @override
  Widget build(BuildContext context) {
    // If disabled (field-level permissions), show read-only display instead
    if (!enabled) {
      return Opacity(
        opacity: 0.6,
        child: DynamicFieldDisplay(field: field, value: value),
      );
    }

    // Prioridade: label > name > slug formatado
    final slug = field['slug'] as String? ?? '';
    var name = field['label'] as String? ?? field['name'] as String?;
    if (name == null || name.isEmpty) {
      // Converte slug para formato legivel: nao_conformidade -> Nao conformidade
      name = slug.replaceAll('_', ' ');
      if (name.isNotEmpty) {
        name = name[0].toUpperCase() + name.substring(1);
      }
    }
    final type = (field['type'] as String? ?? 'text').toUpperCase().replaceAll('-', '_');
    final required = field['required'] == true;
    final options = field['options'] as List<dynamic>?;
    final helpText = field['helpText'] as String?;
    final placeholder = field['placeholder'] as String?;

    // Debug: print field type for zone-diagram fields
    if (slug == 'peca' || type == 'ZONE_DIAGRAM') {
      debugPrint('[DynamicFieldInput] slug=$slug, type=$type, rawType=${field['type']}, hasZones=${field['diagramZones'] != null}');
    }

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
        return _SelectFieldInput(
          label: name,
          options: options,
          value: value, // Pass as-is, can be String, Map, or null
          required: required,
          onChanged: onChanged,
          placeholder: placeholder,
          helpText: helpText,
        );

      case 'API_SELECT':
        return _ApiSelectFieldInput(
          label: name,
          field: field,
          value: value,
          required: required,
          onChanged: onChanged,
          onAutoFill: onAutoFill,
          allFields: allFields,
          placeholder: placeholder,
          helpText: helpText,
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
          value: value, // Pass as-is, can be List of strings or List of {label,value} Maps
          required: required,
          onChanged: onChanged,
        );

      case 'IMAGE':
      case 'FILE':
        // Parse image source configuration from field settings
        // Supports: imageSource ('camera'/'gallery'/'both'), cameraOnly, allowCamera, allowGallery
        final imageSource = (field['imageSource'] as String?)?.toLowerCase();
        final cameraOnly = field['cameraOnly'] == true;
        var allowCamera = field['allowCamera'] != false; // Default true
        var allowGallery = field['allowGallery'] != false; // Default true

        // imageSource takes precedence
        if (imageSource == 'camera') {
          allowCamera = true;
          allowGallery = false;
        } else if (imageSource == 'gallery') {
          allowCamera = false;
          allowGallery = true;
        } else if (imageSource == 'both') {
          allowCamera = true;
          allowGallery = true;
        }

        // cameraOnly flag overrides
        if (cameraOnly) {
          allowCamera = true;
          allowGallery = false;
        }

        return ImageFieldInput(
          label: name,
          value: value?.toString(),
          fieldType: type,
          isRequired: required,
          onChanged: onChanged,
          entitySlug: entitySlug,
          recordId: recordId,
          fieldSlug: slug,
          allowCamera: allowCamera,
          allowGallery: allowGallery,
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
          value: value, // Pass as-is, can be String, Map, or null
          required: required,
          field: field,
          onChanged: onChanged,
          onAutoFill: onAutoFill,
          allFields: allFields,
        );

      case 'MAP':
        return MapFieldInput(
          field: field,
          value: value,
          onChanged: onChanged,
          enabled: enabled,
        );

      case 'ZONE-DIAGRAM':
      case 'ZONE_DIAGRAM':
        return ZoneDiagramFieldInput(
          field: field,
          value: value,
          onChanged: onChanged,
          enabled: enabled,
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
  final dynamic value; // Can be List<String> or List<{label, value}>
  final bool required;
  final ValueChanged<dynamic> onChanged;

  @override
  State<_MultiSelectFieldInput> createState() => _MultiSelectFieldInputState();
}

class _MultiSelectFieldInputState extends State<_MultiSelectFieldInput> {
  late List<String> _selected;
  final Map<String, String> _cachedLabels = {}; // value -> label cache

  @override
  void initState() {
    super.initState();
    // Handle initial value which can be:
    // - List of strings
    // - List of {label, value} objects (from edit form)
    _selected = [];
    final initialValue = widget.value;
    if (initialValue is List) {
      for (final item in initialValue) {
        if (item is Map<String, dynamic>) {
          final val = item['value']?.toString();
          if (val != null && val.isNotEmpty) {
            _selected.add(val);
            final lbl = item['label']?.toString();
            if (lbl != null) _cachedLabels[val] = lbl;
          }
        } else if (item != null) {
          _selected.add(item.toString());
        }
      }
    }
  }

  List<_SimpleOption> get _opts {
    return widget.options?.map((o) {
      if (o is Map) {
        final val = o['value']?.toString() ?? o.toString();
        final label = o['label']?.toString() ?? val;
        return _SimpleOption(value: val, label: label);
      }
      return _SimpleOption(value: o.toString(), label: o.toString());
    }).toList() ?? [];
  }

  Future<void> _openSheet() async {
    final result = await showModalBottomSheet<List<String>>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _SearchableSelectSheet(
        options: _opts,
        selectedValues: _selected,
        label: widget.label,
        multiple: true,
        allowCustom: true,
      ),
    );
    if (result != null) {
      // Update cached labels for new selections
      for (final val in result) {
        if (!_cachedLabels.containsKey(val)) {
          final opt = _opts.where((o) => o.value == val).firstOrNull;
          _cachedLabels[val] = opt?.label ?? val;
        }
      }
      setState(() => _selected = result);
      // Send list of {label, value} objects to match backend format
      final formattedList = result.map((val) {
        return {'label': _cachedLabels[val] ?? val, 'value': val};
      }).toList();
      widget.onChanged(formattedList);
    }
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
            InkWell(
              onTap: _openSheet,
              child: InputDecorator(
                decoration: InputDecoration(
                  labelText: widget.label,
                  suffixIcon: const Icon(Icons.arrow_drop_down),
                  errorText: fieldState.errorText,
                ),
                child: _selected.isEmpty
                    ? Text(
                        'Selecionar...',
                        style: AppTypography.bodyMedium.copyWith(
                          color: context.colors.mutedForeground,
                        ),
                      )
                    : Wrap(
                        spacing: 4,
                        runSpacing: 4,
                        children: _selected.map((val) {
                          final opt = _opts.where((o) => o.value == val).firstOrNull;
                          // Use option label, then cached label, then value
                          final displayLabel = opt?.label ?? _cachedLabels[val] ?? val;
                          return Chip(
                            label: Text(displayLabel, style: const TextStyle(fontSize: 12)),
                            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            visualDensity: VisualDensity.compact,
                          );
                        }).toList(),
                      ),
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
                  color: context.colors.warning,
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
                style: AppTypography.caption.copyWith(color: context.colors.destructive),
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
                color: value != null ? _parseColor(value!, context) : context.colors.muted,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: context.colors.border),
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
                color: _parseColor(hex, context),
                borderRadius: BorderRadius.circular(4),
                border: Border.all(
                  color: value == hex ? Theme.of(context).colorScheme.primary : context.colors.border,
                  width: value == hex ? 2 : 1,
                ),
              ),
            ),
          ),).toList(),
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
          ),),
          if (fieldState.hasError)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                fieldState.errorText!,
                style: AppTypography.caption.copyWith(color: context.colors.destructive),
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
    this.onAutoFill,
    this.allFields,
  });

  final String label;
  final dynamic value; // Can be String or {label, value} Map
  final bool required;
  final Map<String, dynamic> field;
  final ValueChanged<dynamic> onChanged;
  final void Function(Map<String, dynamic>)? onAutoFill;
  final List<dynamic>? allFields;

  @override
  State<_RelationFieldInput> createState() => _RelationFieldInputState();
}

class _RelationFieldInputState extends State<_RelationFieldInput> {
  List<Map<String, dynamic>> _options = [];
  String? _selectedId;
  String? _cachedLabel; // Cached label from initial value (for edit forms)
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    // Handle initial value which can be:
    // - String (just the ID)
    // - Map with {label, value} structure (from edit form)
    // - String JSON like "{label: X, value: Y}" that needs parsing
    final initialValue = widget.value;
    if (initialValue is Map<String, dynamic>) {
      _selectedId = initialValue['value']?.toString();
      _cachedLabel = initialValue['label']?.toString();
    } else if (initialValue is String && initialValue.isNotEmpty) {
      // Check if it's a JSON string that needs parsing
      if (initialValue.startsWith('{') && initialValue.contains('label')) {
        try {
          final parsed = jsonDecode(initialValue);
          if (parsed is Map<String, dynamic>) {
            _selectedId = parsed['value']?.toString();
            _cachedLabel = parsed['label']?.toString();
          }
        } catch (_) {
          _selectedId = initialValue;
        }
      } else {
        _selectedId = initialValue;
      }
    }
    debugPrint('[RelationField] Init ${widget.label}: id=$_selectedId, label=$_cachedLabel');
    _loadRelatedRecords();
  }

  Future<void> _loadRelatedRecords() async {
    debugPrint('[RelationField] _loadRelatedRecords START for ${widget.label}');
    debugPrint('[RelationField] field keys: ${widget.field.keys.toList()}');

    try {
      // relatedEntityId is the direct entity ID, relatedEntitySlug is the slug
      final relatedEntityId = widget.field['relatedEntityId'] as String?;
      final relatedEntitySlug = widget.field['relatedEntitySlug'] as String?;

      debugPrint('[RelationField] entityId=$relatedEntityId, slug=$relatedEntitySlug');

      if ((relatedEntityId == null || relatedEntityId.isEmpty) &&
          (relatedEntitySlug == null || relatedEntitySlug.isEmpty)) {
        debugPrint('[RelationField] No relatedEntityId or relatedEntitySlug');
        if (mounted) setState(() => _loaded = true);
        return;
      }

      final db = AppDatabase.instance.db;

      // Use relatedEntityId directly if available (it's already the entity ID)
      String? entityId = relatedEntityId;

      // If no entityId but have slug, find the entity ID by slug
      if ((entityId == null || entityId.isEmpty) && relatedEntitySlug != null && relatedEntitySlug.isNotEmpty) {
        final entities = await db.getAll(
          'SELECT id FROM Entity WHERE slug = ? LIMIT 1',
          [relatedEntitySlug],
        );
        if (entities.isNotEmpty) {
          entityId = entities.first['id'] as String?;
        }
        debugPrint('[RelationField] Found entityId=$entityId for slug=$relatedEntitySlug');
      }

      if (entityId == null || entityId.isEmpty) {
        debugPrint('[RelationField] Entity not found');
        if (mounted) setState(() => _loaded = true);
        return;
      }

      debugPrint('[RelationField] Querying EntityData for entityId=$entityId');

      final records = await db.getAll(
        'SELECT id, data FROM ('
        'SELECT id, data, createdAt FROM EntityData WHERE entityId = ? AND parentRecordId IS NULL AND deletedAt IS NULL '
        'UNION ALL '
        'SELECT id, data, createdAt FROM ArchivedEntityData WHERE entityId = ? AND parentRecordId IS NULL'
        ') ORDER BY createdAt DESC LIMIT 100',
        [entityId, entityId],
      );

      debugPrint('[RelationField] Loaded ${records.length} options for ${widget.label}');

      if (mounted) {
        setState(() {
          _options = records;
          _loaded = true;
        });
      }
    } catch (e, stack) {
      debugPrint('[RelationField] Error loading: $e');
      debugPrint('[RelationField] Stack: $stack');
      if (mounted) setState(() => _loaded = true);
    }
  }

  String _getRecordLabel(Map<String, dynamic> record) {
    try {
      final data = jsonDecode(record['data'] as String? ?? '{}');
      if (data is Map) {
        // Use relatedDisplayField if specified
        final displayField = widget.field['relatedDisplayField'] as String?;
        if (displayField != null && displayField.isNotEmpty) {
          final value = data[displayField];
          if (value != null) {
            // Handle {label, value} objects
            if (value is Map && value.containsKey('label')) {
              return value['label']?.toString() ?? '';
            }
            if (value.toString().isNotEmpty) {
              return value.toString();
            }
          }
        }

        // Fallback: use first non-empty string value
        for (final v in data.values) {
          if (v == null) continue;
          // Handle {label, value} objects
          if (v is Map && v.containsKey('label')) {
            final label = v['label']?.toString();
            if (label != null && label.isNotEmpty) return label;
            continue;
          }
          final str = v.toString();
          if (str.isNotEmpty && !str.startsWith('{')) {
            return str;
          }
        }
      }
    } catch (_) {}
    return record['id'] as String? ?? 'Registro';
  }

  String? get _selectedLabel {
    if (_selectedId == null) return null;
    // First try to find in loaded options
    for (final r in _options) {
      if (r['id'] == _selectedId) return _getRecordLabel(r);
    }
    // Fall back to cached label (from initial {label, value} object)
    if (_cachedLabel != null && _cachedLabel!.isNotEmpty) {
      return _cachedLabel;
    }
    // Last resort: show shortened ID
    if (_selectedId!.length > 8) {
      return '${_selectedId!.substring(0, 8)}...';
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
      // Find the record and label
      String? label;
      Map<String, dynamic>? selectedRecord;
      for (final r in _options) {
        if (r['id'] == result) {
          label = _getRecordLabel(r);
          selectedRecord = r;
          break;
        }
      }
      setState(() {
        _selectedId = result;
        _cachedLabel = label;
      });
      // Send {label, value} structure to match backend format
      widget.onChanged({'label': label ?? result, 'value': result});

      // Process onChangeAutoFill if configured
      _processOnChangeAutoFill(result, selectedRecord);
    }
  }

  /// Process onChangeAutoFill rules when a relation is selected
  void _processOnChangeAutoFill(String selectedId, Map<String, dynamic>? selectedRecord) {
    final onChangeAutoFill = widget.field['onChangeAutoFill'] as List<dynamic>?;
    if (onChangeAutoFill == null || onChangeAutoFill.isEmpty || widget.onAutoFill == null) {
      return;
    }

    // Parse the record data
    Map<String, dynamic> recordData = {};
    if (selectedRecord != null) {
      try {
        final dataStr = selectedRecord['data'] as String?;
        if (dataStr != null) {
          recordData = jsonDecode(dataStr) as Map<String, dynamic>;
        }
      } catch (_) {}
    }

    final updates = <String, dynamic>{};

    // Build slug lookup for target field resolution
    final slugLookup = <String, String>{};
    if (widget.allFields != null) {
      for (final f in widget.allFields!) {
        if (f is Map<String, dynamic>) {
          final slug = f['slug'] as String?;
          final name = f['name'] as String?;
          if (slug != null) slugLookup[slug] = slug;
          if (name != null) slugLookup[name] = slug ?? name;
        }
      }
    }

    for (final autoFill in onChangeAutoFill) {
      if (autoFill is! Map<String, dynamic>) continue;

      final sourceField = autoFill['sourceField'] as String?;
      final targetField = autoFill['targetField'] as String?;

      if (targetField == null || targetField.isEmpty) continue;

      // Resolve target field slug
      final resolvedTarget = slugLookup[targetField] ?? targetField;

      if (sourceField != null && sourceField.isNotEmpty) {
        // Copy field from selected record
        var sourceValue = recordData[sourceField];

        // Handle enriched {value, label} objects
        if (sourceValue is Map<String, dynamic> && sourceValue.containsKey('label')) {
          sourceValue = sourceValue['label'];
        }

        if (sourceValue != null) {
          updates[resolvedTarget] = sourceValue;
        }
      }
      // Note: valueTemplate and apiEndpoint not supported yet on mobile
    }

    if (updates.isNotEmpty) {
      debugPrint('[RelationField] onChangeAutoFill updates: $updates');
      widget.onAutoFill!(updates);
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

    // Always use searchable picker
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
                    : AppTypography.bodyMedium.copyWith(color: context.colors.mutedForeground),
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
                      ? Icon(Icons.check, color: Theme.of(context).colorScheme.primary)
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


// ═══════════════════════════════════════════════════════
// SEARCHABLE SELECT (reusable for select, multiselect)
// ═══════════════════════════════════════════════════════

class _SimpleOption {
  const _SimpleOption({required this.value, required this.label});
  final String value;
  final String label;
}

/// Single select field with searchable bottom sheet and "Outro..." option.
class _SelectFieldInput extends StatefulWidget {
  const _SelectFieldInput({
    required this.label,
    this.options,
    this.value,
    required this.required,
    required this.onChanged,
    this.placeholder,
    this.helpText,
  });

  final String label;
  final List<dynamic>? options;
  final dynamic value; // Can be String or {label, value} Map
  final bool required;
  final ValueChanged<dynamic> onChanged;
  final String? placeholder;
  final String? helpText;

  @override
  State<_SelectFieldInput> createState() => _SelectFieldInputState();
}

class _SelectFieldInputState extends State<_SelectFieldInput> {
  String? _selected;
  String? _cachedLabel;

  @override
  void initState() {
    super.initState();
    // Handle initial value which can be:
    // - String (just the value)
    // - Map with {label, value} structure (from edit form)
    final initialValue = widget.value;
    if (initialValue is Map<String, dynamic>) {
      _selected = initialValue['value']?.toString();
      _cachedLabel = initialValue['label']?.toString();
    } else if (initialValue != null) {
      _selected = initialValue.toString();
    }
  }

  List<_SimpleOption> get _opts {
    return widget.options?.map((o) {
      if (o is Map) {
        final val = o['value']?.toString() ?? o.toString();
        final label = o['label']?.toString() ?? val;
        return _SimpleOption(value: val, label: label);
      }
      return _SimpleOption(value: o.toString(), label: o.toString());
    }).toList() ?? [];
  }

  String? get _selectedLabel {
    if (_selected == null) return null;
    // First try to find in options list
    final opt = _opts.where((o) => o.value == _selected).firstOrNull;
    if (opt != null) return opt.label;
    // Fall back to cached label (from initial {label, value} object)
    if (_cachedLabel != null && _cachedLabel!.isNotEmpty) {
      return _cachedLabel;
    }
    return _selected;
  }

  Future<void> _openSheet() async {
    final result = await showModalBottomSheet<List<String>>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _SearchableSelectSheet(
        options: _opts,
        selectedValues: _selected != null ? [_selected!] : [],
        label: widget.label,
        multiple: false,
        allowCustom: true,
      ),
    );
    if (result != null && result.isNotEmpty) {
      final selectedValue = result.first;
      // Find label for selected value
      final opt = _opts.where((o) => o.value == selectedValue).firstOrNull;
      final label = opt?.label ?? selectedValue;
      setState(() {
        _selected = selectedValue;
        _cachedLabel = label;
      });
      // Send {label, value} structure to match backend format
      widget.onChanged({'label': label, 'value': selectedValue});
    }
  }

  @override
  Widget build(BuildContext context) {
    return FormField<String>(
      initialValue: _selected,
      validator: widget.required
          ? (v) => (v == null || v.isEmpty) ? '${widget.label} obrigatorio' : null
          : null,
      builder: (fieldState) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: _openSheet,
            child: InputDecorator(
              decoration: InputDecoration(
                labelText: widget.label,
                hintText: widget.placeholder,
                helperText: widget.helpText,
                suffixIcon: const Icon(Icons.arrow_drop_down),
                errorText: fieldState.errorText,
              ),
              child: Text(
                _selectedLabel ?? 'Selecionar...',
                style: _selectedLabel != null
                    ? AppTypography.bodyMedium
                    : AppTypography.bodyMedium.copyWith(color: context.colors.mutedForeground),
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

/// API Select field: fetches options from API endpoint and allows selection.
/// Supports auto-fill of other fields when a selection is made.
class _ApiSelectFieldInput extends StatefulWidget {
  const _ApiSelectFieldInput({
    required this.label,
    required this.field,
    this.value,
    required this.required,
    required this.onChanged,
    this.onAutoFill,
    this.allFields,
    this.placeholder,
    this.helpText,
  });

  final String label;
  final Map<String, dynamic> field;
  final dynamic value;
  final bool required;
  final ValueChanged<dynamic> onChanged;
  final void Function(Map<String, dynamic>)? onAutoFill;
  final List<dynamic>? allFields;
  final String? placeholder;
  final String? helpText;

  @override
  State<_ApiSelectFieldInput> createState() => _ApiSelectFieldInputState();
}

class _ApiSelectFieldInputState extends State<_ApiSelectFieldInput> {
  List<_SimpleOption> _options = [];
  bool _loading = true;
  String? _selectedValue;
  String? _selectedLabel;

  @override
  void initState() {
    super.initState();
    // Parse initial value (may be string or {label, value} object)
    if (widget.value != null) {
      if (widget.value is Map<String, dynamic>) {
        _selectedValue = widget.value['value']?.toString();
        _selectedLabel = widget.value['label']?.toString();
      } else {
        _selectedValue = widget.value.toString();
      }
    }
    _loadOptions();
  }

  Future<void> _loadOptions() async {
    final apiEndpoint = widget.field['apiEndpoint'] as String?;
    if (apiEndpoint == null || apiEndpoint.isEmpty) {
      setState(() => _loading = false);
      return;
    }

    try {
      // Import Dio and make API call
      final dio = await _getDio();
      final response = await dio.get(apiEndpoint);

      if (response.data is List) {
        final items = response.data as List;
        _options = items.map((item) {
          if (item is Map<String, dynamic>) {
            return _SimpleOption(
              value: item['value']?.toString() ?? '',
              label: item['label']?.toString() ?? item['value']?.toString() ?? '',
            );
          }
          return _SimpleOption(value: item.toString(), label: item.toString());
        }).where((o) => o.value.isNotEmpty).toList();

        // Sort alphabetically
        _options.sort((a, b) => a.label.compareTo(b.label));

        // Update label if we have a value but no label
        if (_selectedValue != null && _selectedLabel == null) {
          final match = _options.where((o) => o.value == _selectedValue).firstOrNull;
          _selectedLabel = match?.label;
        }
      }
    } catch (e) {
      debugPrint('[ApiSelect] Error loading options from $apiEndpoint: $e');
    }

    if (mounted) setState(() => _loading = false);
  }

  Future<Dio> _getDio() async {
    // Get authenticated Dio instance
    final dio = Dio(BaseOptions(
      baseUrl: Env.apiUrl,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
    ),);

    // Add auth token
    final token = await SecureStorage.getAccessToken();
    if (token != null) {
      dio.options.headers['Authorization'] = 'Bearer $token';
    }

    return dio;
  }

  void _handleSelection(_SimpleOption option, Map<String, dynamic>? rawData) {
    setState(() {
      _selectedValue = option.value;
      _selectedLabel = option.label;
    });

    // Return {label, value} object to match web behavior
    widget.onChanged({
      'label': option.label,
      'value': option.value,
    });

    // Handle auto-fill if configured
    _processAutoFill(option, rawData);
  }

  void _processAutoFill(_SimpleOption option, Map<String, dynamic>? rawData) {
    final autoFillFields = widget.field['autoFillFields'] as List<dynamic>?;
    if (autoFillFields == null || autoFillFields.isEmpty || widget.onAutoFill == null) return;

    final updates = <String, dynamic>{};

    for (final autoFill in autoFillFields) {
      if (autoFill is! Map<String, dynamic>) continue;

      final targetSlug = autoFill['targetField'] as String?;
      final sourceField = autoFill['sourceField'] as String?;

      if (targetSlug == null || targetSlug.isEmpty) continue;

      // Get value from raw data if available
      if (rawData != null && sourceField != null) {
        final val = rawData[sourceField];
        if (val != null) {
          updates[targetSlug] = val;
        }
      }
    }

    if (updates.isNotEmpty) {
      widget.onAutoFill!(updates);
    }
  }

  Future<void> _openSheet() async {
    final result = await showModalBottomSheet<_SimpleOption>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _ApiSelectSheet(
        options: _options,
        selectedValue: _selectedValue,
        label: widget.label,
        loading: _loading,
      ),
    );

    if (result != null) {
      _handleSelection(result, null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FormField<String>(
      initialValue: _selectedValue,
      validator: widget.required
          ? (v) => (v == null || v.isEmpty) ? '${widget.label} obrigatorio' : null
          : null,
      builder: (fieldState) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: _loading ? null : _openSheet,
            child: InputDecorator(
              decoration: InputDecoration(
                labelText: widget.label,
                hintText: widget.placeholder,
                helperText: widget.helpText,
                suffixIcon: _loading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: Padding(
                          padding: EdgeInsets.all(12),
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      )
                    : const Icon(Icons.arrow_drop_down),
                errorText: fieldState.errorText,
              ),
              child: Text(
                _selectedLabel ?? 'Selecionar...',
                style: _selectedLabel != null
                    ? AppTypography.bodyMedium
                    : AppTypography.bodyMedium.copyWith(color: context.colors.mutedForeground),
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

/// Bottom sheet for API select options
class _ApiSelectSheet extends StatefulWidget {
  const _ApiSelectSheet({
    required this.options,
    this.selectedValue,
    required this.label,
    this.loading = false,
  });

  final List<_SimpleOption> options;
  final String? selectedValue;
  final String label;
  final bool loading;

  @override
  State<_ApiSelectSheet> createState() => _ApiSelectSheetState();
}

class _ApiSelectSheetState extends State<_ApiSelectSheet> {
  String _query = '';

  List<_SimpleOption> get _filtered {
    if (_query.isEmpty) return widget.options;
    final q = _query.toLowerCase();
    return widget.options.where((o) => o.label.toLowerCase().contains(q)).toList();
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      maxChildSize: 0.9,
      minChildSize: 0.3,
      expand: false,
      builder: (context, scrollController) => Column(
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: Text(widget.label, style: AppTypography.h4),
          ),

          // Search field
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: TextField(
              autofocus: true,
              decoration: InputDecoration(
                hintText: 'Buscar ${widget.label}...',
                prefixIcon: const Icon(Icons.search),
                isDense: true,
              ),
              onChanged: (v) => setState(() => _query = v),
            ),
          ),

          // Options list
          Expanded(
            child: widget.loading
                ? const Center(child: CircularProgressIndicator())
                : widget.options.isEmpty
                    ? Center(
                        child: Text(
                          'Nenhuma opcao disponivel',
                          style: AppTypography.bodyMedium.copyWith(
                            color: context.colors.mutedForeground,
                          ),
                        ),
                      )
                    : ListView.builder(
                        controller: scrollController,
                        itemCount: _filtered.length,
                        itemBuilder: (context, index) {
                          final opt = _filtered[index];
                          final isSelected = opt.value == widget.selectedValue;
                          return ListTile(
                            title: Text(
                              opt.label,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            trailing: isSelected
                                ? Icon(Icons.check, color: Theme.of(context).colorScheme.primary)
                                : null,
                            selected: isSelected,
                            onTap: () => Navigator.of(context).pop(opt),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}

/// Reusable searchable bottom sheet for select/multiselect with "Outro..." option.
class _SearchableSelectSheet extends StatefulWidget {
  const _SearchableSelectSheet({
    required this.options,
    required this.selectedValues,
    required this.label,
    this.multiple = false,
    this.allowCustom = true,
  });

  final List<_SimpleOption> options;
  final List<String> selectedValues;
  final String label;
  final bool multiple;
  final bool allowCustom;

  @override
  State<_SearchableSelectSheet> createState() => _SearchableSelectSheetState();
}

class _SearchableSelectSheetState extends State<_SearchableSelectSheet> {
  final _searchController = TextEditingController();
  final _customController = TextEditingController();
  String _query = '';
  late List<String> _selected;
  bool _customMode = false;

  @override
  void initState() {
    super.initState();
    _selected = List<String>.from(widget.selectedValues);
  }

  @override
  void dispose() {
    _searchController.dispose();
    _customController.dispose();
    super.dispose();
  }

  List<_SimpleOption> get _filtered {
    if (_query.isEmpty) return widget.options;
    final q = _query.toLowerCase();
    return widget.options.where((o) => o.label.toLowerCase().contains(q)).toList();
  }

  void _toggleOption(String value) {
    setState(() {
      if (widget.multiple) {
        if (_selected.contains(value)) {
          _selected.remove(value);
        } else {
          _selected.add(value);
        }
      } else {
        _selected = [value];
        Navigator.of(context).pop(_selected);
      }
    });
  }

  void _confirmCustom() {
    final trimmed = _customController.text.trim();
    if (trimmed.isEmpty) return;
    if (widget.multiple) {
      setState(() {
        if (!_selected.contains(trimmed)) {
          _selected.add(trimmed);
        }
        _customMode = false;
        _customController.clear();
      });
    } else {
      Navigator.of(context).pop([trimmed]);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      maxChildSize: 0.9,
      minChildSize: 0.3,
      expand: false,
      builder: (context, scrollController) => Column(
        children: [
          // Header with title and confirm button (multi)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    widget.label,
                    style: AppTypography.h4,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (widget.multiple)
                  TextButton(
                    onPressed: () => Navigator.of(context).pop(_selected),
                    child: Text('Confirmar (${_selected.length})'),
                  ),
              ],
            ),
          ),

          if (_customMode) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Digite o valor', style: AppTypography.labelLarge.copyWith(color: context.colors.mutedForeground)),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _customController,
                          autofocus: true,
                          decoration: const InputDecoration(
                            hintText: 'Digite o valor...',
                            isDense: true,
                          ),
                          onSubmitted: (_) => _confirmCustom(),
                        ),
                      ),
                      const SizedBox(width: 8),
                      FilledButton(
                        onPressed: _confirmCustom,
                        child: const Text('OK'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  TextButton.icon(
                    onPressed: () => setState(() { _customMode = false; _customController.clear(); }),
                    icon: const Icon(Icons.arrow_back, size: 16),
                    label: const Text('Voltar'),
                    style: TextButton.styleFrom(visualDensity: VisualDensity.compact),
                  ),
                ],
              ),
            ),
          ] else ...[
            // Search field
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
              child: TextField(
                controller: _searchController,
                autofocus: true,
                decoration: InputDecoration(
                  hintText: 'Buscar ${widget.label}...',
                  prefixIcon: const Icon(Icons.search),
                  isDense: true,
                ),
                onChanged: (v) => setState(() => _query = v),
              ),
            ),

            // Options list
            Expanded(
              child: ListView.builder(
                controller: scrollController,
                itemCount: _filtered.length + (widget.allowCustom ? 1 : 0),
                itemBuilder: (context, index) {
                  // "Outro..." item at the end
                  if (widget.allowCustom && index == _filtered.length) {
                    return ListTile(
                      leading: Icon(Icons.edit_outlined, color: context.colors.mutedForeground),
                      title: Text('Outro...', style: TextStyle(color: context.colors.mutedForeground)),
                      onTap: () => setState(() => _customMode = true),
                    );
                  }

                  final opt = _filtered[index];
                  final isSelected = _selected.contains(opt.value);
                  return ListTile(
                    leading: widget.multiple
                        ? Checkbox(
                            value: isSelected,
                            onChanged: (_) => _toggleOption(opt.value),
                          )
                        : null,
                    title: Text(
                      opt.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    trailing: !widget.multiple && isSelected
                        ? Icon(Icons.check, color: colorScheme.primary)
                        : null,
                    selected: isSelected,
                    onTap: () => _toggleOption(opt.value),
                  );
                },
              ),
            ),
          ],
        ],
      ),
    );
  }
}
