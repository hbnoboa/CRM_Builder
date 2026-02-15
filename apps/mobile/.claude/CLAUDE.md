# Flutter CRM Mobile - Instrucoes para Claude

## Sobre
App Flutter offline-first para o CRM Builder. Focado em operacao de dados em campo (CRUD de registros, upload de imagens, notificacoes).

## Stack Tecnica

| Camada | Tecnologia |
|--------|------------|
| Framework | Flutter 3.32+ |
| State | Riverpod 3.x (com code generation) |
| DB Local | PowerSync (SQLite) |
| Sync | PowerSync self-hosted → PostgreSQL |
| HTTP | Dio 5.x |
| Auth | flutter_secure_storage (Keychain/Keystore) |
| Navegacao | go_router |
| Forms | Widgets nativos + validacao manual |
| Imagens | cached_network_image + flutter_image_compress + image_picker |
| Push | Firebase Cloud Messaging |

## Arquitetura

```
lib/
├── core/          # Config, theme, network, database, auth, permissions
├── features/      # Feature-first: auth, dashboard, entities, data, notifications, profile, settings
└── shared/        # Widgets e utils compartilhados
```

### Regras Fundamentais

1. **Toda leitura vem do SQLite local** (PowerSync) - nunca da API diretamente
2. **Toda escrita vai para a API NestJS** → PostgreSQL → PowerSync propaga para todos os devices
3. **Campos dinamicos**: renderizar baseado em `entity.fields` JSON (mesma estrutura do web-admin)
4. **Permissoes**: replicar a logica de `use-permissions.ts` - ja implementado em `permission_provider.dart`
5. **Multi-tenancy**: PowerSync filtra por `tenantId` automaticamente via sync rules
6. **Imagens offline**: salvar localmente → queue → upload quando online
7. **Tokens seguros**: usar `flutter_secure_storage` (nunca SharedPreferences para tokens)

### Padrao de Escrita/Leitura

```dart
// LEITURA: sempre do banco local (real-time via stream)
final records = db.watch('SELECT * FROM EntityData WHERE entityId = ?', [id]);

// ESCRITA: sempre via API
await dio.post('/data/$entitySlug', data: {...});
// PowerSync propaga automaticamente a mudanca para o SQLite local
```

## Equivalencia Web-Admin → Flutter

| Web-Admin | Flutter |
|-----------|---------|
| `lib/api.ts` (Axios) | `core/network/api_client.dart` (Dio) |
| `stores/auth-store.ts` (Zustand) | `core/auth/auth_provider.dart` (Riverpod) |
| `hooks/use-permissions.ts` | `core/permissions/permission_provider.dart` |
| `components/permission-gate.tsx` | `shared/widgets/permission_gate.dart` |
| `services/data.service.ts` | `features/data/data/data_repository.dart` |
| `app/globals.css` (cores) | `core/theme/app_colors.dart` |
| `tailwind.config.ts` (design) | `core/theme/app_theme.dart` |

## Comandos

```bash
# Desenvolvimento
cd apps/mobile
flutter run                          # Roda no device/emulador
flutter run --dart-define=API_URL=http://10.0.2.2:3001/api/v1

# Code generation (Riverpod, Drift)
dart run build_runner build --delete-conflicting-outputs

# Testes
flutter test
flutter test integration_test/

# Build
flutter build apk --split-per-abi    # Android
flutter build ios                     # iOS
```

## API Backend

Base URL: `http://10.0.2.2:3001/api/v1` (Android emulator)

Endpoints principais:
- `POST /auth/login` → `{ email, password }` → `{ user, accessToken, refreshToken }`
- `POST /auth/register` → `{ name, email, password, tenantName }`
- `POST /auth/refresh` → `{ refreshToken }` → `{ accessToken, refreshToken }`
- `GET /auth/me` → User com customRole
- `GET /data/:entitySlug` → Lista de registros
- `POST /data/:entitySlug` → Criar registro
- `PATCH /data/:entitySlug/:id` → Atualizar registro
- `DELETE /data/:entitySlug/:id` → Deletar registro
- `POST /upload/file` → Upload de arquivo (multipart)

## Regras de Codigo

1. **Sempre TypeScript/Dart tipado** - nunca usar `dynamic` desnecessario
2. **Riverpod com @riverpod annotation** - gerar providers automaticamente
3. **Widgets const** quando possivel
4. **Listas longas**: sempre `ListView.builder` (nunca ListView com children diretos)
5. **Imagens**: sempre `cached_network_image` com placeholder
6. **Permissoes**: usar `PermissionGate` widget ou `ref.watch(permissionsProvider)`
7. **Erros**: SnackBar para feedback ao usuario
8. **Offline**: mostrar `OfflineBanner` + `SyncStatusIndicator`

## Multi-tenancy

- PLATFORM_ADMIN pode selecionar tenant (via `SecureStorage.setSelectedTenantId`)
- `TenantInterceptor` injeta `tenantId` automaticamente em todas as requests
- PowerSync sync rules filtram dados por `tenantId` do token JWT
