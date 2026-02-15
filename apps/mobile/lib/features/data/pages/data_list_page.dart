import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:crm_mobile/core/permissions/permission_provider.dart';
import 'package:crm_mobile/core/theme/app_colors.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:crm_mobile/features/data/data/data_repository.dart';
import 'package:crm_mobile/features/data/widgets/data_card.dart';
import 'package:crm_mobile/shared/widgets/permission_gate.dart';
import 'package:crm_mobile/shared/widgets/sync_status_indicator.dart';

class DataListPage extends ConsumerStatefulWidget {
  const DataListPage({super.key, required this.entitySlug});

  final String entitySlug;

  @override
  ConsumerState<DataListPage> createState() => _DataListPageState();
}

class _DataListPageState extends ConsumerState<DataListPage> {
  final _searchController = TextEditingController();
  String _search = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
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
        actions: const [SyncStatusIndicator()],
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
                          setState(() => _search = '');
                        },
                      )
                    : null,
              ),
              onChanged: (value) => setState(() => _search = value),
            ),
          ),

          // Records list with pull-to-refresh
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
                  ),
                  builder: (context, snapshot) {
                    final records = snapshot.data ?? [];

                    if (records.isEmpty) {
                      return RefreshIndicator(
                        onRefresh: () async {
                          // Trigger PowerSync sync check
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
                                      style: AppTypography.bodyMedium.copyWith(
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
                      fields = jsonDecode(entity['fields'] as String? ?? '[]');
                    } catch (_) {}

                    return RefreshIndicator(
                      onRefresh: () async {
                        // Trigger PowerSync sync check
                        await Future.delayed(
                          const Duration(milliseconds: 500),
                        );
                      },
                      child: ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        itemCount: records.length,
                        itemBuilder: (context, index) {
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
