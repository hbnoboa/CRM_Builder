import 'dart:convert';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:crm_mobile/core/cache/crm_cache_manager.dart';
import 'package:crm_mobile/core/database/app_database.dart';
import 'package:crm_mobile/core/theme/app_colors.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';

/// Zone configuration from entity field definition.
class _ZoneConfig {
  _ZoneConfig({
    required this.id,
    required this.label,
    required this.x,
    required this.y,
    required this.optionsSource,
    this.options,
    this.sourceEntitySlug,
    this.sourceFieldSlug,
  });

  factory _ZoneConfig.fromJson(Map<String, dynamic> json) => _ZoneConfig(
        id: json['id'] as String? ?? '',
        label: json['label'] as String? ?? '',
        x: (json['x'] as num?)?.toDouble() ?? 0,
        y: (json['y'] as num?)?.toDouble() ?? 0,
        optionsSource: json['optionsSource'] as String? ?? 'manual',
        options: (json['options'] as List<dynamic>?)
            ?.map((e) => e.toString())
            .toList(),
        sourceEntitySlug: json['sourceEntitySlug'] as String?,
        sourceFieldSlug: json['sourceFieldSlug'] as String?,
      );

  final String id;
  final String label;
  final double x;
  final double y;
  final String optionsSource;
  final List<String>? options;
  final String? sourceEntitySlug;
  final String? sourceFieldSlug;
}

// ═══════════════════════════════════════════════════════
// INPUT WIDGET (form edit mode)
// ═══════════════════════════════════════════════════════

/// Zone diagram field input for forms.
/// Renders a background image with tappable zone markers overlay.
class ZoneDiagramFieldInput extends StatefulWidget {
  const ZoneDiagramFieldInput({
    super.key,
    required this.field,
    this.value,
    required this.onChanged,
    this.enabled = true,
  });

  final Map<String, dynamic> field;
  final dynamic value;
  final ValueChanged<dynamic> onChanged;
  final bool enabled;

  @override
  State<ZoneDiagramFieldInput> createState() => _ZoneDiagramFieldInputState();
}

class _ZoneDiagramFieldInputState extends State<ZoneDiagramFieldInput> {
  late List<_ZoneConfig> _zones;
  late Map<String, String> _selections;
  final Map<String, List<String>> _entityOptions = {};
  final Map<String, bool> _loadingEntity = {};

  String get _saveMode =>
      widget.field['diagramSaveMode'] as String? ?? 'object';
  String? get _diagramImage => widget.field['diagramImage'] as String?;
  String get _label =>
      widget.field['label'] as String? ??
      widget.field['name'] as String? ??
      'Diagrama de Zonas';

  @override
  void initState() {
    super.initState();
    _parseZones();
    _parseValue();
    _preloadEntityOptions();
  }

  void _parseZones() {
    var zonesRaw = widget.field['diagramZones'];

    // Handle case where diagramZones is a JSON string
    if (zonesRaw is String && zonesRaw.isNotEmpty) {
      try {
        zonesRaw = jsonDecode(zonesRaw);
      } catch (_) {
        zonesRaw = null;
      }
    }

    if (zonesRaw is List) {
      _zones = zonesRaw
          .whereType<Map<String, dynamic>>()
          .map(_ZoneConfig.fromJson)
          .toList();
    } else {
      _zones = [];
    }

    debugPrint('[ZoneDiagram] Parsed ${_zones.length} zones from field: ${widget.field['slug']}');
  }

  void _parseValue() {
    _selections = {};
    final v = widget.value;
    if (v == null) return;
    if (v is Map) {
      for (final entry in v.entries) {
        _selections[entry.key.toString()] = entry.value.toString();
      }
    } else if (v is String && v.isNotEmpty) {
      // Text mode: try to find which zone has this option
      for (final zone in _zones) {
        final opts = _getOptionsForZone(zone);
        if (opts.contains(v)) {
          _selections[zone.label] = v;
          break;
        }
      }
      // Fallback: assign to first zone
      if (_selections.isEmpty && _zones.isNotEmpty) {
        _selections[_zones.first.label] = v;
      }
    }
  }

