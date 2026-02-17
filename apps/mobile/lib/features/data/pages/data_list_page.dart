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
  List<String> _columnOrder = [];

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
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text('Ordenar por', style: AppTypography.h4),
            ),
            // ignore: deprecated_member_use - Radio groupValue/onChanged deprecated in Flutter 3.32
            ...SortOption.values.map((option) => ListTile(
                  title: Text(option.label),
                  leading: Radio<SortOption>(
                    value: option,
                    // ignore: deprecated_member_use
                    groupValue: _sort,
                    // ignore: deprecated_member_use
                    onChanged: (v) {
                      setState(() {
                        _sort = v!;
                        _limit = AppConstants.defaultPageSize;
                      });
                      Navigator.of(ctx).pop();
                    },
                  ),
                  onTap: () {
                    setState(() {
                      _sort = option;
                      _limit = AppConstants.defaultPageSize;
                    });
                    Navigator.of(ctx).pop();
                  },
                ),),
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
            return Text(entity?['name'] as String? ?? widget.entitySlug);
          },
        ),
        actions: [
          const SyncStatusIndicator(),
          IconButton(
            icon: const Icon(Icons.filter_list),
            onPressed: _showFilterSheet,
          ),
          IconButton(
            icon: const Icon(Icons.sort),
            onPressed: _showSortPicker,
          ),
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
                          avatar: const Icon(Icons.public,
                              size: 14, color: AppColors.primary,),
                          label: Text(f.displayLabel,
                              style: const TextStyle(fontSize: 12),),
                          visualDensity: VisualDensity.compact,
                          materialTapTargetSize:
                              MaterialTapTargetSize.shrinkWrap,
                        ),
                      ),),
                  ...localFilters.map((f) => Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: Chip(
                          label: Text(f.displayLabel,
                              style: const TextStyle(fontSize: 12),),
                          visualDensity: VisualDensity.compact,
                          materialTapTargetSize:
                              MaterialTapTargetSize.shrinkWrap,
                          onDeleted: () {
                            ref
                                .read(entityLocalFiltersProvider.notifier)
                                .removeFilter(widget.entitySlug, f.id);
                            setState(
                                () => _limit = AppConstants.defaultPageSize,);
                          },
                          deleteIconColor: AppColors.mutedForeground,
                        ),
                      ),),
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
                      _columnOrder = repo.extractVisibleColumns(entity);
                      try {
                        _fields = jsonDecode(
                            entity['fields'] as String? ?? '[]',);
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
                      final canCreate = perms.hasEntityPermission(
                        widget.entitySlug, 'canCreate',);
                      final showCreateButton = canCreate &&
                          _search.isEmpty &&
                          totalFilterCount == 0;

                      return RefreshIndicator(
                        onRefresh: () async {
                          await Future.delayed(
                            const Duration(milliseconds: 500),
                          );
                        },
                        child: ListView(
                          children: [
                            SizedBox(
                              height: MediaQuery.of(context).size.height * 0.5,
                              child: Center(
                                child: Padding(
                                  padding: const EdgeInsets.all(32),
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Container(
                                        width: 80,
                                        height: 80,
                                        decoration: BoxDecoration(
                                          color: AppColors.primary.withValues(alpha: 0.1),
                                          borderRadius: BorderRadius.circular(40),
                                        ),
                                        child: const Icon(
                                          Icons.inbox_outlined,
                                          size: 40,
                                          color: AppColors.primary,
                                        ),
                                      ),
                                      const SizedBox(height: 24),
                                      Text(
                                        _search.isNotEmpty
                                            ? 'Nenhum resultado para "$_search"'
                                            : totalFilterCount > 0
                                                ? 'Nenhum registro com estes filtros'
                                                : 'Nenhum registro ainda',
                                        style: AppTypography.h4.copyWith(
                                          color: AppColors.foreground,
                                        ),
                                        textAlign: TextAlign.center,
                                      ),
                                      const SizedBox(height: 8),
                                      Text(
                                        _search.isNotEmpty
                                            ? 'Tente outra busca'
                                            : totalFilterCount > 0
                                                ? 'Remova filtros para ver mais'
                                                : 'Comece criando seu primeiro registro',
                                        style: AppTypography.bodyMedium.copyWith(
                                          color: AppColors.mutedForeground,
                                        ),
                                        textAlign: TextAlign.center,
                                      ),
                                      if (showCreateButton) ...[
                                        const SizedBox(height: 24),
                                        ElevatedButton.icon(
                                          onPressed: () => context.push(
                                            '/data/${widget.entitySlug}/new',),
                                          icon: const Icon(Icons.add),
                                          label: const Text('Criar Primeiro'),
                                          style: ElevatedButton.styleFrom(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 24,
                                              vertical: 12,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
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
                            () => _limit = AppConstants.defaultPageSize,);
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

                          final canEdit = perms.hasEntityPermission(widget.entitySlug, 'canUpdate');
                          final card = DataCard(
                            record: record,
                            fields: _fields,
                            visibleFieldSlugs: perms.getVisibleFields(widget.entitySlug),
                            columnOrder: _columnOrder.isNotEmpty ? _columnOrder : null,
                            onTap: () {
                              // Vai direto para edicao se tem permissao, senao visualizacao
                              final path = canEdit
                                  ? '/data/${widget.entitySlug}/${record['id']}/edit'
                                  : '/data/${widget.entitySlug}/${record['id']}';
                              context.push(path);
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
                                  color: Colors.white,),
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
