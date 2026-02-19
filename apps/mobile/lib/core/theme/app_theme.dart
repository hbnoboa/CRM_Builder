import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:crm_mobile/core/theme/app_colors.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:crm_mobile/core/theme/theme_generator.dart';

/// Modern ThemeData for the CRM Builder mobile app.
class AppTheme {
  AppTheme._();

  /// Generate ThemeData from dynamic tenant colors.
  static ThemeData fromColors(TenantThemeColors c) => _buildTheme(
        primary: c.primary,
        primaryForeground: c.primaryForeground,
        secondary: c.secondary,
        accent: c.accent,
        background: c.background,
        foreground: c.foreground,
        card: c.card,
        cardForeground: c.cardForeground,
        surface: c.surface,
        surfaceVariant: c.surfaceVariant,
        muted: c.muted,
        mutedForeground: c.mutedForeground,
        border: c.border,
        ring: c.ring,
        destructive: c.destructive,
        destructiveForeground: c.destructiveForeground,
      );

  static ThemeData get light => _buildTheme(
        primary: AppColors.primary,
        primaryForeground: AppColors.primaryForeground,
        secondary: AppColors.secondary,
        accent: AppColors.accent,
        background: AppColors.background,
        foreground: AppColors.foreground,
        card: AppColors.card,
        cardForeground: AppColors.cardForeground,
        surface: AppColors.surface,
        surfaceVariant: AppColors.surfaceVariant,
        muted: AppColors.muted,
        mutedForeground: AppColors.mutedForeground,
        border: AppColors.border,
        ring: AppColors.ring,
        destructive: AppColors.destructive,
        destructiveForeground: AppColors.destructiveForeground,
      );

