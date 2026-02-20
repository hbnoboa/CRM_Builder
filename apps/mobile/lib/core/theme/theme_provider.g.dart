// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'theme_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$tenantThemeHash() => r'8856fdb8e973f2c50f0fce7be5f21653176079cb';

/// Riverpod provider that manages the dynamic tenant theme.
/// Provides both light and dark variants.
///
/// Copied from [TenantTheme].
@ProviderFor(TenantTheme)
final tenantThemeProvider =
    NotifierProvider<TenantTheme, TenantThemeState>.internal(
  TenantTheme.new,
  name: r'tenantThemeProvider',
  debugGetCreateSourceHash:
      const bool.fromEnvironment('dart.vm.product') ? null : _$tenantThemeHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

typedef _$TenantTheme = Notifier<TenantThemeState>;
String _$themeModeNotifierHash() => r'ff8f109f323264306c513ec20aff62ff9e39864a';

/// Manages the theme mode (light/dark/system).
///
/// Copied from [ThemeModeNotifier].
@ProviderFor(ThemeModeNotifier)
final themeModeNotifierProvider =
    NotifierProvider<ThemeModeNotifier, ThemeMode>.internal(
  ThemeModeNotifier.new,
  name: r'themeModeNotifierProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$themeModeNotifierHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

typedef _$ThemeModeNotifier = Notifier<ThemeMode>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
