import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:crm_mobile/core/database/app_database.dart';
import 'package:crm_mobile/core/permissions/permission_provider.dart';
import 'package:crm_mobile/core/theme/app_colors.dart';
import 'package:crm_mobile/core/theme/app_colors_extension.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:crm_mobile/shared/utils/icon_mapper.dart';
import 'package:crm_mobile/shared/widgets/app_drawer.dart';
import 'package:crm_mobile/shared/widgets/sync_status_indicator.dart';

/// Data entities selector page - shows entities grouped by category.
/// If only one parent entity is available, navigates directly to its list.
class DataEntitiesPage extends ConsumerStatefulWidget {
  const DataEntitiesPage({super.key});

  @override
  ConsumerState<DataEntitiesPage> createState() => _DataEntitiesPageState();
}

class _DataEntitiesPageState extends ConsumerState<DataEntitiesPage> {
  String _searchQuery = '';
  bool _autoNavigated = false;
  final Set<String> _expandedCategories = {};

  /// Collect all slugs that are referenced as SUB_ENTITY by other entities.
  Set<String> _getSubEntitySlugs(List<Map<String, dynamic>> allEntities) {
    final subSlugs = <String>{};
    for (final entity in allEntities) {
      try {
        final fieldsJson = entity['fields'] as String?;
        if (fieldsJson == null) continue;
        final fields = jsonDecode(fieldsJson) as List?;
        if (fields == null) continue;
        for (final field in fields) {
          if (field is Map<String, dynamic> &&
              field['type'] == 'sub-entity' &&
              field['subEntitySlug'] is String) {
            subSlugs.add(field['subEntitySlug'] as String);
          }
        }
      } catch (_) {}
    }
    return subSlugs;
  }

  /// Group entities by category
  Map<String, List<Map<String, dynamic>>> _groupByCategory(
    List<Map<String, dynamic>> entities,
  ) {
    final grouped = <String, List<Map<String, dynamic>>>{};
    for (final entity in entities) {
      final category = entity['category'] as String? ?? '';
      grouped.putIfAbsent(category, () => []).add(entity);
    }
    // Sort categories: non-empty first (alphabetically), then empty category last
    final sortedKeys = grouped.keys.toList()
      ..sort((a, b) {
        if (a.isEmpty && b.isNotEmpty) return 1;
        if (a.isNotEmpty && b.isEmpty) return -1;
        return a.compareTo(b);
      });
    return {for (final key in sortedKeys) key: grouped[key]!};
  }

  @override
  void initState() {
    super.initState();
    // Start with all categories expanded
    _expandedCategories.add(''); // Uncategorized
  }

  @override
  Widget build(BuildContext context) {
    final perms = ref.watch(permissionsProvider);
    final db = AppDatabase.instance.db;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Dados'),
        leading: Builder(
          builder: (context) => IconButton(
            icon: const Icon(Icons.menu),
            onPressed: () => Scaffold.of(context).openDrawer(),
          ),
        ),
        actions: const [
          SyncStatusIndicator(),
          SizedBox(width: 8),
        ],
      ),
      drawer: const AppDrawer(),
      body: Column(
        children: [
          // Search
          Builder(
            builder: (context) {
              return Container(
                padding: const EdgeInsets.all(AppColors.spaceMd),
                decoration: BoxDecoration(
                  color: context.colors.card,
                  boxShadow: [
                    BoxShadow(
                      color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.03),
                      blurRadius: 10,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Selecione uma entidade',
                      style: AppTypography.bodySmall.copyWith(
                        color: context.colors.mutedForeground,
                      ),
                    ),
                    const SizedBox(height: AppColors.spaceSm),
                    // Search bar
                    TextField(
                      decoration: InputDecoration(
                        hintText: 'Buscar entidade...',
                        hintStyle: AppTypography.bodyMedium.copyWith(
                          color: context.colors.mutedForeground,
                        ),
                        prefixIcon: Icon(
                          Icons.search,
                          color: context.colors.mutedForeground,
                        ),
                        filled: true,
                        fillColor: context.colors.muted,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(AppColors.radiusFull),
                          borderSide: BorderSide.none,
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(AppColors.radiusFull),
                          borderSide: BorderSide.none,
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(AppColors.radiusFull),
                          borderSide: BorderSide(color: Theme.of(context).colorScheme.primary, width: 2),
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: AppColors.spaceMd,
                          vertical: AppColors.spaceSm,
                        ),
                      ),
                      onChanged: (value) => setState(() => _searchQuery = value),
                    ),
                  ],
                ),
              );
            },
          ),

