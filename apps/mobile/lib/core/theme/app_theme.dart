import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:crm_mobile/core/theme/app_colors.dart';
import 'package:crm_mobile/core/theme/app_colors_extension.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:crm_mobile/core/theme/theme_generator.dart';

/// Modern ThemeData for the CRM Builder mobile app.
/// Mirrors the web-admin theme system.
class AppTheme {
  AppTheme._();

  /// Generate ThemeData from dynamic tenant colors.
  static ThemeData fromColors(TenantThemeColors c) => _buildTheme(
        brightness: Brightness.light,
        primary: c.primary,
        onPrimary: c.primaryForeground,
        secondary: c.secondary,
        background: c.background,
        surface: c.surface,
        onSurface: c.foreground,
        colorsExtension: AppColorsExtension(
          muted: c.muted,
          mutedForeground: c.mutedForeground,
          card: c.card,
          cardForeground: c.cardForeground,
          border: c.border,
          input: c.input,
          ring: c.ring,
          destructive: c.destructive,
          destructiveForeground: c.destructiveForeground,
          success: const Color(0xFF10B981),
          successForeground: const Color(0xFFFFFFFF),
          warning: const Color(0xFFF59E0B),
          warningForeground: const Color(0xFFFFFFFF),
          info: const Color(0xFF0EA5E9),
          infoForeground: const Color(0xFFFFFFFF),
        ),
      );

  /// Default light theme
  static ThemeData get light => _buildTheme(
        brightness: Brightness.light,
        primary: AppColors.primary,
        onPrimary: AppColors.primaryForeground,
        secondary: AppColors.secondary,
        background: AppColors.background,
        surface: AppColors.surface,
        onSurface: AppColors.foreground,
        colorsExtension: AppColorsExtension.light,
      );

  /// Default dark theme
  static ThemeData get dark => _buildTheme(
        brightness: Brightness.dark,
        primary: const Color(0xFF60A5FA),
        onPrimary: const Color(0xFF0F172A),
        secondary: const Color(0xFF334155),
        background: const Color(0xFF0F172A),
        surface: const Color(0xFF1E293B),
        onSurface: const Color(0xFFF8FAFC),
        colorsExtension: AppColorsExtension.dark,
      );

