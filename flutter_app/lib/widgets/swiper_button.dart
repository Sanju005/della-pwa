import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';
import 'package:animations/animations.dart';

import '../core/animation/app_motion.dart';
import '../previews/widget_preview_helpers.dart';
import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';
import 'pressable_scale.dart';

class SwiperButton extends StatelessWidget {
  const SwiperButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.isSecondary = false,
    this.isLoading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final Widget? icon;
  final bool isSecondary;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    final spinnerColor = isSecondary ? AppColors.primary : Colors.white;
    final child = SizedBox(
      height: 22,
      child: PageTransitionSwitcher(
        duration: AppMotion.resolveDuration(context, AppMotion.fast),
        reverse: false,
        transitionBuilder: (child, primaryAnimation, secondaryAnimation) {
          if (AppMotion.reduceMotion(context)) {
            return child;
          }
          return FadeThroughTransition(
            animation: primaryAnimation,
            secondaryAnimation: secondaryAnimation,
            fillColor: Colors.transparent,
            child: child,
          );
        },
        child: isLoading
            ? SizedBox(
                key: const ValueKey('loading'),
                height: 20,
                width: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2.4,
                  valueColor: AlwaysStoppedAnimation<Color>(spinnerColor),
                ),
              )
            : Row(
                key: const ValueKey('label'),
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (icon != null) ...[
                    icon!,
                    const SizedBox(width: AppSpacing.xs),
                  ],
                  Text(label),
                ],
              ),
      ),
    );

    if (isSecondary) {
      return OutlinedButton(
        onPressed: isLoading ? null : onPressed,
        child: child,
      );
    }

    return PressableScale(
      enabled: onPressed != null && !isLoading,
      child: ElevatedButton(
        onPressed: isLoading ? null : onPressed,
        style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
        child: child,
      ),
    );
  }
}

@Preview(name: 'Primary', size: Size(320, 120), wrapper: previewSurface)
Widget swiperButtonPrimaryPreview() {
  return SwiperButton(
    label: 'Book chef now',
    icon: const Icon(Icons.restaurant_menu_rounded),
    onPressed: () {},
  );
}

@Preview(
  name: 'Loading Secondary',
  size: Size(320, 120),
  wrapper: previewSurface,
)
Widget swiperButtonSecondaryPreview() {
  return const SwiperButton(
    label: 'Checking availability',
    isSecondary: true,
    isLoading: true,
  );
}