        // Entities list grouped by category
        Expanded(
          child: StreamBuilder<List<Map<String, dynamic>>>(
            stream: db.watch(
              'SELECT e.*, '
              '(SELECT COUNT(*) FROM EntityData WHERE entityId = e.id AND deletedAt IS NULL) + '
              '(SELECT COUNT(*) FROM ArchivedEntityData WHERE entityId = e.id) as recordCount '
              'FROM Entity e ORDER BY e.category ASC, e.name ASC',
            ),
            builder: (context, snapshot) {
              final allEntities = snapshot.data ?? [];

              // Identify sub-entity slugs
              final subSlugs = _getSubEntitySlugs(allEntities);

              // Filter: only parent entities (not referenced as sub-entity),
              // with permission, and matching search
              final filteredEntities = allEntities.where((e) {
                final slug = e['slug'] as String;

                // Exclude sub-entities
                if (subSlugs.contains(slug)) return false;

                final name = (e['name'] as String? ?? '').toLowerCase();
                final namePlural =
                    (e['namePlural'] as String? ?? '').toLowerCase();
                final category = (e['category'] as String? ?? '').toLowerCase();
                final search = _searchQuery.toLowerCase();

                final hasPermission =
                    perms.hasEntityPermission(slug, 'canRead') ||
                        perms.hasModuleAccess('data');

                final matchesSearch = search.isEmpty ||
                    name.contains(search) ||
                    namePlural.contains(search) ||
                    slug.contains(search) ||
                    category.contains(search);

                return hasPermission && matchesSearch;
              }).toList();

              if (snapshot.connectionState == ConnectionState.waiting &&
                  !snapshot.hasData) {
                return const Center(child: CircularProgressIndicator());
              }

              // Auto-navigate if only 1 parent entity (and no search active)
              if (filteredEntities.length == 1 &&
                  _searchQuery.isEmpty &&
                  !_autoNavigated) {
                _autoNavigated = true;
                final slug = filteredEntities[0]['slug'] as String;
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (mounted) context.go('/data/$slug');
                });
                return const Center(child: CircularProgressIndicator());
              }

              // Reset flag if we're back to showing multiple entities
              if (filteredEntities.length != 1) {
                _autoNavigated = false;
              }

              if (filteredEntities.isEmpty) {
                return _buildEmptyState();
              }

              // Group by category
              final grouped = _groupByCategory(filteredEntities);

              // If only one category, don't show category headers
              if (grouped.length == 1) {
                final entities = grouped.values.first;
                return ListView.builder(
                  padding: const EdgeInsets.all(AppColors.spaceMd),
                  itemCount: entities.length,
                  itemBuilder: (context, index) {
                    return _buildEntityCard(entities[index], index);
                  },
                );
              }

              // Expand all categories when searching
              if (_searchQuery.isNotEmpty) {
                for (final cat in grouped.keys) {
                  _expandedCategories.add(cat);
                }
              }

              return ListView.builder(
                padding: const EdgeInsets.all(AppColors.spaceMd),
                itemCount: grouped.length,
                itemBuilder: (context, index) {
                  final category = grouped.keys.elementAt(index);
                  final entities = grouped[category]!;
                  return _buildCategorySection(category, entities, index);
                },
              );
            },
          ),
        ),
        ],
      ),
    );
  }

  Widget _buildCategorySection(
    String category,
    List<Map<String, dynamic>> entities,
    int categoryIndex,
  ) {
    final isExpanded = _expandedCategories.contains(category);
    final categoryName = category.isEmpty ? 'Outros' : category;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Category header
        InkWell(
          onTap: () {
            setState(() {
              if (isExpanded) {
                _expandedCategories.remove(category);
              } else {
                _expandedCategories.add(category);
              }
            });
          },
          borderRadius: BorderRadius.circular(AppColors.radiusMd),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              vertical: AppColors.spaceSm,
              horizontal: AppColors.spaceXs,
            ),
            child: Row(
              children: [
                Icon(
                  isExpanded ? Icons.expand_more : Icons.chevron_right,
                  size: 20,
                  color: context.colors.mutedForeground,
                ),
                const SizedBox(width: AppColors.spaceXs),
                Icon(
                  Icons.folder_outlined,
                  size: 18,
                  color: Theme.of(context).colorScheme.primary,
                ),
                const SizedBox(width: AppColors.spaceSm),
                Expanded(
                  child: Text(
                    categoryName,
                    style: AppTypography.labelLarge.copyWith(
                      fontWeight: FontWeight.w600,
                      color: Theme.of(context).colorScheme.onSurface,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(AppColors.radiusFull),
                  ),
                  child: Text(
                    '${entities.length}',
                    style: AppTypography.caption.copyWith(
                      color: Theme.of(context).colorScheme.primary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        // Entities in category
        if (isExpanded) ...[
          const SizedBox(height: AppColors.spaceSm),
          ...entities.asMap().entries.map((entry) {
            return _buildEntityCard(entry.value, categoryIndex * 10 + entry.key);
          }),
          const SizedBox(height: AppColors.spaceMd),
        ],
      ],
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppColors.spaceLg),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: context.colors.muted,
                borderRadius: BorderRadius.circular(AppColors.radiusFull),
              ),
              child: Icon(
                Icons.table_chart_outlined,
                size: 40,
                color: context.colors.mutedForeground,
              ),
            ),
            const SizedBox(height: AppColors.spaceLg),
            Text(
              _searchQuery.isEmpty
                  ? 'Nenhuma entidade disponivel'
                  : 'Nenhuma entidade encontrada',
              style: AppTypography.labelLarge.copyWith(
                color: Theme.of(context).colorScheme.onSurface,
              ),
            ),
            const SizedBox(height: AppColors.spaceSm),
            Text(
              _searchQuery.isEmpty
                  ? 'Crie entidades no painel web'
                  : 'Tente uma busca diferente',
              style: AppTypography.bodySmall.copyWith(
                color: context.colors.mutedForeground,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEntityCard(Map<String, dynamic> entity, int index) {
    final slug = entity['slug'] as String;
    final namePlural = entity['namePlural'] as String;
    final icon = entity['icon'] as String?;
    final color = entity['color'] as String?;
    final recordCount = entity['recordCount'] as int? ?? 0;

    Color entityColor;
    try {
      entityColor = color != null
          ? Color(int.parse(color.replaceFirst('#', '0xFF')))
          : AppColors.chartPalette[index % AppColors.chartPalette.length];
    } catch (_) {
      entityColor = AppColors.chartPalette[index % AppColors.chartPalette.length];
    }

    // Parse fields count
    int fieldCount = 0;
    try {
      final fields = entity['fields'] as String?;
      if (fields != null) {
        final list = jsonDecode(fields) as List?;
        fieldCount = list?.length ?? 0;
      }
    } catch (_) {}

    return Padding(
      padding: const EdgeInsets.only(bottom: AppColors.spaceMd),
      child: GestureDetector(
        onTap: () => context.push('/data/$slug'),
        child: Container(
          decoration: BoxDecoration(
            color: context.colors.card,
            borderRadius: BorderRadius.circular(AppColors.radiusLg),
            boxShadow: [
              BoxShadow(
                color: Theme.of(context).shadowColor.withValues(alpha: 0.08),
                blurRadius: 10,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            children: [
              // Colored left accent
              Container(
                width: 4,
                height: 80,
                decoration: BoxDecoration(
                  color: entityColor,
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(AppColors.radiusLg),
                    bottomLeft: Radius.circular(AppColors.radiusLg),
                  ),
                ),
              ),
              // Content
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(AppColors.spaceMd),
                  child: Row(
                    children: [
                      // Icon
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: entityColor.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(AppColors.radiusMd),
                        ),
                        child: Icon(
                          IconMapper.fromString(icon),
                          color: entityColor,
                          size: 24,
                        ),
                      ),
                      const SizedBox(width: AppColors.spaceMd),
                      // Details
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              namePlural,
                              style: AppTypography.labelLarge.copyWith(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                _buildChip(
                                  Icons.layers_outlined,
                                  '$recordCount',
                                  entityColor,
                                ),
                                const SizedBox(width: 8),
                                _buildChip(
                                  Icons.list_alt_outlined,
                                  '$fieldCount campos',
                                  context.colors.mutedForeground,
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      // Arrow
                      Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          color: context.colors.muted,
                          borderRadius: BorderRadius.circular(AppColors.radiusSm),
                        ),
                        child: Icon(
                          Icons.chevron_right,
                          size: 20,
                          color: context.colors.mutedForeground,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildChip(IconData icon, String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppColors.radiusFull),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: AppTypography.caption.copyWith(
              color: color,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
