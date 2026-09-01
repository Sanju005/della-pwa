import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/routing/app_routes.dart';
import '../../../repositories/demo_repository.dart';
import '../../../services/customer_account_service.dart';
import '../../../services/customer_address_service.dart';
import '../../../services/service_location_store.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/loading_state.dart';
import '../../../widgets/profile_avatar.dart';
import '../../../widgets/address_live_map.dart';
import '../../../widgets/malaysia_state_autocomplete_field.dart';
import '../../../widgets/swiper_bottom_sheet.dart';
import '../../../widgets/swiper_button.dart';
import '../../../widgets/swiper_status_badge.dart';

class ProfileDemoScreen extends StatefulWidget {
  const ProfileDemoScreen({super.key, required this.repository});

  final DemoRepository repository;

  @override
  State<ProfileDemoScreen> createState() => _ProfileDemoScreenState();
}

class _ProfileDemoScreenState extends State<ProfileDemoScreen> {
  static const _accountService = CustomerAccountService();
  static const _addressService = CustomerAddressService();
  late Future<CustomerAccountOverview?> _overviewFuture;

  @override
  void initState() {
    super.initState();
    _overviewFuture = _accountService.fetchOverview();
  }

  void _refresh() {
    setState(() {
      _overviewFuture = _accountService.fetchOverview();
    });
  }

  ({String firstName, String lastName}) _splitFullName(String fullName) {
    final trimmed = fullName.trim();
    if (trimmed.isEmpty) {
      return (firstName: '', lastName: '');
    }
    final parts = trimmed.split(RegExp(r'\s+'));
    if (parts.length == 1) {
      return (firstName: parts.first, lastName: parts.first);
    }
    return (firstName: parts.first, lastName: parts.sublist(1).join(' '));
  }

