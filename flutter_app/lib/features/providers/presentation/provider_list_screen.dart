import 'package:flutter/material.dart';

import '../../../core/routing/app_routes.dart';
import '../../../repositories/demo_repository.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/provider_card.dart';
import '../../../widgets/swiper_app_bar.dart';

class ProviderListScreen extends StatelessWidget {
  const ProviderListScreen({
    super.key,
    required this.repository,
  });

  final DemoRepository repository;

  @override
  Widget build(BuildContext context) {
    final providers = repository.getProviders();

    return Scaffold(
      appBar: const SwiperAppBar(
        title: 'Providers',
        subtitle: 'UI-only discovery list',
        showBack: true,
      ),
      body: ListView.separated(
        padding: AppSpacing.screenPadding,
        itemBuilder: (context, index) => ProviderCard(
          provider: providers[index],
          onTap: () => Navigator.of(
            context,
          ).pushNamed(AppRoutes.providerProfile, arguments: providers[index]),
        ),
        separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.md),
        itemCount: providers.length,
      ),
    );
  }
}
