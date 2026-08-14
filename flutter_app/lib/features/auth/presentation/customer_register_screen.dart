import 'package:flutter/material.dart';

import '../../../core/routing/app_routes.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/swiper_button.dart';
import '../../../widgets/swiper_password_field.dart';
import '../../../widgets/swiper_text_field.dart';
import 'auth_flow_scaffold.dart';

class CustomerRegisterScreen extends StatefulWidget {
  const CustomerRegisterScreen({super.key});

  @override
  State<CustomerRegisterScreen> createState() => _CustomerRegisterScreenState();
}

class _CustomerRegisterScreenState extends State<CustomerRegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _fullNameController = TextEditingController();
  final _dobController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _fullNameController.dispose();
    _dobController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  String? _required(String? value, String label) {
    if ((value ?? '').trim().isEmpty) {
      return '$label is required.';
    }
    return null;
  }

  String? _emailValidator(String? value) {
    final required = _required(value, 'Email');
    if (required != null) return required;
    final emailPattern = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');
    if (!emailPattern.hasMatch(value!.trim())) {
      return 'Enter a valid email address.';
    }
    return null;
  }

  String? _passwordValidator(String? value) {
    final required = _required(value, 'Password');
    if (required != null) return required;
    if (value!.length < 8) {
      return 'Password must be at least 8 characters long.';
    }
    return null;
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final selected = await showDatePicker(
      context: context,
      initialDate: DateTime(now.year - 24),
      firstDate: DateTime(1950),
      lastDate: DateTime(now.year - 18, now.month, now.day),
    );

    if (selected == null || !mounted) {
      return;
    }

    setState(() {
      _dobController.text =
          '${selected.day.toString().padLeft(2, '0')}/${selected.month.toString().padLeft(2, '0')}/${selected.year}';
    });
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) {
      return;
    }
    if (_passwordController.text != _confirmPasswordController.text) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Passwords do not match.')));
      return;
    }

    setState(() => _submitting = true);
    await Future<void>.delayed(const Duration(milliseconds: 500));
    if (!mounted) return;

    setState(() => _submitting = false);
    Navigator.of(context).pushNamed(
      AppRoutes.registerCustomerVerify,
      arguments: {
        'phone': '+60 ${_phoneController.text.trim()}',
        'name': _fullNameController.text.trim(),
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return AuthFlowScaffold(
      hero: const AuthCircleHero(icon: Icons.person_add_alt_1_rounded),
      title: 'Create Your Account',
      subtitle: 'Book trusted services near you',
      showBack: true,
      bottom: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SwiperButton(
            label: 'Create Account',
            isLoading: _submitting,
            onPressed: _submitting ? null : _submit,
          ),
          const SizedBox(height: AppSpacing.sm),
          TextButton(
            onPressed: () =>
                Navigator.of(context).pushReplacementNamed(AppRoutes.login),
            child: const Text('Already have an account? Log in'),
          ),
        ],
      ),
      child: Form(
        key: _formKey,
        child: Column(
          children: [
            SwiperTextField(
              label: 'Full Name',
              hintText: 'Enter your full name',
              controller: _fullNameController,
              prefixIcon: const Icon(Icons.person_outline_rounded),
              validator: (value) => _required(value, 'Full name'),
            ),
            const SizedBox(height: AppSpacing.md),
            GestureDetector(
              onTap: _pickDate,
              child: AbsorbPointer(
                child: SwiperTextField(
                  label: 'Date of Birth',
                  hintText: 'Select date of birth',
                  controller: _dobController,
                  prefixIcon: const Icon(Icons.calendar_month_rounded),
                  validator: (value) => _required(value, 'Date of birth'),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            SwiperTextField(
              label: 'Email',
              hintText: 'Enter email address',
              controller: _emailController,
              prefixIcon: const Icon(Icons.mail_outline_rounded),
              keyboardType: TextInputType.emailAddress,
              validator: _emailValidator,
            ),
            const SizedBox(height: AppSpacing.md),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 92,
                  height: 56,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    border: Border.all(color: AppColors.border),
                    borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                  ),
                  child: const Text(
                    '+60',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: SwiperTextField(
                    label: 'Phone Number',
                    hintText: 'Enter phone number',
                    controller: _phoneController,
                    prefixIcon: const Icon(Icons.call_outlined),
                    keyboardType: TextInputType.phone,
                    validator: (value) => _required(value, 'Phone number'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            SwiperPasswordField(
              label: 'Password',
              hintText: 'Enter password',
              controller: _passwordController,
              validator: _passwordValidator,
            ),
            const SizedBox(height: AppSpacing.md),
            SwiperPasswordField(
              label: 'Confirm Password',
              hintText: 'Re-enter password',
              controller: _confirmPasswordController,
              validator: (value) => _required(value, 'Confirm password'),
            ),
          ],
        ),
      ),
    );
  }
}
