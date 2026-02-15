import 'package:flutter_test/flutter_test.dart';
import 'package:crm_mobile/core/auth/auth_provider.dart';

void main() {
  // ═══════════════════════════════════════════════════════
  // User model
  // ═══════════════════════════════════════════════════════

  group('User', () {
    test('fromJson parses all required fields', () {
      final user = User.fromJson({
        'id': 'user-123',
        'tenantId': 'tenant-456',
        'email': 'joao@example.com',
        'name': 'Joao Silva',
        'status': 'ACTIVE',
        'createdAt': '2024-01-01T00:00:00.000Z',
      });

      expect(user.id, 'user-123');
      expect(user.tenantId, 'tenant-456');
      expect(user.email, 'joao@example.com');
      expect(user.name, 'Joao Silva');
      expect(user.status, 'ACTIVE');
      expect(user.createdAt, '2024-01-01T00:00:00.000Z');
    });

    test('fromJson handles optional null fields', () {
      final user = User.fromJson({
        'id': 'user-123',
        'tenantId': 'tenant-456',
        'email': 'joao@example.com',
        'name': 'Joao',
        'status': 'ACTIVE',
        'createdAt': '2024-01-01T00:00:00.000Z',
        'avatar': null,
        'customRole': null,
        'lastLoginAt': null,
      });

      expect(user.avatar, isNull);
      expect(user.customRole, isNull);
      expect(user.lastLoginAt, isNull);
    });

    test('fromJson parses optional fields when present', () {
      final user = User.fromJson({
        'id': 'user-123',
        'tenantId': 'tenant-456',
        'email': 'joao@example.com',
        'name': 'Joao',
        'avatar': 'https://example.com/avatar.jpg',
        'status': 'ACTIVE',
        'lastLoginAt': '2024-06-15T12:00:00.000Z',
        'createdAt': '2024-01-01T00:00:00.000Z',
      });

      expect(user.avatar, 'https://example.com/avatar.jpg');
      expect(user.lastLoginAt, '2024-06-15T12:00:00.000Z');
    });

    test('fromJson parses nested customRole', () {
      final user = User.fromJson({
        'id': 'user-123',
        'tenantId': 'tenant-456',
        'email': 'joao@example.com',
        'name': 'Joao',
        'status': 'ACTIVE',
        'createdAt': '2024-01-01T00:00:00.000Z',
        'customRole': {
          'id': 'role-1',
          'name': 'Admin',
          'roleType': 'ADMIN',
          'isSystem': true,
        },
      });

      expect(user.customRole, isNotNull);
      expect(user.customRole!.id, 'role-1');
      expect(user.customRole!.name, 'Admin');
      expect(user.customRole!.roleType, 'ADMIN');
    });
  });

  // ═══════════════════════════════════════════════════════
  // CustomRole model
  // ═══════════════════════════════════════════════════════

  group('CustomRole', () {
    test('fromJson parses all fields', () {
      final role = CustomRole.fromJson({
        'id': 'role-1',
        'name': 'Vendedor',
        'description': 'Role para vendedores',
        'color': '#3B82F6',
        'roleType': 'CUSTOM',
        'isSystem': false,
        'permissions': [
          {
            'entitySlug': 'clientes',
            'canRead': true,
            'canCreate': true,
            'canUpdate': true,
            'canDelete': false,
          },
        ],
        'modulePermissions': {
          'dashboard': true,
          'data': {
            'canRead': true,
            'canCreate': true,
            'canUpdate': true,
            'canDelete': false,
          },
        },
      });

      expect(role.id, 'role-1');
      expect(role.name, 'Vendedor');
      expect(role.description, 'Role para vendedores');
      expect(role.color, '#3B82F6');
      expect(role.roleType, 'CUSTOM');
      expect(role.isSystem, isFalse);
      expect(role.permissions, isNotNull);
      expect(role.permissions!.length, 1);
      expect(role.modulePermissions, isNotNull);
    });

    test('fromJson defaults isSystem to false', () {
      final role = CustomRole.fromJson({
        'id': 'role-1',
        'name': 'Test',
        'roleType': 'CUSTOM',
      });
      expect(role.isSystem, isFalse);
    });

    test('fromJson handles null optional fields', () {
      final role = CustomRole.fromJson({
        'id': 'role-1',
        'name': 'Test',
        'roleType': 'USER',
        'isSystem': true,
      });
      expect(role.description, isNull);
      expect(role.color, isNull);
      expect(role.permissions, isNull);
      expect(role.modulePermissions, isNull);
    });
  });

  // ═══════════════════════════════════════════════════════
  // AuthState
  // ═══════════════════════════════════════════════════════

  group('AuthState', () {
    test('default state is unauthenticated, not loading, no error', () {
      const state = AuthState();
      expect(state.user, isNull);
      expect(state.isAuthenticated, isFalse);
      expect(state.isLoading, isFalse);
      expect(state.error, isNull);
    });

    test('copyWith updates specified fields', () {
      const state = AuthState();
      final updated = state.copyWith(
        isLoading: true,
      );
      expect(updated.isLoading, isTrue);
      expect(updated.isAuthenticated, isFalse);
      expect(updated.user, isNull);
    });

    test('copyWith preserves unspecified fields', () {
      final state = AuthState(
        user: User.fromJson({
          'id': 'u1',
          'tenantId': 't1',
          'email': 'a@b.com',
          'name': 'Test',
          'status': 'ACTIVE',
          'createdAt': '2024-01-01',
        }),
        isAuthenticated: true,
      );

      final updated = state.copyWith(isLoading: true);
      expect(updated.user, isNotNull);
      expect(updated.isAuthenticated, isTrue);
      expect(updated.isLoading, isTrue);
    });

    test('copyWith clearError removes error', () {
      const state = AuthState(error: 'Some error');
      final updated = state.copyWith(clearError: true);
      expect(updated.error, isNull);
    });

    test('copyWith clearUser removes user', () {
      final state = AuthState(
        user: User.fromJson({
          'id': 'u1',
          'tenantId': 't1',
          'email': 'a@b.com',
          'name': 'Test',
          'status': 'ACTIVE',
          'createdAt': '2024-01-01',
        }),
      );
      final updated = state.copyWith(clearUser: true);
      expect(updated.user, isNull);
    });

    test('copyWith can set new error', () {
      const state = AuthState();
      final updated = state.copyWith(error: 'Login failed');
      expect(updated.error, 'Login failed');
    });

    test('copyWith can set new user', () {
      const state = AuthState();
      final user = User.fromJson({
        'id': 'u1',
        'tenantId': 't1',
        'email': 'a@b.com',
        'name': 'Test',
        'status': 'ACTIVE',
        'createdAt': '2024-01-01',
      });
      final updated = state.copyWith(user: user, isAuthenticated: true);
      expect(updated.user?.id, 'u1');
      expect(updated.isAuthenticated, isTrue);
    });
  });
}
