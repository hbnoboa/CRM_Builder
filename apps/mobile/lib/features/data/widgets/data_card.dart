import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:crm_mobile/core/theme/app_colors.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';

/// Card displaying a summary of an entity data record.
/// Shows the first few fields as preview.
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
      final value = data[slug];
      if (value == null || value.toString().isEmpty) continue;

      if (i == 0) {
        title = value.toString();
      } else if (subtitle == null) {
        subtitle = '${field['name']}: $value';
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
}
