import 'package:flutter/material.dart';

/// Modern design system colors.
class AppColors {
  AppColors._();

  // ═══════════════════════════════════════════════════════
  // BRAND COLORS
  // ═══════════════════════════════════════════════════════

  /// Primary brand color - Vibrant Blue
  static const Color primary = Color(0xFF3B82F6);
  static const Color primaryLight = Color(0xFF60A5FA);
  static const Color primaryDark = Color(0xFF2563EB);
  static const Color primaryForeground = Color(0xFFFFFFFF);

  /// Secondary - Soft Purple
  static const Color secondary = Color(0xFF8B5CF6);
  static const Color secondaryLight = Color(0xFFA78BFA);
  static const Color secondaryForeground = Color(0xFFFFFFFF);

  /// Accent - Vibrant Teal
  static const Color accent = Color(0xFF14B8A6);
  static const Color accentLight = Color(0xFF2DD4BF);
  static const Color accentForeground = Color(0xFFFFFFFF);

  // ═══════════════════════════════════════════════════════
  // THEME COLORS
  // ═══════════════════════════════════════════════════════

  static const Color background = Color(0xFFF8FAFC);
  static const Color foreground = Color(0xFF0F172A);

  static const Color card = Color(0xFFFFFFFF);
  static const Color cardForeground = Color(0xFF1E293B);

  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceVariant = Color(0xFFF1F5F9);

  static const Color muted = Color(0xFFF1F5F9);
  static const Color mutedForeground = Color(0xFF64748B);

  static const Color border = Color(0xFFE2E8F0);
  static const Color borderLight = Color(0xFFF1F5F9);
  static const Color input = Color(0xFFE2E8F0);
  static const Color ring = Color(0xFF3B82F6);

  // ═══════════════════════════════════════════════════════
  // SEMANTIC COLORS
  // ═══════════════════════════════════════════════════════

  static const Color success = Color(0xFF10B981);
  static const Color successLight = Color(0xFFD1FAE5);
  static const Color successForeground = Color(0xFF065F46);

  static const Color warning = Color(0xFFF59E0B);
  static const Color warningLight = Color(0xFFFEF3C7);
  static const Color warningForeground = Color(0xFF92400E);

  static const Color info = Color(0xFF0EA5E9);
  static const Color infoLight = Color(0xFFE0F2FE);
  static const Color infoForeground = Color(0xFF0369A1);

  static const Color error = Color(0xFFEF4444);
  static const Color errorLight = Color(0xFFFEE2E2);
  static const Color errorForeground = Color(0xFFB91C1C);

  // Aliases
  static const Color destructive = error;
  static const Color destructiveForeground = Color(0xFFFFFFFF);

  // ═══════════════════════════════════════════════════════
  // SYNC STATUS
  // ═══════════════════════════════════════════════════════

  static const Color syncOnline = success;
  static const Color syncSyncing = warning;
  static const Color syncOffline = error;

  // ═══════════════════════════════════════════════════════
  // CHART COLORS
  // ═══════════════════════════════════════════════════════

  static const List<Color> chartPalette = [
    Color(0xFF3B82F6), // Blue
    Color(0xFF10B981), // Green
    Color(0xFFF59E0B), // Amber
    Color(0xFF8B5CF6), // Purple
    Color(0xFFEC4899), // Pink
    Color(0xFF14B8A6), // Teal
    Color(0xFFF97316), // Orange
    Color(0xFF6366F1), // Indigo
  ];

  // ═══════════════════════════════════════════════════════
  // GRADIENTS
  // ═══════════════════════════════════════════════════════

  static const LinearGradient primaryGradient = LinearGradient(
    colors: [Color(0xFF3B82F6), Color(0xFF8B5CF6)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient successGradient = LinearGradient(
    colors: [Color(0xFF10B981), Color(0xFF14B8A6)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient cardGradient = LinearGradient(
    colors: [Color(0xFFFFFFFF), Color(0xFFF8FAFC)],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );

  // ═══════════════════════════════════════════════════════
  // SHADOWS
  // ═══════════════════════════════════════════════════════

  static List<BoxShadow> get cardShadow => [
        BoxShadow(
          color: const Color(0xFF0F172A).withValues(alpha: 0.04),
          blurRadius: 6,
          offset: const Offset(0, 2),
        ),
        BoxShadow(
          color: const Color(0xFF0F172A).withValues(alpha: 0.06),
          blurRadius: 16,
          offset: const Offset(0, 8),
        ),
      ];

  static List<BoxShadow> get cardShadowHover => [
        BoxShadow(
          color: const Color(0xFF0F172A).withValues(alpha: 0.06),
          blurRadius: 12,
          offset: const Offset(0, 4),
        ),
        BoxShadow(
          color: const Color(0xFF0F172A).withValues(alpha: 0.08),
          blurRadius: 24,
          offset: const Offset(0, 12),
        ),
      ];

  static List<BoxShadow> get navShadow => [
        BoxShadow(
          color: const Color(0xFF0F172A).withValues(alpha: 0.08),
          blurRadius: 24,
          offset: const Offset(0, -4),
        ),
      ];

  // ═══════════════════════════════════════════════════════
  // DESIGN TOKENS
  // ═══════════════════════════════════════════════════════

  /// Border radius following 8-point grid
  static const double radiusXs = 4.0;
  static const double radiusSm = 8.0;
  static const double radius = 12.0;
  static const double radiusMd = 12.0;
  static const double radiusLg = 16.0;
  static const double radiusXl = 20.0;
  static const double radiusFull = 999.0;

  /// Spacing following 8-point grid
  static const double spaceXs = 4.0;
  static const double spaceSm = 8.0;
  static const double spaceMd = 16.0;
  static const double spaceLg = 24.0;
  static const double spaceXl = 32.0;
  static const double space2xl = 48.0;

  /// Elevation levels
  static const double elevationSm = 2.0;
  static const double elevationMd = 4.0;
  static const double elevationLg = 8.0;
}
