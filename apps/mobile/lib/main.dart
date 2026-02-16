import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:crm_mobile/app.dart';
import 'package:crm_mobile/core/database/app_database.dart';
import 'package:crm_mobile/core/push/push_notification_service.dart';
import 'package:crm_mobile/core/upload/local_file_storage.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize PowerSync database
  try {
    await AppDatabase.instance.initialize();
  } catch (e) {
    debugPrint('Failed to initialize database: $e');
  }

  // Initialize local file storage for offline uploads
  try {
    await LocalFileStorage.instance.initialize();
  } catch (e) {
    debugPrint('Failed to initialize local file storage: $e');
  }

  // Initialize Firebase & push notifications (non-blocking)
  try {
    await PushNotificationService.instance.initialize();
  } catch (e) {
    debugPrint('Failed to initialize push notifications: $e');
  }

  runApp(
    const ProviderScope(
      child: CrmApp(),
    ),
  );
}
