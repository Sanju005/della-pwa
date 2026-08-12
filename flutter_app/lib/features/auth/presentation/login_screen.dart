import 'package:flutter/material.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/routing/app_routes.dart';
import '../../../repositories/demo_repository.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/swiper_button.dart';
import '../../../widgets/swiper_password_field.dart';
import '../../../widgets/swiper_text_field.dart';

class LoginScreen extends StatelessWidget {
  LoginScreen({super.key, required this.repository});

  final DemoRepository repository;
  final TextEditingController _emailController =
      TextEditingController(text: 'demo@myswiper.my');
  final TextEditingController _passwordController =
      TextEditingController(text: 'password123');

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: AppSpacing.screenPadding,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: AppSpacing.xl),
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppColors.primary, AppColors.primaryDeep],
                  ),
                  borderRadius: BorderRadius.circular(22),
                ),
                child: const Icon(Icons.swipe_rounded, color: Colors.white, size: 32),
              ),
              const SizedBox(height: AppSpacing.xl),
              Text(
                'Welcome back to ${AppConstants.appName}',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                'Phase 2 is UI-only, so this screen routes into polished demo flows without touching Supabase yet.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: AppSpacing.xl),
              SwiperTextField(
                label: 'Email',
                hintText: 'Enter your email',
                controller: _emailController,
                prefixIcon: const Icon(Icons.mail_outline_rounded),
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: AppSpacing.md),
              SwiperPasswordField(
                label: 'Password',
                hintText: 'Enter your password',
                controller: _passwordController,
              ),
              const SizedBox(height: AppSpacing.xl),
              SwiperButton(
                label: 'Open customer demo',
                icon: const Icon(Icons.arrow_forward_rounded),
                onPressed: () => Navigator.of(context).pushNamed(AppRoutes.customerShell),
              ),
              const SizedBox(height: AppSpacing.sm),
              SwiperButton(
                label: 'Open provider demo',
                isSecondary: true,
                icon: const Icon(Icons.work_outline_rounded),
                onPressed: () => Navigator.of(context).pushNamed(AppRoutes.providerShell),
              ),
              const SizedBox(height: AppSpacing.xl),
              Container(
                padding: const EdgeInsets.all(AppSpacing.lg),
                decoration: BoxDecoration(
                  color: AppColors.primarySoft,
                  borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.info_outline_rounded, color: AppColors.primary),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Text(
                        'Next phases can swap these demo screens over to the existing backend contracts without rebuilding the design system.',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: AppColors.textPrimary,
                            ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
