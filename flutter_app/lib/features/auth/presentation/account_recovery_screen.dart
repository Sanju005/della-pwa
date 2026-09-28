import 'package:flutter/material.dart';

import '../../../core/utils/support_contact.dart';
import '../../../services/auth_service.dart';
import '../../../services/otp_service.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import 'auth_flow_scaffold.dart';
import 'otp_step_view.dart';
import 'pin_step_view.dart';

enum _RecoveryStep { emailOtp, choosePin, confirmPin }

/// Case B from Phase 1: an unknown device signing into an account that has
/// no Swiper PIN yet. Phone OTP alone was not enough to get here — this
/// screen collects the second proof (an OTP to the account's own verified
/// recovery email) and a brand-new PIN, then retries the sign-in that sent
/// us here with both. If the account has no verified recovery email at
/// all, [recoveryEmail] is null and this shows a dead-end notice instead —
/// there is no insecure fallback.
class AccountRecoveryScreen extends StatefulWidget {
  const AccountRecoveryScreen({
    super.key,
    required this.recoveryEmail,
    required this.signIn,
  });

  final String? recoveryEmail;
  final PendingPhoneSignIn signIn;

  @override
  State<AccountRecoveryScreen> createState() => _AccountRecoveryScreenState();
}

class _AccountRecoveryScreenState extends State<AccountRecoveryScreen> {
  late final RealOtpService _emailOtpService = RealOtpService(purpose: 'email');

  _RecoveryStep _step = _RecoveryStep.emailOtp;
  String? _emailChallengeId;
  String? _chosenPin;
  bool _sendingCode = true;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _sendInitialCode();
  }

  Future<void> _sendInitialCode() async {
    final email = widget.recoveryEmail;
    if (email == null) {
      setState(() => _sendingCode = false);
      return;
    }
    try {
      await _emailOtpService.sendOtp(email);
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _error = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) {
        setState(() => _sendingCode = false);
      }
    }
  }

  Future<void> _handleEmailVerified(String code) async {
    setState(() {
      _emailChallengeId = _emailOtpService.lastChallengeId;
      _step = _RecoveryStep.choosePin;
    });
  }

  Future<void> _handlePinChosen(String pin) async {
    setState(() {
      _chosenPin = pin;
      _step = _RecoveryStep.confirmPin;
    });
  }

  Future<void> _handlePinConfirmed(String pin) async {
    if (pin != _chosenPin) {
      setState(() => _step = _RecoveryStep.choosePin);
      throw Exception('PINs did not match. Please try again.');
    }

    final emailChallengeId = _emailChallengeId;
    if (emailChallengeId == null) {
      setState(() => _step = _RecoveryStep.emailOtp);
      throw Exception('Something expired. Please start over.');
    }

    final result = await widget.signIn(emailChallengeId: emailChallengeId, newPin: pin);
    if (!mounted) {
      return;
    }
    Navigator.of(context).pop(result);
  }

  @override
  Widget build(BuildContext context) {
    if (widget.recoveryEmail == null) {
      return const Scaffold(
        body: SafeArea(child: _NoRecoveryOptionNotice()),
      );
    }

    return AuthFlowScaffold(
      showBack: true,
      title: 'Verify it\'s you',
      subtitle: switch (_step) {
        _RecoveryStep.emailOtp =>
          'This is a new device, and your account doesn\'t have a Swiper PIN yet. Enter the 6-digit code sent to\n${widget.recoveryEmail}',
        _RecoveryStep.choosePin => 'Choose a new 6-digit Swiper PIN.',
        _RecoveryStep.confirmPin => 'Enter your new PIN again to confirm.',
      },
      child: _sendingCode
          ? const Padding(
              padding: EdgeInsets.symmetric(vertical: AppSpacing.xl),
              child: Center(child: CircularProgressIndicator()),
            )
          : _buildStep(),
    );
  }

  Widget _buildStep() {
    switch (_step) {
      case _RecoveryStep.emailOtp:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            OtpStepView(
              key: ValueKey(widget.recoveryEmail),
              contactValue: widget.recoveryEmail ?? '',
              otpService: _emailOtpService,
              onVerified: _handleEmailVerified,
            ),
            if (_error.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.md),
              Text(_error, style: const TextStyle(fontSize: 12.5, color: AppColors.error)),
            ],
          ],
        );
      case _RecoveryStep.choosePin:
        return PinStepView(
          key: const ValueKey('choose'),
          title: '',
          subtitle: '',
          onSubmit: _handlePinChosen,
        );
      case _RecoveryStep.confirmPin:
        return PinStepView(
          key: const ValueKey('confirm'),
          title: '',
          subtitle: '',
          onSubmit: _handlePinConfirmed,
        );
    }
  }
}

Future<void> _emailSupport() => emailSwiperSupport(subject: 'Account recovery help needed');

class _NoRecoveryOptionNotice extends StatelessWidget {
  const _NoRecoveryOptionNotice();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error_outline_rounded, color: AppColors.error, size: 48),
          const SizedBox(height: AppSpacing.md),
          const Text(
            "This is a new device, and this account has neither a Swiper PIN nor a verified recovery email on file.",
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.sm),
          const Text(
            'Please contact Swiper support to recover your account.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.textSecondary),
          ),
          const SizedBox(height: AppSpacing.lg),
          FilledButton.icon(
            onPressed: _emailSupport,
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
