import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';

import '../../../core/routing/app_routes.dart';
import '../../../models/service_category.dart';
import '../../../previews/widget_preview_helpers.dart';
import '../../../repositories/demo_repository.dart';
import '../../../services/customer_account_service.dart';
import '../../../services/current_customer_service.dart';
import '../../../services/current_location_service.dart';
import '../../../services/customer_address_service.dart';
import '../../../services/service_location_store.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/profile_avatar.dart';
import '../../../widgets/swiper_bottom_sheet.dart';
import '../../../widgets/swiper_button.dart';

class CustomerHomeScreen extends StatefulWidget {
  const CustomerHomeScreen({super.key, required this.repository});

  final DemoRepository repository;

  @override
  State<CustomerHomeScreen> createState() => _CustomerHomeScreenState();
}

class _CustomerHomeScreenState extends State<CustomerHomeScreen> {
  static const _currentCustomerService = CurrentCustomerService();
  static const _addressService = CustomerAddressService();

  static const Map<String, String> _categoryDescriptions = {
    'Chef': 'Home Cooking',
    'Maid': 'Cleaning Service',
    'Driver': 'Private Driver',
    'Tutor': 'Private Lessons',
    'Plumber': 'Fix & Repair',
    'Electrician': 'Installation & Repair',
  };

  ServiceLocationSelection? _selectedLocation;
  bool _changingLocation = false;

  @override
  void initState() {
    super.initState();
    _selectedLocation = ServiceLocationStore.load();
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
                    return _HeroSection(
                      firstName: firstName,
                      fullName: fullName,
                      avatarUrl: customer?.avatarUrl ?? '',
                    );
                  },
                ),
                Transform.translate(
                  offset: const Offset(0, -34),
                  child: const Padding(
                    padding: EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                    child: _SearchCard(),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.lg,
                    0,
                    AppSpacing.lg,
                    120,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _LocationCard(
                        selectedLocation: _selectedLocation,
                        onChangePressed: _chooseLocation,
                      ),
                      const SizedBox(height: AppSpacing.xl),
                      Text(
                        'Popular services',
                        style: Theme.of(context).textTheme.headlineMedium
                            ?.copyWith(fontSize: 22),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        'Choose a service category and discover trusted providers near you.',
                        style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                              color: const Color(0xFF6C63A0),
                            ),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      GridView.builder(
                        itemCount: math.min(categories.length, 6),
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        gridDelegate:
                            const SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: 2,
                              mainAxisSpacing: AppSpacing.md,
                              crossAxisSpacing: AppSpacing.md,
                              childAspectRatio: 0.86,
                            ),
                        itemBuilder: (context, index) {
                          final category = categories[index];
                          return _ServiceTile(
                            category: category,
                            subtitle:
                                _categoryDescriptions[category.label] ?? 'Trusted help',
                            onTap: () => Navigator.of(context).pushNamed(
                              AppRoutes.providers,
                              arguments: category.label.toLowerCase(),
                            ),
                          );
                        },
                      ),
                      const SizedBox(height: AppSpacing.xl),
                      const _SafetyBanner(),
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

class _HeroSection extends StatelessWidget {
  const _HeroSection({
    required this.firstName,
    required this.fullName,
    required this.avatarUrl,
  });

  final String firstName;
  final String fullName;
  final String avatarUrl;

  @override
  Widget build(BuildContext context) {
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
                      const Expanded(
                        child: Row(
                          children: [
                            Text(
                              'Good evening',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 20,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            SizedBox(width: AppSpacing.xs),
                            Icon(
                              Icons.wb_sunny_rounded,
                              color: Color(0xFFFFC94D),
                              size: 24,
                            ),
                          ],
                        ),
                      ),
                      const _IconBubble(
                        icon: Icons.notifications_none_rounded,
                        showDot: true,
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Stack(
                        clipBehavior: Clip.none,
                        children: [
                          ProfileAvatar(
                            name: fullName,
                            imageUrl: avatarUrl,
                            radius: 32,
                          ),
                          const Positioned(
                            right: -2,
                            bottom: -2,
                            child: _PresenceDot(),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 52),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Hello, $firstName',
                          style:
                              Theme.of(context).textTheme.headlineLarge?.copyWith(
                                    color: Colors.white,
                                    fontSize: 38,
                                    height: 1.05,
                                  ),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      const Icon(
                        Icons.waving_hand_rounded,
                        color: Color(0xFFFFC94D),
                        size: 30,
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 340),
                    child: Text(
                      'Welcome back. Your account is connected to your live customer profile.',
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                            color: Colors.white.withValues(alpha: 0.92),
                            fontSize: 18,
                            height: 1.5,
                            fontWeight: FontWeight.w400,
                          ),
                    ),
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

class _SearchCard extends StatelessWidget {
  const _SearchCard();

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(30),
        onTap: () {},
        child: Ink(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(30),
            boxShadow: const [
              BoxShadow(
                color: Color(0x1C6F4DC7),
                blurRadius: 40,
                offset: Offset(0, 20),
              ),
            ],
          ),
          child: Row(
            children: [
              const SizedBox(width: 6),
              const Icon(
                Icons.search_rounded,
                size: 38,
                color: Color(0xFF5B5490),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Text(
                  'Search services or providers',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        color: const Color(0xFF8A84C7),
                        fontWeight: FontWeight.w500,
                      ),
                ),
              ),
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(22),
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      Color(0xFF7C4DFF),
                      Color(0xFF8E63F6),
                    ],
                  ),
                ),
                child: const Icon(
                  Icons.tune_rounded,
                  color: Colors.white,
                  size: 28,
                ),
              ),
            ],
          ),
        ),
      ),
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
    final address = selectedLocation?.address.isNotEmpty == true
        ? selectedLocation!.address
        : 'Choose a saved address or use your current location';

    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(30),
        border: Border.all(color: Colors.white.withValues(alpha: 0.85), width: 2),
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
            color: Color(0x14684AB3),
            blurRadius: 30,
            offset: Offset(0, 12),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 86,
                height: 86,
                decoration: BoxDecoration(
                  color: const Color(0xFFF0E8FF),
                  borderRadius: BorderRadius.circular(28),
                ),
                child: const Icon(
                  Icons.location_on_outlined,
                  color: Color(0xFF7E47F3),
                  size: 44,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Service location',
                      style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                            fontSize: 22,
                          ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      selectedLocation?.label ?? 'Current location',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            color: const Color(0xFF56518B),
                            fontWeight: FontWeight.w500,
                          ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              FilledButton(
                onPressed: onChangePressed,
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.white.withValues(alpha: 0.88),
                  foregroundColor: AppColors.primary,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(24),
                  ),
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md,
                    vertical: AppSpacing.md,
                  ),
                  textStyle: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                child: const Text('Change'),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md,
                    vertical: AppSpacing.md,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.65),
                    borderRadius: BorderRadius.circular(22),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.home_outlined,
                        color: AppColors.primary,
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Text(
                          address,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style:
                              Theme.of(context).textTheme.bodyLarge?.copyWith(
                                    color: const Color(0xFF27204D),
                                  ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              const _MapBadge(),
            ],
          ),
        ],
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
        borderRadius: BorderRadius.circular(28),
        onTap: onTap,
        child: Ink(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.lg,
          ),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(28),
            boxShadow: const [
              BoxShadow(
                color: Color(0x12684AB3),
                blurRadius: 24,
                offset: Offset(0, 12),
              ),
            ],
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 84,
                height: 84,
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
                  size: 40,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                category.label,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontSize: 21,
                    ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                subtitle,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: const Color(0xFF7770A9),
                    ),
              ),
              const SizedBox(height: AppSpacing.md),
              Container(
                width: 50,
                height: 36,
                decoration: BoxDecoration(
                  color: const Color(0xFFF3EEFF),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: const Icon(
                  Icons.arrow_forward_rounded,
                  color: AppColors.primary,
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
            Color(0xFF35127B),
            Color(0xFF6731C9),
          ],
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x1A452091),
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
  const _IconBubble({required this.icon, this.showDot = false});

  final IconData icon;
  final bool showDot;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          width: 58,
          height: 58,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
          ),
          child: Icon(icon, color: Colors.white, size: 30),
        ),
        if (showDot)
          const Positioned(
            top: 10,
            right: 10,
            child: _AlertDot(),
          ),
      ],
    );
  }
}

