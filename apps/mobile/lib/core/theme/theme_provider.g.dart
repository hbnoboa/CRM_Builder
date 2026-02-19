// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'theme_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$tenantThemeHash() => r'6cdbca5a4fb4f7396cdbcfa94e8b475b83c1b396';

/// Riverpod provider that manages the dynamic tenant theme.
/// Falls back to AppTheme.light when no brand color is set.
///
/// Copied from [TenantTheme].
@ProviderFor(TenantTheme)
final tenantThemeProvider = NotifierProvider<TenantTheme, ThemeData>.internal(
  TenantTheme.new,
  name: r'tenantThemeProvider',
  debugGetCreateSourceHash:
      const bool.fromEnvironment('dart.vm.product') ? null : _$tenantThemeHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

typedef _$TenantTheme = Notifier<ThemeData>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
