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
    this.visibleFieldSlugs,
    this.columnOrder,
  });

  final Map<String, dynamic> record;
  final List<dynamic> fields;
  final VoidCallback? onTap;
  final Set<String>? visibleFieldSlugs;
  final List<String>? columnOrder;

  /// Returns fields ordered by columnConfig (if set), filtering hidden/sub-entity.
  List<Map<String, dynamic>> _getOrderedFields() {
    final allFields = fields
        .cast<Map<String, dynamic>>()
        .where((f) {
          final type = (f['type'] as String? ?? 'text').toUpperCase();
          if (type == 'SUB_ENTITY' || type == 'HIDDEN') return false;
          final slug = f['slug'] as String? ?? '';
          if (visibleFieldSlugs != null && !visibleFieldSlugs!.contains(slug)) return false;
          return true;
        })
        .toList();

    if (columnOrder == null || columnOrder!.isEmpty) return allFields;

    // Build slug→field map for fast lookup
    final fieldMap = <String, Map<String, dynamic>>{};
    for (final f in allFields) {
      fieldMap[f['slug'] as String? ?? ''] = f;
    }

    // Return fields in columnConfig order (only those that exist and are visible)
    return columnOrder!
        .where((slug) => fieldMap.containsKey(slug))
        .map((slug) => fieldMap[slug]!)
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    Map<String, dynamic> data = {};
    try {
      data = jsonDecode(record['data'] as String? ?? '{}');
    } catch (_) {}

    String title = 'Registro';
    String? subtitle;

    final orderedFields = _getOrderedFields();
    int displayed = 0;
    for (int i = 0; i < orderedFields.length && displayed < 3; i++) {
      final field = orderedFields[i];
      final slug = field['slug'] as String? ?? '';

      final value = data[slug];
      if (value == null || value.toString().isEmpty) continue;

      final type = (field['type'] as String? ?? 'text').toUpperCase();
      final formatted = _formatValue(value, type);

      if (displayed == 0) {
        title = formatted;
      } else if (subtitle == null) {
        subtitle = '${field['name']}: $formatted';
      }
      displayed++;
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
