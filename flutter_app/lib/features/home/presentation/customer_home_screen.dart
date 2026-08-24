import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';

import '../../../core/animation/app_motion.dart';
import '../../../core/routing/app_routes.dart';
import '../../../models/notification_item.dart';
import '../../../models/provider_summary.dart';
import '../../../models/service_category.dart';
import '../../../previews/widget_preview_helpers.dart';
import '../../../repositories/demo_repository.dart';
import '../../../services/customer_account_service.dart';
import '../../../services/current_customer_service.dart';
import '../../../services/current_location_service.dart';
import '../../../services/customer_address_service.dart';
import '../../../services/provider_marketplace_service.dart';
import '../../../services/service_location_store.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/app_reveal.dart';
import '../../../widgets/address_live_map.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/notification_card.dart';
import '../../../widgets/provider_card.dart';
import '../../../widgets/provider_skeleton_card.dart';
import '../../../widgets/malaysia_state_autocomplete_field.dart';
import '../../../widgets/swiper_bottom_sheet.dart';
import '../../../widgets/swiper_button.dart';

class CustomerHomeScreen extends StatefulWidget {
  const CustomerHomeScreen({super.key, required this.repository});

  final DemoRepository repository;

  @override
  State<CustomerHomeScreen> createState() => _CustomerHomeScreenState();
}

class _CustomerHomeScreenState extends State<CustomerHomeScreen> {
  static const _marketplaceService = ProviderMarketplaceService();
  static const _currentCustomerService = CurrentCustomerService();
  static const _addressService = CustomerAddressService();
  static const _popularSections = <({String title, String serviceKey})>[
    (
      title: 'Popular chef nearby you',
      serviceKey: 'chef',
    ),
    (
      title: 'Popular electrician nearby you',
      serviceKey: 'electrician',
    ),
    (
      title: 'Popular maids nearby you',
      serviceKey: 'maid',
    ),
  ];

  static const Map<String, String> _categoryDescriptions = {
    'Chef': 'Home Cooking',
    'Maid': 'Cleaning Service',
    'Driver': 'Private Driver',
    'Tutor': 'Private Lessons',
    'Plumber': 'Fix & Repair',
    'Electrician': 'Installation & Repair',
  };

  ServiceLocationSelection? _selectedLocation;
  late List<NotificationItem> _notifications;
  bool _changingLocation = false;

  @override
  void initState() {
    super.initState();
    _selectedLocation = ServiceLocationStore.load();
    _notifications = widget.repository.getNotifications();
  }

