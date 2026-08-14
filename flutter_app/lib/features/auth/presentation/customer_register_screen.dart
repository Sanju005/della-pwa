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
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _dobController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emergencyController = TextEditingController();
  final _addressLabelController = TextEditingController(text: 'Address 1');
  final _addressLine1Controller = TextEditingController();
  final _addressLine2Controller = TextEditingController();
  final _postcodeController = TextEditingController();
  final _cityController = TextEditingController();
  final _countryController = TextEditingController(text: 'Malaysia');
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  String _sex = 'Male';
  String _stateName = '';
  bool _acceptedTerms = false;
  bool _submitting = false;
  String? _errorMessage;

  static const List<String> _malaysianStates = [
    'Johor',
    'Kedah',
    'Kelantan',
    'Kuala Lumpur',
    'Labuan',
    'Melaka',
    'Negeri Sembilan',
    'Pahang',
    'Penang',
    'Perak',
    'Perlis',
    'Putrajaya',
    'Sabah',
    'Sarawak',
    'Selangor',
    'Terengganu',
  ];

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _dobController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _emergencyController.dispose();
    _addressLabelController.dispose();
    _addressLine1Controller.dispose();
    _addressLine2Controller.dispose();
    _postcodeController.dispose();
    _cityController.dispose();
    _countryController.dispose();
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
    if (required != null) {
      return required;
    }

    final emailPattern = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');
    if (!emailPattern.hasMatch(value!.trim())) {
      return 'Enter a valid email address.';
    }
    return null;
  }

  String? _passwordValidator(String? value) {
    final required = _required(value, 'Password');
    if (required != null) {
      return required;
    }
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

    _dobController.text =
        '${selected.year}-${selected.month.toString().padLeft(2, '0')}-${selected.day.toString().padLeft(2, '0')}';
    setState(() {});
  }

  void _submit() {
    FocusScope.of(context).unfocus();
    setState(() => _errorMessage = null);

    if (!_formKey.currentState!.validate()) {
      return;
    }
    if (_stateName.isEmpty) {
      setState(() => _errorMessage = 'State is required.');
      return;
    }
    if (_passwordController.text != _confirmPasswordController.text) {
      setState(() => _errorMessage = 'Passwords do not match.');
      return;
    }
    if (!_acceptedTerms) {
      setState(
        () => _errorMessage =
            'Please accept the Terms of Service and Privacy Policy.',
      );
      return;
    }

    setState(() => _submitting = true);
    final arguments = {
      'firstName': _firstNameController.text.trim(),
      'lastName': _lastNameController.text.trim(),
      'dateOfBirth': _dobController.text.trim(),
      'sex': _sex,
      'email': _emailController.text.trim(),
      'phoneNumber': _phoneController.text.trim(),
      'emergencyContactNumber': _emergencyController.text.trim(),
      'password': _passwordController.text,
      'confirmPassword': _confirmPasswordController.text,
      'addressLabel': _addressLabelController.text.trim(),
      'addressLine1': _addressLine1Controller.text.trim(),
      'addressLine2': _addressLine2Controller.text.trim(),
      'postcode': _postcodeController.text.trim(),
      'city': _cityController.text.trim(),
      'state': _stateName,
      'country': _countryController.text.trim(),
    };

    Future<void>.delayed(const Duration(milliseconds: 250), () {
      if (!mounted) {
        return;
      }
      setState(() => _submitting = false);
      Navigator.of(
        context,
      ).pushNamed(AppRoutes.registerCustomerVerify, arguments: arguments);
    });
  }

  @override
  Widget build(BuildContext context) {
    return AuthFlowScaffold(
      hero: const AuthCircleHero(icon: Icons.person_add_alt_1_rounded),
      title: 'Create account as User',
      subtitle: 'Fill in the details below to create your Swiper account.',
      showBack: true,
      bottom: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SwiperButton(
            label: 'Create account',
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
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SwiperTextField(
              label: 'First Name',
              hintText: 'Enter your first name',
              controller: _firstNameController,
              prefixIcon: const Icon(Icons.person_outline_rounded),
              validator: (value) => _required(value, 'First name'),
              onChanged: (_) {
                if (_errorMessage != null) {
                  setState(() => _errorMessage = null);
                }
              },
            ),
            const SizedBox(height: AppSpacing.md),
            SwiperTextField(
              label: 'Last Name',
              hintText: 'Enter your last name',
              controller: _lastNameController,
              prefixIcon: const Icon(Icons.person_outline_rounded),
              validator: (value) => _required(value, 'Last name'),
              onChanged: (_) {
                if (_errorMessage != null) {
                  setState(() => _errorMessage = null);
                }
              },
            ),
            const SizedBox(height: AppSpacing.md),
            DropdownButtonFormField<String>(
              initialValue: _sex,
              decoration: const InputDecoration(
                labelText: 'Gender',
                prefixIcon: Icon(Icons.wc_rounded),
              ),
              items: const ['Male', 'Female']
                  .map(
                    (item) => DropdownMenuItem<String>(
                      value: item,
                      child: Text(item),
                    ),
                  )
                  .toList(),
              onChanged: (value) {
                setState(() {
                  _sex = value ?? _sex;
                  _errorMessage = null;
                });
              },
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
              onChanged: (_) {
                if (_errorMessage != null) {
                  setState(() => _errorMessage = null);
                }
              },
            ),
            const SizedBox(height: AppSpacing.md),
            SwiperTextField(
              label: 'Phone Number',
              hintText: 'Enter phone number',
              controller: _phoneController,
              prefixIcon: const Icon(Icons.call_outlined),
              keyboardType: TextInputType.phone,
              validator: (value) => _required(value, 'Phone number'),
              onChanged: (_) {
                if (_errorMessage != null) {
                  setState(() => _errorMessage = null);
                }
              },
            ),
            const SizedBox(height: AppSpacing.md),
            SwiperTextField(
              label: 'Emergency Contact Number',
              hintText: 'Enter emergency contact number',
              controller: _emergencyController,
              prefixIcon: const Icon(Icons.contact_phone_outlined),
              keyboardType: TextInputType.phone,
              validator: (value) =>
                  _required(value, 'Emergency contact number'),
            ),
            const SizedBox(height: AppSpacing.lg),
            Container(
              padding: const EdgeInsets.all(AppSpacing.lg),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Saved Address',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    'Add your main address now. You can save more addresses later from your profile.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  SwiperTextField(
                    label: 'Address Name',
                    hintText: 'Address 1',
                    controller: _addressLabelController,
                    prefixIcon: const Icon(Icons.bookmark_border_rounded),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  SwiperTextField(
                    label: 'Address Line 1',
                    hintText: 'Street name, building, area',
                    controller: _addressLine1Controller,
                    prefixIcon: const Icon(Icons.place_outlined),
                    validator: (value) => _required(value, 'Address line 1'),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  SwiperTextField(
                    label: 'Address Line 2',
                    hintText: 'Apartment, floor, landmark',
                    controller: _addressLine2Controller,
                    prefixIcon: const Icon(Icons.location_city_outlined),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  SwiperTextField(
                    label: 'Postcode',
                    hintText: 'Postcode',
                    controller: _postcodeController,
                    prefixIcon: const Icon(Icons.markunread_mailbox_outlined),
                    keyboardType: TextInputType.number,
                    validator: (value) => _required(value, 'Postcode'),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  SwiperTextField(
                    label: 'City',
                    hintText: 'City',
                    controller: _cityController,
                    prefixIcon: const Icon(Icons.location_city_outlined),
                    validator: (value) => _required(value, 'City'),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  DropdownButtonFormField<String>(
                    initialValue: _stateName.isEmpty ? null : _stateName,
                    decoration: const InputDecoration(
                      labelText: 'State',
                      prefixIcon: Icon(Icons.map_outlined),
                    ),
                    items: _malaysianStates
                        .map(
                          (item) => DropdownMenuItem<String>(
                            value: item,
                            child: Text(item),
                          ),
                        )
                        .toList(),
                    onChanged: (value) {
                      setState(() {
                        _stateName = value ?? '';
                        _errorMessage = null;
                      });
                    },
                  ),
                  const SizedBox(height: AppSpacing.md),
                  SwiperTextField(
                    label: 'Country',
                    hintText: 'Country',
                    controller: _countryController,
                    prefixIcon: const Icon(Icons.public_rounded),
                    validator: (value) => _required(value, 'Country'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            SwiperPasswordField(
              label: 'Password',
              hintText: 'Create a password',
              controller: _passwordController,
              validator: _passwordValidator,
            ),
            const SizedBox(height: AppSpacing.sm),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: AppColors.primarySoft,
                borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('At least 8 characters'),
                  SizedBox(height: AppSpacing.xs),
                  Text('One uppercase letter'),
                  SizedBox(height: AppSpacing.xs),
                  Text('One number'),
                  SizedBox(height: AppSpacing.xs),
                  Text('One special character'),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            SwiperPasswordField(
              label: 'Confirm Password',
              hintText: 'Confirm your password',
              controller: _confirmPasswordController,
              validator: (value) => _required(value, 'Confirm password'),
            ),
            const SizedBox(height: AppSpacing.lg),
            InkWell(
              borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
              onTap: () => setState(() {
                _acceptedTerms = !_acceptedTerms;
                _errorMessage = null;
              }),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      margin: const EdgeInsets.only(top: 2),
                      height: 20,
                      width: 20,
                      decoration: BoxDecoration(
                        color: _acceptedTerms
                            ? AppColors.primary
                            : Colors.white,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(
                          color: _acceptedTerms
                              ? AppColors.primary
                              : AppColors.border,
                        ),
                      ),
                      child: Icon(
                        Icons.check_rounded,
                        size: 14,
                        color: _acceptedTerms
                            ? Colors.white
                            : Colors.transparent,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Text(
                        'I agree to the Terms of Service and Privacy Policy',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (_errorMessage != null) ...[
              const SizedBox(height: AppSpacing.md),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF1F2),
                  borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                  border: Border.all(color: const Color(0xFFFECACA)),
                ),
                child: Text(
                  _errorMessage!,
                  style: Theme.of(
                    context,
                  ).textTheme.labelMedium?.copyWith(color: AppColors.error),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
