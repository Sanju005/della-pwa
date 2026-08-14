import 'package:flutter/material.dart';

import '../../../core/routing/app_routes.dart';
import '../../../repositories/demo_repository.dart';
import '../../../services/provider_marketplace_service.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/loading_state.dart';
import '../../../widgets/provider_card.dart';
import '../../../widgets/swiper_app_bar.dart';

class ProviderListScreen extends StatelessWidget {
  const ProviderListScreen({
    super.key,
    required this.repository,
  });

  final DemoRepository repository;
  static const _marketplaceService = ProviderMarketplaceService();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const SwiperAppBar(
        title: 'Providers',
        subtitle: 'Live provider marketplace',
        showBack: true,
      ),
      body: FutureBuilder(
        future: _marketplaceService.fetchVisibleProviders(),
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const LoadingState(label: 'Loading providers...');
          }

          if (snapshot.hasError) {
            return EmptyState(
              title: 'Unable to load providers',
              subtitle: snapshot.error.toString(),
              icon: Icons.error_outline_rounded,
            );
          }

          final providers = snapshot.data ?? const [];
          if (providers.isEmpty) {
            return const EmptyState(
              title: 'No providers available',
              subtitle:
                  'No visible provider profiles were returned from Supabase yet.',
              icon: Icons.storefront_outlined,
            );
          }

          return ListView.separated(
            padding: AppSpacing.screenPadding,
            itemBuilder: (context, index) => ProviderCard(
              provider: providers[index],
              onTap: () => Navigator.of(context).pushNamed(
                AppRoutes.providerProfile,
                arguments: providers[index],
              ),
            ),
            separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.md),
            itemCount: providers.length,
          );
        },
      ),
    );
  }
}
