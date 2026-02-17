import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:crm_mobile/core/location/nominatim_helpers.dart';
import 'package:crm_mobile/core/map/cached_tile_provider.dart';
import 'package:crm_mobile/core/theme/app_colors.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';

// ─── MapFieldInput ──────────────────────────────────────────────────────────

class MapFieldInput extends StatefulWidget {
  const MapFieldInput({
    super.key,
    required this.field,
    required this.value,
    required this.onChanged,
    this.enabled = true,
  });

  final Map<String, dynamic> field;
  final dynamic value;
  final ValueChanged<dynamic> onChanged;
  final bool enabled;

  @override
  State<MapFieldInput> createState() => _MapFieldInputState();
}

class _MapFieldInputState extends State<MapFieldInput> {
  final _searchController = TextEditingController();
  final _mapController = MapController();
  Timer? _reverseTimer;

  bool _isSearching = false;
  bool _isReversing = false;
  List<Map<String, dynamic>> _searchResults = [];

  Map<String, dynamic> get _val {
    if (widget.value is Map<String, dynamic>) {
      return widget.value as Map<String, dynamic>;
    }
    if (widget.value is Map) {
      return Map<String, dynamic>.from(widget.value as Map);
    }
    return {};
  }

  String get _mode =>
      (widget.field['mapMode'] as String?)?.toLowerCase() ?? 'both';

  LatLng get _defaultCenter {
    final c = widget.field['mapDefaultCenter'];
    if (c is List && c.length >= 2) {
      return LatLng(
        (c[0] as num).toDouble(),
        (c[1] as num).toDouble(),
      );
    }
    return const LatLng(-15.7801, -47.9292); // Brasilia
  }

  double get _defaultZoom =>
      (widget.field['mapDefaultZoom'] as num?)?.toDouble() ?? 4.0;

  double get _mapHeight {
    final h = (widget.field['mapHeight'] as num?)?.toDouble() ?? 300.0;
    // On mobile, clamp inline map to reasonable size
    return h.clamp(150.0, 250.0);
  }

  double? get _lat {
    final v = _val['lat'];
    if (v is num) return v.toDouble();
    if (v is String) return double.tryParse(v);
    return null;
  }

  double? get _lng {
    final v = _val['lng'];
    if (v is num) return v.toDouble();
    if (v is String) return double.tryParse(v);
    return null;
  }

  bool get _hasCoords => _lat != null && _lng != null;

