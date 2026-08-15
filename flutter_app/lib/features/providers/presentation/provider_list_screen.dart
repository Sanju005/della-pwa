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
    final args = ModalRoute.of(context)?.settings.arguments;
    final service = args is String && args.trim().isNotEmpty
        ? args.trim().toLowerCase()
        : null;

    return Scaffold(
      appBar: SwiperAppBar(
        title: 'Providers',
        subtitle: service == null
            ? 'Live provider marketplace'
            : '${service[0].toUpperCase()}${service.substring(1)} providers',
        showBack: true,
      ),
      body: FutureBuilder<ProviderCatalogResult>(
        future: _marketplaceService.fetchCatalog(service: service),
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const LoadingState(label: 'Loading providers...');
          }

          if (snapshot.hasError) {
            return EmptyState(
              title: 'Unable to load providers',
              subtitle: 'Unable to load providers. Please try again.',
              icon: Icons.error_outline_rounded,
            );
          }

          final catalog = snapshot.data;
          final providers = catalog?.listings ?? const [];
          if (providers.isEmpty) {
            return EmptyState(
              title: 'No providers available',
              subtitle: service == null
                  ? 'No provider listings are available right now.'
                  : 'No providers are available for this service right now.',
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
