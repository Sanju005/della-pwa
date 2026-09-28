import 'package:flutter/material.dart';

import '../../../core/utils/phone_number.dart';
import '../../../services/otp_service.dart';
import '../../../services/pin_service.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/swiper_button.dart';
import 'auth_flow_scaffold.dart';
import 'otp_step_view.dart';
import 'pin_step_view.dart';

enum _ForgotPinStep {
  phone,
  phoneOtp,
  noRecoveryEmail,
  emailOtp,
  choosePin,
  confirmPin,
  done,
}

/// "Forgot PIN" recovery — deliberately requires BOTH a phone OTP and an
/// OTP to the account's own already-verified email before a new PIN can be
/// set. Phone OTP alone is never enough here, the same rule as everywhere
/// else in Phase 1 — a recycled-number holder who reaches this screen still
/// cannot reset the PIN without also controlling the original verified
/// email address.
class ForgotPinScreen extends StatefulWidget {
  const ForgotPinScreen({super.key});

  @override
  State<ForgotPinScreen> createState() => _ForgotPinScreenState();
}

class _ForgotPinScreenState extends State<ForgotPinScreen> {
  static const _pinService = PinService();

  final _countryCodeController = TextEditingController(text: '60');
  final _phoneController = TextEditingController();
  final RealOtpService _phoneOtpService = RealOtpService(purpose: 'phone');
  late final RealOtpService _emailOtpService = RealOtpService(purpose: 'email');

  _ForgotPinStep _step = _ForgotPinStep.phone;
  bool _sending = false;
  String? _errorMessage;
  String? _normalizedPhone;
  String? _phoneChallengeId;
  String? _recoveryEmail;
  String? _emailChallengeId;
  String? _chosenPin;

