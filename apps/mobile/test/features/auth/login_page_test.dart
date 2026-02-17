import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:crm_mobile/core/auth/auth_provider.dart';
import 'package:crm_mobile/features/auth/pages/login_page.dart';

/// Creates a testable wrapper with ProviderScope and MaterialApp.
Widget createTestApp({List<Override> overrides = const []}) {
  return ProviderScope(
    overrides: overrides,
    child: const MaterialApp(
      home: LoginPage(),
    ),
  );
}

void main() {
  group('LoginPage', () {
    testWidgets('renders email and password fields', (tester) async {
      await tester.pumpWidget(createTestApp());
      await tester.pumpAndSettle();

      expect(find.text('Email'), findsOneWidget);
      expect(find.text('Senha'), findsOneWidget);
    });

    testWidgets('renders app title', (tester) async {
      await tester.pumpWidget(createTestApp());
      await tester.pumpAndSettle();

      expect(find.text('CRM Builder'), findsOneWidget);
      expect(find.text('Entre na sua conta'), findsOneWidget);
    });

    testWidgets('renders login button', (tester) async {
      await tester.pumpWidget(createTestApp());
      await tester.pumpAndSettle();

      expect(find.text('Entrar'), findsOneWidget);
      expect(find.byType(ElevatedButton), findsOneWidget);
    });

    testWidgets('renders register link', (tester) async {
      await tester.pumpWidget(createTestApp());
      await tester.pumpAndSettle();

      expect(find.text('Nao tem conta? '), findsOneWidget);
      expect(find.text('Registre-se'), findsOneWidget);
    });

    testWidgets('renders forgot password link', (tester) async {
      await tester.pumpWidget(createTestApp());
      await tester.pumpAndSettle();

      expect(find.text('Esqueceu a senha?'), findsOneWidget);
    });

    testWidgets('validates empty email', (tester) async {
      await tester.pumpWidget(createTestApp());
      await tester.pumpAndSettle();

      // Tap login without filling fields
      await tester.tap(find.text('Entrar'));
      await tester.pumpAndSettle();

      expect(find.text('Email obrigatorio'), findsOneWidget);
    });

    testWidgets('validates invalid email', (tester) async {
      await tester.pumpWidget(createTestApp());
      await tester.pumpAndSettle();

      await tester.enterText(
        find.byType(TextFormField).first,
        'notanemail',
      );
      await tester.enterText(
        find.byType(TextFormField).last,
        'password123',
      );
      await tester.tap(find.text('Entrar'));
      await tester.pumpAndSettle();

      expect(find.text('Email invalido'), findsOneWidget);
    });

    testWidgets('validates empty password', (tester) async {
      await tester.pumpWidget(createTestApp());
      await tester.pumpAndSettle();

      await tester.enterText(
        find.byType(TextFormField).first,
        'user@example.com',
      );
      await tester.tap(find.text('Entrar'));
      await tester.pumpAndSettle();

      expect(find.text('Senha obrigatoria'), findsOneWidget);
    });

    testWidgets('validates short password', (tester) async {
      await tester.pumpWidget(createTestApp());
      await tester.pumpAndSettle();

      await tester.enterText(
        find.byType(TextFormField).first,
        'user@example.com',
      );
      await tester.enterText(
        find.byType(TextFormField).last,
        'abc',
      );
      await tester.tap(find.text('Entrar'));
      await tester.pumpAndSettle();

      expect(find.text('Minimo 6 caracteres'), findsOneWidget);
    });

    testWidgets('toggles password visibility', (tester) async {
      await tester.pumpWidget(createTestApp());
      await tester.pumpAndSettle();

      // Password should be obscured initially
      final passwordField = find.byType(TextFormField).last;
      expect(passwordField, findsOneWidget);

      // Tap visibility icon
      await tester.tap(find.byIcon(Icons.visibility_outlined));
      await tester.pumpAndSettle();

      // Should now show visibility_off icon
      expect(find.byIcon(Icons.visibility_off_outlined), findsOneWidget);
    });

    testWidgets('shows error message from auth state', (tester) async {
      await tester.pumpWidget(createTestApp(
        overrides: [
          authProvider.overrideWith(() {
            return _MockAuthNotifier('Credenciais invalidas');
          }),
        ],
      ),);
      await tester.pumpAndSettle();

      expect(find.text('Credenciais invalidas'), findsOneWidget);
    });

    testWidgets('disables button when loading', (tester) async {
      await tester.pumpWidget(createTestApp(
        overrides: [
          authProvider.overrideWith(() {
            return _MockAuthNotifier(null, isLoading: true);
          }),
        ],
      ),);
      await tester.pumpAndSettle();

      // Should show CircularProgressIndicator instead of text
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.text('Entrar'), findsNothing);
    });
  });
}

/// Mock Auth notifier for testing.
class _MockAuthNotifier extends Auth {

  _MockAuthNotifier(this.errorMessage, {this.isLoading = false});
  final String? errorMessage;
  final bool isLoading;

  @override
  AuthState build() {
    return AuthState(
      error: errorMessage,
      isLoading: isLoading,
    );
  }
}
