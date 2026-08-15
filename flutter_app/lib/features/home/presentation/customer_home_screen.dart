import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';

import '../../../core/routing/app_routes.dart';
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
                        ProfileAvatar(name: fullName),
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
                FutureBuilder(
                  future: _marketplaceService.fetchVisibleProviders(
                    locationSelection: _selectedLocation,
                  ),
                  builder: (context, snapshot) {
                    if (snapshot.connectionState != ConnectionState.done) {
                      return const Padding(
                        padding: EdgeInsets.symmetric(vertical: AppSpacing.lg),
                        child: LoadingState(label: 'Loading featured provider...'),
                      );
                    }

                    if (snapshot.hasError) {
                      return Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.lg),
                        child: const EmptyState(
                          title: 'Unable to load featured provider',
                          subtitle: 'Unable to load providers. Please try again.',
                          icon: Icons.error_outline_rounded,
                        ),
                      );
                    }

                    final providers = snapshot.data ?? const [];
                    if (providers.isEmpty) {
                      return const Padding(
                        padding: EdgeInsets.only(bottom: AppSpacing.lg),
                        child: EmptyState(
                          title: 'No providers yet',
                          subtitle:
                              'No providers matched the selected service location.',
                          icon: Icons.storefront_outlined,
                        ),
                      );
                    }

                    final featuredProvider = providers.first;
                    return SwiperSectionCard(
                      title: 'Featured provider',
                      trailing: TextButton(
                        onPressed: () =>
                            Navigator.of(context).pushNamed(AppRoutes.providers),
                        child: const Text('See all'),
                      ),
                      child: ProviderCard(
                        provider: featuredProvider,
                        onTap: () => Navigator.of(context).pushNamed(
                          AppRoutes.providerProfile,
                          arguments: featuredProvider,
                        ),
                      ),
                    );
                  },
                ),
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

@Preview(
  name: 'Customer Home',
  size: Size(430, 932),
  wrapper: previewScreenSurface,
)
Widget customerHomeScreenPreview() {
  return CustomerHomeScreen(repository: DemoRepository());
}
