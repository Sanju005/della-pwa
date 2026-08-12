import 'package:flutter/material.dart';

import '../../../repositories/demo_repository.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/profile_avatar.dart';
import '../../../widgets/swiper_section_card.dart';
import '../../../widgets/verified_badge.dart';

class ProviderProfileDemoScreen extends StatelessWidget {
  const ProviderProfileDemoScreen({
    super.key,
    required this.repository,
  });

  final DemoRepository repository;

  @override
  Widget build(BuildContext context) {
    final provider = repository.getFeaturedProvider();

    return ListView(
      padding: AppSpacing.screenPadding,
      children: [
        SwiperSectionCard(
          title: provider.name,
          subtitle: provider.service,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ProfileAvatar(name: provider.name, radius: 30),
              const SizedBox(height: AppSpacing.md),
              VerifiedBadge(
                label: 'Phone verified',
                verified: provider.phoneVerified,
              ),
              const SizedBox(height: AppSpacing.sm),
              VerifiedBadge(
                label: 'Identity verified',
                verified: provider.identityVerified,
              ),
            ],
          ),
        ),
      ],
    );
  }
}
