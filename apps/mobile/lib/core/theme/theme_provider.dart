import 'package:flutter/material.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:crm_mobile/core/theme/app_theme.dart';
import 'package:crm_mobile/core/theme/theme_generator.dart';
import 'package:crm_mobile/core/auth/secure_storage.dart';

part 'theme_provider.g.dart';

/// Riverpod provider that manages the dynamic tenant theme.
/// Falls back to AppTheme.light when no brand color is set.
@Riverpod(keepAlive: true)
class TenantTheme extends _$TenantTheme {
  @override
  ThemeData build() {
    // Try to load cached brand color on startup
    _loadCachedTheme();
    return AppTheme.light;
  }

  Future<void> _loadCachedTheme() async {
    final brandColor = await SecureStorage.getString('brandColor');
    if (brandColor != null && brandColor.isNotEmpty) {
      try {
        final colors = generateThemeColors(brandColor);
        state = AppTheme.fromColors(colors);
      } catch (e) {
        debugPrint('[TenantTheme] Failed to generate theme from cached color: $e');
      }
    }
  }

  /// Apply a brand color to generate the full theme.
  /// Pass null or empty to reset to default.
  void applyBrandColor(String? hex) {
    if (hex == null || hex.isEmpty) {
      state = AppTheme.light;
      return;
    }
    try {
      final colors = generateThemeColors(hex);
      state = AppTheme.fromColors(colors);
    } catch (e) {
      debugPrint('[TenantTheme] Failed to generate theme: $e');
      state = AppTheme.light;
    }
  }
}
