import 'package:flutter/material.dart';

import '../../../core/routing/app_routes.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/swiper_button.dart';
import 'auth_flow_scaffold.dart';

class CustomerRegisterVerifyScreen extends StatefulWidget {
  const CustomerRegisterVerifyScreen({super.key});

  @override
  State<CustomerRegisterVerifyScreen> createState() =>
      _CustomerRegisterVerifyScreenState();
}

class _CustomerRegisterVerifyScreenState
    extends State<CustomerRegisterVerifyScreen> {
  final _controllers = List.generate(
    6,
    (_) => TextEditingController(),
    growable: false,
  );
  final _focusNodes = List.generate(6, (_) => FocusNode(), growable: false);
  String? _error;

  @override
  void dispose() {
    for (final controller in _controllers) {
      controller.dispose();
    }
    for (final focusNode in _focusNodes) {
      focusNode.dispose();
    }
    super.dispose();
  }

  void _submit() {
    final code = _controllers.map((controller) => controller.text).join();
    if (code.length < 6) {
      setState(() => _error = 'Enter the full 6-digit OTP code.');
      return;
    }
    if (code != '123456') {
      setState(() => _error = 'Use demo OTP `123456` for this Flutter flow.');
      return;
    }
    Navigator.of(
      context,
    ).pushReplacementNamed(AppRoutes.registerCustomerSuccess);
  }

  @override
  Widget build(BuildContext context) {
    final args =
        ModalRoute.of(context)?.settings.arguments as Map<Object?, Object?>?;
    final phone = args?['phone'] as String? ?? '+60 12-345 6789';

    return AuthFlowScaffold(
      hero: const AuthCircleHero(icon: Icons.verified_user_outlined),
      title: 'Verify Your Account',
      subtitle: 'We have sent a 6-digit OTP code to your phone number',
      showBack: true,
      bottom: SwiperButton(label: 'Verify & Continue', onPressed: _submit),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Phone Number', style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: AppSpacing.sm),
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border.all(color: AppColors.border),
              borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            ),
            child: Row(
              children: [
                const Icon(Icons.call_outlined, color: AppColors.primary),
                const SizedBox(width: AppSpacing.sm),
                Text(phone, style: Theme.of(context).textTheme.bodyLarge),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          Text('Enter OTP Code', style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: AppSpacing.md),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: List.generate(6, (index) {
              return SizedBox(
                width: 46,
                child: TextField(
                  controller: _controllers[index],
                  focusNode: _focusNodes[index],
                  textAlign: TextAlign.center,
                  maxLength: 1,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(counterText: ''),
                  onChanged: (value) {
                    setState(() => _error = null);
                    if (value.isNotEmpty && index < 5) {
                      _focusNodes[index + 1].requestFocus();
                    }
                  },
                ),
              );
            }),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            'Resend OTP (00:30)',
            style: Theme.of(
              context,
            ).textTheme.labelLarge?.copyWith(color: AppColors.primary),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Demo OTP: 123456',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          if (_error != null) ...[
            const SizedBox(height: AppSpacing.md),
            Text(
              _error!,
              style: Theme.of(
                context,
              ).textTheme.labelMedium?.copyWith(color: AppColors.error),
            ),
          ],
        ],
      ),
    );
  }
}
