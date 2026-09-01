import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'package:latlong2/latlong.dart';

import '../../../core/animation/app_motion.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/utils/phone_number.dart';
import '../../../services/auth_service.dart';
import '../../../services/browser_file_picker.dart';
import '../../../services/device_location_service.dart';
import '../../../services/image_crop_service.dart';
import '../../../services/otp_service.dart';
import '../../../services/provider_registration_service.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/swiper_button.dart';
import '../../../widgets/malaysia_state_autocomplete_field.dart';
import '../../../widgets/service_radius_map.dart';
import 'auth_flow_scaffold.dart';
import 'otp_step_view.dart';

enum _ProviderStep {
  phoneNumber,
  phoneOtp,
  basic,
  serviceDetails,
  availability,
  location,
  review,
  submitted,
}

class ProviderRegisterScreen extends StatefulWidget {
  const ProviderRegisterScreen({super.key});

  @override
  State<ProviderRegisterScreen> createState() => _ProviderRegisterScreenState();
}

class _ProviderRegisterScreenState extends State<ProviderRegisterScreen> {
  final _basicFormKey = GlobalKey<FormState>();
  final _icNameController = TextEditingController();
  final _marketingNameController = TextEditingController();
  final _dobController = TextEditingController();
  final _address1Controller = TextEditingController();
  final _address2Controller = TextEditingController();
  final _postcodeController = TextEditingController();
  final _cityController = TextEditingController();
  final _stateController = TextEditingController();
  final _countryController = TextEditingController(text: 'Malaysia');
  final _countryCodeController = TextEditingController(text: '60');
  final _phoneController = TextEditingController();
  final _areaLabelController = TextEditingController(
    text: 'Mont Kiara, Kuala Lumpur',
  );
  final _customStartTimeController = TextEditingController(text: '09:00 AM');
  final _customEndTimeController = TextEditingController(text: '09:00 PM');
  final _providerRegistrationService = const ProviderRegistrationService();
  final _authService = const AuthService();
  final OtpService _otpService = const DevelopmentOtpService();

