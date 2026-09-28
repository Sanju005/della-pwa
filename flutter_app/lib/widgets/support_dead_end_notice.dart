import 'package:flutter/material.dart';

import '../core/utils/support_contact.dart';
import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';

/// Shared "no self-service option, contact support" screen — shown whenever
/// a security flow correctly refuses to grant something (account recovery,
/// a phone-number change) because the account has no verified fallback on
/// file. There is deliberately no bypass here; a human at support is the
/// only path forward.
class SupportDeadEndNotice extends StatelessWidget {
  const SupportDeadEndNotice({
    super.key,
    required this.message,
    this.emailSubject = 'Swiper support request',
  });

  final String message;
  final String emailSubject;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error_outline_rounded, color: AppColors.error, size: 48),
          const SizedBox(height: AppSpacing.md),
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: AppSpacing.sm),
          const Text(
            'Please contact Swiper support to continue.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.textSecondary),
          ),
          const SizedBox(height: AppSpacing.lg),
          FilledButton.icon(
            onPressed: () => emailSwiperSupport(subject: emailSubject),
            icon: const Icon(Icons.email_outlined),
            label: const Text('Email Swiper Support'),
          ),
          const SizedBox(height: AppSpacing.sm),
          TextButton(
            onPressed: () => Navigator.of(context).maybePop(),
            child: const Text('Back'),
          ),
        ],
      ),
    );
  }
}