  Future<void> _chooseLocation() async {
    List<CustomerAddressSummary> addresses = const [];
    try {
      addresses = await _addressService.fetchAddresses();
    } catch (error, stackTrace) {
      if (kDebugMode) {
        debugPrint('Fetch saved addresses failed: $error');
        debugPrintStack(stackTrace: stackTrace);
      }
    }
    if (!mounted) {
      return;
    }

    await SwiperBottomSheet.show<void>(
      context,
      title: 'Choose service location',
      subtitle:
          'Use a saved address or your current location before browsing providers.',
      child: StatefulBuilder(
        builder: (context, setSheetState) {
          Future<void> useCurrentLocation() async {
            setSheetState(() => _changingLocation = true);
            try {
              final result = await fetchCurrentLocation();
              final selection = ServiceLocationSelection(
                type: 'current',
                label: 'Current location',
                address: result.label,
                latitude: result.latitude,
                longitude: result.longitude,
              );
              await ServiceLocationStore.save(selection);
              if (!mounted) {
                return;
              }
              setState(() => _selectedLocation = selection);
              Navigator.of(context).pop();
            } catch (error, stackTrace) {
              if (kDebugMode) {
                debugPrint('Home current location failed: $error');
                debugPrintStack(stackTrace: stackTrace);
              }
              if (!mounted) {
                return;
              }
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                    error is Exception
                        ? error.toString().replaceFirst('Exception: ', '')
                        : 'Unable to use current location.',
                  ),
                ),
              );
            } finally {
              if (mounted) {
                setState(() => _changingLocation = false);
              }
            }
          }

          return Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (addresses.isNotEmpty) ...[
                for (final address in addresses) ...[
                  InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: () async {
                      final selection = ServiceLocationSelection(
                        type: 'saved',
                        label: address.label,
                        address: address.formattedAddress,
                        city: address.city,
                        state: address.state,
                        country: address.country,
                      );
                      await ServiceLocationStore.save(selection);
                      if (!mounted) {
                        return;
                      }
                      setState(() => _selectedLocation = selection);
                      Navigator.of(context).pop();
                    },
                    child: Container(
                      width: double.infinity,
                      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                      padding: const EdgeInsets.all(AppSpacing.md),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            address.label,
                            style: Theme.of(context)
                                .textTheme
                                .titleSmall
                                ?.copyWith(fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          Text(address.formattedAddress),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
              const SizedBox(height: AppSpacing.sm),
              OutlinedButton.icon(
                onPressed: () async {
                  final selection = await SwiperBottomSheet.show<ServiceLocationSelection>(
                    context,
                    title: 'Add new location',
                    subtitle:
                        'Save a new location with a map preview and use it immediately.',
                    child: const _AddLocationSheet(),
                  );
                  if (selection == null) {
                    return;
                  }
                  await ServiceLocationStore.save(selection);
                  if (!mounted) {
                    return;
                  }
                  setState(() => _selectedLocation = selection);
                  Navigator.of(context).pop();
                },
                icon: const Icon(Icons.add_location_alt_outlined),
                label: const Text('Add New Location'),
              ),
              SwiperButton(
                label: 'Use Current Location',
                isSecondary: true,
                isLoading: _changingLocation,
                onPressed: useCurrentLocation,
              ),
              const SizedBox(height: AppSpacing.sm),
              if (_selectedLocation != null)
                SwiperButton(
                  label: 'Clear selection',
                  isSecondary: true,
                  onPressed: () async {
                    await ServiceLocationStore.clear();
                    if (!mounted) {
                      return;
                    }
                    setState(() => _selectedLocation = null);
                    Navigator.of(context).pop();
                  },
                ),
            ],
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final categories = widget.repository.getCustomerCategories();

    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Color(0xFFF7F3FF),
            Colors.white,
          ],
        ),
      ),
      child: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                FutureBuilder<CurrentCustomerProfile?>(
                  future: _currentCustomerService.fetchCurrentCustomerProfile(),
                  builder: (context, snapshot) {
                    final customer = snapshot.data;
                    final firstName = customer?.firstName ?? 'Customer';
                    final fullName = customer?.fullName ?? 'Customer';
                    return AppReveal(
                      delay: const Duration(milliseconds: 40),
                      duration: AppMotion.normal,
                      beginOffset: const Offset(0, 0.04),
                      child: _HeroSection(
                        firstName: firstName,
                        fullName: fullName,
                        avatarUrl: customer?.avatarUrl ?? '',
                        unreadCount:
                            _notifications.where((item) => item.isUnread).length,
                        onNotificationsTap: () async {
                          if (!mounted) {
                            return;
                          }
                          await SwiperBottomSheet.show<void>(
                            context,
                            title: 'Notifications',
                            subtitle:
                                'Read your latest booking, provider, and account updates.',
                            child: _notifications.isEmpty
                                ? const EmptyState(
                                    title: 'No notifications yet',
                                    subtitle:
                                        'New updates will appear here when they arrive.',
                                    icon: Icons.notifications_none_rounded,
                                  )
                                : Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      for (
                                        var index = 0;
                                        index < _notifications.length;
                                        index++
                                      ) ...[
                                        NotificationCard(
                                          notification: _notifications[index],
                                          onTap: () {
                                            final item = _notifications[index];
                                            final targetRoute = item.targetRoute;
                                            setState(() {
                                              _notifications = [
                                                for (var i = 0;
                                                    i < _notifications.length;
                                                    i++)
                                                  NotificationItem(
                                                    title:
                                                        _notifications[i].title,
                                                    body: _notifications[i].body,
                                                    timeLabel:
                                                        _notifications[i].timeLabel,
                                                    isUnread: i == index
                                                        ? false
                                                        : _notifications[i].isUnread,
                                                    targetRoute: _notifications[i]
                                                        .targetRoute,
                                                    targetArgument:
                                                        _notifications[i]
                                                            .targetArgument,
                                                  ),
                                              ];
                                            });
                                            Navigator.of(context).pop();
                                            if (targetRoute != null && mounted) {
                                              Navigator.of(context).pushNamed(
                                                targetRoute,
                                                arguments: item.targetArgument,
                                              );
                                            }
                                          },
                                        ),
                                        if (index != _notifications.length - 1)
                                          const SizedBox(
                                            height: AppSpacing.sm,
                                          ),
                                      ],
                                    ],
                                  ),
                          );
                        },
                      ),
                    );
                  },
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.lg,
                    0,
                    AppSpacing.lg,
                    40,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      AppReveal(
                        delay: const Duration(milliseconds: 110),
                        duration: AppMotion.fast,
                        beginOffset: const Offset(0, 0),
                        child: Transform.translate(
                          offset: const Offset(0, -18),
                          child: _LocationCard(
                            selectedLocation: _selectedLocation,
                            onChangePressed: _chooseLocation,
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      _WalletBalanceCard(
                        balance: 128.40,
                        onTap: () => Navigator.of(
                          context,
                        ).pushNamed(AppRoutes.profilePayments),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      GridView.builder(
                        itemCount: math.min(categories.length, 6),
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        gridDelegate:
                            const SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: 3,
                              mainAxisSpacing: AppSpacing.sm,
                              crossAxisSpacing: AppSpacing.sm,
                              childAspectRatio: 0.72,
                            ),
                        itemBuilder: (context, index) {
                          final category = categories[index];
                          return AppReveal(
                            delay: Duration(
                              milliseconds: 150 + (index * 55),
                            ),
                            duration: AppMotion.normal,
                            beginOffset: const Offset(0, 0.05),
                            child: _ServiceTile(
                              category: category,
                              subtitle: _categoryDescriptions[category.label] ??
                                  'Trusted help',
                              onTap: () => Navigator.of(context).pushNamed(
                                AppRoutes.providers,
                                arguments: category.label.toLowerCase(),
                              ),
                            ),
                          );
                        },
                      ),
                      const SizedBox(height: AppSpacing.xl),
                      const _SafetyBanner(),
                      const SizedBox(height: AppSpacing.xl),
                      for (final section in _popularSections) ...[
                        _NearbyCategorySection(
                          title: section.title,
                          serviceKey: section.serviceKey,
                          locationSelection: _selectedLocation,
                          marketplaceService: _marketplaceService,
                        ),
                        const SizedBox(height: AppSpacing.xl),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HeroSection extends StatefulWidget {
  const _HeroSection({
    required this.firstName,
    required this.fullName,
    required this.avatarUrl,
    required this.unreadCount,
    required this.onNotificationsTap,
  });

  final String firstName;
  final String fullName;
  final String avatarUrl;
  final int unreadCount;
  final VoidCallback onNotificationsTap;

  @override
  State<_HeroSection> createState() => _HeroSectionState();
}

class _HeroSectionState extends State<_HeroSection>
    with SingleTickerProviderStateMixin {
  late final AnimationController _sunController;
  Timer? _greetingTimer;
  bool _isSunAnimating = false;

  @override
  void initState() {
    super.initState();
    _sunController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 8),
    );
    _greetingTimer = Timer.periodic(const Duration(minutes: 1), (_) {
      if (mounted) {
        setState(() {});
      }
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final shouldAnimate = !AppMotion.reduceMotion(context);
    if (shouldAnimate == _isSunAnimating) {
      return;
    }
    _isSunAnimating = shouldAnimate;
    if (shouldAnimate) {
      _sunController.repeat();
    } else {
      _sunController.stop();
      _sunController.value = 0;
    }
  }

  @override
  void dispose() {
    _greetingTimer?.cancel();
    _sunController.dispose();
    super.dispose();
  }

  _GreetingStyle _buildGreeting() {
    final hour = DateTime.now().hour;
    if (hour >= 3 && hour < 12) {
      return const _GreetingStyle(
        label: 'Good Morning',
        icon: Icons.wb_sunny_rounded,
        iconColor: Color(0xFFFFC94D),
        rotate: true,
      );
    }
    if (hour >= 12 && hour < 15) {
      return const _GreetingStyle(
        label: 'Good Afternoon',
        icon: Icons.sunny,
        iconColor: Color(0xFFFFB347),
        rotate: true,
      );
    }
    if (hour >= 15 && hour < 20) {
      return const _GreetingStyle(
        label: 'Good Evening',
        icon: Icons.wb_sunny_rounded,
        iconColor: Color(0xFFFFC94D),
        rotate: true,
      );
    }
    return const _GreetingStyle(
      label: 'What can we help with tonight?',
      icon: Icons.nightlight_round,
      iconColor: Color(0xFFB8C3FF),
      rotate: true,
    );
  }

  @override
  Widget build(BuildContext context) {
    final greeting = _buildGreeting();

    return Container(
      decoration: const BoxDecoration(
        borderRadius: BorderRadius.vertical(
          bottom: Radius.circular(36),
        ),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFF1A0F4E),
            Color(0xFF25125E),
            Color(0xFF431E86),
          ],
        ),
      ),
      child: Stack(
        children: [
          const Positioned(
            right: -80,
            top: 150,
            child: _HeroArc(size: 260, opacity: 0.22),
          ),
          const Positioned(
            right: -30,
            top: 190,
            child: _HeroArc(size: 180, opacity: 0.18),
          ),
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: const BorderRadius.vertical(
                  bottom: Radius.circular(36),
                ),
                gradient: RadialGradient(
                  center: const Alignment(-0.8, -0.9),
                  radius: 1.2,
                  colors: [
                    Colors.white.withValues(alpha: 0.08),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
          SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.sm,
                AppSpacing.lg,
                74,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Spacer(),
                    ],
                  ),
                  const SizedBox(height: 52),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Hello, ${widget.firstName}',
                          style:
                              Theme.of(context).textTheme.headlineLarge?.copyWith(
                                    color: Colors.white,
                                    fontSize: 38,
                                    height: 1.05,
                                  ),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      _IconBubble(
                        icon: Icons.notifications_none_rounded,
                        unreadCount: widget.unreadCount,
                        onTap: widget.onNotificationsTap,
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Flexible(
                        child: Text(
                          greeting.label,
                          maxLines: 1,
                          overflow: TextOverflow.visible,
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: greeting.label.length > 24 ? 21 : 28,
                            fontWeight: FontWeight.w600,
                            height: 1.1,
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      AnimatedBuilder(
                        animation: _sunController,
                        builder: (context, child) {
                          final glow = _isSunAnimating
                              ? 0.78 +
                                  (math.sin(_sunController.value * math.pi * 2) *
                                      0.18)
                              : 0.78;
                          return DecoratedBox(
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              boxShadow: [
                                BoxShadow(
                                  color: greeting.iconColor.withValues(
                                    alpha: glow.clamp(0.0, 1.0),
                                  ),
                                  blurRadius: 10,
                                  spreadRadius: 0.5,
                                ),
                              ],
                            ),
                            child: Transform.rotate(
                              angle: greeting.rotate && _isSunAnimating
                                  ? _sunController.value * math.pi * 2
                                  : 0,
                              child: child,
                            ),
                          );
                        },
                        child: Icon(
                          greeting.icon,
                          color: greeting.iconColor,
                          size: greeting.label.length > 24 ? 28 : 32,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _WalletBalanceCard extends StatelessWidget {
  const _WalletBalanceCard({
    required this.balance,
    required this.onTap,
  });

  final double balance;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(28),
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(28),
            gradient: const LinearGradient(
              colors: [
                Color(0xFF160C38),
                Color(0xFF432199),
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            border: Border.all(
              color: Colors.white.withValues(alpha: 0.18),
            ),
            boxShadow: const [
              BoxShadow(
                color: Color(0x332D1C66),
                blurRadius: 28,
                offset: Offset(0, 16),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Row(
              children: [
                Container(
                  width: 58,
                  height: 58,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.16),
                    ),
                  ),
                  child: const Icon(
                    Icons.account_balance_wallet_rounded,
                    color: Colors.white,
                    size: 28,
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Wallet Balance',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                            ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'RM ${balance.toStringAsFixed(2)}',
                        style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                              color: Colors.white,
                              fontSize: 30,
                              fontWeight: FontWeight.w900,
                            ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Tap to top up or manage your wallet.',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Colors.white.withValues(alpha: 0.86),
                              height: 1.4,
                            ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.14),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.chevron_right_rounded,
                    color: Colors.white,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _GreetingStyle {
  const _GreetingStyle({
    required this.label,
    required this.icon,
    required this.iconColor,
    required this.rotate,
  });

  final String label;
  final IconData icon;
  final Color iconColor;
  final bool rotate;
}

class _AddLocationSheet extends StatefulWidget {
  const _AddLocationSheet();

  @override
  State<_AddLocationSheet> createState() => _AddLocationSheetState();
}

class _AddLocationSheetState extends State<_AddLocationSheet> {
  static const _addressService = CustomerAddressService();

  final _formKey = GlobalKey<FormState>();
  final _labelController = TextEditingController();
  final _line1Controller = TextEditingController();
  final _line2Controller = TextEditingController();
  final _cityController = TextEditingController();
  final _stateController = TextEditingController();
  final _postcodeController = TextEditingController();
  final _countryController = TextEditingController(text: 'Malaysia');

  bool _saving = false;
  bool _loadingMap = false;
  double? _latitude;
  double? _longitude;
  String _mapLabel = 'Add a saved location, or pull your current position for the map.';

  @override
  void dispose() {
    _labelController.dispose();
    _line1Controller.dispose();
    _line2Controller.dispose();
    _cityController.dispose();
    _stateController.dispose();
    _postcodeController.dispose();
    _countryController.dispose();
    super.dispose();
  }

  Future<void> _useCurrentLocation() async {
    setState(() => _loadingMap = true);
    try {
      final result = await fetchCurrentLocation();
      if (!mounted) {
        return;
      }
      setState(() {
        _latitude = result.latitude;
        _longitude = result.longitude;
        _mapLabel = result.label;
        if (_line1Controller.text.trim().isEmpty) {
          _line1Controller.text = result.label;
        }
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            error is Exception
                ? error.toString().replaceFirst('Exception: ', '')
                : 'Unable to use current location.',
          ),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _loadingMap = false);
      }
    }
  }

  Future<void> _saveLocation() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    setState(() => _saving = true);
    try {
      final input = CustomerAddressInput(
        label: _labelController.text.trim(),
        line1: _line1Controller.text.trim(),
        line2: _line2Controller.text.trim(),
        city: _cityController.text.trim(),
        state: _stateController.text.trim(),
        postcode: _postcodeController.text.trim(),
        country: _countryController.text.trim(),
        isDefault: false,
      );
      await _addressService.saveAddress(input);
      if (!mounted) {
        return;
      }
      final selection = ServiceLocationSelection(
        type: 'saved',
        label: input.label,
        address: [
          input.line1,
          input.line2,
          [input.city, input.state, input.postcode]
              .where((item) => item.isNotEmpty)
              .join(', '),
          input.country,
        ].where((item) => item.isNotEmpty).join('\n'),
        city: input.city,
        state: input.state,
        country: input.country,
        latitude: _latitude,
        longitude: _longitude,
      );
      Navigator.of(context).pop(selection);
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            error is Exception
                ? error.toString().replaceFirst('Exception: ', '')
                : 'Unable to save location.',
          ),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(22),
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Color(0xFFF8F3FF),
                Color(0xFFEDE4FF),
              ],
            ),
            border: Border.all(color: const Color(0xFFE4D7F5)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.location_on_rounded,
                      color: AppColors.primary,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      _mapLabel,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: const Color(0xFF5C558D),
                          ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              Container(
                height: 120,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.7),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: const Color(0xFFE4D7F5)),
                ),
                child: Stack(
                  children: [
                    Positioned.fill(
                      child: CustomPaint(painter: _MapGridPainter()),
                    ),
                    const Center(
                      child: Icon(
                        Icons.place_rounded,
                        color: AppColors.primary,
                        size: 38,
                      ),
                    ),
                    if (_latitude != null && _longitude != null)
                      Positioned(
                        left: 12,
                        right: 12,
                        bottom: 12,
                        child: Text(
                          'Lat ${_latitude!.toStringAsFixed(5)}, Lng ${_longitude!.toStringAsFixed(5)}',
                          style: Theme.of(context).textTheme.labelMedium?.copyWith(
                                color: const Color(0xFF5C558D),
                              ),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              SwiperButton(
                label: _loadingMap ? 'Loading map...' : 'Use Current Location On Map',
                isSecondary: true,
                isLoading: _loadingMap,
                onPressed: _loadingMap ? null : _useCurrentLocation,
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        Form(
          key: _formKey,
          child: Column(
            children: [
              TextFormField(
                controller: _labelController,
                decoration: const InputDecoration(labelText: 'Label'),
                validator: (value) =>
                    (value == null || value.trim().isEmpty) ? 'Enter a label' : null,
              ),
              const SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _line1Controller,
                decoration: const InputDecoration(labelText: 'Address line 1'),
                validator: (value) => (value == null || value.trim().isEmpty)
                    ? 'Enter address line 1'
                    : null,
              ),
              const SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _line2Controller,
                decoration: const InputDecoration(labelText: 'Address line 2'),
              ),
              const SizedBox(height: AppSpacing.sm),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _cityController,
                      decoration: const InputDecoration(labelText: 'City'),
                      validator: (value) =>
                          (value == null || value.trim().isEmpty) ? 'Enter city' : null,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: MalaysiaStateAutocompleteField(
                      controller: _stateController,
                      hintText: 'Type first letter',
                      validator: (value) =>
                          (value == null || value.trim().isEmpty) ? 'Enter state' : null,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _postcodeController,
                      decoration: const InputDecoration(labelText: 'Postcode'),
                      validator: (value) => (value == null || value.trim().isEmpty)
                          ? 'Enter postcode'
                          : null,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: TextFormField(
                      controller: _countryController,
                      decoration: const InputDecoration(labelText: 'Country'),
                      validator: (value) =>
                          (value == null || value.trim().isEmpty) ? 'Enter country' : null,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),
              SwiperButton(
                label: 'Save Location',
                isLoading: _saving,
                onPressed: _saving ? null : _saveLocation,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _MapGridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final linePaint = Paint()
      ..color = const Color(0xFFE8DEFF)
      ..strokeWidth = 1;

    for (double x = 0; x <= size.width; x += size.width / 5) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), linePaint);
    }

    for (double y = 0; y <= size.height; y += size.height / 4) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), linePaint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _LocationCard extends StatelessWidget {
  const _LocationCard({
    required this.selectedLocation,
    required this.onChangePressed,
  });

  final ServiceLocationSelection? selectedLocation;
  final VoidCallback onChangePressed;

  @override
  Widget build(BuildContext context) {
    final hasSelection = selectedLocation != null;
    final isCurrentLocation = selectedLocation?.type == 'current';
    final rawAddress = selectedLocation?.address.isNotEmpty == true
        ? selectedLocation!.address
        : 'Choose a saved address or use your current location';
    final address = isCurrentLocation &&
            (rawAddress.contains('Lat:') || rawAddress.contains('Lng:'))
        ? 'Current location selected'
        : rawAddress;
    final labelText = isCurrentLocation
        ? 'Current Location'
        : hasSelection
            ? selectedLocation!.label
            : 'Service location';
    final addressText = isCurrentLocation
        ? 'Home : $address'
        : hasSelection
            ? address
            : 'Choose a saved address or use your current location';

    return Container(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.xs,
        AppSpacing.md,
        AppSpacing.md,
      ),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Colors.white,
            Color(0xFFF2ECFF),
          ],
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x12684AB3),
            blurRadius: 16,
            offset: Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Spacer(),
              Wrap(
                spacing: 4,
                runSpacing: 4,
                children: List.generate(
                  9,
                  (_) => Container(
                    width: 4,
                    height: 4,
                    decoration: BoxDecoration(
                      color: const Color(0xFFE0D5F8),
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.sm,
            ),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Color(0xFF22114D),
                  Color(0xFF34206D),
                ],
              ),
              borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x1A3D2182),
                  blurRadius: 14,
                  offset: Offset(0, 6),
                ),
              ],
            ),
            child: Row(
              children: [
                Container(
                  width: 50,
                  height: 50,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.08),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.10),
                    ),
                  ),
                  child: const Icon(
                    Icons.my_location_rounded,
                    color: Colors.white,
                    size: 24,
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        labelText,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              color: Colors.white.withValues(alpha: 0.78),
                              fontWeight: FontWeight.w500,
                            ),
                      ),
                      const SizedBox(height: AppSpacing.xxs),
                      Text(
                        addressText,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                              fontSize: 18,
                            ),
                      ),
                    ],
                  ),
                ),
                Icon(
                  Icons.location_on_rounded,
                  color: Colors.white.withValues(alpha: 0.10),
                  size: 34,
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _LocationMapCard(
                  address: address,
                  latitude: selectedLocation?.latitude,
                  longitude: selectedLocation?.longitude,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _LocationMapCard extends StatelessWidget {
  const _LocationMapCard({
    required this.address,
    this.latitude,
    this.longitude,
  });

  final String address;
  final double? latitude;
  final double? longitude;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 124,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.94),
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(color: const Color(0xFFE7DCF7)),
      ),
      child: Stack(
        children: [
          Positioned.fill(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
              child: AddressLiveMap(
                address: address,
                latitude: latitude,
                longitude: longitude,
                height: 124,
              ),
            ),
          ),
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.white.withValues(alpha: 0.06),
                    Colors.white.withValues(alpha: 0.22),
                  ],
                ),
              ),
            ),
          ),
          const Center(
            child: _StaticMapPin(),
          ),
        ],
      ),
    );
  }
}

