import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:crm_mobile/core/auth/auth_provider.dart';
import 'package:crm_mobile/core/config/constants.dart';
import 'package:crm_mobile/core/filters/filter_models.dart';
import 'package:crm_mobile/core/theme/app_colors.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:crm_mobile/core/permissions/permission_provider.dart';
import 'package:crm_mobile/features/data/data/data_repository.dart';
import 'package:crm_mobile/features/data/providers/filter_provider.dart';
import 'package:crm_mobile/features/data/widgets/data_card.dart';
import 'package:crm_mobile/features/data/widgets/filter_bottom_sheet.dart';
import 'package:crm_mobile/shared/widgets/permission_gate.dart';
import 'package:crm_mobile/shared/widgets/sync_status_indicator.dart';

enum SortOption {
  newestFirst('Mais recentes', 'createdAt DESC'),
  oldestFirst('Mais antigos', 'createdAt ASC'),
  updatedFirst('Ultima atualizacao', 'updatedAt DESC'),
  nameAZ('A → Z', 'data ASC'),
  nameZA('Z → A', 'data DESC');

  const SortOption(this.label, this.sql);
  final String label;
  final String sql;
}

class DataListPage extends ConsumerStatefulWidget {
  const DataListPage({super.key, required this.entitySlug});

  final String entitySlug;

  @override
  ConsumerState<DataListPage> createState() => _DataListPageState();
}

class _DataListPageState extends ConsumerState<DataListPage> {
  final _searchController = TextEditingController();
  final _scrollController = ScrollController();
  Timer? _debounce;
  String _search = '';
  int _limit = AppConstants.defaultPageSize;
  SortOption _sort = SortOption.newestFirst;

