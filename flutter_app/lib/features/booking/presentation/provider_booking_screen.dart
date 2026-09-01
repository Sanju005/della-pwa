import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/config/app_config.dart';
import '../../../core/routing/app_routes.dart';
import '../../../models/provider_summary.dart';
import '../../../services/customer_account_service.dart';
import '../../../services/customer_address_service.dart';
import '../../../services/provider_booking_service.dart';
import '../../../services/provider_detail_service.dart';
import '../../../services/service_location_store.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/loading_state.dart';
import '../../../widgets/swiper_button.dart';
import '../../../widgets/swiper_app_bar.dart';

enum BookingMode { hourly, daily }

class ProviderBookingScreen extends StatefulWidget {
  const ProviderBookingScreen({super.key});

  @override
  State<ProviderBookingScreen> createState() => _ProviderBookingScreenState();
}

class _ProviderBookingScreenState extends State<ProviderBookingScreen> {
  static const _detailService = ProviderDetailService();
  static const _bookingService = ProviderBookingService();
  static const _accountService = CustomerAccountService();
  static const _addressService = CustomerAddressService();
  static const _paymentMethod = 'Cash';

  final _addressController = TextEditingController();
  final _accessNoteController = TextEditingController();
  final _notesController = TextEditingController();

  ProviderSummary? _provider;
  ProviderDetailModel? _detail;
  BookingMode _bookingMode = BookingMode.hourly;
  String? _selectedDateKey;
  String? _selectedStartTime;
  int _selectedHours = 1;
  bool _isLoading = true;
  bool _isSubmitting = false;
  String? _errorMessage;
  bool _didLoad = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_didLoad) {
      return;
    }

    final args = ModalRoute.of(context)?.settings.arguments;
    if (args is! ProviderSummary) {
      _errorMessage = 'No provider selected.';
      _isLoading = false;
      _didLoad = true;
      return;
    }

    _provider = args;
    _didLoad = true;
    _loadData();
  }

  @override
  void dispose() {
    _addressController.dispose();
    _accessNoteController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    final provider = _provider;
    if (provider == null) {
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final detail = await _detailService.fetchProviderDetail(
        id: provider.id,
        service: provider.serviceKey,
      );

      CustomerAccountOverview? overview;
      List<CustomerAddressSummary> addresses = const [];
      try {
        overview = await _accountService.fetchOverview();
      } catch (error, stackTrace) {
        if (kDebugMode) {
          debugPrint('Customer account overview unavailable for booking: $error');
          debugPrintStack(stackTrace: stackTrace);
        }
      }

      if (overview?.addresses.isNotEmpty == true) {
        addresses = overview!.addresses;
      } else {
        try {
          addresses = await _addressService.fetchAddresses();
        } catch (error, stackTrace) {
          if (kDebugMode) {
            debugPrint('Saved address fetch unavailable for booking: $error');
            debugPrintStack(stackTrace: stackTrace);
          }
        }
      }

      final activeLocation = ServiceLocationStore.load();
      final defaultAddress = addresses.firstWhere(
        (address) => address.isDefault,
        orElse: () => addresses.isNotEmpty
            ? addresses.first
            : const CustomerAddressSummary(
                label: '',
                line1: '',
                line2: '',
                city: '',
                state: '',
                postcode: '',
                country: '',
                isDefault: false,
              ),
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _detail = detail;
        _bookingMode = BookingMode.hourly;
        _selectedHours = 1;
        _selectedDateKey = _firstAvailableDateKey(detail);
        _selectedStartTime = _firstStartOption(detail, _selectedDateKey, BookingMode.hourly);
        _isLoading = false;
      });

      if (_addressController.text.trim().isEmpty &&
          activeLocation != null &&
          activeLocation.address.trim().isNotEmpty) {
        _addressController.text = activeLocation.address.trim();
      } else if (_addressController.text.trim().isEmpty &&
          defaultAddress.label.isNotEmpty) {
        _addressController.text = defaultAddress.formattedAddress;
      }
    } catch (error, stackTrace) {
      if (kDebugMode) {
        debugPrint('Provider booking screen load failed: $error');
        debugPrintStack(stackTrace: stackTrace);
      }

      if (!mounted) {
        return;
      }

      setState(() {
        _errorMessage = 'Unable to load booking details. Please try again.';
        _isLoading = false;
      });
    }
  }

  String? _firstAvailableDateKey(ProviderDetailModel detail) {
    final groups = _availabilityByDate(detail);
    if (groups.isEmpty) {
      return null;
    }

    return groups.keys.first;
  }

  String? _firstStartOption(
    ProviderDetailModel detail,
    String? dateKey,
    BookingMode mode,
  ) {
    if (dateKey == null) {
      return null;
    }

    final options = _startOptionsForDate(detail, dateKey, mode);
    return options.isEmpty ? null : options.first;
  }

  Map<String, List<ProviderAvailabilitySlot>> _availabilityByDate(
    ProviderDetailModel detail,
  ) {
    final grouped = <String, List<ProviderAvailabilitySlot>>{};
    final slots = detail.availability.where((slot) => slot.isAvailable).toList();
    final source = slots.isNotEmpty ? slots : detail.availability;

    for (final slot in source) {
      final key = slot.isoDate.trim().isNotEmpty
          ? slot.isoDate.trim()
          : slot.dateLabel.trim();
      if (key.isEmpty) {
        continue;
      }

      grouped.putIfAbsent(key, () => <ProviderAvailabilitySlot>[]).add(slot);
    }

    return grouped;
  }

  List<ProviderAvailabilitySlot> _slotsForDate(
    ProviderDetailModel detail,
    String? dateKey,
  ) {
    if (dateKey == null) {
      return const [];
    }

    return _availabilityByDate(detail)[dateKey] ?? const [];
  }

  bool _isToday(String? dateKey) {
    if (dateKey == null) {
      return false;
    }
    final now = DateTime.now();
    final todayKey =
        '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
    return dateKey == todayKey;
  }

  int _nowMinutes() {
    final now = DateTime.now();
    return now.hour * 60 + now.minute;
  }

  List<String> _startOptionsForDate(
    ProviderDetailModel detail,
    String? dateKey,
    BookingMode mode,
  ) {
    final slots = _slotsForDate(detail, dateKey);
    if (slots.isEmpty) {
      return const [];
    }

    final isToday = _isToday(dateKey);
    final nowMinutes = _nowMinutes();

    final options = <String>{};
    if (mode == BookingMode.daily) {
      for (final slot in slots) {
        if (slot.startTimeLabel.trim().isNotEmpty) {
          options.add(slot.startTimeLabel.trim());
        }
      }
      final dailyAvailable = options.where((option) {
        if (!isToday) {
          return true;
        }
        final start = _timeToMinutes(option);
        return start != null && start > nowMinutes;
      }).toList()
        ..sort(_compareTimes);
      return dailyAvailable;
    }

    for (final slot in slots) {
      final startMinutes = _timeToMinutes(slot.startTimeLabel);
      final endMinutes = _timeToMinutes(slot.endTimeLabel);
      if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes) {
        if (slot.startTimeLabel.trim().isNotEmpty) {
          options.add(slot.startTimeLabel.trim());
        }
        continue;
      }

      for (var current = startMinutes; current < endMinutes; current += 60) {
        final candidate = _minutesToLabel(current);
        if (candidate != null) {
          options.add(candidate);
        }
      }
    }

    final ranges = detail.bookedTimeRangesByDate[dateKey] ?? const [];
    final available = options.where((option) {
      final start = _timeToMinutes(option);
      if (start == null) {
        return false;
      }

      if (isToday && start <= nowMinutes) {
        return false;
      }

      final end = start + (_selectedHours * 60);
      return !ranges.any((range) {
        final blockedStart = _timeToMinutes(range.startTimeLabel);
        final blockedEnd = _timeToMinutes(range.endTimeLabel);
        if (blockedStart == null || blockedEnd == null) {
          return false;
        }
        return start < blockedEnd && end > blockedStart;
      });
    }).toList()
      ..sort(_compareTimes);

    return available;
  }

  int _compareTimes(String a, String b) {
    final first = _timeToMinutes(a) ?? 0;
    final second = _timeToMinutes(b) ?? 0;
    return first.compareTo(second);
  }

  int? _timeToMinutes(String label) {
    final value = label.trim();
    if (value.isEmpty) {
      return null;
    }

    final normalized = value.toUpperCase();
    for (final pattern in ['h:mm a', 'hh:mm a']) {
      try {
        final parsed = DateFormat(pattern).parseStrict(normalized);
        return parsed.hour * 60 + parsed.minute;
      } catch (_) {
        continue;
      }
    }

    return null;
  }

  String? _minutesToLabel(int minutes) {
    if (minutes < 0) {
      return null;
    }

    final time = DateTime(2026, 8, 15).add(Duration(minutes: minutes));
    return DateFormat('hh:mm a').format(time);
  }

  String _resolveImageUrl(String raw) {
    final value = raw.trim();
    if (value.isEmpty) {
      return '';
    }
    if (value.startsWith('http://') ||
        value.startsWith('https://') ||
        value.startsWith('data:')) {
      return value;
    }
    if (value.startsWith('/')) {
      return '${AppConfig.appBaseUrl}$value';
    }
    return '${AppConfig.appBaseUrl}/$value';
  }

  ProviderAvailabilitySlot? _selectedDateSlot(ProviderDetailModel detail) {
    final slots = _slotsForDate(detail, _selectedDateKey);
    return slots.isEmpty ? null : slots.first;
  }

  int _durationHoursForSelection(ProviderDetailModel detail) {
    if (_bookingMode == BookingMode.hourly) {
      return _selectedHours;
    }

    final slot = _selectedDateSlot(detail);
    final start = slot == null ? null : _timeToMinutes(slot.startTimeLabel);
    final end = slot == null ? null : _timeToMinutes(slot.endTimeLabel);
    if (start == null || end == null || end <= start) {
      return 1;
    }

    return ((end - start) / 60).round().clamp(1, 24);
  }

  String _endTimeForSelection(ProviderDetailModel detail) {
    final slot = _selectedDateSlot(detail);
    if (slot == null) {
      return '-';
    }

    if (_bookingMode == BookingMode.daily) {
      return slot.endTimeLabel;
    }

    final start = _timeToMinutes(_selectedStartTime ?? '');
    if (start == null) {
      return slot.endTimeLabel;
    }

    return _minutesToLabel(start + (_selectedHours * 60)) ?? slot.endTimeLabel;
  }

  int _totalAmount(ProviderDetailModel detail) {
    if (_bookingMode == BookingMode.daily) {
      return detail.dailyRate;
    }
    return detail.hourlyRate * _selectedHours;
  }

  Future<void> _submitBooking() async {
    final detail = _detail;
    final provider = _provider;
    if (detail == null || provider == null || _selectedDateKey == null) {
      return;
    }

    final slot = _selectedDateSlot(detail);
    final dateLabel = slot?.dateLabel.trim().isNotEmpty == true
        ? slot!.dateLabel
        : _selectedDateKey!;
    final startTime = _bookingMode == BookingMode.daily
        ? (slot?.startTimeLabel ?? '')
        : (_selectedStartTime ?? '');
    final endTime = _endTimeForSelection(detail);
    final location = _addressController.text.trim();

    if (location.isEmpty) {
      _showSnackBar('Please add the service address.');
      return;
    }

    if (startTime.isEmpty || endTime.isEmpty || endTime == '-') {
      _showSnackBar('Please choose an available time slot.');
      return;
    }

    setState(() {
      _isSubmitting = true;
    });

    final notes = [
      'Payment method: $_paymentMethod',
      if (_accessNoteController.text.trim().isNotEmpty)
        'Access note: ${_accessNoteController.text.trim()}',
      if (_notesController.text.trim().isNotEmpty)
        'Additional notes: ${_notesController.text.trim()}',
    ].join('\n');

    try {
      await _bookingService.createBooking(
        ProviderBookingRequest(
          providerId: provider.id,
          providerName: detail.name,
          serviceKey: detail.serviceKey.isNotEmpty
              ? detail.serviceKey
              : provider.serviceKey,
          serviceLabel: detail.serviceLabel.isNotEmpty
              ? detail.serviceLabel
              : provider.service,
          location: location,
          bookingMode: _bookingMode.name,
          dateLabel: dateLabel,
          startTimeLabel: startTime,
          endTimeLabel: endTime,
          timeLabel: '$startTime - $endTime',
          durationHours: _durationHoursForSelection(detail),
          notes: notes,
          hourlyRate: detail.hourlyRate,
          dailyRate: detail.dailyRate,
          totalAmount: _totalAmount(detail),
        ),
      );

      if (!mounted) {
        return;
      }

      _showSnackBar('Booking scheduled successfully.');
      Navigator.of(context).pushReplacementNamed(
        AppRoutes.bookingOverview,
        arguments: const {'created': true},
      );
    } catch (error, stackTrace) {
      if (kDebugMode) {
        debugPrint('Create booking failed: $error');
        debugPrintStack(stackTrace: stackTrace);
      }
      if (!mounted) {
        return;
      }
      _showSnackBar(
        error is Exception
            ? error.toString().replaceFirst('Exception: ', '')
            : 'Unable to schedule booking. Please try again.',
      );
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  void _showSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = _provider;
    final detail = _detail;

    return Scaffold(
      appBar: SwiperAppBar(
        title: provider == null ? 'Book Provider' : 'Book ${provider.name}',
        subtitle: 'Schedule your service',
        showBack: true,
      ),
      bottomNavigationBar: detail == null
          ? null
          : SafeArea(
              minimum: const EdgeInsets.fromLTRB(
                AppSpacing.md,
                AppSpacing.xs,
                AppSpacing.md,
                AppSpacing.md,
              ),
              child: Container(
                padding: const EdgeInsets.all(AppSpacing.sm),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(color: const Color(0xFFE7ECE8)),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x12111720),
                      blurRadius: 24,
                      offset: Offset(0, 10),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Total',
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: AppColors.textSecondary,
                                ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'RM ${_totalAmount(detail).toStringAsFixed(2)}',
                            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                  color: AppColors.primary,
                                  fontWeight: FontWeight.w800,
                                ),
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      flex: 2,
                      child: SwiperButton(
                        label: 'Schedule Booking',
                        icon: const Icon(Icons.calendar_month_rounded),
                        isLoading: _isSubmitting,
                        onPressed: _isSubmitting ? null : _submitBooking,
                      ),
                    ),
                  ],
                ),
              ),
            ),
      body: _isLoading
          ? const LoadingState(label: 'Loading booking details...')
          : provider == null
              ? const EmptyState(
                  title: 'No provider selected',
                  subtitle: 'Open this screen from the providers list.',
                  icon: Icons.storefront_outlined,
                )
              : _errorMessage != null
                  ? EmptyState(
                      title: 'Unable to load booking',
                      subtitle: _errorMessage!,
                      icon: Icons.error_outline_rounded,
                    )
                  : detail == null
                      ? const EmptyState(
                          title: 'Booking unavailable',
                          subtitle: 'Please try again.',
                          icon: Icons.calendar_month_outlined,
                        )
                      : _buildContent(context, detail),
    );
  }

  Widget _buildContent(BuildContext context, ProviderDetailModel detail) {
    final imageUrl = _resolveImageUrl(detail.profileImage);
    final dateGroups = _availabilityByDate(detail);
    final selectedSlot = _selectedDateSlot(detail);
    final startOptions =
        _startOptionsForDate(detail, _selectedDateKey, _bookingMode);

    if (_selectedDateKey != null &&
        startOptions.isNotEmpty &&
        !startOptions.contains(_selectedStartTime)) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) {
          return;
        }
        setState(() {
          _selectedStartTime = startOptions.first;
        });
      });
    }

    return ListView(
      padding: AppSpacing.screenPadding,
      children: [
        _summaryCard(context, detail, imageUrl),
        const SizedBox(height: AppSpacing.md),
        _section(
          context,
          title: '1. Service Type',
          child: Row(
            children: [
              Expanded(
                child: _modeTile(
                  context,
                  title: 'Hourly',
                  subtitle: 'RM ${detail.hourlyRate} / hr',
                  selected: _bookingMode == BookingMode.hourly,
                  onTap: () {
                    setState(() {
                      _bookingMode = BookingMode.hourly;
                      _selectedStartTime =
                          _firstStartOption(detail, _selectedDateKey, _bookingMode);
                    });
                  },
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: _modeTile(
                  context,
                  title: 'Daily',
                  subtitle: 'RM ${detail.dailyRate} / day',
                  selected: _bookingMode == BookingMode.daily,
                  onTap: () {
                    setState(() {
                      _bookingMode = BookingMode.daily;
                      _selectedStartTime =
                          _firstStartOption(detail, _selectedDateKey, _bookingMode);
                    });
                  },
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        _section(
          context,
          title: '2. Date & Time',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                height: 86,
                child: dateGroups.isEmpty
                    ? const Center(
                        child: Text('No availability shared by this provider yet.'),
                      )
                    : ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: dateGroups.length,
                        separatorBuilder: (_, _) => const SizedBox(width: 10),
                        itemBuilder: (context, index) {
                          final entry = dateGroups.entries.elementAt(index);
                          final slot = entry.value.first;
                          final selected = entry.key == _selectedDateKey;
                          return _datePill(
                            context,
                            slot: slot,
                            selected: selected,
                            onTap: () {
                              setState(() {
                                _selectedDateKey = entry.key;
                                _selectedStartTime = _firstStartOption(
                                  detail,
                                  entry.key,
                                  _bookingMode,
                                );
                              });
                            },
                          );
                        },
                      ),
              ),
              const SizedBox(height: AppSpacing.md),
              if (_bookingMode == BookingMode.hourly) ...[
                Row(
                  children: [
                    Expanded(
                      child: _dropdownField(
                        context,
                        label: 'Start time',
                        value: _selectedStartTime,
                        items: startOptions,
                        onChanged: (value) {
                          setState(() {
                            _selectedStartTime = value;
                          });
                        },
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: _hoursStepper(context),
                    ),
                  ],
                ),
              ] else
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    color: AppColors.primarySoft,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Text(
                    selectedSlot == null
                        ? 'Select a date to continue.'
                        : 'Working hours ${selectedSlot.timeLabel}',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                ),
              const SizedBox(height: AppSpacing.md),
              Row(
                children: [
                  Expanded(
                    child: _summaryMetric(
                      context,
                      label: 'Estimated End Time',
                      value: _endTimeForSelection(detail),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: _summaryMetric(
                      context,
                      label: 'Duration',
                      value: _bookingMode == BookingMode.daily
                          ? '1 Day'
                          : '$_selectedHours Hour${_selectedHours == 1 ? '' : 's'}',
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        _section(
          context,
          title: '3. Service Address',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Service address',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.textSecondary,
                    ),
              ),
              const SizedBox(height: AppSpacing.xs),
              _textArea(
                controller: _addressController,
                minLines: 3,
                maxLines: 4,
                hintText:
                    'The provider will use the location selected on your home screen.',
                readOnly: true,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                'This service address follows the location the customer selected on the home screen before browsing providers.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.textSecondary,
                    ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        _section(
          context,
          title: '4. Notes',
          child: Column(
            children: [
              _textArea(
                controller: _accessNoteController,
                minLines: 2,
                maxLines: 3,
                hintText:
                    'Example: Gate B, near the surau, call when you arrive.',
              ),
              const SizedBox(height: AppSpacing.sm),
              _textArea(
                controller: _notesController,
                minLines: 3,
                maxLines: 4,
                hintText: 'Add any special service instructions.',
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        _section(
          context,
          title: '5. Payment Method',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: const [
                  _PaymentMethodChip(label: 'Cash', selected: true),
                  _PaymentMethodChip(label: 'QR', enabled: false),
                  _PaymentMethodChip(label: 'Bank Transfer', enabled: false),
                  _PaymentMethodChip(label: 'Card', enabled: false),
                  _PaymentMethodChip(label: 'Wallet', enabled: false),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                'Cash is the default payment method for now. QR, bank transfer, card, and wallet will be available later.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.textSecondary,
                    ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        _section(
          context,
          title: 'Booking Summary',
          child: Column(
            children: [
              _summaryRow(
                'Service Type',
                _bookingMode == BookingMode.daily ? 'Daily' : 'Hourly',
              ),
              _summaryRow('Date', selectedSlot?.dateLabel ?? '-'),
              _summaryRow(
                'Duration',
                _bookingMode == BookingMode.daily
                    ? '1 Day'
                    : '$_selectedHours Hour${_selectedHours == 1 ? '' : 's'}',
              ),
              _summaryRow(
                'Time',
                _selectedStartTime == null && _bookingMode == BookingMode.hourly
                    ? '-'
                    : '${_bookingMode == BookingMode.daily ? selectedSlot?.startTimeLabel ?? '-' : _selectedStartTime} - ${_endTimeForSelection(detail)}',
              ),
              _summaryRow('Payment Method', _paymentMethod),
              const Divider(height: 24),
              _summaryRow(
                'Total',
                'RM ${_totalAmount(detail).toStringAsFixed(2)}',
                emphasize: true,
              ),
            ],
          ),
        ),
        const SizedBox(height: 120),
      ],
    );
  }

  Widget _summaryCard(
    BuildContext context,
    ProviderDetailModel detail,
    String imageUrl,
  ) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFE7ECE8)),
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: imageUrl.isNotEmpty
                ? Image.network(
                    imageUrl,
                    width: 78,
                    height: 92,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => _imageFallback(detail.name),
                  )
                : _imageFallback(detail.name),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  detail.name,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                ),
                const SizedBox(height: 4),
                Text(
                  detail.title,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 10,
                  runSpacing: 6,
                  children: [
                    _miniInfo(Icons.star_rounded, detail.reviewsLabel),
                    _miniInfo(Icons.place_outlined, '${detail.distanceKm} km away'),
                    _miniInfo(Icons.work_outline_rounded, detail.yearsExperience),
                  ],
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _statusBadge(
                      detail.verified ? 'Verified' : 'Pending',
                      detail.verified,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _section(
    BuildContext context, {
    required String title,
    required Widget child,
  }) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE7ECE8)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: AppSpacing.md),
          child,
        ],
      ),
    );
  }

  Widget _modeTile(
    BuildContext context, {
    required String title,
    required String subtitle,
    required bool selected,
    required VoidCallback onTap,
  }) {
    return InkWell(
      borderRadius: BorderRadius.circular(18),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFFF9F5FF) : Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: selected ? AppColors.primary : const Color(0xFFE7ECE8),
            width: selected ? 1.6 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  selected
                      ? Icons.radio_button_checked_rounded
                      : Icons.radio_button_off_rounded,
                  color: selected ? AppColors.primary : AppColors.disabled,
                ),
                const SizedBox(width: 8),
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              subtitle,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _datePill(
    BuildContext context, {
    required ProviderAvailabilitySlot slot,
    required bool selected,
    required VoidCallback onTap,
  }) {
    final displayDate = slot.isoDate.trim().isNotEmpty
        ? DateTime.tryParse(slot.isoDate)
        : null;

    return InkWell(
      borderRadius: BorderRadius.circular(18),
      onTap: onTap,
      child: Container(
        width: 82,
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFFF7F0FF) : Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: selected ? AppColors.primary : const Color(0xFFE7ECE8),
            width: selected ? 1.6 : 1,
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              slot.dayLabel.isNotEmpty
                  ? slot.dayLabel
                  : (displayDate == null
                      ? '-'
                      : DateFormat('EEE').format(displayDate)),
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: selected ? AppColors.primary : AppColors.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 6),
            Text(
              displayDate == null
                  ? slot.dateLabel
                  : DateFormat('d MMM').format(displayDate),
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                  ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _dropdownField(
    BuildContext context, {
    required String label,
    required String? value,
    required List<String> items,
    required ValueChanged<String?> onChanged,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppColors.textSecondary,
              ),
        ),
        const SizedBox(height: AppSpacing.xs),
        DropdownButtonFormField<String>(
          value: items.contains(value) ? value : null,
          decoration: InputDecoration(
            filled: true,
            fillColor: const Color(0xFFFCFBFF),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: const BorderSide(color: Color(0xFFE7ECE8)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: const BorderSide(color: Color(0xFFE7ECE8)),
            ),
          ),
          items: items
              .map(
                (item) => DropdownMenuItem<String>(
                  value: item,
                  child: Text(item),
                ),
              )
              .toList(),
          onChanged: items.isEmpty ? null : onChanged,
        ),
      ],
    );
  }

  Widget _hoursStepper(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'How many hours',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppColors.textSecondary,
              ),
        ),
        const SizedBox(height: AppSpacing.xs),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: const Color(0xFFFCFBFF),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE7ECE8)),
          ),
          child: Row(
            children: [
              IconButton(
                onPressed: _selectedHours > 1
                    ? () {
                        setState(() {
                          _selectedHours -= 1;
                          _selectedStartTime = _detail == null
                              ? _selectedStartTime
                              : _firstStartOption(
                                  _detail!,
                                  _selectedDateKey,
                                  _bookingMode,
                                );
                        });
                      }
                    : null,
                icon: const Icon(Icons.remove_circle_outline_rounded),
              ),
              Expanded(
                child: Text(
                  '$_selectedHours Hour${_selectedHours == 1 ? '' : 's'}',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ),
              IconButton(
                onPressed: _selectedHours < 12
                    ? () {
                        setState(() {
                          _selectedHours += 1;
                          _selectedStartTime = _detail == null
                              ? _selectedStartTime
                              : _firstStartOption(
                                  _detail!,
                                  _selectedDateKey,
                                  _bookingMode,
                                );
                        });
                      }
                    : null,
                icon: const Icon(Icons.add_circle_outline_rounded),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _summaryMetric(
    BuildContext context, {
    required String label,
    required String value,
  }) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.primarySoft,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.textSecondary,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w800,
                ),
          ),
        ],
      ),
    );
  }

  Widget _textArea({
    required TextEditingController controller,
    required int minLines,
    required int maxLines,
    required String hintText,
    bool readOnly = false,
  }) {
    return TextField(
      controller: controller,
      minLines: minLines,
      maxLines: maxLines,
      readOnly: readOnly,
      decoration: InputDecoration(
        hintText: hintText,
        filled: true,
        fillColor: const Color(0xFFFCFBFF),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: Color(0xFFE7ECE8)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: Color(0xFFE7ECE8)),
        ),
      ),
    );
  }

  Widget _miniInfo(IconData icon, String value) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: AppColors.primary),
        const SizedBox(width: 4),
        Text(
          value,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: AppColors.textSecondary,
          ),
        ),
      ],
    );
  }

  Widget _statusBadge(String label, bool verified) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: verified ? const Color(0xFFF2FBF5) : const Color(0xFFFFF8EE),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: verified ? const Color(0xFFCBE8D2) : const Color(0xFFFDE2B7),
        ),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: verified ? const Color(0xFF138A36) : const Color(0xFFD97706),
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  Widget _imageFallback(String name) {
    final initials = name
        .split(RegExp(r'\s+'))
        .where((part) => part.isNotEmpty)
        .take(2)
        .map((part) => part.characters.first.toUpperCase())
        .join();

    return Container(
      width: 78,
      height: 92,
      color: AppColors.primarySoft,
      alignment: Alignment.center,
      child: Text(
        initials.isEmpty ? 'P' : initials,
        style: const TextStyle(
          color: AppColors.primary,
          fontSize: 22,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  Widget _summaryRow(String label, String value, {bool emphasize = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 13,
              ),
            ),
          ),
          Text(
            value,
            textAlign: TextAlign.right,
            style: TextStyle(
              color: emphasize ? AppColors.primary : AppColors.textPrimary,
              fontSize: emphasize ? 18 : 13,
              fontWeight: emphasize ? FontWeight.w800 : FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _PaymentMethodChip extends StatelessWidget {
  const _PaymentMethodChip({
    required this.label,
    this.selected = false,
    this.enabled = true,
  });

  final String label;
  final bool selected;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final backgroundColor = selected
        ? AppColors.primarySoft
        : enabled
            ? Colors.white
            : const Color(0xFFF8F6FC);
    final borderColor = selected
        ? AppColors.primary
        : enabled
            ? const Color(0xFFE7ECE8)
            : const Color(0xFFE7E1F4);
    final textColor = selected
        ? AppColors.primary
        : enabled
            ? AppColors.textPrimary
            : AppColors.textSecondary;

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: borderColor),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            selected
                ? Icons.radio_button_checked_rounded
                : Icons.radio_button_off_rounded,
            size: 16,
            color: textColor,
          ),
          const SizedBox(width: AppSpacing.xs),
          Text(
            enabled ? label : '$label Soon',
            style: TextStyle(
              color: textColor,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
