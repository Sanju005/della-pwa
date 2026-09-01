import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';

import '../../../core/animation/app_motion.dart';
import '../../../services/otp_service.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/swiper_button.dart';

const double _otpFieldRadius = 13;

OutlineInputBorder _otpBorder(Color color, {double width = 1}) {
  return OutlineInputBorder(
    borderRadius: BorderRadius.circular(_otpFieldRadius),
    borderSide: BorderSide(color: color, width: width),
  );
}

/// Shared 6-digit OTP entry step used by both the provider registration flow
/// and the login flow, so a returning provider sees the exact same
/// verification screen they saw when they first signed up.
class OtpStepView extends StatefulWidget {
  const OtpStepView({
    super.key,
    required this.contactValue,
    required this.otpService,
    required this.onVerified,
  });

  /// Whatever the OTP was sent to — the canonical +60XXXXXXXXX phone form,
  /// or an email address.
  final String contactValue;
  final OtpService otpService;
  final ValueChanged<String> onVerified;

  @override
  State<OtpStepView> createState() => _OtpStepViewState();
}

class _OtpStepViewState extends State<OtpStepView>
    with SingleTickerProviderStateMixin {
  static const _resendSeconds = 30;

  final _controllers = List.generate(
    6,
    (_) => TextEditingController(),
    growable: false,
  );
  final _focusNodes = List.generate(6, (_) => FocusNode(), growable: false);
  late final AnimationController _shakeController;

  Timer? _resendTimer;
  int _secondsRemaining = _resendSeconds;
  bool _verifying = false;
  bool _verified = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _shakeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 380),
    );
    _startResendTimer();
  }

  @override
  void dispose() {
    _resendTimer?.cancel();
    _shakeController.dispose();
    for (final controller in _controllers) {
      controller.dispose();
    }
    for (final node in _focusNodes) {
      node.dispose();
    }
    super.dispose();
  }

  void _startResendTimer() {
    _resendTimer?.cancel();
    setState(() => _secondsRemaining = _resendSeconds);
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_secondsRemaining <= 1) {
        timer.cancel();
        setState(() => _secondsRemaining = 0);
        return;
      }
      setState(() => _secondsRemaining -= 1);
    });
  }

  String get _code => _controllers.map((c) => c.text).join();

  void _clearDigits() {
    for (final controller in _controllers) {
      controller.clear();
    }
  }

  Future<void> _resend() async {
    if (_secondsRemaining > 0 || _verifying) {
      return;
    }
    setState(() => _error = null);
    _clearDigits();
    _focusNodes.first.requestFocus();
    await widget.otpService.sendOtp(widget.contactValue);
    if (!mounted) {
      return;
    }
    _startResendTimer();
  }

  void _onDigitChanged(int index, String value) {
    if (value.length > 1) {
      final digits = value.replaceAll(RegExp(r'\D'), '');
      if (digits.length == 6) {
        for (var i = 0; i < 6; i++) {
          _controllers[i].text = digits[i];
        }
        _focusNodes.last.requestFocus();
        _submit();
        return;
      }
    }

    if (value.isNotEmpty && index < 5) {
      _focusNodes[index + 1].requestFocus();
    }

    if (_code.length == 6) {
      _submit();
    }
  }

  void _onBackspace(int index) {
    if (_controllers[index].text.isEmpty && index > 0) {
      _focusNodes[index - 1].requestFocus();
    }
  }

  Future<void> _submit() async {
    if (_verifying || _verified) {
      return;
    }
    final code = _code;
    if (code.length != 6) {
      return;
    }

    setState(() {
      _verifying = true;
      _error = null;
    });

    final ok = await widget.otpService.verifyOtp(widget.contactValue, code);
    if (!mounted) {
      return;
    }

    if (ok) {
      setState(() {
        _verifying = false;
        _verified = true;
      });
      final delay = AppMotion.resolveDuration(
        context,
        const Duration(milliseconds: 900),
      );
      await Future.delayed(delay);
      if (!mounted) {
        return;
      }
      widget.onVerified(code);
      return;
    }

    setState(() {
      _verifying = false;
      _error = 'Incorrect code. Please try again.';
    });
    if (!AppMotion.reduceMotion(context)) {
      await _shakeController.forward(from: 0);
    }
    if (!mounted) {
      return;
    }
    _clearDigits();
    _focusNodes.first.requestFocus();
  }

  @override
  Widget build(BuildContext context) {
    if (_verified) {
      return _buildSuccess();
    }
    return _buildEntry(context);
  }

  Widget _buildSuccess() {
    return Center(
      child: TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: 1),
        duration: const Duration(milliseconds: 420),
        curve: Curves.easeOutBack,
        builder: (context, value, child) {
          return Opacity(
            opacity: value.clamp(0, 1),
            child: Transform.scale(scale: 0.7 + (0.3 * value), child: child),
          );
        },
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.xl),
          child: Column(
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: const BoxDecoration(
                  color: AppColors.successSurface,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.check_rounded,
                  color: AppColors.success,
                  size: 36,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              const Text(
                'Phone verified',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: AppColors.success,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEntry(BuildContext context) {
    final canResend = _secondsRemaining == 0;
    final minutes = (_secondsRemaining ~/ 60).toString().padLeft(2, '0');
    final seconds = (_secondsRemaining % 60).toString().padLeft(2, '0');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AnimatedBuilder(
          animation: _shakeController,
          builder: (context, child) {
            final shake = AppMotion.reduceMotion(context)
                ? 0.0
                : sin(_shakeController.value * pi * 6) *
                      8 *
                      (1 - _shakeController.value);
            return Transform.translate(offset: Offset(shake, 0), child: child);
          },
          child: LayoutBuilder(
            builder: (context, constraints) {
              const spacing = 8.0;
              final boxSize = ((constraints.maxWidth - (spacing * 5)) / 6)
                  .clamp(40.0, 52.0);
              return Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: List.generate(6, (index) {
                  return SizedBox(
                    width: boxSize,
                    child: TextField(
                      controller: _controllers[index],
                      focusNode: _focusNodes[index],
                      autofocus: index == 0,
                      textAlign: TextAlign.center,
                      keyboardType: TextInputType.number,
                      maxLength: 6,
                      enabled: !_verifying,
                      onChanged: (value) => _onDigitChanged(index, value),
                      onSubmitted: (_) => _onBackspace(index),
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: _error != null
                            ? AppColors.error
                            : AppColors.textPrimary,
                      ),
                      decoration: InputDecoration(
                        counterText: '',
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(
                          vertical: 13,
                        ),
                        border: _otpBorder(
                          _error != null ? AppColors.error : AppColors.border,
                        ),
                        enabledBorder: _otpBorder(
                          _error != null ? AppColors.error : AppColors.border,
                        ),
                        focusedBorder: _otpBorder(
                          _error != null ? AppColors.error : AppColors.primary,
                          width: 1.4,
                        ),
                      ),
                    ),
                  );
                }),
              );
            },
          ),
        ),
        if (_error != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            _error!,
            style: const TextStyle(fontSize: 12.5, color: AppColors.error),
          ),
        ],
        const SizedBox(height: AppSpacing.lg),
        SizedBox(
          width: double.infinity,
          child: SwiperButton(
            label: 'Verify & Continue',
            isLoading: _verifying,
            onPressed: (_verifying || _code.length != 6) ? null : _submit,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Center(
          child: canResend
              ? GestureDetector(
                  onTap: _resend,
                  child: const Text(
                    'Resend code',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary,
                    ),
                  ),
                )
              : Text(
                  'Resend code in $minutes:$seconds',
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.textMuted,
                  ),
                ),
        ),
      ],
    );
  }
}
