import 'package:flutter/material.dart';

import '../core/animation/app_motion.dart';

class PressableScale extends StatefulWidget {
  const PressableScale({
    super.key,
    required this.child,
    this.enabled = true,
    this.pressedScale = 0.97,
  });

  final Widget child;
  final bool enabled;
  final double pressedScale;

  @override
  State<PressableScale> createState() => _PressableScaleState();
}

class _PressableScaleState extends State<PressableScale> {
  bool _pressed = false;

  void _setPressed(bool value) {
    if (!widget.enabled || _pressed == value) {
      return;
    }
    setState(() => _pressed = value);
  }

  @override
  Widget build(BuildContext context) {
    final reducedMotion = AppMotion.reduceMotion(context);
    return Listener(
      onPointerDown: (_) => _setPressed(true),
      onPointerUp: (_) => _setPressed(false),
      onPointerCancel: (_) => _setPressed(false),
      child: AnimatedScale(
        duration: AppMotion.resolveDuration(context, AppMotion.fast),
        curve: AppMotion.emphasizedCurve,
        scale: !widget.enabled || reducedMotion
            ? 1
            : (_pressed ? widget.pressedScale : 1),
        child: widget.child,
      ),
    );
  }
}