class _StaticMapPin extends StatelessWidget {
  const _StaticMapPin();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 42,
      height: 42,
      decoration: BoxDecoration(
        color: AppColors.primary,
        borderRadius: BorderRadius.circular(21),
        boxShadow: const [
          BoxShadow(
            color: Color(0x29684AB3),
            blurRadius: 18,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: const Icon(
        Icons.location_on_rounded,
        color: Colors.white,
        size: 26,
      ),
    );
  }
}

class _ServiceTile extends StatelessWidget {
  const _ServiceTile({
    required this.category,
    required this.subtitle,
    required this.onTap,
  });

  final ServiceCategory category;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: 6,
            vertical: 10,
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    colors: [
                      const Color(0xFFF7F1FF),
                      const Color(0xFFEFE6FF).withValues(alpha: 0.92),
                    ],
                  ),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x12684AB3),
                      blurRadius: 18,
                      offset: Offset(0, 10),
                    ),
                  ],
                ),
                child: Icon(
                  category.icon,
                  color: AppColors.primary,
                  size: 30,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                category.label,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontSize: 16,
                    ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                subtitle,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: const Color(0xFF7770A9),
                      fontSize: 12,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SafetyBanner extends StatelessWidget {
  const _SafetyBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.lg,
      ),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(30),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFF0E5D3B),
            Color(0xFF21A76F),
          ],
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x1A0B5A39),
            blurRadius: 28,
            offset: Offset(0, 14),
          ),
        ],
      ),
      child: Row(
        children: [
          const _ShieldBadge(),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Safe. Reliable. Trusted.',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        color: Colors.white,
                        fontSize: 18,
                      ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  'All providers are verified for your safety and peace of mind.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Colors.white.withValues(alpha: 0.82),
                        height: 1.5,
                      ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          const _ProviderGroup(),
        ],
      ),
    );
  }
}

