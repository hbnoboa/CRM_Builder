import 'package:flutter/material.dart';

/// Design system colors extracted from web-admin globals.css.
class AppColors {
  AppColors._();

  // ═══════════════════════════════════════════════════════
  // LIGHT THEME (from :root in globals.css)
  // ═══════════════════════════════════════════════════════

  static const Color background = Color(0xFFFFFFFF);
  static const Color foreground = Color(0xFF0F172A);

  static const Color card = Color(0xFFFFFFFF);
  static const Color cardForeground = Color(0xFF0F172A);

  static const Color popover = Color(0xFFFFFFFF);
  static const Color popoverForeground = Color(0xFF0F172A);

  static const Color primary = Color(0xFF1E293B);
  static const Color primaryForeground = Color(0xFFF8FAFC);

  static const Color secondary = Color(0xFFF1F5F9);
  static const Color secondaryForeground = Color(0xFF1E293B);

  static const Color muted = Color(0xFFF1F5F9);
  static const Color mutedForeground = Color(0xFF64748B);

  static const Color accent = Color(0xFFF1F5F9);
  static const Color accentForeground = Color(0xFF1E293B);

  static const Color destructive = Color(0xFFEF4444);
  static const Color destructiveForeground = Color(0xFFF8FAFC);

  static const Color border = Color(0xFFE2E8F0);
  static const Color input = Color(0xFFE2E8F0);
  static const Color ring = Color(0xFF0F172A);

  // ═══════════════════════════════════════════════════════
  // DARK THEME (from .dark in globals.css)
  // ═══════════════════════════════════════════════════════

  static const Color darkBackground = Color(0xFF0F172A);
  static const Color darkForeground = Color(0xFFF8FAFC);

  static const Color darkCard = Color(0xFF0F172A);
  static const Color darkCardForeground = Color(0xFFF8FAFC);

  static const Color darkPopover = Color(0xFF0F172A);
  static const Color darkPopoverForeground = Color(0xFFF8FAFC);

  static const Color darkPrimary = Color(0xFFF8FAFC);
  static const Color darkPrimaryForeground = Color(0xFF1E293B);

  static const Color darkSecondary = Color(0xFF1E293B);
  static const Color darkSecondaryForeground = Color(0xFFF8FAFC);

  static const Color darkMuted = Color(0xFF1E293B);
  static const Color darkMutedForeground = Color(0xFF94A3B8);

  static const Color darkAccent = Color(0xFF1E293B);
  static const Color darkAccentForeground = Color(0xFFF8FAFC);

  static const Color darkDestructive = Color(0xFF7F1D1D);
  static const Color darkDestructiveForeground = Color(0xFFF8FAFC);

  static const Color darkBorder = Color(0xFF1E293B);
  static const Color darkInput = Color(0xFF1E293B);
  static const Color darkRing = Color(0xFFCBD5E1);

  // ═══════════════════════════════════════════════════════
  // SEMANTIC COLORS
  // ═══════════════════════════════════════════════════════

  static const Color success = Color(0xFF22C55E);
  static const Color warning = Color(0xFFF59E0B);
  static const Color info = Color(0xFF3B82F6);
  static const Color error = Color(0xFFEF4444);

  // Sync status
  static const Color syncOnline = Color(0xFF22C55E);
  static const Color syncSyncing = Color(0xFFF59E0B);
  static const Color syncOffline = Color(0xFFEF4444);

  // ═══════════════════════════════════════════════════════
  // DESIGN TOKENS
  // ═══════════════════════════════════════════════════════

  /// Border radius (--radius: 0.5rem = 8px)
  static const double radius = 8.0;
  static const double radiusSm = 6.0;
  static const double radiusLg = 12.0;
  static const double radiusXl = 16.0;
}
