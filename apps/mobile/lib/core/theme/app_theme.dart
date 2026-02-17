import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:crm_mobile/core/theme/app_colors.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';

/// Modern ThemeData for the CRM Builder mobile app.
/// Based on 2025-2026 design trends: vibrant colors, elevated surfaces, smooth animations.
class AppTheme {
  AppTheme._();

  // ═══════════════════════════════════════════════════════
  // LIGHT THEME
  // ═══════════════════════════════════════════════════════

  static ThemeData get light => ThemeData(
        useMaterial3: true,
        brightness: Brightness.light,
        fontFamily: AppTypography.fontFamily,

        // Color Scheme - Vibrant Modern
        colorScheme: ColorScheme.fromSeed(
          seedColor: AppColors.primary,
          brightness: Brightness.light,
          primary: AppColors.primary,
          onPrimary: AppColors.primaryForeground,
          secondary: AppColors.secondary,
          onSecondary: AppColors.secondaryForeground,
          tertiary: AppColors.accent,
          error: AppColors.error,
          surface: AppColors.surface,
          onSurface: AppColors.foreground,
          surfaceContainerHighest: AppColors.muted,
          outline: AppColors.border,
        ),

        scaffoldBackgroundColor: AppColors.background,

        // AppBar - Clean with subtle shadow
        appBarTheme: AppBarTheme(
          backgroundColor: AppColors.surface,
          foregroundColor: AppColors.foreground,
          elevation: 0,
          scrolledUnderElevation: 2,
          surfaceTintColor: Colors.transparent,
          shadowColor: AppColors.foreground.withValues(alpha: 0.1),
          systemOverlayStyle: SystemUiOverlayStyle.dark,
          centerTitle: false,
          titleTextStyle: TextStyle(
            fontFamily: AppTypography.fontFamily,
            fontSize: 20,
            fontWeight: FontWeight.w600,
            color: AppColors.foreground,
            letterSpacing: -0.5,
          ),
          iconTheme: const IconThemeData(
            color: AppColors.foreground,
            size: 24,
          ),
        ),

        // Card - Elevated with shadow
        cardTheme: CardThemeData(
          color: AppColors.card,
          elevation: 0,
          shadowColor: Colors.transparent,
          surfaceTintColor: Colors.transparent,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppColors.radiusLg),
          ),
          margin: EdgeInsets.zero,
          clipBehavior: Clip.antiAlias,
        ),

        // Elevated Button - Primary action
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary,
            foregroundColor: AppColors.primaryForeground,
            elevation: 0,
            shadowColor: AppColors.primary.withValues(alpha: 0.3),
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppColors.radius),
            ),
            textStyle: AppTypography.button.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
        ),

        // Filled Button
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.primary,
            foregroundColor: AppColors.primaryForeground,
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppColors.radius),
            ),
          ),
        ),

        // Outlined Button
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: AppColors.primary,
            side: const BorderSide(color: AppColors.border, width: 1.5),
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppColors.radius),
            ),
            textStyle: AppTypography.button,
          ),
        ),

        // Text Button
        textButtonTheme: TextButtonThemeData(
          style: TextButton.styleFrom(
            foregroundColor: AppColors.primary,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppColors.radius),
            ),
            textStyle: AppTypography.button,
          ),
        ),

        // FAB - Prominent with gradient-like effect
        floatingActionButtonTheme: FloatingActionButtonThemeData(
          backgroundColor: AppColors.primary,
          foregroundColor: AppColors.primaryForeground,
          elevation: 4,
          focusElevation: 6,
          hoverElevation: 8,
          highlightElevation: 6,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppColors.radiusLg),
          ),
          extendedTextStyle: AppTypography.labelLarge.copyWith(
            fontWeight: FontWeight.w600,
            color: AppColors.primaryForeground,
          ),
        ),

        // Input - Clean and modern
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: AppColors.surface,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 14,
          ),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppColors.radius),
            borderSide: const BorderSide(color: AppColors.border, width: 1.5),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppColors.radius),
            borderSide: const BorderSide(color: AppColors.border, width: 1.5),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppColors.radius),
            borderSide: const BorderSide(color: AppColors.primary, width: 2),
          ),
          errorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppColors.radius),
            borderSide: const BorderSide(color: AppColors.error, width: 1.5),
          ),
          focusedErrorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppColors.radius),
            borderSide: const BorderSide(color: AppColors.error, width: 2),
          ),
          hintStyle: AppTypography.bodyMedium.copyWith(
            color: AppColors.mutedForeground,
          ),
          labelStyle: AppTypography.labelLarge.copyWith(
            color: AppColors.foreground,
          ),
          prefixIconColor: AppColors.mutedForeground,
          suffixIconColor: AppColors.mutedForeground,
        ),

        // Navigation Bar (Bottom)
        navigationBarTheme: NavigationBarThemeData(
          backgroundColor: AppColors.surface,
          elevation: 0,
          height: 72,
          indicatorColor: AppColors.primary.withValues(alpha: 0.12),
          indicatorShape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppColors.radiusFull),
          ),
          labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
          labelTextStyle: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return AppTypography.labelSmall.copyWith(
                color: AppColors.primary,
                fontWeight: FontWeight.w600,
              );
            }
            return AppTypography.labelSmall.copyWith(
              color: AppColors.mutedForeground,
              fontWeight: FontWeight.w500,
            );
          }),
          iconTheme: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return const IconThemeData(
                color: AppColors.primary,
                size: 24,
              );
            }
            return const IconThemeData(
              color: AppColors.mutedForeground,
              size: 24,
            );
          }),
        ),

        // Divider
        dividerTheme: const DividerThemeData(
          color: AppColors.border,
          thickness: 1,
          space: 1,
        ),

        // Chip - Modern rounded
        chipTheme: ChipThemeData(
          backgroundColor: AppColors.surfaceVariant,
          labelStyle: AppTypography.labelMedium.copyWith(
            color: AppColors.foreground,
            fontWeight: FontWeight.w500,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppColors.radiusFull),
          ),
          side: BorderSide.none,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          showCheckmark: false,
        ),

        // Dialog
        dialogTheme: DialogThemeData(
          backgroundColor: AppColors.surface,
          elevation: 8,
          shadowColor: AppColors.foreground.withValues(alpha: 0.15),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppColors.radiusXl),
          ),
          titleTextStyle: AppTypography.h4.copyWith(
            color: AppColors.foreground,
          ),
          contentTextStyle: AppTypography.bodyMedium.copyWith(
            color: AppColors.mutedForeground,
          ),
        ),

        // SnackBar
        snackBarTheme: SnackBarThemeData(
          backgroundColor: AppColors.foreground,
          contentTextStyle: AppTypography.bodyMedium.copyWith(
            color: AppColors.background,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppColors.radius),
          ),
          behavior: SnackBarBehavior.floating,
          elevation: 4,
        ),

        // Bottom Sheet
        bottomSheetTheme: BottomSheetThemeData(
          backgroundColor: AppColors.surface,
          elevation: 8,
          shadowColor: AppColors.foreground.withValues(alpha: 0.15),
          shape: const RoundedRectangleBorder(
            borderRadius: BorderRadius.vertical(
              top: Radius.circular(20),
            ),
          ),
          dragHandleColor: AppColors.mutedForeground.withValues(alpha: 0.4),
          dragHandleSize: const Size(40, 4),
          showDragHandle: true,
        ),

        // ListTile
        listTileTheme: ListTileThemeData(
          contentPadding: const EdgeInsets.symmetric(horizontal: 16),
          minVerticalPadding: 12,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppColors.radius),
          ),
          tileColor: Colors.transparent,
          selectedTileColor: AppColors.primary.withValues(alpha: 0.08),
        ),

        // Progress Indicator
        progressIndicatorTheme: const ProgressIndicatorThemeData(
          color: AppColors.primary,
          linearTrackColor: AppColors.muted,
          circularTrackColor: AppColors.muted,
        ),

        // Switch
        switchTheme: SwitchThemeData(
          thumbColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return AppColors.primaryForeground;
            }
            return AppColors.mutedForeground;
          }),
          trackColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return AppColors.primary;
            }
            return AppColors.muted;
          }),
          trackOutlineColor: WidgetStateProperty.all(Colors.transparent),
        ),

        // Popup Menu
        popupMenuTheme: PopupMenuThemeData(
          color: AppColors.surface,
          elevation: 8,
          shadowColor: AppColors.foreground.withValues(alpha: 0.15),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppColors.radius),
          ),
          textStyle: AppTypography.bodyMedium,
        ),

        // Tooltip
        tooltipTheme: TooltipThemeData(
          decoration: BoxDecoration(
            color: AppColors.foreground,
            borderRadius: BorderRadius.circular(AppColors.radiusSm),
          ),
          textStyle: AppTypography.caption.copyWith(
            color: AppColors.background,
          ),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        ),

        // Icon
        iconTheme: const IconThemeData(
          color: AppColors.foreground,
          size: 24,
        ),

        // Extensions
        extensions: const [
          _AppColorsExtension.light,
        ],
      );

  // ═══════════════════════════════════════════════════════
  // DARK THEME
  // ═══════════════════════════════════════════════════════

  static ThemeData get dark => ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        fontFamily: AppTypography.fontFamily,

        colorScheme: ColorScheme.fromSeed(
          seedColor: AppColors.primary,
          brightness: Brightness.dark,
          primary: AppColors.primaryLight,
          onPrimary: AppColors.darkBackground,
          secondary: AppColors.secondaryLight,
          onSecondary: AppColors.darkBackground,
          tertiary: AppColors.accentLight,
          error: AppColors.error,
          surface: AppColors.darkSurface,
          onSurface: AppColors.darkForeground,
          surfaceContainerHighest: AppColors.darkMuted,
          outline: AppColors.darkBorder,
        ),

        scaffoldBackgroundColor: AppColors.darkBackground,

        appBarTheme: AppBarTheme(
          backgroundColor: AppColors.darkSurface,
          foregroundColor: AppColors.darkForeground,
          elevation: 0,
          scrolledUnderElevation: 2,
          surfaceTintColor: Colors.transparent,
          shadowColor: Colors.black.withValues(alpha: 0.3),
          systemOverlayStyle: SystemUiOverlayStyle.light,
          centerTitle: false,
          titleTextStyle: TextStyle(
            fontFamily: AppTypography.fontFamily,
            fontSize: 20,
            fontWeight: FontWeight.w600,
            color: AppColors.darkForeground,
            letterSpacing: -0.5,
          ),
        ),

        cardTheme: CardThemeData(
          color: AppColors.darkCard,
          elevation: 0,
          surfaceTintColor: Colors.transparent,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppColors.radiusLg),
          ),
          margin: EdgeInsets.zero,
        ),

        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primaryLight,
            foregroundColor: AppColors.darkBackground,
            elevation: 0,
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppColors.radius),
            ),
          ),
        ),

        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: AppColors.primaryLight,
            side: const BorderSide(color: AppColors.darkBorder, width: 1.5),
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppColors.radius),
            ),
          ),
        ),

        floatingActionButtonTheme: FloatingActionButtonThemeData(
          backgroundColor: AppColors.primaryLight,
          foregroundColor: AppColors.darkBackground,
          elevation: 4,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppColors.radiusLg),
          ),
        ),

        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: AppColors.darkSurface,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 14,
          ),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppColors.radius),
            borderSide: const BorderSide(color: AppColors.darkBorder, width: 1.5),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppColors.radius),
            borderSide: const BorderSide(color: AppColors.darkBorder, width: 1.5),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppColors.radius),
            borderSide: const BorderSide(color: AppColors.primaryLight, width: 2),
          ),
          hintStyle: AppTypography.bodyMedium.copyWith(
            color: AppColors.darkMutedForeground,
          ),
        ),

        navigationBarTheme: NavigationBarThemeData(
          backgroundColor: AppColors.darkSurface,
          elevation: 0,
          height: 72,
          indicatorColor: AppColors.primaryLight.withValues(alpha: 0.15),
          indicatorShape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppColors.radiusFull),
          ),
          labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
          labelTextStyle: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return AppTypography.labelSmall.copyWith(
                color: AppColors.primaryLight,
                fontWeight: FontWeight.w600,
              );
            }
            return AppTypography.labelSmall.copyWith(
              color: AppColors.darkMutedForeground,
              fontWeight: FontWeight.w500,
            );
          }),
          iconTheme: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return const IconThemeData(
                color: AppColors.primaryLight,
                size: 24,
              );
            }
            return const IconThemeData(
              color: AppColors.darkMutedForeground,
              size: 24,
            );
          }),
        ),

        dividerTheme: const DividerThemeData(
          color: AppColors.darkBorder,
          thickness: 1,
          space: 1,
        ),

        dialogTheme: DialogThemeData(
          backgroundColor: AppColors.darkSurface,
          elevation: 8,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppColors.radiusXl),
          ),
          titleTextStyle: AppTypography.h4.copyWith(
            color: AppColors.darkForeground,
          ),
        ),

        snackBarTheme: SnackBarThemeData(
          backgroundColor: AppColors.darkForeground,
          contentTextStyle: AppTypography.bodyMedium.copyWith(
            color: AppColors.darkBackground,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppColors.radius),
          ),
          behavior: SnackBarBehavior.floating,
        ),

        bottomSheetTheme: BottomSheetThemeData(
          backgroundColor: AppColors.darkSurface,
          elevation: 8,
          shape: const RoundedRectangleBorder(
            borderRadius: BorderRadius.vertical(
              top: Radius.circular(20),
            ),
          ),
          dragHandleColor: AppColors.darkMutedForeground.withValues(alpha: 0.4),
          dragHandleSize: const Size(40, 4),
          showDragHandle: true,
        ),

        popupMenuTheme: PopupMenuThemeData(
          color: AppColors.darkSurface,
          elevation: 8,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppColors.radius),
          ),
        ),

        extensions: const [
          _AppColorsExtension.dark,
        ],
      );
}

