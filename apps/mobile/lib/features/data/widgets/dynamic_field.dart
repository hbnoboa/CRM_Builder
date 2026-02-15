import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:crm_mobile/core/theme/app_colors.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:crm_mobile/features/data/widgets/image_field_input.dart';

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

    return Column(
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
        if (url.startsWith('http')) {
          return ClipRRect(
            borderRadius: BorderRadius.circular(AppColors.radius),
            child: CachedNetworkImage(
              imageUrl: url,
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
      case 'DATETIME':
        return Text(value.toString(), style: AppTypography.bodyMedium);

      case 'NUMBER':
      case 'CURRENCY':
        return Text(value.toString(), style: AppTypography.bodyMedium);

      case 'TEXTAREA':
      case 'RICH_TEXT':
        return Text(value.toString(), style: AppTypography.bodyMedium);

      case 'URL':
        return Text(
          value.toString(),
          style: AppTypography.bodyMedium.copyWith(
            color: AppColors.info,
            decoration: TextDecoration.underline,
          ),
        );

      case 'EMAIL':
        return Text(
          value.toString(),
          style: AppTypography.bodyMedium.copyWith(color: AppColors.info),
        );

      default:
        return Text(value.toString(), style: AppTypography.bodyMedium);
    }
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

    switch (type) {
      case 'TEXTAREA':
      case 'RICH_TEXT':
        return TextFormField(
          initialValue: value?.toString(),
          maxLines: 4,
          decoration: InputDecoration(
            labelText: name,
            alignLabelWithHint: true,
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
          decoration: InputDecoration(labelText: name),
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
          decoration: InputDecoration(labelText: name),
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
          decoration: InputDecoration(labelText: name),
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
          decoration: InputDecoration(labelText: name),
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

      // Default: text input
      default:
        return TextFormField(
          initialValue: value?.toString(),
          decoration: InputDecoration(labelText: name),
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
