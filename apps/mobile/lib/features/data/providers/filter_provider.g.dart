// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'filter_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$entityLocalFiltersHash() =>
    r'c60bddbadbd12ce009ebdeba028820e0418d8870';

/// Manages local (session-only) filters per entity.
/// These filters are NOT persisted and reset when the app restarts.
///
/// Copied from [EntityLocalFilters].
@ProviderFor(EntityLocalFilters)
final entityLocalFiltersProvider = AutoDisposeNotifierProvider<
    EntityLocalFilters, Map<String, List<LocalFilter>>>.internal(
  EntityLocalFilters.new,
  name: r'entityLocalFiltersProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$entityLocalFiltersHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

typedef _$EntityLocalFilters
    = AutoDisposeNotifier<Map<String, List<LocalFilter>>>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
