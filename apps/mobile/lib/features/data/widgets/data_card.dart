import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:crm_mobile/core/theme/app_colors.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:crm_mobile/shared/utils/formatters.dart';

/// Card displaying a summary of an entity data record.
/// Shows the first 4 fields as preview with type-aware formatting.
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
          final type = (f['type'] as String? ?? 'text').toUpperCase().replaceAll('-', '_');
          if (type == 'SUB_ENTITY' || type == 'HIDDEN' || type == 'IMAGE') return false;
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

    final orderedFields = _getOrderedFields();

    // Collect up to 4 fields with values
    final displayFields = <({String name, String value, String type})>[];
    for (int i = 0; i < orderedFields.length && displayFields.length < 4; i++) {
      final field = orderedFields[i];
      final slug = field['slug'] as String? ?? '';
      final value = data[slug];
      if (value == null || value.toString().isEmpty) continue;

      final type = (field['type'] as String? ?? 'text').toUpperCase();
      displayFields.add((
        name: field['name'] as String? ?? slug,
        value: _formatValue(value, type),
        type: type,
      ));
    }

    // First field is the title (larger, bold)
    final title = displayFields.isNotEmpty ? displayFields[0].value : 'Registro';

    // Remaining fields shown as label: value rows
    final detailFields = displayFields.length > 1
        ? displayFields.sublist(1)
        : <({String name, String value, String type})>[];

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppColors.radius),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              // Content
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Title (first field)
                    Text(
                      title,
                      style: AppTypography.labelLarge.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (detailFields.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      // Detail fields in a wrap or column
                      ...detailFields.map((f) => Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: _buildFieldRow(f.name, f.value, f.type),
                      )),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 8),
              const Icon(Icons.chevron_right, size: 20, color: AppColors.mutedForeground),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFieldRow(String name, String value, String type) {
    // Special styling for boolean fields
    if (type == 'BOOLEAN') {
      final isTrue = value == 'Sim';
      return Row(
        children: [
          Icon(
            isTrue ? Icons.check_circle : Icons.cancel,
            size: 14,
            color: isTrue ? AppColors.success : AppColors.mutedForeground,
          ),
          const SizedBox(width: 4),
          Text(
            name,
            style: AppTypography.caption.copyWith(
              color: AppColors.mutedForeground,
            ),
          ),
        ],
      );
    }

    return Row(
      children: [
        Text(
          '$name: ',
          style: AppTypography.caption.copyWith(
            color: AppColors.mutedForeground,
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: AppTypography.caption.copyWith(
              color: AppColors.foreground,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
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
        return '$value%';
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