  _ProviderStep _step = _ProviderStep.phoneNumber;
  // Set only when a step was entered via an Edit tap from Review — the next
  // Continue/Back from that step returns to Review instead of advancing
  // through the normal linear flow.
  _ProviderStep? _returnToStepAfterEdit;
  String _gender = 'Female';
  String _timePreset = '9 AM - 9 PM';
  TimeOfDay _customStartTime = const TimeOfDay(hour: 9, minute: 0);
  TimeOfDay _customEndTime = const TimeOfDay(hour: 21, minute: 0);
  double _radiusKm = 12;
  bool _submitting = false;
  // Canonical +60XXXXXXXXX form of whatever the provider last verified.
  // Editing the phone field after verifying resets _phoneVerified to false
  // (see _back()), so a fresh OTP is always required for a changed number.
  String? _normalizedPhone;
  bool _phoneVerified = false;
  String _enteredOtpCode = '';
  LatLng? _providerLatLng;
  bool _fetchingLocation = false;
  final Set<String> _availabilityDays = {
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
  };
  final List<_ServiceEntry> _serviceEntries = [_ServiceEntry()];
  PickedBrowserFile? _profileImage;
  String? _submitError;

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
      _icNameController,
      _marketingNameController,
      _dobController,
      _address1Controller,
      _address2Controller,
      _postcodeController,
      _cityController,
      _stateController,
      _countryController,
      _countryCodeController,
      _phoneController,
      _areaLabelController,
      _customStartTimeController,
      _customEndTimeController,
    ]) {
      controller.dispose();
    }
    for (final entry in _serviceEntries) {
      entry.dispose();
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

  static const _earliestCustomTime = TimeOfDay(hour: 1, minute: 0);
  static const _latestCustomTime = TimeOfDay(hour: 23, minute: 0);

  bool _isWithinCustomTimeBounds(TimeOfDay time) {
    final minutes = time.hour * 60 + time.minute;
    final earliest = _earliestCustomTime.hour * 60 + _earliestCustomTime.minute;
    final latest = _latestCustomTime.hour * 60 + _latestCustomTime.minute;
    return minutes >= earliest && minutes <= latest;
  }

  Future<void> _pickCustomStartTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _customStartTime,
    );
    if (picked == null || !mounted) {
      return;
    }
    if (!_isWithinCustomTimeBounds(picked)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Choose a time between 1:00 AM and 11:00 PM.'),
        ),
      );
      return;
    }
    setState(() {
      _customStartTime = picked;
      _customStartTimeController.text = picked.format(context);
    });
  }

  Future<void> _pickCustomEndTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _customEndTime,
    );
    if (picked == null || !mounted) {
      return;
    }
    if (!_isWithinCustomTimeBounds(picked)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Choose a time between 1:00 AM and 11:00 PM.'),
        ),
      );
      return;
    }
    setState(() {
      _customEndTime = picked;
      _customEndTimeController.text = picked.format(context);
    });
  }

  // There's no manual "Use Current Location" button anymore — the provider
  // location step fetches automatically every time it's reached, so this is
  // called right after any state transition that could land on that step.
  void _autoFetchLocationIfNeeded() {
    if (_step == _ProviderStep.location && !_fetchingLocation) {
      _useCurrentLocation();
    }
  }

  Future<void> _useCurrentLocation() async {
    setState(() => _fetchingLocation = true);
    try {
      final result = await fetchDeviceLocation();
      if (!mounted) {
        return;
      }
      setState(() {
        _areaLabelController.text = result.label;
        _providerLatLng = LatLng(result.latitude, result.longitude);
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            error is Exception
                ? error.toString().replaceFirst('Exception: ', '')
                : 'Unable to fetch current location.',
          ),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _fetchingLocation = false);
      }
    }
  }

  String _heading() {
    switch (_step) {
      case _ProviderStep.phoneNumber:
        return 'Create your provider account';
      case _ProviderStep.phoneOtp:
        return 'Verify your phone';
      case _ProviderStep.basic:
        return 'Personal Details';
      case _ProviderStep.serviceDetails:
        return 'Service Details';
      case _ProviderStep.availability:
        return 'Availability';
      case _ProviderStep.location:
        return 'Provider Location';
      case _ProviderStep.review:
        return 'Review Your Details';
      case _ProviderStep.submitted:
        return 'Successfully Submitted for Listing';
    }
  }

  String _subtitle() {
    switch (_step) {
      case _ProviderStep.phoneNumber:
        return 'Verify your mobile number to get started.';
      case _ProviderStep.phoneOtp:
        final formatted = _normalizedPhone == null
            ? ''
            : formatPhoneForDisplay(_normalizedPhone!);
        return 'Enter the 6-digit verification code sent to\n$formatted';
      case _ProviderStep.basic:
        return 'Add your profile photo and personal information';
      case _ProviderStep.serviceDetails:
        return 'Add the services you provide';
      case _ProviderStep.availability:
        return 'Select your available days and time';
      case _ProviderStep.location:
        return 'Set your service area';
      case _ProviderStep.review:
        return 'Before submitting, please review your information';
      case _ProviderStep.submitted:
        return '';
    }
  }

  Future<void> _continue() async {
    setState(() => _submitError = null);
    if (_step == _ProviderStep.phoneNumber) {
      final normalized = normalizePhoneNumber(
        _countryCodeController.text,
        _phoneController.text,
      );
      if (normalized == null) {
        setState(() => _submitError = 'Enter a valid mobile number.');
        return;
      }
      setState(() {
        _normalizedPhone = normalized;
        _phoneVerified = false;
        _submitting = true;
      });
      try {
        await _otpService.sendOtp(normalized);
      } finally {
        if (mounted) {
          setState(() => _submitting = false);
        }
      }
      if (!mounted) {
        return;
      }
      setState(() => _step = _ProviderStep.phoneOtp);
      return;
    }
    if (_step == _ProviderStep.basic) {
      if (!_basicFormKey.currentState!.validate()) return;
      if (_profileImage == null) {
        setState(() => _submitError = 'Please upload a profile picture.');
        return;
      }
    }
    if (_step == _ProviderStep.serviceDetails) {
      if (_serviceEntries.every((entry) => !entry.isComplete)) {
        setState(() => _submitError = 'Please complete at least one service.');
        return;
      }
    }
    if (_step == _ProviderStep.review) {
      setState(() => _submitting = true);
      await _submitProviderRegistration();
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

    setState(() {
      _step = _nextStep(_step);
    });
    _autoFetchLocationIfNeeded();
  }

  void _onPhoneVerified(String enteredCode) {
    setState(() {
      _phoneVerified = true;
      _enteredOtpCode = enteredCode;
      if (_returnToStepAfterEdit != null) {
        _step = _returnToStepAfterEdit!;
        _returnToStepAfterEdit = null;
      } else {
        _step = _ProviderStep.basic;
      }
    });
  }

  /// Jumps to [target] from Review; the next Continue/Back returns here.
  void _editFromReview(_ProviderStep target) {
    setState(() {
      _returnToStepAfterEdit = _ProviderStep.review;
      _step = target;
    });
    _autoFetchLocationIfNeeded();
  }

  void _back() {
    if (_returnToStepAfterEdit != null) {
      setState(() {
        _step = _returnToStepAfterEdit!;
        _returnToStepAfterEdit = null;
      });
      return;
    }

    if (_step == _ProviderStep.phoneNumber) {
      Navigator.of(context).maybePop();
      return;
    }

    final previous = _previousStep(_step);
    setState(() {
      _step = previous;
      if (previous == _ProviderStep.phoneNumber) {
        // Going back to the phone screen means it must be re-verified,
        // whether the user was on the OTP screen or edited it from Personal
        // Details onward.
        _phoneVerified = false;
      }
    });
    _autoFetchLocationIfNeeded();
  }

  _ProviderStep _nextStep(_ProviderStep step) {
    return switch (step) {
      _ProviderStep.phoneNumber => _ProviderStep.phoneOtp,
      _ProviderStep.phoneOtp => _ProviderStep.basic,
      _ProviderStep.basic => _ProviderStep.serviceDetails,
      _ProviderStep.serviceDetails => _ProviderStep.availability,
      _ProviderStep.availability => _ProviderStep.location,
      _ProviderStep.location => _ProviderStep.review,
      _ProviderStep.review => _ProviderStep.submitted,
      _ProviderStep.submitted => _ProviderStep.submitted,
    };
  }

  _ProviderStep _previousStep(_ProviderStep step) {
    return switch (step) {
      _ProviderStep.phoneOtp => _ProviderStep.phoneNumber,
      _ProviderStep.basic => _ProviderStep.phoneNumber,
      _ProviderStep.serviceDetails => _ProviderStep.basic,
      _ProviderStep.availability => _ProviderStep.serviceDetails,
      _ProviderStep.location => _ProviderStep.availability,
      _ProviderStep.review => _ProviderStep.location,
      _ProviderStep.submitted => _ProviderStep.review,
      _ProviderStep.phoneNumber => _ProviderStep.phoneNumber,
    };
  }

  int? _calculateAge() {
    final iso = _toIsoDate(_dobController.text.trim());
    final parsed = DateTime.tryParse(iso);
    if (parsed == null) {
      return null;
    }
    final now = DateTime.now();
    var age = now.year - parsed.year;
    if (now.month < parsed.month ||
        (now.month == parsed.month && now.day < parsed.day)) {
      age -= 1;
    }
    return age < 0 ? null : age;
  }

  ({String firstName, String lastName}) _splitFullName(String fullName) {
    final trimmed = fullName.trim();
    if (trimmed.isEmpty) {
      return (firstName: '', lastName: '');
    }
    final parts = trimmed.split(RegExp(r'\s+'));
    if (parts.length == 1) {
      // A single-word name (no space) has no separate last name — the
      // backend's registration endpoint requires both firstName and
      // lastName to be non-empty, so repeat the one name in both rather
      // than leaving lastName blank and failing that check.
      return (firstName: parts.first, lastName: parts.first);
    }
    return (firstName: parts.first, lastName: parts.sublist(1).join(' '));
  }

  /// A random, one-time password the provider never sees — they only ever
  /// authenticate via email OTP. Guaranteed to satisfy the backend's
  /// existing strength check (length, upper/lower/digit/symbol).
  String _generateRandomPassword() {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnpqrstuvwxyz';
    const digits = '23456789';
    const symbols = '!@#%^&*';
    const all = upper + lower + digits + symbols;
    final random = Random.secure();
    String pick(String chars) => chars[random.nextInt(chars.length)];

    final chars = [
      pick(upper),
      pick(lower),
      pick(digits),
      pick(symbols),
      for (var i = 0; i < 12; i++) pick(all),
    ];
    chars.shuffle(random);
    return chars.join();
  }

  String? _required(String? value, String label) {
    if ((value ?? '').trim().isEmpty) {
      return '$label is required.';
    }
    return null;
  }

  static final RegExp _icNamePattern = RegExp(r"^[a-zA-Z][a-zA-Z\s.@'/-]*$");

  String? _validateIcName(String? value) {
    final trimmed = (value ?? '').trim();
    if (trimmed.isEmpty) {
      return 'Name is required.';
    }
    if (trimmed.length < 2) {
      return 'Enter your full name as per IC / Passport.';
    }
    if (!_icNamePattern.hasMatch(trimmed)) {
      return 'Name must match your IC / Passport — letters only, no numbers.';
    }
    return null;
  }

  Future<void> _pickProfileImage() async {
    final picked = await pickAndCropImage(toolbarTitle: 'Crop Profile Photo');
    if (!mounted || picked == null) {
      return;
    }
    setState(() => _profileImage = picked);
  }

  void _removeProfileImage() {
    setState(() => _profileImage = null);
  }

  Future<void> _pickServiceImage(_ServiceEntry entry) async {
    if (entry.images.length >= 3) {
      return;
    }
    final picked = await pickAndCropImage(
      toolbarTitle: 'Crop Service Photo',
      aspectRatioX: 2,
      aspectRatioY: 1.5,
    );
    if (!mounted || picked == null) {
      return;
    }
    setState(() => entry.images = [...entry.images, picked]);
  }

  void _removeServiceImage(_ServiceEntry entry, int index) {
    final next = List<PickedBrowserFile>.from(entry.images);
    if (index < 0 || index >= next.length) {
      return;
    }
    next.removeAt(index);
    setState(() => entry.images = next);
  }

  void _addServiceEntry() {
    setState(() => _serviceEntries.add(_ServiceEntry()));
  }

  void _removeServiceEntry(_ServiceEntry entry) {
    if (_serviceEntries.length <= 1) {
      return;
    }
    setState(() {
      _serviceEntries.remove(entry);
      entry.dispose();
    });
  }

  Widget _buildBasicStep() {
    return Form(
      key: _basicFormKey,
      child: Column(
        children: [
          _ProfilePhotoPicker(
            file: _profileImage,
            onPick: _pickProfileImage,
            onRemove: _profileImage == null ? null : _removeProfileImage,
          ),
          const SizedBox(height: AppSpacing.lg),
          if (_phoneVerified && _normalizedPhone != null) ...[
            _VerifiedMobileBadge(normalizedPhone: _normalizedPhone!),
            const SizedBox(height: AppSpacing.md),
          ],
          _RegField(
            label: 'Name as per IC / Passport',
            controller: _icNameController,
            textCapitalization: TextCapitalization.words,
            validator: _validateIcName,
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                flex: 3,
                child: GestureDetector(
                  onTap: _pickDate,
                  child: AbsorbPointer(
                    child: _RegField(
                      label: 'Date of Birth',
                      controller: _dobController,
                      validator: (value) => _required(value, 'Date of birth'),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                flex: 2,
                child: _ReadOnlyField(
                  label: 'Age',
                  value: '${_calculateAge() ?? '--'}',
                ),
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
          const SizedBox(height: AppSpacing.md),
          _RegField(
            label: 'Marketing Name',
            controller: _marketingNameController,
            textCapitalization: TextCapitalization.words,
            helperText: 'e.g. Della Home Chef',
          ),
          const SizedBox(height: AppSpacing.lg),
          const _RegSectionHeader('Residential Address'),
          _RegField(
            label: 'Address Line 1',
            controller: _address1Controller,
            textCapitalization: TextCapitalization.words,
            validator: (value) => _required(value, 'Address line 1'),
          ),
          const SizedBox(height: AppSpacing.md),
          _RegField(
            label: 'Address Line 2',
            controller: _address2Controller,
            textCapitalization: TextCapitalization.words,
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _RegField(
                  label: 'Postcode',
                  controller: _postcodeController,
                  keyboardType: TextInputType.number,
                  validator: (value) => _required(value, 'Postcode'),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: _RegField(
                  label: 'City',
                  controller: _cityController,
                  textCapitalization: TextCapitalization.words,
                  validator: (value) => _required(value, 'City'),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          _RegDropdown<String>(
            label: 'State',
            value:
                MalaysiaStateAutocompleteField.malaysianStates.contains(
                  _stateController.text,
                )
                ? _stateController.text
                : null,
            items: MalaysiaStateAutocompleteField.malaysianStates,
            itemLabel: (item) => item,
            hint: 'Select state',
            validator: (value) => _required(value, 'State'),
            onChanged: (value) =>
                setState(() => _stateController.text = value ?? ''),
          ),
          const SizedBox(height: AppSpacing.md),
          _RegField(
            label: 'Country',
            controller: _countryController,
            textCapitalization: TextCapitalization.words,
            validator: (value) => _required(value, 'Country'),
          ),
        ],
      ),
    );
  }

  Widget _buildServiceDetailsStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < _serviceEntries.length; i++) ...[
          if (i > 0) const SizedBox(height: AppSpacing.lg),
          _ServiceEntryCard(
            entry: _serviceEntries[i],
            index: i,
            categories: _services,
            canRemove: _serviceEntries.length > 1,
            onChanged: () => setState(() {}),
            onPickImage: () => _pickServiceImage(_serviceEntries[i]),
            onRemoveImage: (imgIndex) =>
                _removeServiceImage(_serviceEntries[i], imgIndex),
            onRemoveEntry: () => _removeServiceEntry(_serviceEntries[i]),
          ),
        ],
        const SizedBox(height: AppSpacing.lg),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: _addServiceEntry,
            icon: const Icon(Icons.add_rounded),
            label: const Text('Add Service'),
          ),
        ),
      ],
    );
  }

  Widget _buildReviewStep() {
    final age = _calculateAge();
    final address = [
      _address1Controller.text.trim(),
      _address2Controller.text.trim(),
      _postcodeController.text.trim(),
      _cityController.text.trim(),
      _stateController.text.trim(),
      _countryController.text.trim(),
    ].where((part) => part.isNotEmpty).join(', ');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _ReviewSection(
          title: 'Personal Details',
          onEdit: () => _editFromReview(_ProviderStep.basic),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _reviewAvatar(),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _icNameController.text.trim().isEmpty
                          ? 'Name not set'
                          : _icNameController.text.trim(),
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _dobController.text.trim().isEmpty
                          ? 'Date of birth not set'
                          : '${_dobController.text.trim()} · ${age ?? '--'} years old',
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      address.isEmpty ? 'Address not set' : address,
                      style: const TextStyle(
                        fontSize: 13,
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
          title: 'Contact',
          onEdit: () => _editFromReview(_ProviderStep.phoneNumber),
          child: Row(
            children: [
              const Icon(
                Icons.phone_iphone_rounded,
                size: 16,
                color: AppColors.textSecondary,
              ),
              const SizedBox(width: 6),
              Text(
                _normalizedPhone == null
                    ? 'Not verified'
                    : formatPhoneForDisplay(_normalizedPhone!),
                style: const TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              if (_phoneVerified) ...[
                const SizedBox(width: 6),
                const Icon(
                  Icons.verified_rounded,
                  size: 14,
                  color: AppColors.success,
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        _ReviewSection(
          title: 'Services',
          onEdit: () => _editFromReview(_ProviderStep.serviceDetails),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var i = 0; i < _serviceEntries.length; i++) ...[
                if (i > 0)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: AppSpacing.sm),
                    child: Divider(height: 1, color: AppColors.border),
                  ),
                _reviewServiceEntry(_serviceEntries[i]),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _reviewAvatar() {
    final bytes = _decodeDataUrlBytes(_profileImage?.dataUrl);
    return Container(
      width: 56,
      height: 56,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        color: AppColors.primarySoft,
      ),
      child: ClipOval(
        child: bytes != null
            ? Image.memory(bytes, fit: BoxFit.cover)
            : const Icon(
                Icons.person_outline_rounded,
                color: AppColors.primary,
              ),
      ),
    );
  }

  Widget _reviewServiceEntry(_ServiceEntry entry) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          entry.category ?? 'Service not selected',
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w800,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          '${entry.experienceController.text.trim().isEmpty ? '--' : entry.experienceController.text.trim()} yrs experience'
          ' · RM${entry.hourlyRateController.text.trim().isEmpty ? '--' : entry.hourlyRateController.text.trim()}/hr'
          ' · RM${entry.dailyRateController.text.trim().isEmpty ? '--' : entry.dailyRateController.text.trim()}/day',
          style: const TextStyle(
            fontSize: 12.5,
            color: AppColors.textSecondary,
          ),
        ),
        if (entry.specialties.isNotEmpty) ...[
          const SizedBox(height: 6),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: entry.specialties
                .map(
                  (specialty) => Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.primarySoft,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      specialty,
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.primary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                )
                .toList(),
          ),
        ],
        if (entry.aboutController.text.trim().isNotEmpty) ...[
          const SizedBox(height: 6),
          Text(
            entry.aboutController.text.trim(),
            style: const TextStyle(
              fontSize: 12.5,
              color: AppColors.textSecondary,
            ),
          ),
        ],
        if (entry.images.isNotEmpty) ...[
          const SizedBox(height: 8),
          SizedBox(
            height: 56,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: entry.images.length,
              separatorBuilder: (_, _) => const SizedBox(width: 6),
              itemBuilder: (context, index) {
                final bytes = _decodeDataUrlBytes(entry.images[index].dataUrl);
                return ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: bytes != null
                      ? Image.memory(
                          bytes,
                          width: 56,
                          height: 56,
                          fit: BoxFit.cover,
                        )
                      : Container(
                          width: 56,
                          height: 56,
                          color: AppColors.primarySoft,
                        ),
                );
              },
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildStepBody() {
    switch (_step) {
      case _ProviderStep.phoneNumber:
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
                            // Never fall back to a default country's flag —
                            // an unrecognised or still-incomplete code (e.g.
                            // "97", which several countries' codes start
                            // with) should show a neutral placeholder, not a
                            // flag that doesn't actually match what's typed.
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
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 4),
            const Text('e.g. 12 345 6789', style: _regHelperStyle),
          ],
        );
      case _ProviderStep.phoneOtp:
        return OtpStepView(
          key: ValueKey(_normalizedPhone),
          contactValue: _normalizedPhone ?? '',
          otpService: _otpService,
          onVerified: _onPhoneVerified,
        );
      case _ProviderStep.basic:
        return _buildBasicStep();
      case _ProviderStep.serviceDetails:
        return _buildServiceDetailsStep();
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
        final presets = const ['24 Hours', '9 AM - 9 PM', 'Custom Time'];
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Available Days', style: _regLabelStyle),
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
            _RegDropdown<String>(
              label: 'Availability',
              value: _timePreset,
              items: presets,
              itemLabel: (item) => item,
              onChanged: (value) =>
                  setState(() => _timePreset = value ?? _timePreset),
            ),
            if (_timePreset == 'Custom Time') ...[
              const SizedBox(height: AppSpacing.md),
              Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: _pickCustomStartTime,
                      child: AbsorbPointer(
                        child: _RegField(
                          label: 'Start Time',
                          controller: _customStartTimeController,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: GestureDetector(
                      onTap: _pickCustomEndTime,
                      child: AbsorbPointer(
                        child: _RegField(
                          label: 'End Time',
                          controller: _customEndTimeController,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              const Text(
                'Choose any time between 1:00 AM and 11:00 PM',
                style: _regHelperStyle,
              ),
            ],
          ],
        );
      case _ProviderStep.location:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _RegField(
              label: 'Service Location',
              controller: _areaLabelController,
            ),
            if (_fetchingLocation) ...[
              const SizedBox(height: 6),
              const Row(
                children: [
                  SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                  SizedBox(width: 8),
                  Text('Fetching current location…', style: _regHelperStyle),
                ],
              ),
            ],
            const SizedBox(height: AppSpacing.lg),
            ServiceRadiusMap(
              center: _providerLatLng ?? const LatLng(3.1390, 101.6869),
              radiusKm: _radiusKm,
            ),
            const SizedBox(height: AppSpacing.lg),
            const _RegSectionHeader('Radius'),
            Text(
              '${_radiusKm.round()} KM around ${_areaLabelController.text}',
              style: const TextStyle(
                fontSize: 13,
                color: AppColors.textSecondary,
              ),
            ),
            Slider(
              value: _radiusKm,
              min: 1,
              max: 30,
              divisions: 29,
              label: '${_radiusKm.round()} KM',
              onChanged: (value) => setState(() => _radiusKm = value),
            ),
          ],
        );
      case _ProviderStep.review:
        return _buildReviewStep();
      case _ProviderStep.submitted:
        return _SubmissionSuccessView(
          onVerifyIdentity: () => Navigator.of(context).pushNamedAndRemoveUntil(
            AppRoutes.providerVerificationIdentity,
            (route) => false,
          ),
          onCloseToProfile: () => Navigator.of(
            context,
          ).pushNamedAndRemoveUntil(AppRoutes.providerShell, (route) => false),
        );
    }
  }

  Future<void> _submitProviderRegistration() async {
    // Providers verify by phone OTP, not a password they choose — this
    // random password is generated once, sent with the registration payload
    // so Supabase Auth has valid credentials on file, and reused immediately
    // below to sign in. It's never shown to the provider or stored anywhere
    // else in the app.
    final password = _generateRandomPassword();

    try {
      await _providerRegistrationService.registerProvider(
        _buildRegistrationPayload(password),
      );
      final role = await _authService.signInWithPhone(
        normalizedPhone: _normalizedPhone!,
        password: password,
      );

      if (!_authService.isProviderRole(role)) {
        throw Exception('Provider account was created, but sign-in failed.');
      }

      if (!mounted) {
        return;
      }

      setState(() => _step = _ProviderStep.submitted);
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

  Map<String, dynamic> _buildRegistrationPayload(String password) {
    final completedEntries = _serviceEntries
        .where((entry) => entry.category != null)
        .toList(growable: false);
    final serviceDetails = <String, Map<String, dynamic>>{};

    for (final entry in completedEntries) {
      serviceDetails[entry.category!] = {
        'yearsExperience': entry.experienceController.text.trim(),
        'specialties': List<String>.from(entry.specialties),
        'aboutService': entry.aboutController.text.trim(),
        'imageCaptions': entry.images
            .map((file) => file.name)
            .toList(growable: false),
        'imageDataUrls': entry.images
            .map((file) => file.dataUrl)
            .toList(growable: false),
        'certificateCaptions': const <String>[],
        'certificateDataUrls': const <String>[],
        'hourlyRate': entry.hourlyRateController.text.trim(),
        'dailyRate': entry.dailyRateController.text.trim(),
      };
    }

    final name = _splitFullName(_icNameController.text);

    return {
      'basicProfile': {
        'firstName': name.firstName,
        'lastName': name.lastName,
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
        // Emergency contact is collected later in Profile — the provider's
        // own verified phone satisfies the backend's required-field check
        // in the meantime.
        'emergencyContact': _normalizedPhone ?? _phoneController.text.trim(),
        'emergencyContactNumber':
            _normalizedPhone ?? _phoneController.text.trim(),
      },
      'account': {
        // No email at registration — collected and verified later in
        // Profile → Email Verification.
        'email': '',
        'phoneCountryCode':
            '+${_countryCodeController.text.replaceAll(RegExp(r'\D'), '')}',
        'phoneNumber': _phoneController.text.trim(),
        'password': password,
        'confirmPassword': password,
      },
      'selectedServices': completedEntries
          .map((entry) => entry.category!)
          .toList(growable: false),
      'serviceDetails': serviceDetails,
      'availability': {
        'days': _availabilityDays.toList(),
        'timePreset': _timePreset,
        'startTime': switch (_timePreset) {
          '24 Hours' => '12:00 AM',
          'Custom Time' => _customStartTime.format(context),
          _ => '09:00 AM',
        },
        'endTime': switch (_timePreset) {
          '24 Hours' => '11:59 PM',
          'Custom Time' => _customEndTime.format(context),
          _ => '09:00 PM',
        },
      },
      'providerLocation': {
        'radius': _radiusKm.round(),
        'areaLabel': _areaLabelController.text.trim(),
        'latitude': _providerLatLng?.latitude ?? 3.139,
        'longitude': _providerLatLng?.longitude ?? 101.6869,
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
        'phoneOtp': _enteredOtpCode.isEmpty
            ? const ['', '', '', '', '', '']
            : _enteredOtpCode.split(''),
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
    final bool handledBottomInternally =
        _step == _ProviderStep.submitted || _step == _ProviderStep.phoneOtp;

    return PopScope(
      canPop: _step == _ProviderStep.phoneNumber,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) {
          return;
        }
        _back();
      },
      child: AuthFlowScaffold(
        showBack: true,
        onBack: _back,
        hero: const AuthCircleHero(icon: Icons.home_repair_service_rounded),
        title: _heading(),
        subtitle: _subtitle(),
        bottom: handledBottomInternally
            ? null
            : SwiperButton(
                label: _step == _ProviderStep.phoneNumber
                    ? 'Verify Number'
                    : _step == _ProviderStep.review
                    ? 'Submit for Listing'
                    : 'Continue',
                isLoading: _submitting,
                onPressed:
                    _submitting ||
                        (_step == _ProviderStep.phoneNumber &&
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
            _RegStepHeader(step: _step),
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
      ),
    );
  }
}

/// Decodes a `data:<mime>;base64,<...>` URL into raw bytes for [Image.memory].
/// Returns null for anything else (including http(s) URLs, which this
/// registration flow never produces client-side).
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

class _ProfilePhotoPicker extends StatelessWidget {
  const _ProfilePhotoPicker({
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
              file == null ? 'Add profile photo' : 'Change photo',
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                title,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              ),
            ),
            Text(
              '${files.length}/$maxFiles',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: files.length == maxFiles
                    ? AppColors.success
                    : AppColors.textSecondary,
              ),
            ),
          ],
        ),
        const SizedBox(height: 2),
        Text(
          subtitle,
          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
        ),
        const SizedBox(height: AppSpacing.sm),
        if (files.isEmpty)
          InkWell(
            onTap: onPick,
            borderRadius: BorderRadius.circular(_regFieldRadius),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
              decoration: BoxDecoration(
                color: AppColors.primarySoft,
                borderRadius: BorderRadius.circular(_regFieldRadius),
                border: Border.all(color: AppColors.border),
              ),
              child: const Column(
                children: [
                  Icon(
                    Icons.photo_library_outlined,
                    size: 30,
                    color: AppColors.primary,
                  ),
                  SizedBox(height: AppSpacing.xs),
                  Text(
                    'Tap to upload work photos',
                    style: TextStyle(
                      fontSize: 12.5,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          )
        else
          Row(
            children: [
              ...List.generate(files.length, (index) {
                final bytes = _decodeDataUrlBytes(files[index].dataUrl);
                return Padding(
                  padding: const EdgeInsets.only(right: AppSpacing.sm),
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(_regFieldRadius),
                        child: bytes != null
                            ? Image.memory(
                                bytes,
                                width: 80,
                                height: 80,
                                fit: BoxFit.cover,
                              )
                            : Container(
                                width: 80,
                                height: 80,
                                color: AppColors.primarySoft,
                                alignment: Alignment.center,
                                child: const Icon(
                                  Icons.image_not_supported_outlined,
                                  color: AppColors.primary,
                                ),
                              ),
                      ),
                      Positioned(
                        right: -6,
                        top: -6,
                        child: InkWell(
                          onTap: () => onRemove(index),
                          borderRadius: BorderRadius.circular(999),
                          child: Container(
                            width: 22,
                            height: 22,
                            decoration: const BoxDecoration(
                              color: Colors.black54,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.close_rounded,
                              size: 14,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              }),
              if (files.length < maxFiles)
                InkWell(
                  onTap: onPick,
                  borderRadius: BorderRadius.circular(_regFieldRadius),
                  child: Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(
                      color: AppColors.primarySoft,
                      borderRadius: BorderRadius.circular(_regFieldRadius),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: const Icon(
                      Icons.add_rounded,
                      color: AppColors.primary,
                    ),
                  ),
                ),
            ],
          ),
        if (files.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.xs),
          GestureDetector(
            onTap: onPick,
            child: const Text(
              'Replace all',
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
                color: AppColors.primary,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Compact native-mobile form controls used throughout this registration flow.
// Labels sit above the field (not as a floating/placeholder label) and there
// is no hint text unless it's genuine formatting guidance shown as small
// helper text below the field.
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

InputDecoration _regDecoration({Widget? suffixIcon, String? prefixText}) {
  return InputDecoration(
    isDense: true,
    filled: true,
    fillColor: Colors.white,
    suffixIcon: suffixIcon,
    prefixText: prefixText,
    prefixStyle: const TextStyle(
      fontSize: 15,
      fontWeight: FontWeight.w700,
      color: AppColors.textPrimary,
    ),
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
    this.keyboardType,
    this.textCapitalization = TextCapitalization.none,
    this.validator,
    this.helperText,
    this.inputFormatters,
    this.maxLines = 1,
    this.prefixText,
  });

  final String label;
  final TextEditingController? controller;
  final TextInputType? keyboardType;
  final TextCapitalization textCapitalization;
  final FormFieldValidator<String>? validator;
  final String? helperText;
  final List<TextInputFormatter>? inputFormatters;
  final int maxLines;
  final String? prefixText;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: _regLabelStyle),
        const SizedBox(height: 6),
        TextFormField(
          controller: controller,
          keyboardType: keyboardType,
          textCapitalization: textCapitalization,
          validator: validator,
          inputFormatters: inputFormatters,
          maxLines: maxLines,
          style: const TextStyle(fontSize: 15),
          decoration: _regDecoration(prefixText: prefixText),
        ),
        if (helperText != null) ...[
          const SizedBox(height: 4),
          Text(helperText!, style: _regHelperStyle),
        ],
      ],
    );
  }
}

class _RegDropdown<T> extends StatelessWidget {
  const _RegDropdown({
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
    required this.itemLabel,
    this.validator,
    this.hint,
  });

  final String label;
  final T? value;
  final List<T> items;
  final ValueChanged<T?> onChanged;
  final String Function(T) itemLabel;
  final FormFieldValidator<T>? validator;
  final String? hint;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: _regLabelStyle),
        const SizedBox(height: 6),
        DropdownButtonFormField<T>(
          initialValue: value,
          isExpanded: true,
          hint: hint == null ? null : Text(hint!),
          validator: validator,
          items: items
              .map(
                (item) => DropdownMenuItem<T>(
                  value: item,
                  child: Text(
                    itemLabel(item),
                    style: const TextStyle(fontSize: 15),
                  ),
                ),
              )
              .toList(),
          onChanged: onChanged,
          decoration: _regDecoration(),
        ),
      ],
    );
  }
}

class _RegSectionHeader extends StatelessWidget {
  const _RegSectionHeader(this.title);

  final String title;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w800,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        const Divider(height: 1, color: AppColors.border),
        const SizedBox(height: AppSpacing.md),
      ],
    );
  }
}

const List<_RegStepGroup> _regStepGroups = [
  _RegStepGroup('Personal', [
    _ProviderStep.phoneNumber,
    _ProviderStep.phoneOtp,
    _ProviderStep.basic,
  ]),
  _RegStepGroup('Services', [
    _ProviderStep.serviceDetails,
    _ProviderStep.availability,
    _ProviderStep.location,
    _ProviderStep.review,
    _ProviderStep.submitted,
  ]),
];

class _RegStepGroup {
  const _RegStepGroup(this.label, this.steps);

  final String label;
  final List<_ProviderStep> steps;
}

class _RegStepHeader extends StatelessWidget {
  const _RegStepHeader({required this.step});

  final _ProviderStep step;

  @override
  Widget build(BuildContext context) {
    final activeGroupIndex = _regStepGroups.indexWhere(
      (group) => group.steps.contains(step),
    );

    return Row(
      children: [
        for (var i = 0; i < _regStepGroups.length; i++) ...[
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
          _RegStepChip(
            index: i + 1,
            label: _regStepGroups[i].label,
            state: i < activeGroupIndex
                ? _RegStepChipState.done
                : i == activeGroupIndex
                ? _RegStepChipState.active
                : _RegStepChipState.upcoming,
          ),
        ],
      ],
    );
  }
}

enum _RegStepChipState { done, active, upcoming }

class _RegStepChip extends StatelessWidget {
  const _RegStepChip({
    required this.index,
    required this.label,
    required this.state,
  });

  final int index;
  final String label;
  final _RegStepChipState state;

  @override
  Widget build(BuildContext context) {
    final isActiveOrDone = state != _RegStepChipState.upcoming;
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
          child: state == _RegStepChipState.done
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

/// Read-only confirmation shown in Personal Details once the phone has
/// already been verified — never an editable field, per the phone-first
/// verification flow.
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
                  formatPhoneForDisplay(normalizedPhone),
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

/// One provider service being configured during registration. Mutable and
/// owned by the parent State so its controllers survive step navigation and
/// Review edit-jumps.
class _ServiceEntry {
  _ServiceEntry();

  String? category;
  final TextEditingController experienceController = TextEditingController();
  final List<String> specialties = [];
  List<PickedBrowserFile> images = [];
  final TextEditingController aboutController = TextEditingController();
  final TextEditingController hourlyRateController = TextEditingController();
  final TextEditingController dailyRateController = TextEditingController();

  void dispose() {
    experienceController.dispose();
    aboutController.dispose();
    hourlyRateController.dispose();
    dailyRateController.dispose();
  }

  bool get isComplete =>
      category != null &&
      experienceController.text.trim().isNotEmpty &&
      hourlyRateController.text.trim().isNotEmpty &&
      dailyRateController.text.trim().isNotEmpty &&
      images.isNotEmpty;
}

IconData _serviceCategoryIcon(String category) {
  switch (category) {
    case 'Chef':
      return Icons.restaurant_rounded;
    case 'Maid':
      return Icons.cleaning_services_rounded;
    case 'Driver':
      return Icons.directions_car_filled_rounded;
    case 'Tutor':
      return Icons.menu_book_rounded;
    case 'Cleaner':
      return Icons.cleaning_services_rounded;
    case 'Babysitter':
      return Icons.child_care_rounded;
    case 'Plumber':
      return Icons.plumbing_rounded;
    case 'Electrician':
      return Icons.electrical_services_rounded;
    default:
      return Icons.more_horiz_rounded;
  }
}

class _ServiceEntryCard extends StatelessWidget {
  const _ServiceEntryCard({
    required this.entry,
    required this.index,
    required this.categories,
    required this.canRemove,
    required this.onChanged,
    required this.onPickImage,
    required this.onRemoveImage,
    required this.onRemoveEntry,
  });

  final _ServiceEntry entry;
  final int index;
  final List<String> categories;
  final bool canRemove;
  final VoidCallback onChanged;
  final VoidCallback onPickImage;
  final ValueChanged<int> onRemoveImage;
  final VoidCallback onRemoveEntry;

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
                  'Service ${index + 1}',
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              if (canRemove)
                InkWell(
                  onTap: onRemoveEntry,
                  borderRadius: BorderRadius.circular(999),
                  child: const Padding(
                    padding: EdgeInsets.all(4),
                    child: Icon(
                      Icons.delete_outline_rounded,
                      size: 18,
                      color: AppColors.error,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          const Text('Service Category', style: _regLabelStyle),
          const SizedBox(height: 8),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: categories.map((category) {
              final selected = entry.category == category;
              return InkWell(
                onTap: () {
                  entry.category = category;
                  onChanged();
                },
                borderRadius: BorderRadius.circular(_regFieldRadius),
                child: Container(
                  width: 84,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  decoration: BoxDecoration(
                    color: selected ? AppColors.primarySoft : Colors.white,
                    borderRadius: BorderRadius.circular(_regFieldRadius),
                    border: Border.all(
                      color: selected ? AppColors.primary : AppColors.border,
                      width: selected ? 1.4 : 1,
                    ),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        _serviceCategoryIcon(category),
                        color: selected
                            ? AppColors.primary
                            : AppColors.textSecondary,
                        size: 22,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        category,
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          color: selected
                              ? AppColors.primary
                              : AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: AppSpacing.md),
          _RegField(
            label: 'Years of Experience',
            controller: entry.experienceController,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          ),
          const SizedBox(height: AppSpacing.md),
          _SpecialtyChipField(
            specialties: entry.specialties,
            onChanged: onChanged,
          ),
          const SizedBox(height: AppSpacing.md),
          _MultiImagePickerCard(
            title: 'Service Images',
            subtitle: 'Upload up to 3 photos of your work.',
            files: entry.images,
            maxFiles: 3,
            onPick: onPickImage,
            onRemove: onRemoveImage,
          ),
          const SizedBox(height: AppSpacing.md),
          _RegField(
            label: 'About the Service',
            controller: entry.aboutController,
            maxLines: 3,
            helperText: 'Optional',
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: _RegField(
                  label: 'Rate per Hour',
                  controller: entry.hourlyRateController,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  prefixText: 'RM ',
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: _RegField(
                  label: 'Rate per Day',
                  controller: entry.dailyRateController,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  prefixText: 'RM ',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SpecialtyChipField extends StatefulWidget {
  const _SpecialtyChipField({
    required this.specialties,
    required this.onChanged,
  });

  final List<String> specialties;
  final VoidCallback onChanged;

  @override
  State<_SpecialtyChipField> createState() => _SpecialtyChipFieldState();
}

class _SpecialtyChipFieldState extends State<_SpecialtyChipField> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _commitPending() {
    final raw = _controller.text.trim();
    _controller.clear();
    if (raw.isEmpty) {
      return;
    }
    final normalized = raw.toLowerCase();
    final isDuplicate = widget.specialties.any(
      (existing) => existing.toLowerCase() == normalized,
    );
    if (isDuplicate) {
      return;
    }
    setState(() => widget.specialties.add(raw));
    widget.onChanged();
  }

  void _removeAt(int index) {
    setState(() => widget.specialties.removeAt(index));
    widget.onChanged();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Specialities', style: _regLabelStyle),
        const SizedBox(height: 6),
        if (widget.specialties.isNotEmpty) ...[
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: List.generate(widget.specialties.length, (index) {
              return Chip(
                label: Text(widget.specialties[index]),
                deleteIcon: const Icon(Icons.close_rounded, size: 15),
                onDeleted: () => _removeAt(index),
                backgroundColor: AppColors.primarySoft,
                side: BorderSide.none,
                labelStyle: const TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: AppColors.primary,
                ),
              );
            }),
          ),
          const SizedBox(height: 8),
        ],
        TextField(
          controller: _controller,
          onChanged: (value) {
            if (value.endsWith(',')) {
              _controller.text = value.substring(0, value.length - 1);
              _commitPending();
            }
          },
          onSubmitted: (_) => _commitPending(),
          style: const TextStyle(fontSize: 15),
          decoration: _regDecoration(),
        ),
        const SizedBox(height: 4),
        const Text(
          'Type a specialty, then a comma to add it — e.g. Deep tissue, Prenatal, Sports massage.',
          style: _regHelperStyle,
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
            color: AppColors.surfaceSoft,
            borderRadius: BorderRadius.circular(_regFieldRadius),
            border: Border.all(color: AppColors.border),
          ),
          child: Text(
            value,
            style: const TextStyle(
              fontSize: 15,
              color: AppColors.textSecondary,
            ),
          ),
        ),
      ],
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
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              InkWell(
                onTap: onEdit,
                borderRadius: BorderRadius.circular(999),
                child: const Padding(
                  padding: EdgeInsets.all(4),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.edit_outlined,
                        size: 15,
                        color: AppColors.primary,
                      ),
                      SizedBox(width: 4),
                      Text(
                        'Edit',
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primary,
                        ),
                      ),
                    ],
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

class _SubmissionSuccessView extends StatelessWidget {
  const _SubmissionSuccessView({
    required this.onVerifyIdentity,
    required this.onCloseToProfile,
  });

  final VoidCallback onVerifyIdentity;
  final VoidCallback onCloseToProfile;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: 1),
          duration: AppMotion.resolveDuration(
            context,
            const Duration(milliseconds: 550),
          ),
          curve: Curves.easeOutBack,
          builder: (context, value, child) {
            return Opacity(
              opacity: value.clamp(0, 1),
              child: Transform.scale(scale: 0.7 + (0.3 * value), child: child),
            );
          },
          child: Container(
            width: 88,
            height: 88,
            decoration: const BoxDecoration(
              color: AppColors.successSurface,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.check_rounded,
              color: AppColors.success,
              size: 44,
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        const Text(
          'Successfully Submitted for Listing',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        const Text(
          'Your provider profile has been submitted successfully. '
          'You can verify your identity now or continue to your profile.',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 13.5,
            color: AppColors.textSecondary,
            height: 1.45,
          ),
        ),
        const SizedBox(height: AppSpacing.xl),
        SizedBox(
          width: double.infinity,
          child: SwiperButton(
            label: 'Verify Identity',
            onPressed: onVerifyIdentity,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        SizedBox(
          width: double.infinity,
          child: SwiperButton(
            label: 'Close & View Profile',
            isSecondary: true,
            onPressed: onCloseToProfile,
          ),
        ),
      ],
    );
  }
}
