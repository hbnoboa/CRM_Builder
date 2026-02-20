import 'package:flutter/material.dart';

/// Extension for custom colors not available in ColorScheme.
/// Mirrors the CSS variables from web-admin.
@immutable
class AppColorsExtension extends ThemeExtension<AppColorsExtension> {
  const AppColorsExtension({
    required this.muted,
    required this.mutedForeground,
    required this.card,
    required this.cardForeground,
    required this.border,
    required this.input,
    required this.ring,
    required this.destructive,
    required this.destructiveForeground,
    required this.success,
    required this.successForeground,
    required this.warning,
    required this.warningForeground,
    required this.info,
    required this.infoForeground,
  });

  final Color muted;
  final Color mutedForeground;
  final Color card;
  final Color cardForeground;
  final Color border;
  final Color input;
  final Color ring;
  final Color destructive;
  final Color destructiveForeground;
  final Color success;
  final Color successForeground;
  final Color warning;
  final Color warningForeground;
  final Color info;
  final Color infoForeground;

  /// Light theme defaults
  static const light = AppColorsExtension(
    muted: Color(0xFFF1F5F9),
    mutedForeground: Color(0xFF64748B),
    card: Color(0xFFFFFFFF),
    cardForeground: Color(0xFF0F172A),
    border: Color(0xFFE2E8F0),
    input: Color(0xFFE2E8F0),
    ring: Color(0xFF3B82F6),
    destructive: Color(0xFFEF4444),
    destructiveForeground: Color(0xFFFFFFFF),
    success: Color(0xFF10B981),
    successForeground: Color(0xFFFFFFFF),
    warning: Color(0xFFF59E0B),
    warningForeground: Color(0xFFFFFFFF),
    info: Color(0xFF0EA5E9),
    infoForeground: Color(0xFFFFFFFF),
  );

  /// Dark theme defaults
  static const dark = AppColorsExtension(
    muted: Color(0xFF1E293B),
    mutedForeground: Color(0xFF94A3B8),
    card: Color(0xFF0F172A),
    cardForeground: Color(0xFFF8FAFC),
    border: Color(0xFF334155),
    input: Color(0xFF334155),
    ring: Color(0xFF3B82F6),
    destructive: Color(0xFFDC2626),
    destructiveForeground: Color(0xFFFEF2F2),
    success: Color(0xFF10B981),
    successForeground: Color(0xFFFFFFFF),
    warning: Color(0xFFF59E0B),
    warningForeground: Color(0xFFFFFFFF),
    info: Color(0xFF0EA5E9),
    infoForeground: Color(0xFFFFFFFF),
  );

  @override
  AppColorsExtension copyWith({
    Color? muted,
    Color? mutedForeground,
    Color? card,
    Color? cardForeground,
    Color? border,
    Color? input,
    Color? ring,
    Color? destructive,
    Color? destructiveForeground,
    Color? success,
    Color? successForeground,
    Color? warning,
    Color? warningForeground,
    Color? info,
    Color? infoForeground,
  }) {
    return AppColorsExtension(
      muted: muted ?? this.muted,
      mutedForeground: mutedForeground ?? this.mutedForeground,
      card: card ?? this.card,
      cardForeground: cardForeground ?? this.cardForeground,
      border: border ?? this.border,
      input: input ?? this.input,
      ring: ring ?? this.ring,
      destructive: destructive ?? this.destructive,
      destructiveForeground: destructiveForeground ?? this.destructiveForeground,
      success: success ?? this.success,
      successForeground: successForeground ?? this.successForeground,
      warning: warning ?? this.warning,
      warningForeground: warningForeground ?? this.warningForeground,
      info: info ?? this.info,
      infoForeground: infoForeground ?? this.infoForeground,
    );
  }

  @override
  AppColorsExtension lerp(ThemeExtension<AppColorsExtension>? other, double t) {
    if (other is! AppColorsExtension) return this;
    return AppColorsExtension(
      muted: Color.lerp(muted, other.muted, t)!,
      mutedForeground: Color.lerp(mutedForeground, other.mutedForeground, t)!,
      card: Color.lerp(card, other.card, t)!,
      cardForeground: Color.lerp(cardForeground, other.cardForeground, t)!,
      border: Color.lerp(border, other.border, t)!,
      input: Color.lerp(input, other.input, t)!,
      ring: Color.lerp(ring, other.ring, t)!,
      destructive: Color.lerp(destructive, other.destructive, t)!,
      destructiveForeground: Color.lerp(destructiveForeground, other.destructiveForeground, t)!,
      success: Color.lerp(success, other.success, t)!,
      successForeground: Color.lerp(successForeground, other.successForeground, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      warningForeground: Color.lerp(warningForeground, other.warningForeground, t)!,
      info: Color.lerp(info, other.info, t)!,
      infoForeground: Color.lerp(infoForeground, other.infoForeground, t)!,
    );
  }
}

/// Convenient extension to access custom colors from context.
extension AppColorsExtensionBuildContext on BuildContext {
  AppColorsExtension get colors =>
      Theme.of(this).extension<AppColorsExtension>() ?? AppColorsExtension.light;
}
