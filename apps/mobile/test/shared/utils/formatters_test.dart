import 'package:flutter_test/flutter_test.dart';
import 'package:crm_mobile/shared/utils/formatters.dart';

void main() {
  group('Formatters.date', () {
    test('formats valid ISO date to dd/MM/yyyy', () {
      expect(Formatters.date('2024-03-15T10:30:00.000Z'), '15/03/2024');
    });

    test('formats date without time component', () {
      expect(Formatters.date('2024-01-01'), '01/01/2024');
    });

    test('returns dash for null', () {
      expect(Formatters.date(null), '-');
    });

    test('returns dash for empty string', () {
      expect(Formatters.date(''), '-');
    });

    test('returns original string for invalid date', () {
      expect(Formatters.date('not-a-date'), 'not-a-date');
    });
  });

  group('Formatters.dateTime', () {
    test('formats valid ISO date to dd/MM/yyyy HH:mm', () {
      expect(
        Formatters.dateTime('2024-03-15T10:30:00.000Z'),
        contains('15/03/2024'),
      );
    });

    test('returns dash for null', () {
      expect(Formatters.dateTime(null), '-');
    });

    test('returns dash for empty string', () {
      expect(Formatters.dateTime(''), '-');
    });

    test('returns original string for invalid date', () {
      expect(Formatters.dateTime('invalid'), 'invalid');
    });
  });

  group('Formatters.currency', () {
    test('formats integer value', () {
      final result = Formatters.currency(1500);
      expect(result, contains('1.500'));
      expect(result, contains('R\$'));
    });

    test('formats decimal value', () {
      final result = Formatters.currency(99.90);
      expect(result, contains('99'));
      expect(result, contains('R\$'));
    });

    test('formats zero', () {
      final result = Formatters.currency(0);
      expect(result, contains('R\$'));
      expect(result, contains('0'));
    });

    test('returns dash for null', () {
      expect(Formatters.currency(null), '-');
    });
  });

  group('Formatters.initials', () {
    test('returns two initials for full name', () {
      expect(Formatters.initials('Joao Silva'), 'JS');
    });

    test('returns two initials for multi-word name', () {
      expect(Formatters.initials('Maria da Silva Santos'), 'MS');
    });

    test('returns single initial for single name', () {
      expect(Formatters.initials('Admin'), 'A');
    });

    test('returns uppercase initials', () {
      expect(Formatters.initials('joao silva'), 'JS');
    });

    test('returns ? for empty string', () {
      expect(Formatters.initials(''), '?');
    });

    test('handles name with extra spaces', () {
      expect(Formatters.initials('  Joao   Silva  '), 'JS');
    });
  });

  group('Formatters.timeAgo', () {
    test('returns empty string for null', () {
      expect(Formatters.timeAgo(null), '');
    });

    test('returns "agora" for recent timestamps', () {
      final now = DateTime.now().toIso8601String();
      expect(Formatters.timeAgo(now), 'agora');
    });

    test('returns minutes format for < 60min', () {
      final date = DateTime.now().subtract(const Duration(minutes: 15));
      expect(Formatters.timeAgo(date.toIso8601String()), '15min');
    });

    test('returns hours format for < 24h', () {
      final date = DateTime.now().subtract(const Duration(hours: 3));
      expect(Formatters.timeAgo(date.toIso8601String()), '3h');
    });

    test('returns days format for < 30d', () {
      final date = DateTime.now().subtract(const Duration(days: 5));
      expect(Formatters.timeAgo(date.toIso8601String()), '5d');
    });

    test('returns formatted date for >= 30d', () {
      final date = DateTime.now().subtract(const Duration(days: 60));
      final result = Formatters.timeAgo(date.toIso8601String());
      // Should return dd/MM/yyyy format
      expect(result, matches(RegExp(r'\d{2}/\d{2}/\d{4}')));
    });

    test('returns original string for invalid date', () {
      expect(Formatters.timeAgo('invalid'), 'invalid');
    });
  });
}
