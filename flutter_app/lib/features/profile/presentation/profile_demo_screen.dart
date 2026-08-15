import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../../repositories/demo_repository.dart';
import '../../../services/customer_account_service.dart';
import '../../../services/customer_address_service.dart';
import '../../../services/service_location_store.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/notification_card.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/loading_state.dart';
import '../../../widgets/profile_avatar.dart';
import '../../../widgets/swiper_bottom_sheet.dart';
import '../../../widgets/swiper_button.dart';
import '../../../widgets/swiper_section_card.dart';
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
      SnackBar(content: Text('${address.label} is now your active service location.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final notifications = widget.repository.getNotifications();
    return FutureBuilder(
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
            SwiperSectionCard(
              title: displayName,
              subtitle: 'Your signed-in customer profile',
              trailing: SwiperStatusBadge(
                label: overview.verification.verified ? 'Verified' : 'Pending',
                tone: overview.verification.verified
                    ? SwiperStatusTone.success
                    : SwiperStatusTone.warning,
              ),
              child: Row(
                children: [
                  ProfileAvatar(name: displayName, radius: 28),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            SwiperSectionCard(
              title: 'Verification',
              subtitle: 'Email, phone, and identity verification status',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Email: ${overview.verification.emailVerified ? 'Verified' : 'Pending'}',
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    'Phone: ${overview.verification.phoneVerified ? 'Verified' : 'Pending'}',
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text('Identity: ${overview.verification.identityStatusLabel}'),
                  const SizedBox(height: AppSpacing.sm),
                  Text('Profile completion: ${overview.completion}%'),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            SwiperSectionCard(
              title: 'Saved addresses',
              subtitle: 'Use Home, Work, or any custom address across search and booking.',
              trailing: TextButton(
                onPressed: _openAddAddressSheet,
                child: const Text('Add new'),
              ),
              child: overview.addresses.isEmpty
                  ? const Text('No address saved yet.')
                  : Column(
                      children: [
                        for (final address in overview.addresses) ...[
                          Container(
                            width: double.infinity,
                            margin: const EdgeInsets.only(bottom: AppSpacing.md),
                            padding: const EdgeInsets.all(AppSpacing.md),
                            decoration: BoxDecoration(
                              border: Border.all(color: const Color(0xFFE7E1F4)),
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        address.label,
                                        style: Theme.of(context)
                                            .textTheme
                                            .titleSmall
                                            ?.copyWith(fontWeight: FontWeight.w700),
                                      ),
                                    ),
                                    if (address.isDefault)
                                      const SwiperStatusBadge(
                                        label: 'Default',
                                        tone: SwiperStatusTone.info,
                                      ),
                                  ],
                                ),
                                const SizedBox(height: AppSpacing.xs),
                                Text(address.formattedAddress),
                                const SizedBox(height: AppSpacing.sm),
                                Wrap(
                                  spacing: 8,
                                  runSpacing: 8,
                                  children: [
                                    SwiperButton(
                                      label: 'Use for services',
                                      isSecondary: true,
                                      onPressed: () => _setActiveLocation(address),
                                    ),
                                    if (!address.isDefault)
                                      SwiperButton(
                                        label: 'Set default',
                                        isSecondary: true,
                                        onPressed: () async {
                                          await _addressService.setDefaultAddress(
                                            address.label,
                                          );
                                          _refresh();
                                        },
                                      ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
            ),
            const SizedBox(height: AppSpacing.lg),
            SwiperSectionCard(
              title: 'Bookings summary',
              subtitle: 'Live customer task counts from Supabase',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Pending: ${overview.bookingSummary.pending}'),
                  const SizedBox(height: AppSpacing.sm),
                  Text('Ongoing: ${overview.bookingSummary.ongoing}'),
                  const SizedBox(height: AppSpacing.sm),
                  Text('Completed: ${overview.bookingSummary.completed}'),
                  const SizedBox(height: AppSpacing.sm),
                  Text('Cancelled: ${overview.bookingSummary.cancelled}'),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            SwiperSectionCard(
              title: 'Payments',
              subtitle: overview.paymentSummary.lastPaymentLabel,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Total paid: ${overview.paymentSummary.totalPaidLabel}'),
                  if (overview.paymentSummary.recentPayments.isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.md),
                    for (final payment
                        in overview.paymentSummary.recentPayments.take(3)) ...[
                      Text('${payment.serviceTitle} • ${payment.providerName}'),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        '${payment.amountLabel} • ${payment.paymentMethod} • ${payment.statusLabel}',
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(payment.paidAtLabel),
                      const SizedBox(height: AppSpacing.md),
                    ],
                  ],
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            SwiperSectionCard(
              title: 'Contact details',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Email: ${overview.email.isEmpty ? 'Not provided' : overview.email}',
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    'Phone: ${overview.phoneNumber.isEmpty ? 'Not provided' : '${overview.countryCode} ${overview.phoneNumber}'}',
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    'Emergency contact: ${overview.emergencyContactNumber.isEmpty ? 'Not provided' : overview.emergencyContactNumber}',
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text('Date of birth: ${overview.dateOfBirth}'),
                  const SizedBox(height: AppSpacing.sm),
                  Text('Sex: ${overview.sex.isEmpty ? '-' : overview.sex}'),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            SwiperSectionCard(
              title: 'Recent notifications',
              child: Column(
                children: [
                  for (final notification in notifications) ...[
                    NotificationCard(notification: notification),
                    const SizedBox(height: AppSpacing.sm),
                  ],
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}
