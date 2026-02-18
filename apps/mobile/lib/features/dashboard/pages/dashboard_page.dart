import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:crm_mobile/core/auth/auth_provider.dart';
import 'package:crm_mobile/core/database/app_database.dart';
import 'package:crm_mobile/core/permissions/permission_provider.dart';
import 'package:crm_mobile/core/theme/app_colors.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:crm_mobile/features/dashboard/widgets/stat_card.dart';
import 'package:crm_mobile/shared/widgets/sync_status_indicator.dart';

/// Dashboard page - statistics and charts overview.
/// Shows only if user has dashboard permission.
class DashboardPage extends ConsumerWidget {
  const DashboardPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final user = authState.user;
    final permissions = ref.watch(permissionsProvider);
    final db = AppDatabase.instance.db;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Dashboard'),
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
      drawer: _buildDrawer(context, ref, user),
      body: RefreshIndicator(
        onRefresh: () async {
          await ref.read(authProvider.notifier).getProfile();
        },
        child: ListView(
          padding: const EdgeInsets.all(AppColors.spaceMd),
          children: [
          // Welcome header with gradient
          _buildWelcomeHeader(user),
          const SizedBox(height: AppColors.spaceLg),

          // Stats cards
          _buildStatsSection(context, db, user?.id),
          const SizedBox(height: AppColors.spaceLg),

          // Area chart - Records over time
          _buildAreaChartSection(context, db),
          const SizedBox(height: AppColors.spaceLg),

          // Pie chart - Distribution by entity
          _buildPieChartSection(context, db),
          const SizedBox(height: AppColors.spaceLg),

          // Quick actions
          if (permissions.hasModuleAccess('data'))
            _buildQuickActionsSection(context, db),
          const SizedBox(height: AppColors.spaceLg),

          // Recent activity
          _buildRecentActivitySection(context, db),
          const SizedBox(height: AppColors.spaceMd),
          ],
        ),
      ),
    );
  }

  Widget _buildWelcomeHeader(dynamic user) {
    final firstName = user?.name?.split(' ').first ?? 'Usuario';
    final hour = DateTime.now().hour;
    String greeting;
    IconData greetingIcon;
    if (hour < 12) {
      greeting = 'Bom dia';
      greetingIcon = Icons.wb_sunny_outlined;
    } else if (hour < 18) {
      greeting = 'Boa tarde';
      greetingIcon = Icons.wb_sunny;
    } else {
      greeting = 'Boa noite';
      greetingIcon = Icons.nights_stay_outlined;
    }

    return Container(
      padding: const EdgeInsets.all(AppColors.spaceLg),
      decoration: BoxDecoration(
        gradient: AppColors.primaryGradient,
        borderRadius: BorderRadius.circular(AppColors.radiusXl),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.3),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(
                      greetingIcon,
                      color: Colors.white.withValues(alpha: 0.9),
                      size: 20,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      greeting,
                      style: AppTypography.bodyMedium.copyWith(
                        color: Colors.white.withValues(alpha: 0.9),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  firstName,
                  style: AppTypography.h1.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Aqui esta o resumo do seu CRM',
                  style: AppTypography.bodySmall.copyWith(
                    color: Colors.white.withValues(alpha: 0.8),
                  ),
                ),
              ],
            ),
          ),
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(AppColors.radiusFull),
            ),
            child: Center(
              child: Text(
                firstName.isNotEmpty ? firstName[0].toUpperCase() : 'U',
                style: AppTypography.h2.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatsSection(
    BuildContext context,
    dynamic db,
    String? userId,
  ) {
    return StreamBuilder<List<Map<String, dynamic>>>(
      stream: db.watch(
        'SELECT '
        '(SELECT COUNT(*) FROM Entity) as entityCount, '
        '(SELECT COUNT(*) FROM EntityData WHERE deletedAt IS NULL) as dataCount, '
        "(SELECT COUNT(*) FROM EntityData WHERE deletedAt IS NULL AND createdById = '${userId ?? ''}') as myDataCount, "
        "(SELECT COUNT(*) FROM file_upload_queue WHERE status = 'pending') as pendingCount",
      ),
      builder: (context, snapshot) {
        final row = snapshot.data?.firstOrNull;
        final entityCount = row?['entityCount'] ?? 0;
        final dataCount = row?['dataCount'] ?? 0;
        final myDataCount = row?['myDataCount'] ?? 0;
        final pendingCount = row?['pendingCount'] ?? 0;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 4,
                  height: 20,
                  decoration: BoxDecoration(
                    gradient: AppColors.primaryGradient,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(width: 8),
                const Text('Resumo', style: AppTypography.h4),
              ],
            ),
            const SizedBox(height: AppColors.spaceMd),
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisSpacing: AppColors.spaceMd,
              mainAxisSpacing: AppColors.spaceMd,
              childAspectRatio: 1.3,
              children: [
                StatCard(
                  title: 'Entidades',
                  value: '$entityCount',
                  icon: Icons.storage_outlined,
                  color: AppColors.info,
                  onTap: () => context.go('/data'),
                ),
                StatCard(
                  title: 'Registros',
                  value: '$dataCount',
                  icon: Icons.layers_outlined,
                  color: AppColors.success,
                  onTap: () => context.go('/data'),
                ),
                StatCard(
                  title: 'Meus Registros',
                  value: '$myDataCount',
                  icon: Icons.person_outline,
                  color: AppColors.secondary,
                  onTap: () => context.go('/data'),
                ),
                StatCard(
                  title: 'Pendentes Sync',
                  value: '$pendingCount',
                  icon: Icons.cloud_upload_outlined,
                  color: pendingCount > 0 ? AppColors.warning : AppColors.mutedForeground,
                  subtitle: pendingCount > 0 ? 'Sincronizando...' : null,
                ),
              ],
            ),
          ],
        );
      },
    );
  }

  Widget _buildAreaChartSection(BuildContext context, dynamic db) {
    return StreamBuilder<List<Map<String, dynamic>>>(
      stream: db.watch(
        'SELECT date(createdAt) as date, COUNT(*) as count '
        'FROM EntityData '
        'WHERE deletedAt IS NULL '
        "AND createdAt >= date('now', '-30 days') "
        'GROUP BY date(createdAt) '
        'ORDER BY date ASC',
      ),
      builder: (context, snapshot) {
        final data = snapshot.data ?? [];
        final total = data.fold<int>(0, (sum, e) => sum + ((e['count'] as int?) ?? 0));

        return Container(
          padding: const EdgeInsets.all(AppColors.spaceMd),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(AppColors.radiusLg),
            boxShadow: AppColors.cardShadow,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Registros',
                        style: AppTypography.labelLarge.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Ultimos 30 dias',
                        style: AppTypography.caption.copyWith(
                          color: AppColors.mutedForeground,
                        ),
                      ),
                    ],
                  ),
                  if (data.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(AppColors.radiusFull),
                      ),
                      child: Text(
                        '$total total',
                        style: AppTypography.labelSmall.copyWith(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: AppColors.spaceMd),
              SizedBox(
                height: 180,
                child: data.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.show_chart,
                              size: 40,
                              color: AppColors.mutedForeground.withValues(alpha: 0.5),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Sem dados no periodo',
                              style: AppTypography.bodySmall.copyWith(
                                color: AppColors.mutedForeground,
                              ),
                            ),
                          ],
                        ),
                      )
                    : _buildAreaChart(data),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildAreaChart(List<Map<String, dynamic>> data) {
    final spots = <FlSpot>[];
    double maxY = 0;

    for (var i = 0; i < data.length; i++) {
      final count = (data[i]['count'] as int?) ?? 0;
      spots.add(FlSpot(i.toDouble(), count.toDouble()));
      if (count > maxY) maxY = count.toDouble();
    }

    return LineChart(
      LineChartData(
        gridData: FlGridData(
          show: true,
          drawVerticalLine: false,
          horizontalInterval: maxY > 0 ? maxY / 4 : 1,
          getDrawingHorizontalLine: (value) => FlLine(
            color: AppColors.border.withValues(alpha: 0.5),
            strokeWidth: 1,
            dashArray: [5, 5],
          ),
        ),
        titlesData: FlTitlesData(
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 30,
              getTitlesWidget: (value, meta) {
                if (value == meta.max || value == 0) {
                  return Text(
                    value.toInt().toString(),
                    style: AppTypography.caption.copyWith(
                      color: AppColors.mutedForeground,
                    ),
                  );
                }
                return const SizedBox.shrink();
              },
            ),
          ),
          bottomTitles: const AxisTitles(
            sideTitles: SideTitles(showTitles: false),
          ),
          topTitles: const AxisTitles(
            sideTitles: SideTitles(showTitles: false),
          ),
          rightTitles: const AxisTitles(
            sideTitles: SideTitles(showTitles: false),
          ),
        ),
        borderData: FlBorderData(show: false),
        minX: 0,
        maxX: (data.length - 1).toDouble(),
        minY: 0,
        maxY: maxY > 0 ? maxY * 1.1 : 10,
        lineBarsData: [
          LineChartBarData(
            spots: spots,
            isCurved: true,
            curveSmoothness: 0.35,
            gradient: AppColors.primaryGradient,
            barWidth: 3,
            isStrokeCapRound: true,
            dotData: FlDotData(
              show: true,
              getDotPainter: (spot, percent, barData, index) {
                return FlDotCirclePainter(
                  radius: 4,
                  color: AppColors.card,
                  strokeWidth: 2,
                  strokeColor: AppColors.primary,
                );
              },
            ),
            belowBarData: BarAreaData(
              show: true,
              gradient: LinearGradient(
                colors: [
                  AppColors.primary.withValues(alpha: 0.25),
                  AppColors.secondary.withValues(alpha: 0.05),
                ],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
            ),
          ),
        ],
        lineTouchData: LineTouchData(
          touchTooltipData: LineTouchTooltipData(
            getTooltipColor: (touchedSpot) => AppColors.foreground,
            getTooltipItems: (touchedSpots) {
              return touchedSpots.map((spot) {
                return LineTooltipItem(
                  '${spot.y.toInt()} registros',
                  AppTypography.caption.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w500,
                  ),
                );
              }).toList();
            },
          ),
        ),
      ),
    );
  }

  Widget _buildPieChartSection(BuildContext context, dynamic db) {
    return StreamBuilder<List<Map<String, dynamic>>>(
      stream: db.watch(
        'SELECT e.name, e.color, COUNT(ed.id) as count '
        'FROM Entity e '
        'LEFT JOIN EntityData ed ON ed.entityId = e.id AND ed.deletedAt IS NULL '
        'GROUP BY e.id '
        'ORDER BY count DESC '
        'LIMIT 6',
      ),
      builder: (context, snapshot) {
        final data = snapshot.data ?? [];
        if (data.isEmpty) {
          return _buildEmptyChart('Nenhuma entidade encontrada');
        }

        final total = data.fold<int>(
          0,
          (sum, item) => sum + ((item['count'] as int?) ?? 0),
        );

        if (total == 0) {
          return _buildEmptyChart('Nenhum registro encontrado');
        }

        return Container(
          padding: const EdgeInsets.all(AppColors.spaceMd),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(AppColors.radiusLg),
            boxShadow: AppColors.cardShadow,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 4,
                    height: 20,
                    decoration: BoxDecoration(
                      gradient: AppColors.successGradient,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Distribuicao por Entidade',
                    style: AppTypography.labelLarge.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppColors.spaceMd),
              SizedBox(
                height: 200,
                child: Row(
                  children: [
                    Expanded(
                      child: PieChart(
                        PieChartData(
                          sectionsSpace: 3,
                          centerSpaceRadius: 45,
                          sections: _buildPieChartSections(data, total),
                        ),
                      ),
                    ),
                    const SizedBox(width: AppColors.spaceMd),
                    Expanded(
                      child: _buildChartLegend(data, total),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  List<PieChartSectionData> _buildPieChartSections(
    List<Map<String, dynamic>> data,
    int total,
  ) {
    return data.asMap().entries.map((entry) {
      final index = entry.key;
      final item = entry.value;
      final count = (item['count'] as int?) ?? 0;
      final percentage = total > 0 ? (count / total * 100) : 0.0;

      Color color;
      final colorStr = item['color'] as String?;
      if (colorStr != null && colorStr.isNotEmpty) {
        try {
          color = Color(int.parse(colorStr.replaceFirst('#', '0xFF')));
        } catch (_) {
          color = AppColors.chartPalette[index % AppColors.chartPalette.length];
        }
      } else {
        color = AppColors.chartPalette[index % AppColors.chartPalette.length];
      }

      return PieChartSectionData(
        color: color,
        value: count.toDouble(),
        title: percentage >= 10 ? '${percentage.toStringAsFixed(0)}%' : '',
        radius: 55,
        titleStyle: AppTypography.labelSmall.copyWith(
          fontWeight: FontWeight.w700,
          color: Colors.white,
        ),
        badgeWidget: percentage < 10 && count > 0
            ? null
            : null,
      );
    }).toList();
  }

  Widget _buildChartLegend(List<Map<String, dynamic>> data, int total) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisAlignment: MainAxisAlignment.center,
      children: data.asMap().entries.map((entry) {
        final index = entry.key;
        final item = entry.value;
        final name = item['name'] as String? ?? 'Desconhecido';
        final count = (item['count'] as int?) ?? 0;
        final percentage = total > 0 ? (count / total * 100) : 0.0;

        Color color;
        final colorStr = item['color'] as String?;
        if (colorStr != null && colorStr.isNotEmpty) {
          try {
            color = Color(int.parse(colorStr.replaceFirst('#', '0xFF')));
          } catch (_) {
            color = AppColors.chartPalette[index % AppColors.chartPalette.length];
          }
        } else {
          color = AppColors.chartPalette[index % AppColors.chartPalette.length];
        }

        return Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Row(
            children: [
              Container(
                width: 12,
                height: 12,
                decoration: BoxDecoration(
                  color: color,
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  name,
                  style: AppTypography.bodySmall.copyWith(
                    color: AppColors.foreground,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Text(
                '${percentage.toStringAsFixed(0)}%',
                style: AppTypography.labelSmall.copyWith(
                  fontWeight: FontWeight.w600,
                  color: AppColors.mutedForeground,
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _buildEmptyChart(String message) {
    return Container(
      height: 200,
      decoration: BoxDecoration(
        color: AppColors.surfaceVariant,
        borderRadius: BorderRadius.circular(AppColors.radiusLg),
      ),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: AppColors.muted,
                borderRadius: BorderRadius.circular(AppColors.radiusFull),
              ),
              child: const Icon(
                Icons.pie_chart_outline,
                size: 32,
                color: AppColors.mutedForeground,
              ),
            ),
            const SizedBox(height: AppColors.spaceMd),
            Text(
              message,
              style: AppTypography.bodyMedium.copyWith(
                color: AppColors.mutedForeground,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickActionsSection(BuildContext context, dynamic db) {
    return StreamBuilder<List<Map<String, dynamic>>>(
      stream: db.watch(
        'SELECT slug, namePlural, color FROM Entity ORDER BY name ASC LIMIT 4',
      ),
      builder: (context, snapshot) {
        final entities = snapshot.data ?? [];

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 4,
                  height: 20,
                  decoration: BoxDecoration(
                    color: AppColors.accent,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(width: 8),
                const Text('Acoes Rapidas', style: AppTypography.h4),
              ],
            ),
            const SizedBox(height: AppColors.spaceMd),
            Wrap(
              spacing: AppColors.spaceSm,
              runSpacing: AppColors.spaceSm,
              children: [
                _QuickActionChip(
                  icon: Icons.folder_open_outlined,
                  label: 'Ver Dados',
                  color: AppColors.primary,
                  onTap: () => context.go('/data'),
                ),
                ...entities.map((e) {
                  final slug = e['slug'] as String;
                  final name = e['namePlural'] as String;
                  final colorStr = e['color'] as String?;

                  Color color = AppColors.secondary;
                  if (colorStr != null && colorStr.isNotEmpty) {
                    try {
                      color = Color(int.parse(colorStr.replaceFirst('#', '0xFF')));
                    } catch (_) {}
                  }

                  return _QuickActionChip(
                    icon: Icons.add_rounded,
                    label: 'Novo $name',
                    color: color,
                    onTap: () => context.push('/data/$slug/new'),
                  );
                }),
              ],
            ),
          ],
        );
      },
    );
  }

  Widget _buildRecentActivitySection(BuildContext context, dynamic db) {
    return StreamBuilder<List<Map<String, dynamic>>>(
      stream: db.watch(
        'SELECT ed.id, ed.data, ed.createdAt, ed.updatedAt, '
        'e.name as entityName, e.namePlural, e.slug as entitySlug, e.color '
        'FROM EntityData ed '
        'JOIN Entity e ON e.id = ed.entityId '
        'WHERE ed.deletedAt IS NULL '
        'ORDER BY ed.updatedAt DESC '
        'LIMIT 10',
      ),
      builder: (context, snapshot) {
        final activities = snapshot.data ?? [];
        if (activities.isEmpty) return const SizedBox.shrink();

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      width: 4,
                      height: 20,
                      decoration: BoxDecoration(
                        color: AppColors.warning,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    const SizedBox(width: 8),
                    const Text('Atividade Recente', style: AppTypography.h4),
                  ],
                ),
                TextButton(
                  onPressed: () => context.go('/data'),
                  child: Text(
                    'Ver tudo',
                    style: AppTypography.labelSmall.copyWith(
                      color: AppColors.primary,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppColors.spaceSm),
            Container(
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(AppColors.radiusLg),
                boxShadow: AppColors.cardShadow,
              ),
              child: ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: activities.length,
                separatorBuilder: (_, __) => const Divider(
                  height: 1,
                  indent: 68,
                  color: AppColors.border,
                ),
                itemBuilder: (context, index) {
                  final activity = activities[index];
                  return _buildActivityItem(context, activity);
                },
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildActivityItem(
    BuildContext context,
    Map<String, dynamic> activity,
  ) {
    final entityName = activity['entityName'] as String? ?? 'Registro';
    final slug = activity['entitySlug'] as String? ?? '';
    final id = activity['id'] as String? ?? '';
    final colorStr = activity['color'] as String?;
    final createdAt = activity['createdAt'] as String?;
    final updatedAt = activity['updatedAt'] as String?;

    // Determine action (created vs updated)
    final isNew = createdAt == updatedAt;
    final action = isNew ? 'Criou' : 'Atualizou';
    final icon = isNew ? Icons.add_circle_outline : Icons.edit_outlined;

    // Parse color
    Color color = AppColors.primary;
    if (colorStr != null && colorStr.isNotEmpty) {
      try {
        color = Color(int.parse(colorStr.replaceFirst('#', '0xFF')));
      } catch (_) {}
    }

    // Format time
    String timeAgo = '';
    if (updatedAt != null) {
      try {
        final dt = DateTime.parse(updatedAt);
        final diff = DateTime.now().difference(dt);
        if (diff.inMinutes < 1) {
          timeAgo = 'agora';
        } else if (diff.inMinutes < 60) {
          timeAgo = 'ha ${diff.inMinutes} min';
        } else if (diff.inHours < 24) {
          timeAgo = 'ha ${diff.inHours}h';
        } else {
          timeAgo = 'ha ${diff.inDays}d';
        }
      } catch (_) {}
    }

    return ListTile(
      contentPadding: const EdgeInsets.symmetric(
        horizontal: AppColors.spaceMd,
        vertical: AppColors.spaceXs,
      ),
      leading: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(AppColors.radiusMd),
        ),
        child: Icon(icon, color: color, size: 22),
      ),
      title: Text(
        '$action $entityName',
        style: AppTypography.labelMedium.copyWith(
          fontWeight: FontWeight.w500,
        ),
      ),
      subtitle: Text(
        timeAgo,
        style: AppTypography.caption.copyWith(
          color: AppColors.mutedForeground,
        ),
      ),
      trailing: Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          color: AppColors.surfaceVariant,
          borderRadius: BorderRadius.circular(AppColors.radiusSm),
        ),
        child: const Icon(
          Icons.chevron_right,
          size: 20,
          color: AppColors.mutedForeground,
        ),
      ),
      onTap: () => context.push('/data/$slug/$id'),
    );
  }

  Widget _buildDrawer(BuildContext context, WidgetRef ref, dynamic user) {
    return Drawer(
      child: SafeArea(
        child: Column(
          children: [
            // Header
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppColors.spaceLg),
              decoration: const BoxDecoration(
                gradient: AppColors.primaryGradient,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Avatar
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(32),
                    ),
                    child: Center(
                      child: Text(
                        (user?.name?.isNotEmpty == true)
                            ? user.name[0].toUpperCase()
                            : 'U',
                        style: AppTypography.h2.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    user?.name ?? 'Usuario',
                    style: AppTypography.labelLarge.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    user?.email ?? '',
                    style: AppTypography.bodySmall.copyWith(
                      color: Colors.white.withValues(alpha: 0.8),
                    ),
                  ),
                ],
              ),
            ),

            // Menu items
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 8),
                children: [
                  ListTile(
                    leading: const Icon(Icons.dashboard_outlined),
                    title: const Text('Dashboard'),
                    selected: true,
                    onTap: () => Navigator.pop(context),
                  ),
                  ListTile(
                    leading: const Icon(Icons.folder_outlined),
                    title: const Text('Dados'),
                    onTap: () {
                      Navigator.pop(context);
                      context.go('/data');
                    },
                  ),
                  const Divider(),
                  ListTile(
                    leading: const Icon(Icons.sync),
                    title: const Text('Status de Sincronizacao'),
                    onTap: () {
                      Navigator.pop(context);
                      _showSyncDialog(context);
                    },
                  ),
                ],
              ),
            ),

            // Logout button
            const Divider(height: 1),
            ListTile(
              leading: const Icon(Icons.logout, color: AppColors.destructive),
              title: Text(
                'Sair',
                style: AppTypography.labelMedium.copyWith(
                  color: AppColors.destructive,
                ),
              ),
              onTap: () async {
                Navigator.pop(context);
                final confirm = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: const Text('Sair'),
                    content: const Text('Deseja realmente sair da sua conta?'),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(ctx, false),
                        child: const Text('Cancelar'),
                      ),
                      TextButton(
                        onPressed: () => Navigator.pop(ctx, true),
                        style: TextButton.styleFrom(
                          foregroundColor: AppColors.destructive,
                        ),
                        child: const Text('Sair'),
                      ),
                    ],
                  ),
                );
                if (confirm == true) {
                  await ref.read(authProvider.notifier).logout();
                }
              },
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  void _showSyncDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Row(
          children: [
            Icon(Icons.sync, color: AppColors.primary),
            const SizedBox(width: 8),
            const Text('PowerSync'),
          ],
        ),
        content: StreamBuilder<List<Map<String, dynamic>>>(
          stream: AppDatabase.instance.db.watch(
            "SELECT "
            "(SELECT COUNT(*) FROM Entity) as entityCount, "
            "(SELECT COUNT(*) FROM EntityData WHERE deletedAt IS NULL) as dataCount, "
            "(SELECT COUNT(*) FROM CustomRole) as roleCount, "
            "(SELECT COUNT(*) FROM User) as userCount",
          ),
          builder: (context, snapshot) {
            final row = snapshot.data?.firstOrNull;
            return Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildSyncRow('Entity', row?['entityCount'] ?? 0),
                _buildSyncRow('EntityData', row?['dataCount'] ?? 0),
                _buildSyncRow('CustomRole', row?['roleCount'] ?? 0),
                _buildSyncRow('User', row?['userCount'] ?? 0),
              ],
            );
          },
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Fechar'),
          ),
        ],
      ),
    );
  }

  Widget _buildSyncRow(String name, int count) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(name, style: AppTypography.bodyMedium),
          Text(
            '$count registros',
            style: AppTypography.bodyMedium.copyWith(
              color: AppColors.mutedForeground,
            ),
          ),
        ],
      ),
    );
  }
}

class _QuickActionChip extends StatelessWidget {
  const _QuickActionChip({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: color.withValues(alpha: 0.1),
      borderRadius: BorderRadius.circular(AppColors.radiusFull),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppColors.radiusFull),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 10,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 18, color: color),
              const SizedBox(width: 8),
              Text(
                label,
                style: AppTypography.labelSmall.copyWith(
                  color: color,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
