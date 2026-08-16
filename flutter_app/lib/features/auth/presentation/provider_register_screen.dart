import 'package:flutter/material.dart';

import '../../../core/routing/app_routes.dart';
import '../../../services/auth_service.dart';
import '../../../services/browser_file_picker.dart';
import '../../../services/provider_registration_service.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/swiper_button.dart';
import '../../../widgets/swiper_password_field.dart';
import '../../../widgets/swiper_text_field.dart';
import 'auth_flow_scaffold.dart';

enum _ProviderStep {
  basic,
  preVerification,
  services,
  serviceDetail,
  availability,
  location,
  review,
  submitted,
  verification,
  identity,
  success,
}

class ProviderRegisterScreen extends StatefulWidget {
  const ProviderRegisterScreen({super.key});

  @override
  State<ProviderRegisterScreen> createState() => _ProviderRegisterScreenState();
}

class _ProviderRegisterScreenState extends State<ProviderRegisterScreen> {
  final _basicFormKey = GlobalKey<FormState>();
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _marketingNameController = TextEditingController();
  final _dobController = TextEditingController();
  final _address1Controller = TextEditingController();
  final _address2Controller = TextEditingController();
  final _postcodeController = TextEditingController();
  final _cityController = TextEditingController();
  final _stateController = TextEditingController(text: 'Kuala Lumpur');
  final _countryController = TextEditingController(text: 'Malaysia');
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emergencyController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _areaLabelController = TextEditingController(
    text: 'Mont Kiara, Kuala Lumpur',
  );
  final _serviceRateController = TextEditingController(text: '95');
  final _serviceExperienceController = TextEditingController(text: '4');
  final _specialtiesController = TextEditingController();
  final _frontDocController = TextEditingController();
  final _backDocController = TextEditingController();
  final _phoneOtpControllers = List.generate(
    6,
    (_) => TextEditingController(),
    growable: false,
  );
  final _providerRegistrationService = const ProviderRegistrationService();
  final _authService = const AuthService();

  _ProviderStep _step = _ProviderStep.basic;
  int _serviceDetailIndex = 0;
  String _gender = 'Female';
  String _documentType = 'IC / Passport / Driving License';
  String _timePreset = '9 AM - 9 PM';
  double _radiusKm = 12;
  bool _submitting = false;
  final List<String> _selectedServices = [];
  final Set<String> _availabilityDays = {
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
  };
  final Map<String, String> _serviceRateByService = {};
  final Map<String, String> _serviceExperienceByService = {};
  final Map<String, String> _serviceSpecialtiesByService = {};
  PickedBrowserFile? _profileImage;
  List<PickedBrowserFile> _workImages = const [];
  String? _submitError;
  ProviderRegistrationResult? _registrationResult;

  static const _services = [
    'Chef',
    'Maid',
    'Driver',
    'Tutor',
    'Cleaner',
    'Babysitter',
    'Plumber',
    'Electrician',
    'Other',
  ];

  @override
  void dispose() {
    for (final controller in [
      _firstNameController,
      _lastNameController,
      _marketingNameController,
      _dobController,
      _address1Controller,
      _address2Controller,
      _postcodeController,
      _cityController,
      _stateController,
      _countryController,
      _emailController,
      _phoneController,
      _emergencyController,
      _passwordController,
      _confirmPasswordController,
      _areaLabelController,
      _serviceRateController,
      _serviceExperienceController,
      _specialtiesController,
      _frontDocController,
      _backDocController,
    ]) {
      controller.dispose();
    }
    for (final controller in _phoneOtpControllers) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final selected = await showDatePicker(
      context: context,
      initialDate: DateTime(now.year - 28),
      firstDate: DateTime(1950),
      lastDate: DateTime(now.year - 18),
    );

    if (selected != null) {
      _dobController.text =
          '${selected.day.toString().padLeft(2, '0')}/${selected.month.toString().padLeft(2, '0')}/${selected.year}';
      setState(() {});
    }
  }

  String _heading() {
    switch (_step) {
      case _ProviderStep.basic:
        return 'Create Your Profile';
      case _ProviderStep.preVerification:
        return 'Verify Your Email';
      case _ProviderStep.services:
        return 'Select Services';
      case _ProviderStep.serviceDetail:
        return '${_currentServiceName()} Service';
      case _ProviderStep.availability:
        return 'Availability';
      case _ProviderStep.location:
        return 'Provider Location';
      case _ProviderStep.review:
        return 'Review & Submit';
      case _ProviderStep.submitted:
        return 'Listing Submitted';
      case _ProviderStep.verification:
        return 'Verify Your Account';
      case _ProviderStep.identity:
        return 'Verify Your Identity';
      case _ProviderStep.success:
        return 'Profile Submitted';
    }
  }