  void _preloadEntityOptions() {
    for (final zone in _zones) {
      if (zone.optionsSource == 'entity') {
        _loadEntityOptions(zone);
      }
    }
  }

  Future<void> _loadEntityOptions(_ZoneConfig zone) async {
    if (_entityOptions.containsKey(zone.id) ||
        _loadingEntity[zone.id] == true) {
      return;
    }
    if (zone.sourceEntitySlug == null || zone.sourceFieldSlug == null) return;

    setState(() => _loadingEntity[zone.id] = true);

    try {
      final db = AppDatabase.instance.db;
      // Find entity ID from slug
      final entities = await db.getAll(
        'SELECT id FROM Entity WHERE slug = ? AND deletedAt IS NULL LIMIT 1',
        [zone.sourceEntitySlug],
      );
      if (entities.isEmpty) {
        setState(() {
          _entityOptions[zone.id] = [];
          _loadingEntity[zone.id] = false;
        });
        return;
      }

      final entityId = entities.first['id'] as String;
      final records = await db.getAll(
        'SELECT data FROM EntityData WHERE entityId = ? AND deletedAt IS NULL LIMIT 500',
        [entityId],
      );

      final opts = <String>{};
      for (final record in records) {
        try {
          final data = jsonDecode(record['data'] as String? ?? '{}');
          if (data is Map<String, dynamic>) {
            final val = data[zone.sourceFieldSlug];
            if (val != null && val.toString().isNotEmpty) {
              // Handle object values with 'label' key
              if (val is Map && val.containsKey('label')) {
                opts.add(val['label'].toString());
              } else {
                opts.add(val.toString());
              }
            }
          }
        } catch (_) {}
      }

      final sorted = opts.toList()..sort();
      if (mounted) {
        setState(() {
          _entityOptions[zone.id] = sorted;
          _loadingEntity[zone.id] = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _entityOptions[zone.id] = [];
          _loadingEntity[zone.id] = false;
        });
      }
    }
  }

  List<String> _getOptionsForZone(_ZoneConfig zone) {
    if (zone.optionsSource == 'entity') {
      return _entityOptions[zone.id] ?? [];
    }
    return zone.options ?? [];
  }

  void _handleSelect(String zoneLabel, String option) {
    if (!widget.enabled) return;

    setState(() {
      if (_saveMode == 'text') {
        final current = _selections[zoneLabel];
        if (current == option) {
          _selections.remove(zoneLabel);
          widget.onChanged('');
        } else {
          _selections
            ..clear()
            ..addAll({zoneLabel: option});
          widget.onChanged(option);
        }
      } else {
        if (_selections[zoneLabel] == option) {
          _selections.remove(zoneLabel);
        } else {
          _selections[zoneLabel] = option;
        }
        widget.onChanged(Map<String, String>.from(_selections));
      }
    });
  }

  void _handleClearZone(String zoneLabel) {
    if (!widget.enabled) return;
    setState(() {
      _selections.remove(zoneLabel);
      if (_saveMode == 'text') {
        widget.onChanged('');
      } else {
        widget.onChanged(Map<String, String>.from(_selections));
      }
    });
  }

  void _handleClearAll() {
    if (!widget.enabled) return;
    setState(() {
      _selections.clear();
      widget.onChanged(_saveMode == 'text' ? '' : <String, String>{});
    });
  }

