import 'package:flutter/material.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/routing/app_routes.dart';
import '../../../repositories/demo_repository.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/swiper_button.dart';
import '../../../widgets/swiper_password_field.dart';
import '../../../widgets/swiper_text_field.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.repository});

  final DemoRepository repository;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController(text: 'demo@myswiper.my');
  final _passwordController = TextEditingController(text: 'password123');
  final _emailFocusNode = FocusNode();
  final _passwordFocusNode = FocusNode();

  bool _rememberMe = true;
  bool _isSubmitting = false;
  bool _showValidation = false;
  String? _errorMessage;

  static const _customerEmail = 'demo@myswiper.my';
  static const _providerEmail = 'provider@myswiper.my';
  static const _demoPassword = 'password123';

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _emailFocusNode.dispose();
    _passwordFocusNode.dispose();
    super.dispose();
  }

  String? _validateEmail(String? value) {
    final email = value?.trim() ?? '';
    if (email.isEmpty) {
      return 'Email is required.';
    }

    final emailPattern = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');
    if (!emailPattern.hasMatch(email)) {
      return 'Enter a valid email address.';
    }

    return null;
  }

  String? _validatePassword(String? value) {
    final password = value ?? '';
    if (password.isEmpty) {
      return 'Password is required.';
    }

    return null;
  }

  String _nextCustomerRoute(BuildContext context) {
    final arguments = ModalRoute.of(context)?.settings.arguments;
    if (arguments is Map && arguments['next'] is String) {
      return arguments['next'] as String;
    }

    return AppRoutes.customerShell;
  }

  bool _isProviderEmail(String email) {
    final normalized = email.trim().toLowerCase();
    return normalized == _providerEmail || normalized.contains('provider');
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    setState(() {
      _showValidation = true;
      _errorMessage = null;
    });

    if (!_formKey.currentState!.validate()) {
      return;
    }

    final email = _emailController.text.trim().toLowerCase();
    final password = _passwordController.text;
    final validEmail = email == _customerEmail || email == _providerEmail;

    setState(() {
      _isSubmitting = true;
    });

    await Future<void>.delayed(const Duration(milliseconds: 900));

    if (!mounted) {
      return;
    }

    if (!validEmail || password != _demoPassword) {
      setState(() {
        _isSubmitting = false;
        _errorMessage =
            'Unable to sign in. Check your email and password and try again.';
      });
      return;
    }

    setState(() {
      _isSubmitting = false;
    });

    final routeName = _isProviderEmail(email)
        ? AppRoutes.providerShell
        : _nextCustomerRoute(context);

    Navigator.of(context).pushReplacementNamed(routeName);
  }

  void _showDemoMessage(String message) {
    FocusScope.of(context).unfocus();
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: GestureDetector(
          onTap: () => FocusScope.of(context).unfocus(),
          child: SingleChildScrollView(
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.xl,
              AppSpacing.lg,
              AppSpacing.xl,
            ),
            child: Form(
              key: _formKey,
              autovalidateMode: _showValidation
                  ? AutovalidateMode.onUserInteraction
                  : AutovalidateMode.disabled,
              child: AutofillGroup(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: AppSpacing.sm),
                    Center(
                      child: Container(
                        width: 60,
                        height: 60,
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [AppColors.primary, AppColors.primaryDeep],
                          ),
                          borderRadius: BorderRadius.circular(20),
                          boxShadow: const [
                            BoxShadow(
                              color: Color(0x338968CD),
                              blurRadius: 24,
                              offset: Offset(0, 12),
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.swipe_rounded,
                          color: Colors.white,
                          size: 30,
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xl),
                    Text(
                      'Welcome back!',
                      style: theme.textTheme.headlineMedium?.copyWith(
                        fontSize: 24,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      'Log in to continue to your ${AppConstants.appName} account.',
                      style: theme.textTheme.bodyMedium,
                    ),
                    const SizedBox(height: AppSpacing.xl),
                    SwiperTextField(
                      label: 'Email',
                      hintText: 'Enter your email',
                      controller: _emailController,
                      prefixIcon: const Icon(Icons.mail_outline_rounded),
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      focusNode: _emailFocusNode,
                      autofillHints: const [
                        AutofillHints.username,
                        AutofillHints.email,
                      ],
                      onChanged: (_) {
                        if (_errorMessage != null) {
                          setState(() => _errorMessage = null);
                        }
                      },
                      onSubmitted: (_) {
                        FocusScope.of(context).requestFocus(_passwordFocusNode);
                      },
                      validator: _validateEmail,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            'Password',
                            style: theme.textTheme.labelLarge,
                          ),
                        ),
                        TextButton(
                          onPressed: () => _showDemoMessage(
                            'Forgot password is not connected in Flutter yet.',
                          ),
                          style: TextButton.styleFrom(
                            foregroundColor: AppColors.primary,
                            padding: EdgeInsets.zero,
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            minimumSize: const Size(0, 0),
                          ),
                          child: const Text('Forgot password?'),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    SwiperPasswordField(
                      label: 'Password',
                      hintText: 'Enter your password',
                      controller: _passwordController,
                      focusNode: _passwordFocusNode,
                      textInputAction: TextInputAction.done,
                      autofillHints: const [AutofillHints.password],
                      onChanged: (_) {
                        if (_errorMessage != null) {
                          setState(() => _errorMessage = null);
                        }
                      },
                      onSubmitted: (_) => _submit(),
                      validator: _validatePassword,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    InkWell(
                      borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                      onTap: () => setState(() => _rememberMe = !_rememberMe),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          vertical: AppSpacing.xs,
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            AnimatedContainer(
                              duration: const Duration(milliseconds: 160),
                              height: 20,
                              width: 20,
                              decoration: BoxDecoration(
                                color: _rememberMe
                                    ? AppColors.primary
                                    : Colors.white,
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(
                                  color: _rememberMe
                                      ? AppColors.primary
                                      : AppColors.border,
                                ),
                              ),
                              child: Icon(
                                Icons.check_rounded,
                                size: 14,
                                color: _rememberMe
                                    ? Colors.white
                                    : Colors.transparent,
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
                          borderRadius: BorderRadius.circular(
                            AppSpacing.radiusMd,
                          ),
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
                    SwiperButton(
                      label: _isSubmitting ? 'Logging in...' : 'Log in',
                      icon: const Icon(Icons.arrow_forward_rounded),
                      isLoading: _isSubmitting,
                      onPressed: _isSubmitting ? null : _submit,
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    Row(
                      children: [
                        const Expanded(child: Divider(height: 1)),
                        Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.md,
                          ),
                          child: Text('or', style: theme.textTheme.labelMedium),
                        ),
                        const Expanded(child: Divider(height: 1)),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    OutlinedButton.icon(
                      onPressed: () => _showDemoMessage(
                        'Create account is not connected in Flutter yet.',
                      ),
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
                          const SizedBox(height: AppSpacing.lg),
                          Text(
                            'Demo accounts: $_customerEmail or $_providerEmail',
                            textAlign: TextAlign.center,
                            style: theme.textTheme.bodyMedium?.copyWith(
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