  static ThemeData _buildTheme({
    required Brightness brightness,
    required Color primary,
    required Color onPrimary,
    required Color secondary,
    required Color background,
    required Color surface,
    required Color onSurface,
    required AppColorsExtension colorsExtension,
  }) {
    final isLight = brightness == Brightness.light;

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      fontFamily: AppTypography.fontFamily,

      // Extensions
      extensions: [colorsExtension],

      // Color Scheme
      colorScheme: ColorScheme(
        brightness: brightness,
        primary: primary,
        onPrimary: onPrimary,
        secondary: secondary,
        onSecondary: onPrimary,
        error: colorsExtension.destructive,
        onError: colorsExtension.destructiveForeground,
        surface: surface,
        onSurface: onSurface,
        surfaceContainerHighest: colorsExtension.muted,
        outline: colorsExtension.border,
      ),

      scaffoldBackgroundColor: background,
      cardColor: colorsExtension.card,
      dividerColor: colorsExtension.border,

      // AppBar
      appBarTheme: AppBarTheme(
        backgroundColor: surface,
        foregroundColor: onSurface,
        elevation: 0,
        scrolledUnderElevation: 1,
        surfaceTintColor: Colors.transparent,
        shadowColor: onSurface.withValues(alpha: 0.1),
        systemOverlayStyle: isLight
            ? SystemUiOverlayStyle.dark
            : SystemUiOverlayStyle.light,
        centerTitle: false,
        titleTextStyle: TextStyle(
          fontFamily: AppTypography.fontFamily,
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: onSurface,
          letterSpacing: -0.3,
        ),
        iconTheme: IconThemeData(color: onSurface, size: 24),
      ),

      // Card
      cardTheme: CardThemeData(
        color: colorsExtension.card,
        elevation: 0,
        shadowColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppColors.radiusLg),
          side: BorderSide(color: colorsExtension.border.withValues(alpha: 0.5)),
        ),
        margin: EdgeInsets.zero,
        clipBehavior: Clip.antiAlias,
      ),

      // Drawer
      drawerTheme: DrawerThemeData(
        backgroundColor: background,
        surfaceTintColor: Colors.transparent,
        shape: const RoundedRectangleBorder(),
      ),

      // Elevated Button
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: onPrimary,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppColors.radius),
          ),
          textStyle: AppTypography.button.copyWith(fontWeight: FontWeight.w600),
        ),
      ),

      // Filled Button
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: onPrimary,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppColors.radius),
          ),
        ),
      ),

      // Outlined Button
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: primary,
          side: BorderSide(color: colorsExtension.border, width: 1),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
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
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppColors.radius),
          ),
          textStyle: AppTypography.button,
        ),
      ),

      // FAB
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: primary,
        foregroundColor: onPrimary,
        elevation: 2,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppColors.radiusLg),
        ),
      ),

      // Input
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surface,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppColors.radius),
          borderSide: BorderSide(color: colorsExtension.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppColors.radius),
          borderSide: BorderSide(color: colorsExtension.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppColors.radius),
          borderSide: BorderSide(color: primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppColors.radius),
          borderSide: BorderSide(color: colorsExtension.destructive),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppColors.radius),
          borderSide: BorderSide(color: colorsExtension.destructive, width: 2),
        ),
        hintStyle: AppTypography.bodyMedium.copyWith(
          color: colorsExtension.mutedForeground,
        ),
        labelStyle: AppTypography.labelLarge.copyWith(color: onSurface),
        prefixIconColor: colorsExtension.mutedForeground,
        suffixIconColor: colorsExtension.mutedForeground,
      ),

      // Navigation Bar
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: surface,
        elevation: 0,
        height: 64,
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
            color: colorsExtension.mutedForeground,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return IconThemeData(color: primary, size: 24);
          }
          return IconThemeData(color: colorsExtension.mutedForeground, size: 24);
        }),
      ),

      // Divider
      dividerTheme: DividerThemeData(
        color: colorsExtension.border,
        thickness: 1,
        space: 1,
      ),

      // Chip
      chipTheme: ChipThemeData(
        backgroundColor: colorsExtension.muted,
        labelStyle: AppTypography.labelMedium.copyWith(
          color: onSurface,
          fontWeight: FontWeight.w500,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppColors.radiusFull),
        ),
        side: BorderSide.none,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      ),

      // Dialog
      dialogTheme: DialogThemeData(
        backgroundColor: colorsExtension.card,
        elevation: 4,
        shadowColor: onSurface.withValues(alpha: 0.1),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppColors.radiusLg),
        ),
        titleTextStyle: AppTypography.h4.copyWith(color: onSurface),
        contentTextStyle: AppTypography.bodyMedium.copyWith(
          color: colorsExtension.mutedForeground,
        ),
      ),

      // SnackBar
      snackBarTheme: SnackBarThemeData(
        backgroundColor: onSurface,
        contentTextStyle: AppTypography.bodyMedium.copyWith(color: surface),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppColors.radius),
        ),
        behavior: SnackBarBehavior.floating,
        elevation: 2,
      ),

      // Bottom Sheet
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: colorsExtension.card,
        elevation: 4,
        shadowColor: onSurface.withValues(alpha: 0.1),
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
        ),
        dragHandleColor: colorsExtension.mutedForeground.withValues(alpha: 0.4),
        dragHandleSize: const Size(40, 4),
        showDragHandle: true,
      ),

      // ListTile
      listTileTheme: ListTileThemeData(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16),
        minVerticalPadding: 8,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppColors.radius),
        ),
        tileColor: Colors.transparent,
        selectedTileColor: primary.withValues(alpha: 0.08),
        iconColor: colorsExtension.mutedForeground,
        textColor: onSurface,
      ),

      // Progress Indicator
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: primary,
        linearTrackColor: colorsExtension.muted,
        circularTrackColor: colorsExtension.muted,
      ),

      // Switch
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return onPrimary;
          return colorsExtension.mutedForeground;
        }),
        trackColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return primary;
          return colorsExtension.muted;
        }),
        trackOutlineColor: WidgetStateProperty.all(Colors.transparent),
      ),

      // Popup Menu
      popupMenuTheme: PopupMenuThemeData(
        color: colorsExtension.card,
        elevation: 4,
        shadowColor: onSurface.withValues(alpha: 0.1),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppColors.radius),
        ),
        textStyle: AppTypography.bodyMedium.copyWith(color: onSurface),
      ),

      // Tooltip
      tooltipTheme: TooltipThemeData(
        decoration: BoxDecoration(
          color: onSurface,
          borderRadius: BorderRadius.circular(AppColors.radiusSm),
        ),
        textStyle: AppTypography.caption.copyWith(color: surface),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      ),

      // Icon
      iconTheme: IconThemeData(color: onSurface, size: 24),
    );
  }
}
