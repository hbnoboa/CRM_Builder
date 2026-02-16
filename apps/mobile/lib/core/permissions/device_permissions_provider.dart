import 'package:flutter/foundation.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:crm_mobile/core/auth/secure_storage.dart';
import 'package:crm_mobile/core/config/constants.dart';

part 'device_permissions_provider.g.dart';

// ═══════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════

class DevicePermissionsState {
  const DevicePermissionsState({
    this.locationGranted = false,
    this.cameraGranted = false,
    this.notificationsGranted = false,
    this.onboardingCompleted = false,
    this.isChecking = false,
    this.hasPermanentlyDenied = false,
  });

  final bool locationGranted;
  final bool cameraGranted;
  final bool notificationsGranted;
  final bool onboardingCompleted;
  final bool isChecking;
  final bool hasPermanentlyDenied;

  bool get allGranted =>
      locationGranted && cameraGranted && notificationsGranted;

  DevicePermissionsState copyWith({
    bool? locationGranted,
    bool? cameraGranted,
    bool? notificationsGranted,
    bool? onboardingCompleted,
    bool? isChecking,
    bool? hasPermanentlyDenied,
  }) {
    return DevicePermissionsState(
      locationGranted: locationGranted ?? this.locationGranted,
      cameraGranted: cameraGranted ?? this.cameraGranted,
      notificationsGranted: notificationsGranted ?? this.notificationsGranted,
      onboardingCompleted: onboardingCompleted ?? this.onboardingCompleted,
      isChecking: isChecking ?? this.isChecking,
      hasPermanentlyDenied: hasPermanentlyDenied ?? this.hasPermanentlyDenied,
    );
  }
}

// ═══════════════════════════════════════════════════════
// NOTIFIER
// ═══════════════════════════════════════════════════════

@Riverpod(keepAlive: true)
class DevicePermissions extends _$DevicePermissions {
  @override
  DevicePermissionsState build() {
    _loadOnboardingFlag();
    return const DevicePermissionsState();
  }

  Future<void> _loadOnboardingFlag() async {
    final value = await SecureStorage.getString(
      AppConstants.keyPermissionsOnboarding,
    );
    if (value == 'true') {
      state = state.copyWith(onboardingCompleted: true);
    }
  }

  /// Check the status of all required permissions.
  Future<void> checkAll() async {
    state = state.copyWith(isChecking: true);

    final results = await Future.wait([
      Permission.location.status,
      Permission.camera.status,
      Permission.notification.status,
    ]);

    final locationStatus = results[0];
    final cameraStatus = results[1];
    final notificationStatus = results[2];

    final anyPermanentlyDenied = locationStatus.isPermanentlyDenied ||
        cameraStatus.isPermanentlyDenied ||
        notificationStatus.isPermanentlyDenied;

    state = state.copyWith(
      locationGranted: locationStatus.isGranted,
      cameraGranted: cameraStatus.isGranted,
      notificationsGranted: notificationStatus.isGranted,
      hasPermanentlyDenied: anyPermanentlyDenied,
      isChecking: false,
    );

    // Auto-complete onboarding if all are granted
    if (state.allGranted && !state.onboardingCompleted) {
      await _setOnboardingCompleted();
    }
  }

  /// Request all required permissions.
  Future<void> requestAll() async {
    state = state.copyWith(isChecking: true);

    final results = await [
      Permission.location,
      Permission.camera,
      Permission.notification,
    ].request();

    final locationStatus = results[Permission.location]!;
    final cameraStatus = results[Permission.camera]!;
    final notificationStatus = results[Permission.notification]!;

    final anyPermanentlyDenied = locationStatus.isPermanentlyDenied ||
        cameraStatus.isPermanentlyDenied ||
        notificationStatus.isPermanentlyDenied;

    state = state.copyWith(
      locationGranted: locationStatus.isGranted,
      cameraGranted: cameraStatus.isGranted,
      notificationsGranted: notificationStatus.isGranted,
      hasPermanentlyDenied: anyPermanentlyDenied,
      isChecking: false,
    );

    if (state.allGranted) {
      await _setOnboardingCompleted();
    }
  }

  /// Open app settings so the user can manually grant permissions.
  Future<void> openSettings() async {
    await openAppSettings();
  }

  Future<void> _setOnboardingCompleted() async {
    state = state.copyWith(onboardingCompleted: true);
    await SecureStorage.setString(
      AppConstants.keyPermissionsOnboarding,
      'true',
    );
    debugPrint('[DevicePermissions] Onboarding completed - all permissions granted');
  }
}
