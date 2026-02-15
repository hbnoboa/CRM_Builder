import 'package:flutter_test/flutter_test.dart';
import 'package:crm_mobile/core/permissions/permission_provider.dart';

void main() {
  // ═══════════════════════════════════════════════════════
  // ModulePermission
  // ═══════════════════════════════════════════════════════

  group('ModulePermission', () {
    test('fullCrud has all permissions true', () {
      const perm = ModulePermission.fullCrud;
      expect(perm.canRead, isTrue);
      expect(perm.canCreate, isTrue);
      expect(perm.canUpdate, isTrue);
      expect(perm.canDelete, isTrue);
    });

    test('noCrud has all permissions false', () {
      const perm = ModulePermission.noCrud;
      expect(perm.canRead, isFalse);
      expect(perm.canCreate, isFalse);
      expect(perm.canUpdate, isFalse);
      expect(perm.canDelete, isFalse);
    });

    test('readOnly has only canRead true', () {
      const perm = ModulePermission.readOnly;
      expect(perm.canRead, isTrue);
      expect(perm.canCreate, isFalse);
      expect(perm.canUpdate, isFalse);
      expect(perm.canDelete, isFalse);
    });

    group('fromJson', () {
      test('boolean true returns fullCrud', () {
        final perm = ModulePermission.fromJson(true);
        expect(perm.canRead, isTrue);
        expect(perm.canCreate, isTrue);
        expect(perm.canUpdate, isTrue);
        expect(perm.canDelete, isTrue);
      });

      test('boolean false returns noCrud', () {
        final perm = ModulePermission.fromJson(false);
        expect(perm.canRead, isFalse);
        expect(perm.canCreate, isFalse);
        expect(perm.canUpdate, isFalse);
        expect(perm.canDelete, isFalse);
      });

      test('parses Map with CRUD fields', () {
        final perm = ModulePermission.fromJson({
          'canRead': true,
          'canCreate': false,
          'canUpdate': true,
          'canDelete': false,
        });
        expect(perm.canRead, isTrue);
        expect(perm.canCreate, isFalse);
        expect(perm.canUpdate, isTrue);
        expect(perm.canDelete, isFalse);
      });

      test('defaults missing fields to false', () {
        final perm = ModulePermission.fromJson({'canRead': true});
        expect(perm.canRead, isTrue);
        expect(perm.canCreate, isFalse);
        expect(perm.canUpdate, isFalse);
        expect(perm.canDelete, isFalse);
      });

      test('returns noCrud for unrecognized types', () {
        final perm = ModulePermission.fromJson(42);
        expect(perm.canRead, isFalse);
        expect(perm.canCreate, isFalse);
      });

      test('returns noCrud for null', () {
        final perm = ModulePermission.fromJson(null);
        expect(perm.canRead, isFalse);
      });
    });
  });

  // ═══════════════════════════════════════════════════════
  // EntityPermission
  // ═══════════════════════════════════════════════════════

  group('EntityPermission', () {
    test('fromJson parses all fields', () {
      final perm = EntityPermission.fromJson({
        'entitySlug': 'clientes',
        'canCreate': true,
        'canRead': true,
        'canUpdate': false,
        'canDelete': false,
        'scope': 'own',
      });
      expect(perm.entitySlug, 'clientes');
      expect(perm.canCreate, isTrue);
      expect(perm.canRead, isTrue);
      expect(perm.canUpdate, isFalse);
      expect(perm.canDelete, isFalse);
      expect(perm.scope, 'own');
    });

    test('defaults missing booleans to false', () {
      final perm = EntityPermission.fromJson({
        'entitySlug': 'leads',
      });
      expect(perm.canCreate, isFalse);
      expect(perm.canRead, isFalse);
      expect(perm.canUpdate, isFalse);
      expect(perm.canDelete, isFalse);
    });

    test('defaults scope to "all"', () {
      final perm = EntityPermission.fromJson({
        'entitySlug': 'leads',
      });
      expect(perm.scope, 'all');
    });
  });

  // ═══════════════════════════════════════════════════════
  // PermissionsState
  // ═══════════════════════════════════════════════════════

  group('PermissionsState', () {
    group('hasModuleAccess', () {
      test('returns false when roleType is null', () {
        const state = PermissionsState();
        expect(state.hasModuleAccess('dashboard'), isFalse);
      });

      test('returns true for PLATFORM_ADMIN on any module', () {
        const state = PermissionsState(
          roleType: 'PLATFORM_ADMIN',
          isPlatformAdmin: true,
        );
        expect(state.hasModuleAccess('dashboard'), isTrue);
        expect(state.hasModuleAccess('users'), isTrue);
        expect(state.hasModuleAccess('nonexistent'), isTrue);
      });

      test('returns true when module has canRead', () {
        const state = PermissionsState(
          roleType: 'ADMIN',
          modulePermissions: {
            'dashboard': ModulePermission.readOnly,
          },
        );
        expect(state.hasModuleAccess('dashboard'), isTrue);
      });

      test('returns false when module has no canRead', () {
        const state = PermissionsState(
          roleType: 'USER',
          modulePermissions: {
            'settings': ModulePermission.noCrud,
          },
        );
        expect(state.hasModuleAccess('settings'), isFalse);
      });

      test('returns false for unknown module', () {
        const state = PermissionsState(
          roleType: 'USER',
          modulePermissions: {},
        );
        expect(state.hasModuleAccess('unknown'), isFalse);
      });
    });

    group('hasModulePermission', () {
      test('returns false when roleType is null', () {
        const state = PermissionsState();
        expect(state.hasModulePermission('dashboard', 'canRead'), isFalse);
      });

      test('returns true for PLATFORM_ADMIN on any action', () {
        const state = PermissionsState(
          roleType: 'PLATFORM_ADMIN',
          isPlatformAdmin: true,
        );
        expect(state.hasModulePermission('users', 'canDelete'), isTrue);
      });

      test('checks canRead correctly', () {
        const state = PermissionsState(
          roleType: 'VIEWER',
          modulePermissions: {
            'dashboard': ModulePermission.readOnly,
          },
        );
        expect(state.hasModulePermission('dashboard', 'canRead'), isTrue);
        expect(state.hasModulePermission('dashboard', 'canCreate'), isFalse);
      });

      test('checks canCreate correctly', () {
        const state = PermissionsState(
          roleType: 'ADMIN',
          modulePermissions: {
            'users': ModulePermission.fullCrud,
          },
        );
        expect(state.hasModulePermission('users', 'canCreate'), isTrue);
      });

      test('checks canUpdate correctly', () {
        const state = PermissionsState(
          roleType: 'USER',
          modulePermissions: {
            'data': ModulePermission(
              canRead: true,
              canCreate: true,
              canUpdate: true,
              canDelete: false,
            ),
          },
        );
        expect(state.hasModulePermission('data', 'canUpdate'), isTrue);
        expect(state.hasModulePermission('data', 'canDelete'), isFalse);
      });

      test('returns false for unknown action', () {
        const state = PermissionsState(
          roleType: 'ADMIN',
          modulePermissions: {
            'users': ModulePermission.fullCrud,
          },
        );
        expect(state.hasModulePermission('users', 'canFly'), isFalse);
      });
    });

    group('hasEntityPermission', () {
      test('returns false when roleType is null', () {
        const state = PermissionsState();
        expect(state.hasEntityPermission('clientes', 'canRead'), isFalse);
      });

      test('returns true for PLATFORM_ADMIN', () {
        const state = PermissionsState(
          roleType: 'PLATFORM_ADMIN',
          isPlatformAdmin: true,
        );
        expect(state.hasEntityPermission('clientes', 'canDelete'), isTrue);
      });

      test('returns true for ADMIN', () {
        const state = PermissionsState(
          roleType: 'ADMIN',
          isAdmin: true,
        );
        expect(state.hasEntityPermission('leads', 'canDelete'), isTrue);
      });

      test('MANAGER has full CRUD on entities', () {
        const state = PermissionsState(roleType: 'MANAGER');
        expect(state.hasEntityPermission('clientes', 'canCreate'), isTrue);
        expect(state.hasEntityPermission('clientes', 'canRead'), isTrue);
        expect(state.hasEntityPermission('clientes', 'canUpdate'), isTrue);
        expect(state.hasEntityPermission('clientes', 'canDelete'), isTrue);
      });

      test('USER has CRUD except delete', () {
        const state = PermissionsState(roleType: 'USER');
        expect(state.hasEntityPermission('clientes', 'canCreate'), isTrue);
        expect(state.hasEntityPermission('clientes', 'canRead'), isTrue);
        expect(state.hasEntityPermission('clientes', 'canUpdate'), isTrue);
        expect(state.hasEntityPermission('clientes', 'canDelete'), isFalse);
      });

      test('VIEWER has read-only on entities', () {
        const state = PermissionsState(roleType: 'VIEWER');
        expect(state.hasEntityPermission('clientes', 'canRead'), isTrue);
        expect(state.hasEntityPermission('clientes', 'canCreate'), isFalse);
        expect(state.hasEntityPermission('clientes', 'canUpdate'), isFalse);
        expect(state.hasEntityPermission('clientes', 'canDelete'), isFalse);
      });

      test('CUSTOM uses entity-specific permissions', () {
        const state = PermissionsState(
          roleType: 'CUSTOM',
          entityPermissions: [
            EntityPermission(
              entitySlug: 'clientes',
              canCreate: true,
              canRead: true,
              canUpdate: true,
              canDelete: false,
            ),
            EntityPermission(
              entitySlug: 'leads',
              canCreate: false,
              canRead: true,
              canUpdate: false,
              canDelete: false,
            ),
          ],
        );
        expect(state.hasEntityPermission('clientes', 'canCreate'), isTrue);
        expect(state.hasEntityPermission('clientes', 'canDelete'), isFalse);
        expect(state.hasEntityPermission('leads', 'canRead'), isTrue);
        expect(state.hasEntityPermission('leads', 'canCreate'), isFalse);
      });

      test('CUSTOM returns false for unknown entity', () {
        const state = PermissionsState(
          roleType: 'CUSTOM',
          entityPermissions: [],
        );
        expect(state.hasEntityPermission('unknown', 'canRead'), isFalse);
      });
    });

    group('getEntityScope', () {
      test('returns "own" when roleType is null', () {
        const state = PermissionsState();
        expect(state.getEntityScope('clientes'), 'own');
      });

      test('returns "all" for PLATFORM_ADMIN', () {
        const state = PermissionsState(
          roleType: 'PLATFORM_ADMIN',
          isPlatformAdmin: true,
          isAdmin: true,
        );
        expect(state.getEntityScope('clientes'), 'all');
      });

      test('returns "all" for ADMIN', () {
        const state = PermissionsState(
          roleType: 'ADMIN',
          isAdmin: true,
        );
        expect(state.getEntityScope('clientes'), 'all');
      });

      test('returns "all" for MANAGER', () {
        const state = PermissionsState(roleType: 'MANAGER');
        expect(state.getEntityScope('clientes'), 'all');
      });

      test('returns "own" for USER', () {
        const state = PermissionsState(roleType: 'USER');
        expect(state.getEntityScope('clientes'), 'own');
      });

      test('returns "all" for VIEWER', () {
        const state = PermissionsState(roleType: 'VIEWER');
        expect(state.getEntityScope('clientes'), 'all');
      });

      test('CUSTOM uses scope from entity permission', () {
        const state = PermissionsState(
          roleType: 'CUSTOM',
          entityPermissions: [
            EntityPermission(
              entitySlug: 'clientes',
              canRead: true,
              scope: 'own',
            ),
          ],
        );
        expect(state.getEntityScope('clientes'), 'own');
      });

      test('CUSTOM defaults to "all" for unknown entity', () {
        const state = PermissionsState(
          roleType: 'CUSTOM',
          entityPermissions: [],
        );
        expect(state.getEntityScope('unknown'), 'all');
      });
    });
  });
}
