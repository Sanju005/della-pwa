import 'package:flutter/material.dart';

import '../../../services/browser_file_picker.dart';
import '../../../services/provider_workspace_service.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/loading_state.dart';

class ProviderEarningsScreen extends StatefulWidget {
  const ProviderEarningsScreen({
    super.key,
    this.onLogOut,
  });

  final VoidCallback? onLogOut;

  @override
  State<ProviderEarningsScreen> createState() => _ProviderEarningsScreenState();
}

class _ProviderEarningsScreenState extends State<ProviderEarningsScreen> {
  static const _workspaceService = ProviderWorkspaceService();
  _PaymentsView _selectedView = _PaymentsView.cash;
  _PaymentsDateFilter _selectedDateFilter = _PaymentsDateFilter.today;
  DateTimeRange? _customRange;
  double? _submittedCompanyAmount;
  PickedBrowserFile? _submittedCompanySlip;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<ProviderWorkspaceBooking>>(
      future: _workspaceService.fetchBookings(),
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const LoadingState(label: 'Loading provider payments...');
        }
        if (snapshot.hasError) {
          return const EmptyState(
            title: 'Unable to load provider payments',
            subtitle: 'Please try again.',
            icon: Icons.error_outline_rounded,
          );
        }

        final bookings = snapshot.data ?? const [];
        final ledgerBookings = _ledgerBookings(bookings);
        final viewBookings = ledgerBookings
            .where((booking) => _selectedView.matches(booking.paymentOption))
            .toList(growable: false);
        final filteredBookings = viewBookings
            .where(_matchesSelectedDateFilter)
            .toList(growable: false);
        final totalCashCommission = ledgerBookings
            .where((booking) => _PaymentsView.cash.matches(booking.paymentOption))
            .fold<double>(
              0,
              (sum, booking) => sum + booking.companyCommissionAmount,
            );

        final gross = filteredBookings.fold<double>(
          0,
          (sum, booking) => sum + _grossAmountFor(booking),
        );
        final net = filteredBookings.fold<double>(
          0,
          (sum, booking) => sum + booking.providerNetAmount,
        );
        final commission = filteredBookings.fold<double>(
          0,
          (sum, booking) => sum + booking.companyCommissionAmount,
        );