/// Theme extension for custom app colors
class _AppColorsExtension extends ThemeExtension<_AppColorsExtension> {
  const _AppColorsExtension({
    required this.success,
    required this.successLight,
    required this.warning,
    required this.warningLight,
    required this.info,
    required this.infoLight,
  });

  final Color success;
  final Color successLight;
  final Color warning;
  final Color warningLight;
  final Color info;
  final Color infoLight;

  static const light = _AppColorsExtension(
    success: AppColors.success,
    successLight: AppColors.successLight,
    warning: AppColors.warning,
    warningLight: AppColors.warningLight,
    info: AppColors.info,
    infoLight: AppColors.infoLight,
  );

  static const dark = _AppColorsExtension(
    success: AppColors.success,
    successLight: Color(0xFF064E3B),
    warning: AppColors.warning,
    warningLight: Color(0xFF78350F),
    info: AppColors.info,
    infoLight: Color(0xFF0C4A6E),
  );

  @override
  ThemeExtension<_AppColorsExtension> copyWith({
    Color? success,
    Color? successLight,
    Color? warning,
    Color? warningLight,
    Color? info,
    Color? infoLight,
  }) {
    return _AppColorsExtension(
      success: success ?? this.success,
      successLight: successLight ?? this.successLight,
      warning: warning ?? this.warning,
      warningLight: warningLight ?? this.warningLight,
      info: info ?? this.info,
      infoLight: infoLight ?? this.infoLight,
    );
  }

  @override
  ThemeExtension<_AppColorsExtension> lerp(
    covariant ThemeExtension<_AppColorsExtension>? other,
    double t,
  ) {
    if (other is! _AppColorsExtension) return this;
    return _AppColorsExtension(
      success: Color.lerp(success, other.success, t)!,
      successLight: Color.lerp(successLight, other.successLight, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      warningLight: Color.lerp(warningLight, other.warningLight, t)!,
      info: Color.lerp(info, other.info, t)!,
      infoLight: Color.lerp(infoLight, other.infoLight, t)!,
    );
  }
}
