import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:crm_mobile/core/config/constants.dart';
import 'package:crm_mobile/core/theme/app_colors.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:crm_mobile/features/data/data/data_repository.dart';
import 'package:crm_mobile/features/data/widgets/data_card.dart';
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

  @override
  Widget build(BuildContext context) {
    final repo = ref.watch(dataRepositoryProvider);

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

                return StreamBuilder<List<Map<String, dynamic>>>(
                  stream: repo.watchRecords(
                    entityId: entityId,
                    search: _search.isNotEmpty ? _search : null,
                    orderBy: _sort.sql,
                    limit: _limit,
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

                    // Parse entity fields for display
                    List<dynamic> fields = [];
                    try {
                      fields =
                          jsonDecode(entity['fields'] as String? ?? '[]');
                    } catch (_) {}

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
                          return DataCard(
                            record: record,
                            fields: fields,
                            onTap: () {
                              context.push(
                                '/data/${widget.entitySlug}/${record['id']}',
                              );
                            },
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
