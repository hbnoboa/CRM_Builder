import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:crm_mobile/core/filters/filter_models.dart';
import 'package:crm_mobile/core/theme/app_colors_extension.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:crm_mobile/features/data/providers/filter_provider.dart';
import 'package:crm_mobile/features/data/widgets/add_filter_sheet.dart';

/// Bottom sheet showing active global + local filters for an entity.
class FilterBottomSheet extends ConsumerWidget {
  const FilterBottomSheet({
    super.key,
    required this.entitySlug,
    required this.entityId,
    required this.globalFilters,
    required this.fields,
    required this.canManageGlobal,
    this.onGlobalFiltersChanged,
  });

  final String entitySlug;
  final String entityId;
  final List<GlobalFilter> globalFilters;
  final List<dynamic> fields;
  final bool canManageGlobal;
  final void Function(List<GlobalFilter>)? onGlobalFiltersChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final localFilters =
        ref.watch(entityLocalFiltersProvider)[entitySlug] ?? [];
    final totalCount = globalFilters.length + localFilters.length;

    return DraggableScrollableSheet(
      initialChildSize: 0.55,
      maxChildSize: 0.9,
      minChildSize: 0.35,
      builder: (context, scrollController) => Container(
        decoration: BoxDecoration(
          color: Theme.of(context).scaffoldBackgroundColor,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
        ),
        child: Column(
          children: [
            // Handle bar
            Center(
              child: Container(
                margin: const EdgeInsets.only(top: 12),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: context.colors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),

            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Row(
                children: [
                  const Icon(Icons.filter_list, size: 20),
                  const SizedBox(width: 8),
                  const Text('Filtros', style: AppTypography.h4),
                  if (totalCount > 0) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 2,),
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.primary,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '$totalCount',
                        style: AppTypography.caption
                            .copyWith(color: Colors.white),
                      ),
                    ),
                  ],
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.close, size: 20),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
            ),

            const Divider(height: 1),

            // Content
            Expanded(
              child: ListView(
                controller: scrollController,
                padding: const EdgeInsets.all(16),
                children: [
                  // Global filters section
                  if (globalFilters.isNotEmpty) ...[
                    Row(
                      children: [
                        Icon(Icons.public, size: 16, color: Theme.of(context).colorScheme.primary),
                        const SizedBox(width: 6),
                        Text('Filtros Globais',
                            style: AppTypography.labelMedium.copyWith(
                                color: Theme.of(context).colorScheme.primary,),),
                      ],
                    ),
                    const SizedBox(height: 8),
                    ...globalFilters.asMap().entries.map((entry) {
                      final index = entry.key;
                      final filter = entry.value;
                      return _FilterCard(
                        label: filter.displayLabel,
                        subtitle: filter.createdByName != null
                            ? 'Por ${filter.createdByName}'
                            : null,
                        icon: Icons.public,
                        iconColor: Theme.of(context).colorScheme.primary,
                        canRemove: canManageGlobal,
                        onRemove: () {
                          final updated = List<GlobalFilter>.from(globalFilters)
                            ..removeAt(index);
                          onGlobalFiltersChanged?.call(updated);
                        },
                      );
                    }),
                    const SizedBox(height: 16),
                  ],

                  // Local filters section
                  Row(
                    children: [
                      Icon(Icons.person_outline,
                          size: 16, color: context.colors.mutedForeground,),
                      const SizedBox(width: 6),
                      Text('Meus Filtros',
                          style: AppTypography.labelMedium
                              .copyWith(color: context.colors.mutedForeground),),
                    ],
                  ),
                  const SizedBox(height: 8),

                  if (localFilters.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      child: Center(
                        child: Text(
                          'Nenhum filtro local ativo',
                          style: AppTypography.bodyMedium
                              .copyWith(color: context.colors.mutedForeground),
                        ),
                      ),
                    )
                  else
                    ...localFilters.map((filter) => _FilterCard(
                          label: filter.displayLabel,
                          icon: Icons.person_outline,
                          iconColor: context.colors.mutedForeground,
                          canRemove: true,
                          onRemove: () {
                            ref
                                .read(entityLocalFiltersProvider.notifier)
                                .removeFilter(entitySlug, filter.id);
                          },
                        ),),

                  const SizedBox(height: 16),

                  // Add filter button
                  OutlinedButton.icon(
                    onPressed: () {
                      showModalBottomSheet(
                        context: context,
                        isScrollControlled: true,
                        backgroundColor: Colors.transparent,
                        builder: (_) => AddFilterSheet(
                          entitySlug: entitySlug,
                          entityId: entityId,
                          fields: fields,
                          canSaveGlobal: canManageGlobal,
                          currentGlobalFilters: globalFilters,
                          onGlobalFiltersChanged: onGlobalFiltersChanged,
                        ),
                      );
                    },
                    icon: const Icon(Icons.add, size: 18),
                    label: const Text('Adicionar Filtro'),
                  ),

                  // Clear local filters
                  if (localFilters.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: TextButton(
                        onPressed: () {
                          ref
                              .read(entityLocalFiltersProvider.notifier)
                              .clearFilters(entitySlug);
                        },
                        child: Text(
                          'Limpar filtros locais',
                          style: TextStyle(color: context.colors.mutedForeground),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FilterCard extends StatelessWidget {
  const _FilterCard({
    required this.label,
    this.subtitle,
    required this.icon,
    required this.iconColor,
    required this.canRemove,
    required this.onRemove,
  });

  final String label;
  final String? subtitle;
  final IconData icon;
  final Color iconColor;
  final bool canRemove;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Row(
          children: [
            Icon(icon, size: 18, color: iconColor),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: AppTypography.bodyMedium),
                  if (subtitle != null)
                    Text(subtitle!,
                        style: AppTypography.caption
                            .copyWith(color: context.colors.mutedForeground),),
                ],
              ),
            ),
            if (canRemove)
              IconButton(
                icon: Icon(Icons.close,
                    size: 18, color: context.colors.mutedForeground,),
                onPressed: onRemove,
                constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                padding: EdgeInsets.zero,
              ),
          ],
        ),
      ),
    );
  }
}
