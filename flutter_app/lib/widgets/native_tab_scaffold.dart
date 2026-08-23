import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/app_colors.dart';
import 'swiper_app_bar.dart';
import 'swiper_bottom_nav.dart';

class NativeTabScaffold extends StatelessWidget {
  const NativeTabScaffold({
    super.key,
    required this.currentIndex,
    required this.onTabSelected,
    required this.pages,
    required this.items,
    required this.title,
    required this.subtitle,
    this.actions,
    this.showAppBar = true,
  });

  final int currentIndex;
  final ValueChanged<int> onTabSelected;
  final List<Widget> pages;
  final List<SwiperBottomNavItem> items;
  final String title;
  final String subtitle;
  final List<Widget>? actions;
  final bool showAppBar;

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
        statusBarBrightness: Brightness.light,
        systemNavigationBarColor: AppColors.background,
        systemNavigationBarIconBrightness: Brightness.dark,
      ),
      child: PopScope(
        canPop: currentIndex == 0,
        onPopInvokedWithResult: (didPop, result) {
          if (!didPop && currentIndex != 0) {
            onTabSelected(0);
          }
        },
        child: Scaffold(
          appBar: showAppBar
              ? SwiperAppBar(
                  title: title,
                  subtitle: subtitle,
                  actions: actions,
                )
              : null,
          body: IndexedStack(
            index: currentIndex,
            children: pages,
          ),
          bottomNavigationBar: SwiperBottomNav(
            currentIndex: currentIndex,
            items: items,
            onTap: onTabSelected,
          ),
        ),
      ),
    );
  }
}
