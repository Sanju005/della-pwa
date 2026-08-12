import 'package:flutter/material.dart';

import '../../../repositories/demo_repository.dart';
import '../../../widgets/swiper_app_bar.dart';
import '../../../widgets/swiper_bottom_nav.dart';
import '../../booking/presentation/booking_overview_screen.dart';
import '../../profile/presentation/messages_demo_screen.dart';
import '../../profile/presentation/profile_demo_screen.dart';
import 'customer_home_screen.dart';

class CustomerShellScreen extends StatefulWidget {
  const CustomerShellScreen({
    super.key,
    required this.repository,
  });

  final DemoRepository repository;

  @override
  State<CustomerShellScreen> createState() => _CustomerShellScreenState();
}

class _CustomerShellScreenState extends State<CustomerShellScreen> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    final pages = [
      CustomerHomeScreen(repository: widget.repository),
      BookingOverviewScreen(repository: widget.repository, embedded: true),
      MessagesDemoScreen(repository: widget.repository),
      ProfileDemoScreen(repository: widget.repository),
    ];

    const titles = ['Home', 'Bookings', 'Messages', 'Profile'];
    const subtitles = [
      'Discover providers',
      'Track your active jobs',
      'Stay in touch',
      'Account and rewards',
    ];

    return Scaffold(
      appBar: SwiperAppBar(
        title: titles[_currentIndex],
        subtitle: subtitles[_currentIndex],
        showBack: true,
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
          SwiperBottomNavItem(label: 'Home', icon: Icons.home_rounded),
          SwiperBottomNavItem(label: 'Bookings', icon: Icons.calendar_month_rounded),
          SwiperBottomNavItem(label: 'Messages', icon: Icons.chat_bubble_outline_rounded),
          SwiperBottomNavItem(label: 'Profile', icon: Icons.person_outline_rounded),
        ],
        onTap: (index) => setState(() => _currentIndex = index),
      ),
    );
  }
}
