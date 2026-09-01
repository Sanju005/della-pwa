import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'core/app_navigator.dart';
import 'core/routing/app_router.dart';
import 'core/routing/app_routes.dart';
import 'theme/app_theme.dart';

class SwiperApp extends StatelessWidget {
  const SwiperApp({super.key});

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
        statusBarBrightness: Brightness.light,
        systemNavigationBarColor: Colors.transparent,
        systemNavigationBarDividerColor: Colors.transparent,
        systemNavigationBarIconBrightness: Brightness.dark,
      ),
      child: MaterialApp(
        navigatorKey: rootNavigatorKey,
        title: 'Swiper Flutter Demo',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        initialRoute: AppRoutes.login,
        onGenerateRoute: AppRouter.onGenerateRoute,
      ),
    );
  }
}
