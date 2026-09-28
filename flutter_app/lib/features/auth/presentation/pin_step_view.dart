import 'dart:math';

import 'package:flutter/material.dart';

import '../../../core/animation/app_motion.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/swiper_button.dart';

const double _pinFieldRadius = 13;

OutlineInputBorder _pinBorder(Color color, {double width = 1}) {
  return OutlineInputBorder(
    borderRadius: BorderRadius.circular(_pinFieldRadius),
    borderSide: BorderSide(color: color, width: width),
  );
}

/// 6-digit Swiper Security PIN entry, shown when a login attempt comes from
/// a device the backend has never trusted for this account before. Visual
/// pattern mirrors [OtpStepView] deliberately — the same "6 boxes, shake on
/// error, one submit button" interaction the phone-verification step
/// already trained users on, just for a PIN instead of an SMS code.
class PinStepView extends StatefulWidget {
  const PinStepView({
    super.key,
    required this.onSubmit,
    this.title = 'New device detected',
    this.subtitle =
        'Enter your Swiper Security PIN to finish signing in on this device.',
    this.forgotPinLabel = 'Forgot PIN?',
    this.onForgotPin,
  });

  /// Should verify the PIN and complete sign-in, or throw so the step can
  /// show an inline error and let the user retry without losing their
  /// place (matches how a wrong OTP code behaves).
  final Future<void> Function(String pin) onSubmit;
  final String title;
  final String subtitle;
  final String forgotPinLabel;
  final VoidCallback? onForgotPin;

  @override
  State<PinStepView> createState() => _PinStepViewState();
}

class _PinStepViewState extends State<PinStepView>
    with SingleTickerProviderStateMixin {
  final _controllers = List.generate(
    6,
    (_) => TextEditingController(),
    growable: false,
  );
  final _focusNodes = List.generate(6, (_) => FocusNode(), growable: false);
  late final AnimationController _shakeController;

  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _shakeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 380),
    );
  }

  @override
  void dispose() {
    _shakeController.dispose();
    for (final controller in _controllers) {
      controller.dispose();
    }
    for (final node in _focusNodes) {
      node.dispose();
    }
    super.dispose();
  }

  String get _pin => _controllers.map((c) => c.text).join();

  void _clearDigits() {
    for (final controller in _controllers) {
      controller.clear();
    }
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

    if (_pin.length == 6) {
      _submit();
    }
  }

  void _onBackspace(int index) {
    if (_controllers[index].text.isEmpty && index > 0) {
      _focusNodes[index - 1].requestFocus();
    }
  }

  Future<void> _submit() async {
    if (_submitting) {
      return;
    }
    final pin = _pin;
    if (pin.length != 6) {
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      await widget.onSubmit(pin);
      // On success the parent navigates away; nothing else to do here.
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _submitting = false;
        _error = error.toString().replaceFirst('Exception: ', '');
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
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.lock_outline_rounded,
                size: 16,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(width: AppSpacing.xs),
            Text(
              'SWIPER PIN',
              style: theme.textTheme.labelSmall?.copyWith(
                color: AppColors.primary,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.6,
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        if (widget.title.isNotEmpty) ...[
          Text(widget.title, style: theme.textTheme.titleLarge),
          const SizedBox(height: AppSpacing.xs),
        ],
        if (widget.subtitle.isNotEmpty) ...[
          Text(widget.subtitle, style: theme.textTheme.bodyMedium),
          const SizedBox(height: AppSpacing.sm),
        ],
        const SizedBox(height: AppSpacing.lg),
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
                      obscureText: true,
                      textAlign: TextAlign.center,
                      keyboardType: TextInputType.number,
                      maxLength: 6,
                      enabled: !_submitting,
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
                        border: _pinBorder(
                          _error != null ? AppColors.error : AppColors.border,
                        ),
                        enabledBorder: _pinBorder(
                          _error != null ? AppColors.error : AppColors.border,
                        ),
                        focusedBorder: _pinBorder(
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
            isLoading: _submitting,
            onPressed: (_submitting || _pin.length != 6) ? null : _submit,
          ),
        ),
        if (widget.onForgotPin != null) ...[
          const SizedBox(height: AppSpacing.md),
          Center(
            child: GestureDetector(
              onTap: _submitting ? null : widget.onForgotPin,
              child: Text(
                widget.forgotPinLabel,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.primary,
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}
