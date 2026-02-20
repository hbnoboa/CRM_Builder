import 'dart:math' as math;
import 'package:flutter/material.dart';

/// HSL color representation.
class HSL {
  const HSL(this.h, this.s, this.l);
  final double h; // 0-360
  final double s; // 0-100
  final double l; // 0-100

  HSL copyWith({double? h, double? s, double? l}) =>
      HSL(h ?? this.h, s ?? this.s, l ?? this.l);
}

/// Generated theme colors from a single brand color.
class TenantThemeColors {
  const TenantThemeColors({
    required this.primary,
    required this.primaryForeground,
    required this.secondary,
    required this.secondaryForeground,
    required this.background,
    required this.foreground,
    required this.card,
    required this.cardForeground,
    required this.surface,
    required this.surfaceVariant,
    required this.muted,
    required this.mutedForeground,
    required this.accent,
    required this.accentForeground,
    required this.border,
    required this.input,
    required this.ring,
    required this.destructive,
    required this.destructiveForeground,
  });

  final Color primary;
  final Color primaryForeground;
  final Color secondary;
  final Color secondaryForeground;
  final Color background;
  final Color foreground;
  final Color card;
  final Color cardForeground;
  final Color surface;
  final Color surfaceVariant;
  final Color muted;
  final Color mutedForeground;
  final Color accent;
  final Color accentForeground;
  final Color border;
  final Color input;
  final Color ring;
  final Color destructive;
  final Color destructiveForeground;
}

// ═══════════════════════════════════════════════════════
// COLOR MATH (port of generate-theme.ts)
// ═══════════════════════════════════════════════════════

HSL hexToHSL(String hex) {
  hex = hex.replaceFirst('#', '');
  if (hex.length == 3) {
    hex = hex.split('').map((c) => '$c$c').join();
  }
  final r = int.parse(hex.substring(0, 2), radix: 16) / 255;
  final g = int.parse(hex.substring(2, 4), radix: 16) / 255;
  final b = int.parse(hex.substring(4, 6), radix: 16) / 255;

  final mx = math.max(r, math.max(g, b));
  final mn = math.min(r, math.min(g, b));
  final l = (mx + mn) / 2;
  double h = 0, s = 0;

  if (mx != mn) {
    final d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx == r) {
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    } else if (mx == g) {
      h = ((b - r) / d + 2) / 6;
    } else {
      h = ((r - g) / d + 4) / 6;
    }
  }

  return HSL(
    (h * 360 * 10).roundToDouble() / 10,
    (s * 1000).roundToDouble() / 10,
    (l * 1000).roundToDouble() / 10,
  );
}

Color hslToColor(double h, double s, double l) {
  s /= 100;
  l /= 100;
  double k(double n) => (n + h / 30) % 12;
  final a = s * math.min(l, 1 - l);
  double f(double n) =>
      l - a * math.max(-1, math.min(k(n) - 3, math.min(9 - k(n), 1)));
  return Color.fromARGB(
    255,
    (f(0) * 255).round().clamp(0, 255),
    (f(8) * 255).round().clamp(0, 255),
    (f(4) * 255).round().clamp(0, 255),
  );
}

double _luminance(Color c) {
  double channel(int v) {
    final s = v / 255;
    return s <= 0.03928 ? s / 12.92 : math.pow((s + 0.055) / 1.055, 2.4).toDouble();
  }
  return 0.2126 * channel(c.red) + 0.7152 * channel(c.green) + 0.0722 * channel(c.blue);
}

