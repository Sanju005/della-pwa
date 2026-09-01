import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/routing/app_routes.dart';
import '../../../models/notification_item.dart';
import '../../../repositories/demo_repository.dart';
import '../../../services/customer_profile_api_service.dart';
import '../../../services/otp_service.dart';
import '../../auth/presentation/otp_step_view.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/loading_state.dart';
import '../../../widgets/profile_avatar.dart';
import '../../../widgets/swiper_app_bar.dart';
import '../../../widgets/swiper_button.dart';
import '../../../widgets/swiper_status_badge.dart';

class CustomerVerificationHubScreen extends StatelessWidget {
  const CustomerVerificationHubScreen({super.key});

  static const _service = CustomerProfileApiService();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const SwiperAppBar(
        title: 'Verification',
        subtitle: 'Verification status for your account',
        showBack: true,
      ),
      body: FutureBuilder<CustomerProfileApiModel>(
        future: _service.fetchProfile(),
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const LoadingState(label: 'Loading verification...');
          }
          if (snapshot.hasError || snapshot.data == null) {
            return const EmptyState(
              title: 'Unable to load verification',
              subtitle: 'Please try again.',
              icon: Icons.error_outline_rounded,
            );
          }

          final profile = snapshot.data!;
          return ListView(
            padding: AppSpacing.screenPadding,
            children: [
              _heroVerificationCard(profile: profile),
              const SizedBox(height: AppSpacing.lg),
              _VerificationStatusTile(
                title: 'Email',
                subtitle: 'Email status',
                verified: profile.emailVerified,
                icon: Icons.mail_outline_rounded,
                onTap: () => Navigator.of(
                  context,
                ).pushNamed(AppRoutes.profileVerificationEmail),
              ),
              const SizedBox(height: AppSpacing.sm),
              _VerificationStatusTile(
                title: 'Phone',
                subtitle: 'Phone status',
                verified: profile.phoneVerified,
                icon: Icons.phone_outlined,
                onTap: () => Navigator.of(
                  context,
                ).pushNamed(AppRoutes.profileVerificationPhone),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _heroVerificationCard({required CustomerProfileApiModel profile}) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(26),
        border: Border.all(color: const Color(0xFFE6EEE8)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x140F172A),
            blurRadius: 32,
            offset: Offset(0, 12),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              gradient: const LinearGradient(
                colors: [Color(0xFFC18EFF), AppColors.primary],
              ),
            ),
            child: const Icon(
              Icons.verified_user_outlined,
              color: Colors.white,
              size: 28,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Verification',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF1F1630),
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  profile.verified
                      ? 'Your account is verified.'
                      : 'Open phone and email verification',
                  style: const TextStyle(
                    color: Color(0xFF7B728A),
                    fontSize: 13,
                    height: 1.5,
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

class CustomerEmailVerificationScreen extends StatefulWidget {
  const CustomerEmailVerificationScreen({super.key});

  @override
  State<CustomerEmailVerificationScreen> createState() =>
      _CustomerEmailVerificationScreenState();
}

class _CustomerEmailVerificationScreenState
    extends State<CustomerEmailVerificationScreen> {
  static const _service = CustomerProfileApiService();
  final _otpService = RealOtpService(purpose: 'email');

  final _emailController = TextEditingController();
  bool _codeSent = false;
  bool _saving = false;
  bool _sendingCode = false;
  String _error = '';
  CustomerProfileApiModel? _profile;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final profile = await _service.fetchProfile();
      if (!mounted) {
        return;
      }
      setState(() {
        _profile = profile;
        _emailController.text = profile.email;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = error.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _startOtp() async {
    final email = _emailController.text.trim();
    if (email.isEmpty) {
      return;
    }
    setState(() {
      _sendingCode = true;
      _error = '';
      _codeSent = false;
    });
    try {
      await _otpService.sendOtp(email);
      if (!mounted) {
        return;
      }
      setState(() {
        _error = '';
        _codeSent = true;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = error.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() => _sendingCode = false);
      }
    }
  }

  // The OTP box widget already verified the code server-side before calling
  // this — it never decides "correct" on its own. This just persists the
  // (possibly changed) email address itself; the client never sends
  // emailVerified: true directly.
  Future<void> _onEmailVerified(String code) async {
    final email = _emailController.text.trim();
    setState(() {
      _saving = true;
      _error = '';
    });
    try {
      final profile = await _service.updateProfile({'email': email});
      if (!mounted) {
        return;
      }
      setState(() {
        _profile = profile;
      });
      Navigator.of(context).pop();
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = error.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final profile = _profile;
    if (profile == null && _error.isEmpty) {
      return const Scaffold(
        appBar: SwiperAppBar(
          title: 'Email Verification',
          subtitle: 'Add your email and verify it',
          showBack: true,
        ),
        body: LoadingState(label: 'Loading email verification...'),
      );
    }

    return Scaffold(
      appBar: const SwiperAppBar(
        title: 'Email Verification',
        subtitle: 'Add your email and verify it',
        showBack: true,
      ),
      body: ListView(
        padding: AppSpacing.screenPadding,
        children: [
          if (profile != null)
            Align(
              alignment: Alignment.centerRight,
              child: _statusBadge(profile.emailVerified),
            ),
          const SizedBox(height: AppSpacing.md),
          const Text(
            'Email Verification',
            style: TextStyle(
              fontSize: 32,
              fontWeight: FontWeight.w900,
              color: Color(0xFF1F1630),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          const Text(
            'Add your email address and verify it with a one-time code. '
            "We'll use it for login alerts and occasional marketing updates.",
            style: TextStyle(
              fontSize: 14,
              color: Color(0xFF7B728A),
              height: 1.6,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          _verificationFormCard(
            context,
            label: 'Email Address',
            icon: Icons.mail_outline_rounded,
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            placeholder: 'Enter email address',
            sendLabel: _sendingCode ? 'Sending...' : 'Send Code',
            isSending: _sendingCode,
            onSend: _startOtp,
          ),
          const SizedBox(height: AppSpacing.lg),
          _securityCard(
            'Your email is used for login alerts and marketing updates. We will never share it with providers.',
          ),
          if (_error.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            _errorBanner(_error),
          ],
        ],
      ),
    );
  }

  Widget _verificationFormCard(
    BuildContext context, {
    required String label,
    required IconData icon,
    required TextEditingController controller,
    required TextInputType keyboardType,
    required String placeholder,
    required String sendLabel,
    required VoidCallback onSend,
    bool isSending = false,
  }) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: _cardDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: AppSpacing.md),
          TextField(
            controller: controller,
            keyboardType: keyboardType,
            decoration: InputDecoration(
              hintText: placeholder,
              prefixIcon: Icon(icon, color: AppColors.primary),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          SwiperButton(
            label: sendLabel,
            isSecondary: true,
            isLoading: isSending,
            onPressed: (controller.text.trim().isNotEmpty && !isSending)
                ? onSend
                : null,
          ),
          if (_codeSent) ...[
            const SizedBox(height: AppSpacing.lg),
            Text(
              'Enter the 6-digit code sent to ${controller.text.trim()}',
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: AppSpacing.md),
            OtpStepView(
              key: ValueKey(controller.text.trim()),
              contactValue: controller.text.trim(),
              otpService: _otpService,
              onVerified: _onEmailVerified,
            ),
            if (_saving) ...[
              const SizedBox(height: AppSpacing.md),
              const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                  SizedBox(width: AppSpacing.sm),
                  Text(
                    'Saving...',
                    style: TextStyle(fontSize: 13, color: Color(0xFF6F6681)),
                  ),
                ],
              ),
            ],
          ],
        ],
      ),
    );
  }

  Widget _statusBadge(bool verified) {
    return SwiperStatusBadge(
      label: verified ? 'Verified' : 'Pending',
      tone: verified ? SwiperStatusTone.success : SwiperStatusTone.warning,
    );
  }
}

class CustomerPhoneVerificationScreen extends StatefulWidget {
  const CustomerPhoneVerificationScreen({super.key});

  @override
  State<CustomerPhoneVerificationScreen> createState() =>
      _CustomerPhoneVerificationScreenState();
}

class _CustomerPhoneVerificationScreenState
    extends State<CustomerPhoneVerificationScreen> {
  static const _service = CustomerProfileApiService();
  final _otpService = RealOtpService(purpose: 'phone');
  final _phoneController = TextEditingController();

  String _countryCode = '+60';
  String _phoneNumber = '';
  String _originalPhoneNumber = '';
  bool _codeSent = false;
  bool _saving = false;
  bool _sendingCode = false;
  String _error = '';
  CustomerProfileApiModel? _profile;

  String get _target =>
      '$_countryCode${_phoneNumber.trim()}'.replaceAll(RegExp(r'\s+'), '');

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final profile = await _service.fetchProfile();
      if (!mounted) {
        return;
      }
      setState(() {
        _profile = profile;
        _countryCode = profile.countryCode;
        _phoneNumber = profile.phoneNumber;
        _originalPhoneNumber = profile.phoneNumber;
        _phoneController.text = profile.phoneNumber;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = error.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _startOtp() async {
    if (_phoneNumber.trim().length < 7) {
      return;
    }
    setState(() {
      _sendingCode = true;
      _error = '';
      _codeSent = false;
    });
    try {
      await _otpService.sendOtp(_target);
      if (!mounted) {
        return;
      }
      setState(() {
        _error = '';
        _codeSent = true;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = error.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() => _sendingCode = false);
      }
    }
  }

  // The OTP box widget already verified the code server-side before calling
  // this — it never decides "correct" on its own. This just persists the
  // (possibly changed) phone number itself; the client never sends
  // phoneVerified: true directly.
  Future<void> _onPhoneVerified(String code) async {
    setState(() {
      _saving = true;
      _error = '';
    });
    try {
      final profile = await _service.updateProfile({
        'phoneNumber': _phoneNumber.trim(),
        'countryCode': _countryCode,
      });
      if (!mounted) {
        return;
      }
      setState(() {
        _profile = profile;
        _originalPhoneNumber = _phoneNumber;
      });
      Navigator.of(context).pop();
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = error.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final profile = _profile;
    if (profile == null && _error.isEmpty) {
      return const Scaffold(
        appBar: SwiperAppBar(
          title: 'Phone Verification',
          subtitle: 'Verify your saved phone number',
          showBack: true,
        ),
        body: LoadingState(label: 'Loading phone verification...'),
      );
    }

    return Scaffold(
      appBar: const SwiperAppBar(
        title: 'Phone Verification',
        subtitle: 'Verify your saved phone number',
        showBack: true,
      ),
      body: ListView(
        padding: AppSpacing.screenPadding,
        children: [
          if (profile != null)
            Align(
              alignment: Alignment.centerRight,
              child: SwiperStatusBadge(
                label: profile.phoneVerified ? 'Verified' : 'Pending',
                tone: profile.phoneVerified
                    ? SwiperStatusTone.success
                    : SwiperStatusTone.warning,
              ),
            ),
          const SizedBox(height: AppSpacing.md),
          const Text(
            'Phone Verification',
            style: TextStyle(
              fontSize: 32,
              fontWeight: FontWeight.w900,
              color: Color(0xFF1F1630),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          const Text(
            'Verify your current number, or type a new one to change it. '
            'Changing your number always requires a fresh OTP.',
            style: TextStyle(
              fontSize: 14,
              color: Color(0xFF7B728A),
              height: 1.6,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Container(
            padding: const EdgeInsets.all(AppSpacing.lg),
            decoration: _cardDecoration(),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Phone Number',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                Row(
                  children: [
                    Container(
                      width: 96,
                      height: 52,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFE7DEF4)),
                      ),
                      child: Text(
                        _countryCode,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF1F1630),
                        ),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: SizedBox(
                        height: 52,
                        child: TextField(
                          controller: _phoneController,
                          keyboardType: TextInputType.phone,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF1F1630),
                          ),
                          decoration: const InputDecoration(
                            hintText: 'Enter phone number',
                            filled: true,
                            fillColor: Color(0xFFF8F5FF),
                          ),
                          onChanged: (value) {
                            setState(() {
                              _phoneNumber = value.trim();
                              _codeSent = false;
                            });
                          },
                        ),
                      ),
                    ),
                  ],
                ),
                if (_phoneNumber.trim() != _originalPhoneNumber.trim() &&
                    _phoneNumber.trim().isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.sm),
                  const Text(
                    "You're changing your number — verify it with OTP to save it.",
                    style: TextStyle(
                      fontSize: 12,
                      color: Color(0xFFB45309),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
                const SizedBox(height: AppSpacing.md),
                SwiperButton(
                  label: _sendingCode ? 'Sending...' : 'Send OTP',
                  isSecondary: true,
                  isLoading: _sendingCode,
                  onPressed: (_phoneNumber.trim().length >= 7 && !_sendingCode)
                      ? _startOtp
                      : null,
                ),
                if (_codeSent) ...[
                  const SizedBox(height: AppSpacing.lg),
                  Text(
                    'Enter the 6-digit code sent to $_target',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  OtpStepView(
                    key: ValueKey(_target),
                    contactValue: _target,
                    otpService: _otpService,
                    onVerified: _onPhoneVerified,
                  ),
                  if (_saving) ...[
                    const SizedBox(height: AppSpacing.md),
                    const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                        SizedBox(width: AppSpacing.sm),
                        Text(
                          'Saving...',
                          style: TextStyle(
                            fontSize: 13,
                            color: Color(0xFF6F6681),
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          _securityCard(
            'Changing your number updates your profile automatically once verified, and is used for account verification and important security alerts.',
          ),
          if (_error.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            _errorBanner(_error),
          ],
        ],
      ),
    );
  }
}

class CustomerIdentityVerificationScreen extends StatefulWidget {
  const CustomerIdentityVerificationScreen({super.key});

  @override
  State<CustomerIdentityVerificationScreen> createState() =>
      _CustomerIdentityVerificationScreenState();
}

class _CustomerIdentityVerificationScreenState
    extends State<CustomerIdentityVerificationScreen> {
  static const _service = CustomerProfileApiService();

  bool _saving = false;
  String _error = '';
  CustomerProfileApiModel? _profile;
  String _documentType = 'ic';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final profile = await _service.fetchProfile();
      if (!mounted) {
        return;
      }
      setState(() {
        _profile = profile;
        _documentType = profile.identityDocumentType ?? 'ic';
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = error.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _submit() async {
    setState(() {
      _saving = true;
      _error = '';
    });
    try {
      final profile = await _service.updateProfile({
        'identityDocumentType': _documentType,
        'identityVerificationStatus': 'processing',
        'verified': false,
      });
      if (!mounted) {
        return;
      }
      setState(() {
        _profile = profile;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Identity verification submitted for review.'),
        ),
      );
      Navigator.of(context).pop();
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = error.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final profile = _profile;
    if (profile == null && _error.isEmpty) {
      return const Scaffold(
        appBar: SwiperAppBar(
          title: 'Identity Verification',
          subtitle: 'Submit IC or passport for review',
          showBack: true,
        ),
        body: LoadingState(label: 'Loading identity verification...'),
      );
    }

    final status = profile?.identityVerificationStatus ?? 'pending';

    return Scaffold(
      appBar: const SwiperAppBar(
        title: 'Identity Verification',
        subtitle: 'Submit IC or passport for review',
        showBack: true,
      ),
      body: ListView(
        padding: AppSpacing.screenPadding,
        children: [
          Align(
            alignment: Alignment.centerRight,
            child: SwiperStatusBadge(
              label: _statusLabel(status),
              tone: _statusTone(status),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          const Text(
            'Identity Verification',
            style: TextStyle(
              fontSize: 30,
              fontWeight: FontWeight.w900,
              color: Color(0xFF1F1630),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          const Text(
            'Choose your document type and submit your identity review request.',
            style: TextStyle(
              fontSize: 14,
              color: Color(0xFF7B728A),
              height: 1.6,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Container(
            padding: const EdgeInsets.all(AppSpacing.lg),
            decoration: _cardDecoration(),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Document type',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF1F1630),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                DropdownButtonFormField<String>(
                  initialValue: _documentType,
                  items: const [
                    DropdownMenuItem(value: 'ic', child: Text('IC')),
                    DropdownMenuItem(
                      value: 'passport',
                      child: Text('Passport'),
                    ),
                  ],
                  onChanged: (value) {
                    setState(() => _documentType = value ?? 'ic');
                  },
                ),
                const SizedBox(height: AppSpacing.md),
                _documentInfoRow(
                  'Front document image',
                  profile?.identityFrontImageUrl.isNotEmpty == true
                      ? 'Uploaded'
                      : 'Not uploaded yet',
                ),
                const SizedBox(height: AppSpacing.sm),
                _documentInfoRow(
                  'Back document image',
                  profile?.identityBackImageUrl.isNotEmpty == true
                      ? 'Uploaded'
                      : 'Not uploaded yet',
                ),
                const SizedBox(height: AppSpacing.md),
                const Text(
                  'This Flutter build keeps the same backend review flow. If images were uploaded from the web app, their status will appear here. You can still submit the verification review state from this screen.',
                  style: TextStyle(
                    fontSize: 13,
                    color: Color(0xFF6F6681),
                    height: 1.6,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          _securityCard(
            'Identity verification usually takes up to 24 hours after submission.',
          ),
          if (_error.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            _errorBanner(_error),
          ],
          const SizedBox(height: AppSpacing.lg),
          SwiperButton(
            label: _saving ? 'Submitting...' : 'Submit For Review',
            isLoading: _saving,
            onPressed: _submit,
          ),
        ],
      ),
    );
  }

  Widget _documentInfoRow(String label, String value) {
    return Row(
      children: [
        const Icon(Icons.description_outlined, color: AppColors.primary),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Text(
            label,
            style: const TextStyle(
              color: Color(0xFF1F1630),
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        Text(
          value,
          style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
        ),
      ],
    );
  }
}

class CustomerAddressesScreen extends StatefulWidget {
  const CustomerAddressesScreen({super.key});

  @override
  State<CustomerAddressesScreen> createState() =>
      _CustomerAddressesScreenState();
}

class _CustomerAddressesScreenState extends State<CustomerAddressesScreen> {
  static const _service = CustomerProfileApiService();

  final _labelController = TextEditingController();
  final _unitController = TextEditingController();
  final _line1Controller = TextEditingController();
  final _line2Controller = TextEditingController();
  final _postcodeController = TextEditingController();
  final _cityController = TextEditingController();
  final _stateController = TextEditingController();
  final _countryController = TextEditingController(text: 'Malaysia');

  bool _showForm = false;
  bool _saving = false;
  String _error = '';
  List<CustomerProfileAddressModel>? _items;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _labelController.dispose();
    _unitController.dispose();
    _line1Controller.dispose();
    _line2Controller.dispose();
    _postcodeController.dispose();
    _cityController.dispose();
    _stateController.dispose();
    _countryController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final items = await _service.fetchAddresses();
      if (!mounted) {
        return;
      }
      setState(() {
        _items = items;
        _labelController.text = 'Address ${items.length + 1}';
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _error = error.toString().replaceFirst('Exception: ', ''));
    }
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = '';
    });
    try {
      final address = await _service.addAddress({
        'label': _labelController.text.trim(),
        'unitNumber': _unitController.text.trim(),
        'addressLine1': _line1Controller.text.trim(),
        'addressLine2': _line2Controller.text.trim(),
        'postcode': _postcodeController.text.trim(),
        'city': _cityController.text.trim(),
        'state': _stateController.text.trim(),
        'country': _countryController.text.trim(),
        'isDefault': (_items?.isEmpty ?? true),
      });
      if (!mounted) {
        return;
      }
      setState(() {
        _items = [...?_items, address];
        _showForm = false;
        _labelController.text = 'Address ${(_items?.length ?? 0) + 1}';
        _unitController.clear();
        _line1Controller.clear();
        _line2Controller.clear();
        _postcodeController.clear();
        _cityController.clear();
        _stateController.clear();
        _countryController.text = 'Malaysia';
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _error = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final items = _items;
    return Scaffold(
      appBar: const SwiperAppBar(
        title: 'Saved Addresses',
        subtitle: 'Manage your saved places',
        showBack: true,
      ),
      body: items == null && _error.isEmpty
          ? const LoadingState(label: 'Loading addresses...')
          : ListView(
              padding: AppSpacing.screenPadding,
              children: [
                if (_error.isNotEmpty) _errorBanner(_error),
                if (items != null && items.isNotEmpty)
                  ...items.map(
                    (address) => Padding(
                      padding: const EdgeInsets.only(bottom: AppSpacing.md),
                      child: _addressCard(context, address),
                    ),
                  ),
                if (items != null && items.isEmpty)
                  const EmptyState(
                    title: 'No saved addresses yet',
                    subtitle: 'Add your home, work, or any custom address.',
                    icon: Icons.place_outlined,
                  ),
                const SizedBox(height: AppSpacing.sm),
                OutlinedButton.icon(
                  onPressed: () => setState(() => _showForm = !_showForm),
                  icon: const Icon(Icons.add_rounded),
                  label: Text(
                    _showForm ? 'Hide Address Form' : 'Add New Address',
                  ),
                ),
                if (_showForm) ...[
                  const SizedBox(height: AppSpacing.md),
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    decoration: _cardDecoration(),
                    child: Column(
                      children: [
                        _field(_labelController, 'Address Name'),
                        const SizedBox(height: AppSpacing.sm),
                        _field(_unitController, 'Unit Number'),
                        const SizedBox(height: AppSpacing.sm),
                        _field(_line1Controller, 'Address Line 1'),
                        const SizedBox(height: AppSpacing.sm),
                        _field(_line2Controller, 'Address Line 2'),
                        const SizedBox(height: AppSpacing.sm),
                        _field(_postcodeController, 'Postcode'),
                        const SizedBox(height: AppSpacing.sm),
                        _field(_cityController, 'City'),
                        const SizedBox(height: AppSpacing.sm),
                        _field(_stateController, 'State'),
                        const SizedBox(height: AppSpacing.sm),
                        _field(_countryController, 'Country'),
                        const SizedBox(height: AppSpacing.md),
                        SwiperButton(
                          label: 'Save Address',
                          isLoading: _saving,
                          onPressed: _save,
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
    );
  }

  Widget _addressCard(
    BuildContext context,
    CustomerProfileAddressModel address,
  ) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: _cardDecoration(),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: const BoxDecoration(
              color: Color(0xFFEFF9F0),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.place_outlined, color: Color(0xFF16A34A)),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        address.label,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    if (address.isDefault)
                      const SwiperStatusBadge(
                        label: 'Default',
                        tone: SwiperStatusTone.success,
                      ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  address.fullAddress,
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(height: 1.5),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _field(TextEditingController controller, String label) {
    return TextField(
      controller: controller,
      decoration: InputDecoration(labelText: label),
    );
  }
}

class CustomerPaymentsScreen extends StatefulWidget {
  const CustomerPaymentsScreen({super.key});

  @override
  State<CustomerPaymentsScreen> createState() => _CustomerPaymentsScreenState();
}

class _CustomerPaymentsScreenState extends State<CustomerPaymentsScreen> {
  static const _service = CustomerProfileApiService();
  static const double _demoWalletBalance = 128.40;

  List<CustomerPaymentHistoryModel>? _items;
  String _error = '';
  String _filterMode = 'month';
  String _selectedMonth = '';
  String _dateFrom = '';
  String _dateTo = '';
  String _selectedTopUpMethod = 'FPX';

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    final initialFrom = now.subtract(const Duration(days: 90));
    _selectedMonth = DateFormat('yyyy-MM').format(now);
    _dateFrom = DateFormat('yyyy-MM-dd').format(initialFrom);
    _dateTo = DateFormat('yyyy-MM-dd').format(now);
    _load();
  }

  Future<void> _load() async {
    try {
      final items = await _service.fetchPayments();
      if (!mounted) {
        return;
      }
      setState(() => _items = items);
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _error = error.toString().replaceFirst('Exception: ', ''));
    }
  }

  @override
  Widget build(BuildContext context) {
    final items = _items;
    if (items == null && _error.isEmpty) {
      return const Scaffold(
        appBar: SwiperAppBar(
          title: 'Wallet',
          subtitle: 'Balance, top up, and payments',
          showBack: true,
        ),
        body: LoadingState(label: 'Loading wallet...'),
      );
    }

    final filteredPayments = _filterPayments(items ?? const []);
    final leadPayment = filteredPayments.isNotEmpty
        ? filteredPayments.first
        : (items?.isNotEmpty == true ? items!.first : null);
    final totalPaid = filteredPayments.fold<double>(
      0,
      (sum, payment) => sum + payment.amount,
    );

    return Scaffold(
      appBar: const SwiperAppBar(
        title: 'Wallet',
        subtitle: 'Balance, top up, and payments',
        showBack: true,
      ),
      body: ListView(
        padding: AppSpacing.screenPadding,
        children: [
          if (_error.isNotEmpty) _errorBanner(_error),
          _leadPaymentCard(leadPayment),
          const SizedBox(height: AppSpacing.md),
          _summaryCard(leadPayment, totalPaid),
          const SizedBox(height: AppSpacing.md),
          _paymentMethodCard(leadPayment),
          const SizedBox(height: AppSpacing.md),
          _completedCard(leadPayment),
          const SizedBox(height: AppSpacing.md),
          _filterCard(context, items ?? const []),
          const SizedBox(height: AppSpacing.md),
          _transactionIdCard(leadPayment),
          const SizedBox(height: AppSpacing.md),
          _transactionHistoryCard(filteredPayments),
        ],
      ),
    );
  }

  List<CustomerPaymentHistoryModel> _filterPayments(
    List<CustomerPaymentHistoryModel> items,
  ) {
    return items.where((payment) {
      final paidDate = DateTime.tryParse(payment.paidAt);
      if (paidDate == null) {
        return false;
      }
      if (_filterMode == 'month') {
        return DateFormat('yyyy-MM').format(paidDate) == _selectedMonth;
      }
      final from = DateTime.tryParse(_dateFrom);
      final to = DateTime.tryParse(_dateTo);
      if (from == null || to == null) {
        return true;
      }
      return !paidDate.isBefore(from) &&
          !paidDate.isAfter(to.add(const Duration(hours: 23, minutes: 59)));
    }).toList();
  }

  Widget _leadPaymentCard(CustomerPaymentHistoryModel? leadPayment) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(26),
        gradient: const LinearGradient(
          colors: [Color(0xFF221531), AppColors.primary],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x261D1242),
            blurRadius: 28,
            offset: Offset(0, 14),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: const Icon(
                  Icons.account_balance_wallet_rounded,
                  color: Colors.white,
                  size: 30,
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: const Text(
                  'Demo Balance',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          const Text(
            'Available Balance',
            style: TextStyle(
              color: Color(0xE6FFFFFF),
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'RM ${_demoWalletBalance.toStringAsFixed(2)}',
            style: const TextStyle(
              fontSize: 34,
              fontWeight: FontWeight.w900,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            leadPayment == null
                ? 'Top up your wallet to pay faster when online payments are enabled.'
                : 'Last payment on ${DateFormat('d MMM yyyy, h:mm a').format(DateTime.parse(leadPayment.paidAt))}',
            style: const TextStyle(
              color: Color(0xCCFFFFFF),
              fontSize: 12,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _summaryCard(
    CustomerPaymentHistoryModel? leadPayment,
    double totalPaid,
  ) {
    final amount = leadPayment?.amount ?? totalPaid;
    return _sectionCard(
      title: 'Wallet Summary',
      child: Column(
        children: [
          _summaryRow(
            'Current Balance',
            'RM${_demoWalletBalance.toStringAsFixed(2)}',
            emphasize: true,
          ),
          const SizedBox(height: AppSpacing.sm),
          _summaryRow('Suggested Top Up', 'RM50.00'),
          const SizedBox(height: AppSpacing.sm),
          _summaryRow('Last Payment', 'RM${amount.toStringAsFixed(2)}'),
          const Divider(height: 24),
          _summaryRow('Total Paid', 'RM${amount.toStringAsFixed(2)}'),
        ],
      ),
    );
  }

  Widget _paymentMethodCard(CustomerPaymentHistoryModel? leadPayment) {
    return _sectionCard(
      title: 'Top Up Method',
      child: Column(
        children: [
          _topUpMethodTile(
            icon: Icons.account_balance_rounded,
            label: 'FPX',
            subtitle: 'Online banking instant top up',
          ),
          const SizedBox(height: AppSpacing.sm),
          _topUpMethodTile(
            icon: Icons.credit_card_rounded,
            label: 'Card',
            subtitle: 'Visa, Mastercard, and debit card',
          ),
          const SizedBox(height: AppSpacing.sm),
          _topUpMethodTile(
            icon: Icons.qr_code_rounded,
            label: 'Touch n Go',
            subtitle: 'Use your Touch n Go eWallet',
          ),
        ],
      ),
    );
  }

  Widget _completedCard(CustomerPaymentHistoryModel? leadPayment) {
    return _sectionCard(
      title: 'Top Up Wallet',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: const [
              _WalletAmountChip(label: 'RM20'),
              _WalletAmountChip(label: 'RM50'),
              _WalletAmountChip(label: 'RM100'),
              _WalletAmountChip(label: 'RM200'),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          const Text(
            'This is a demo wallet screen for now. Later we can connect real top-up checkout flows here.',
            style: TextStyle(
              fontSize: 12,
              color: Color(0xFF7B728A),
              height: 1.5,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          SwiperButton(
            label: 'Top Up Wallet',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                    'Demo top up via $_selectedTopUpMethod will be connected later.',
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _topUpMethodTile({
    required IconData icon,
    required String label,
    required String subtitle,
  }) {
    final selected = _selectedTopUpMethod == label;
    return InkWell(
      borderRadius: BorderRadius.circular(18),
      onTap: () => setState(() => _selectedTopUpMethod = label),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFFF5F0FF) : Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: selected ? AppColors.primary : const Color(0xFFE7DCF7),
            width: selected ? 1.4 : 1,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: selected
                    ? AppColors.primary.withValues(alpha: 0.12)
                    : AppColors.primarySoft,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: AppColors.primary),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF24193A),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      fontSize: 11,
                      color: Color(0xFF8F86A2),
                    ),
                  ),
                ],
              ),
            ),
            if (selected)
              const Icon(Icons.check_circle_rounded, color: AppColors.primary),
          ],
        ),
      ),
    );
  }

  Widget _filterCard(
    BuildContext context,
    List<CustomerPaymentHistoryModel> items,
  ) {
    final months = {
      for (final payment in items)
        if (DateTime.tryParse(payment.paidAt) != null)
          DateFormat('yyyy-MM').format(DateTime.parse(payment.paidAt)),
    }.toList()..sort((a, b) => b.compareTo(a));

    return _sectionCard(
      title: 'Filter',
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => setState(() => _filterMode = 'month'),
                  child: Text(
                    'By Month',
                    style: TextStyle(
                      color: _filterMode == 'month'
                          ? AppColors.primary
                          : const Color(0xFF111827),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: OutlinedButton(
                  onPressed: () => setState(() => _filterMode = 'custom'),
                  child: Text(
                    'Custom Period',
                    style: TextStyle(
                      color: _filterMode == 'custom'
                          ? AppColors.primary
                          : const Color(0xFF111827),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          if (_filterMode == 'month')
            DropdownButtonFormField<String>(
              initialValue: months.contains(_selectedMonth)
                  ? _selectedMonth
                  : (months.isNotEmpty ? months.first : _selectedMonth),
              items: months
                  .map(
                    (month) => DropdownMenuItem(
                      value: month,
                      child: Text(
                        DateFormat(
                          'MMMM yyyy',
                        ).format(DateTime.parse('$month-01')),
                      ),
                    ),
                  )
                  .toList(),
              onChanged: (value) {
                setState(() => _selectedMonth = value ?? _selectedMonth);
              },
            )
          else
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: TextEditingController(text: _dateFrom),
                    decoration: const InputDecoration(labelText: 'From'),
                    onChanged: (value) => _dateFrom = value,
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: TextField(
                    controller: TextEditingController(text: _dateTo),
                    decoration: const InputDecoration(labelText: 'To'),
                    onChanged: (value) => _dateTo = value,
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }

  Widget _transactionIdCard(CustomerPaymentHistoryModel? leadPayment) {
    return _sectionCard(
      title: 'Transaction ID',
      child: Text(
        leadPayment?.id ?? 'No transaction available',
        style: const TextStyle(
          fontWeight: FontWeight.w700,
          color: Color(0xFF24193A),
        ),
      ),
    );
  }

  Widget _transactionHistoryCard(List<CustomerPaymentHistoryModel> items) {
    return _sectionCard(
      title: 'Transaction History',
      child: Column(
        children: [
          if (items.isEmpty)
            const EmptyState(
              title: 'No payment records found',
              subtitle:
                  'No payment records were found for the selected period.',
              icon: Icons.receipt_long_outlined,
            )
          else
            ...items.map(
              (payment) => Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.md),
                child: Container(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFEDF1EF)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  payment.serviceTitle,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFF111827),
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  payment.serviceCategory,
                                  style: const TextStyle(
                                    color: AppColors.primary,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text('Provider: ${payment.provider}'),
                              ],
                            ),
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                'RM${payment.amount.toStringAsFixed(2)}',
                                style: const TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF111827),
                                ),
                              ),
                              const SizedBox(height: 4),
                              SwiperStatusBadge(
                                label: payment.status == 'paid'
                                    ? 'Paid'
                                    : 'Refunded',
                                tone: SwiperStatusTone.info,
                              ),
                            ],
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.md),
                      Text(
                        'Date: ${DateFormat('d MMM yyyy').format(DateTime.parse(payment.paidAt))}',
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Time: ${DateFormat('h:mm a').format(DateTime.parse(payment.paidAt))}',
                      ),
                      const SizedBox(height: 4),
                      Text('Method: ${payment.paymentMethod}'),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class CustomerFavoritesScreen extends StatefulWidget {
  const CustomerFavoritesScreen({super.key});

  @override
  State<CustomerFavoritesScreen> createState() =>
      _CustomerFavoritesScreenState();
}

class _CustomerFavoritesScreenState extends State<CustomerFavoritesScreen> {
  static const _service = CustomerProfileApiService();

  List<CustomerFavoriteProviderModel>? _items;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final items = await _service.fetchFavorites();
      if (!mounted) {
        return;
      }
      setState(() => _items = items);
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _error = error.toString().replaceFirst('Exception: ', ''));
    }
  }

  Future<void> _removeFavorite(String providerId) async {
    final previousItems = _items ?? const [];
    setState(() {
      _items = previousItems.where((item) => item.id != providerId).toList();
      _error = '';
    });
    try {
      await _service.removeFavorite(providerId);
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _items = previousItems;
        _error = error.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final items = _items;
    return Scaffold(
      appBar: const SwiperAppBar(
        title: 'Favourite Providers',
        subtitle: 'Saved provider shortlist',
        showBack: true,
      ),
      body: items == null && _error.isEmpty
          ? const LoadingState(label: 'Loading favourites...')
          : ListView(
              padding: AppSpacing.screenPadding,
              children: [
                if (_error.isNotEmpty) _errorBanner(_error),
                if (items != null && items.isNotEmpty)
                  ...items.map(
                    (item) => Padding(
                      padding: const EdgeInsets.only(bottom: AppSpacing.md),
                      child: _favoriteCard(context, item),
                    ),
                  ),
                if (items != null && items.isEmpty)
                  const EmptyState(
                    title: 'No favourite providers left',
                    subtitle: 'Providers you save will appear here.',
                    icon: Icons.favorite_border_rounded,
                  ),
              ],
            ),
    );
  }

  Widget _favoriteCard(
    BuildContext context,
    CustomerFavoriteProviderModel item,
  ) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: _cardDecoration(),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ProfileAvatar(
            name: item.name,
            imageUrl: item.portraitSrc,
            radius: 40,
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            item.name,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF111827),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            item.role,
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: AppColors.primary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => _removeFavorite(item.id),
                      icon: const Icon(
                        Icons.favorite_rounded,
                        color: Colors.redAccent,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                Text('Rating: ${(item.rating ?? 4.8).toStringAsFixed(1)}'),
                const SizedBox(height: 4),
                Text('From: ${item.priceLabel ?? 'RM200/hr'}'),
                const SizedBox(height: AppSpacing.md),
                Align(
                  alignment: Alignment.centerRight,
                  child: SwiperButton(
                    label: 'Book Now',
                    onPressed: () => Navigator.of(context).pushNamed(
                      AppRoutes.providerProfile,
                      arguments: item.toProviderSummary(),
                    ),
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

class CustomerNotificationsScreen extends StatefulWidget {
  const CustomerNotificationsScreen({super.key, required this.repository});

  final DemoRepository repository;

  @override
  State<CustomerNotificationsScreen> createState() =>
      _CustomerNotificationsScreenState();
}

class _CustomerNotificationsScreenState
    extends State<CustomerNotificationsScreen> {
  late List<NotificationItem> _items;

  @override
  void initState() {
    super.initState();
    _items = widget.repository.getNotifications();
  }

  void _openNotification(NotificationItem item, int index) {
    setState(() {
      _items = [
        for (var i = 0; i < _items.length; i++)
          NotificationItem(
            title: _items[i].title,
            body: _items[i].body,
            timeLabel: _items[i].timeLabel,
            isUnread: i == index ? false : _items[i].isUnread,
            targetRoute: _items[i].targetRoute,
            targetArgument: _items[i].targetArgument,
          ),
      ];
    });

    if (item.targetRoute != null) {
      Navigator.of(
        context,
      ).pushNamed(item.targetRoute!, arguments: item.targetArgument);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const SwiperAppBar(
        title: 'Notifications',
        subtitle: 'Booking and payment updates',
        showBack: true,
      ),
      body: ListView(
        padding: AppSpacing.screenPadding,
        children: [
          if (_items.isEmpty)
            const EmptyState(
              title: 'No notifications yet',
              subtitle:
                  'Booking updates, provider decisions, and payment alerts will show up here.',
              icon: Icons.notifications_none_rounded,
            )
          else
            ..._items.asMap().entries.map((entry) {
              final index = entry.key;
              final item = entry.value;
              return Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.md),
                child: InkWell(
                  borderRadius: BorderRadius.circular(18),
                  onTap: () => _openNotification(item, index),
                  child: Container(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    decoration: BoxDecoration(
                      color: item.isUnread
                          ? const Color(0xFFFAF7FD)
                          : Colors.white,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(
                        color: item.isUnread
                            ? const Color(0xFFD7C1EB)
                            : const Color(0xFFE4ECE7),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    item.title,
                                    style: const TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.w800,
                                      color: Color(0xFF111827),
                                    ),
                                  ),
                                  const SizedBox(height: AppSpacing.sm),
                                  Text(
                                    item.body,
                                    style: const TextStyle(
                                      fontSize: 13,
                                      height: 1.6,
                                      color: Color(0xFF4B5563),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            if (item.isUnread)
                              Container(
                                width: 10,
                                height: 10,
                                margin: const EdgeInsets.only(top: 4),
                                decoration: const BoxDecoration(
                                  color: AppColors.primary,
                                  shape: BoxShape.circle,
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.md),
                        Text(
                          item.timeLabel,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF6B7280),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }
}

class CustomerCouponsScreen extends StatelessWidget {
  const CustomerCouponsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    const coupons = <({String title, String code, String expiry, String note})>[
      (
        title: '5% Discount',
        code: 'SAVE5',
        expiry: 'Expires in 5 days',
        note: 'Use this demo coupon on your next booking to save 5%.',
      ),
      (
        title: 'RM10 Discount',
        code: 'LESS10',
        expiry: 'Expires in 13 hrs',
        note: 'Demo coupon for RM10 off selected service bookings.',
      ),
      (
        title: 'Free Platform Fee',
        code: 'NOFEE',
        expiry: 'Expires in 2 days',
        note: 'Waives the platform fee on one future booking.',
      ),
    ];

    return Scaffold(
      appBar: const SwiperAppBar(
        title: 'Coupons',
        subtitle: 'Demo coupons for future bookings',
        showBack: true,
      ),
      body: ListView(
        padding: AppSpacing.screenPadding,
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.lg),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(26),
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFFFFF7ED), Color(0xFFFFEDD5)],
              ),
              border: Border.all(color: const Color(0xFFF4D6A8)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                Text(
                  'Available Coupons',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF7C2D12),
                  ),
                ),
                SizedBox(height: AppSpacing.sm),
                Text(
                  'These are demo coupons for now. Later, users will be able to apply them during booking checkout.',
                  style: TextStyle(
                    fontSize: 13,
                    color: Color(0xFF9A3412),
                    height: 1.5,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: AppSpacing.sm,
            crossAxisSpacing: AppSpacing.sm,
            childAspectRatio: 0.92,
            children: [
              for (final coupon in coupons)
                _CouponBox(
                  title: coupon.title,
                  code: coupon.code,
                  expiry: coupon.expiry,
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CouponBox extends StatelessWidget {
  const _CouponBox({
    required this.title,
    required this.code,
    required this.expiry,
  });

  final String title;
  final String code;
  final String expiry;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFFFF7ED), Color(0xFFFFEDD5)],
        ),
        border: Border.all(color: const Color(0xFFF4D6A8)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: const Color(0xFFFFF1DE),
              borderRadius: BorderRadius.circular(13),
            ),
            child: const Icon(
              Icons.local_offer_outlined,
              color: Color(0xFFEA7A00),
              size: 18,
            ),
          ),
          const Spacer(),
          Text(
            title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w900,
              color: Color(0xFF7C2D12),
              height: 1.2,
            ),
          ),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.6),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              code,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                color: Color(0xFF7C2D12),
              ),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            expiry,
            style: const TextStyle(fontSize: 10.5, color: Color(0xFF9A3412)),
          ),
        ],
      ),
    );
  }
}

class _VerificationStatusTile extends StatelessWidget {
  const _VerificationStatusTile({
    required this.title,
    required this.subtitle,
    required this.verified,
    required this.icon,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final bool verified;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final label = verified ? 'Verified' : 'Pending';
    final tone = verified ? SwiperStatusTone.success : SwiperStatusTone.warning;

    return InkWell(
      borderRadius: BorderRadius.circular(22),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: const Color(0xFFECE4FA)),
          boxShadow: const [
            BoxShadow(
              color: Color(0x0A6A45A0),
              blurRadius: 18,
              offset: Offset(0, 8),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: AppColors.primarySoft,
                borderRadius: BorderRadius.circular(18),
              ),
              child: Icon(icon, color: AppColors.primary),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF1F1630),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      fontSize: 13,
                      color: Color(0xFF7B728A),
                    ),
                  ),
                ],
              ),
            ),
            SwiperStatusBadge(label: label, tone: tone),
            const SizedBox(width: AppSpacing.sm),
            const Icon(Icons.chevron_right_rounded, color: Color(0xFF98A2B3)),
          ],
        ),
      ),
    );
  }
}

BoxDecoration _cardDecoration() {
  return BoxDecoration(
    color: Colors.white,
    borderRadius: BorderRadius.circular(24),
    border: Border.all(color: const Color(0xFFEEE5F7)),
    boxShadow: const [
      BoxShadow(
        color: Color(0x14562687),
        blurRadius: 24,
        offset: Offset(0, 10),
      ),
    ],
  );
}

Widget _securityCard(String message) {
  return Container(
    padding: const EdgeInsets.all(AppSpacing.md),
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(22),
      border: Border.all(color: const Color(0xFFEADFF8)),
      gradient: const LinearGradient(
        colors: [Color(0xFFFBF8FF), Color(0xFFF5EFFF)],
      ),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
          ),
          child: const Icon(
            Icons.verified_user_outlined,
            color: AppColors.primary,
          ),
        ),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Your security matters',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF1F1630),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                message,
                style: const TextStyle(
                  fontSize: 13,
                  color: Color(0xFF6F6681),
                  height: 1.5,
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

Widget _errorBanner(String error) {
  return Container(
    padding: const EdgeInsets.all(AppSpacing.md),
    decoration: BoxDecoration(
      color: const Color(0xFFFFF1F2),
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: const Color(0xFFFECACA)),
    ),
    child: Text(
      error,
      style: const TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w700,
        color: Color(0xFFDC2626),
      ),
    ),
  );
}

String _statusLabel(String status) {
  switch (status) {
    case 'verified':
      return 'Verified';
    case 'processing':
      return 'Processing';
    case 'rejected':
      return 'Rejected';
    default:
      return 'Pending';
  }
}

SwiperStatusTone _statusTone(String status) {
  switch (status) {
    case 'verified':
      return SwiperStatusTone.success;
    case 'processing':
      return SwiperStatusTone.info;
    case 'rejected':
      return SwiperStatusTone.error;
    default:
      return SwiperStatusTone.warning;
  }
}

class _WalletAmountChip extends StatelessWidget {
  const _WalletAmountChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF5F0FF),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0xFFE7DCF7)),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: AppColors.primary,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

Widget _sectionCard({required String title, required Widget child}) {
  return Container(
    padding: const EdgeInsets.all(AppSpacing.md),
    decoration: _cardDecoration(),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w800,
            color: Color(0xFF111827),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        child,
      ],
    ),
  );
}

Widget _summaryRow(String label, String value, {bool emphasize = false}) {
  return Row(
    children: [
      Expanded(
        child: Text(
          label,
          style: TextStyle(
            fontSize: emphasize ? 15 : 13,
            fontWeight: emphasize ? FontWeight.w800 : FontWeight.w500,
            color: const Color(0xFF4F4663),
          ),
        ),
      ),
      Text(
        value,
        style: TextStyle(
          fontSize: emphasize ? 22 : 13,
          fontWeight: FontWeight.w800,
          color: emphasize ? AppColors.primary : const Color(0xFF24193A),
        ),
      ),
    ],
  );
}
