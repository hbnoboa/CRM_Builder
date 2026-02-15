import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:crm_mobile/core/theme/app_colors.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:crm_mobile/shared/utils/formatters.dart';

/// Card displaying a summary of an entity data record.
/// Shows the first few fields as preview with type-aware formatting.
class DataCard extends StatelessWidget {
  const DataCard({
    super.key,
    required this.record,
    required this.fields,
    this.onTap,
  });

  final Map<String, dynamic> record;
  final List<dynamic> fields;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    Map<String, dynamic> data = {};
    try {
      data = jsonDecode(record['data'] as String? ?? '{}');
    } catch (_) {}

    // Get title from first text field
    String title = 'Registro';
    String? subtitle;

    for (int i = 0; i < fields.length && i < 3; i++) {
      final field = fields[i] as Map<String, dynamic>;
      final slug = field['slug'] as String? ?? '';
      final type = (field['type'] as String? ?? 'text').toUpperCase();
      final value = data[slug];
      if (value == null || value.toString().isEmpty) continue;

      if (type == 'SUB_ENTITY' || type == 'HIDDEN') continue;

      final formatted = _formatValue(value, type);

      if (i == 0) {
        title = formatted;
      } else if (subtitle == null) {
        subtitle = '${field['name']}: $formatted';
      }
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        title: Text(
          title,
          style: AppTypography.labelLarge,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: subtitle != null
            ? Text(
                subtitle,
                style: AppTypography.caption.copyWith(
                  color: AppColors.mutedForeground,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              )
            : null,
        trailing: const Icon(Icons.chevron_right, size: 20),
        onTap: onTap,
      ),
    );
  }

  String _formatValue(dynamic value, String type) {
    switch (type) {
      case 'DATE':
        return Formatters.date(value.toString());
      case 'DATETIME':
        return Formatters.dateTime(value.toString());
      case 'CURRENCY':
        final num? numVal = num.tryParse(value.toString());
        return numVal != null ? Formatters.currency(numVal) : value.toString();
      case 'PERCENTAGE':
        return '${value}%';
      case 'BOOLEAN':
        return (value == true || value == 'true') ? 'Sim' : 'Nao';
      case 'MULTI_SELECT':
        if (value is List) return value.join(', ');
        return value.toString();
      case 'RATING':
        final n = (num.tryParse(value.toString()) ?? 0).toInt();
        return '${'★' * n}${'☆' * (5 - n)}';
      case 'PASSWORD':
        return '••••••••';
      default:
        return value.toString();
    }
  }
}