  String _subtitle() {
    switch (_step) {
      case _ProviderStep.basic:
        return 'Add your profile, contact, and login details';
      case _ProviderStep.preVerification:
        return 'Your email will be activated automatically after registration';
      case _ProviderStep.services:
        return 'Select one or more services you provide';
      case _ProviderStep.serviceDetail:
        return 'Add details about your service';
      case _ProviderStep.availability:
        return 'Select your available days and time';
      case _ProviderStep.location:
        return 'Set your service area';
      case _ProviderStep.review:
        return 'Please review your information';
      case _ProviderStep.submitted:
        return 'Choose whether to verify now or later';
      case _ProviderStep.verification:
        return 'Let\'s verify your contact information';
      case _ProviderStep.identity:
        return 'Upload your identity document';
      case _ProviderStep.success:
        return 'Verification saved successfully';
    }
  }

  Future<void> _continue() async {
    setState(() => _submitError = null);
    if (_step == _ProviderStep.basic) {
      if (!_basicFormKey.currentState!.validate()) return;
      if (_profileImage == null) {
        setState(() => _submitError = 'Please upload a profile picture.');
        return;
      }
      if (_passwordController.text != _confirmPasswordController.text) {
        setState(() => _submitError = 'Passwords do not match.');
        return;
      }
      if (!_passwordStrong(_passwordController.text)) {
        setState(
          () => _submitError =
              'Password must contain uppercase, lowercase, number, and symbol.',
        );
        return;
      }
    }
    if (_step == _ProviderStep.services && _selectedServices.isEmpty) {
      setState(() => _submitError = 'Please select at least one service.');
      return;
    }
    if (_step == _ProviderStep.serviceDetail && _workImages.length != 3) {
      setState(() => _submitError = 'Please upload exactly 3 work images.');
      return;
    }
    if (_step == _ProviderStep.review || _step == _ProviderStep.identity) {
      setState(() => _submitting = true);
    }
    if (_step == _ProviderStep.verification) {
      final code = _phoneOtpControllers
          .map((controller) => controller.text)
          .join();
      if (code != '123456') {
        setState(() => _submitError = 'Use OTP code `123456` to continue.');
        return;
      }
    }
    if (_step == _ProviderStep.review) {
      await _submitProviderRegistration();
      return;
    }
    if (_step == _ProviderStep.identity) {
      await _submitProviderIdentityVerification();
      return;
    }

    if (_step == _ProviderStep.services) {
      _serviceDetailIndex = 0;
      _loadServiceDetail(_currentServiceName());
    }

    if (_step == _ProviderStep.serviceDetail) {
      _saveCurrentServiceDetail();
      if (_serviceDetailIndex < _selectedServices.length - 1) {
        setState(() {
          _serviceDetailIndex += 1;
          _loadServiceDetail(_currentServiceName());
        });
        return;
      }
    }

    setState(() {
      _step = _nextStep(_step);
    });
  }

  void _back() {
    if (_step == _ProviderStep.basic) {
      Navigator.of(context).maybePop();
      return;
    }

    if (_step == _ProviderStep.serviceDetail && _serviceDetailIndex > 0) {
      _saveCurrentServiceDetail();
      setState(() {
        _serviceDetailIndex -= 1;
        _loadServiceDetail(_currentServiceName());
      });
      return;
    }

    if (_step == _ProviderStep.availability && _selectedServices.isNotEmpty) {
      _serviceDetailIndex = _selectedServices.length - 1;
      _loadServiceDetail(_currentServiceName());
    }

    setState(() {
      _step = _previousStep(_step);
    });
  }

  _ProviderStep _nextStep(_ProviderStep step) {
    return switch (step) {
      _ProviderStep.basic => _ProviderStep.preVerification,
      _ProviderStep.preVerification => _ProviderStep.services,
      _ProviderStep.services => _ProviderStep.serviceDetail,
      _ProviderStep.serviceDetail => _ProviderStep.availability,
      _ProviderStep.availability => _ProviderStep.location,
      _ProviderStep.location => _ProviderStep.review,
      _ProviderStep.review => _ProviderStep.submitted,
      _ProviderStep.submitted => _ProviderStep.verification,
      _ProviderStep.verification => _ProviderStep.identity,
      _ProviderStep.identity => _ProviderStep.success,
      _ProviderStep.success => _ProviderStep.success,
    };
  }