  Future<void> _openEditDetailsSheet(CustomerAccountOverview overview) async {
    final nameController = TextEditingController(text: overview.fullName);
    final dateOfBirthController = TextEditingController(
      text: overview.dateOfBirth == '-' ? '' : overview.dateOfBirth,
    );
    var selectedSex = overview.sex;
    var saving = false;

    await SwiperBottomSheet.show<void>(
      context,
      title: 'Edit personal details',
      subtitle: 'Update the real customer details shown on your profile.',
      child: StatefulBuilder(
        builder: (context, setSheetState) {
          return Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TextField(
                controller: nameController,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(
                  labelText: 'Name (as per IC / Passport)',
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                controller: dateOfBirthController,
                readOnly: true,
                decoration: const InputDecoration(
                  labelText: 'Date of birth',
                  hintText: '15 Aug 1996',
                ),
                onTap: () async {
                  final now = DateTime.now();
                  final initial =
                      DateTime.tryParse(overview.dateOfBirth) ??
                      DateTime(now.year - 25);
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: initial,
                    firstDate: DateTime(1930),
                    lastDate: now,
                  );
                  if (picked != null) {
                    dateOfBirthController.text = picked
                        .toIso8601String()
                        .split('T')
                        .first;
                  }
                },
              ),
              const SizedBox(height: AppSpacing.sm),
              DropdownButtonFormField<String>(
                initialValue: selectedSex.isEmpty ? null : selectedSex,
                items: const [
                  DropdownMenuItem(value: 'Male', child: Text('Male')),
                  DropdownMenuItem(value: 'Female', child: Text('Female')),
                ],
                onChanged: (value) {
                  setSheetState(() => selectedSex = value ?? '');
                },
                decoration: const InputDecoration(labelText: 'Gender'),
              ),
              const SizedBox(height: AppSpacing.md),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.md,
                  vertical: AppSpacing.sm,
                ),
                decoration: BoxDecoration(
                  color: AppColors.primarySoft,
                  borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.verified_rounded,
                      size: 18,
                      color: AppColors.primary,
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Verified mobile number',
                            style: TextStyle(
                              fontSize: 11,
                              color: AppColors.textSecondary,
                            ),
                          ),
                          Text(
                            '${overview.countryCode} ${overview.phoneNumber}',
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    TextButton(
                      onPressed: () {
                        Navigator.of(context).pop();
                        Navigator.of(
                          context,
                        ).pushNamed(AppRoutes.profileVerificationPhone);
                      },
                      child: const Text('Change'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              const Text(
                'Changing your phone number requires verifying the new number again.',
                style: TextStyle(fontSize: 11.5, color: AppColors.textMuted),
              ),
              const SizedBox(height: AppSpacing.md),
              SwiperButton(
                label: 'Save details',
                isLoading: saving,
                onPressed: saving
                    ? null
                    : () async {
                        try {
                          final isoDate = _normalizeDateForSave(
                            dateOfBirthController.text,
                          );
                          final split = _splitFullName(nameController.text);
                          setSheetState(() => saving = true);
                          await _accountService.updatePersonalDetails(
                            CustomerPersonalDetailsInput(
                              firstName: split.firstName,
                              lastName: split.lastName,
                              dateOfBirth: isoDate,
                              sex: selectedSex,
                            ),
                          );
                          if (!mounted) {
                            return;
                          }
                          Navigator.of(context).pop();
                          _refresh();
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Profile details updated.'),
                            ),
                          );
                        } catch (error, stackTrace) {
                          if (kDebugMode) {
                            debugPrint(
                              'Update personal details failed: $error',
                            );
                            debugPrintStack(stackTrace: stackTrace);
                          }
                          if (!mounted) {
                            return;
                          }
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(
                                error is Exception
                                    ? error.toString().replaceFirst(
                                        'Exception: ',
                                        '',
                                      )
                                    : 'Unable to update details.',
                              ),
                            ),
                          );
                        } finally {
                          if (mounted) {
                            setSheetState(() => saving = false);
                          }
                        }
                      },
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _openEditEmergencyContactSheet(
    CustomerAccountOverview overview,
  ) async {
    final controller = TextEditingController(
      text: overview.emergencyContactNumber,
    );
    var saving = false;

    await SwiperBottomSheet.show<void>(
      context,
      title: 'Emergency contact',
      subtitle:
          'Who should we contact in case of an emergency during a booking?',
      child: StatefulBuilder(
        builder: (context, setSheetState) {
          return Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: controller,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  labelText: 'Emergency contact number',
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              SwiperButton(
                label: 'Save',
                isLoading: saving,
                onPressed: saving
                    ? null
                    : () async {
                        setSheetState(() => saving = true);
                        try {
                          await _accountService.updatePersonalDetails(
                            CustomerPersonalDetailsInput(
                              emergencyContactNumber: controller.text.trim(),
                            ),
                          );
                          if (!mounted) {
                            return;
                          }
                          Navigator.of(context).pop();
                          _refresh();
                        } catch (error, stackTrace) {
                          if (kDebugMode) {
                            debugPrint(
                              'Update emergency contact failed: $error',
                            );
                            debugPrintStack(stackTrace: stackTrace);
                          }
                          if (!mounted) {
                            return;
                          }
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(
                                error is Exception
                                    ? error.toString().replaceFirst(
                                        'Exception: ',
                                        '',
                                      )
                                    : 'Unable to update emergency contact.',
                              ),
                            ),
                          );
                        } finally {
                          if (mounted) {
                            setSheetState(() => saving = false);
                          }
                        }
                      },
              ),
            ],
          );
        },
      ),
    );
  }

  String _normalizeDateForSave(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) {
      return '';
    }

    try {
      return DateTime.parse(trimmed).toIso8601String().split('T').first;
    } catch (_) {
      try {
        final parsed = MaterialLocalizations.of(
          context,
        ).parseCompactDate(trimmed);
        if (parsed != null) {
          return parsed.toIso8601String().split('T').first;
        }
        return trimmed;
      } catch (_) {
        return trimmed;
      }
    }
  }

  Future<void> _openAddAddressSheet() async {
    final labelController = TextEditingController(text: 'Home');
    final line1Controller = TextEditingController();
    final line2Controller = TextEditingController();
    final cityController = TextEditingController();
    final postcodeController = TextEditingController();
    final countryController = TextEditingController(text: 'Malaysia');
    final stateController = TextEditingController();
    var isDefault = false;
    double? pinLatitude;
    double? pinLongitude;

    await SwiperBottomSheet.show<void>(
      context,
      title: 'Add saved address',
      subtitle: 'Save Home, Work, or any other location for faster booking.',
      child: StatefulBuilder(
        builder: (context, setSheetState) {
          final previewAddress = [
            line1Controller.text.trim(),
            line2Controller.text.trim(),
            cityController.text.trim(),
            stateController.text.trim(),
            postcodeController.text.trim(),
            countryController.text.trim(),
          ].where((item) => item.isNotEmpty).join(', ');

          return Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _AddressPreviewMap(
                address: previewAddress,
                onLocationSelected: (lat, lng) {
                  pinLatitude = lat;
                  pinLongitude = lng;
                },
              ),
              const SizedBox(height: AppSpacing.xs),
              const Text(
                'Drag the map to fine-tune the exact pin location.',
                style: TextStyle(fontSize: 11.5, color: AppColors.textMuted),
              ),
              const SizedBox(height: AppSpacing.md),
              TextField(
                controller: labelController,
                onChanged: (_) => setSheetState(() {}),
                decoration: const InputDecoration(labelText: 'Label'),
              ),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                controller: line1Controller,
                onChanged: (_) => setSheetState(() {}),
                decoration: const InputDecoration(labelText: 'Address Line 1'),
              ),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                controller: line2Controller,
                onChanged: (_) => setSheetState(() {}),
                decoration: const InputDecoration(labelText: 'Address Line 2'),
              ),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                controller: cityController,
                onChanged: (_) => setSheetState(() {}),
                decoration: const InputDecoration(labelText: 'City'),
              ),
              const SizedBox(height: AppSpacing.sm),
              MalaysiaStateAutocompleteField(
                controller: stateController,
                hintText: 'Type first letter',
                onChanged: (_) => setSheetState(() {}),
                validator: (value) => (value == null || value.trim().isEmpty)
                    ? 'Enter state'
                    : null,
              ),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                controller: postcodeController,
                onChanged: (_) => setSheetState(() {}),
                decoration: const InputDecoration(labelText: 'Postcode'),
              ),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                controller: countryController,
                onChanged: (_) => setSheetState(() {}),
                decoration: const InputDecoration(labelText: 'Country'),
              ),
              const SizedBox(height: AppSpacing.sm),
              CheckboxListTile(
                value: isDefault,
                contentPadding: EdgeInsets.zero,
                title: const Text('Make this the default address'),
                onChanged: (value) {
                  setSheetState(() => isDefault = value ?? false);
                },
              ),
              const SizedBox(height: AppSpacing.sm),
              SwiperButton(
                label: 'Save address',
                onPressed: () async {
                  try {
                    await _addressService.saveAddress(
                      CustomerAddressInput(
                        label: labelController.text.trim(),
                        line1: line1Controller.text.trim(),
                        line2: line2Controller.text.trim(),
                        city: cityController.text.trim(),
                        state: stateController.text.trim(),
                        postcode: postcodeController.text.trim(),
                        country: countryController.text.trim(),
                        isDefault: isDefault,
                        latitude: pinLatitude,
                        longitude: pinLongitude,
                      ),
                    );
                    if (!mounted) {
                      return;
                    }
                    Navigator.of(context).pop();
                    _refresh();
                  } catch (error, stackTrace) {
                    if (kDebugMode) {
                      debugPrint('Save address failed: $error');
                      debugPrintStack(stackTrace: stackTrace);
                    }
                    if (!mounted) {
                      return;
                    }
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(
                          error is Exception
                              ? error.toString().replaceFirst('Exception: ', '')
                              : 'Unable to save address.',
                        ),
                      ),
                    );
                  }
                },
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _setActiveLocation(CustomerAddressSummary address) async {
    await ServiceLocationStore.save(
      ServiceLocationSelection(
        type: 'saved',
        label: address.label,
        address: address.formattedAddress,
        city: address.city,
        state: address.state,
        country: address.country,
      ),
    );
    if (!mounted) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${address.label} is now your active service location.'),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<CustomerAccountOverview?>(
      future: _overviewFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const LoadingState(label: 'Loading customer profile...');
        }

        if (snapshot.hasError) {
          return EmptyState(
            title: 'Unable to load profile',
            subtitle: snapshot.error.toString(),
            icon: Icons.error_outline_rounded,
          );
        }

        final overview = snapshot.data;
        if (overview == null) {
          return const EmptyState(
            title: 'No customer profile',
            subtitle: 'Sign in to view your customer profile.',
            icon: Icons.person_outline_rounded,
          );
        }

        final displayName = overview.fullName.trim().isNotEmpty
            ? overview.fullName
            : 'Customer';

        return ListView(
          padding: AppSpacing.screenPadding,
          children: [
            _OverviewSectionCard(
              title: 'Profile Completion',
              child: Column(
                children: [
                  Row(
                    children: [
                      const Spacer(),
                      RichText(
                        text: TextSpan(
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(color: AppColors.textSecondary),
                          children: [
                            TextSpan(
                              text: '${overview.completion}%',
                              style: const TextStyle(
                                color: AppColors.primary,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const TextSpan(text: ' Complete'),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(999),
                    child: LinearProgressIndicator(
                      minHeight: 8,
                      value: (overview.completion.clamp(0, 100)) / 100,
                      backgroundColor: const Color(0xFFE5E7EB),
                      valueColor: const AlwaysStoppedAnimation<Color>(
                        AppColors.primary,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            _ProfileSummaryCard(
              displayName: displayName,
              overview: overview,
              onEdit: () => _openEditDetailsSheet(overview),
            ),
            const SizedBox(height: AppSpacing.lg),
            InkWell(
              borderRadius: BorderRadius.circular(26),
              onTap: () => Navigator.of(
                context,
              ).pushNamed(AppRoutes.profileVerification),
              child: _VerificationHubCard(
                verified: overview.verification.verified,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            InkWell(
              borderRadius: BorderRadius.circular(26),
              onTap: () =>
                  Navigator.of(context).pushNamed(AppRoutes.profilePayments),
              child: Container(
                padding: const EdgeInsets.all(AppSpacing.lg),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(26),
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [Color(0xFF1B103E), AppColors.primary],
                  ),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x1F684AB3),
                      blurRadius: 24,
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
                        color: Colors.white.withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: const Icon(
                        Icons.account_balance_wallet_rounded,
                        color: Colors.white,
                        size: 28,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Wallet',
                            style: Theme.of(context).textTheme.titleLarge
                                ?.copyWith(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w800,
                                ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Open your wallet, check balance, and top up anytime.',
                            style: Theme.of(context).textTheme.bodyMedium
                                ?.copyWith(
                                  color: Colors.white.withValues(alpha: 0.82),
                                  height: 1.4,
                                ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    const Icon(
                      Icons.chevron_right_rounded,
                      color: Colors.white,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            InkWell(
              borderRadius: BorderRadius.circular(26),
              onTap: () =>
                  Navigator.of(context).pushNamed(AppRoutes.profileCoupons),
              child: Container(
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
                child: Row(
                  children: [
                    Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF1DE),
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: const Icon(
                        Icons.local_offer_outlined,
                        color: Color(0xFFEA7A00),
                        size: 28,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Coupons',
                            style: Theme.of(context).textTheme.titleLarge
                                ?.copyWith(
                                  color: const Color(0xFF7C2D12),
                                  fontWeight: FontWeight.w800,
                                ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'See available demo coupons and use them later during booking.',
                            style: Theme.of(context).textTheme.bodyMedium
                                ?.copyWith(
                                  color: const Color(0xFF9A3412),
                                  height: 1.4,
                                ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    const Icon(
                      Icons.chevron_right_rounded,
                      color: Color(0xFFEA7A00),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            _OverviewSectionCard(
              title: 'My Bookings',
              actionLabel: 'View All',
              onActionTap: () =>
                  Navigator.of(context).pushNamed(AppRoutes.bookingOverview),
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: _BookingStatChip(
                          icon: Icons.calendar_today_rounded,
                          value: overview.bookingSummary.pending,
                          label: 'Pending',
                          color: const Color(0xFFB67617),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: _BookingStatChip(
                          icon: Icons.directions_run_rounded,
                          value: overview.bookingSummary.ongoing,
                          label: 'Ongoing',
                          color: const Color(0xFF3E7A8C),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Row(
                    children: [
                      Expanded(
                        child: _BookingStatChip(
                          icon: Icons.task_alt_rounded,
                          value: overview.bookingSummary.completed,
                          label: 'Completed',
                          color: const Color(0xFF1FA971),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: _BookingStatChip(
                          icon: Icons.cancel_outlined,
                          value: overview.bookingSummary.cancelled,
                          label: 'Cancelled',
                          color: const Color(0xFFC1484F),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            _OverviewSectionCard(
              title: 'Favourite Providers',
              actionLabel: 'View All',
              onActionTap: () =>
                  Navigator.of(context).pushNamed(AppRoutes.profileFavorites),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: const BoxDecoration(
                      color: AppColors.primarySoft,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.favorite_border_rounded,
                      color: AppColors.primary,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  const Expanded(
                    child: Text(
                      'Providers you save will appear here for quick access.',
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 12.5,
                        height: 1.4,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            _OverviewSectionCard(
              title: 'Saved Address',
              actionLabel: 'Open',
              onActionTap: () =>
                  Navigator.of(context).pushNamed(AppRoutes.profileAddresses),
              child: overview.addresses.isEmpty
                  ? _SavedAddressPrompt(onOpen: _openAddAddressSheet)
                  : _SavedAddressSection(
                      addresses: overview.addresses,
                      onAddNew: _openAddAddressSheet,
                      onUseForServices: _setActiveLocation,
                      onSetDefault: (label) async {
                        await _addressService.setDefaultAddress(label);
                        _refresh();
                      },
                    ),
            ),
            const SizedBox(height: AppSpacing.lg),
            _OverviewSectionCard(
              title: 'Emergency Contact',
              actionLabel: 'Edit',
              onActionTap: () => _openEditEmergencyContactSheet(overview),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: const BoxDecoration(
                      color: AppColors.primarySoft,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.phone_forwarded_rounded,
                      color: AppColors.primary,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Text(
                      overview.emergencyContactNumber.isEmpty
                          ? 'Add a number we can call in an emergency.'
                          : overview.emergencyContactNumber,
                      style: TextStyle(
                        color: overview.emergencyContactNumber.isEmpty
                            ? AppColors.textSecondary
                            : AppColors.textPrimary,
                        fontWeight: overview.emergencyContactNumber.isEmpty
                            ? FontWeight.w400
                            : FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Center(
              child: TextButton.icon(
                onPressed: () async {
                  await Supabase.instance.client.auth.signOut();
                  if (!context.mounted) {
                    return;
                  }
                  Navigator.of(
                    context,
                  ).pushNamedAndRemoveUntil(AppRoutes.login, (route) => false);
                },
                icon: const Icon(Icons.logout_rounded, size: 18),
                label: const Text('Log Out'),
                style: TextButton.styleFrom(
                  foregroundColor: AppColors.textSecondary,
                ),
              ),
            ),
            const SizedBox(height: 120),
          ],
        );
      },
    );
  }
}

class _ProfileSummaryCard extends StatelessWidget {
  const _ProfileSummaryCard({
    required this.displayName,
    required this.overview,
    required this.onEdit,
  });

  final String displayName;
  final CustomerAccountOverview overview;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        onTap: onEdit,
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            boxShadow: const [
              BoxShadow(
                color: Color(0x0A0F172A),
                blurRadius: 14,
                offset: Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            children: [
              ProfileAvatar(
                name: displayName,
                imageUrl: overview.avatarUrl,
                radius: 36,
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
                                displayName,
                                style: Theme.of(context).textTheme.titleMedium
                                    ?.copyWith(
                                      fontWeight: FontWeight.w800,
                                      color: const Color(0xFF111827),
                                    ),
                              ),
                            ],
                          ),
                        ),
                        const Icon(
                          Icons.chevron_right_rounded,
                          color: AppColors.textSecondary,
                        ),
                      ],
                    ),
                    if (overview.verification.verified) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.primarySoft,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.verified_user_outlined,
                              size: 14,
                              color: AppColors.primary,
                            ),
                            SizedBox(width: 4),
                            Text(
                              'Phone Verified',
                              style: TextStyle(
                                color: AppColors.primary,
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _OverviewSectionCard extends StatelessWidget {
  const _OverviewSectionCard({
    required this.title,
    this.actionLabel,
    this.onActionTap,
    required this.child,
  });

  final String title;
  final String? actionLabel;
  final VoidCallback? onActionTap;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A0F172A),
            blurRadius: 14,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF111827),
                  ),
                ),
              ),
              if (actionLabel != null)
                GestureDetector(
                  onTap: onActionTap,
                  child: Text(
                    actionLabel!,
                    style: const TextStyle(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
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

class _VerificationHubCard extends StatelessWidget {
  const _VerificationHubCard({required this.verified});

  final bool verified;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
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
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x338E5EB5),
                  blurRadius: 28,
                  offset: Offset(0, 12),
                ),
              ],
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
                Text(
                  'Verification',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w900,
                    color: const Color(0xFF1F1630),
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  'Open phone and email verification',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: const Color(0xFF7B728A),
                    height: 1.5,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: verified
                  ? const Color(0xFFEEF9F0)
                  : const Color(0xFFFFF7ED),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              verified ? 'Verified' : 'Pending',
              style: TextStyle(
                color: verified
                    ? const Color(0xFF16A34A)
                    : const Color(0xFFF59E0B),
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          const Icon(Icons.chevron_right_rounded, color: Color(0xFF98A2B3)),
        ],
      ),
    );
  }
}

/// Compact stat tile used in the "My Bookings" summary card — a colored
/// count + label pair, replacing the old 4-row vertical list.
class _BookingStatChip extends StatelessWidget {
  const _BookingStatChip({
    required this.icon,
    required this.value,
    required this.label,
    required this.color,
  });

  final IconData icon;
  final int value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.16),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 17, color: color),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$value',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF111827),
                  ),
                ),
                Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.textSecondary,
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

class _AddressPreviewMap extends StatelessWidget {
  const _AddressPreviewMap({required this.address, this.onLocationSelected});

  final String address;
  final void Function(double latitude, double longitude)? onLocationSelected;

  @override
  Widget build(BuildContext context) {
    final displayAddress = address.trim().isEmpty
        ? 'Type an address and it will appear on the saved-location map preview.'
        : address.trim();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFF8F3FF), Color(0xFFEDE5FF)],
        ),
        border: Border.all(color: const Color(0xFFE4D7F5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Location Preview',
            style: Theme.of(
              context,
            ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: AppSpacing.sm),
          Container(
            height: 190,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.78),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Stack(
              children: [
                Positioned.fill(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: AddressLiveMap(
                      address: displayAddress,
                      height: 190,
                      interactive: true,
                      onLocationSelected: onLocationSelected,
                    ),
                  ),
                ),
                Positioned(
                  left: 12,
                  right: 12,
                  bottom: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.sm,
                      vertical: AppSpacing.sm,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.92),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      displayAddress,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.textSecondary,
                      ),
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

class _SavedAddressPrompt extends StatelessWidget {
  const _SavedAddressPrompt({required this.onOpen});

  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: const BoxDecoration(
            color: AppColors.primarySoft,
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.place_outlined, color: AppColors.primary),
        ),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'No saved address yet',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF111827),
                ),
              ),
              const SizedBox(height: 2),
              const Text(
                'Add an address for faster booking.',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 12,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              TextButton(
                onPressed: onOpen,
                style: TextButton.styleFrom(
                  backgroundColor: AppColors.primarySoft,
                  foregroundColor: AppColors.primary,
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md,
                    vertical: AppSpacing.sm,
                  ),
                ),
                child: const Text('Add Address'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _SavedAddressSection extends StatelessWidget {
  const _SavedAddressSection({
    required this.addresses,
    required this.onAddNew,
    required this.onUseForServices,
    required this.onSetDefault,
  });

  final List<CustomerAddressSummary> addresses;
  final VoidCallback onAddNew;
  final Future<void> Function(CustomerAddressSummary address) onUseForServices;
  final Future<void> Function(String label) onSetDefault;

  @override
  Widget build(BuildContext context) {
    final primary = addresses.first;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: const BoxDecoration(
                color: AppColors.primarySoft,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.place_outlined,
                color: AppColors.primary,
                size: 20,
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      primary.label,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  if (primary.isDefault)
                    const SwiperStatusBadge(
                      label: 'Default',
                      tone: SwiperStatusTone.info,
                    ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          primary.formattedAddress,
          style: const TextStyle(
            color: AppColors.textSecondary,
            fontSize: 12.5,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            SwiperButton(
              label: 'Use for services',
              isSecondary: true,
              onPressed: () => onUseForServices(primary),
            ),
            if (!primary.isDefault)
              SwiperButton(
                label: 'Set default',
                isSecondary: true,
                onPressed: () => onSetDefault(primary.label),
              ),
            SwiperButton(
              label: 'Add new',
              isSecondary: true,
              onPressed: onAddNew,
            ),
          ],
        ),
        if (addresses.length > 1) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            '${addresses.length - 1} more saved address${addresses.length - 1 == 1 ? '' : 'es'} available',
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: AppColors.textSecondary),
          ),
        ],
      ],
    );
  }
}