class _NearbyCategorySection extends StatelessWidget {
  const _NearbyCategorySection({
    required this.title,
    required this.serviceKey,
    required this.locationSelection,
    required this.marketplaceService,
  });

  final String title;
  final String serviceKey;
  final ServiceLocationSelection? locationSelection;
  final ProviderMarketplaceService marketplaceService;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<ProviderSummary>>(
      future: marketplaceService.fetchVisibleProviders(
        service: serviceKey,
        locationSelection: locationSelection,
      ),
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: AppSpacing.sm),
            child: SizedBox(
              height: 430,
              child: _NearbyProviderSkeletonList(),
            ),
          );
        }

        if (snapshot.hasError) {
          return const EmptyState(
            title: 'Unable to load providers',
            subtitle: 'Unable to load providers. Please try again.',
            icon: Icons.error_outline_rounded,
          );
        }

        final providers = snapshot.data ?? const [];
        if (providers.isEmpty) {
          return const SizedBox.shrink();
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    title,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                ),
                TextButton(
                  onPressed: () => Navigator.of(
                    context,
                  ).pushNamed(AppRoutes.providers, arguments: serviceKey),
                  child: const Text('See all'),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            SizedBox(
              height: 430,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: providers.length.clamp(0, 5) + 1,
                separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.md),
                itemBuilder: (context, index) {
                  if (index >= providers.length.clamp(0, 5)) {
                    return SizedBox(
                      width: 312,
                      child: _ShowAllProvidersCard(
                        serviceKey: serviceKey,
                        title: title,
                      ),
                    );
                  }

                  final provider = providers[index];
                  return SizedBox(
                    width: 312,
                    child: ProviderCard(
                      provider: provider,
                      onTap: () => Navigator.of(context).pushNamed(
                        AppRoutes.providerProfile,
                        arguments: provider,
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        );
      },
    );
  }
}

