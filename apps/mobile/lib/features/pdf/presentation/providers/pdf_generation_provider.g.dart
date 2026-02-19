// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'pdf_generation_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$pdfTemplatesForEntityHash() =>
    r'742ef3a968198ffb1deb3ba5d71cf87d4d444882';

/// Copied from Dart SDK
class _SystemHash {
  _SystemHash._();

  static int combine(int hash, int value) {
    // ignore: parameter_assignments
    hash = 0x1fffffff & (hash + value);
    // ignore: parameter_assignments
    hash = 0x1fffffff & (hash + ((0x0007ffff & hash) << 10));
    return hash ^ (hash >> 6);
  }

  static int finish(int hash) {
    // ignore: parameter_assignments
    hash = 0x1fffffff & (hash + ((0x03ffffff & hash) << 3));
    // ignore: parameter_assignments
    hash = hash ^ (hash >> 11);
    return 0x1fffffff & (hash + ((0x00003fff & hash) << 15));
  }
}

/// Provider para listar templates disponiveis para uma entidade
///
/// Copied from [pdfTemplatesForEntity].
@ProviderFor(pdfTemplatesForEntity)
const pdfTemplatesForEntityProvider = PdfTemplatesForEntityFamily();

/// Provider para listar templates disponiveis para uma entidade
///
/// Copied from [pdfTemplatesForEntity].
class PdfTemplatesForEntityFamily
    extends Family<AsyncValue<List<PdfTemplate>>> {
  /// Provider para listar templates disponiveis para uma entidade
  ///
  /// Copied from [pdfTemplatesForEntity].
  const PdfTemplatesForEntityFamily();

  /// Provider para listar templates disponiveis para uma entidade
  ///
  /// Copied from [pdfTemplatesForEntity].
  PdfTemplatesForEntityProvider call(
    String entitySlug,
  ) {
    return PdfTemplatesForEntityProvider(
      entitySlug,
    );
  }

  @override
  PdfTemplatesForEntityProvider getProviderOverride(
    covariant PdfTemplatesForEntityProvider provider,
  ) {
    return call(
      provider.entitySlug,
    );
  }

  static const Iterable<ProviderOrFamily>? _dependencies = null;

  @override
  Iterable<ProviderOrFamily>? get dependencies => _dependencies;

  static const Iterable<ProviderOrFamily>? _allTransitiveDependencies = null;

  @override
  Iterable<ProviderOrFamily>? get allTransitiveDependencies =>
      _allTransitiveDependencies;

  @override
  String? get name => r'pdfTemplatesForEntityProvider';
}

/// Provider para listar templates disponiveis para uma entidade
///
/// Copied from [pdfTemplatesForEntity].
class PdfTemplatesForEntityProvider
    extends AutoDisposeFutureProvider<List<PdfTemplate>> {
  /// Provider para listar templates disponiveis para uma entidade
  ///
  /// Copied from [pdfTemplatesForEntity].
  PdfTemplatesForEntityProvider(
    String entitySlug,
  ) : this._internal(
          (ref) => pdfTemplatesForEntity(
            ref as PdfTemplatesForEntityRef,
            entitySlug,
          ),
          from: pdfTemplatesForEntityProvider,
          name: r'pdfTemplatesForEntityProvider',
          debugGetCreateSourceHash:
              const bool.fromEnvironment('dart.vm.product')
                  ? null
                  : _$pdfTemplatesForEntityHash,
          dependencies: PdfTemplatesForEntityFamily._dependencies,
          allTransitiveDependencies:
              PdfTemplatesForEntityFamily._allTransitiveDependencies,
          entitySlug: entitySlug,
        );

  PdfTemplatesForEntityProvider._internal(
    super._createNotifier, {
    required super.name,
    required super.dependencies,
    required super.allTransitiveDependencies,
    required super.debugGetCreateSourceHash,
    required super.from,
    required this.entitySlug,
  }) : super.internal();

  final String entitySlug;

  @override
  Override overrideWith(
    FutureOr<List<PdfTemplate>> Function(PdfTemplatesForEntityRef provider)
        create,
  ) {
    return ProviderOverride(
      origin: this,
      override: PdfTemplatesForEntityProvider._internal(
        (ref) => create(ref as PdfTemplatesForEntityRef),
        from: from,
        name: null,
        dependencies: null,
        allTransitiveDependencies: null,
        debugGetCreateSourceHash: null,
        entitySlug: entitySlug,
      ),
    );
  }

  @override
  AutoDisposeFutureProviderElement<List<PdfTemplate>> createElement() {
    return _PdfTemplatesForEntityProviderElement(this);
  }

  @override
  bool operator ==(Object other) {
    return other is PdfTemplatesForEntityProvider &&
        other.entitySlug == entitySlug;
  }

  @override
  int get hashCode {
    var hash = _SystemHash.combine(0, runtimeType.hashCode);
    hash = _SystemHash.combine(hash, entitySlug.hashCode);

    return _SystemHash.finish(hash);
  }
}

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
mixin PdfTemplatesForEntityRef
    on AutoDisposeFutureProviderRef<List<PdfTemplate>> {
  /// The parameter `entitySlug` of this provider.
  String get entitySlug;
}

class _PdfTemplatesForEntityProviderElement
    extends AutoDisposeFutureProviderElement<List<PdfTemplate>>
    with PdfTemplatesForEntityRef {
  _PdfTemplatesForEntityProviderElement(super.provider);

  @override
  String get entitySlug => (origin as PdfTemplatesForEntityProvider).entitySlug;
}

String _$pdfGenerationHash() => r'2a42686df1469f648d20891af1be8d146f35231e';

/// Notifier para geracao de PDF
///
/// Copied from [PdfGeneration].
@ProviderFor(PdfGeneration)
final pdfGenerationProvider = AutoDisposeNotifierProvider<PdfGeneration,
    AsyncValue<PdfGenerationStatus?>>.internal(
  PdfGeneration.new,
  name: r'pdfGenerationProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$pdfGenerationHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

typedef _$PdfGeneration = AutoDisposeNotifier<AsyncValue<PdfGenerationStatus?>>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
