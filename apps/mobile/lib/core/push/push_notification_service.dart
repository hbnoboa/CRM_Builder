import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:logger/logger.dart';

import 'package:crm_mobile/core/auth/secure_storage.dart';
import 'package:crm_mobile/core/network/api_client.dart';

final _logger = Logger(printer: SimplePrinter());

/// Handles Firebase background messages (must be top-level function).
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  _logger.d('Background message received: ${message.messageId}');
}

/// Push notification service using Firebase Cloud Messaging.
/// Handles token registration, foreground/background message handling,
/// and notification permissions.
class PushNotificationService {
  PushNotificationService._();

  static final PushNotificationService instance = PushNotificationService._();

  FirebaseMessaging? _messaging;
  String? _currentToken;
  bool _initialized = false;

  /// Initialize Firebase and FCM. Call once at app startup.
  Future<void> initialize() async {
    if (_initialized) return;

    try {
      await Firebase.initializeApp();
      _messaging = FirebaseMessaging.instance;

      // Set background message handler
      FirebaseMessaging.onBackgroundMessage(
        _firebaseMessagingBackgroundHandler,
      );

      // Request notification permissions (iOS + Android 13+)
      await _requestPermission();

      // Listen for foreground messages
      FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

      // Listen for notification taps (app in background/terminated)
      FirebaseMessaging.onMessageOpenedApp.listen(_handleNotificationTap);

      // Check if app was opened from a terminated state via notification
      final initialMessage = await _messaging!.getInitialMessage();
      if (initialMessage != null) {
        _handleNotificationTap(initialMessage);
      }

      // Listen for token refresh
      _messaging!.onTokenRefresh.listen(_onTokenRefresh);

      _initialized = true;
      _logger.d('Push notification service initialized');
    } catch (e) {
      _logger.e('Failed to initialize push notifications: $e');
    }
  }

  /// Request notification permission from the user.
  Future<void> _requestPermission() async {
    final settings = await _messaging!.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );

    _logger.d('Notification permission: ${settings.authorizationStatus}');
  }

  /// Get the current FCM token and register it with the backend.
  /// Call after successful login.
  Future<void> registerDeviceToken() async {
    if (_messaging == null) return;

    try {
      final token = await _messaging!.getToken();
      if (token == null) return;

      _currentToken = token;

      final platform = Platform.isIOS ? 'ios' : 'android';
      final dio = createApiClient();

      await dio.post('/push/register-device', data: {
        'token': token,
        'platform': platform,
      });

      _logger.d('Device token registered: ${token.substring(0, 20)}...');
    } catch (e) {
      _logger.e('Failed to register device token: $e');
    }
  }

  /// Unregister the current device token from the backend.
  /// Call on logout.
  Future<void> unregisterDeviceToken() async {
    if (_currentToken == null) return;

    try {
      final dio = createApiClient();
      await dio.delete('/push/unregister-device', data: {
        'token': _currentToken,
      });
      _logger.d('Device token unregistered');
    } catch (e) {
      _logger.e('Failed to unregister device token: $e');
    }

    _currentToken = null;
  }

  /// Called when the FCM token is refreshed.
  void _onTokenRefresh(String newToken) async {
    _logger.d('FCM token refreshed');
    _currentToken = newToken;

    // Only re-register if user is authenticated
    final accessToken = await SecureStorage.getAccessToken();
    if (accessToken != null) {
      await registerDeviceToken();
    }
  }

  /// Handle foreground messages (app is open).
  void _handleForegroundMessage(RemoteMessage message) {
    _logger.d('Foreground message: ${message.notification?.title}');
    // PowerSync will sync the notification from the database,
    // so we don't need to do anything special here.
    // The notification list page will update automatically via stream.
  }

  /// Handle notification tap (user tapped the notification).
  void _handleNotificationTap(RemoteMessage message) {
    _logger.d('Notification tapped: ${message.data}');
    // Navigation to specific screen can be handled here
    // based on message.data (e.g., navigate to a specific record)
  }
}
