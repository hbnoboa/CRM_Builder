import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:crm_mobile/app.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Login Flow', () {
    testWidgets('displays login page on startup', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(child: CrmApp()),
      );
      await tester.pumpAndSettle();

      // Should show login page when not authenticated
      expect(find.text('CRM Builder'), findsOneWidget);
      expect(find.text('Entre na sua conta'), findsOneWidget);
      expect(find.text('Entrar'), findsOneWidget);
    });

    testWidgets('validates empty form submission', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(child: CrmApp()),
      );
      await tester.pumpAndSettle();

      // Tap login without filling fields
      await tester.tap(find.text('Entrar'));
      await tester.pumpAndSettle();

      expect(find.text('Email obrigatorio'), findsOneWidget);
      expect(find.text('Senha obrigatoria'), findsOneWidget);
    });

    testWidgets('navigates to register page', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(child: CrmApp()),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Registre-se'));
      await tester.pumpAndSettle();

      expect(find.text('Criar Conta'), findsOneWidget);
    });
  });

  group('Offline Behavior', () {
    testWidgets('app starts without crashing when offline', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(child: CrmApp()),
      );
      await tester.pumpAndSettle();

      // App should render without crashing even offline
      expect(find.byType(CrmApp), findsOneWidget);
    });
  });
}
