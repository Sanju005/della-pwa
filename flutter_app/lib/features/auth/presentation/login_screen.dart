import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/utils/phone_number.dart';
import '../../../repositories/demo_repository.dart';
import '../../../services/auth_service.dart';
import '../../../services/otp_service.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/swiper_button.dart';
import 'account_recovery_screen.dart';
import 'auth_flow_scaffold.dart';
import 'create_pin_screen.dart';
import 'forgot_pin_screen.dart';
import 'otp_step_view.dart';
import 'pin_step_view.dart';

enum _LoginStep { phone, otp, pin, signingIn }

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.repository});

  final DemoRepository repository;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _authService = const AuthService();
  final RealOtpService _otpService = RealOtpService(purpose: 'phone');
  final _countryCodeController = TextEditingController(text: '60');
  final _phoneController = TextEditingController();

  _LoginStep _step = _LoginStep.phone;
  bool _rememberMe = true;
  bool _isCheckingSession = true;
  bool _sendingCode = false;
  String? _normalizedPhone;
  String? _errorMessage;
  PendingPhoneSignIn? _pendingSignIn;

  @override
  void initState() {
    super.initState();
    _restoreSession();
  }

  @override
  void dispose() {
    _countryCodeController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  String _nextCustomerRoute(BuildContext context) {
    final arguments = ModalRoute.of(context)?.settings.arguments;
    if (arguments is Map && arguments['next'] is String) {
      return arguments['next'] as String;
    }

    return AppRoutes.customerShell;
  }

  Future<void> _restoreSession() async {
    try {
      final role = await _authService.getCurrentUserRole();
      if (!mounted) {
        return;
      }

      if (role != null) {
        final routeName = _authService.isProviderRole(role)
            ? AppRoutes.providerShell
            : _nextCustomerRoute(context);
        Navigator.of(context).pushReplacementNamed(routeName);
        return;
      }
    } catch (_) {
      if (!mounted) {
        return;
      }
    }

    if (!mounted) {
      return;
    }

    setState(() {
      _isCheckingSession = false;
    });
  }

  String get _heading {
    switch (_step) {
      case _LoginStep.phone:
        return 'Welcome back!';
      case _LoginStep.otp:
        return 'Verify your phone';
      case _LoginStep.pin:
        return 'New device detected';
      case _LoginStep.signingIn:
        return 'Signing you in';
    }
  }

  String get _subtitle {
    switch (_step) {
      case _LoginStep.phone:
        return 'Log in to continue to your ${AppConstants.appName} account.';
      case _LoginStep.otp:
        final formatted = _normalizedPhone == null
            ? ''
            : formatPhoneForDisplay(_normalizedPhone!);
        return 'Enter the 6-digit verification code sent to\n$formatted';
      case _LoginStep.pin:
        return "We haven't seen this device before. Enter your Swiper Security PIN to continue.";
      case _LoginStep.signingIn:
        return 'Just a moment while we get your account ready.';
    }
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
      _sendingCode = true;
    });
    try {
      await _otpService.sendOtp(normalized);
    } finally {
      if (mounted) {
        setState(() => _sendingCode = false);
      }
    }
    if (!mounted) {
      return;
    }
    setState(() => _step = _LoginStep.otp);
  }

  /// Tries the real provider phone-login first (this phone/OTP combo is also
  /// how providers sign back in, not just customers), then the real customer
  /// phone-login — both produce a genuine authenticated Supabase session, no
  /// local/fake auth store is involved. Any other failure (network error,
  /// backend not deployed yet) surfaces as-is rather than being masked by a
  /// confusing fallback attempt.
  ///
  /// If the backend reports this device has never been trusted for the
  /// matched account and the account already has a Swiper PIN, this stores
  /// which sign-in call to retry (provider vs customer) and moves to the PIN
  /// step instead of failing outright — phone OTP alone is deliberately not
  /// enough to reach an existing account from an unknown device.
  Future<void> _handleOtpVerified(String code) async {
    setState(() => _step = _LoginStep.signingIn);

    final challengeId = _otpService.lastChallengeId;
    if (challengeId == null || challengeId.isEmpty) {
      setState(() {
        _step = _LoginStep.phone;
        _normalizedPhone = null;
        _errorMessage = 'Verification expired. Please request a new code.';
      });
      return;
    }

    final countryCode =
        '+${_countryCodeController.text.replaceAll(RegExp(r'\D'), '')}';
    final phoneNumber = _phoneController.text.trim();

    Future<PhoneLoginResult> signInAsProvider({
      String? pin,
      String? emailChallengeId,
      String? newPin,
    }) {
      return _authService.signInProviderWithVerifiedPhone(
        phoneCountryCode: countryCode,
        phoneNumber: phoneNumber,
        challengeId: challengeId,
        pin: pin,
        emailChallengeId: emailChallengeId,
        newPin: newPin,
      );
    }

    Future<PhoneLoginResult> signInAsCustomer({
      String? pin,
      String? emailChallengeId,
      String? newPin,
    }) {
      return _authService.signInCustomerWithVerifiedPhone(
        phoneCountryCode: countryCode,
        phoneNumber: phoneNumber,
        challengeId: challengeId,
        pin: pin,
        emailChallengeId: emailChallengeId,
        newPin: newPin,
      );
    }

    try {
      PhoneLoginResult result;
      try {
        result = await signInAsProvider();
      } on PhoneLoginPinRequiredException {
        setState(() {
          _pendingSignIn = signInAsProvider;
          _step = _LoginStep.pin;
        });
        return;
      } on AccountRecoveryRequiredException catch (recovery) {
        _openAccountRecovery(signInAsProvider, recovery.recoveryEmail);
        return;
      } on ProviderPhoneAccountNotFoundException {
        try {
          result = await signInAsCustomer();
        } on PhoneLoginPinRequiredException {
          setState(() {
            _pendingSignIn = signInAsCustomer;
            _step = _LoginStep.pin;
          });
          return;
        } on AccountRecoveryRequiredException catch (recovery) {
          _openAccountRecovery(signInAsCustomer, recovery.recoveryEmail);
          return;
        } on CustomerPhoneAccountNotFoundException {
          throw Exception(
            'No account was found for this phone number. Check the number or create an account.',
          );
        }
      }

      await _completeLogin(result);
    } catch (error) {
      _handleSignInError(error);
    }
  }

  /// Retries the sign-in stored in [_pendingSignIn] with the PIN the user
  /// just entered. Left to throw on failure — [PinStepView] catches it,
  /// shows the message inline, and lets the user try again without losing
  /// the phone/OTP context (matches how a wrong OTP code behaves).
  Future<void> _handlePinSubmit(String pin) async {
    final pendingSignIn = _pendingSignIn;
    if (pendingSignIn == null) {
      throw Exception('Please start over.');
    }

    final result = await pendingSignIn(pin: pin);
    await _completeLogin(result);
  }

  /// Case B: this device is unknown and the account has no PIN yet — phone
  /// OTP alone is not enough. Hands off to [AccountRecoveryScreen], which
  /// collects a verified-email OTP and a new PIN, then retries [signIn]
  /// with both — the same call this came from, just with the recovery
  /// fields filled in.
  Future<void> _openAccountRecovery(
    PendingPhoneSignIn signIn,
    String? recoveryEmail,
  ) async {
    setState(() => _step = _LoginStep.phone);
    if (!mounted) {
      return;
    }
    final result = await Navigator.of(context).push<PhoneLoginResult>(
      MaterialPageRoute(
        builder: (_) => AccountRecoveryScreen(
          recoveryEmail: recoveryEmail,
          signIn: signIn,
        ),
      ),
    );
    if (result != null) {
      await _completeLogin(result);
    }
  }

  Future<void> _completeLogin(PhoneLoginResult result) async {
    if (!mounted) {
      return;
    }

    if (result.pinSetupRequired) {
      await Navigator.of(context).push<bool>(
        MaterialPageRoute(
          builder: (_) => CreatePinScreen(canSkip: !result.pinSetupMandatory),
        ),
      );
      if (!mounted) {
        return;
      }
    }

    final routeName = _authService.isProviderRole(result.role)
        ? AppRoutes.providerShell
        : _nextCustomerRoute(context);
    Navigator.of(context).pushReplacementNamed(routeName);
  }

  void _handleSignInError(Object error) {
    if (!mounted) {
      return;
    }
    final message = error is AuthException && error.message.isNotEmpty
        ? error.message
        : error is Exception
        ? error.toString().replaceFirst('Exception: ', '')
        : 'Unable to sign in. Please try again.';
    // A failed sign-in invalidates the OTP step (same as registration's
    // rule: returning to the phone step always requires re-verification),
    // so the provider re-enters their number rather than being stuck on a
    // step that's already shown its "verified" checkmark.
    setState(() {
      _step = _LoginStep.phone;
      _normalizedPhone = null;
      _pendingSignIn = null;
      _errorMessage = message;
    });
  }

  void _back() {
    if (_step == _LoginStep.otp || _step == _LoginStep.pin) {
      setState(() {
        _step = _LoginStep.phone;
        _normalizedPhone = null;
        _pendingSignIn = null;
      });
      return;
    }
    Navigator.of(context).maybePop();
  }

  void _showDemoMessage(String message) {
    FocusScope.of(context).unfocus();
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    if (_isCheckingSession) {
      return const Scaffold(
        body: SafeArea(child: Center(child: CircularProgressIndicator())),
      );
    }

    final showBottomButton = _step == _LoginStep.phone;

    return PopScope(
      canPop: _step == _LoginStep.phone,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) {
          return;
        }
        _back();
      },
      child: AuthFlowScaffold(
        showBack: _step == _LoginStep.otp || _step == _LoginStep.pin,
        onBack: _back,
        hero: Image.asset('assets/logo/main_logo.png', width: 84),
        title: _heading,
        subtitle: _subtitle,
        bottom: showBottomButton
            ? SwiperButton(
                label: 'Continue',
                icon: const Icon(Icons.arrow_forward_rounded),
                isLoading: _sendingCode,
                onPressed: _sendingCode ? null : _continueFromPhone,
              )
            : null,
        child: AnimatedSwitcher(
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
          child: KeyedSubtree(key: ValueKey(_step), child: _buildStepBody()),
        ),
      ),
    );
  }

  Widget _buildStepBody() {
    switch (_step) {
      case _LoginStep.phone:
        return _buildPhoneStep();
      case _LoginStep.otp:
        return OtpStepView(
          key: ValueKey(_normalizedPhone),
          contactValue: _normalizedPhone ?? '',
          otpService: _otpService,
          onVerified: _handleOtpVerified,
        );
      case _LoginStep.pin:
        return PinStepView(
          key: ValueKey('pin-$_normalizedPhone'),
          onSubmit: _handlePinSubmit,
          onForgotPin: () => Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const ForgotPinScreen()),
          ),
        );
      case _LoginStep.signingIn:
        return const Padding(
          padding: EdgeInsets.symmetric(vertical: AppSpacing.xl),
          child: Center(child: CircularProgressIndicator()),
        );
    }
  }

  Widget _buildPhoneStep() {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Phone Number', style: theme.textTheme.labelLarge),
        const SizedBox(height: AppSpacing.xs),
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
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
                  onChanged: (_) {
                    if (_errorMessage != null) {
                      setState(() => _errorMessage = null);
                    }
                  },
                  onSubmitted: (_) => _continueFromPhone(),
                  style: const TextStyle(fontSize: 15),
                  decoration: const InputDecoration(
                    hintText: 'e.g. 12 345 6789',
                  ),
                ),
              ),
            ],
          ),
        ),
        // Only ever shown in a local debug build — never in a release APK,
        // regardless of the backend's OTP_DEV_MODE flag. Showing this
        // unconditionally to every user was itself a live vulnerability:
        // combined with OTP_DEV_MODE, it let anyone sign into any phone
        // number's account without ever receiving a real SMS.
        if (kDebugMode) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Debug build: OTP code 123456 works if OTP_DEV_MODE is enabled.',
            style: theme.textTheme.bodyMedium,
          ),
        ],
        const SizedBox(height: AppSpacing.md),
        InkWell(
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          onTap: () => setState(() => _rememberMe = !_rememberMe),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  height: 20,
                  width: 20,
                  decoration: BoxDecoration(
                    color: _rememberMe ? AppColors.primary : Colors.white,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                      color: _rememberMe ? AppColors.primary : AppColors.border,
                    ),
                  ),
                  child: Icon(
                    Icons.check_rounded,
                    size: 14,
                    color: _rememberMe ? Colors.white : Colors.transparent,
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  'Remember me',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: AppColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
        ),
        if (_errorMessage != null) ...[
          const SizedBox(height: AppSpacing.lg),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.md,
            ),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF6F7),
              borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
              border: Border.all(color: const Color(0xFFF4D8DE)),
            ),
            child: Text(
              _errorMessage!,
              style: theme.textTheme.labelMedium?.copyWith(
                color: const Color(0xFFC2415B),
                fontSize: 12,
              ),
            ),
          ),
        ],
        const SizedBox(height: AppSpacing.xl),
        Row(
          children: [
            const Expanded(child: Divider(height: 1)),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
              child: Text('or', style: theme.textTheme.labelMedium),
            ),
            const Expanded(child: Divider(height: 1)),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        OutlinedButton.icon(
          onPressed: () =>
              Navigator.of(context).pushNamed(AppRoutes.signupEntry),
          icon: const Icon(Icons.person_add_alt_1_rounded),
          label: const Text('Create account'),
        ),
        const SizedBox(height: AppSpacing.xxl),
        Center(
          child: Column(
            children: [
              Text(
                'Need help?',
                style: theme.textTheme.labelMedium?.copyWith(
                  color: AppColors.textPrimary,
                  fontSize: 12,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              TextButton(
                onPressed: () => _showDemoMessage(
                  'Support is not connected in Flutter yet.',
                ),
                child: const Text('Contact support'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