double _contrastRatio(HSL a, HSL b) {
  final l1 = _luminance(hslToColor(a.h, a.s, a.l));
  final l2 = _luminance(hslToColor(b.h, b.s, b.l));
  final lighter = math.max(l1, l2);
  final darker = math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

double _clamp(double val, double min, double max) =>
    math.min(max, math.max(min, val));

HSL _ensureContrast(HSL primary, HSL bg, bool darken) {
  var p = primary.copyWith();
  var attempts = 0;
  while (_contrastRatio(p, bg) < 4.5 && attempts < 40) {
    p = p.copyWith(l: darken ? p.l - 2 : p.l + 2);
    p = p.copyWith(l: _clamp(p.l, 5, 95));
    attempts++;
  }
  return p;
}

// ═══════════════════════════════════════════════════════
// MAIN GENERATOR
// ═══════════════════════════════════════════════════════

/// Generate a complete color palette from a single brand hex color.
/// Port of web-admin's generateThemeVariables().
/// Set [isDark] to true for dark mode palette.
TenantThemeColors generateThemeColors(String hex, {bool isDark = false}) {
  final brand = hexToHSL(hex);
  final h = brand.h;
  final s = brand.s;

  if (isDark) {
    // ---- DARK MODE ----
    final darkBg = HSL(h, _clamp(s * 0.15, 5, 15), 7);
    final darkPrimary = _ensureContrast(
      HSL(h, _clamp(s, 50, 85), _clamp(brand.l, 55, 75)),
      darkBg,
      false,
    );

    final primaryColor = hslToColor(darkPrimary.h, darkPrimary.s, darkPrimary.l);
    final primaryFg = darkPrimary.l > 60
        ? hslToColor(h, _clamp(s, 40, 80), 10)
        : const Color(0xFFFFFFFF);

    return TenantThemeColors(
      primary: primaryColor,
      primaryForeground: primaryFg,
      secondary: hslToColor(h, _clamp(s * 0.15, 5, 15), 16),
      secondaryForeground: hslToColor(h, _clamp(s * 0.1, 3, 10), 92),
      background: hslToColor(h, _clamp(s * 0.15, 5, 15), 7),
      foreground: hslToColor(h, _clamp(s * 0.1, 3, 10), 96),
      card: hslToColor(h, _clamp(s * 0.12, 4, 12), 10),
      cardForeground: hslToColor(h, _clamp(s * 0.1, 3, 10), 96),
      surface: hslToColor(h, _clamp(s * 0.12, 4, 12), 12),
      surfaceVariant: hslToColor(h, _clamp(s * 0.1, 3, 10), 18),
      muted: hslToColor(h, _clamp(s * 0.1, 3, 10), 18),
      mutedForeground: hslToColor(h, _clamp(s * 0.08, 3, 10), 60),
      accent: hslToColor((h + 15) % 360, _clamp(s * 0.15, 5, 15), 16),
      accentForeground: hslToColor(h, _clamp(s * 0.1, 3, 10), 92),
      border: hslToColor(h, _clamp(s * 0.1, 3, 10), 20),
      input: hslToColor(h, _clamp(s * 0.1, 3, 10), 20),
      ring: primaryColor,
      destructive: const Color(0xFFDC2626),
      destructiveForeground: const Color(0xFFFEF2F2),
    );
  }

  // ---- LIGHT MODE ----
  final lightBg = HSL(h, _clamp(s * 0.05, 1, 4), 98.5);
  final lightPrimary = _ensureContrast(
    HSL(h, _clamp(s, 40, 90), _clamp(brand.l, 15, 45)),
    lightBg,
    true,
  );

  final primaryColor = hslToColor(lightPrimary.h, lightPrimary.s, lightPrimary.l);
  final primaryFg = lightPrimary.l < 50
      ? const Color(0xFFFFFFFF)
      : hslToColor(h, _clamp(s, 40, 80), 5);

  return TenantThemeColors(
    primary: primaryColor,
    primaryForeground: primaryFg,
    secondary: hslToColor(h, _clamp(s * 0.08, 2, 8), 95.5),
    secondaryForeground: primaryColor,
    background: hslToColor(h, _clamp(s * 0.05, 1, 4), 98.5),
    foreground: hslToColor(h, _clamp(s * 0.1, 3, 10), 8),
    card: hslToColor(h, _clamp(s * 0.05, 1, 4), 99),
    cardForeground: hslToColor(h, _clamp(s * 0.1, 3, 10), 8),
    surface: hslToColor(h, _clamp(s * 0.05, 1, 4), 99),
    surfaceVariant: hslToColor(h, _clamp(s * 0.06, 1, 6), 96),
    muted: hslToColor(h, _clamp(s * 0.06, 1, 6), 96),
    mutedForeground: hslToColor(h, _clamp(s * 0.08, 3, 10), 46),
    accent: hslToColor((h + 15) % 360, _clamp(s * 0.08, 2, 8), 95.5),
    accentForeground: primaryColor,
    border: hslToColor(h, _clamp(s * 0.06, 2, 6), 91),
    input: hslToColor(h, _clamp(s * 0.06, 2, 6), 91),
    ring: primaryColor,
    destructive: const Color(0xFFEF4444),
    destructiveForeground: const Color(0xFFFFFFFF),
  );
}