  _ProviderStep _previousStep(_ProviderStep step) {
    return switch (step) {
      _ProviderStep.preVerification => _ProviderStep.basic,
      _ProviderStep.services => _ProviderStep.preVerification,
      _ProviderStep.serviceDetail => _ProviderStep.services,
      _ProviderStep.availability => _ProviderStep.serviceDetail,
      _ProviderStep.location => _ProviderStep.availability,
      _ProviderStep.review => _ProviderStep.location,
      _ProviderStep.submitted => _ProviderStep.review,
      _ProviderStep.verification => _ProviderStep.submitted,
      _ProviderStep.identity => _ProviderStep.verification,
      _ProviderStep.success => _ProviderStep.identity,
      _ProviderStep.basic => _ProviderStep.basic,
    };
  }

  bool _passwordStrong(String value) {
    return value.length >= 8 &&
        RegExp(r'[A-Z]').hasMatch(value) &&
        RegExp(r'[a-z]').hasMatch(value) &&
        RegExp(r'\d').hasMatch(value) &&
        RegExp(r'[^\w\s]').hasMatch(value);
  }

  String? _required(String? value, String label) {
    if ((value ?? '').trim().isEmpty) {
      return '$label is required.';
    }
    return null;
  }

  Future<void> _pickProfileImage() async {
    final picked = await pickSingleBrowserFile(accept: 'image/*');
    if (!mounted || picked == null) {
      return;
    }
    setState(() => _profileImage = picked);
  }

  Future<void> _pickWorkImages() async {
    final picked = await pickMultipleBrowserFiles(
      accept: 'image/*',
      maxFiles: 3,
    );
    if (!mounted || picked.isEmpty) {
      return;
    }
    setState(() => _workImages = picked.take(3).toList(growable: false));
  }

  void _removeProfileImage() {
    setState(() => _profileImage = null);
  }

  void _removeWorkImage(int index) {
    final next = List<PickedBrowserFile>.from(_workImages);
    if (index < 0 || index >= next.length) {
      return;
    }
    next.removeAt(index);
    setState(() => _workImages = next);
  }

