import 'dart:typed_data';
import 'dart:convert';

import 'package:flutter/material.dart';

import '../../../core/routing/app_routes.dart';
import '../../../core/utils/phone_number.dart';
import '../../../services/auth_service.dart';
import '../../../services/browser_file_picker.dart';
import '../../../services/customer_signup_service.dart';
import '../../../services/image_crop_service.dart';
import '../../../services/otp_service.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/swiper_button.dart';
import 'auth_flow_scaffold.dart';
import 'otp_step_view.dart';

enum _CustomerStep { phoneNumber, phoneOtp, personalDetails, review }

class CustomerRegisterScreen extends StatefulWidget {
  const CustomerRegisterScreen({super.key});

  @override
  State<CustomerRegisterScreen> createState() => _CustomerRegisterScreenState();
}

class _CustomerRegisterScreenState extends State<CustomerRegisterScreen> {
  final _detailsFormKey = GlobalKey<FormState>();
  final _countryCodeController = TextEditingController(text: '60');
  final _phoneController = TextEditingController();
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();

  final _signupService = const CustomerSignupService();
  final _authService = const AuthService();
  final _otpService = RealOtpService(purpose: 'phone');

  _CustomerStep _step = _CustomerStep.phoneNumber;
  // Set only when a step was entered via an Edit tap from Review — the next
  // Continue from that step returns to Review instead of advancing through
  // the normal linear flow (mirrors Provider registration's own pattern).
  _CustomerStep? _returnToStepAfterEdit;

  String? _normalizedPhone;
  bool _phoneVerified = false;
  bool _sendingOtp = false;
  bool _submitting = false;
  String? _stepError;
  bool _phoneAlreadyRegistered = false;

  DateTime? _dob;
  String _gender = 'Female';
  PickedBrowserFile? _avatarImage;

  @override
  void dispose() {
    _countryCodeController.dispose();
    _phoneController.dispose();
    _firstNameController.dispose();
    _lastNameController.dispose();
    super.dispose();
  }

  String get _dobDisplay => _dob == null
      ? ''
      : '${_dob!.day.toString().padLeft(2, '0')}/${_dob!.month.toString().padLeft(2, '0')}/${_dob!.year}';

  String get _dobIso => _dob == null
      ? ''
      : '${_dob!.year.toString().padLeft(4, '0')}-${_dob!.month.toString().padLeft(2, '0')}-${_dob!.day.toString().padLeft(2, '0')}';

  int? get _age {
    final dob = _dob;
    if (dob == null) {
      return null;
    }
    final now = DateTime.now();
    var age = now.year - dob.year;
    if (now.month < dob.month ||
        (now.month == dob.month && now.day < dob.day)) {
      age -= 1;
    }
    return age < 0 ? null : age;
  }

  Future<void> _pickDob() async {
    final now = DateTime.now();
    final selected = await showDatePicker(
      context: context,
      initialDate: _dob ?? DateTime(now.year - 25),
      firstDate: DateTime(1930),
      lastDate: now,
    );
    if (selected == null || !mounted) {
      return;
    }
    setState(() => _dob = selected);
  }

  Future<void> _pickAvatar() async {
    final picked = await pickAndCropImage(toolbarTitle: 'Crop Profile Photo');
    if (!mounted || picked == null) {
      return;
    }
    setState(() => _avatarImage = picked);
  }

  String _heading() {
    switch (_step) {
      case _CustomerStep.phoneNumber:
        return 'Create your account';
      case _CustomerStep.phoneOtp:
        return 'Verify your phone';
      case _CustomerStep.personalDetails:
        return 'Personal Details';
      case _CustomerStep.review:
        return 'Review Your Details';
    }
  }

  String _subtitle() {
    switch (_step) {
      case _CustomerStep.phoneNumber:
        return 'Verify your mobile number to get started.';
      case _CustomerStep.phoneOtp:
        final formatted = _normalizedPhone == null
            ? ''
            : formatPhoneForDisplay(_normalizedPhone!);
        return 'Enter the 6-digit verification code sent to\n$formatted';
      case _CustomerStep.personalDetails:
        return 'Tell us a little about yourself';
      case _CustomerStep.review:
        return 'Before creating your account, please review your details';
    }
  }

