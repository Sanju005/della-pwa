import 'package:flutter/material.dart';

import '../../../repositories/demo_repository.dart';
import '../../../widgets/native_tab_scaffold.dart';
import '../../../widgets/swiper_bottom_nav.dart';
import '../../booking/presentation/booking_overview_screen.dart';
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
      BookingOverviewScreen(
        repository: widget.repository,
        embedded: true,
        activeOnly: true,
      ),
      ProfileDemoScreen(repository: widget.repository),
    ];

    const titles = ['Home', 'Bookings', 'Ongoing Task', 'Profile'];
    const subtitles = [
      'Discover providers',
      'All tasks with filters',
      'Pending and ongoing tasks',
      'Account and rewards',
    ];

    return NativeTabScaffold(
      currentIndex: _currentIndex,
      title: titles[_currentIndex],
      subtitle: subtitles[_currentIndex],
      showAppBar: _currentIndex != 0,
      pages: pages,
      items: const [
        SwiperBottomNavItem(label: 'Home', icon: Icons.home_rounded),
        SwiperBottomNavItem(label: 'Bookings', icon: Icons.calendar_month_rounded),
        SwiperBottomNavItem(label: 'Ongoing', icon: Icons.task_alt_rounded),
        SwiperBottomNavItem(label: 'Profile', icon: Icons.person_outline_rounded),
      ],
      onTabSelected: (index) => setState(() => _currentIndex = index),
    );
  }
}
