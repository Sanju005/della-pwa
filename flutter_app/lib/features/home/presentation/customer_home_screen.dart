import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';

import '../../../core/routing/app_routes.dart';
import '../../../previews/widget_preview_helpers.dart';
import '../../../repositories/demo_repository.dart';
import '../../../services/demo_customer_auth_store.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/profile_avatar.dart';
import '../../../widgets/provider_card.dart';
import '../../../widgets/service_category_chip.dart';
import '../../../widgets/swiper_bottom_sheet.dart';
import '../../../widgets/swiper_button.dart';
import '../../../widgets/swiper_search_bar.dart';
import '../../../widgets/swiper_section_card.dart';

class CustomerHomeScreen extends StatelessWidget {
  const CustomerHomeScreen({super.key, required this.repository});

  final DemoRepository repository;

  @override
  Widget build(BuildContext context) {
    final categories = repository.getCustomerCategories();
    final featuredProvider = repository.getFeaturedProvider();
    final bookings = repository.getBookings();
    final customer = DemoCustomerAuthStore.currentCustomer();
    final firstName =
        (customer?['firstName'] as String?)?.trim().isNotEmpty == true
        ? (customer!['firstName'] as String).trim()
        : 'Sarah';
    final lastName =
        (customer?['lastName'] as String?)?.trim().isNotEmpty == true
        ? (customer!['lastName'] as String).trim()
        : 'Lim';
    final fullName = '$firstName $lastName'.trim();
    final subtitle = customer != null
        ? 'Welcome back. Your account is signed in with your phone verification flow.'
        : 'Find trusted help near you with a native Flutter UI foundation.';

    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: AppSpacing.screenPadding,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
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
                ),
                const SizedBox(height: AppSpacing.lg),
                const SwiperSearchBar(),
                const SizedBox(height: AppSpacing.lg),
                SwiperSectionCard(
                  title: 'Browse services',
                  subtitle:
                      'Tap into the Swiper categories we will later connect to live data.',
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
                      onTap: () =>
                          Navigator.of(context).pushNamed(AppRoutes.providers),
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
                        'This card is UI-only for now, but it matches the future booking flow shape.',
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
                SwiperSectionCard(
                  title: 'Featured provider',
                  trailing: TextButton(
                    onPressed: () =>
                        Navigator.of(context).pushNamed(AppRoutes.providers),
                    child: const Text('See all'),
                  ),
                  child: ProviderCard(
                    provider: featuredProvider,
                    onTap: () => Navigator.of(
                      context,
                    ).pushNamed(AppRoutes.providerProfile),
                  ),
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
                  title: 'Upcoming booking',
                  subtitle: 'Current mock booking card style',
                  child: Text(
                    '${bookings.first.title} with ${bookings.first.providerName}',
                    style: Theme.of(context).textTheme.bodyLarge,
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