  Future<void> _continue() async {
    setState(() {
      _stepError = null;
      _phoneAlreadyRegistered = false;
    });

    if (_step == _CustomerStep.phoneNumber) {
      final normalized = normalizePhoneNumber(
        _countryCodeController.text,
        _phoneController.text,
      );
      if (normalized == null) {
        setState(() => _stepError = 'Enter a valid mobile number.');
        return;
      }
      setState(() {
        _normalizedPhone = normalized;
        _phoneVerified = false;
        _sendingOtp = true;
      });
      try {
        await _otpService.sendOtp(normalized);
        if (!mounted) {
          return;
        }
        setState(() => _step = _CustomerStep.phoneOtp);
      } catch (error) {
        if (!mounted) {
          return;
        }
        setState(() {
          _stepError = error is Exception
              ? error.toString().replaceFirst('Exception: ', '')
              : 'Unable to send verification code. Please try again.';
        });
      } finally {
        if (mounted) {
          setState(() => _sendingOtp = false);
        }
      }
      return;
    }

    if (_step == _CustomerStep.personalDetails) {
      if (!_detailsFormKey.currentState!.validate()) {
        return;
      }
      if (_dob == null) {
        setState(() => _stepError = 'Please select your date of birth.');
        return;
      }
    }

    if (_step == _CustomerStep.review) {
      await _submitRegistration();
      return;
    }

    if (_returnToStepAfterEdit != null) {
      final target = _returnToStepAfterEdit!;
      setState(() {
        _returnToStepAfterEdit = null;
        _step = target;
      });
      return;
    }

    setState(() => _step = _nextStep(_step));
  }

  void _onPhoneVerified(String code) {
    setState(() {
      _phoneVerified = true;
      if (_returnToStepAfterEdit != null) {
        _step = _returnToStepAfterEdit!;
        _returnToStepAfterEdit = null;
      } else {
        _step = _CustomerStep.personalDetails;
      }
    });
  }

  /// Jumps to [target] from Review; the next Continue returns here.
  void _editFromReview(_CustomerStep target) {
    setState(() {
      _returnToStepAfterEdit = _CustomerStep.review;
      _step = target;
      if (target == _CustomerStep.phoneNumber) {
        // Re-entering the phone step always requires a fresh OTP, same rule
        // as Provider registration.
        _phoneVerified = false;
      }
    });
  }

  _CustomerStep _nextStep(_CustomerStep step) {
    return switch (step) {
      _CustomerStep.phoneNumber => _CustomerStep.phoneOtp,
      _CustomerStep.phoneOtp => _CustomerStep.personalDetails,
      _CustomerStep.personalDetails => _CustomerStep.review,
      _CustomerStep.review => _CustomerStep.review,
    };
  }

  _CustomerStep _previousStep(_CustomerStep step) {
    return switch (step) {
      _CustomerStep.phoneOtp => _CustomerStep.phoneNumber,
      // Skip straight past OTP on back-nav — it's already verified.
      _CustomerStep.personalDetails => _CustomerStep.phoneNumber,
      _CustomerStep.review => _CustomerStep.personalDetails,
      _CustomerStep.phoneNumber => _CustomerStep.phoneNumber,
    };
  }

  void _back() {
    if (_returnToStepAfterEdit != null) {
      setState(() {
        _step = _returnToStepAfterEdit!;
        _returnToStepAfterEdit = null;
      });
      return;
    }

    if (_step == _CustomerStep.phoneNumber) {
      Navigator.of(context).maybePop();
      return;
    }

    final previous = _previousStep(_step);
    setState(() {
      _step = previous;
      if (previous == _CustomerStep.phoneNumber) {
        _phoneVerified = false;
      }
    });
  }

