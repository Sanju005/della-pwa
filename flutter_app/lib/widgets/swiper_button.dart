import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';

import '../previews/widget_preview_helpers.dart';
import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';

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
    final child = AnimatedSwitcher(
      duration: const Duration(milliseconds: 180),
      child: isLoading
          ? const SizedBox(
              key: ValueKey('loading'),
              height: 20,
              width: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2.4,
                valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
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
    );

    if (isSecondary) {
      return OutlinedButton(
        onPressed: isLoading ? null : onPressed,
        child: child,
      );
    }

    return ElevatedButton(
      onPressed: isLoading ? null : onPressed,
      style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
      child: child,
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
