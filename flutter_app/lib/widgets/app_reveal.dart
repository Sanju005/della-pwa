import 'dart:async';

import 'package:flutter/material.dart';

import '../core/animation/app_motion.dart';

class AppReveal extends StatefulWidget {
  const AppReveal({
    super.key,
    required this.child,
    this.delay = Duration.zero,
    this.duration = AppMotion.normal,
    this.curve = AppMotion.enterCurve,
    this.beginOffset = const Offset(0, 0.05),
    this.beginScale = 1,
  });

  final Widget child;
  final Duration delay;
  final Duration duration;
  final Curve curve;
  final Offset beginOffset;
  final double beginScale;

  @override
  State<AppReveal> createState() => _AppRevealState();
}

class _AppRevealState extends State<AppReveal> {
  bool _visible = false;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }
      if (widget.delay == Duration.zero) {
        setState(() => _visible = true);
        return;
      }
      _timer = Timer(widget.delay, () {
        if (mounted) {
          setState(() => _visible = true);
        }
      });
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (AppMotion.reduceMotion(context)) {
      return widget.child;
    }

    final duration = AppMotion.resolveDuration(context, widget.duration);
    final offset = Offset(
      AppMotion.resolveOffset(context, widget.beginOffset.dx),
      AppMotion.resolveOffset(context, widget.beginOffset.dy),
    );
    final scale = AppMotion.resolveScale(context, widget.beginScale);

    return AnimatedOpacity(
      duration: duration,
      curve: widget.curve,
      opacity: _visible ? 1 : 0,
      child: AnimatedSlide(
        duration: duration,
        curve: widget.curve,
        offset: _visible ? Offset.zero : offset,
        child: AnimatedScale(
          duration: duration,
          curve: widget.curve,
          scale: _visible ? 1 : scale,
          child: widget.child,
        ),
      ),
    );
  }
}
