import 'package:flutter/material.dart';

class AppMotion {
  const AppMotion._();

  static const Duration fast = Duration(milliseconds: 220);
  static const Duration normal = Duration(milliseconds: 320);
  static const Duration slow = Duration(milliseconds: 420);
  static const Duration stagger = Duration(milliseconds: 55);

  static const Curve enterCurve = Curves.easeOutCubic;
  static const Curve emphasizedCurve = Curves.easeInOutCubic;

  static bool reduceMotion(BuildContext context) {
    final mediaQuery = MediaQuery.maybeOf(context);
    if (mediaQuery == null) {
      return false;
    }
    return mediaQuery.disableAnimations || mediaQuery.accessibleNavigation;
  }

  static Duration resolveDuration(BuildContext context, Duration duration) {
    return reduceMotion(context) ? Duration.zero : duration;
  }

  static double resolveOffset(BuildContext context, double offset) {
    return reduceMotion(context) ? 0 : offset;
  }

  static double resolveScale(BuildContext context, double scale) {
    return reduceMotion(context) ? 1 : scale;
  }
}
