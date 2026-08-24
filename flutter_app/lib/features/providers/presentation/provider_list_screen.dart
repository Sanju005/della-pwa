import 'package:flutter/material.dart';

import '../../../core/animation/app_motion.dart';
import '../../../core/routing/app_routes.dart';
import '../../../repositories/demo_repository.dart';
import '../../../services/provider_marketplace_service.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/app_reveal.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/provider_card.dart';
import '../../../widgets/provider_skeleton_card.dart';
import '../../../widgets/swiper_app_bar.dart';

class ProviderListScreen extends StatefulWidget {
  const ProviderListScreen({
    super.key,
    required this.repository,
  });

  final DemoRepository repository;
  @override
  State<ProviderListScreen> createState() => _ProviderListScreenState();
}

class _ProviderListScreenState extends State<ProviderListScreen> {
  static const _marketplaceService = ProviderMarketplaceService();
  bool _allowEntranceAnimations = true;
  bool _didScheduleAnimationStop = false;

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
            return ListView.separated(
              padding: AppSpacing.screenPadding,
              itemCount: 4,
              separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.md),
              itemBuilder: (context, index) => const ProviderSkeletonCard(),
            );
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

          if (!_didScheduleAnimationStop) {
            _didScheduleAnimationStop = true;
            WidgetsBinding.instance.addPostFrameCallback((_) async {
              await Future<void>.delayed(
                AppMotion.reduceMotion(context)
                    ? Duration.zero
                    : const Duration(milliseconds: 900),
              );
              if (mounted) {
                setState(() => _allowEntranceAnimations = false);
              }
            });
          }

          return ListView.separated(
            padding: AppSpacing.screenPadding,
            itemBuilder: (context, index) => AppReveal(
              key: ValueKey('provider-list-${providers[index].id}'),
              delay: _allowEntranceAnimations
                  ? Duration(milliseconds: 40 + (index * 55))
                  : Duration.zero,
              duration: AppMotion.normal,
              beginOffset: const Offset(0, 0.05),
              beginScale: 0.98,
              child: ProviderCard(
                provider: providers[index],
                onTap: () => Navigator.of(context).pushNamed(
                  AppRoutes.providerProfile,
                  arguments: providers[index],
                ),
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