  Widget _buildBasicStep() {
    return Form(
      key: _basicFormKey,
      child: Column(
        children: [
          _ImagePickerCard(
            title: 'Profile Picture',
            subtitle: 'Add a clear photo for your provider profile.',
            file: _profileImage,
            onPick: _pickProfileImage,
            onRemove: _profileImage == null ? null : _removeProfileImage,
            requiredLabel: 'Required',
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: SwiperTextField(
                  label: 'First Name',
                  hintText: 'First name',
                  controller: _firstNameController,
                  prefixIcon: const Icon(Icons.person_outline_rounded),
                  validator: (value) => _required(value, 'First name'),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: SwiperTextField(
                  label: 'Last Name',
                  hintText: 'Last name',
                  controller: _lastNameController,
                  prefixIcon: const Icon(Icons.person_outline_rounded),
                  validator: (value) => _required(value, 'Last name'),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          DropdownButtonFormField<String>(
            initialValue: _gender,
            items: const ['Female', 'Male']
                .map((item) => DropdownMenuItem(value: item, child: Text(item)))
                .toList(),
            onChanged: (value) => setState(() => _gender = value ?? _gender),
            decoration: const InputDecoration(
              labelText: 'Gender',
              prefixIcon: Icon(Icons.wc_rounded),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          SwiperTextField(
            label: 'Marketing Name',
            hintText: 'e.g. Della Home Chef',
            controller: _marketingNameController,
            prefixIcon: const Icon(Icons.badge_outlined),
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
            label: 'Address Line 1',
            hintText: 'Street address',
            controller: _address1Controller,
            prefixIcon: const Icon(Icons.home_outlined),
            validator: (value) => _required(value, 'Address line 1'),
          ),
          const SizedBox(height: AppSpacing.md),
          SwiperTextField(
            label: 'Address Line 2',
            hintText: 'Apartment, suite, optional',
            controller: _address2Controller,
            prefixIcon: const Icon(Icons.apartment_rounded),
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: SwiperTextField(
                  label: 'Postcode',
                  hintText: '50480',
                  controller: _postcodeController,
                  keyboardType: TextInputType.number,
                  prefixIcon: const Icon(Icons.markunread_mailbox_outlined),
                  validator: (value) => _required(value, 'Postcode'),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: SwiperTextField(
                  label: 'City',
                  hintText: 'Kuala Lumpur',
                  controller: _cityController,
                  prefixIcon: const Icon(Icons.location_city_outlined),
                  validator: (value) => _required(value, 'City'),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          SwiperTextField(
            label: 'State',
            hintText: 'State',
            controller: _stateController,
            prefixIcon: const Icon(Icons.map_outlined),
            validator: (value) => _required(value, 'State'),
          ),
          const SizedBox(height: AppSpacing.md),
          SwiperTextField(
            label: 'Country',
            hintText: 'Country',
            controller: _countryController,
            prefixIcon: const Icon(Icons.public_rounded),
            validator: (value) => _required(value, 'Country'),
          ),
          const SizedBox(height: AppSpacing.md),
          SwiperTextField(
            label: 'Email',
            hintText: 'Enter email address',
            controller: _emailController,
            prefixIcon: const Icon(Icons.mail_outline_rounded),
            keyboardType: TextInputType.emailAddress,
            validator: (value) => _required(value, 'Email'),
          ),
          const SizedBox(height: AppSpacing.md),
          SwiperTextField(
            label: 'Phone Number',
            hintText: 'Enter phone number',
            controller: _phoneController,
            prefixIcon: const Icon(Icons.call_outlined),
            keyboardType: TextInputType.phone,
            validator: (value) => _required(value, 'Phone number'),
          ),
          const SizedBox(height: AppSpacing.md),
          SwiperTextField(
            label: 'Emergency Contact Number',
            hintText: 'Enter emergency contact number',
            controller: _emergencyController,
            prefixIcon: const Icon(Icons.contact_phone_outlined),
            keyboardType: TextInputType.phone,
            validator: (value) => _required(value, 'Emergency contact number'),
          ),
          const SizedBox(height: AppSpacing.md),
          SwiperPasswordField(
            label: 'Password',
            hintText: 'Enter password',
            controller: _passwordController,
            validator: (value) => _required(value, 'Password'),
          ),
          const SizedBox(height: AppSpacing.md),
          SwiperPasswordField(
            label: 'Confirm Password',
            hintText: 'Confirm password',
            controller: _confirmPasswordController,
            validator: (value) => _required(value, 'Confirm password'),
          ),
        ],
      ),
    );
  }

  Widget _buildServicesStep() {
    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: _services.map((service) {
        final selected = _selectedServices.contains(service);
        return FilterChip(
          label: Text(service),
          selected: selected,
          onSelected: (value) {
            setState(() {
              if (value) {
                if (!_selectedServices.contains(service)) {
                  _selectedServices.add(service);
                }
                _serviceRateByService.putIfAbsent(service, () => '95');
                _serviceExperienceByService.putIfAbsent(service, () => '4');
                _serviceSpecialtiesByService.putIfAbsent(
                  service,
                  () => _specialtiesController.text.trim(),
                );
              } else {
                _selectedServices.remove(service);
                _serviceRateByService.remove(service);
                _serviceExperienceByService.remove(service);
                _serviceSpecialtiesByService.remove(service);
                if (_serviceDetailIndex >= _selectedServices.length) {
                  _serviceDetailIndex = _selectedServices.isEmpty
                      ? 0
                      : _selectedServices.length - 1;
                }
              }
            });
          },
        );
      }).toList(),
    );
  }

  Widget _buildStepBody() {
    final theme = Theme.of(context);

    switch (_step) {
      case _ProviderStep.basic:
        return _buildBasicStep();
      case _ProviderStep.preVerification:
        return _InfoPanel(
          title: 'Verify Your Email',
          lines: const [
            'Your provider account will be created in Supabase with email already confirmed.',
            'Continue to complete your listing details before phone and identity verification.',
            'This Flutter screen now uses the same backend registration route as the React app.',
          ],
        );
      case _ProviderStep.services:
        return _buildServicesStep();
      case _ProviderStep.serviceDetail:
        return Column(
          children: [
            SwiperTextField(
              label: 'Hourly Rate (RM)',
              hintText: '95',
              controller: _serviceRateController,
              prefixIcon: const Icon(Icons.payments_outlined),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: AppSpacing.md),
            SwiperTextField(
              label: 'Years of Experience',
              hintText: '4',
              controller: _serviceExperienceController,
              prefixIcon: const Icon(Icons.workspace_premium_outlined),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: AppSpacing.md),
            SwiperTextField(
              label: 'Specialties',
              hintText: 'Comma-separated specialties',
              controller: _specialtiesController,
              prefixIcon: const Icon(Icons.auto_awesome_outlined),
            ),
            const SizedBox(height: AppSpacing.md),
            _MultiImagePickerCard(
              title: 'Work Images',
              subtitle: 'Upload 3 photos of your previous work.',
              files: _workImages,
              maxFiles: 3,
              onPick: _pickWorkImages,
              onRemove: _removeWorkImage,
            ),
            const SizedBox(height: AppSpacing.sm),
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Service ${_serviceDetailIndex + 1} of ${_selectedServices.length}',
                style: theme.textTheme.bodySmall,
              ),
            ),
          ],
        );
      case _ProviderStep.availability:
        final days = const [
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
          'Sunday',
        ];
        final presets = const [
          '24 Hours',
          '9 AM - 9 PM',
          'Custom Time',
        ];
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Available Days', style: theme.textTheme.labelLarge),
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: days.map((day) {
                return FilterChip(
                  label: Text(day),
                  selected: _availabilityDays.contains(day),
                  onSelected: (value) {
                    setState(() {
                      if (value) {
                        _availabilityDays.add(day);
                      } else {
                        _availabilityDays.remove(day);
                      }
                    });
                  },
                );
              }).toList(),
            ),
            const SizedBox(height: AppSpacing.lg),
            DropdownButtonFormField<String>(
              initialValue: _timePreset,
              items: presets
                  .map(
                    (item) => DropdownMenuItem(value: item, child: Text(item)),
                  )
                  .toList(),
              onChanged: (value) =>
                  setState(() => _timePreset = value ?? _timePreset),
              decoration: const InputDecoration(
                labelText: 'Time preset',
                prefixIcon: Icon(Icons.schedule_rounded),
              ),
            ),
          ],
        );
      case _ProviderStep.location:
        return Column(
          children: [
            SwiperTextField(
              label: 'Service Area',
              hintText: 'Mont Kiara, Kuala Lumpur',
              controller: _areaLabelController,
              prefixIcon: const Icon(Icons.pin_drop_outlined),
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
                  Text('Service Radius', style: theme.textTheme.labelLarge),
                  Slider(
                    value: _radiusKm,
                    min: 1,
                    max: 30,
                    divisions: 29,
                    label: '${_radiusKm.round()} KM',
                    onChanged: (value) => setState(() => _radiusKm = value),
                  ),
                  Text(
                    '${_radiusKm.round()} KM around ${_areaLabelController.text}',
                    style: theme.textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
          ],
        );
      case _ProviderStep.review:
        return _InfoPanel(
          title: 'Review Summary',
          lines: [
            '${_firstNameController.text} ${_lastNameController.text} (${_marketingNameController.text.isEmpty ? 'Provider' : _marketingNameController.text})',
            'Services: ${_selectedServices.join(', ')}',
            'Availability: ${_availabilityDays.join(', ')} - $_timePreset',
            'Location: ${_areaLabelController.text} / ${_radiusKm.round()} KM',
            'Profile picture: ${_profileImage?.name ?? 'Missing'}',
            'Work images: ${_workImages.length}/3 uploaded',
            if (_registrationResult != null)
              'Registration status: ${_registrationResult!.status}',
          ],
        );
      case _ProviderStep.submitted:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _InfoPanel(
              title: 'Profile Submitted for Verification',
              lines: const [
                'Your profile submitted for verification.',
                'You will verify within 48 hrs. For more details contact support.',
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            SwiperButton(label: 'Verify now', onPressed: _continue),
            const SizedBox(height: AppSpacing.sm),
            SwiperButton(
              label: 'Verify later',
              isSecondary: true,
              onPressed: () => Navigator.of(context).pushNamedAndRemoveUntil(
                AppRoutes.providerShell,
                (route) => false,
              ),
            ),
          ],
        );
      case _ProviderStep.verification:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Phone Number Verification',
              style: theme.textTheme.labelLarge,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              '+60 ${_phoneController.text.isEmpty ? '12-345 6789' : _phoneController.text}',
              style: theme.textTheme.bodyLarge,
            ),
            const SizedBox(height: AppSpacing.md),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: List.generate(6, (index) {
                return SizedBox(
                  width: 44,
                  child: TextField(
                    controller: _phoneOtpControllers[index],
                    textAlign: TextAlign.center,
                    keyboardType: TextInputType.number,
                    maxLength: 1,
                    decoration: const InputDecoration(counterText: ''),
                  ),
                );
              }),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text('Use OTP code: 123456', style: theme.textTheme.bodyMedium),
          ],
        );
      case _ProviderStep.identity:
        return Column(
          children: [
            DropdownButtonFormField<String>(
              initialValue: _documentType,
              items: const [
                'IC / Passport / Driving License',
                'Passport',
                'Driving License',
                'National ID',
              ]
                  .map(
                    (item) => DropdownMenuItem(value: item, child: Text(item)),
                  )
                  .toList(),
              onChanged: (value) =>
                  setState(() => _documentType = value ?? _documentType),
              decoration: const InputDecoration(
                labelText: 'Document Type',
                prefixIcon: Icon(Icons.badge_outlined),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            SwiperTextField(
              label: 'Front Image',
              hintText: 'Front document image',
              controller: _frontDocController,
              prefixIcon: const Icon(Icons.upload_file_rounded),
            ),
            const SizedBox(height: AppSpacing.md),
            SwiperTextField(
              label: 'Back Image',
              hintText: 'Back document image',
              controller: _backDocController,
              prefixIcon: const Icon(Icons.upload_file_rounded),
            ),
          ],
        );
      case _ProviderStep.success:
        return _InfoPanel(
          title: 'Profile Submitted',
          lines: [
            'Your verification details are saved successfully.',
            'Selected services: ${_selectedServices.join(', ')}',
            'You can continue into the provider workspace now.',
          ],
        );
    }
  }

  String _currentServiceName() {
    if (_selectedServices.isEmpty) {
      return 'Service';
    }

    final safeIndex = _serviceDetailIndex.clamp(0, _selectedServices.length - 1);
    return _selectedServices[safeIndex];
  }

  void _saveCurrentServiceDetail() {
    if (_selectedServices.isEmpty) {
      return;
    }

    final service = _currentServiceName();
    _serviceRateByService[service] = _serviceRateController.text.trim();
    _serviceExperienceByService[service] =
        _serviceExperienceController.text.trim();
    _serviceSpecialtiesByService[service] = _specialtiesController.text.trim();
  }

  void _loadServiceDetail(String service) {
    _serviceRateController.text = _serviceRateByService[service] ?? '95';
    _serviceExperienceController.text =
        _serviceExperienceByService[service] ?? '4';
    _specialtiesController.text = _serviceSpecialtiesByService[service] ?? '';
  }

  Future<void> _submitProviderRegistration() async {
    _saveCurrentServiceDetail();

    try {
      final result = await _providerRegistrationService.registerProvider(
        _buildRegistrationPayload(),
      );
      final role = await _authService.signIn(
        email: _emailController.text.trim(),
        password: _passwordController.text,
      );

      if (!_authService.isProviderRole(role)) {
        throw Exception('Provider account was created, but sign-in failed.');
      }

      if (!mounted) {
        return;
      }

      setState(() {
        _registrationResult = result;
        _step = _ProviderStep.submitted;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _submitError = error is Exception
            ? error.toString().replaceFirst('Exception: ', '')
            : 'Unable to submit registration.';
      });
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  Future<void> _submitProviderIdentityVerification() async {
    final phoneOtp = _phoneOtpControllers
        .map((controller) => controller.text.trim())
        .toList(growable: false);

    try {
      await _providerRegistrationService.submitIdentityVerification({
        'phoneVerified': phoneOtp.join() == '123456',
        'identityVerified': false,
        'identityVerificationStatus':
            _frontDocController.text.trim().isNotEmpty &&
                    _backDocController.text.trim().isNotEmpty
                ? 'processing'
                : 'pending',
        'identityDocumentType':
            _documentType.toLowerCase().contains('passport') ? 'passport' : 'ic',
        'identityFrontImageUrl': '',
        'identityBackImageUrl': '',
      });

      if (!mounted) {
        return;
      }

      setState(() => _step = _ProviderStep.success);
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _submitError = error is Exception
            ? error.toString().replaceFirst('Exception: ', '')
            : 'Unable to submit verification.';
      });
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  Map<String, dynamic> _buildRegistrationPayload() {
    final serviceDetails = <String, Map<String, dynamic>>{};

    for (final service in _services) {
      final specialties = (_serviceSpecialtiesByService[service] ?? '')
          .split(',')
          .map((item) => item.trim())
          .where((item) => item.isNotEmpty)
          .toList();
      final isSelected = _selectedServices.contains(service);

      serviceDetails[service] = {
        'yearsExperience': _serviceExperienceByService[service] ?? '',
        'specialties': specialties,
        'imageCaptions': isSelected
            ? _workImages.map((file) => file.name).toList(growable: false)
            : ['', '', ''],
        'imageDataUrls': isSelected
            ? _workImages.map((file) => file.dataUrl).toList(growable: false)
            : ['', '', ''],
        'certificateCaptions': ['', '', ''],
        'certificateDataUrls': ['', '', ''],
        'hourlyRate': _serviceRateByService[service] ?? '',
        'dailyRate': '',
      };
    }

    return {
      'basicProfile': {
        'firstName': _firstNameController.text.trim(),
        'lastName': _lastNameController.text.trim(),
        'sex': _gender,
        'profileImageName': _profileImage?.name ?? '',
        'avatarDataUrl': _profileImage?.dataUrl ?? '',
        'marketingName': _marketingNameController.text.trim(),
        'dateOfBirth': _toIsoDate(_dobController.text.trim()),
        'unitNumber': '',
        'addressLine1': _address1Controller.text.trim(),
        'addressLine2': _address2Controller.text.trim(),
        'postcode': _postcodeController.text.trim(),
        'city': _cityController.text.trim(),
        'state': _stateController.text.trim(),
        'country': _countryController.text.trim(),
        'serviceLocation': _areaLabelController.text.trim(),
        'serviceRadius': _radiusKm.round(),
        'emergencyContact': _emergencyController.text.trim(),
        'emergencyContactNumber': _emergencyController.text.trim(),
      },
      'account': {
        'email': _emailController.text.trim(),
        'phoneCountryCode': '+60',
        'phoneNumber': _phoneController.text.trim(),
        'password': _passwordController.text,
        'confirmPassword': _confirmPasswordController.text,
      },
      'selectedServices': List<String>.from(_selectedServices),
      'serviceDetails': serviceDetails,
      'availability': {
        'days': _availabilityDays.toList(),
        'timePreset': _timePreset,
        'startTime': '09:00 AM',
        'endTime': '09:00 PM',
      },
      'providerLocation': {
        'radius': _radiusKm.round(),
        'areaLabel': _areaLabelController.text.trim(),
        'latitude': 3.139,
        'longitude': 101.6869,
        'formattedAddress': '',
        'road': '',
        'suburb': '',
        'city': _cityController.text.trim(),
        'state': _stateController.text.trim(),
        'postcode': _postcodeController.text.trim(),
        'country': _countryController.text.trim(),
        'houseNumber': '',
      },
      'verification': {
        'phoneOtp': const ['', '', '', '', '', ''],
        'emailOtp': const ['', '', '', '', '', ''],
        'documentType': '',
        'frontImageName': '',
        'frontImageDataUrl': '',
        'backImageName': '',
        'backImageDataUrl': '',
      },
    };
  }

  String _toIsoDate(String value) {
    final parts = value.split('/');
    if (parts.length != 3) {
      return value;
    }

    final day = parts[0].padLeft(2, '0');
    final month = parts[1].padLeft(2, '0');
    final year = parts[2];
    return '$year-$month-$day';
  }

  @override
  Widget build(BuildContext context) {
    final bool handledBottomInternally = _step == _ProviderStep.submitted;

    return AuthFlowScaffold(
      showBack: true,
      onBack: _back,
      hero: const AuthCircleHero(icon: Icons.home_repair_service_rounded),
      title: _heading(),
      subtitle: _subtitle(),
      bottom: handledBottomInternally
          ? null
          : _step == _ProviderStep.success
          ? SwiperButton(
              label: 'Go to Provider Home',
              onPressed: () => Navigator.of(context).pushNamedAndRemoveUntil(
                AppRoutes.providerShell,
                (route) => false,
              ),
            )
          : SwiperButton(
              label: _step == _ProviderStep.review
                  ? 'Submit for Listing'
                  : _step == _ProviderStep.identity
                  ? 'Submit Verification'
                  : 'Continue',
              isLoading: _submitting,
              onPressed: _submitting ? null : _continue,
            ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          LinearProgressIndicator(
            value: (_step.index + 1) / _ProviderStep.values.length,
            minHeight: 8,
            borderRadius: BorderRadius.circular(999),
            backgroundColor: AppColors.border,
          ),
          const SizedBox(height: AppSpacing.lg),
          _buildStepBody(),
          if (_submitError != null) ...[
            const SizedBox(height: AppSpacing.md),
            Text(
              _submitError!,
              style: Theme.of(
                context,
              ).textTheme.labelMedium?.copyWith(color: AppColors.error),
            ),
          ],
        ],
      ),
    );
  }
}

class _ImagePickerCard extends StatelessWidget {
  const _ImagePickerCard({
    required this.title,
    required this.subtitle,
    required this.file,
    required this.onPick,
    this.onRemove,
    this.requiredLabel,
  });

  final String title;
  final String subtitle;
  final PickedBrowserFile? file;
  final VoidCallback onPick;
  final VoidCallback? onRemove;
  final String? requiredLabel;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
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
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              if (requiredLabel != null)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.sm,
                    vertical: AppSpacing.xs,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.primarySoft,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    requiredLabel!,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            subtitle,
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: AppColors.textSecondary),
          ),
          const SizedBox(height: AppSpacing.md),
          ClipRRect(
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            child: Container(
              width: double.infinity,
              height: 180,
              color: const Color(0xFFF7FAF8),
              child: file == null
                  ? const Center(
                      child: Icon(
                        Icons.add_a_photo_outlined,
                        size: 40,
                        color: AppColors.primary,
                      ),
                    )
                  : Image.network(
                      file!.dataUrl,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => const Center(
                        child: Icon(
                          Icons.image_not_supported_outlined,
                          size: 40,
                          color: AppColors.primary,
                        ),
                      ),
                    ),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            file?.name ?? 'No file selected',
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: file == null ? AppColors.textSecondary : AppColors.primary,
              fontWeight: file == null ? FontWeight.w500 : FontWeight.w700,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onPick,
                  icon: const Icon(Icons.upload_outlined),
                  label: Text(file == null ? 'Upload Image' : 'Change Image'),
                ),
              ),
              if (onRemove != null) ...[
                const SizedBox(width: AppSpacing.sm),
                IconButton(
                  onPressed: onRemove,
                  icon: const Icon(Icons.delete_outline_rounded),
                  color: AppColors.error,
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _MultiImagePickerCard extends StatelessWidget {
  const _MultiImagePickerCard({
    required this.title,
    required this.subtitle,
    required this.files,
    required this.maxFiles,
    required this.onPick,
    required this.onRemove,
  });

  final String title;
  final String subtitle;
  final List<PickedBrowserFile> files;
  final int maxFiles;
  final VoidCallback onPick;
  final ValueChanged<int> onRemove;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            subtitle,
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: AppColors.textSecondary),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            '${files.length}/$maxFiles uploaded',
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: files.length == maxFiles
                  ? AppColors.success
                  : AppColors.textSecondary,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          if (files.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppSpacing.lg),
              decoration: BoxDecoration(
                color: const Color(0xFFF7FAF8),
                borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
              ),
              child: const Column(
                children: [
                  Icon(
                    Icons.photo_library_outlined,
                    size: 36,
                    color: AppColors.primary,
                  ),
                  SizedBox(height: AppSpacing.sm),
                  Text('No work images selected yet'),
                ],
              ),
            )
          else
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: List.generate(files.length, (index) {
                final file = files[index];
                return Stack(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                      child: Image.network(
                        file.dataUrl,
                        width: 96,
                        height: 96,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Container(
                          width: 96,
                          height: 96,
                          color: const Color(0xFFF7FAF8),
                          alignment: Alignment.center,
                          child: const Icon(
                            Icons.image_not_supported_outlined,
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                    ),
                    Positioned(
                      right: 4,
                      top: 4,
                      child: InkWell(
                        onTap: () => onRemove(index),
                        borderRadius: BorderRadius.circular(999),
                        child: Ink(
                          width: 26,
                          height: 26,
                          decoration: const BoxDecoration(
                            color: Colors.black54,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.close_rounded,
                            size: 16,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ],
                );
              }),
            ),
          const SizedBox(height: AppSpacing.md),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: onPick,
              icon: const Icon(Icons.upload_outlined),
              label: Text(
                files.isEmpty ? 'Upload 3 Work Images' : 'Replace Work Images',
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoPanel extends StatelessWidget {
  const _InfoPanel({required this.title, required this.lines});

  final String title;
  final List<String> lines;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          ...lines.map(
            (line) => Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: Text(line, style: Theme.of(context).textTheme.bodyMedium),
            ),
          ),
        ],
      ),
    );
  }
}