        return ListView(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.md,
            AppSpacing.md,
            AppSpacing.md,
            112,
          ),
          children: [
            _header(),
            const SizedBox(height: AppSpacing.md),
            _viewTabs(),
            const SizedBox(height: AppSpacing.md),
            _dateFilterRow(),
            const SizedBox(height: AppSpacing.md),
            Row(
              children: [
                Expanded(
                  child: _metricCard(
                    label: 'Gross',
                    value: _currency(gross),
                    background: const Color(0xFFF2ECFD),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: _metricCard(
                    label: 'Net',
                    value: _currency(net),
                    background: const Color(0xFFE8F6F5),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFFE8E3F3)),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x100F0B1F),
                    blurRadius: 20,
                    offset: Offset(0, 10),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _selectedView == _PaymentsView.cash
                        ? 'Cash Payments'
                        : 'Other Payments',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _selectedView == _PaymentsView.cash
                        ? 'Cash bookings collected by provider. Company commission must be paid by the provider.'
                        : 'Online or other payment types recorded on your provider account.',
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textSecondary,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  _summaryRow('Gross Received', _currency(gross)),
                  _summaryRow(
                    _selectedView == _PaymentsView.cash
                        ? 'Commission Payable To Company'
                        : 'Company Commission',
                    _currency(commission),
                  ),
                  _summaryRow('Net To Provider', _currency(net)),
                  const SizedBox(height: AppSpacing.md),
                  if (filteredBookings.isEmpty)
                    EmptyState(
                      title: _selectedView == _PaymentsView.cash
                          ? 'No cash payment records yet'
                          : 'No other payment records yet',
                      subtitle: _selectedView == _PaymentsView.cash
                          ? 'Cash jobs will appear here once completed.'
                          : 'Online and other payments will appear here once completed.',
                      icon: Icons.payments_outlined,
                    )
                  else
                    ...filteredBookings.map(
                      (booking) => Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                        child: _paymentRow(booking),
                      ),
                    ),
                  if (_selectedView == _PaymentsView.cash) ...[
                    const SizedBox(height: AppSpacing.sm),
                    _companyPayableCard(totalCashCommission),
                  ],
                ],
              ),
            ),
          ],
        );
      },
    );
  }

  List<ProviderWorkspaceBooking> _ledgerBookings(
    List<ProviderWorkspaceBooking> bookings,
  ) {
    final filtered = bookings.where((booking) {
      final hasMoney =
          booking.providerNetAmount > 0 ||
          booking.quotedAmount > 0 ||
          booking.baseAmount > 0;
      return hasMoney &&
          (booking.paidAt.isNotEmpty ||
              booking.companyPaymentStatus.isNotEmpty ||
              _isCompletedStatus(booking.bookingStatus));
    }).toList(growable: true);

    filtered.sort(
      (a, b) => _sortStampFor(b).compareTo(_sortStampFor(a)),
    );
    return filtered;
  }

  double _grossAmountFor(ProviderWorkspaceBooking booking) {
    if (booking.baseAmount > 0) {
      return booking.baseAmount + booking.additionalCharge;
    }
    return booking.quotedAmount;
  }

  String _sortStampFor(ProviderWorkspaceBooking booking) {
    if (booking.paidAt.isNotEmpty) {
      return booking.paidAt;
    }
    if (booking.completedAt.isNotEmpty) {
      return booking.completedAt;
    }
    return booking.createdAt;
  }

  bool _isCompletedStatus(String status) {
    return const {
      'completed',
      'paid',
      'review_requested',
      'reviewed',
      'cash_paid_by_user',
      'payment_received_by_provider',
      'final_payment_sent',
    }.contains(status);
  }

  Widget _header() {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Payments',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              ),
              SizedBox(height: 2),
              Text(
                'Ledger and provider earnings',
                style: TextStyle(
                  fontSize: 12,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
        InkWell(
          borderRadius: BorderRadius.circular(999),
          onTap: widget.onLogOut,
          child: Container(
            width: 34,
            height: 34,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: const Color(0xFFE8E3F3)),
            ),
            child: const Icon(
              Icons.logout_rounded,
              size: 18,
              color: AppColors.textPrimary,
            ),
          ),
        ),
      ],
    );
  }

  Widget _viewTabs() {
    return Container(
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE8E3F3)),
      ),
      child: Row(
        children: [
          Expanded(
            child: _tabButton(
              label: 'Cash',
              selected: _selectedView == _PaymentsView.cash,
              onTap: () => setState(() => _selectedView = _PaymentsView.cash),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: _tabButton(
              label: 'Other',
              selected: _selectedView == _PaymentsView.other,
              onTap: () => setState(() => _selectedView = _PaymentsView.other),
            ),
          ),
        ],
      ),
    );
  }

  Widget _dateFilterRow() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          _filterChip(
            label: 'Today',
            selected: _selectedDateFilter == _PaymentsDateFilter.today,
            onTap: () {
              setState(() {
                _selectedDateFilter = _PaymentsDateFilter.today;
              });
            },
          ),
          const SizedBox(width: 10),
          _filterChip(
            label: 'This Week',
            selected: _selectedDateFilter == _PaymentsDateFilter.thisWeek,
            onTap: () {
              setState(() {
                _selectedDateFilter = _PaymentsDateFilter.thisWeek;
              });
            },
          ),
          const SizedBox(width: 10),
          _filterChip(
            label: _customRange == null
                ? 'Custom Date'
                : _formatRange(_customRange!),
            selected: _selectedDateFilter == _PaymentsDateFilter.custom,
            onTap: _pickCustomRange,
            icon: Icons.date_range_rounded,
          ),
        ],
      ),
    );
  }

  Widget _filterChip({
    required String label,
    required bool selected,
    required VoidCallback onTap,
    IconData? icon,
  }) {
    return InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFFEDE3FF) : Colors.white,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: selected ? AppColors.primary : const Color(0xFFE8E3F3),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(
                icon,
                size: 15,
                color: selected ? AppColors.primary : AppColors.textSecondary,
              ),
              const SizedBox(width: 6),
            ],
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: selected ? AppColors.primary : AppColors.textPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _tabButton({
    required String label,
    required bool selected,
    required VoidCallback onTap,
  }) {
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: onTap,
      child: Container(
        height: 42,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? AppColors.primary : const Color(0xFFF7F4FC),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w800,
            color: selected ? Colors.white : AppColors.textPrimary,
          ),
        ),
      ),
    );
  }

  Widget _metricCard({
    required String label,
    required String value,
    required Color background,
  }) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 14,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            value,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _summaryRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 14,
                color: AppColors.textSecondary,
              ),
            ),
          ),
          Text(
            value,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _paymentRow(ProviderWorkspaceBooking booking) {
    final customerName = booking.customerName.trim().isEmpty
        ? 'Customer'
        : booking.customerName.trim();
    final subtitle = booking.serviceLabel.trim().isEmpty
        ? booking.statusLabel
        : booking.serviceLabel.trim();

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: 14,
        vertical: 12,
      ),
      decoration: BoxDecoration(
        color: const Color(0xFFFCFCFE),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE9E3F5)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  customerName,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _paymentOptionLabel(booking.paymentOption),
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: _selectedView == _PaymentsView.cash
                        ? AppColors.warning
                        : AppColors.success,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Text(
            _currency(booking.providerNetAmount),
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: AppColors.primary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _companyPayableCard(double commission) {
    final hasSubmission =
        _submittedCompanyAmount != null && _submittedCompanySlip != null;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [
            Color(0xFFF7F1FF),
            Color(0xFFFCFAFF),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE6DAFB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: const Color(0xFFEDE3FF),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(
                  Icons.account_balance_wallet_rounded,
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Total Payable To Company',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Cash booking commission due from provider.',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            _currency(hasSubmission ? _submittedCompanyAmount! : commission),
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w900,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            hasSubmission
                ? 'Slip sent to admin. Waiting for manual bank check and balance update.'
                : 'Upload your bank slip and amount paid. Admin will verify it manually.',
            style: const TextStyle(
              fontSize: 12,
              color: AppColors.textSecondary,
              height: 1.4,
            ),
          ),
          if (hasSubmission) ...[
            const SizedBox(height: AppSpacing.sm),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF8E8),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFFFE3A3)),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.schedule_rounded,
                    size: 18,
                    color: Color(0xFFB7791F),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Pending admin review • ${_submittedCompanySlip!.name}',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF8A5A12),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () => _openCompanyPaymentDialog(commission),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              child: const Text(
                'Send Payment Slip',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _paymentOptionLabel(String value) {
    final normalized = value.trim().toLowerCase();
    if (normalized == 'cash') {
      return 'Cash';
    }
    if (normalized.isEmpty) {
      return 'Other';
    }
    return normalized[0].toUpperCase() + normalized.substring(1);
  }

  Future<void> _pickCustomRange() async {
    final now = DateTime.now();
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(now.year - 2),
      lastDate: DateTime(now.year + 2),
      initialDateRange:
          _customRange ??
          DateTimeRange(
            start: now.subtract(const Duration(days: 6)),
            end: now,
          ),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: Theme.of(context).colorScheme.copyWith(
              primary: AppColors.primary,
            ),
          ),
          child: child!,
        );
      },
    );

    if (!mounted || picked == null) {
      return;
    }

    setState(() {
      _customRange = picked;
      _selectedDateFilter = _PaymentsDateFilter.custom;
    });
  }

  Future<void> _openCompanyPaymentDialog(double commission) async {
    if (commission <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No company payment is due right now.'),
        ),
      );
      return;
    }

    final amountController = TextEditingController(
      text: _submittedCompanyAmount != null
          ? _submittedCompanyAmount!.toStringAsFixed(2)
          : commission.toStringAsFixed(2),
    );
    final noteController = TextEditingController();
    PickedBrowserFile? slip = _submittedCompanySlip;
    String error = '';
    var submitting = false;

    final submitted = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            Future<void> pickSlip() async {
              final picked = await pickSingleBrowserFile(
                accept: 'image/*,application/pdf',
              );
              if (picked == null) {
                return;
              }
              setDialogState(() {
                slip = picked;
                error = '';
              });
            }

            return Dialog(
              insetPadding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.lg,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(28),
              ),
              child: Container(
                padding: const EdgeInsets.all(AppSpacing.lg),
                decoration: BoxDecoration(
                  color: const Color(0xFFF9F6FF),
                  borderRadius: BorderRadius.circular(28),
                ),
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text(
                        'Send Payment Slip',
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w900,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Upload the slip and enter the amount paid to the company. Admin will verify it manually.',
                        style: const TextStyle(
                          fontSize: 13,
                          color: AppColors.textSecondary,
                          height: 1.45,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      _dialogLabel('Amount Paid'),
                      const SizedBox(height: 8),
                      TextField(
                        controller: amountController,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        decoration: _dialogInputDecoration(
                          hint: 'Enter paid amount',
                          prefixText: 'RM ',
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      _dialogLabel('Payment Slip'),
                      const SizedBox(height: 8),
                      InkWell(
                        borderRadius: BorderRadius.circular(18),
                        onTap: pickSlip,
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(AppSpacing.md),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: const Color(0xFFDCCFF3)),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 48,
                                height: 48,
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF1E8FF),
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                child: const Icon(
                                  Icons.receipt_long_rounded,
                                  color: AppColors.primary,
                                ),
                              ),
                              const SizedBox(width: AppSpacing.sm),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      slip == null
                                          ? 'Attach bank slip'
                                          : slip!.name,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w700,
                                        color: AppColors.textPrimary,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      slip == null
                                          ? 'Tap to upload image or PDF'
                                          : 'Tap to change attachment',
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: AppColors.textSecondary,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      _dialogLabel('Note'),
                      const SizedBox(height: 8),
                      TextField(
                        controller: noteController,
                        maxLines: 3,
                        decoration: _dialogInputDecoration(
                          hint: 'Optional note for admin',
                        ),
                      ),
                      if (error.isNotEmpty) ...[
                        const SizedBox(height: AppSpacing.sm),
                        Text(
                          error,
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.error,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                      const SizedBox(height: AppSpacing.lg),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton(
                              onPressed: () =>
                                  Navigator.of(dialogContext).pop(false),
                              style: OutlinedButton.styleFrom(
                                padding:
                                    const EdgeInsets.symmetric(vertical: 14),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(16),
                                ),
                              ),
                              child: const Text('Cancel'),
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: FilledButton(
                              onPressed: submitting
                                  ? null
                                  : () async {
                                      final amount = double.tryParse(
                                        amountController.text.trim(),
                                      );
                                      if (amount == null || amount <= 0) {
                                        setDialogState(() {
                                          error = 'Enter a valid paid amount.';
                                        });
                                        return;
                                      }
                                      if (slip == null) {
                                        setDialogState(() {
                                          error =
                                              'Attach the payment slip first.';
                                        });
                                        return;
                                      }

                                      setDialogState(() {
                                        submitting = true;
                                        error = '';
                                      });

                                      try {
                                        await _workspaceService
                                            .submitCompanyPayment(
                                              amount: amount,
                                              note: noteController.text.trim(),
                                              attachmentDataUrl: slip!.dataUrl,
                                              attachmentFileName: slip!.name,
                                              attachmentMimeType:
                                                  slip!.mimeType,
                                            );
                                      } catch (requestError) {
                                        setDialogState(() {
                                          submitting = false;
                                          error = requestError
                                              .toString()
                                              .replaceFirst('Exception: ', '');
                                        });
                                        return;
                                      }

                                      if (!mounted || !dialogContext.mounted) {
                                        return;
                                      }

                                      setState(() {
                                        _submittedCompanyAmount = amount;
                                        _submittedCompanySlip = slip;
                                      });
                                      Navigator.of(dialogContext).pop(true);
                                    },
                              style: FilledButton.styleFrom(
                                backgroundColor: AppColors.primary,
                                foregroundColor: Colors.white,
                                padding:
                                    const EdgeInsets.symmetric(vertical: 14),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(16),
                                ),
                              ),
                              child: Text(
                                submitting ? 'Sending...' : 'Send',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );

    amountController.dispose();
    noteController.dispose();

    if (submitted == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Payment slip sent to admin. Waiting for manual verification.',
          ),
        ),
      );
    }
  }

  Widget _dialogLabel(String label) {
    return Text(
      label,
      style: const TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w800,
        color: AppColors.textPrimary,
      ),
    );
  }

  InputDecoration _dialogInputDecoration({
    required String hint,
    String? prefixText,
  }) {
    return InputDecoration(
      hintText: hint,
      prefixText: prefixText,
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(
        horizontal: 16,
        vertical: 16,
      ),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(18),
        borderSide: const BorderSide(color: Color(0xFFDCCFF3)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(18),
        borderSide: const BorderSide(color: Color(0xFFDCCFF3)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(18),
        borderSide: const BorderSide(color: AppColors.primary, width: 1.4),
      ),
    );
  }

  bool _matchesSelectedDateFilter(ProviderWorkspaceBooking booking) {
    final bookingDate = _dateForBooking(booking);
    if (bookingDate == null) {
      return _selectedDateFilter != _PaymentsDateFilter.custom;
    }

    final dateOnly = DateTime(
      bookingDate.year,
      bookingDate.month,
      bookingDate.day,
    );
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);

    switch (_selectedDateFilter) {
      case _PaymentsDateFilter.today:
        return dateOnly == today;
      case _PaymentsDateFilter.thisWeek:
        final weekStart = today.subtract(Duration(days: today.weekday - 1));
        final weekEnd = weekStart.add(const Duration(days: 6));
        return !dateOnly.isBefore(weekStart) && !dateOnly.isAfter(weekEnd);
      case _PaymentsDateFilter.custom:
        final range = _customRange;
        if (range == null) {
          return true;
        }
        final start = DateTime(
          range.start.year,
          range.start.month,
          range.start.day,
        );
        final end = DateTime(
          range.end.year,
          range.end.month,
          range.end.day,
        );
        return !dateOnly.isBefore(start) && !dateOnly.isAfter(end);
    }
  }

  DateTime? _dateForBooking(ProviderWorkspaceBooking booking) {
    return DateTime.tryParse(_sortStampFor(booking));
  }

  String _formatRange(DateTimeRange range) {
    return '${_shortDate(range.start)} - ${_shortDate(range.end)}';
  }

  String _shortDate(DateTime value) {
    const months = <String>[
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return '${value.day} ${months[value.month - 1]}';
  }

  String _currency(double value) => 'RM ${value.toStringAsFixed(2)}';
}

enum _PaymentsView {
  cash,
  other;

  bool matches(String paymentOption) {
    final normalized = paymentOption.trim().toLowerCase();
    return switch (this) {
      _PaymentsView.cash => normalized == 'cash' || normalized.isEmpty,
      _PaymentsView.other => normalized != 'cash' && normalized.isNotEmpty,
    };
  }
}

enum _PaymentsDateFilter {
  today,
  thisWeek,
  custom,
}
