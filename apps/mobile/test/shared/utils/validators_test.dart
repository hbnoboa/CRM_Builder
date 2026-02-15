import 'package:flutter_test/flutter_test.dart';
import 'package:crm_mobile/shared/utils/validators.dart';

void main() {
  group('Validators.required', () {
    test('returns null for valid non-empty string', () {
      expect(Validators.required('hello'), isNull);
    });

    test('returns error for null', () {
      expect(Validators.required(null), isNotNull);
      expect(Validators.required(null), contains('obrigatorio'));
    });

    test('returns error for empty string', () {
      expect(Validators.required(''), isNotNull);
    });

    test('returns error for whitespace-only string', () {
      expect(Validators.required('   '), isNotNull);
    });

    test('uses custom field name in error message', () {
      final error = Validators.required(null, 'Nome');
      expect(error, 'Nome obrigatorio');
    });

    test('uses default field name', () {
      final error = Validators.required(null);
      expect(error, 'Campo obrigatorio');
    });
  });

  group('Validators.email', () {
    test('returns null for valid email', () {
      expect(Validators.email('user@example.com'), isNull);
    });

    test('returns null for email with subdomain', () {
      expect(Validators.email('user@mail.example.com'), isNull);
    });

    test('returns error for null', () {
      expect(Validators.email(null), isNotNull);
      expect(Validators.email(null), 'Email obrigatorio');
    });

    test('returns error for empty string', () {
      expect(Validators.email(''), 'Email obrigatorio');
    });

    test('returns error for invalid email without @', () {
      expect(Validators.email('userexample.com'), 'Email invalido');
    });

    test('returns error for invalid email without domain', () {
      expect(Validators.email('user@'), 'Email invalido');
    });

    test('returns error for invalid email with spaces', () {
      expect(Validators.email('user @example.com'), 'Email invalido');
    });
  });

  group('Validators.password', () {
    test('returns null for valid password (6+ chars)', () {
      expect(Validators.password('abc123'), isNull);
    });

    test('returns null for long password', () {
      expect(Validators.password('a' * 100), isNull);
    });

    test('returns error for null', () {
      expect(Validators.password(null), 'Senha obrigatoria');
    });

    test('returns error for empty string', () {
      expect(Validators.password(''), 'Senha obrigatoria');
    });

    test('returns error for short password', () {
      expect(Validators.password('abc'), 'Minimo 6 caracteres');
    });

    test('returns error for 5 char password', () {
      expect(Validators.password('abcde'), 'Minimo 6 caracteres');
    });

    test('accepts exactly 6 chars', () {
      expect(Validators.password('abcdef'), isNull);
    });
  });

  group('Validators.minLength', () {
    test('returns null when string meets minimum', () {
      expect(Validators.minLength('hello', 3), isNull);
    });

    test('returns null when string equals minimum', () {
      expect(Validators.minLength('abc', 3), isNull);
    });

    test('returns error when string is too short', () {
      final error = Validators.minLength('ab', 3);
      expect(error, isNotNull);
      expect(error, contains('3'));
    });

    test('returns error for null', () {
      expect(Validators.minLength(null, 3), isNotNull);
    });

    test('uses custom field name', () {
      final error = Validators.minLength('a', 3, 'Nome');
      expect(error, contains('Nome'));
      expect(error, contains('3'));
    });

    test('trims whitespace before checking', () {
      expect(Validators.minLength('  a  ', 3), isNotNull);
    });
  });
}
