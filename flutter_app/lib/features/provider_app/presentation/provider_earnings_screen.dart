import 'package:flutter/material.dart';

import '../../../services/browser_file_picker.dart';
import '../../../services/provider_workspace_service.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/app_reveal.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/swiper_button.dart';
import 'widgets/provider_earnings_skeleton.dart';

class ProviderEarningsScreen extends StatefulWidget {
  const ProviderEarningsScreen({super.key});

  @override
  State<ProviderEarningsScreen> createState() => _ProviderEarningsScreenState();
}

class _ProviderEarningsData {
  const _ProviderEarningsData({
    required this.bookings,
    required this.companySummary,
  });

  final List<ProviderWorkspaceBooking> bookings;
  final ProviderCompanyPaymentSummary companySummary;
}

class _ProviderEarningsScreenState extends State<ProviderEarningsScreen> {
  static const _workspaceService = ProviderWorkspaceService();
  static const _cardRadius = 20.0;
  static const _tileRadius = 16.0;

  late Future<_ProviderEarningsData> _future;
  _PaymentsView _selectedView = _PaymentsView.cash;
  _PaymentsDateFilter _selectedDateFilter = _PaymentsDateFilter.today;
  DateTimeRange? _customRange;
  // Backend-returned summary from the most recent successful submission.
  // Used so the UI reflects the real settlement state immediately without
  // an extra GET round-trip — still backend data, never fabricated.
  ProviderCompanyPaymentSummary? _companySummaryOverride;

  @override
  void initState() {
    super.initState();
    _future = _loadData();
  }

  Future<_ProviderEarningsData> _loadData() async {
    final results = await Future.wait<Object>([
      _workspaceService.fetchBookings(),
      _workspaceService.fetchCompanyPaymentSummary(),
    ]);
    return _ProviderEarningsData(
      bookings: results[0] as List<ProviderWorkspaceBooking>,
      companySummary: results[1] as ProviderCompanyPaymentSummary,
    );
  }

  Future<void> _reload() async {
    // Only path (besides the initial load) that creates a new fetch.
    // Selecting a tab or date filter never touches _future.
    final future = _loadData();
    setState(() {
      _future = future;
      _companySummaryOverride = null;
    });
    await future;
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<_ProviderEarningsData>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const ProviderEarningsSkeleton();
        }
        if (snapshot.hasError) {
          return const EmptyState(
            title: 'Unable to load provider payments',
            subtitle: 'Please try again.',
            icon: Icons.error_outline_rounded,
          );
        }

        final data = snapshot.data;
        final bookings = data?.bookings ?? const [];
        // Backend is authoritative: prefer the freshest server-confirmed
        // summary (set right after a successful submission) over the one
        // loaded with this fetch, but never fall back to fabricated data.
        final companySummary =
            _companySummaryOverride ??
            data?.companySummary ??
            ProviderCompanyPaymentSummary.empty;

        final ledgerBookings = _ledgerBookings(bookings);
        final viewBookings = ledgerBookings
            .where((booking) => _selectedView.matches(booking.paymentOption))
            .toList(growable: false);
        final filteredBookings = viewBookings
            .where(_matchesSelectedDateFilter)
            .toList(growable: false);

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

