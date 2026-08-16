import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/routing/app_routes.dart';
import '../../../repositories/demo_repository.dart';
import '../../../widgets/swiper_app_bar.dart';
import '../../../widgets/swiper_bottom_nav.dart';
import 'provider_dashboard_screen.dart';
import 'provider_earnings_screen.dart';
import 'provider_jobs_screen.dart';
import 'provider_profile_demo_screen.dart';

class ProviderShellScreen extends StatefulWidget {
  const ProviderShellScreen({
    super.key,
    required this.repository,
  });

  final DemoRepository repository;

  @override
  State<ProviderShellScreen> createState() => _ProviderShellScreenState();
}

class _ProviderShellScreenState extends State<ProviderShellScreen> {
  int _currentIndex = 0;

  Future<void> _logOut() async {
    await Supabase.instance.client.auth.signOut();
    if (!mounted) {
      return;
    }
    Navigator.of(context).pushNamedAndRemoveUntil(
      AppRoutes.login,
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      ProviderDashboardScreen(repository: widget.repository),
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

    return Scaffold(
      appBar: SwiperAppBar(
        title: titles[_currentIndex],
        subtitle: subtitles[_currentIndex],
        showBack: true,
        actions: [
          IconButton(
            tooltip: 'Log Out',
            onPressed: _logOut,
            icon: const Icon(Icons.logout_rounded),
          ),
        ],
      ),
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 220),
        child: KeyedSubtree(
          key: ValueKey(_currentIndex),
          child: pages[_currentIndex],
        ),
      ),
      bottomNavigationBar: SwiperBottomNav(
        currentIndex: _currentIndex,
        items: const [
          SwiperBottomNavItem(label: 'Home', icon: Icons.home_work_rounded),
          SwiperBottomNavItem(label: 'Bookings', icon: Icons.calendar_month_rounded),
          SwiperBottomNavItem(label: 'Payments', icon: Icons.payments_rounded),
          SwiperBottomNavItem(label: 'Profile', icon: Icons.badge_outlined),
        ],
        onTap: (index) => setState(() => _currentIndex = index),
      ),
    );
  }
}
