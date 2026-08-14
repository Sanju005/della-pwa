import 'package:flutter/material.dart';

import '../../../core/routing/app_routes.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import 'auth_flow_scaffold.dart';

class SignupEntryScreen extends StatelessWidget {
  const SignupEntryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return AuthFlowScaffold(
      hero: const AuthCircleHero(icon: Icons.person_add_alt_1_rounded),
      title: 'Create account',
      subtitle:
          'Choose how you want to join Swiper and follow the matching signup flow.',
      showBack: true,
      bottom: TextButton(
        onPressed: () =>
            Navigator.of(context).pushReplacementNamed(AppRoutes.login),
        child: const Text('Already have an account? Log in'),
      ),
      child: Column(
        children: [
          _SignupOptionCard(
            icon: Icons.person_outline_rounded,
            title: 'Create as User',
            description:
                'Book trusted services near you and manage your bookings in one place.',
            onTap: () =>
                Navigator.of(context).pushNamed(AppRoutes.registerCustomer),
          ),
          const SizedBox(height: AppSpacing.md),
          _SignupOptionCard(
            icon: Icons.home_repair_service_rounded,
            title: 'Create as Service Provider',
            description:
                'Set up your profile, choose services, and submit your listing for review.',
            onTap: () =>
                Navigator.of(context).pushNamed(AppRoutes.registerProvider),
          ),
        ],
      ),
    );
  }
}

class _SignupOptionCard extends StatelessWidget {
  const _SignupOptionCard({
    required this.icon,
    required this.title,
    required this.description,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String description;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        child: Ink(
          padding: const EdgeInsets.all(AppSpacing.lg),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                height: 46,
                width: 46,
                decoration: BoxDecoration(
                  color: AppColors.primarySoft,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, color: AppColors.primary),
              ),
              const SizedBox(height: AppSpacing.md),
              Text(title, style: theme.textTheme.titleMedium),
              const SizedBox(height: AppSpacing.xs),
              Text(description, style: theme.textTheme.bodyMedium),
              const SizedBox(height: AppSpacing.md),
              const Align(
                alignment: Alignment.centerRight,
                child: Icon(
                  Icons.arrow_forward_rounded,
                  color: AppColors.primary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
