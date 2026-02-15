import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:local_auth/local_auth.dart';
import 'package:crm_mobile/core/auth/auth_provider.dart';
import 'package:crm_mobile/core/auth/secure_storage.dart';
import 'package:crm_mobile/core/theme/app_colors.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _biometricAvailable = false;
  bool _biometricEnabled = false;

  @override
  void initState() {
    super.initState();
    _checkBiometric();
  }

  Future<void> _checkBiometric() async {
    final enabled = await SecureStorage.isBiometricEnabled();
    if (!enabled) return;

    // Only show biometric if user has a saved session (token exists)
    final token = await SecureStorage.getAccessToken();
    if (token == null) return;

    final localAuth = LocalAuthentication();
    final canCheck = await localAuth.canCheckBiometrics;
    final isSupported = await localAuth.isDeviceSupported();

    if (mounted) {
      setState(() {
        _biometricAvailable = canCheck && isSupported;
        _biometricEnabled = enabled;
      });
    }

    // Auto-prompt biometric after UI is ready
    if (canCheck && isSupported && mounted) {
      Future.delayed(const Duration(milliseconds: 300), () {
        if (mounted) _handleBiometricLogin();
      });
    }
  }

  Future<void> _handleBiometricLogin() async {
    final localAuth = LocalAuthentication();

    try {
      final authenticated = await localAuth.authenticate(
        localizedReason: 'Desbloqueie para acessar o CRM Builder',
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: true,
        ),
      );

      if (authenticated) {
        // User authenticated biometrically, restore session via getProfile
        await ref.read(authProvider.notifier).getProfile();
      }
    } catch (_) {
      // Biometric failed, user can still login with email/password
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    try {
      await ref.read(authProvider.notifier).login(
            email: _emailController.text.trim(),
            password: _passwordController.text,
          );
    } catch (_) {
      // Error is handled by auth state
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Logo / Title
                  const Icon(
                    Icons.hub_outlined,
                    size: 48,
                    color: AppColors.primary,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'CRM Builder',
                    style: AppTypography.h2.copyWith(
                      color: AppColors.foreground,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Entre na sua conta',
                    style: AppTypography.bodyMedium.copyWith(
                      color: AppColors.mutedForeground,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 32),

                  // Error message
                  if (authState.error != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.destructive.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(AppColors.radius),
                        border: Border.all(
                          color: AppColors.destructive.withValues(alpha: 0.3),
                        ),
                      ),
                      child: Text(
                        authState.error!,
                        style: AppTypography.bodySmall.copyWith(
                          color: AppColors.destructive,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // Email field
                  TextFormField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    autocorrect: false,
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(
                      labelText: 'Email',
                      hintText: 'seu@email.com',
                      prefixIcon: Icon(Icons.email_outlined),
                    ),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Email obrigatorio';
                      }
                      if (!value.contains('@')) {
                        return 'Email invalido';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),

                  // Password field
                  TextFormField(
                    controller: _passwordController,
                    obscureText: _obscurePassword,
                    textInputAction: TextInputAction.done,
                    onFieldSubmitted: (_) => _handleLogin(),
                    decoration: InputDecoration(
                      labelText: 'Senha',
                      prefixIcon: const Icon(Icons.lock_outlined),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscurePassword
                              ? Icons.visibility_outlined
                              : Icons.visibility_off_outlined,
                        ),
                        onPressed: () {
                          setState(() {
                            _obscurePassword = !_obscurePassword;
                          });
                        },
                      ),
                    ),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Senha obrigatoria';
                      }
                      if (value.length < 6) {
                        return 'Minimo 6 caracteres';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 8),

                  // Forgot password link
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      onPressed: () => context.push('/forgot-password'),
                      child: Text(
                        'Esqueceu a senha?',
                        style: AppTypography.bodySmall.copyWith(
                          color: AppColors.mutedForeground,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Login button
                  SizedBox(
                    height: 48,
                    child: ElevatedButton(
                      onPressed: authState.isLoading ? null : _handleLogin,
                      child: authState.isLoading
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: AppColors.primaryForeground,
                              ),
                            )
                          : const Text('Entrar'),
                    ),
                  ),

                  // Biometric login button
                  if (_biometricAvailable && _biometricEnabled) ...[
                    const SizedBox(height: 12),
                    SizedBox(
                      height: 48,
                      child: OutlinedButton.icon(
                        onPressed:
                            authState.isLoading ? null : _handleBiometricLogin,
                        icon: const Icon(Icons.fingerprint),
                        label: const Text('Entrar com biometria'),
                      ),
                    ),
                  ],

                  const SizedBox(height: 16),

                  // Register link
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        'Nao tem conta? ',
                        style: AppTypography.bodySmall.copyWith(
                          color: AppColors.mutedForeground,
                        ),
                      ),
                      GestureDetector(
                        onTap: () => context.push('/register'),
                        child: Text(
                          'Registre-se',
                          style: AppTypography.bodySmall.copyWith(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