class _NearbyProviderSkeletonList extends StatelessWidget {
  const _NearbyProviderSkeletonList();

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      scrollDirection: Axis.horizontal,
      itemCount: 3,
      separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.md),
      itemBuilder: (context, index) {
        return const SizedBox(
          width: 312,
          child: ProviderSkeletonCard(),
        );
      },
    );
  }
}

class _ShowAllProvidersCard extends StatelessWidget {
  const _ShowAllProvidersCard({
    required this.serviceKey,
    required this.title,
  });

  final String serviceKey;
  final String title;

  @override
  Widget build(BuildContext context) {
    final label = title
        .replaceFirst(RegExp(r'^Popular\s+', caseSensitive: false), '')
        .replaceFirst(RegExp(r'\s+nearby you$', caseSensitive: false), '')
        .trim();

    return InkWell(
      borderRadius: BorderRadius.circular(26),
      onTap: () => Navigator.of(
        context,
      ).pushNamed(AppRoutes.providers, arguments: serviceKey),
      child: Container(
        width: 312,
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.centerLeft,
            end: Alignment.centerRight,
            colors: [
              Color(0xFF645394),
              Color(0xFF4B0082),
            ],
          ),
          borderRadius: BorderRadius.circular(26),
          boxShadow: const [
            BoxShadow(
              color: Color(0x261A0938),
              blurRadius: 24,
              offset: Offset(0, 12),
            ),
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                height: 116,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(18),
                  color: Colors.white.withValues(alpha: 0.10),
                ),
                child: Stack(
                  children: [
                    Positioned(
                      right: -20,
                      top: -8,
                      child: Container(
                        width: 90,
                        height: 90,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white.withValues(alpha: 0.10),
                        ),
                      ),
                    ),
                    const Positioned(
                      left: 18,
                      top: 18,
                      child: Icon(
                        Icons.auto_awesome_rounded,
                        color: Colors.white,
                        size: 24,
                      ),
                    ),
                    Positioned(
                      left: 18,
                      right: 18,
                      bottom: 18,
                      child: Text(
                        'More $label nearby',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                            ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              Text(
                'Show All',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                    ),
              ),
              const SizedBox(height: 6),
              Text(
                'Explore the full $label list and find more trusted providers near your selected area.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Colors.white.withValues(alpha: 0.82),
                      height: 1.45,
                    ),
              ),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.18),
                  ),
                ),
                child: Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Open full list',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.18),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.arrow_forward_rounded,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              const Spacer(),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 12,
                ),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(18),
                  color: Colors.white.withValues(alpha: 0.12),
                ),
                child: Text(
                  'See all nearby providers in one place.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HeroArc extends StatelessWidget {
  const _HeroArc({required this.size, required this.opacity});

  final double size;
  final double opacity;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: Colors.white.withValues(alpha: opacity),
          width: 1.4,
        ),
      ),
    );
  }
}

