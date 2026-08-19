import 'package:flutter/material.dart';

/// Tela de abertura enquanto a sessao e restaurada (evita o flash da tela de
/// login no cold start). O router troca para /login ou a home quando termina.
class SplashPage extends StatelessWidget {
  const SplashPage({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.hub_outlined, size: 48, color: theme.colorScheme.primary),
            const SizedBox(height: 16),
            Text('CRM Builder', style: theme.textTheme.titleLarge),
            const SizedBox(height: 24),
            const SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(strokeWidth: 2.5),
            ),
          ],
        ),
      ),
    );
  }
}
