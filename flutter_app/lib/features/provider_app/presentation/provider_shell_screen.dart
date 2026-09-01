import 'package:flutter/material.dart';

import '../../../repositories/demo_repository.dart';
import '../../../widgets/native_tab_scaffold.dart';
import '../../../widgets/swiper_bottom_nav.dart';
import 'provider_dashboard_screen.dart';
import 'provider_earnings_screen.dart';
import 'provider_jobs_screen.dart';
import 'provider_profile_demo_screen.dart';

class ProviderShellScreen extends StatefulWidget {
  const ProviderShellScreen({super.key, required this.repository});

  final DemoRepository repository;

  @override
  State<ProviderShellScreen> createState() => _ProviderShellScreenState();
}

class _ProviderShellScreenState extends State<ProviderShellScreen> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    final pages = [
      ProviderDashboardScreen(
        repository: widget.repository,
        onNavigateToTab: (index) => setState(() => _currentIndex = index),
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
      onTabSelected: (index) => setState(() => _currentIndex = index),
    );
  }
}