class _IconBubble extends StatelessWidget {
  const _IconBubble({
    required this.icon,
    this.unreadCount = 0,
    this.onTap,
  });

  final IconData icon;
  final int unreadCount;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(18),
            onTap: onTap,
            child: Ink(
              width: 58,
              height: 58,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
              ),
              child: Icon(icon, color: Colors.white, size: 30),
            ),
          ),
        ),
        if (unreadCount > 0)
          Positioned(
            top: 6,
            right: 6,
            child: _AlertDot(count: unreadCount),
          ),
      ],
    );
  }
}

class _AlertDot extends StatelessWidget {
  const _AlertDot({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: const Color(0xFFFF4B4B),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        count > 99 ? '99+' : '$count',
        style: const TextStyle(
          color: Colors.white,
          fontSize: 10,
          fontWeight: FontWeight.w800,
          height: 1,
        ),
      ),
    );
  }
}

class _ShieldBadge extends StatelessWidget {
  const _ShieldBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 88,
      height: 88,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFF15724E),
            Color(0xFF0C4E33),
          ],
        ),
        border: Border.all(color: Colors.white.withValues(alpha: 0.16)),
      ),
      child: const Icon(
        Icons.shield_outlined,
        color: Colors.white,
        size: 40,
      ),
    );
  }
}

