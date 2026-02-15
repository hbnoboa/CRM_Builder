import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:crm_mobile/app.dart';
import 'package:crm_mobile/core/database/app_database.dart';
import 'package:crm_mobile/core/push/push_notification_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize PowerSync database
  await AppDatabase.instance.initialize();

  // Initialize Firebase & push notifications
  await PushNotificationService.instance.initialize();

  runApp(
    const ProviderScope(
      child: CrmApp(),
    ),
  );
}
