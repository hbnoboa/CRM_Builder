import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:crm_mobile/core/auth/auth_provider.dart';
import 'package:crm_mobile/core/network/api_client.dart';

/// Funcoes do plano do tenant atual (GET /subscription -> features), como o
/// useTenantFeatures() do web-admin. Sem rede ou em erro: tudo liberado — quem
/// bloqueia de verdade e a API; aqui so escondemos o que o plano nao inclui.
final tenantFeaturesProvider = FutureProvider.autoDispose<Map<String, bool>>((ref) async {
  // Refaz ao trocar de usuario/tenant.
  final tenantId = ref.watch(authProvider.select((s) => s.user?.tenantId));
  if (tenantId == null) return const {};

  try {
    final response = await ref.read(apiClientProvider).get('/subscription');
    final features = (response.data as Map?)?['features'];
    if (features is! Map) return const {};
    return {
      for (final entry in features.entries)
        if (entry.value is bool) entry.key.toString(): entry.value as bool,
    };
  } catch (_) {
    return const {};
  }
});

/// Funcao ausente = ligada (mesma regra do backend).
bool isFeatureEnabled(Map<String, bool> features, String key) => features[key] ?? true;
