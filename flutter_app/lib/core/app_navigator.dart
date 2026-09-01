import 'package:flutter/material.dart';

/// The app's single [MaterialApp] navigator key. Lets low-level services
/// (like the shared image picker, which has no widget of its own) show a
/// dialog or bottom sheet without every call site having to thread a
/// [BuildContext] through.
final GlobalKey<NavigatorState> rootNavigatorKey = GlobalKey<NavigatorState>();

/// The current top-most [BuildContext], if the app has finished its first
/// frame. Null very early during startup, before any route has mounted.
BuildContext? get rootNavigatorContext => rootNavigatorKey.currentContext;