        return RefreshIndicator(
          color: AppColors.primary,
          onRefresh: _reload,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.md,
              AppSpacing.md,
              AppSpacing.md,
              112,
            ),
            children: [
              AppReveal(child: _header()),
              const SizedBox(height: AppSpacing.lg),
              AppReveal(
                delay: const Duration(milliseconds: 40),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _viewTabs(),
                    const SizedBox(height: AppSpacing.md),
                    _dateFilterRow(),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              AppReveal(
                delay: const Duration(milliseconds: 80),
                child: _financialSummaryCard(
                  gross: gross,
                  net: net,
                  commission: commission,
                ),
              ),
              if (_selectedView == _PaymentsView.cash) ...[
                const SizedBox(height: AppSpacing.md),
                AppReveal(
                  delay: const Duration(milliseconds: 120),
                  child: _companyPayableCard(companySummary),
                ),
                if (companySummary.history.any((s) => s.status == 'paid')) ...[
                  const SizedBox(height: AppSpacing.md),
                  AppReveal(
                    delay: const Duration(milliseconds: 140),
                    child: _settlementHistorySection(companySummary.history),
                  ),
                ],
              ],
              const SizedBox(height: AppSpacing.lg),
              AppReveal(
                delay: const Duration(milliseconds: 160),
                child: _transactionsSection(filteredBookings),
              ),
            ],
          ),
        );
      },
    );
  }

  List<ProviderWorkspaceBooking> _ledgerBookings(
    List<ProviderWorkspaceBooking> bookings,
  ) {
    final filtered = bookings
        .where((booking) {
          final hasMoney =
              booking.providerNetAmount > 0 ||
              booking.quotedAmount > 0 ||
              booking.baseAmount > 0;
          // Only surface amounts once the payment is actually confirmed
          // received. paidAt is the real signal (set only when the provider
          // confirms cash receipt, or by a verified online payment).
          // _isCompletedStatus's set also includes 'final_payment_sent' and
          // 'cash_paid_by_user' — both pre-confirmation states in the cash
          // flow (the provider has only requested/the customer has only
          // claimed payment) — so those two are explicitly excluded here
          // rather than trusted as "show the money" on their own.
          final isConfirmedPaid =
              booking.paidAt.isNotEmpty ||
              (_isCompletedStatus(booking.bookingStatus) &&
                  booking.bookingStatus != 'final_payment_sent' &&
                  booking.bookingStatus != 'cash_paid_by_user');
          return hasMoney && isConfirmedPaid;
        })
        .toList(growable: true);

    filtered.sort((a, b) => _sortStampFor(b).compareTo(_sortStampFor(a)));
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
    return const Column(
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
          style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
        ),
      ],
    );
  }

  Widget _viewTabs() {
    return Container(
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
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
          const SizedBox(width: 8),
          _filterChip(
            label: 'This Week',
            selected: _selectedDateFilter == _PaymentsDateFilter.thisWeek,
            onTap: () {
              setState(() {
                _selectedDateFilter = _PaymentsDateFilter.thisWeek;
              });
            },
          ),
          const SizedBox(width: 8),
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
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? AppColors.primarySurface : AppColors.surface,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: selected ? AppColors.primary : AppColors.border,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(
                icon,
                size: 14,
                color: selected ? AppColors.primary : AppColors.textSecondary,
              ),
              const SizedBox(width: 6),
            ],
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: selected ? AppColors.primary : AppColors.textSecondary,
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
      borderRadius: BorderRadius.circular(_tileRadius - 2),
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        height: 42,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? AppColors.primary : AppColors.surfaceSoft,
          borderRadius: BorderRadius.circular(_tileRadius - 2),
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

  Widget _financialSummaryCard({
    required double gross,
    required double net,
    required double commission,
  }) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(_cardRadius),
        border: Border.all(color: AppColors.border),
        boxShadow: const [
          BoxShadow(
            color: AppColors.shadow,
            blurRadius: 16,
            offset: Offset(0, 6),
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
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            _selectedView == _PaymentsView.cash
                ? 'Cash collected by you. Commission is payable to the company.'
                : 'Online or other payment types recorded on your account.',
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 12,
              color: AppColors.textSecondary,
              height: 1.4,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          const Text(
            'Gross',
            style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 2),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              _currency(gross),
              maxLines: 1,
              style: const TextStyle(
                fontSize: 30,
                fontWeight: FontWeight.w900,
                color: AppColors.textPrimary,
                letterSpacing: -0.5,
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Container(height: 1, color: AppColors.divider),
          const SizedBox(height: AppSpacing.md),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _summaryStat(
                  label: 'Net to you',
                  value: _currency(net),
                  color: AppColors.success,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: _summaryStat(
                  label: _selectedView == _PaymentsView.cash
                      ? 'Commission Payable'
                      : 'Company Commission',
                  value: _currency(commission),
                  color: AppColors.warning,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _summaryStat({
    required String label,
    required String value,
    required Color color,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
        ),
        const SizedBox(height: 4),
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Text(
            value,
            maxLines: 1,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
        ),
      ],
    );
  }

  Widget _transactionsSection(List<ProviderWorkspaceBooking> filteredBookings) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(_cardRadius),
        border: Border.all(color: AppColors.border),
        boxShadow: const [
          BoxShadow(
            color: AppColors.shadow,
            blurRadius: 16,
            offset: Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Transactions',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          if (filteredBookings.isEmpty)
            EmptyState(
              title: _emptyTitle(),
              subtitle: _emptySubtitle(),
              icon: Icons.payments_outlined,
            )
          else
            Column(
              children: [
                for (var i = 0; i < filteredBookings.length; i++)
                  Padding(
                    padding: EdgeInsets.only(
                      bottom: i == filteredBookings.length - 1
                          ? 0
                          : AppSpacing.sm,
                    ),
                    child: _paymentRow(filteredBookings[i]),
                  ),
              ],
            ),
        ],
      ),
    );
  }

  String _emptyTitle() {
    return _selectedView == _PaymentsView.cash
        ? 'No cash payments'
        : 'No other payments';
  }

  String _emptySubtitle() {
    final view = _selectedView == _PaymentsView.cash ? 'cash' : 'other';
    return 'No $view payments for ${_dateFilterDescription()}.';
  }

  String _dateFilterDescription() {
    switch (_selectedDateFilter) {
      case _PaymentsDateFilter.today:
        return 'today';
      case _PaymentsDateFilter.thisWeek:
        return 'this week';
      case _PaymentsDateFilter.custom:
        final range = _customRange;
        return range == null
            ? 'the selected range'
            : 'the selected range (${_formatRange(range)})';
    }
  }

  Widget _companyPayableCard(ProviderCompanyPaymentSummary summary) {
    final latest = summary.latestSubmission;
    final isProcessing = latest != null && latest.status == 'processing';
    final showProcessing = summary.processingAmount > 0 || isProcessing;
    final showVerified = summary.verifiedAmount > 0;
    final isSettled = summary.payableAmount <= 0 && !isProcessing;
    final canSubmit = summary.payableAmount > 0 && !isProcessing;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(_cardRadius),
        border: Border.all(color: AppColors.border),
        boxShadow: const [
          BoxShadow(
            color: AppColors.shadow,
            blurRadius: 16,
            offset: Offset(0, 6),
          ),
        ],
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
                  color: AppColors.primarySurface,
                  borderRadius: BorderRadius.circular(_tileRadius - 2),
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
                      'Payable to Company',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Cash booking commission due from you.',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
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
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              _currency(summary.payableAmount),
              maxLines: 1,
              style: TextStyle(
                fontSize: 26,
                fontWeight: FontWeight.w900,
                color: isSettled ? AppColors.success : AppColors.textPrimary,
              ),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            isSettled ? "You're all settled" : 'Outstanding commission',
            style: TextStyle(
              fontSize: 12,
              fontWeight: isSettled ? FontWeight.w700 : FontWeight.w500,
              color: isSettled ? AppColors.success : AppColors.textSecondary,
            ),
          ),
          if (showProcessing) ...[
            const SizedBox(height: AppSpacing.sm),
            _settlementLineItem(
              icon: Icons.schedule_rounded,
              tone: AppColors.warning,
              toneSurface: AppColors.warningSurface,
              badgeLabel: 'Processing',
              description:
                  '${_currency(latest?.submittedAmount ?? summary.processingAmount)} awaiting admin verification',
            ),
          ],
          if (showVerified) ...[
            const SizedBox(height: AppSpacing.sm),
            _settlementLineItem(
              icon: Icons.verified_rounded,
              tone: AppColors.success,
              toneSurface: AppColors.successSurface,
              badgeLabel: 'Verified',
              description:
                  '${_currency(summary.verifiedAmount)} received by company',
            ),
          ],
          if (isProcessing) ...[
            const SizedBox(height: AppSpacing.md),
            _processingSubmissionDetail(latest),
          ],
          const SizedBox(height: AppSpacing.md),
          SizedBox(
            width: double.infinity,
            child: SwiperButton(
              label: 'Pay to Company',
              onPressed: canSubmit
                  ? () => _openCompanyPaymentDialog(summary.payableAmount)
                  : null,
            ),
          ),
          if (!canSubmit) ...[
            const SizedBox(height: 6),
            Text(
              isProcessing
                  ? 'A payment is already submitted and awaiting admin review.'
                  : 'No outstanding commission right now.',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
            ),
          ],
        ],
      ),
    );
  }

  Widget _settlementLineItem({
    required IconData icon,
    required Color tone,
    required Color toneSurface,
    required String badgeLabel,
    required String description,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: toneSurface,
        borderRadius: BorderRadius.circular(_tileRadius - 2),
        border: Border.all(color: tone.withValues(alpha: 0.35)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 16, color: tone),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: tone.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              badgeLabel,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                color: tone,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              description,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: tone,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _processingSubmissionDetail(ProviderCompanySubmission submission) {
    final submittedDate = DateTime.tryParse(submission.submittedAt);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surfaceSoft,
        borderRadius: BorderRadius.circular(_tileRadius - 2),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Payment submitted and awaiting admin verification.',
            style: TextStyle(
              fontSize: 12,
              color: AppColors.textSecondary,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'The official outstanding balance will update after verification.',
            style: TextStyle(
              fontSize: 11,
              color: AppColors.textMuted,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 12,
            runSpacing: 4,
            children: [
              if (submittedDate != null)
                Text(
                  'Submitted ${_shortDate(submittedDate)}',
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.textMuted,
                  ),
                ),
              if (submission.proofFileName.isNotEmpty)
                Text(
                  submission.proofFileName,
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.textMuted,
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _settlementHistorySection(List<ProviderCompanySubmission> history) {
    final verified = history
        .where((item) => item.status == 'paid')
        .toList(growable: false);
    if (verified.isEmpty) {
      return const SizedBox.shrink();
    }

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(_cardRadius),
        border: Border.all(color: AppColors.border),
        boxShadow: const [
          BoxShadow(
            color: AppColors.shadow,
            blurRadius: 16,
            offset: Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Recent Company Payments',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          for (var i = 0; i < verified.length; i++)
            Padding(
              padding: EdgeInsets.only(
                bottom: i == verified.length - 1 ? 0 : 8,
              ),
              child: _historyRow(verified[i]),
            ),
        ],
      ),
    );
  }

  Widget _historyRow(ProviderCompanySubmission submission) {
    final amount = submission.adminReceivedAmount ?? submission.submittedAmount;
    final rawDate = submission.reviewedAt.isNotEmpty
        ? submission.reviewedAt
        : submission.submittedAt;
    final date = DateTime.tryParse(rawDate);

    return Row(
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: const BoxDecoration(
            color: AppColors.success,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            _currency(amount),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
        ),
        const SizedBox(width: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: AppColors.successSurface,
            borderRadius: BorderRadius.circular(999),
          ),
          child: const Text(
            'Verified',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w800,
              color: AppColors.success,
            ),
          ),
        ),
        if (date != null) ...[
          const SizedBox(width: 8),
          Text(
            _shortDate(date),
            style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
          ),
        ],
      ],
    );
  }

  Widget _paymentRow(ProviderWorkspaceBooking booking) {
    final customerName = booking.customerName.trim().isEmpty
        ? 'Customer'
        : booking.customerName.trim();
    final subtitle = booking.serviceLabel.trim().isEmpty
        ? booking.statusLabel
        : booking.serviceLabel.trim();
    final isCash = _PaymentsView.cash.matches(booking.paymentOption);
    final date = DateTime.tryParse(_sortStampFor(booking));

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.surfaceSoft,
        borderRadius: BorderRadius.circular(_tileRadius),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  customerName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 6),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (date != null) ...[
                      Text(
                        _shortDate(date),
                        style: const TextStyle(
                          fontSize: 11,
                          color: AppColors.textMuted,
                        ),
                      ),
                      const SizedBox(width: 8),
                    ],
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: isCash
                            ? AppColors.successSurface
                            : AppColors.infoSurface,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        _paymentOptionLabel(booking.paymentOption),
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: isCash ? AppColors.success : AppColors.info,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Text(
            _currency(booking.providerNetAmount),
            maxLines: 1,
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
          DateTimeRange(start: now.subtract(const Duration(days: 6)), end: now),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: Theme.of(
              context,
            ).colorScheme.copyWith(primary: AppColors.primary),
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

  // Amount is fixed to the exact current payable amount — the backend
  // rejects any deposited amount that doesn't match exactly, so the form
  // never invites the provider to type an arbitrary figure.
  Future<void> _openCompanyPaymentDialog(double payableAmount) async {
    if (payableAmount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No company payment is due right now.')),
      );
      return;
    }

    PickedBrowserFile? slip;
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
                borderRadius: BorderRadius.circular(24),
              ),
              child: Container(
                padding: const EdgeInsets.all(AppSpacing.lg),
                decoration: BoxDecoration(
                  color: AppColors.surfaceSoft,
                  borderRadius: BorderRadius.circular(24),
                ),
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text(
                        'Pay to Company',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Upload proof of the transfer for the exact amount below. Admin will verify it manually.',
                        style: TextStyle(
                          fontSize: 13,
                          color: AppColors.textSecondary,
                          height: 1.45,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      _dialogLabel('Amount to Company'),
                      const SizedBox(height: 8),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.md,
                          vertical: 14,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.primarySurface,
                          borderRadius: BorderRadius.circular(_tileRadius),
                          border: Border.all(
                            color: AppColors.primary.withValues(alpha: 0.3),
                          ),
                        ),
                        child: Text(
                          _currency(payableAmount),
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      _dialogLabel('Payment Proof'),
                      const SizedBox(height: 8),
                      InkWell(
                        borderRadius: BorderRadius.circular(_tileRadius),
                        onTap: pickSlip,
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(AppSpacing.md),
                          decoration: BoxDecoration(
                            color: AppColors.surface,
                            borderRadius: BorderRadius.circular(_tileRadius),
                            border: Border.all(color: AppColors.border),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 44,
                                height: 44,
                                decoration: BoxDecoration(
                                  color: AppColors.primarySurface,
                                  borderRadius: BorderRadius.circular(
                                    _tileRadius - 2,
                                  ),
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
                                      slip == null ? 'Choose File' : slip!.name,
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
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
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
                                foregroundColor: AppColors.primary,
                                side: const BorderSide(color: AppColors.border),
                                padding: const EdgeInsets.symmetric(
                                  vertical: 14,
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(
                                    _tileRadius,
                                  ),
                                ),
                              ),
                              child: const Text('Cancel'),
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: SwiperButton(
                              label: 'Submit Payment',
                              isLoading: submitting,
                              onPressed: submitting
                                  ? null
                                  : () async {
                                      if (slip == null) {
                                        setDialogState(() {
                                          error =
                                              'Attach the payment proof first.';
                                        });
                                        return;
                                      }

                                      setDialogState(() {
                                        submitting = true;
                                        error = '';
                                      });

                                      ProviderCompanyPaymentSummary?
                                      refreshedSummary;
                                      try {
                                        refreshedSummary =
                                            await _workspaceService
                                                .submitCompanyPayment(
                                                  amount: payableAmount,
                                                  proofDataUrl: slip!.dataUrl,
                                                  proofFileName: slip!.name,
                                                  proofMimeType: slip!.mimeType,
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

                                      if (refreshedSummary != null) {
                                        setState(() {
                                          _companySummaryOverride =
                                              refreshedSummary;
                                        });
                                      }
                                      Navigator.of(dialogContext).pop(true);
                                    },
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

    if (submitted == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Payment submitted. Status: Processing — waiting for admin '
            'verification. The official outstanding balance will update '
            'after verification.',
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
        final end = DateTime(range.end.year, range.end.month, range.end.day);
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

enum _PaymentsDateFilter { today, thisWeek, custom }
