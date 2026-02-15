import 'package:powersync/powersync.dart';
import 'package:path_provider/path_provider.dart';
import 'package:crm_mobile/core/database/powersync_connector.dart';
import 'package:crm_mobile/core/config/env.dart';

/// PowerSync schema matching the Prisma models we sync.
/// Reads happen from local SQLite. Writes go through API.
final schema = Schema([
  Table('Entity', [
    Column.text('tenantId'),
    Column.text('name'),
    Column.text('namePlural'),
    Column.text('slug'),
    Column.text('description'),
    Column.text('icon'),
    Column.text('color'),
    Column.text('fields'),
    Column.text('settings'),
    Column.integer('isSystem'),
    Column.text('createdAt'),
    Column.text('updatedAt'),
  ]),
  Table('EntityData', [
    Column.text('tenantId'),
    Column.text('entityId'),
    Column.text('data'),
    Column.text('parentRecordId'),
    Column.text('createdById'),
    Column.text('updatedById'),
    Column.text('createdAt'),
    Column.text('updatedAt'),
  ]),
  Table('CustomRole', [
    Column.text('tenantId'),
    Column.text('name'),
    Column.text('description'),
    Column.text('color'),
    Column.text('roleType'),
    Column.integer('isSystem'),
    Column.text('permissions'),
    Column.text('modulePermissions'),
    Column.text('tenantPermissions'),
    Column.integer('isDefault'),
    Column.text('createdAt'),
    Column.text('updatedAt'),
  ]),
  Table('Notification', [
    Column.text('tenantId'),
    Column.text('userId'),
    Column.text('type'),
    Column.text('title'),
    Column.text('message'),
    Column.text('data'),
    Column.text('entitySlug'),
    Column.integer('read'),
    Column.text('readAt'),
    Column.text('createdAt'),
  ]),
  Table('User', [
    Column.text('tenantId'),
    Column.text('email'),
    Column.text('name'),
    Column.text('avatar'),
    Column.text('customRoleId'),
    Column.text('status'),
    Column.text('createdAt'),
  ]),
]);

/// Singleton PowerSync database instance.
class AppDatabase {
  AppDatabase._();

  static final instance = AppDatabase._();

  late PowerSyncDatabase db;

  Future<void> initialize() async {
    final dir = await getApplicationDocumentsDirectory();
    final path = '${dir.path}/crm_powersync.db';

    db = PowerSyncDatabase(
      schema: schema,
      path: path,
    );

    await db.initialize();
  }

  /// Connect PowerSync to the sync service.
  /// Call after successful login.
  Future<void> connect() async {
    final connector = CrmPowerSyncConnector();
    await db.connect(connector: connector);
  }

  /// Disconnect from sync service.
  /// Call on logout.
  Future<void> disconnect() async {
    await db.disconnect();
  }

  /// Clear all local data (on logout).
  Future<void> clearData() async {
    await db.disconnectAndClear();
  }
}
