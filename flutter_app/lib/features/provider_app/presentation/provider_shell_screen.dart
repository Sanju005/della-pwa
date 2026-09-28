import 'package:flutter/material.dart';

import '../../../repositories/demo_repository.dart';
import '../../../widgets/native_tab_scaffold.dart';
import '../../../widgets/swiper_bottom_nav.dart';
import 'provider_dashboard_screen.dart';
import 'provider_earnings_screen.dart';
import 'provider_jobs_screen.dart';
import 'provider_profile_demo_screen.dart';

class ProviderShellScreen extends StatefulWidget {
  const ProviderShellScreen({
    super.key,
    required this.repository,
    this.initialIndex = 0,
  });

  final DemoRepository repository;

  /// Which bottom-nav tab to land on. Defaults to Home (0) so every
  /// existing call site is unaffected; a notification deep link can pass
  /// 1 (Bookings) or 2 (Payments) to open a specific tab directly.
  final int initialIndex;

  @override
  State<ProviderShellScreen> createState() => _ProviderShellScreenState();
}

class _ProviderShellScreenState extends State<ProviderShellScreen> {
  late int _currentIndex = widget.initialIndex;
  final _dashboardKey = GlobalKey<ProviderDashboardScreenState>();

  void _selectTab(int index) {
    final enteringHome = index == 0 && _currentIndex != 0;
    setState(() => _currentIndex = index);
    // The Dashboard tab is kept alive in the background (its own 30s timer
    // already keeps it eventually consistent), but switching back to it
    // right after editing something elsewhere (e.g. your name on the
    // Profile tab) should show the update immediately, not up to 30s late.
    if (enteringHome) {
      _dashboardKey.currentState?.refresh();
    }
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      ProviderDashboardScreen(
        key: _dashboardKey,
        repository: widget.repository,
        onNavigateToTab: (index) => _selectTab(index),
      ),
      ProviderJobsScreen(repository: widget.repository),
      const ProviderEarningsScreen(),
      ProviderProfileDemoScreen(repository: widget.repository),
    ];

    const titles = ['Home', 'Bookings', 'Payments', 'Profile'];
    const subtitles = [
      'Provider workspace',
      'Incoming requests and active jobs',
      'Ledger and provider earnings',
      'Provider identity and listing',
    ];

    return NativeTabScaffold(
      currentIndex: _currentIndex,
      title: titles[_currentIndex],
      subtitle: subtitles[_currentIndex],
      pages: pages,
      showAppBar: _currentIndex != 0 && _currentIndex != 2,
      items: const [
        SwiperBottomNavItem(label: 'Home', icon: Icons.home_work_rounded),
        SwiperBottomNavItem(
          label: 'Bookings',
          icon: Icons.calendar_month_rounded,
        ),
        SwiperBottomNavItem(
          label: 'Payments',
          icon: Icons.account_balance_rounded,
        ),
        SwiperBottomNavItem(label: 'Profile', icon: Icons.person_rounded),
      ],
      onTabSelected: _selectTab,
    );
  }
}