  // Filter state
  List<GlobalFilter> _globalFilters = [];
  String? _entityId;
  List<dynamic> _fields = [];

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      // Near bottom - load more
      setState(() => _limit += AppConstants.defaultPageSize);
    }
  }

  Future<bool> _confirmDelete(BuildContext context) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Excluir registro'),
        content: const Text('Tem certeza que deseja excluir este registro?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: TextButton.styleFrom(
              foregroundColor: AppColors.destructive,
            ),
            child: const Text('Excluir'),
          ),
        ],
      ),
    );
    return result == true;
  }

  Future<void> _deleteRecord(
    BuildContext context,
    WidgetRef ref,
    String recordId,
  ) async {
    try {
      final repo = ref.read(dataRepositoryProvider);
      await repo.deleteRecord(
        entitySlug: widget.entitySlug,
        recordId: recordId,
      );
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Registro excluido')),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro ao excluir: $e')),
        );
      }
    }
  }

  void _showSortPicker() {
    showModalBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text('Ordenar por', style: AppTypography.h4),
            ),
            ...SortOption.values.map((option) => RadioListTile<SortOption>(
                  title: Text(option.label),
                  value: option,
                  groupValue: _sort,
                  onChanged: (v) {
                    setState(() {
                      _sort = v!;
                      _limit = AppConstants.defaultPageSize;
                    });
                    Navigator.of(ctx).pop();
                  },
                )),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  void _showFilterSheet() {
    if (_entityId == null) return;
    final canManage = ref.read(permissionsProvider)
        .hasEntityPermission(widget.entitySlug, 'canUpdate');
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => FilterBottomSheet(
        entitySlug: widget.entitySlug,
        entityId: _entityId!,
        globalFilters: _globalFilters,
        fields: _fields,
        canManageGlobal: canManage,
        onGlobalFiltersChanged: _onGlobalFiltersChanged,
      ),
    );
  }

  void _onGlobalFiltersChanged(List<GlobalFilter> updated) {
    setState(() {
      _globalFilters = updated;
      _limit = AppConstants.defaultPageSize;
    });
  }

  @override
  Widget build(BuildContext context) {
    final repo = ref.watch(dataRepositoryProvider);
    final localFilters =
        ref.watch(entityLocalFiltersProvider)[widget.entitySlug] ?? [];
    final totalFilterCount = _globalFilters.length + localFilters.length;

    // Scope 'own': filter by createdById
    final perms = ref.watch(permissionsProvider);
    final scope = perms.getEntityScope(widget.entitySlug);
    final scopeUserId = scope == 'own'
        ? ref.watch(authProvider).user?.id
        : null;

    return Scaffold(
      appBar: AppBar(
        title: StreamBuilder<List<Map<String, dynamic>>>(
          stream: repo.watchEntity(widget.entitySlug),
          builder: (context, snapshot) {
            final entity = snapshot.data?.firstOrNull;
            return Text(entity?['namePlural'] as String? ?? widget.entitySlug);
          },
        ),
        actions: [
          // Filter button with badge
          Stack(
            alignment: Alignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.filter_list),
                tooltip: 'Filtros',
                onPressed: _showFilterSheet,
              ),
              if (totalFilterCount > 0)
                Positioned(
                  top: 6,
                  right: 6,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                    ),
                    constraints: const BoxConstraints(
                      minWidth: 16,
                      minHeight: 16,
                    ),
                    child: Text(
                      '$totalFilterCount',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
            ],
          ),
          IconButton(
            icon: const Icon(Icons.sort),
            tooltip: 'Ordenar',
            onPressed: _showSortPicker,
          ),
          const SyncStatusIndicator(),
        ],
      ),
      body: Column(
        children: [
          // Search bar
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Buscar...',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _search.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchController.clear();
                          setState(() {
                            _search = '';
                            _limit = AppConstants.defaultPageSize;
                          });
                        },
                      )
                    : null,
              ),
              onChanged: (value) {
                _debounce?.cancel();
                _debounce = Timer(const Duration(milliseconds: 400), () {
                  setState(() {
                    _search = value;
                    _limit = AppConstants.defaultPageSize;
                  });
                });
              },
            ),
          ),

          // Active filter chips
          if (_globalFilters.isNotEmpty || localFilters.isNotEmpty)
            SizedBox(
              height: 40,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: [
                  ..._globalFilters.map((f) => Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: Chip(
                          avatar: Icon(Icons.public,
                              size: 14, color: AppColors.primary),
                          label: Text(f.displayLabel,
                              style: const TextStyle(fontSize: 12)),
                          visualDensity: VisualDensity.compact,
                          materialTapTargetSize:
                              MaterialTapTargetSize.shrinkWrap,
                        ),
                      )),
                  ...localFilters.map((f) => Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: Chip(
                          label: Text(f.displayLabel,
                              style: const TextStyle(fontSize: 12)),
                          visualDensity: VisualDensity.compact,
                          materialTapTargetSize:
                              MaterialTapTargetSize.shrinkWrap,
                          onDeleted: () {
                            ref
                                .read(entityLocalFiltersProvider.notifier)
                                .removeFilter(widget.entitySlug, f.id);
                            setState(
                                () => _limit = AppConstants.defaultPageSize);
                          },
                          deleteIconColor: AppColors.mutedForeground,
                        ),
                      )),
                ],
              ),
            ),

          // Records list with pull-to-refresh + infinite scroll
          Expanded(
            child: FutureBuilder<Map<String, dynamic>?>(
              future: repo.getEntity(widget.entitySlug),
              builder: (context, entitySnapshot) {
                final entity = entitySnapshot.data;
                if (entity == null) {
                  return const Center(child: CircularProgressIndicator());
                }

                final entityId = entity['id'] as String;

                // Cache entity metadata for filter sheet
                if (_entityId != entityId) {
                  WidgetsBinding.instance.addPostFrameCallback((_) {
                    if (!mounted) return;
                    setState(() {
                      _entityId = entityId;
                      _globalFilters = repo.extractGlobalFilters(entity);
                      try {
                        _fields = jsonDecode(
                            entity['fields'] as String? ?? '[]');
                      } catch (_) {
                        _fields = [];
                      }
                    });
                  });
                }

                return StreamBuilder<List<Map<String, dynamic>>>(
                  stream: repo.watchRecords(
                    entityId: entityId,
                    search: _search.isNotEmpty ? _search : null,
                    orderBy: _sort.sql,
                    limit: _limit,
                    globalFilters: _globalFilters,
                    localFilters: localFilters,
                    createdById: scopeUserId,
                  ),
                  builder: (context, snapshot) {
                    final records = snapshot.data ?? [];

                    if (records.isEmpty) {
                      return RefreshIndicator(
                        onRefresh: () async {
                          await Future.delayed(
                            const Duration(milliseconds: 500),
                          );
                        },
                        child: ListView(
                          children: [
                            SizedBox(
                              height: MediaQuery.of(context).size.height * 0.4,
                              child: Center(
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(Icons.inbox_outlined,
                                        size: 64,
                                        color: AppColors.mutedForeground),
                                    const SizedBox(height: 16),
                                    Text(
                                      _search.isNotEmpty
                                          ? 'Nenhum resultado para "$_search"'
                                          : totalFilterCount > 0
                                              ? 'Nenhum registro com estes filtros'
                                              : 'Nenhum registro encontrado',
                                      style:
                                          AppTypography.bodyMedium.copyWith(
                                        color: AppColors.mutedForeground,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    }

                    final hasMore = records.length >= _limit;
                    final showEndIndicator =
                        !hasMore && records.length > AppConstants.defaultPageSize;

                    return RefreshIndicator(
                      onRefresh: () async {
                        setState(
                            () => _limit = AppConstants.defaultPageSize);
                        await Future.delayed(
                          const Duration(milliseconds: 500),
                        );
                      },
                      child: ListView.builder(
                        controller: _scrollController,
                        padding:
                            const EdgeInsets.symmetric(horizontal: 16),
                        itemCount: records.length +
                            (hasMore ? 1 : 0) +
                            (showEndIndicator ? 1 : 0),
                        itemBuilder: (context, index) {
                          if (hasMore && index >= records.length) {
                            // Loading indicator at bottom
                            return const Padding(
                              padding: EdgeInsets.symmetric(vertical: 16),
                              child: Center(
                                child: SizedBox(
                                  width: 24,
                                  height: 24,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                ),
                              ),
                            );
                          }

                          if (!hasMore && index >= records.length) {
                            // End of list indicator
                            return Padding(
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              child: Center(
                                child: Text(
                                  '${records.length} registros',
                                  style: AppTypography.caption.copyWith(
                                    color: AppColors.mutedForeground,
                                  ),
                                ),
                              ),
                            );
                          }

                          final record = records[index];
                          final canDelete = ref.read(permissionsProvider)
                              .hasEntityPermission(widget.entitySlug, 'canDelete');

                          final card = DataCard(
                            record: record,
                            fields: _fields,
                            visibleFieldSlugs: perms.getVisibleFields(widget.entitySlug),
                            onTap: () {
                              context.push(
                                '/data/${widget.entitySlug}/${record['id']}',
                              );
                            },
                          );

                          if (!canDelete) return card;

                          return Dismissible(
                            key: ValueKey(record['id']),
                            direction: DismissDirection.endToStart,
                            confirmDismiss: (_) => _confirmDelete(context),
                            onDismissed: (_) => _deleteRecord(
                              context,
                              ref,
                              record['id'] as String,
                            ),
                            background: Container(
                              alignment: Alignment.centerRight,
                              padding: const EdgeInsets.only(right: 20),
                              margin: const EdgeInsets.only(bottom: 8),
                              decoration: BoxDecoration(
                                color: AppColors.destructive,
                                borderRadius:
                                    BorderRadius.circular(AppColors.radius),
                              ),
                              child: const Icon(Icons.delete_outlined,
                                  color: Colors.white),
                            ),
                            child: card,
                          );
                        },
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
      floatingActionButton: PermissionGate(
        entitySlug: widget.entitySlug,
        entityAction: 'canCreate',
        child: FloatingActionButton(
          onPressed: () => context.push('/data/${widget.entitySlug}/new'),
          child: const Icon(Icons.add),
        ),
      ),
    );
  }
}
