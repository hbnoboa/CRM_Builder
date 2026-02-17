// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'startup_service.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$startupServiceHash() => r'cb99b9c051f69a8a8da0e0a2e354b0397f66c48e';

/// Startup service that handles background sync tasks when:
/// - App starts (and user is authenticated)
/// - Connectivity changes from offline to online
///
/// Copied from [StartupService].
@ProviderFor(StartupService)
final startupServiceProvider =
    AutoDisposeNotifierProvider<StartupService, void>.internal(
  StartupService.new,
  name: r'startupServiceProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$startupServiceHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

typedef _$StartupService = AutoDisposeNotifier<void>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
