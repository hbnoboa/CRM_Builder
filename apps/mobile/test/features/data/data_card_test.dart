import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:crm_mobile/features/data/widgets/data_card.dart';

Widget createTestApp(Widget child) {
  return MaterialApp(home: Scaffold(body: child));
}

void main() {
  group('DataCard', () {
    final sampleFields = [
      {'name': 'nome', 'label': 'Nome', 'type': 'TEXT'},
      {'name': 'email', 'label': 'Email', 'type': 'EMAIL'},
      {'name': 'valor', 'label': 'Valor', 'type': 'NUMBER'},
    ];

    final sampleRecord = {
      'id': 'rec-1',
      'data': jsonEncode({'nome': 'Joao Silva', 'email': 'joao@test.com', 'valor': 1500}),
      'createdAt': '2024-03-15T10:30:00.000Z',
      'updatedAt': '2024-03-15T10:30:00.000Z',
    };

    testWidgets('renders record data', (tester) async {
      await tester.pumpWidget(createTestApp(
        DataCard(
          record: sampleRecord,
          fields: sampleFields,
          onTap: () {},
        ),
      ),);
      await tester.pumpAndSettle();

      // Should show some record data
      expect(find.byType(DataCard), findsOneWidget);
    });

    testWidgets('calls onTap when tapped', (tester) async {
      bool tapped = false;

      await tester.pumpWidget(createTestApp(
        DataCard(
          record: sampleRecord,
          fields: sampleFields,
          onTap: () => tapped = true,
        ),
      ),);
      await tester.pumpAndSettle();

      await tester.tap(find.byType(DataCard));
      expect(tapped, isTrue);
    });

    testWidgets('handles empty data gracefully', (tester) async {
      final emptyRecord = {
        'id': 'rec-2',
        'data': jsonEncode({}),
        'createdAt': '2024-01-01',
        'updatedAt': '2024-01-01',
      };

      await tester.pumpWidget(createTestApp(
        DataCard(
          record: emptyRecord,
          fields: sampleFields,
          onTap: () {},
        ),
      ),);
      await tester.pumpAndSettle();

      expect(find.byType(DataCard), findsOneWidget);
    });

    testWidgets('handles invalid JSON data', (tester) async {
      final badRecord = {
        'id': 'rec-3',
        'data': 'not-json',
        'createdAt': '2024-01-01',
        'updatedAt': '2024-01-01',
      };

      await tester.pumpWidget(createTestApp(
        DataCard(
          record: badRecord,
          fields: sampleFields,
          onTap: () {},
        ),
      ),);
      await tester.pumpAndSettle();

      // Should not crash
      expect(find.byType(DataCard), findsOneWidget);
    });
  });
}
