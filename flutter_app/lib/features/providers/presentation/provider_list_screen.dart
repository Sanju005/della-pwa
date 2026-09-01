import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../../core/animation/app_motion.dart';
import '../../../core/routing/app_routes.dart';
import '../../../models/provider_summary.dart';
import '../../../repositories/demo_repository.dart';
import '../../../services/customer_profile_api_service.dart';
import '../../../services/provider_marketplace_service.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/app_reveal.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/provider_card.dart';
import '../../../widgets/provider_skeleton_card.dart';
import '../../../widgets/swiper_app_bar.dart';

class ProviderListScreen extends StatefulWidget {
  const ProviderListScreen({super.key, required this.repository});

  final DemoRepository repository;
  @override
  State<ProviderListScreen> createState() => _ProviderListScreenState();
}

class _ProviderListScreenState extends State<ProviderListScreen> {
  static const _marketplaceService = ProviderMarketplaceService();
  static const _profileApiService = CustomerProfileApiService();
  bool _allowEntranceAnimations = true;
  bool _didScheduleAnimationStop = false;
  bool _didInitCatalog = false;
  String? _service;
  late Future<ProviderCatalogResult> _catalogFuture;
  Set<String> _favoriteProviderIds = {};

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_didInitCatalog) {
      return;
    }
    _didInitCatalog = true;
    final args = ModalRoute.of(context)?.settings.arguments;
    _service = args is String && args.trim().isNotEmpty
        ? args.trim().toLowerCase()
        : null;
    _catalogFuture = _marketplaceService.fetchCatalog(service: _service);
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

  @override
  Widget build(BuildContext context) {
    final service = _service;

    return Scaffold(
      appBar: SwiperAppBar(
        title: 'Providers',
        subtitle: service == null
            ? 'Live provider marketplace'
            : '${service[0].toUpperCase()}${service.substring(1)} providers',
        showBack: true,
      ),
      body: FutureBuilder<ProviderCatalogResult>(
        future: _catalogFuture,
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
            itemBuilder: (context, index) {
              final provider = providers[index].copyWith(
                isFavorite: _favoriteProviderIds.contains(providers[index].id),
              );
              return AppReveal(
                key: ValueKey('provider-list-${provider.id}'),
                delay: _allowEntranceAnimations
                    ? Duration(milliseconds: 40 + (index * 55))
                    : Duration.zero,
                duration: AppMotion.normal,
                beginOffset: const Offset(0, 0.05),
                beginScale: 0.98,
                child: ProviderCard(
                  provider: provider,
                  onTap: () => Navigator.of(
                    context,
                  ).pushNamed(AppRoutes.providerProfile, arguments: provider),
                  onFavoriteToggle: () => _toggleFavorite(provider),
                ),
              );
            },
            separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.md),
            itemCount: providers.length,
          );
        },
      ),
    );
  }
}
