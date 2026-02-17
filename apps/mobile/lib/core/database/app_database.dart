import 'package:powersync/powersync.dart';
import 'package:path_provider/path_provider.dart';
import 'package:crm_mobile/core/database/powersync_connector.dart';

/// PowerSync schema matching the Prisma models we sync.
/// Reads happen from local SQLite. Writes go through API.
const schema = Schema([
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
    Column.text('deletedAt'),
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
  // Local-only table for offline upload queue (never synced to server)
  Table.localOnly('file_upload_queue', [
    Column.text('local_path'),
    Column.text('file_name'),
    Column.text('folder'),
    Column.text('entity_slug'),
    Column.text('record_id'),
    Column.text('field_slug'),
    Column.text('status'),       // pending | uploading | completed | failed
    Column.text('remote_url'),
    Column.integer('retry_count'),
    Column.text('error'),
    Column.text('mime_type'),
    Column.integer('file_size'),
    Column.text('created_at'),
    Column.text('last_attempt'), // ISO8601 timestamp of last upload attempt
  ]),
  // Local-only table for API-SELECT field options cache
  Table.localOnly('api_select_cache', [
    Column.text('cache_key'),    // unique key: tenantId + apiEndpoint
    Column.text('options_json'), // JSON array of options
    Column.text('updated_at'),   // last fetch timestamp
  ]),
  // Local-only table for pending global filter updates
  // Entity.settings is read-only (synced from server), so we queue
  // global filter updates and send them when online
  Table.localOnly('global_filter_queue', [
    Column.text('entity_id'),        // Entity ID to update
    Column.text('filters_json'),     // JSON array of GlobalFilter objects
    Column.text('status'),           // pending | syncing | completed | failed
    Column.integer('retry_count'),
    Column.text('error'),
    Column.text('created_at'),
    Column.text('updated_at'),
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
  /// Errors are silently ignored - offline-first means we continue with local data.
  Future<void> connect() async {
    try {
      final connector = CrmPowerSyncConnector();
      await db.connect(connector: connector);
    } catch (e) {
      // Silently ignore connection errors - we work offline-first
      // The sync will automatically retry when connection is available
    }
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
