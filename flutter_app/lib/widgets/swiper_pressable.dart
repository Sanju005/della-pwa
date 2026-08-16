import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class SwiperPressable extends StatefulWidget {
  const SwiperPressable({
    super.key,
    required this.child,
    this.onTap,
    this.onLongPress,
    this.borderRadius,
    this.padding,
    this.alignment,
    this.backgroundColor,
    this.enableHaptics = false,
  });

  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final BorderRadius? borderRadius;
  final EdgeInsetsGeometry? padding;
  final AlignmentGeometry? alignment;
  final Color? backgroundColor;
  final bool enableHaptics;

  @override
  State<SwiperPressable> createState() => _SwiperPressableState();
}

class _SwiperPressableState extends State<SwiperPressable> {
  bool _pressed = false;

  void _setPressed(bool value) {
    if (_pressed == value) {
      return;
    }

    setState(() => _pressed = value);
  }

  Future<void> _handleTap() async {
    if (widget.enableHaptics) {
      await HapticFeedback.selectionClick();
    }
    widget.onTap?.call();
  }

  @override
  Widget build(BuildContext context) {
    final radius = widget.borderRadius ?? BorderRadius.circular(18);

    return AnimatedScale(
      duration: const Duration(milliseconds: 110),
      scale: _pressed ? 0.985 : 1,
      curve: Curves.easeOut,
      child: AnimatedOpacity(
        duration: const Duration(milliseconds: 110),
        opacity: _pressed ? 0.94 : 1,
        curve: Curves.easeOut,
        child: Material(
          color: widget.backgroundColor ?? Colors.transparent,
          borderRadius: radius,
          child: InkWell(
            onTap: widget.onTap == null ? null : _handleTap,
            onLongPress: widget.onLongPress,
            onHighlightChanged: _setPressed,
            borderRadius: radius,
            splashFactory: InkRipple.splashFactory,
            child: Container(
              alignment: widget.alignment,
              padding: widget.padding,
              child: widget.child,
            ),
          ),
        ),
      ),
    );
  }
}
