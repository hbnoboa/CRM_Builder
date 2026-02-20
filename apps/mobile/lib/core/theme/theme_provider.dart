import 'package:flutter/material.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:crm_mobile/core/theme/app_theme.dart';
import 'package:crm_mobile/core/theme/theme_generator.dart';
import 'package:crm_mobile/core/auth/secure_storage.dart';

part 'theme_provider.g.dart';

/// State containing both light and dark themes.
class TenantThemeState {
  final ThemeData light;
  final ThemeData dark;

  const TenantThemeState({required this.light, required this.dark});

  factory TenantThemeState.defaults() => TenantThemeState(
        light: AppTheme.light,
        dark: AppTheme.dark,
      );
}

/// Riverpod provider that manages the dynamic tenant theme.
/// Provides both light and dark variants.
@Riverpod(keepAlive: true)
class TenantTheme extends _$TenantTheme {
  @override
  TenantThemeState build() {
    // Try to load cached brand color on startup
    _loadCachedTheme();
    return TenantThemeState.defaults();
  }

  Future<void> _loadCachedTheme() async {
    final brandColor = await SecureStorage.getString('brandColor');
    debugPrint('[TenantTheme] _loadCachedTheme - cached brandColor: "$brandColor"');
    // Check for valid hex color (not null, not empty, not the string "null")
    if (brandColor != null && brandColor.isNotEmpty && brandColor != 'null') {
      try {
        final lightColors = generateThemeColors(brandColor);
        final darkColors = generateThemeColors(brandColor, isDark: true);
        debugPrint('[TenantTheme] Generated theme from cache, primary: ${lightColors.primary}');
        state = TenantThemeState(
          light: AppTheme.fromColors(lightColors),
          dark: AppTheme.fromColors(darkColors),
        );
      } catch (e) {
        debugPrint('[TenantTheme] Failed to generate theme from cached color: $e');
      }
    } else {
      debugPrint('[TenantTheme] No cached brandColor, using default theme');
    }
  }

  /// Apply a brand color to generate the full theme.
  /// Pass null or empty to reset to default.
  void applyBrandColor(String? hex) {
    debugPrint('[TenantTheme] applyBrandColor called with: "$hex"');
    // Check for valid hex color (not null, not empty, not the string "null")
    if (hex == null || hex.isEmpty || hex == 'null') {
      debugPrint('[TenantTheme] No brand color, using default theme');
      state = TenantThemeState.defaults();
      return;
    }
    try {
      final lightColors = generateThemeColors(hex);
      final darkColors = generateThemeColors(hex, isDark: true);
      debugPrint('[TenantTheme] Applied theme with primary: ${lightColors.primary}');
      state = TenantThemeState(
        light: AppTheme.fromColors(lightColors),
        dark: AppTheme.fromColors(darkColors),
      );
    } catch (e) {
      debugPrint('[TenantTheme] Failed to generate theme: $e');
      state = TenantThemeState.defaults();
    }
  }
}

/// Manages the theme mode (light/dark/system).
@Riverpod(keepAlive: true)
class ThemeModeNotifier extends _$ThemeModeNotifier {
  static const _storageKey = 'themeMode';

  @override
  ThemeMode build() {
    _loadSavedMode();
    return ThemeMode.system;
  }

  Future<void> _loadSavedMode() async {
    final saved = await SecureStorage.getString(_storageKey);
    if (saved != null) {
      switch (saved) {
        case 'light':
          state = ThemeMode.light;
        case 'dark':
          state = ThemeMode.dark;
        default:
          state = ThemeMode.system;
      }
    }
  }

  Future<void> setThemeMode(ThemeMode mode) async {
    state = mode;
    final value = switch (mode) {
      ThemeMode.light => 'light',
      ThemeMode.dark => 'dark',
      ThemeMode.system => 'system',
    };
    await SecureStorage.setString(_storageKey, value);
  }

  void toggleTheme() {
    final newMode = switch (state) {
      ThemeMode.light => ThemeMode.dark,
      ThemeMode.dark => ThemeMode.light,
      ThemeMode.system => ThemeMode.dark,
    };
    setThemeMode(newMode);
  }
}