  Future<void> _submitRegistration() async {
    setState(() {
      _submitting = true;
      _stepError = null;
      _phoneAlreadyRegistered = false;
    });

    try {
      final result = await _signupService.registerCustomer(
        CustomerSignupPayload(
          firstName: _firstNameController.text.trim(),
          lastName: _lastNameController.text.trim(),
          dateOfBirth: _dobIso,
          sex: _gender,
          phoneCountryCode:
              '+${_countryCodeController.text.replaceAll(RegExp(r'\D'), '')}',
          phoneNumber: _phoneController.text.trim(),
          avatarDataUrl: _avatarImage?.dataUrl ?? '',
        ),
        phoneVerificationChallengeId: _otpService.lastChallengeId,
      );

      await _authService.signInWithPhone(
        normalizedPhone: result.normalizedPhone,
        password: result.password,
      );

      if (!mounted) {
        return;
      }
      Navigator.of(context).pushNamedAndRemoveUntil(
        AppRoutes.registerCustomerSuccess,
        (route) => false,
      );
    } on CustomerPhoneAlreadyRegisteredException {
      if (!mounted) {
        return;
      }
      setState(() {
        _submitting = false;
        _phoneAlreadyRegistered = true;
        _stepError = 'An account already exists with this phone number.';
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _submitting = false;
        _stepError = error is Exception
            ? error.toString().replaceFirst('Exception: ', '')
            : 'Unable to create your account.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final handledBottomInternally = _step == _CustomerStep.phoneOtp;

    return PopScope(
      canPop: _step == _CustomerStep.phoneNumber,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) {
          return;
        }
        _back();
      },
      child: AuthFlowScaffold(
        showBack: true,
        onBack: _back,
        hero: const AuthCircleHero(icon: Icons.person_add_alt_1_rounded),
        title: _heading(),
        subtitle: _subtitle(),
        bottom: handledBottomInternally
            ? null
            : SwiperButton(
                label: _step == _CustomerStep.phoneNumber
                    ? 'Send OTP'
                    : _step == _CustomerStep.review
                    ? 'Create Account'
                    : 'Continue',
                isLoading: _sendingOtp || _submitting,
                onPressed:
                    (_sendingOtp || _submitting) ||
                        (_step == _CustomerStep.phoneNumber &&
                            normalizePhoneNumber(
                                  _countryCodeController.text,
                                  _phoneController.text,
                                ) ==
                                null)
                    ? null
                    : _continue,
              ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _CustomerStepHeader(step: _step),
            const SizedBox(height: AppSpacing.lg),
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 280),
              switchInCurve: Curves.easeOut,
              switchOutCurve: Curves.easeOut,
              transitionBuilder: (child, animation) => FadeTransition(
                opacity: animation,
                child: SlideTransition(
                  position: Tween<Offset>(
                    begin: const Offset(0.02, 0),
                    end: Offset.zero,
                  ).animate(animation),
                  child: child,
                ),
              ),
              child: KeyedSubtree(
                key: ValueKey(_step),
                child: _buildStepBody(),
              ),
            ),
            if (_stepError != null) ...[
              const SizedBox(height: AppSpacing.md),
              Text(
                _stepError!,
                style: Theme.of(
                  context,
                ).textTheme.labelMedium?.copyWith(color: AppColors.error),
              ),
              if (_phoneAlreadyRegistered) ...[
                const SizedBox(height: AppSpacing.sm),
                OutlinedButton(
                  onPressed: () => Navigator.of(
                    context,
                  ).pushReplacementNamed(AppRoutes.login),
                  child: const Text('Sign In'),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildStepBody() {
    switch (_step) {
      case _CustomerStep.phoneNumber:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Mobile Number', style: _regLabelStyle),
            const SizedBox(height: 6),
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(_regFieldRadius),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Builder(
                          builder: (context) {
                            final matched = matchCountryCode(
                              _countryCodeController.text,
                            );
                            if (matched == null) {
                              return const Icon(
                                Icons.public_rounded,
                                size: 18,
                                color: AppColors.textMuted,
                              );
                            }
                            return Text(
                              matched.flag,
                              style: const TextStyle(fontSize: 18),
                            );
                          },
                        ),
                        const SizedBox(width: 6),
                        const Text(
                          '+',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        SizedBox(
                          width: 34,
                          child: TextField(
                            controller: _countryCodeController,
                            keyboardType: TextInputType.number,
                            maxLength: 4,
                            enableInteractiveSelection: false,
                            onChanged: (_) => setState(() {}),
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                            ),
                            decoration: const InputDecoration(
                              counterText: '',
                              filled: false,
                              isCollapsed: true,
                              border: InputBorder.none,
                              enabledBorder: InputBorder.none,
                              focusedBorder: InputBorder.none,
                              disabledBorder: InputBorder.none,
                              errorBorder: InputBorder.none,
                              focusedErrorBorder: InputBorder.none,
                              contentPadding: EdgeInsets.zero,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: TextField(
                      controller: _phoneController,
                      keyboardType: TextInputType.phone,
                      autofocus: true,
                      onChanged: (_) => setState(() {}),
                      style: const TextStyle(fontSize: 15),
                      decoration: _regDecoration(),
                      onSubmitted: (_) => _continue(),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 4),
            const Text('e.g. 12 345 6789', style: _regHelperStyle),
          ],
        );
      case _CustomerStep.phoneOtp:
        return OtpStepView(
          key: ValueKey(_normalizedPhone),
          contactValue: _normalizedPhone ?? '',
          otpService: _otpService,
          onVerified: _onPhoneVerified,
        );
      case _CustomerStep.personalDetails:
        return _buildPersonalDetailsStep();
      case _CustomerStep.review:
        return _buildReviewStep();
    }
  }

  Widget _buildPersonalDetailsStep() {
    return Form(
      key: _detailsFormKey,
      child: Column(
        children: [
          _CustomerAvatarPicker(
            file: _avatarImage,
            onPick: _pickAvatar,
            onRemove: _avatarImage == null
                ? null
                : () => setState(() => _avatarImage = null),
          ),
          const SizedBox(height: AppSpacing.lg),
          if (_phoneVerified && _normalizedPhone != null) ...[
            _VerifiedMobileBadge(normalizedPhone: _normalizedPhone!),
            const SizedBox(height: AppSpacing.md),
          ],
          _RegField(
            label: 'First Name',
            controller: _firstNameController,
            textCapitalization: TextCapitalization.words,
            validator: (value) => _validateIcNamePart(value, 'First name'),
          ),
          const SizedBox(height: AppSpacing.md),
          _RegField(
            label: 'Last Name',
            controller: _lastNameController,
            textCapitalization: TextCapitalization.words,
            validator: (value) => _validateIcNamePart(value, 'Last name'),
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                flex: 3,
                child: GestureDetector(
                  onTap: _pickDob,
                  child: AbsorbPointer(
                    child: _RegField(
                      label: 'Date of Birth',
                      controller: TextEditingController(text: _dobDisplay),
                      validator: (_) =>
                          _dob == null ? 'Date of birth is required' : null,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                flex: 2,
                child: _ReadOnlyField(label: 'Age', value: '${_age ?? '--'}'),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          _RegDropdown<String>(
            label: 'Gender',
            value: _gender,
            items: const ['Female', 'Male'],
            itemLabel: (item) => item,
            onChanged: (value) => setState(() => _gender = value ?? _gender),
          ),
        ],
      ),
    );
  }

  Widget _buildReviewStep() {
    final bytes = _decodeDataUrlBytes(_avatarImage?.dataUrl);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _ReviewSection(
          title: 'Personal Details',
          onEdit: () => _editFromReview(_CustomerStep.personalDetails),
          child: Row(
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.primarySoft,
                  border: Border.all(color: AppColors.border),
                ),
                child: ClipOval(
                  child: bytes != null
                      ? Image.memory(bytes, fit: BoxFit.cover)
                      : const Icon(
                          Icons.person_outline_rounded,
                          color: AppColors.primary,
                        ),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${_firstNameController.text.trim()} ${_lastNameController.text.trim()}'
                          .trim(),
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '$_dobDisplay${_age != null ? ' · $_age yrs' : ''} · $_gender',
                      style: const TextStyle(
                        fontSize: 12.5,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        _ReviewSection(
          title: 'Phone Number',
          onEdit: () => _editFromReview(_CustomerStep.phoneNumber),
          child: _VerifiedMobileBadge(normalizedPhone: _normalizedPhone ?? ''),
        ),
      ],
    );
  }

  static final RegExp _icNamePattern = RegExp(r"^[a-zA-Z][a-zA-Z\s.@'/-]*$");

  String? _validateIcNamePart(String? value, String label) {
    final trimmed = (value ?? '').trim();
    if (trimmed.isEmpty) {
      return '$label is required.';
    }
    if (!_icNamePattern.hasMatch(trimmed)) {
      return '$label must match your IC / Passport — letters only, no numbers.';
    }
    return null;
  }
}

Uint8List? _decodeDataUrlBytes(String? dataUrl) {
  if (dataUrl == null) {
    return null;
  }
  final commaIndex = dataUrl.indexOf(',');
  if (!dataUrl.startsWith('data:') || commaIndex == -1) {
    return null;
  }
  try {
    return base64Decode(dataUrl.substring(commaIndex + 1));
  } catch (_) {
    return null;
  }
}

class _CustomerAvatarPicker extends StatelessWidget {
  const _CustomerAvatarPicker({
    required this.file,
    required this.onPick,
    this.onRemove,
  });

  final PickedBrowserFile? file;
  final VoidCallback onPick;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final bytes = _decodeDataUrlBytes(file?.dataUrl);

    return Center(
      child: Column(
        children: [
          GestureDetector(
            onTap: onPick,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  width: 104,
                  height: 104,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.primarySoft,
                    border: Border.all(color: AppColors.border),
                  ),
                  child: ClipOval(
                    child: bytes != null
                        ? Image.memory(bytes, fit: BoxFit.cover)
                        : const Icon(
                            Icons.person_outline_rounded,
                            size: 44,
                            color: AppColors.primary,
                          ),
                  ),
                ),
                Positioned(
                  right: 0,
                  bottom: 0,
                  child: Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.primary,
                      border: Border.all(color: Colors.white, width: 2),
                    ),
                    child: const Icon(
                      Icons.camera_alt_rounded,
                      size: 16,
                      color: Colors.white,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          GestureDetector(
            onTap: onPick,
            child: Text(
              file == null ? 'Add profile photo (optional)' : 'Change photo',
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: AppColors.primary,
              ),
            ),
          ),
          if (onRemove != null && file != null) ...[
            const SizedBox(height: 2),
            GestureDetector(
              onTap: onRemove,
              child: const Text(
                'Remove photo',
                style: TextStyle(fontSize: 12, color: AppColors.textMuted),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ReviewSection extends StatelessWidget {
  const _ReviewSection({
    required this.title,
    required this.onEdit,
    required this.child,
  });

  final String title;
  final VoidCallback onEdit;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(_regFieldRadius),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
              GestureDetector(
                onTap: onEdit,
                child: const Text(
                  'Edit',
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w800,
                    color: AppColors.primary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          child,
        ],
      ),
    );
  }
}

class _CustomerStepHeader extends StatelessWidget {
  const _CustomerStepHeader({required this.step});

  final _CustomerStep step;

  static const _groups = <({String label, List<_CustomerStep> steps})>[
    (
      label: 'Verify',
      steps: [_CustomerStep.phoneNumber, _CustomerStep.phoneOtp],
    ),
    (label: 'Details', steps: [_CustomerStep.personalDetails]),
    (label: 'Review', steps: [_CustomerStep.review]),
  ];

  @override
  Widget build(BuildContext context) {
    final activeGroupIndex = _groups.indexWhere(
      (group) => group.steps.contains(step),
    );

    return Row(
      children: [
        for (var i = 0; i < _groups.length; i++) ...[
          if (i > 0)
            Expanded(
              child: Container(
                height: 2,
                margin: const EdgeInsets.symmetric(horizontal: 6),
                color: i <= activeGroupIndex
                    ? AppColors.primary
                    : AppColors.border,
              ),
            ),
          _CustomerStepChip(
            index: i + 1,
            label: _groups[i].label,
            done: i < activeGroupIndex,
            active: i == activeGroupIndex,
          ),
        ],
      ],
    );
  }
}

class _CustomerStepChip extends StatelessWidget {
  const _CustomerStepChip({
    required this.index,
    required this.label,
    required this.done,
    required this.active,
  });

  final int index;
  final String label;
  final bool done;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final isActiveOrDone = done || active;
    final circleColor = isActiveOrDone ? AppColors.primary : AppColors.border;
    final textColor = isActiveOrDone ? AppColors.primary : AppColors.textMuted;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 22,
          height: 22,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: circleColor, shape: BoxShape.circle),
          child: done
              ? const Icon(Icons.check_rounded, size: 14, color: Colors.white)
              : Text(
                  '$index',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: textColor,
          ),
        ),
      ],
    );
  }
}

/// Read-only confirmation shown once the phone has already been verified —
/// never an editable field itself, per the phone-first verification flow.
class _VerifiedMobileBadge extends StatelessWidget {
  const _VerifiedMobileBadge({required this.normalizedPhone});

  final String normalizedPhone;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.successSurface,
        borderRadius: BorderRadius.circular(_regFieldRadius),
        border: Border.all(color: AppColors.success.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.verified_rounded,
            color: AppColors.success,
            size: 20,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Verified Mobile',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.success,
                  ),
                ),
                Text(
                  normalizedPhone.isEmpty
                      ? ''
                      : formatPhoneForDisplay(normalizedPhone),
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Compact native-mobile form controls, visually matching Provider
// registration's design language without importing its file-private widgets.
// ---------------------------------------------------------------------------

const double _regFieldRadius = 13;

const TextStyle _regLabelStyle = TextStyle(
  fontSize: 13,
  fontWeight: FontWeight.w700,
  color: AppColors.textPrimary,
);

const TextStyle _regHelperStyle = TextStyle(
  fontSize: 11.5,
  color: AppColors.textMuted,
);

OutlineInputBorder _regBorder(Color color, {double width = 1}) {
  return OutlineInputBorder(
    borderRadius: BorderRadius.circular(_regFieldRadius),
    borderSide: BorderSide(color: color, width: width),
  );
}

InputDecoration _regDecoration() {
  return InputDecoration(
    isDense: true,
    filled: true,
    fillColor: Colors.white,
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
    border: _regBorder(AppColors.border),
    enabledBorder: _regBorder(AppColors.border),
    focusedBorder: _regBorder(AppColors.primary, width: 1.4),
    errorBorder: _regBorder(AppColors.error),
    focusedErrorBorder: _regBorder(AppColors.error, width: 1.4),
    errorStyle: const TextStyle(fontSize: 11.5),
  );
}

class _RegField extends StatelessWidget {
  const _RegField({
    required this.label,
    this.controller,
    this.textCapitalization = TextCapitalization.none,
    this.validator,
  });

  final String label;
  final TextEditingController? controller;
  final TextCapitalization textCapitalization;
  final FormFieldValidator<String>? validator;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: _regLabelStyle),
        const SizedBox(height: 6),
        TextFormField(
          controller: controller,
          textCapitalization: textCapitalization,
          validator: validator,
          style: const TextStyle(fontSize: 15),
          decoration: _regDecoration(),
        ),
      ],
    );
  }
}

class _ReadOnlyField extends StatelessWidget {
  const _ReadOnlyField({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: _regLabelStyle),
        const SizedBox(height: 6),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(_regFieldRadius),
            border: Border.all(color: AppColors.border),
          ),
          child: Text(
            value,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: AppColors.textSecondary,
            ),
          ),
        ),
      ],
    );
  }
}

class _RegDropdown<T> extends StatelessWidget {
  const _RegDropdown({
    required this.label,
    required this.value,
    required this.items,
    required this.itemLabel,
    required this.onChanged,
  });

  final String label;
  final T value;
  final List<T> items;
  final String Function(T) itemLabel;
  final ValueChanged<T?> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: _regLabelStyle),
        const SizedBox(height: 6),
        DropdownButtonFormField<T>(
          initialValue: value,
          decoration: _regDecoration(),
          items: items
              .map(
                (item) => DropdownMenuItem<T>(
                  value: item,
                  child: Text(itemLabel(item)),
                ),
              )
              .toList(),
          onChanged: onChanged,
        ),
      ],
    );
  }
}
