import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:crm_mobile/core/auth/auth_provider.dart';
import 'package:crm_mobile/core/config/env.dart';

/// Wraps the app to detect user inactivity and auto-logout
/// after [Env.autoLogoutMinutes] of no interaction.
class AutoLogoutWrapper extends ConsumerStatefulWidget {
  const AutoLogoutWrapper({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<AutoLogoutWrapper> createState() => _AutoLogoutWrapperState();
}

class _AutoLogoutWrapperState extends ConsumerState<AutoLogoutWrapper>
    with WidgetsBindingObserver {
  Timer? _logoutTimer;
  DateTime? _pausedAt;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _resetTimer();
  }

  @override
  void dispose() {
    _logoutTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused) {
      // Record when app went to background
      _pausedAt = DateTime.now();
      _logoutTimer?.cancel();
    } else if (state == AppLifecycleState.resumed) {
      // Check if background time exceeded the timeout
      if (_pausedAt != null) {
        final elapsed = DateTime.now().difference(_pausedAt!);
        if (elapsed.inMinutes >= Env.autoLogoutMinutes) {
          _handleAutoLogout();
          return;
        }
      }
      _resetTimer();
    }
  }

  void _resetTimer() {
    _logoutTimer?.cancel();
    _pausedAt = null;
    _logoutTimer = Timer(
      Duration(minutes: Env.autoLogoutMinutes),
      _handleAutoLogout,
    );
  }

  void _handleAutoLogout() {
    final authState = ref.read(authProvider);
    if (!authState.isAuthenticated) return;

    ref.read(authProvider.notifier).logout();
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
      onPointerDown: (_) => _resetTimer(),
      onPointerMove: (_) => _resetTimer(),
      child: widget.child,
    );
  }
}
