import 'package:flutter/material.dart';

class AppColors {
  const AppColors._();

  // Brand primary
  static const primary = Color(0xFF645394);
  static const primaryDark = Color(0xFF4A3D6E);
  static const primaryLight = Color(0xFF9C8FC0);
  static const primarySurface = Color(0xFFF1ECFC);

  // Kept for existing call sites — same values as their new counterparts above.
  static const primaryDeep = primaryDark;
  static const primarySoft = primarySurface;

  // Neutral surfaces
  static const background = Color(0xFFF7F6FB);
  static const surface = Color(0xFFFFFFFF);
  static const surfaceSoft = Color(0xFFF4F1FA);
  static const surfaceMuted = surfaceSoft;

  // Text
  static const textPrimary = Color(0xFF1C1730);
  static const textSecondary = Color(0xFF6F6786);
  static const textMuted = Color(0xFF948CA6);

  // Lines
  static const border = Color(0xFFE7E1F4);
  static const divider = Color(0xFFEFEBF7);

  // Shadow
  static const shadow = Color(0x140F0B1F);

  // Disabled state
  static const disabled = Color(0xFFC9C2D8);

  // Status
  static const success = Color(0xFF1FA971);
  static const successSurface = Color(0xFFE3F6ED);
  static const warning = Color(0xFFF3A93B);
  static const warningSurface = Color(0xFFFCF0DC);
  static const error = Color(0xFFE45B66);
  static const errorSurface = Color(0xFFFBE8EA);
  static const info = Color(0xFF4C6FA5);
  static const infoSurface = Color(0xFFE7EEF7);

  // Shared purple gradients — consolidates the hero/card gradients
  // duplicated ad hoc across provider screens.
  static const gradientHeroStart = Color(0xFF1E1345);
  static const gradientHeroMid = Color(0xFF2E2065);
  static const gradientHeroEnd = Color(0xFF453384);
  static const gradientHeroBorder = Color(0xFF5C4C93);
  static const gradientCardStart = Color(0xFFFFFFFF);
  static const gradientCardEnd = Color(0xFFF6EFFD);
}