class _ProviderGroup extends StatefulWidget {
  const _ProviderGroup();

  @override
  State<_ProviderGroup> createState() => _ProviderGroupState();
}

class _ProviderGroupState extends State<_ProviderGroup>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final wave = math.sin(_controller.value * math.pi * 2);
        return SizedBox(
          width: 106,
          height: 94,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned(
                left: 0,
                top: 16 - (wave * 2),
                child: const _ProviderAvatar(
                  color: Color(0xFFFFE5C2),
                  icon: Icons.restaurant_rounded,
                ),
              ),
              Positioned(
                left: 28,
                top: 8 + (wave * 2),
                child: const _ProviderAvatar(
                  color: Color(0xFFFFE0D3),
                  icon: Icons.cleaning_services_rounded,
                ),
              ),
              Positioned(
                left: 54,
                top: 16 - (wave * 1.5),
                child: const _ProviderAvatar(
                  color: Color(0xFFDCCBFF),
                  icon: Icons.local_taxi_rounded,
                ),
              ),
              Positioned(
                right: 6,
                bottom: -6 + (wave * 1.5),
                child: const _MiniShield(),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _ProviderAvatar extends StatelessWidget {
  const _ProviderAvatar({
    required this.color,
    required this.icon,
  });

  final Color color;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 46,
      height: 46,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 2),
      ),
      child: Icon(icon, color: const Color(0xFF5A2ACC), size: 22),
    );
  }
}

class _MiniShield extends StatelessWidget {
  const _MiniShield();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 38,
      height: 38,
      decoration: BoxDecoration(
        color: const Color(0xFF1D9E69),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white, width: 2),
      ),
      child: const Icon(
        Icons.shield_rounded,
        color: Colors.white,
        size: 20,
      ),
    );
  }
}

@Preview(
  name: 'Customer Home',
  size: Size(430, 932),
  wrapper: previewScreenSurface,
)
Widget customerHomeScreenPreview() {
  return CustomerHomeScreen(repository: DemoRepository());
}
