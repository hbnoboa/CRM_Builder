import 'dart:async';
import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import 'package:crm_mobile/core/cache/crm_cache_manager.dart';
import 'package:crm_mobile/core/database/app_database.dart';

part 'image_prefetch_service.g.dart';

final _logger = Logger(printer: SimplePrinter());

/// Proactively downloads images from EntityData records for offline viewing.
/// Watches PowerSync for changes and pre-caches image URLs.
class ImagePrefetchService {
  StreamSubscription<List<Map<String, dynamic>>>? _subscription;
  final _cacheManager = CrmCacheManager();
  bool _processing = false;
  final _cachedUrls = <String>{};

  static const _maxConcurrent = 3;

  /// Start watching EntityData for image URLs to prefetch.
  void init() {
    final db = AppDatabase.instance.db;

    _subscription = db
        .watch('SELECT id, data FROM EntityData WHERE deletedAt IS NULL')
        .listen(_onDataChanged);

    _logger.i('ImagePrefetchService started');
  }

  /// Stop watching.
  void dispose() {
    _subscription?.cancel();
    _subscription = null;
  }

  void _onDataChanged(List<Map<String, dynamic>> records) {
    if (_processing) return;
    _prefetchImages(records);
  }

  Future<void> _prefetchImages(List<Map<String, dynamic>> records) async {
    _processing = true;

    try {
      final urls = <String>{};

      for (final record in records) {
        final dataStr = record['data'] as String?;
        if (dataStr == null || dataStr.isEmpty) continue;

        try {
          final data = jsonDecode(dataStr);
          if (data is Map) {
            _extractImageUrls(data, urls);
          }
        } catch (_) {}
      }

      // Filter out already cached URLs and local:// placeholders
      final toPrefetch = urls
          .where((url) =>
              url.startsWith('http') &&
              !_cachedUrls.contains(url),)
          .toList();

      if (toPrefetch.isEmpty) return;

      _logger.i('Prefetching ${toPrefetch.length} images');

      // Download in batches of _maxConcurrent
      for (var i = 0; i < toPrefetch.length; i += _maxConcurrent) {
        final batch = toPrefetch.skip(i).take(_maxConcurrent);
        await Future.wait(
          batch.map((url) => _downloadOne(url)),
          eagerError: false,
        );
      }
    } catch (e) {
      _logger.e('Prefetch error: $e');
    } finally {
      _processing = false;
    }
  }

  Future<void> _downloadOne(String url) async {
    try {
      await _cacheManager.downloadFile(url);
      _cachedUrls.add(url);
    } catch (e) {
      // Silently skip failed downloads
      _logger.d('Prefetch failed for $url: $e');
    }
  }

  /// Extract image/file URLs from entity data JSON.
  void _extractImageUrls(Map<dynamic, dynamic> data, Set<String> urls) {
    for (final value in data.values) {
      if (value is String && value.startsWith('http')) {
        // Heuristic: URLs ending in image extensions or containing /upload/
        if (_isImageUrl(value)) {
          urls.add(value);
        }
      } else if (value is Map) {
        _extractImageUrls(value, urls);
      } else if (value is List) {
        for (final item in value) {
          if (item is String && item.startsWith('http') && _isImageUrl(item)) {
            urls.add(item);
          } else if (item is Map) {
            _extractImageUrls(item, urls);
          }
        }
      }
    }
  }

  bool _isImageUrl(String url) {
    final lower = url.toLowerCase();
    return lower.contains('/upload/') ||
        lower.endsWith('.jpg') ||
        lower.endsWith('.jpeg') ||
        lower.endsWith('.png') ||
        lower.endsWith('.webp') ||
        lower.endsWith('.gif') ||
        lower.endsWith('.svg') ||
        lower.endsWith('.pdf');
  }

  /// Clear the internal tracking set (useful after cache clear).
  void resetTracking() {
    _cachedUrls.clear();
  }
}

@Riverpod(keepAlive: true)
ImagePrefetchService imagePrefetchService(Ref ref) {
  final service = ImagePrefetchService();
  service.init();
  ref.onDispose(() => service.dispose());
  return service;
}
