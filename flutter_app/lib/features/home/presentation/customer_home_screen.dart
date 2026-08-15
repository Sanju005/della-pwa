import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';

import '../../../core/routing/app_routes.dart';
import '../../../models/provider_summary.dart';
import '../../../previews/widget_preview_helpers.dart';
import '../../../repositories/demo_repository.dart';
import '../../../services/current_customer_service.dart';
import '../../../services/current_location_service.dart';
import '../../../services/customer_account_service.dart';
import '../../../services/customer_address_service.dart';
import '../../../services/provider_marketplace_service.dart';
import '../../../services/service_location_store.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/loading_state.dart';
import '../../../widgets/profile_avatar.dart';
import '../../../widgets/provider_card.dart';
import '../../../widgets/service_category_chip.dart';
import '../../../widgets/swiper_bottom_sheet.dart';
import '../../../widgets/swiper_button.dart';
import '../../../widgets/swiper_search_bar.dart';
import '../../../widgets/swiper_section_card.dart';

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

    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: AppSpacing.screenPadding,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                FutureBuilder(
                  future: _currentCustomerService.fetchCurrentCustomerProfile(),
                  builder: (context, snapshot) {
                    final customer = snapshot.data;
                    final firstName = customer?.firstName ?? 'Customer';
                    final fullName = customer?.fullName ?? 'Customer';
                    final subtitle = customer != null
                        ? 'Welcome back. Your account is connected to your live customer profile.'
                        : 'Find trusted help near you with a native Flutter UI foundation.';

                    return Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Hello, $firstName',
                                style: Theme.of(context).textTheme.headlineMedium,
                              ),
                              const SizedBox(height: AppSpacing.xs),
                              Text(
                                subtitle,
                                style: Theme.of(context).textTheme.bodyMedium,
                              ),
                            ],
                          ),
                        ),
                        ProfileAvatar(
                          name: fullName,
                          imageUrl: customer?.avatarUrl ?? '',
                        ),
                      ],
                    );
                  },
                ),
                const SizedBox(height: AppSpacing.lg),
                const SwiperSearchBar(),
                const SizedBox(height: AppSpacing.md),
                SwiperSectionCard(
                  title: 'Service location',
                  subtitle: _selectedLocation == null
                      ? 'Choose a saved address or your current location before browsing.'
                      : _selectedLocation!.label,
                  trailing: TextButton(
                    onPressed: _chooseLocation,
                    child: const Text('Change'),
                  ),
                  child: Text(
                    _selectedLocation?.address.isNotEmpty == true
                        ? _selectedLocation!.address
                        : 'No location selected yet.',
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                SwiperSectionCard(
                  title: 'Browse services',
                  subtitle:
                      'Choose a location and browse providers using your selected service area.',
                  child: GridView.builder(
                    itemCount: categories.length,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 3,
                          crossAxisSpacing: AppSpacing.sm,
                          mainAxisSpacing: AppSpacing.sm,
                          childAspectRatio: 0.9,
                        ),
                    itemBuilder: (context, index) => ServiceCategoryChip(
                      category: categories[index],
                      onTap: () => Navigator.of(context).pushNamed(
                        AppRoutes.providers,
                        arguments: categories[index].label.toLowerCase(),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                Container(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [AppColors.primary, AppColors.primaryDeep],
                    ),
                    borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Tonight\'s pick',
                        style: Theme.of(
                          context,
                        ).textTheme.labelLarge?.copyWith(color: Colors.white70),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        'Book a chef in under two minutes',
                        style: Theme.of(
                          context,
                        ).textTheme.titleLarge?.copyWith(color: Colors.white),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        'Browse live providers and continue into your booking flow.',
                        style: Theme.of(
                          context,
                        ).textTheme.bodyMedium?.copyWith(color: Colors.white70),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      SwiperButton(
                        label: 'View provider list',
                        isSecondary: true,
                        onPressed: () => Navigator.of(
                          context,
                        ).pushNamed(AppRoutes.providers),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                for (final section in _popularSections) ...[
                  _NearbyCategorySection(
                    title: section.title,
                    serviceKey: section.serviceKey,
                    locationSelection: _selectedLocation,
                    marketplaceService: _marketplaceService,
                  ),
                  const SizedBox(height: AppSpacing.lg),
                ],
                const SizedBox(height: AppSpacing.lg),
                SwiperSectionCard(
                  title: 'Quick actions',
                  child: Column(
                    children: [
                      SwiperButton(
                        label: 'Open booking overview',
                        icon: const Icon(Icons.calendar_today_rounded),
                        onPressed: () => Navigator.of(
                          context,
                        ).pushNamed(AppRoutes.bookingOverview),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      SwiperButton(
                        label: 'Preview support bottom sheet',
                        isSecondary: true,
                        onPressed: () {
                          SwiperBottomSheet.show<void>(
                            context,
                            title: 'Need help choosing?',
                            subtitle:
                                'This is the shared bottom-sheet style for future actions.',
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'You can use this sheet for filters, booking confirmations, or provider actions later on.',
                                  style: Theme.of(context).textTheme.bodyMedium,
                                ),
                                const SizedBox(height: AppSpacing.lg),
                                SwiperButton(
                                  label: 'Got it',
                                  onPressed: () => Navigator.of(context).pop(),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                SwiperSectionCard(
                  title: 'Your bookings',
                  subtitle:
                      'Open the overview to see upcoming and past bookings from Supabase.',
                  child: SwiperButton(
                    label: 'View bookings',
                    icon: const Icon(Icons.event_note_rounded),
                    onPressed: () => Navigator.of(
                      context,
                    ).pushNamed(AppRoutes.bookingOverview),
                  ),
                ),
                const SizedBox(height: 120),
              ],
            ),
          ),
        ),
      ],
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
            child: LoadingState(label: 'Loading nearby providers...'),
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
              height: 520,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: providers.length.clamp(0, 5) + 1,
                separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.md),
                itemBuilder: (context, index) {
                  if (index >= providers.length.clamp(0, 5)) {
                    return _ShowAllProvidersCard(serviceKey: serviceKey, title: title);
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
        width: 280,
        padding: const EdgeInsets.all(AppSpacing.lg),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(26),
          border: Border.all(color: const Color(0xFFDCCCF0)),
          gradient: const LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Color(0xFFFCF8FF),
              Color(0xFFF7EFFF),
            ],
          ),
          boxShadow: const [
            BoxShadow(
              color: Color(0x0F172A10),
              blurRadius: 24,
              offset: Offset(0, 10),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(18),
                gradient: const LinearGradient(
                  colors: [AppColors.primary, AppColors.primaryDeep],
                ),
              ),
              child: const Icon(
                Icons.arrow_forward_rounded,
                color: Colors.white,
                size: 28,
              ),
            ),
            const Spacer(),
            Text(
              'Show All',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF162544),
                  ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'See all $label nearby and explore more provider options.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppColors.textSecondary,
                    height: 1.5,
                  ),
            ),
            const Spacer(),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.md,
              ),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.84),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE4D7F5)),
              ),
              child: Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Open full list',
                      style: TextStyle(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  Container(
                    width: 36,
                    height: 36,
                    decoration: const BoxDecoration(
                      color: AppColors.primarySoft,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.arrow_forward_rounded,
                      color: AppColors.primary,
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
}

@Preview(
  name: 'Customer Home',
  size: Size(430, 932),
  wrapper: previewScreenSurface,
)
Widget customerHomeScreenPreview() {
  return CustomerHomeScreen(repository: DemoRepository());
}