  void _showZoneOptions(_ZoneConfig zone) {
    final options = _getOptionsForZone(zone);
    final isLoading = _loadingEntity[zone.id] == true;
    final selected = _selections[zone.label];

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _ZoneOptionsSheet(
        zone: zone,
        options: options,
        isLoading: isLoading,
        selected: selected,
        enabled: widget.enabled,
        onSelect: (option) {
          _handleSelect(zone.label, option);
          Navigator.of(ctx).pop();
        },
        onClear: () {
          _handleClearZone(zone.label);
          Navigator.of(ctx).pop();
        },
      ),
    );
  }

  int get _filledCount => _zones.where((z) => _selections.containsKey(z.label)).length;

  @override
  Widget build(BuildContext context) {
    if (_zones.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.border, width: 2),
          borderRadius: BorderRadius.circular(12),
          color: AppColors.muted.withValues(alpha: 0.2),
        ),
        child: Column(
          children: [
            const Icon(Icons.location_on_outlined,
                size: 32, color: AppColors.mutedForeground),
            const SizedBox(height: 8),
            Text(_label,
                style: AppTypography.labelLarge
                    .copyWith(color: AppColors.mutedForeground)),
            const SizedBox(height: 4),
            Text('Nenhuma zona configurada',
                style: AppTypography.caption
                    .copyWith(color: AppColors.mutedForeground)),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header
        Row(
          children: [
            const Icon(Icons.location_on_outlined,
                size: 18, color: AppColors.mutedForeground),
            const SizedBox(width: 6),
            Text(_label, style: AppTypography.labelLarge),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.muted,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                '$_filledCount/${_zones.length}',
                style: AppTypography.caption,
              ),
            ),
            const Spacer(),
            if (widget.enabled && _filledCount > 0)
              GestureDetector(
                onTap: _handleClearAll,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.refresh, size: 14, color: AppColors.mutedForeground),
                    const SizedBox(width: 2),
                    Text('Limpar',
                        style: AppTypography.caption
                            .copyWith(color: AppColors.mutedForeground)),
                  ],
                ),
              ),
          ],
        ),
        const SizedBox(height: 12),

        // Diagram or list
        if (_diagramImage != null && _diagramImage!.isNotEmpty)
          _buildImageDiagram()
        else
          _buildListMode(),

        // Summary of selected zones
        if (_filledCount > 0) ...[
          const SizedBox(height: 12),
          Text('Selecoes',
              style: AppTypography.caption
                  .copyWith(color: AppColors.mutedForeground)),
          const SizedBox(height: 4),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: _zones
                .where((z) => _selections.containsKey(z.label))
                .map((zone) => Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFECFDF5),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: const Color(0xFFA7F3D0)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            '${zone.label}: ',
                            style: AppTypography.caption.copyWith(
                                fontWeight: FontWeight.w700,
                                color: const Color(0xFF047857)),
                          ),
                          Text(
                            _selections[zone.label]!,
                            style: AppTypography.caption
                                .copyWith(color: const Color(0xFF047857)),
                          ),
                          if (widget.enabled) ...[
                            const SizedBox(width: 4),
                            GestureDetector(
                              onTap: () => _handleClearZone(zone.label),
                              child: const Icon(Icons.close,
                                  size: 12, color: Color(0xFF047857)),
                            ),
                          ],
                        ],
                      ),
                    ))
                .toList(),
          ),
        ],
      ],
    );
  }

  Widget _buildImageDiagram() {
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: Container(
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.border, width: 2),
          borderRadius: BorderRadius.circular(12),
        ),
        child: LayoutBuilder(
          builder: (context, constraints) {
            return Stack(
              children: [
                // Background image
                CachedNetworkImage(
                  imageUrl: _diagramImage!,
                  cacheManager: CrmCacheManager(),
                  width: constraints.maxWidth,
                  fit: BoxFit.fitWidth,
                  placeholder: (_, __) => Container(
                    height: 250,
                    color: AppColors.muted,
                    child:
                        const Center(child: CircularProgressIndicator()),
                  ),
                  errorWidget: (_, __, ___) => Container(
                    height: 250,
                    color: AppColors.muted,
                    child: const Center(
                        child: Icon(Icons.broken_image_outlined, size: 48)),
                  ),
                  imageBuilder: (context, imageProvider) {
                    // Use Image widget to get natural size for proper positioning
                    return Image(
                      image: imageProvider,
                      width: constraints.maxWidth,
                      fit: BoxFit.fitWidth,
                    );
                  },
                ),
                // Zone markers overlay (positioned over the image)
                // We use a Positioned.fill + LayoutBuilder to get the actual rendered image size
                Positioned.fill(
                  child: LayoutBuilder(
                    builder: (context, innerConstraints) {
                      return Stack(
                        clipBehavior: Clip.none,
                        children: _zones.map((zone) {
                          final isSelected =
                              _selections.containsKey(zone.label);
                          return Positioned(
                            left: (zone.x / 100) * innerConstraints.maxWidth - 16,
                            top: (zone.y / 100) * innerConstraints.maxHeight - 16,
                            child: GestureDetector(
                              onTap: widget.enabled
                                  ? () => _showZoneOptions(zone)
                                  : null,
                              child: Container(
                                constraints: const BoxConstraints(
                                    minWidth: 32, minHeight: 32),
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 6),
                                decoration: BoxDecoration(
                                  color: isSelected
                                      ? const Color(0xFF10B981)
                                      : Colors.white,
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: isSelected
                                        ? const Color(0xFF059669)
                                        : AppColors.border,
                                    width: 2,
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: isSelected
                                          ? const Color(0xFF10B981)
                                              .withValues(alpha: 0.3)
                                          : Colors.black12,
                                      blurRadius: 6,
                                      offset: const Offset(0, 2),
                                    ),
                                  ],
                                ),
                                child: isSelected
                                    ? const Icon(Icons.check,
                                        size: 16, color: Colors.white)
                                    : Text(
                                        zone.label.length > 3
                                            ? zone.label.substring(0, 3)
                                            : zone.label,
                                        style: AppTypography.caption.copyWith(
                                          fontWeight: FontWeight.w700,
                                          fontSize: 10,
                                        ),
                                        textAlign: TextAlign.center,
                                      ),
                              ),
                            ),
                          );
                        }).toList(),
                      );
                    },
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildListMode() {
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        children: _zones.asMap().entries.map((entry) {
          final index = entry.key;
          final zone = entry.value;
          final isSelected = _selections.containsKey(zone.label);
          final options = _getOptionsForZone(zone);

          return Column(
            children: [
              if (index > 0) const Divider(height: 1),
              ListTile(
                dense: true,
                leading: isSelected
                    ? const Icon(Icons.check_circle,
                        color: Color(0xFF10B981), size: 20)
                    : Icon(Icons.radio_button_unchecked,
                        color: AppColors.mutedForeground.withValues(alpha: 0.3),
                        size: 20),
                title: Row(
                  children: [
                    Text(zone.label,
                        style: AppTypography.bodyMedium
                            .copyWith(fontWeight: FontWeight.w500)),
                    if (isSelected) ...[
                      Text(
                        ' — ${_selections[zone.label]}',
                        style: AppTypography.caption
                            .copyWith(color: const Color(0xFF059669)),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('${options.length}',
                        style: AppTypography.caption
                            .copyWith(color: AppColors.mutedForeground)),
                    const SizedBox(width: 4),
                    const Icon(Icons.chevron_right,
                        size: 18, color: AppColors.mutedForeground),
                  ],
                ),
                onTap: widget.enabled ? () => _showZoneOptions(zone) : null,
              ),
            ],
          );
        }).toList(),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════
// ZONE OPTIONS BOTTOM SHEET
// ═══════════════════════════════════════════════════════

class _ZoneOptionsSheet extends StatefulWidget {
  const _ZoneOptionsSheet({
    required this.zone,
    required this.options,
    required this.isLoading,
    this.selected,
    required this.enabled,
    required this.onSelect,
    required this.onClear,
  });

  final _ZoneConfig zone;
  final List<String> options;
  final bool isLoading;
  final String? selected;
  final bool enabled;
  final ValueChanged<String> onSelect;
  final VoidCallback onClear;

  @override
  State<_ZoneOptionsSheet> createState() => _ZoneOptionsSheetState();
}

class _ZoneOptionsSheetState extends State<_ZoneOptionsSheet> {
  String _search = '';

  List<String> get _filtered {
    if (_search.isEmpty) return widget.options;
    final q = _search.toLowerCase();
    return widget.options.where((o) => o.toLowerCase().contains(q)).toList();
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.5,
      minChildSize: 0.3,
      maxChildSize: 0.85,
      expand: false,
      builder: (context, scrollController) => Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(widget.zone.label,
                          style: AppTypography.h4),
                      if (widget.selected != null)
                        Text(
                          widget.selected!,
                          style: AppTypography.caption
                              .copyWith(color: const Color(0xFF059669)),
                        ),
                    ],
                  ),
                ),
                if (widget.selected != null && widget.enabled)
                  TextButton.icon(
                    onPressed: widget.onClear,
                    icon: const Icon(Icons.close, size: 16),
                    label: const Text('Limpar'),
                    style: TextButton.styleFrom(
                      foregroundColor: AppColors.destructive,
                    ),
                  ),
              ],
            ),
          ),

          // Search (for many options)
          if (widget.options.length > 6)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                autofocus: true,
                decoration: const InputDecoration(
                  hintText: 'Buscar opcao...',
                  prefixIcon: Icon(Icons.search),
                  isDense: true,
                ),
                onChanged: (v) => setState(() => _search = v),
              ),
            ),

          const SizedBox(height: 8),

          // Options list
          Expanded(
            child: widget.isLoading
                ? const Center(
                    child: Padding(
                      padding: EdgeInsets.all(24),
                      child: CircularProgressIndicator(),
                    ),
                  )
                : widget.options.isEmpty
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Text('Nenhuma opcao disponivel',
                              style: AppTypography.bodyMedium
                                  .copyWith(color: AppColors.mutedForeground)),
                        ),
                      )
                    : ListView.builder(
                        controller: scrollController,
                        itemCount: _filtered.length,
                        itemBuilder: (context, index) {
                          final option = _filtered[index];
                          final isSelected = option == widget.selected;

                          return ListTile(
                            leading: Container(
                              width: 20,
                              height: 20,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: isSelected
                                    ? const Color(0xFF10B981)
                                    : Colors.transparent,
                                border: Border.all(
                                  color: isSelected
                                      ? const Color(0xFF059669)
                                      : AppColors.mutedForeground
                                          .withValues(alpha: 0.3),
                                ),
                              ),
                              child: isSelected
                                  ? const Icon(Icons.check,
                                      size: 12, color: Colors.white)
                                  : null,
                            ),
                            title: Text(option,
                                style: AppTypography.bodyMedium),
                            onTap: widget.enabled
                                ? () => widget.onSelect(option)
                                : null,
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════
// DISPLAY WIDGET (read-only detail page)
// ═══════════════════════════════════════════════════════

/// Zone diagram display for detail pages (read-only).
class ZoneDiagramFieldDisplay extends StatelessWidget {
  const ZoneDiagramFieldDisplay({
    super.key,
    required this.field,
    this.value,
  });

  final Map<String, dynamic> field;
  final dynamic value;

  @override
  Widget build(BuildContext context) {
    final name = field['label'] as String? ??
        field['name'] as String? ??
        'Diagrama de Zonas';

    // Parse value to map
    Map<String, String> selections = {};
    if (value is Map) {
      for (final entry in (value as Map).entries) {
        selections[entry.key.toString()] = entry.value.toString();
      }
    } else if (value is String && (value as String).isNotEmpty) {
      selections = {'': value as String};
    }

    if (selections.isEmpty) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(name,
              style: AppTypography.labelMedium
                  .copyWith(color: AppColors.mutedForeground)),
          const SizedBox(height: 4),
          Text('-',
              style: AppTypography.bodyMedium
                  .copyWith(color: AppColors.mutedForeground)),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(name,
            style: AppTypography.labelMedium
                .copyWith(color: AppColors.mutedForeground)),
        const SizedBox(height: 8),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: selections.entries.map((entry) {
            final label =
                entry.key.isNotEmpty ? '${entry.key}: ${entry.value}' : entry.value;
            return Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFFECFDF5),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: const Color(0xFFA7F3D0)),
              ),
              child: Text(
                label,
                style: AppTypography.caption
                    .copyWith(color: const Color(0xFF047857)),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }
}
