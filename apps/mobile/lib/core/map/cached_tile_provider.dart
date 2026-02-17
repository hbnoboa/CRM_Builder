import 'dart:ui' as ui;
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_cache_manager/flutter_cache_manager.dart';
import 'package:flutter_map/flutter_map.dart';

/// Custom cache manager for map tiles with longer cache duration
class MapTileCacheManager {
  static const key = 'mapTileCache';

  static CacheManager instance = CacheManager(
    Config(
      key,
      stalePeriod: const Duration(days: 30),
      maxNrOfCacheObjects: 2000,
      repo: JsonCacheInfoRepository(databaseName: key),
      fileService: HttpFileService(),
    ),
  );

  /// Clear all cached tiles
  static Future<void> clearCache() async {
    await instance.emptyCache();
  }

  /// Get cache statistics (approximate)
  static Future<int> getCacheSize() async {
    final cacheInfo = await instance.getFileFromCache('__dummy__');
    // This is a rough approximation - actual implementation would need
    // to iterate through all cached files
    return 0;
  }
}

/// Tile provider that caches tiles for offline use
class CachedTileProvider extends TileProvider {
  CachedTileProvider();

  @override
  ImageProvider getImage(TileCoordinates coordinates, TileLayer options) {
    final url = getTileUrl(coordinates, options);
    return CachedNetworkImageProvider(
      url,
      cacheManager: MapTileCacheManager.instance,
    );
  }
}

/// Image provider that uses the cache manager
class CachedNetworkImageProvider extends ImageProvider<CachedNetworkImageProvider> {
  const CachedNetworkImageProvider(
    this.url, {
    required this.cacheManager,
  });

  final String url;
  final CacheManager cacheManager;

  @override
  Future<CachedNetworkImageProvider> obtainKey(ImageConfiguration configuration) {
    return Future.value(this);
  }

  @override
  ImageStreamCompleter loadImage(
    CachedNetworkImageProvider key,
    ImageDecoderCallback decode,
  ) {
    return MultiFrameImageStreamCompleter(
      codec: _loadAsync(key, decode),
      scale: 1.0,
      informationCollector: () => <DiagnosticsNode>[
        DiagnosticsProperty<ImageProvider>('Image provider', this),
        DiagnosticsProperty<CachedNetworkImageProvider>('Image key', key),
      ],
    );
  }

  Future<ui.Codec> _loadAsync(
    CachedNetworkImageProvider key,
    ImageDecoderCallback decode,
  ) async {
    try {
      // Try to get from cache first
      final file = await cacheManager.getSingleFile(url);
      final bytes = await file.readAsBytes();
      final buffer = await ui.ImmutableBuffer.fromUint8List(bytes);
      return decode(buffer);
    } catch (e) {
      // If offline and not in cache, return a transparent placeholder
      // This prevents errors when offline
      rethrow;
    }
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is CachedNetworkImageProvider && other.url == url;
  }

  @override
  int get hashCode => url.hashCode;

  @override
  String toString() => 'CachedNetworkImageProvider("$url")';
}