class _AlertDot extends StatelessWidget {
  const _AlertDot();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 10,
      height: 10,
      decoration: BoxDecoration(
        color: const Color(0xFFFF4B4B),
        borderRadius: BorderRadius.circular(999),
      ),
    );
  }
}

class _PresenceDot extends StatelessWidget {
  const _PresenceDot();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 18,
      height: 18,
      decoration: BoxDecoration(
        color: const Color(0xFF22D06E),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0xFF25125E), width: 3),
      ),
    );
  }
}

class _MapBadge extends StatelessWidget {
  const _MapBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 110,
      height: 94,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(26),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFFF7F3FF),
            Color(0xFFE8DEFF),
          ],
        ),
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          Positioned(
            left: 20,
            right: 20,
            bottom: 18,
            child: Transform.rotate(
              angle: -0.42,
              child: Container(
                height: 30,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  color: Colors.white.withValues(alpha: 0.7),
                  border: Border.all(color: const Color(0xFFDCCCF8)),
                ),
              ),
            ),
          ),
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: AppColors.primary,
              borderRadius: BorderRadius.circular(21),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x336B43D8),
                  blurRadius: 20,
                  offset: Offset(0, 10),
                ),
              ],
            ),
            child: const Icon(
              Icons.location_on_rounded,
              color: Colors.white,
              size: 28,
            ),
          ),
        ],
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
            Color(0xFF5D2DD1),
            Color(0xFF34106D),
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

class _ProviderGroup extends StatelessWidget {
  const _ProviderGroup();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 106,
      height: 94,
      child: Stack(
        clipBehavior: Clip.none,
        children: const [
          Positioned(left: 0, top: 16, child: _ProviderAvatar(color: Color(0xFFFFE5C2), icon: Icons.restaurant_rounded)),
          Positioned(left: 28, top: 8, child: _ProviderAvatar(color: Color(0xFFFFE0D3), icon: Icons.cleaning_services_rounded)),
          Positioned(left: 54, top: 16, child: _ProviderAvatar(color: Color(0xFFDCCBFF), icon: Icons.local_taxi_rounded)),
          Positioned(right: 6, bottom: -6, child: _MiniShield()),
        ],
      ),
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
        color: const Color(0xFF7B49F1),
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