  static ThemeData _buildTheme({
    required Color primary,
    required Color primaryForeground,
    required Color secondary,
    required Color accent,
    required Color background,
    required Color foreground,
    required Color card,
    required Color cardForeground,
    required Color surface,
    required Color surfaceVariant,
    required Color muted,
    required Color mutedForeground,
    required Color border,
    required Color ring,
    required Color destructive,
    required Color destructiveForeground,
  }) =>
      ThemeData(
        useMaterial3: true,
        brightness: Brightness.light,
        fontFamily: AppTypography.fontFamily,

        // Color Scheme
        colorScheme: ColorScheme.fromSeed(
          seedColor: primary,
          brightness: Brightness.light,
          primary: primary,
          onPrimary: primaryForeground,
          secondary: secondary,
          onSecondary: primaryForeground,
          tertiary: accent,
          error: destructive,
          surface: surface,
          onSurface: foreground,
          surfaceContainerHighest: muted,
          outline: border,
        ),

        scaffoldBackgroundColor: background,

        // AppBar
        appBarTheme: AppBarTheme(
          backgroundColor: surface,
          foregroundColor: foreground,
          elevation: 0,
          scrolledUnderElevation: 2,
          surfaceTintColor: Colors.transparent,
          shadowColor: foreground.withValues(alpha: 0.1),
          systemOverlayStyle: SystemUiOverlayStyle.dark,
          centerTitle: false,
          titleTextStyle: TextStyle(
            fontFamily: AppTypography.fontFamily,
            fontSize: 20,
            fontWeight: FontWeight.w600,
            color: foreground,
            letterSpacing: -0.5,
          ),
          iconTheme: IconThemeData(
            color: foreground,
            size: 24,
          ),
        ),

        // Card
        cardTheme: CardThemeData(
          color: card,
          elevation: 0,
          shadowColor: Colors.transparent,
          surfaceTintColor: Colors.transparent,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppColors.radiusLg),
          ),
          margin: EdgeInsets.zero,
          clipBehavior: Clip.antiAlias,
        ),

        // Elevated Button
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: primary,
            foregroundColor: primaryForeground,
            elevation: 0,
            shadowColor: primary.withValues(alpha: 0.3),
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
            backgroundColor: primary,
            foregroundColor: primaryForeground,
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppColors.radius),
            ),
          ),
        ),

        // Outlined Button
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: primary,
            side: BorderSide(color: border, width: 1.5),
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
            foregroundColor: primary,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppColors.radius),
            ),
            textStyle: AppTypography.button,
          ),
        ),

        // FAB
        floatingActionButtonTheme: FloatingActionButtonThemeData(
          backgroundColor: primary,
          foregroundColor: primaryForeground,
          elevation: 4,
          focusElevation: 6,
          hoverElevation: 8,
          highlightElevation: 6,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppColors.radiusLg),
          ),
          extendedTextStyle: AppTypography.labelLarge.copyWith(
            fontWeight: FontWeight.w600,
            color: primaryForeground,
          ),
        ),

        // Input
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: surface,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 14,
          ),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppColors.radius),
            borderSide: BorderSide(color: border, width: 1.5),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppColors.radius),
            borderSide: BorderSide(color: border, width: 1.5),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppColors.radius),
            borderSide: BorderSide(color: primary, width: 2),
          ),
          errorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppColors.radius),
            borderSide: BorderSide(color: destructive, width: 1.5),
          ),
          focusedErrorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppColors.radius),
            borderSide: BorderSide(color: destructive, width: 2),
          ),
          hintStyle: AppTypography.bodyMedium.copyWith(
            color: mutedForeground,
          ),
          labelStyle: AppTypography.labelLarge.copyWith(
            color: foreground,
          ),
          prefixIconColor: mutedForeground,
          suffixIconColor: mutedForeground,
        ),

        // Navigation Bar (Bottom)
        navigationBarTheme: NavigationBarThemeData(
          backgroundColor: surface,
          elevation: 0,
          height: 72,
          indicatorColor: primary.withValues(alpha: 0.12),
          indicatorShape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppColors.radiusFull),
          ),
          labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
          labelTextStyle: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return AppTypography.labelSmall.copyWith(
                color: primary,
                fontWeight: FontWeight.w600,
              );
            }
            return AppTypography.labelSmall.copyWith(
              color: mutedForeground,
              fontWeight: FontWeight.w500,
            );
          }),
          iconTheme: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return IconThemeData(
                color: primary,
                size: 24,
              );
            }
            return IconThemeData(
              color: mutedForeground,
              size: 24,
            );
          }),
        ),

        // Divider
        dividerTheme: DividerThemeData(
          color: border,
          thickness: 1,
          space: 1,
        ),

        // Chip
        chipTheme: ChipThemeData(
          backgroundColor: surfaceVariant,
          labelStyle: AppTypography.labelMedium.copyWith(
            color: foreground,
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
          backgroundColor: surface,
          elevation: 8,
          shadowColor: foreground.withValues(alpha: 0.15),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppColors.radiusXl),
          ),
          titleTextStyle: AppTypography.h4.copyWith(
            color: foreground,
          ),
          contentTextStyle: AppTypography.bodyMedium.copyWith(
            color: mutedForeground,
          ),
        ),

        // SnackBar
        snackBarTheme: SnackBarThemeData(
          backgroundColor: foreground,
          contentTextStyle: AppTypography.bodyMedium.copyWith(
            color: background,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppColors.radius),
          ),
          behavior: SnackBarBehavior.floating,
          elevation: 4,
        ),

        // Bottom Sheet
        bottomSheetTheme: BottomSheetThemeData(
          backgroundColor: surface,
          elevation: 8,
          shadowColor: foreground.withValues(alpha: 0.15),
          shape: const RoundedRectangleBorder(
            borderRadius: BorderRadius.vertical(
              top: Radius.circular(20),
            ),
          ),
          dragHandleColor: mutedForeground.withValues(alpha: 0.4),
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
          selectedTileColor: primary.withValues(alpha: 0.08),
        ),

        // Progress Indicator
        progressIndicatorTheme: ProgressIndicatorThemeData(
          color: primary,
          linearTrackColor: muted,
          circularTrackColor: muted,
        ),

        // Switch
        switchTheme: SwitchThemeData(
          thumbColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return primaryForeground;
            }
            return mutedForeground;
          }),
          trackColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return primary;
            }
            return muted;
          }),
          trackOutlineColor: WidgetStateProperty.all(Colors.transparent),
        ),

        // Popup Menu
        popupMenuTheme: PopupMenuThemeData(
          color: surface,
          elevation: 8,
          shadowColor: foreground.withValues(alpha: 0.15),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppColors.radius),
          ),
          textStyle: AppTypography.bodyMedium,
        ),

        // Tooltip
        tooltipTheme: TooltipThemeData(
          decoration: BoxDecoration(
            color: foreground,
            borderRadius: BorderRadius.circular(AppColors.radiusSm),
          ),
          textStyle: AppTypography.caption.copyWith(
            color: background,
          ),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        ),

        // Icon
        iconTheme: IconThemeData(
          color: foreground,
          size: 24,
        ),
      );
}
