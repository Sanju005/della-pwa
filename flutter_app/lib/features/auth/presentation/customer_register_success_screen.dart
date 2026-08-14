import 'package:flutter/material.dart';

import '../../../core/routing/app_routes.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/swiper_button.dart';
import 'auth_flow_scaffold.dart';

class CustomerRegisterSuccessScreen extends StatelessWidget {
  const CustomerRegisterSuccessScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final items = const [
      (
        'Find nearby service providers',
        'Browse and discover trusted professionals near you.',
        Icons.search_rounded,
      ),
      (
        'Chat directly with providers',
        'Ask questions and confirm details before booking.',
        Icons.chat_bubble_outline_rounded,
      ),
      (
        'Book instantly',
        'Reserve services quickly with fewer steps.',
        Icons.bolt_rounded,
      ),
      (
        'Track your bookings',
        'Stay updated on schedules and upcoming jobs.',
        Icons.calendar_today_rounded,
      ),
    ];

    return AuthFlowScaffold(
      hero: Stack(
        alignment: Alignment.center,
        children: [
          Container(
            width: 118,
            height: 118,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.primary,
            ),
            child: const Icon(
              Icons.check_rounded,
              color: Colors.white,
              size: 54,
            ),
          ),
        ],
      ),
      title: 'Account Created!',
      subtitle: 'You can now search and book trusted services near you.',
      bottom: SwiperButton(
        label: 'Go to Home',
        onPressed: () => Navigator.of(
          context,
        ).pushNamedAndRemoveUntil(AppRoutes.customerShell, (route) => false),
      ),
      child: Column(
        children: items.map((item) {
          return Container(
            margin: const EdgeInsets.only(bottom: AppSpacing.md),
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  height: 42,
                  width: 42,
                  decoration: BoxDecoration(
                    color: AppColors.primarySoft,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Icon(item.$3, color: AppColors.primary),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.$1,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        item.$2,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }
}