  @override
  void dispose() {
    _reverseTimer?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _updateValue(Map<String, dynamic> updates) {
    final newVal = Map<String, dynamic>.from(_val)..addAll(updates);
    widget.onChanged(newVal);
  }

  // ── Tap on map ──
  void _onMapTap(TapPosition _, LatLng point) {
    if (!widget.enabled) return;
    final lat = double.parse(point.latitude.toStringAsFixed(6));
    final lng = double.parse(point.longitude.toStringAsFixed(6));
    _updateValue({'lat': lat, 'lng': lng});
    _scheduleReverseGeocode(lat, lng);
  }

  // ── Reverse geocode with debounce ──
  void _scheduleReverseGeocode(double lat, double lng) {
    if (_mode == 'latlng') return;
    _reverseTimer?.cancel();
    _reverseTimer = Timer(const Duration(milliseconds: 800), () async {
      if (!mounted) return;
      setState(() => _isReversing = true);
      try {
        final data = await reverseGeocode(lat, lng);
        if (data != null && mounted) {
          final parts = extractAddressParts(
              data['address'] as Map<String, dynamic>?);
          final formatted = formatAddress(parts);
          _updateValue({
            'lat': lat,
            'lng': lng,
            ...parts,
            'address': formatted,
          });
        }
      } catch (_) {}
      if (mounted) setState(() => _isReversing = false);
    });
  }

  // ── Address search ──
  Future<void> _handleSearch() async {
    final query = _searchController.text.trim();
    if (query.isEmpty) return;
    setState(() {
      _isSearching = true;
      _searchResults = [];
    });
    try {
      final results = await geocodeAddress(query);
      if (mounted) setState(() => _searchResults = results);
    } catch (_) {}
    if (mounted) setState(() => _isSearching = false);
  }

  void _selectSearchResult(Map<String, dynamic> result) {
    final lat =
        double.parse(double.parse(result['lat'].toString()).toStringAsFixed(6));
    final lng =
        double.parse(double.parse(result['lon'].toString()).toStringAsFixed(6));
    final parts =
        extractAddressParts(result['address'] as Map<String, dynamic>?);
    final formatted =
        formatAddress(parts).isNotEmpty ? formatAddress(parts) : (result['display_name'] ?? '');

    _updateValue({
      'lat': lat,
      'lng': lng,
      ...parts,
      'address': formatted,
    });
    _searchController.text = formatted;
    setState(() => _searchResults = []);

    _mapController.move(LatLng(lat, lng), 15);
  }

  // ── GPS location ──
  Future<void> _goToMyLocation() async {
    try {
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied ||
          perm == LocationPermission.deniedForever) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Permissao de localizacao negada')),
          );
        }
        return;
      }

      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 10),
        ),
      );
      final lat = double.parse(pos.latitude.toStringAsFixed(6));
      final lng = double.parse(pos.longitude.toStringAsFixed(6));
      _updateValue({'lat': lat, 'lng': lng});
      _mapController.move(LatLng(lat, lng), 15);
      _scheduleReverseGeocode(lat, lng);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro ao obter localizacao: $e')),
        );
      }
    }
  }

  // ── Full-screen picker ──
  Future<void> _openFullScreenPicker() async {
    final initial = _hasCoords ? LatLng(_lat!, _lng!) : _defaultCenter;
    final zoom = _hasCoords ? 15.0 : _defaultZoom;
    final result = await Navigator.of(context).push<LatLng>(
      MaterialPageRoute(
        builder: (_) => _FullScreenMapPicker(
          initialCenter: initial,
          initialZoom: zoom,
        ),
      ),
    );
    if (result != null && mounted) {
      final lat = double.parse(result.latitude.toStringAsFixed(6));
      final lng = double.parse(result.longitude.toStringAsFixed(6));
      _updateValue({'lat': lat, 'lng': lng});
      _mapController.move(LatLng(lat, lng), 15);
      _scheduleReverseGeocode(lat, lng);
    }
  }

  // ── Clear ──
  void _clear() {
    widget.onChanged({});
    _searchController.clear();
    setState(() => _searchResults = []);
    _mapController.move(_defaultCenter, _defaultZoom);
  }

  // ── Open in external maps app ──
  Future<void> _openInMaps() async {
    if (!_hasCoords) return;
    final url = Uri.parse(
        'https://www.google.com/maps/search/?api=1&query=$_lat,$_lng');
    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final showSearch = _mode == 'address' || _mode == 'both';
    final showCoords = _mode == 'latlng' || _mode == 'both';
    final showAddressFields = _mode == 'address' || _mode == 'both';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Label
        Text(
          widget.field['name'] as String? ??
              widget.field['label'] as String? ??
              'Localizacao',
          style: AppTypography.labelMedium,
        ),
        if (widget.field['helpText'] != null) ...[
          const SizedBox(height: 2),
          Text(
            widget.field['helpText'] as String,
            style: AppTypography.caption
                .copyWith(color: AppColors.mutedForeground),
          ),
        ],
        const SizedBox(height: 8),

        // Address search
        if (showSearch) ...[
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _searchController,
                  enabled: widget.enabled,
                  decoration: InputDecoration(
                    hintText: 'Buscar endereco...',
                    isDense: true,
                    suffixIcon: _isReversing
                        ? const Padding(
                            padding: EdgeInsets.all(12),
                            child: SizedBox(
                              width: 16,
                              height: 16,
                              child:
                                  CircularProgressIndicator(strokeWidth: 2),
                            ),
                          )
                        : null,
                  ),
                  onSubmitted: (_) => _handleSearch(),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                width: 40,
                height: 40,
                child: IconButton(
                  onPressed:
                      widget.enabled && !_isSearching ? _handleSearch : null,
                  icon: _isSearching
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.search, size: 20),
                  style: IconButton.styleFrom(
                    backgroundColor: AppColors.muted,
                  ),
                ),
              ),
            ],
          ),
          // Search results
          if (_searchResults.isNotEmpty)
            Container(
              margin: const EdgeInsets.only(top: 4),
              constraints: const BoxConstraints(maxHeight: 180),
              decoration: BoxDecoration(
                border: Border.all(color: AppColors.border),
                borderRadius: BorderRadius.circular(8),
              ),
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: _searchResults.length,
                separatorBuilder: (_, __) =>
                    Divider(height: 1, color: AppColors.border),
                itemBuilder: (_, i) {
                  final r = _searchResults[i];
                  final parts = extractAddressParts(
                      r['address'] as Map<String, dynamic>?);
                  final formatted = formatAddress(parts);
                  return ListTile(
                    dense: true,
                    leading: Icon(Icons.place,
                        size: 18, color: AppColors.mutedForeground),
                    title: Text(
                      formatted.isNotEmpty
                          ? formatted
                          : r['display_name']?.toString() ?? '',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 13),
                    ),
                    subtitle: formatted.isNotEmpty
                        ? Text(
                            r['display_name']?.toString() ?? '',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                                fontSize: 11,
                                color: AppColors.mutedForeground),
                          )
                        : null,
                    onTap: () => _selectSearchResult(r),
                  );
                },
              ),
            ),
          const SizedBox(height: 8),
        ],

        // Inline map
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: SizedBox(
            height: _mapHeight,
            child: FlutterMap(
              mapController: _mapController,
              options: MapOptions(
                initialCenter:
                    _hasCoords ? LatLng(_lat!, _lng!) : _defaultCenter,
                initialZoom: _hasCoords ? 15 : _defaultZoom,
                onTap: _onMapTap,
              ),
              children: [
                TileLayer(
                  urlTemplate:
                      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.crmbuilder.mobile',
                  tileProvider: CachedTileProvider(),
                ),
                if (_hasCoords)
                  MarkerLayer(
                    markers: [
                      Marker(
                        point: LatLng(_lat!, _lng!),
                        width: 40,
                        height: 40,
                        child: const Icon(
                          Icons.location_pin,
                          color: Colors.red,
                          size: 40,
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ),
        ),

        // Map action buttons
        if (widget.enabled) ...[
          const SizedBox(height: 8),
          Row(
            children: [
              _ActionChip(
                icon: Icons.fullscreen,
                label: 'Expandir',
                onTap: _openFullScreenPicker,
              ),
              const SizedBox(width: 8),
              _ActionChip(
                icon: Icons.my_location,
                label: 'GPS',
                onTap: _goToMyLocation,
              ),
              if (_hasCoords) ...[
                const SizedBox(width: 8),
                _ActionChip(
                  icon: Icons.open_in_new,
                  label: 'Abrir',
                  onTap: _openInMaps,
                ),
              ],
              const Spacer(),
              if (_hasCoords)
                _ActionChip(
                  icon: Icons.clear,
                  label: 'Limpar',
                  onTap: _clear,
                  destructive: true,
                ),
            ],
          ),
        ],

        // Lat/Lng manual inputs
        if (showCoords) ...[
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextField(
                  enabled: widget.enabled,
                  decoration: const InputDecoration(
                    labelText: 'Latitude',
                    isDense: true,
                  ),
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true, signed: true),
                  controller: TextEditingController(
                      text: _lat?.toStringAsFixed(6) ?? ''),
                  onChanged: (v) {
                    final lat = double.tryParse(v);
                    if (lat != null) {
                      _updateValue({'lat': lat});
                      if (_lng != null) {
                        _mapController.move(LatLng(lat, _lng!), 15);
                        _scheduleReverseGeocode(lat, _lng!);
                      }
                    }
                  },
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  enabled: widget.enabled,
                  decoration: const InputDecoration(
                    labelText: 'Longitude',
                    isDense: true,
                  ),
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true, signed: true),
                  controller: TextEditingController(
                      text: _lng?.toStringAsFixed(6) ?? ''),
                  onChanged: (v) {
                    final lng = double.tryParse(v);
                    if (lng != null) {
                      _updateValue({'lng': lng});
                      if (_lat != null) {
                        _mapController.move(LatLng(_lat!, lng), 15);
                        _scheduleReverseGeocode(_lat!, lng);
                      }
                    }
                  },
                ),
              ),
            ],
          ),
        ],

        // Address info (readonly, filled by geocoding)
        if (showAddressFields && _hasCoords) ...[
          const SizedBox(height: 8),
          _ReadonlyField(
              label: 'Endereco', value: _val['address']?.toString()),
          const SizedBox(height: 4),
          Row(
            children: [
              Expanded(
                child: _ReadonlyField(
                    label: 'Cidade', value: _val['city']?.toString()),
              ),
              const SizedBox(width: 12),
              SizedBox(
                width: 80,
                child: _ReadonlyField(
                    label: 'UF', value: _val['uf']?.toString()),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

// ─── Display-only widget for MAP field ─────────────────────────────────────

class MapFieldDisplay extends StatelessWidget {
  const MapFieldDisplay({
    super.key,
    required this.value,
    required this.fieldName,
  });

  final dynamic value;
  final String fieldName;

  Map<String, dynamic> get _val {
    if (value is Map<String, dynamic>) return value as Map<String, dynamic>;
    if (value is Map) return Map<String, dynamic>.from(value as Map);
    return {};
  }

  double? get _lat {
    final v = _val['lat'];
    if (v is num) return v.toDouble();
    if (v is String) return double.tryParse(v);
    return null;
  }

  double? get _lng {
    final v = _val['lng'];
    if (v is num) return v.toDouble();
    if (v is String) return double.tryParse(v);
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final address = _val['address']?.toString() ?? '';
    final city = _val['city']?.toString() ?? '';
    final uf = _val['uf']?.toString() ?? '';
    final hasCoords = _lat != null && _lng != null;
    final hasAddress = address.isNotEmpty || city.isNotEmpty;

    if (!hasCoords && !hasAddress) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (fieldName.isNotEmpty)
            Text(fieldName, style: AppTypography.caption.copyWith(
              color: AppColors.mutedForeground,
            )),
          if (fieldName.isNotEmpty) const SizedBox(height: 4),
          Text('Sem localizacao', style: AppTypography.bodySmall.copyWith(
            color: AppColors.mutedForeground,
          )),
        ],
      );
    }

    final locationParts = <String>[];
    if (address.isNotEmpty) locationParts.add(address);
    if (city.isNotEmpty && uf.isNotEmpty) {
      locationParts.add('$city - $uf');
    } else if (city.isNotEmpty) {
      locationParts.add(city);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (fieldName.isNotEmpty)
          Text(fieldName, style: AppTypography.caption.copyWith(
            color: AppColors.mutedForeground,
          )),
        if (fieldName.isNotEmpty) const SizedBox(height: 4),
        if (locationParts.isNotEmpty)
          Text(locationParts.join('\n'), style: AppTypography.bodyMedium),
        if (hasCoords) ...[
          const SizedBox(height: 4),
          Row(
            children: [
              Icon(Icons.place, size: 14, color: AppColors.mutedForeground),
              const SizedBox(width: 4),
              Text(
                '${_lat!.toStringAsFixed(6)}, ${_lng!.toStringAsFixed(6)}',
                style: AppTypography.caption.copyWith(
                  color: AppColors.mutedForeground,
                ),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: () async {
                  final url = Uri.parse(
                    'https://www.google.com/maps/search/?api=1&query=$_lat,$_lng',
                  );
                  if (await canLaunchUrl(url)) {
                    await launchUrl(url, mode: LaunchMode.externalApplication);
                  }
                },
                child: Text(
                  'Abrir no mapa',
                  style: AppTypography.caption.copyWith(
                    color: AppColors.primary,
                    decoration: TextDecoration.underline,
                  ),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

// ─── Full Screen Map Picker ────────────────────────────────────────────────

class _FullScreenMapPicker extends StatefulWidget {
  const _FullScreenMapPicker({
    required this.initialCenter,
    required this.initialZoom,
  });

  final LatLng initialCenter;
  final double initialZoom;

  @override
  State<_FullScreenMapPicker> createState() => _FullScreenMapPickerState();
}

class _FullScreenMapPickerState extends State<_FullScreenMapPicker> {
  late final MapController _mapController;
  LatLng _center = const LatLng(0, 0);

  @override
  void initState() {
    super.initState();
    _mapController = MapController();
    _center = widget.initialCenter;
  }

  Future<void> _goToMyLocation() async {
    try {
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied ||
          perm == LocationPermission.deniedForever) {
        return;
      }
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 10),
        ),
      );
      final newCenter = LatLng(pos.latitude, pos.longitude);
      setState(() => _center = newCenter);
      _mapController.move(newCenter, 15);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Selecionar local'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(_center),
            child: const Text('Confirmar'),
          ),
        ],
      ),
      body: Stack(
        children: [
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: widget.initialCenter,
              initialZoom: widget.initialZoom,
              onPositionChanged: (pos, _) {
                setState(() => _center = pos.center);
              },
            ),
            children: [
              TileLayer(
                urlTemplate:
                    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.crmbuilder.mobile',
              ),
            ],
          ),
          // Fixed center marker
          const Center(
            child: Padding(
              padding: EdgeInsets.only(bottom: 40),
              child: Icon(Icons.location_pin, color: Colors.red, size: 48),
            ),
          ),
          // Coordinates display
          Positioned(
            bottom: 16,
            left: 16,
            right: 80,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.9),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                '${_center.latitude.toStringAsFixed(6)}, ${_center.longitude.toStringAsFixed(6)}',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
              ),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.small(
        onPressed: _goToMyLocation,
        child: const Icon(Icons.my_location),
      ),
    );
  }
}

// ─── Helper widgets ────────────────────────────────────────────────────────

class _ActionChip extends StatelessWidget {
  const _ActionChip({
    required this.icon,
    required this.label,
    required this.onTap,
    this.destructive = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final color = destructive ? AppColors.destructive : AppColors.foreground;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: color),
            const SizedBox(width: 4),
            Text(label, style: TextStyle(fontSize: 12, color: color)),
          ],
        ),
      ),
    );
  }
}

class _ReadonlyField extends StatelessWidget {
  const _ReadonlyField({required this.label, this.value});

  final String label;
  final String? value;

  @override
  Widget build(BuildContext context) {
    if (value == null || value!.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: AppTypography.caption.copyWith(
          color: AppColors.mutedForeground,
          fontSize: 10,
        )),
        Text(value!, style: const TextStyle(fontSize: 13)),
      ],
    );
  }
}
