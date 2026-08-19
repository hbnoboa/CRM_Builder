// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'chat_providers.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$chatChannelsHash() => r'd666c42c24b80989a590307dda1695c375c9f395';

/// Stream reativo dos canais visiveis (cache local do PowerSync).
///
/// Copied from [chatChannels].
@ProviderFor(chatChannels)
final chatChannelsProvider =
    AutoDisposeStreamProvider<List<Map<String, dynamic>>>.internal(
  chatChannels,
  name: r'chatChannelsProvider',
  debugGetCreateSourceHash:
      const bool.fromEnvironment('dart.vm.product') ? null : _$chatChannelsHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef ChatChannelsRef
    = AutoDisposeStreamProviderRef<List<Map<String, dynamic>>>;
String _$chatMessagesHash() => r'951867bfbee882da1664efa4e57f846b3a00f4bd';

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

/// Stream reativo das mensagens de um canal. O historico ja esta local (sync
/// sem LIMIT), entao paginar = aumentar `limit` deste family.
///
/// Copied from [chatMessages].
@ProviderFor(chatMessages)
const chatMessagesProvider = ChatMessagesFamily();

/// Stream reativo das mensagens de um canal. O historico ja esta local (sync
/// sem LIMIT), entao paginar = aumentar `limit` deste family.
///
/// Copied from [chatMessages].
class ChatMessagesFamily
    extends Family<AsyncValue<List<Map<String, dynamic>>>> {
  /// Stream reativo das mensagens de um canal. O historico ja esta local (sync
  /// sem LIMIT), entao paginar = aumentar `limit` deste family.
  ///
  /// Copied from [chatMessages].
  const ChatMessagesFamily();

  /// Stream reativo das mensagens de um canal. O historico ja esta local (sync
  /// sem LIMIT), entao paginar = aumentar `limit` deste family.
  ///
  /// Copied from [chatMessages].
  ChatMessagesProvider call(
    String channelId, {
    int limit = 100,
  }) {
    return ChatMessagesProvider(
      channelId,
      limit: limit,
    );
  }

  @override
  ChatMessagesProvider getProviderOverride(
    covariant ChatMessagesProvider provider,
  ) {
    return call(
      provider.channelId,
      limit: provider.limit,
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
  String? get name => r'chatMessagesProvider';
}

/// Stream reativo das mensagens de um canal. O historico ja esta local (sync
/// sem LIMIT), entao paginar = aumentar `limit` deste family.
///
/// Copied from [chatMessages].
class ChatMessagesProvider
    extends AutoDisposeStreamProvider<List<Map<String, dynamic>>> {
  /// Stream reativo das mensagens de um canal. O historico ja esta local (sync
  /// sem LIMIT), entao paginar = aumentar `limit` deste family.
  ///
  /// Copied from [chatMessages].
  ChatMessagesProvider(
    String channelId, {
    int limit = 100,
  }) : this._internal(
          (ref) => chatMessages(
            ref as ChatMessagesRef,
            channelId,
            limit: limit,
          ),
          from: chatMessagesProvider,
          name: r'chatMessagesProvider',
          debugGetCreateSourceHash:
              const bool.fromEnvironment('dart.vm.product')
                  ? null
                  : _$chatMessagesHash,
          dependencies: ChatMessagesFamily._dependencies,
          allTransitiveDependencies:
              ChatMessagesFamily._allTransitiveDependencies,
          channelId: channelId,
          limit: limit,
        );

  ChatMessagesProvider._internal(
    super._createNotifier, {
    required super.name,
    required super.dependencies,
    required super.allTransitiveDependencies,
    required super.debugGetCreateSourceHash,
    required super.from,
    required this.channelId,
    required this.limit,
  }) : super.internal();

  final String channelId;
  final int limit;

  @override
  Override overrideWith(
    Stream<List<Map<String, dynamic>>> Function(ChatMessagesRef provider)
        create,
  ) {
    return ProviderOverride(
      origin: this,
      override: ChatMessagesProvider._internal(
        (ref) => create(ref as ChatMessagesRef),
        from: from,
        name: null,
        dependencies: null,
        allTransitiveDependencies: null,
        debugGetCreateSourceHash: null,
        channelId: channelId,
        limit: limit,
      ),
    );
  }

  @override
  AutoDisposeStreamProviderElement<List<Map<String, dynamic>>> createElement() {
    return _ChatMessagesProviderElement(this);
  }

  @override
  bool operator ==(Object other) {
    return other is ChatMessagesProvider &&
        other.channelId == channelId &&
        other.limit == limit;
  }

  @override
  int get hashCode {
    var hash = _SystemHash.combine(0, runtimeType.hashCode);
    hash = _SystemHash.combine(hash, channelId.hashCode);
    hash = _SystemHash.combine(hash, limit.hashCode);

    return _SystemHash.finish(hash);
  }
}

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
mixin ChatMessagesRef
    on AutoDisposeStreamProviderRef<List<Map<String, dynamic>>> {
  /// The parameter `channelId` of this provider.
  String get channelId;

  /// The parameter `limit` of this provider.
  int get limit;
}

class _ChatMessagesProviderElement
    extends AutoDisposeStreamProviderElement<List<Map<String, dynamic>>>
    with ChatMessagesRef {
  _ChatMessagesProviderElement(super.provider);

  @override
  String get channelId => (origin as ChatMessagesProvider).channelId;
  @override
  int get limit => (origin as ChatMessagesProvider).limit;
}

String _$chatCommandsHash() => r'909482cf097f63b9c361636473c5bda9f91afe73';

/// Comandos disponiveis no canal (Dio, online; filtrados por permissao).
///
/// Copied from [chatCommands].
@ProviderFor(chatCommands)
const chatCommandsProvider = ChatCommandsFamily();

/// Comandos disponiveis no canal (Dio, online; filtrados por permissao).
///
/// Copied from [chatCommands].
class ChatCommandsFamily
    extends Family<AsyncValue<List<Map<String, dynamic>>>> {
  /// Comandos disponiveis no canal (Dio, online; filtrados por permissao).
  ///
  /// Copied from [chatCommands].
  const ChatCommandsFamily();

  /// Comandos disponiveis no canal (Dio, online; filtrados por permissao).
  ///
  /// Copied from [chatCommands].
  ChatCommandsProvider call(
    String channelId,
  ) {
    return ChatCommandsProvider(
      channelId,
    );
  }

  @override
  ChatCommandsProvider getProviderOverride(
    covariant ChatCommandsProvider provider,
  ) {
    return call(
      provider.channelId,
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
  String? get name => r'chatCommandsProvider';
}

/// Comandos disponiveis no canal (Dio, online; filtrados por permissao).
///
/// Copied from [chatCommands].
class ChatCommandsProvider
    extends AutoDisposeFutureProvider<List<Map<String, dynamic>>> {
  /// Comandos disponiveis no canal (Dio, online; filtrados por permissao).
  ///
  /// Copied from [chatCommands].
  ChatCommandsProvider(
    String channelId,
  ) : this._internal(
          (ref) => chatCommands(
            ref as ChatCommandsRef,
            channelId,
          ),
          from: chatCommandsProvider,
          name: r'chatCommandsProvider',
          debugGetCreateSourceHash:
              const bool.fromEnvironment('dart.vm.product')
                  ? null
                  : _$chatCommandsHash,
          dependencies: ChatCommandsFamily._dependencies,
          allTransitiveDependencies:
              ChatCommandsFamily._allTransitiveDependencies,
          channelId: channelId,
        );

  ChatCommandsProvider._internal(
    super._createNotifier, {
    required super.name,
    required super.dependencies,
    required super.allTransitiveDependencies,
    required super.debugGetCreateSourceHash,
    required super.from,
    required this.channelId,
  }) : super.internal();

  final String channelId;

  @override
  Override overrideWith(
    FutureOr<List<Map<String, dynamic>>> Function(ChatCommandsRef provider)
        create,
  ) {
    return ProviderOverride(
      origin: this,
      override: ChatCommandsProvider._internal(
        (ref) => create(ref as ChatCommandsRef),
        from: from,
        name: null,
        dependencies: null,
        allTransitiveDependencies: null,
        debugGetCreateSourceHash: null,
        channelId: channelId,
      ),
    );
  }

  @override
  AutoDisposeFutureProviderElement<List<Map<String, dynamic>>> createElement() {
    return _ChatCommandsProviderElement(this);
  }

  @override
  bool operator ==(Object other) {
    return other is ChatCommandsProvider && other.channelId == channelId;
  }

  @override
  int get hashCode {
    var hash = _SystemHash.combine(0, runtimeType.hashCode);
    hash = _SystemHash.combine(hash, channelId.hashCode);

    return _SystemHash.finish(hash);
  }
}

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
mixin ChatCommandsRef
    on AutoDisposeFutureProviderRef<List<Map<String, dynamic>>> {
  /// The parameter `channelId` of this provider.
  String get channelId;
}

class _ChatCommandsProviderElement
    extends AutoDisposeFutureProviderElement<List<Map<String, dynamic>>>
    with ChatCommandsRef {
  _ChatCommandsProviderElement(super.provider);

  @override
  String get channelId => (origin as ChatCommandsProvider).channelId;
}

String _$chatChannelsHydratedHash() =>
    r'ff1384cc547663c1cb94482913d0709873967876';

/// Lista de canais hidratada do servidor (unread, nome do "outro" no DM, etc.).
///
/// Copied from [chatChannelsHydrated].
@ProviderFor(chatChannelsHydrated)
final chatChannelsHydratedProvider =
    AutoDisposeFutureProvider<List<Map<String, dynamic>>>.internal(
  chatChannelsHydrated,
  name: r'chatChannelsHydratedProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$chatChannelsHydratedHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef ChatChannelsHydratedRef
    = AutoDisposeFutureProviderRef<List<Map<String, dynamic>>>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
