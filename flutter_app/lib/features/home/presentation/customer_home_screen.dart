import 'dart:math' as math;
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';

import '../../../core/animation/app_motion.dart';
import '../../../core/config/service_categories.dart';
import '../../../core/routing/app_routes.dart';
import '../../../models/notification_item.dart';
import '../../../models/provider_summary.dart';
import '../../../models/service_category.dart';
import '../../../previews/widget_preview_helpers.dart';
import '../../../repositories/demo_repository.dart';
import '../../../services/active_booking_service.dart';
import '../../../services/booking_overview_service.dart';
import '../../../services/customer_account_service.dart';
import '../../../services/customer_notifications_service.dart';
import '../../../services/current_customer_service.dart';
import '../../../services/current_location_service.dart';
import '../../../services/customer_address_service.dart';
import '../../../services/customer_profile_api_service.dart';
import '../../../services/provider_marketplace_service.dart';
import '../../../services/service_location_store.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/app_reveal.dart';
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
  static const _notificationsService = CustomerNotificationsService();
  static const _activeBookingService = ActiveBookingService();
  static const _profileApiService = CustomerProfileApiService();

  static const _popularSections = <({String title, String serviceKey})>[
    (title: 'Popular chef nearby you', serviceKey: 'chef'),
    (title: 'Popular electrician nearby you', serviceKey: 'electrician'),
    (title: 'Popular maids nearby you', serviceKey: 'maid'),
  ];

  ServiceLocationSelection? _selectedLocation;
  bool _changingLocation = false;
  Set<String> _favoriteProviderIds = {};

  // Futures live on State, not inline in build() — a local setState (e.g.
  // marking a notification read, toggling _changingLocation) must not
  // silently re-fire every network request on the screen. See the Customer
  // Home audit: this was the confirmed "futures built inline in build()"
  // performance issue.
  late Future<CurrentCustomerProfile?> _profileFuture;
  late Future<List<NotificationItem>> _notificationsFuture;
  late Future<CustomerBookingRecord?> _activeBookingFuture;
  late List<Future<List<ProviderSummary>>> _providerFutures;

  @override
  void initState() {
    super.initState();
    _selectedLocation = ServiceLocationStore.load();
    _primeFutures();
    unawaited(_loadPersistedLocation());
    unawaited(_loadFavorites());
  }

  Future<void> _loadFavorites() async {
    try {
      final favorites = await _profileApiService.fetchFavorites();
      if (!mounted) {
        return;
      }
      setState(() {
        _favoriteProviderIds = favorites.map((item) => item.id).toSet();
      });
    } catch (error, stackTrace) {
      if (kDebugMode) {
        debugPrint('Load favorites failed: $error');
        debugPrintStack(stackTrace: stackTrace);
      }
    }
  }

  Future<void> _toggleFavorite(ProviderSummary provider) async {
    if (provider.id.isEmpty) {
      return;
    }
    final wasFavorite = _favoriteProviderIds.contains(provider.id);
    setState(() {
      if (wasFavorite) {
        _favoriteProviderIds.remove(provider.id);
      } else {
        _favoriteProviderIds.add(provider.id);
      }
    });
    try {
      if (wasFavorite) {
        await _profileApiService.removeFavorite(provider.id);
      } else {
        await _profileApiService.addFavorite(
          provider.id,
          serviceKey: provider.serviceKey,
        );
      }
    } catch (error, stackTrace) {
      if (kDebugMode) {
        debugPrint('Toggle favorite failed: $error');
        debugPrintStack(stackTrace: stackTrace);
      }
      if (!mounted) {
        return;
      }
      setState(() {
        if (wasFavorite) {
          _favoriteProviderIds.add(provider.id);
        } else {
          _favoriteProviderIds.remove(provider.id);
        }
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString().replaceFirst('Exception: ', '')),
        ),
      );
    }
  }

  /// [ServiceLocationStore.load] only reflects whatever's been primed from
  /// disk so far — this recovers a location saved in a previous app run.
  Future<void> _loadPersistedLocation() async {
    final stored = await ServiceLocationStore.loadAsync();
    if (!mounted || _selectedLocation != null) {
      return;
    }
    if (stored != null) {
      setState(() {
        _selectedLocation = stored;
        _providerFutures = _fetchProviderFutures();
      });
      return;
    }
    // Nothing saved yet (first launch, or the user never picked one) — the
    // default service location should be the device's current location
    // rather than leaving browsing unfiltered until the user opens the
    // location picker. Silent by design: if permission is denied or GPS is
    // off, the user still sees the "choose location" prompt as a fallback.
    try {
      final result = await fetchCurrentLocation();
      if (!mounted || _selectedLocation != null) {
        return;
      }
      await _applyLocation(
        ServiceLocationSelection(
          type: 'current',
          label: 'Current location',
          address: result.label,
          latitude: result.latitude,
          longitude: result.longitude,
        ),
      );
    } catch (error, stackTrace) {
      if (kDebugMode) {
        debugPrint('Default current location failed: $error');
        debugPrintStack(stackTrace: stackTrace);
      }
    }
  }

  void _primeFutures() {
    _profileFuture = _currentCustomerService.fetchCurrentCustomerProfile();
    _notificationsFuture = _fetchNotifications();
    _activeBookingFuture = _fetchActiveBooking();
    _providerFutures = _fetchProviderFutures();
  }

  Future<List<NotificationItem>> _fetchNotifications() async {
    try {
      return await _notificationsService.fetchNotifications();
    } catch (error, stackTrace) {
      if (kDebugMode) {
        debugPrint('Home notifications fetch failed: $error');
        debugPrintStack(stackTrace: stackTrace);
      }
      return const [];
    }
  }

  Future<CustomerBookingRecord?> _fetchActiveBooking() async {
    try {
      return await _activeBookingService.fetchActiveBooking();
    } catch (error, stackTrace) {
      if (kDebugMode) {
        debugPrint('Home active booking fetch failed: $error');
        debugPrintStack(stackTrace: stackTrace);
      }
      return null;
    }
  }

  List<Future<List<ProviderSummary>>> _fetchProviderFutures() {
    return _popularSections
        .map(
          (section) => _marketplaceService.fetchVisibleProviders(
            service: section.serviceKey,
            locationSelection: _selectedLocation,
          ),
        )
        .toList(growable: false);
  }

  Future<void> _refresh() async {
    setState(_primeFutures);
    await Future.wait<Object?>(
      [
        _profileFuture,
        _notificationsFuture,
        _activeBookingFuture,
        ..._providerFutures,
      ].map((future) => future.catchError((_) => null)),
    );
  }

  Future<void> _markNotificationRead(NotificationItem item) async {
    if (item.id.isEmpty) {
      return;
    }
    try {
      await _notificationsService.markRead(item.id);
    } catch (error, stackTrace) {
      if (kDebugMode) {
        debugPrint('Mark notification read failed: $error');
        debugPrintStack(stackTrace: stackTrace);
      }
    }
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
              await _applyLocation(selection);
              if (!mounted) {
                return;
              }
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
                setSheetState(() => _changingLocation = false);
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
                      await _applyLocation(selection);
                      if (!mounted) {
                        return;
                      }
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
                            style: Theme.of(context).textTheme.titleSmall
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
                  final selection =
                      await SwiperBottomSheet.show<ServiceLocationSelection>(
                        context,
                        title: 'Add new location',
                        subtitle: 'Save a new location and use it immediately.',
                        child: const _AddLocationSheet(),
                      );
                  if (selection == null) {
                    return;
                  }
                  await _applyLocation(selection);
                  if (!mounted) {
                    return;
                  }
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
                    setState(() {
                      _selectedLocation = null;
                      _providerFutures = _fetchProviderFutures();
                    });
                    Navigator.of(context).pop();
                  },
                ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _applyLocation(ServiceLocationSelection selection) async {
    await ServiceLocationStore.save(selection);
    if (!mounted) {
      return;
    }
    setState(() {
      _selectedLocation = selection;
      _providerFutures = _fetchProviderFutures();
    });
  }

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFFF7F3FF), Colors.white],
        ),
      ),
      child: RefreshIndicator(
        onRefresh: _refresh,
        color: AppColors.primary,
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  FutureBuilder<CurrentCustomerProfile?>(
                    future: _profileFuture,
                    builder: (context, profileSnapshot) {
                      return FutureBuilder<List<NotificationItem>>(
                        future: _notificationsFuture,
                        builder: (context, notificationsSnapshot) {
                          final customer = profileSnapshot.data;
                          final firstName = customer?.firstName ?? 'Customer';
                          final notifications =
                              notificationsSnapshot.data ?? const [];
                          return AppReveal(
                            delay: const Duration(milliseconds: 40),
                            duration: AppMotion.normal,
                            beginOffset: const Offset(0, 0.04),
                            child: _HeroSection(
                              firstName: firstName,
                              unreadCount: notifications
                                  .where((item) => item.isUnread)
                                  .length,
                              onNotificationsTap: () =>
                                  _showNotifications(notifications),
                            ),
                          );
                        },
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
                        const SizedBox(height: AppSpacing.md),
                        FutureBuilder<CustomerBookingRecord?>(
                          future: _activeBookingFuture,
                          builder: (context, snapshot) {
                            final record = snapshot.data;
                            if (snapshot.connectionState !=
                                    ConnectionState.done ||
                                record == null) {
                              return const SizedBox.shrink();
                            }
                            return Padding(
                              padding: const EdgeInsets.only(
                                bottom: AppSpacing.lg,
                              ),
                              child: _ActiveBookingCard(record: record),
                            );
                          },
                        ),
                        Text(
                          'What service do you need?',
                          style: Theme.of(context).textTheme.titleLarge
                              ?.copyWith(fontWeight: FontWeight.w800),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        GridView.builder(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: kServiceCategories.length,
                          gridDelegate:
                              const SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: 4,
                                mainAxisSpacing: AppSpacing.sm,
                                crossAxisSpacing: AppSpacing.xs,
                                childAspectRatio: 0.82,
                              ),
                          itemBuilder: (context, index) {
                            final category = kServiceCategories[index];
                            return AppReveal(
                              delay: Duration(milliseconds: 150 + (index * 40)),
                              duration: AppMotion.normal,
                              beginOffset: const Offset(0, 0.06),
                              child: _ServiceChip(
                                category: category,
                                onTap: () => Navigator.of(context).pushNamed(
                                  AppRoutes.providers,
                                  arguments: category.serviceKey,
                                ),
                              ),
                            );
                          },
                        ),
                        const SizedBox(height: AppSpacing.lg),
                        const _WalletComingSoonCard(),
                        const SizedBox(height: AppSpacing.lg),
                        const _SafetyStrip(),
                        const SizedBox(height: AppSpacing.xl),
                        for (
                          var index = 0;
                          index < _popularSections.length;
                          index++
                        ) ...[
                          _NearbyCategorySection(
                            title: _popularSections[index].title,
                            serviceKey: _popularSections[index].serviceKey,
                            future: _providerFutures[index],
                            favoriteProviderIds: _favoriteProviderIds,
                            onToggleFavorite: _toggleFavorite,
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
      ),
    );
  }

  void _showNotifications(List<NotificationItem> notifications) {
    SwiperBottomSheet.show<void>(
      context,
      title: 'Notifications',
      subtitle: 'Read your latest booking, provider, and account updates.',
      child: notifications.isEmpty
          ? const EmptyState(
              title: 'No notifications yet',
              subtitle: 'New updates will appear here when they arrive.',
              icon: Icons.notifications_none_rounded,
            )
          : Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (var index = 0; index < notifications.length; index++) ...[
                  NotificationCard(
                    notification: notifications[index],
                    onTap: () {
                      final item = notifications[index];
                      final targetRoute = item.targetRoute;
                      unawaited(_markNotificationRead(item));
                      Navigator.of(context).pop();
                      if (targetRoute != null && mounted) {
                        Navigator.of(context).pushNamed(
                          targetRoute,
                          arguments: item.targetArgument,
                        );
                      }
                    },
                  ),
                  if (index != notifications.length - 1)
                    const SizedBox(height: AppSpacing.sm),
                ],
              ],
            ),
    );
  }
}

