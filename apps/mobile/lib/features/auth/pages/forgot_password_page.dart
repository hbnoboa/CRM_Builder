import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:crm_mobile/core/network/api_client.dart';
import 'package:crm_mobile/core/theme/app_colors.dart';
import 'package:crm_mobile/core/theme/app_colors_extension.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';

class ForgotPasswordPage extends ConsumerStatefulWidget {
  const ForgotPasswordPage({super.key});

  @override
  ConsumerState<ForgotPasswordPage> createState() =>
      _ForgotPasswordPageState();
}

class _ForgotPasswordPageState extends ConsumerState<ForgotPasswordPage> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  bool _isLoading = false;
  bool _emailSent = false;
  String? _error;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final dio = ref.read(apiClientProvider);
      await dio.post('/auth/forgot-password', data: {
        'email': _emailController.text.trim(),
      },);
      setState(() => _emailSent = true);
    } catch (e) {
      setState(() => _error = 'Erro ao enviar email. Tente novamente.');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: _emailSent ? _buildSuccessContent() : _buildFormContent(),
          ),
        ),
      ),
    );
  }

  Widget _buildSuccessContent() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.mark_email_read_outlined,
            size: 64, color: context.colors.success,),
        const SizedBox(height: 16),
        Text(
          'Email enviado!',
          style: AppTypography.h3.copyWith(color: Theme.of(context).colorScheme.onSurface),
        ),
        const SizedBox(height: 8),
        Text(
          'Verifique sua caixa de entrada para redefinir sua senha.',
          style: AppTypography.bodyMedium
              .copyWith(color: context.colors.mutedForeground),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 24),
        SizedBox(
          width: double.infinity,
          height: 48,
          child: OutlinedButton(
            onPressed: () => context.pop(),
            child: const Text('Voltar ao login'),
          ),
        ),
      ],
    );
  }

  Widget _buildFormContent() {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Esqueceu a senha?',
            style: AppTypography.h2.copyWith(color: Theme.of(context).colorScheme.onSurface),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            'Digite seu email para receber um link de recuperacao.',
            style: AppTypography.bodyMedium
                .copyWith(color: context.colors.mutedForeground),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 32),

          if (_error != null) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: context.colors.destructive.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(AppColors.radius),
              ),
              child: Text(
                _error!,
                style: AppTypography.bodySmall
                    .copyWith(color: context.colors.destructive),
              ),
            ),
            const SizedBox(height: 16),
          ],

          TextFormField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            autocorrect: false,
            textInputAction: TextInputAction.done,
            onFieldSubmitted: (_) => _handleSubmit(),
            decoration: const InputDecoration(
              labelText: 'Email',
              hintText: 'seu@email.com',
              prefixIcon: Icon(Icons.email_outlined),
            ),
            validator: (value) {
              if (value == null || value.isEmpty) return 'Email obrigatorio';
              if (!value.contains('@')) return 'Email invalido';
              return null;
            },
          ),
          const SizedBox(height: 24),

          SizedBox(
            height: 48,
            child: ElevatedButton(
              onPressed: _isLoading ? null : _handleSubmit,
              child: _isLoading
                  ? SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Theme.of(context).colorScheme.onPrimary,
                      ),
                    )
                  : const Text('Enviar link'),
            ),
          ),
        ],
      ),
    );
  }
}