  @override
  void dispose() {
    _countryCodeController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _continueFromPhone() async {
    FocusScope.of(context).unfocus();
    final normalized = normalizePhoneNumber(
      _countryCodeController.text,
      _phoneController.text,
    );
    if (normalized == null) {
      setState(() => _errorMessage = 'Enter a valid mobile number.');
      return;
    }

    setState(() {
      _errorMessage = null;
      _normalizedPhone = normalized;
      _sending = true;
    });
    try {
      await _phoneOtpService.sendOtp(normalized);
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _sending = false;
        _errorMessage = error.toString().replaceFirst('Exception: ', '');
      });
      return;
    }
    if (!mounted) {
      return;
    }
    setState(() {
      _sending = false;
      _step = _ForgotPinStep.phoneOtp;
    });
  }

  Future<void> _handlePhoneOtpVerified(String code) async {
    final challengeId = _phoneOtpService.lastChallengeId;
    if (challengeId == null) {
      setState(() {
        _step = _ForgotPinStep.phone;
        _errorMessage = 'Verification expired. Please try again.';
      });
      return;
    }
    _phoneChallengeId = challengeId;

    try {
      final email = await _pinService.lookupRecoveryEmail(
        phoneCountryCode:
            '+${_countryCodeController.text.replaceAll(RegExp(r'\D'), '')}',
        phoneNumber: _phoneController.text.trim(),
        phoneChallengeId: challengeId,
      );
      _recoveryEmail = email;
      await _emailOtpService.sendOtp(email);
      if (!mounted) {
        return;
      }
      setState(() => _step = _ForgotPinStep.emailOtp);
    } on AccountRecoveryRequiredException {
      if (!mounted) {
        return;
      }
      setState(() => _step = _ForgotPinStep.noRecoveryEmail);
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _step = _ForgotPinStep.phone;
        _errorMessage = error.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _handleEmailOtpVerified(String code) async {
    final challengeId = _emailOtpService.lastChallengeId;
    if (challengeId == null) {
      setState(() {
        _step = _ForgotPinStep.phone;
        _errorMessage = 'Verification expired. Please try again.';
      });
      return;
    }
    setState(() {
      _emailChallengeId = challengeId;
      _step = _ForgotPinStep.choosePin;
    });
  }

  Future<void> _handlePinChosen(String pin) async {
    setState(() {
      _chosenPin = pin;
      _step = _ForgotPinStep.confirmPin;
    });
  }

  Future<void> _handlePinConfirmed(String pin) async {
    if (pin != _chosenPin) {
      setState(() => _step = _ForgotPinStep.choosePin);
      throw Exception('PINs did not match. Please try again.');
    }

    await _pinService.resetPin(
      phoneCountryCode:
          '+${_countryCodeController.text.replaceAll(RegExp(r'\D'), '')}',
      phoneNumber: _phoneController.text.trim(),
      phoneChallengeId: _phoneChallengeId!,
      emailChallengeId: _emailChallengeId!,
      newPin: pin,
    );
    if (!mounted) {
      return;
    }
    setState(() => _step = _ForgotPinStep.done);
  }

  @override
  Widget build(BuildContext context) {
    return AuthFlowScaffold(
      showBack: _step != _ForgotPinStep.phone,
      title: 'Reset Swiper PIN',
      subtitle: switch (_step) {
        _ForgotPinStep.phone =>
          'Enter the phone number on your Swiper account.',
        _ForgotPinStep.phoneOtp =>
          'Enter the 6-digit code sent to\n${_normalizedPhone == null ? '' : formatPhoneForDisplay(_normalizedPhone!)}',
        _ForgotPinStep.noRecoveryEmail => '',
        _ForgotPinStep.emailOtp =>
          'Enter the 6-digit code sent to\n${_recoveryEmail ?? ''}',
        _ForgotPinStep.choosePin => 'Choose a new 6-digit PIN.',
        _ForgotPinStep.confirmPin => 'Enter your new PIN again to confirm.',
        _ForgotPinStep.done => '',
      },
      bottom: _step == _ForgotPinStep.phone
          ? SwiperButton(
              label: 'Continue',
              isLoading: _sending,
              onPressed: _sending ? null : _continueFromPhone,
            )
          : null,
      child: _buildStep(),
    );
  }

  Widget _buildStep() {
    switch (_step) {
      case _ForgotPinStep.phone:
        return _buildPhoneStep();
      case _ForgotPinStep.phoneOtp:
        return OtpStepView(
          key: ValueKey(_normalizedPhone),
          contactValue: _normalizedPhone ?? '',
          otpService: _phoneOtpService,
          onVerified: _handlePhoneOtpVerified,
        );
      case _ForgotPinStep.noRecoveryEmail:
        return const _NoRecoveryEmailNotice();
      case _ForgotPinStep.emailOtp:
        return OtpStepView(
          key: ValueKey(_recoveryEmail),
          contactValue: _recoveryEmail ?? '',
          otpService: _emailOtpService,
          onVerified: _handleEmailOtpVerified,
        );
      case _ForgotPinStep.choosePin:
        return PinStepView(
          key: const ValueKey('choose'),
          title: '',
          subtitle: '',
          onSubmit: _handlePinChosen,
        );
      case _ForgotPinStep.confirmPin:
        return PinStepView(
          key: const ValueKey('confirm'),
          title: '',
          subtitle: '',
          onSubmit: _handlePinConfirmed,
        );
      case _ForgotPinStep.done:
        return _buildDone();
    }
  }

  Widget _buildPhoneStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            SizedBox(
              width: 60,
              child: TextField(
                controller: _countryCodeController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(prefixText: '+'),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: TextField(
                controller: _phoneController,
                keyboardType: TextInputType.phone,
                autofocus: true,
                decoration: const InputDecoration(hintText: 'e.g. 12 345 6789'),
              ),
            ),
          ],
        ),
        if (_errorMessage != null) ...[
          const SizedBox(height: AppSpacing.md),
          Text(
            _errorMessage!,
            style: const TextStyle(fontSize: 12.5, color: AppColors.error),
          ),
        ],
      ],
    );
  }

  Widget _buildDone() {
    return Column(
      children: [
        const Icon(Icons.check_circle_rounded, color: AppColors.success, size: 56),
        const SizedBox(height: AppSpacing.md),
        const Text(
          'Your PIN has been reset. You can now sign in with your new PIN.',
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: AppSpacing.lg),
        SwiperButton(
          label: 'Back to Login',
          onPressed: () => Navigator.of(context).pop(true),
        ),
      ],
    );
  }
}

class _NoRecoveryEmailNotice extends StatelessWidget {
  const _NoRecoveryEmailNotice();

  @override
  Widget build(BuildContext context) {
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(Icons.error_outline_rounded, color: AppColors.error, size: 48),
        SizedBox(height: AppSpacing.md),
        Text(
          "This account has no verified recovery email, so the PIN can't be reset automatically here.",
        ),
        SizedBox(height: AppSpacing.sm),
        Text(
          'Please contact Swiper support to recover your account.',
          style: TextStyle(color: AppColors.textSecondary),
        ),
      ],
    );
  }
}