class _HeroSection extends StatefulWidget {
  const _HeroSection({
    required this.firstName,
    required this.unreadCount,
    required this.onNotificationsTap,
  });

  final String firstName;
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
      );
    }
    if (hour >= 12 && hour < 15) {
      return const _GreetingStyle(
        label: 'Good Afternoon',
        icon: Icons.sunny,
        iconColor: Color(0xFFFFB347),
      );
    }
    if (hour >= 15 && hour < 20) {
      return const _GreetingStyle(
        label: 'Good Evening',
        icon: Icons.wb_sunny_rounded,
        iconColor: Color(0xFFFFC94D),
      );
    }
    return const _GreetingStyle(
      label: 'What can we help with tonight?',
      icon: Icons.nightlight_round,
      iconColor: Color(0xFFB8C3FF),
    );
  }

  @override
  Widget build(BuildContext context) {
    final greeting = _buildGreeting();

    return Container(
      decoration: const BoxDecoration(
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(36)),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1A0F4E), Color(0xFF25125E), Color(0xFF431E86)],
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
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Hello, ${widget.firstName}',
                          style: Theme.of(context).textTheme.headlineLarge
                              ?.copyWith(
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
                                    (math.sin(
                                          _sunController.value * math.pi * 2,
                                        ) *
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
                              angle: _isSunAnimating
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

/// The wallet feature has no backend at all yet (no `wallet_balance` column
/// or endpoint anywhere) — this is a deliberately inert placeholder rather
/// than a number that looks real but never changes. See the Customer Home
/// audit for the "hardcoded RM128.40" finding this replaces.
class _WalletComingSoonCard extends StatelessWidget {
  const _WalletComingSoonCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1B103E), AppColors.primary],
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x1F684AB3),
            blurRadius: 20,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(
              Icons.account_balance_wallet_outlined,
              color: Colors.white,
              size: 22,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Wallet',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Coming soon',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.white.withValues(alpha: 0.82),
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

class _ActiveBookingCard extends StatelessWidget {
  const _ActiveBookingCard({required this.record});

  final CustomerBookingRecord record;

  @override
  Widget build(BuildContext context) {
    final booking = record.booking;
    return InkWell(
      borderRadius: BorderRadius.circular(24),
      onTap: () => Navigator.of(
        context,
      ).pushNamed(AppRoutes.bookingDetail, arguments: booking.id),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          color: Colors.white,
          border: Border.all(color: AppColors.border),
          boxShadow: const [
            BoxShadow(
              color: Color(0x0F684AB3),
              blurRadius: 20,
              offset: Offset(0, 8),
            ),
          ],
        ),
        child: Row(
          children: [
            CircleAvatar(
              radius: 26,
              backgroundColor: AppColors.primarySoft,
              backgroundImage: booking.providerImageUrl.isNotEmpty
                  ? NetworkImage(booking.providerImageUrl)
                  : null,
              child: booking.providerImageUrl.isEmpty
                  ? const Icon(Icons.person_rounded, color: AppColors.primary)
                  : null,
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.primarySoft,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          booking.status,
                          style: const TextStyle(
                            color: AppColors.primary,
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${booking.title} · ${booking.providerName}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    booking.schedule,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(999),
              ),
              child: const Text(
                'View Task',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
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
  });

  final String label;
  final IconData icon;
  final Color iconColor;
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
  bool _loadingLocation = false;
  double? _latitude;
  double? _longitude;
  String _locationLabel =
      'Add a saved location, or pull your current position.';

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
    setState(() => _loadingLocation = true);
    try {
      final result = await fetchCurrentLocation();
      if (!mounted) {
        return;
      }
      setState(() {
        _latitude = result.latitude;
        _longitude = result.longitude;
        _locationLabel = result.label;
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
        setState(() => _loadingLocation = false);
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
          [
            input.city,
            input.state,
            input.postcode,
          ].where((item) => item.isNotEmpty).join(', '),
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
              colors: [Color(0xFFF8F3FF), Color(0xFFEDE4FF)],
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
                      // A readable address only — never raw coordinates.
                      _locationLabel,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: const Color(0xFF5C558D),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              SwiperButton(
                label: _loadingLocation
                    ? 'Finding your location...'
                    : 'Use Current Location',
                isSecondary: true,
                isLoading: _loadingLocation,
                onPressed: _loadingLocation ? null : _useCurrentLocation,
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
                validator: (value) => (value == null || value.trim().isEmpty)
                    ? 'Enter a label'
                    : null,
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
                          (value == null || value.trim().isEmpty)
                          ? 'Enter city'
                          : null,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: MalaysiaStateAutocompleteField(
                      controller: _stateController,
                      hintText: 'Type first letter',
                      validator: (value) =>
                          (value == null || value.trim().isEmpty)
                          ? 'Enter state'
                          : null,
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
                      validator: (value) =>
                          (value == null || value.trim().isEmpty)
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
                          (value == null || value.trim().isEmpty)
                          ? 'Enter country'
                          : null,
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
    // Never render raw coordinates — if the stored address text somehow
    // still contains "Lat:"/"Lng:" (older saved selections), fall back to a
    // neutral label instead.
    final rawAddress = selectedLocation?.address.isNotEmpty == true
        ? selectedLocation!.address
        : 'Choose a saved address or use your current location';
    final address = rawAddress.contains('Lat:') || rawAddress.contains('Lng:')
        ? 'Current location selected'
        : rawAddress;
    final labelText = isCurrentLocation
        ? 'Current Location'
        : hasSelection
        ? selectedLocation!.label
        : 'Service location';

    return InkWell(
      borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
      onTap: onChangePressed,
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          color: Colors.white,
          boxShadow: const [
            BoxShadow(
              color: Color(0x12684AB3),
              blurRadius: 16,
              offset: Offset(0, 6),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: AppColors.primarySoft,
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Icon(
                Icons.my_location_rounded,
                color: AppColors.primary,
                size: 22,
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
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: AppColors.textSecondary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    address,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.keyboard_arrow_right_rounded,
              color: AppColors.textMuted,
            ),
          ],
        ),
      ),
    );
  }
}

class _ServiceChip extends StatelessWidget {
  const _ServiceChip({required this.category, required this.onTap});

  final ServiceCategory category;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: const BoxDecoration(
                  color: AppColors.primarySoft,
                  shape: BoxShape.circle,
                ),
                child: Icon(category.icon, color: AppColors.primary, size: 22),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                category.label,
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SafetyStrip extends StatelessWidget {
  const _SafetyStrip();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        color: const Color(0xFFEAF7F1),
      ),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: const BoxDecoration(
              color: Color(0xFF1D9E69),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.shield_rounded,
              color: Colors.white,
              size: 16,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              'All providers are verified for your safety and peace of mind.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: const Color(0xFF0E5D3B),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _NearbyCategorySection extends StatefulWidget {
  const _NearbyCategorySection({
    required this.title,
    required this.serviceKey,
    required this.future,
    required this.favoriteProviderIds,
    required this.onToggleFavorite,
  });

  final String title;
  final String serviceKey;
  final Future<List<ProviderSummary>> future;
  final Set<String> favoriteProviderIds;
  final ValueChanged<ProviderSummary> onToggleFavorite;

  @override
  State<_NearbyCategorySection> createState() => _NearbyCategorySectionState();
}

class _NearbyCategorySectionState extends State<_NearbyCategorySection> {
  final _scrollController = ScrollController();

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<ProviderSummary>>(
      future: widget.future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: AppSpacing.sm),
            child: SizedBox(height: 380, child: _NearbyProviderSkeletonList()),
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
                    widget.title,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                TextButton(
                  onPressed: () => Navigator.of(context).pushNamed(
                    AppRoutes.providers,
                    arguments: widget.serviceKey,
                  ),
                  child: const Text('See all'),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            LayoutBuilder(
              builder: (context, constraints) {
                // One card fully visible, roughly half of the next peeking
                // in at the edge — a nudge to keep scrolling, not a full
                // second card.
                final itemWidth = constraints.maxWidth * 0.68;
                const gap = AppSpacing.md;
                final itemCount = providers.length.clamp(0, 5) + 1;

                return SizedBox(
                  height: 380,
                  child: ListView.builder(
                    controller: _scrollController,
                    scrollDirection: Axis.horizontal,
                    itemCount: itemCount,
                    itemBuilder: (context, index) {
                      final itemStart = index * (itemWidth + gap);
                      final child = index >= providers.length.clamp(0, 5)
                          ? _ShowAllProvidersCard(
                              serviceKey: widget.serviceKey,
                              title: widget.title,
                            )
                          : Builder(
                              builder: (context) {
                                final provider = providers[index].copyWith(
                                  isFavorite: widget.favoriteProviderIds
                                      .contains(providers[index].id),
                                );
                                return ProviderCard(
                                  compact: true,
                                  provider: provider,
                                  onTap: () => Navigator.of(context).pushNamed(
                                    AppRoutes.providerProfile,
                                    arguments: provider,
                                  ),
                                  onFavoriteToggle: () =>
                                      widget.onToggleFavorite(provider),
                                );
                              },
                            );

                      return Padding(
                        padding: const EdgeInsets.only(right: gap),
                        child: AnimatedBuilder(
                          animation: _scrollController,
                          builder: (context, cardChild) {
                            var distance = 0.0;
                            if (_scrollController.hasClients &&
                                _scrollController.position.haveDimensions) {
                              distance = (_scrollController.offset - itemStart)
                                  .abs();
                            }
                            final t = (distance / itemWidth).clamp(0.0, 1.0);
                            return Opacity(
                              opacity: 1 - (t * 0.35),
                              child: Transform.scale(
                                scale: 1 - (t * 0.08),
                                alignment: Alignment.center,
                                child: cardChild,
                              ),
                            );
                          },
                          child: SizedBox(width: itemWidth, child: child),
                        ),
                      );
                    },
                  ),
                );
              },
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
        return const SizedBox(width: 312, child: ProviderSkeletonCard());
      },
    );
  }
}

class _ShowAllProvidersCard extends StatelessWidget {
  const _ShowAllProvidersCard({required this.serviceKey, required this.title});

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
            colors: [Color(0xFF645394), Color(0xFF4B0082)],
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
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(
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
  const _IconBubble({required this.icon, this.unreadCount = 0, this.onTap});

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
          Positioned(top: 6, right: 6, child: _AlertDot(count: unreadCount)),
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

@Preview(
  name: 'Customer Home',
  size: Size(430, 932),
  wrapper: previewScreenSurface,
)
Widget customerHomeScreenPreview() {
  return CustomerHomeScreen(repository: DemoRepository());
}
