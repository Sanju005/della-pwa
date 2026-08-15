import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../../core/routing/app_routes.dart';
import '../../../repositories/demo_repository.dart';
import '../../../services/customer_account_service.dart';
import '../../../services/customer_address_service.dart';
import '../../../services/service_location_store.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/loading_state.dart';
import '../../../widgets/notification_card.dart';
import '../../../widgets/profile_avatar.dart';
import '../../../widgets/swiper_bottom_sheet.dart';
import '../../../widgets/swiper_button.dart';
import '../../../widgets/swiper_status_badge.dart';

class ProfileDemoScreen extends StatefulWidget {
  const ProfileDemoScreen({
    super.key,
    required this.repository,
  });

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

  Future<void> _openEditDetailsSheet(CustomerAccountOverview overview) async {
    final firstNameController = TextEditingController(text: overview.firstName);
    final lastNameController = TextEditingController(text: overview.lastName);
    final phoneController = TextEditingController(text: overview.phoneNumber);
    final emergencyController = TextEditingController(
      text: overview.emergencyContactNumber,
    );
    final cityController = TextEditingController(text: overview.city);
    final regionController = TextEditingController(text: overview.region);
    final countryController = TextEditingController(text: overview.country);
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
            children: [
              TextField(
                controller: firstNameController,
                decoration: const InputDecoration(labelText: 'First name'),
              ),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                controller: lastNameController,
                decoration: const InputDecoration(labelText: 'Last name'),
              ),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                controller: phoneController,
                keyboardType: TextInputType.phone,
                decoration: InputDecoration(
                  labelText: 'Phone number',
                  helperText: 'Country code: ${overview.countryCode}',
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                controller: emergencyController,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  labelText: 'Emergency contact',
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                controller: dateOfBirthController,
                decoration: const InputDecoration(
                  labelText: 'Date of birth',
                  hintText: '15 Aug 1996',
                ),
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
                decoration: const InputDecoration(labelText: 'Sex'),
              ),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                controller: cityController,
                decoration: const InputDecoration(labelText: 'City'),
              ),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                controller: regionController,
                decoration: const InputDecoration(labelText: 'State / region'),
              ),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                controller: countryController,
                decoration: const InputDecoration(labelText: 'Country'),
              ),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                enabled: false,
                controller: TextEditingController(text: overview.email),
                decoration: const InputDecoration(
                  labelText: 'Email',
                  helperText: 'Email editing is kept read-only for now.',
                ),
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
                          setSheetState(() => saving = true);
                          await _accountService.updatePersonalDetails(
                            CustomerPersonalDetailsInput(
                              firstName: firstNameController.text.trim(),
                              lastName: lastNameController.text.trim(),
                              phoneNumber: phoneController.text.trim(),
                              countryCode: overview.countryCode,
                              emergencyContactNumber:
                                  emergencyController.text.trim(),
                              dateOfBirth: isoDate,
                              sex: selectedSex,
                              city: cityController.text.trim(),
                              region: regionController.text.trim(),
                              country: countryController.text.trim(),
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
                            debugPrint('Update personal details failed: $error');
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

  String _normalizeDateForSave(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) {
      return '';
    }

    try {
      return DateTime.parse(trimmed).toIso8601String().split('T').first;
    } catch (_) {
      try {
        final parsed = MaterialLocalizations.of(context).parseCompactDate(
          trimmed,
        );
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
    final stateController = TextEditingController();
    final postcodeController = TextEditingController();
    final countryController = TextEditingController(text: 'Malaysia');
    var isDefault = false;

    await SwiperBottomSheet.show<void>(
      context,
      title: 'Add saved address',
      subtitle: 'Save Home, Work, or any other location for faster booking.',
      child: StatefulBuilder(
        builder: (context, setSheetState) {
          return Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: labelController,
                decoration: const InputDecoration(labelText: 'Label'),
              ),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                controller: line1Controller,
                decoration: const InputDecoration(labelText: 'Address Line 1'),
              ),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                controller: line2Controller,
                decoration: const InputDecoration(labelText: 'Address Line 2'),
              ),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                controller: cityController,
                decoration: const InputDecoration(labelText: 'City'),
              ),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                controller: stateController,
                decoration: const InputDecoration(labelText: 'State'),
              ),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                controller: postcodeController,
                decoration: const InputDecoration(labelText: 'Postcode'),
              ),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                controller: countryController,
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
    final notifications = widget.repository.getNotifications();

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

        final displayName =
            overview.fullName.trim().isNotEmpty ? overview.fullName : 'Customer';

        return ListView(
          padding: AppSpacing.screenPadding,
          children: [
            _ProfileSummaryCard(
              displayName: displayName,
              overview: overview,
              onEdit: () => _openEditDetailsSheet(overview),
            ),
            const SizedBox(height: AppSpacing.lg),
            _OverviewSectionCard(
              title: 'Profile Completion',
              child: Column(
                children: [
                  Row(
                    children: [
                      const Spacer(),
                      RichText(
                        text: TextSpan(
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                color: AppColors.textSecondary,
                              ),
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
            InkWell(
              borderRadius: BorderRadius.circular(26),
              onTap: () => Navigator.of(context).pushNamed(
                AppRoutes.profileVerification,
              ),
              child: _VerificationHubCard(
                verified: overview.verification.verified,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            _OverviewSectionCard(
              title: 'Personal Details',
              actionLabel: 'Edit',
              child: Column(
                children: [
                  _InfoActionRow(
                    icon: Icons.person_outline_rounded,
                    label: 'Full Name',
                    value: displayName,
                  ),
                  _InfoActionRow(
                    icon: Icons.mail_outline_rounded,
                    label: 'Email',
                    value: overview.email.isEmpty ? '-' : overview.email,
                  ),
                  _InfoActionRow(
                    icon: Icons.phone_outlined,
                    label: 'Phone',
                    value:
                        '${overview.countryCode} ${overview.phoneNumber}'.trim(),
                  ),
                  _InfoActionRow(
                    icon: Icons.cake_outlined,
                    label: 'Date of Birth',
                    value: overview.dateOfBirth.isEmpty
                        ? '-'
                        : overview.dateOfBirth,
                  ),
                  _InfoActionRow(
                    icon: Icons.wc_outlined,
                    label: 'Sex',
                    value: overview.sex.isEmpty ? '-' : overview.sex,
                  ),
                  _InfoActionRow(
                    icon: Icons.support_agent_outlined,
                    label: 'Emergency Contact',
                    value: overview.emergencyContactNumber.isEmpty
                        ? '-'
                        : overview.emergencyContactNumber,
                  ),
                  _InfoActionRow(
                    icon: Icons.place_outlined,
                    label: 'Location',
                    value: [
                      overview.city,
                      overview.region,
                      overview.country,
                    ].where((item) => item.trim().isNotEmpty).join(', '),
                    isLast: true,
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            _OverviewSectionCard(
              title: 'Verification Details',
              child: Column(
                children: [
                  _InfoActionRow(
                    icon: Icons.mail_outline_rounded,
                    label: 'Email',
                    value: overview.verification.emailVerified
                        ? 'Verified'
                        : 'Pending',
                  ),
                  _InfoActionRow(
                    icon: Icons.phone_outlined,
                    label: 'Phone',
                    value: overview.verification.phoneVerified
                        ? 'Verified'
                        : 'Pending',
                  ),
                  _InfoActionRow(
                    icon: Icons.badge_outlined,
                    label: 'IC / Passport',
                    value: overview.verification.verified
                        ? 'Verified'
                        : overview.verification.identityStatusLabel,
                    isLast: true,
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            _OverviewSectionCard(
              title: 'My Bookings',
              actionLabel: 'View All',
              onActionTap: () => Navigator.of(
                context,
              ).pushNamed(AppRoutes.bookingOverview),
              child: Column(
                children: [
                  _InfoActionRow(
                    icon: Icons.calendar_today_rounded,
                    label: 'Pending Bookings',
                    value: '${overview.bookingSummary.pending}',
                  ),
                  _InfoActionRow(
                    icon: Icons.check_circle_outline_rounded,
                    label: 'On Going Bookings',
                    value: '${overview.bookingSummary.ongoing}',
                  ),
                  _InfoActionRow(
                    icon: Icons.task_alt_rounded,
                    label: 'Completed Bookings',
                    value: '${overview.bookingSummary.completed}',
                  ),
                  _InfoActionRow(
                    icon: Icons.cancel_outlined,
                    label: 'Cancelled Bookings',
                    value: '${overview.bookingSummary.cancelled}',
                    isLast: true,
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            _OverviewSectionCard(
              title: 'Favourite Providers',
              actionLabel: 'View All',
              onActionTap: () => Navigator.of(
                context,
              ).pushNamed(AppRoutes.profileFavorites),
              child: const _PlaceholderPanel(
                icon: Icons.favorite_border_rounded,
                title: 'No favourite providers saved yet.',
                subtitle:
                    'Providers you save in the app will appear here for quick access.',
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            _OverviewSectionCard(
              title: 'Saved Address',
              actionLabel: 'Open',
              onActionTap: () => Navigator.of(
                context,
              ).pushNamed(AppRoutes.profileAddresses),
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
              title: 'Payment Methods',
              actionLabel: 'Manage',
              child: Column(
                children: const [
                  _InfoActionRow(
                    icon: Icons.payments_outlined,
                    label: 'Primary Method',
                    value: 'Cash',
                  ),
                  _InfoActionRow(
                    icon: Icons.info_outline_rounded,
                    label: 'Setup',
                    value: 'Managed during booking',
                    isLast: true,
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            _OverviewSectionCard(
              title: 'Payment',
              actionLabel: 'View All',
              onActionTap: () => Navigator.of(
                context,
              ).pushNamed(AppRoutes.profilePayments),
              child: Column(
                children: [
                  _InfoActionRow(
                    icon: Icons.account_balance_wallet_outlined,
                    label: 'Total Paid',
                    value: overview.paymentSummary.totalPaidLabel,
                  ),
                  _InfoActionRow(
                    icon: Icons.calendar_today_outlined,
                    label: 'Latest Payment',
                    value: overview.paymentSummary.lastPaymentLabel,
                    isLast: overview.paymentSummary.recentPayments.isEmpty,
                  ),
                  for (var index = 0;
                      index < overview.paymentSummary.recentPayments.length;
                      index++)
                    _InfoActionRow(
                      icon: Icons.receipt_long_outlined,
                      label: overview
                          .paymentSummary.recentPayments[index].serviceTitle,
                      value:
                          '${overview.paymentSummary.recentPayments[index].amountLabel} • ${overview.paymentSummary.recentPayments[index].statusLabel}',
                      isLast: index ==
                          overview.paymentSummary.recentPayments.length - 1,
                    ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            _OverviewSectionCard(
              title: 'Recent notifications',
              actionLabel: 'Open',
              onActionTap: () => Navigator.of(
                context,
              ).pushNamed(AppRoutes.profileNotifications),
              child: Column(
                children: [
                  for (final notification in notifications) ...[
                    NotificationCard(notification: notification),
                    const SizedBox(height: AppSpacing.sm),
                  ],
                ],
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
    final location = [
      overview.city,
      overview.region,
    ].where((item) => item.trim().isNotEmpty).join(', ');

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onEdit,
          child: Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
            border: Border.all(color: const Color(0xFFE4ECE7)),
            boxShadow: const [
              BoxShadow(
                color: Color(0x0A0F172A),
                blurRadius: 26,
                offset: Offset(0, 10),
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
                                style: Theme.of(context)
                                    .textTheme
                                    .titleMedium
                                    ?.copyWith(
                                      fontWeight: FontWeight.w800,
                                      color: const Color(0xFF111827),
                                    ),
                              ),
                              const SizedBox(height: AppSpacing.xs),
                              Row(
                                children: [
                                  const Icon(
                                    Icons.place_outlined,
                                    size: 14,
                                    color: AppColors.textSecondary,
                                  ),
                                  const SizedBox(width: 4),
                                  Expanded(
                                    child: Text(
                                      location.isEmpty ? 'Malaysia' : location,
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodySmall
                                          ?.copyWith(
                                            color: AppColors.textSecondary,
                                          ),
                                    ),
                                  ),
                                ],
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
                      const SizedBox(height: AppSpacing.sm),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 6,
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
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE4ECE7)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A0F172A),
            blurRadius: 26,
            offset: Offset(0, 10),
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
                        fontSize: 14,
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
          const SizedBox(height: AppSpacing.md),
          child,
        ],
      ),
    );
  }
}

class _VerificationHubCard extends StatelessWidget {
  const _VerificationHubCard({
    required this.verified,
  });

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
                colors: [
                  Color(0xFFC18EFF),
                  AppColors.primary,
                ],
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
                  'Open phone, email, and IC / passport verification',
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
          const Icon(
            Icons.chevron_right_rounded,
            color: Color(0xFF98A2B3),
          ),
        ],
      ),
    );
  }
}

class _InfoActionRow extends StatelessWidget {
  const _InfoActionRow({
    required this.icon,
    required this.label,
    required this.value,
    this.isLast = false,
  });

  final IconData icon;
  final String label;
  final String value;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.only(bottom: isLast ? 0 : AppSpacing.md),
      margin: EdgeInsets.only(bottom: isLast ? 0 : AppSpacing.md),
      decoration: BoxDecoration(
        border: isLast
            ? null
            : const Border(
                bottom: BorderSide(color: Color(0xFFEDF1EF)),
              ),
      ),
      child: Row(
        children: [
          Icon(icon, size: 18, color: AppColors.textSecondary),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: const Color(0xFF111827),
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PlaceholderPanel extends StatelessWidget {
  const _PlaceholderPanel({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFD9E2DD)),
        color: const Color(0xFFFBFEFC),
      ),
      child: Column(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: const BoxDecoration(
              color: AppColors.primarySoft,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: AppColors.primary),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            title,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: const Color(0xFF111827),
                  fontWeight: FontWeight.w700,
                ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            subtitle,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.textSecondary,
                  height: 1.5,
                ),
          ),
        ],
      ),
    );
  }
}

class _SavedAddressPrompt extends StatelessWidget {
  const _SavedAddressPrompt({
    required this.onOpen,
  });

  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFD9E2DD)),
        color: const Color(0xFFFBFEFC),
      ),
      child: Row(
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
                  'Manage your saved addresses',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF111827),
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                const Text(
                  'View saved addresses and add a new address for faster booking.',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                    height: 1.5,
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
                  child: const Text('Open Saved Addresses'),
                ),
              ],
            ),
          ),
        ],
      ),
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
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFD9E2DD)),
            color: const Color(0xFFFBFEFC),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
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
              const SizedBox(height: AppSpacing.xs),
              Text(primary.formattedAddress),
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
            ],
          ),
        ),
        if (addresses.length > 1) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            '${addresses.length - 1} more saved address${addresses.length - 1 == 1 ? '' : 'es'} available',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.textSecondary,
                ),
          ),
        ],
      ],
    );
  }
}
