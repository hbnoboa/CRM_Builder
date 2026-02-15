import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:crm_mobile/app.dart';
import 'package:crm_mobile/core/database/app_database.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize PowerSync database
  await AppDatabase.instance.initialize();

  runApp(
    const ProviderScope(
      child: CrmApp(),
    ),
  );
}
