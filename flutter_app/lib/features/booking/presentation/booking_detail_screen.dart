import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/config/app_config.dart';
import '../../../services/booking_overview_service.dart';
import '../../../services/browser_file_picker.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/loading_state.dart';
import '../../../widgets/swiper_app_bar.dart';
import '../../../widgets/swiper_button.dart';

class BookingDetailScreen extends StatefulWidget {
  const BookingDetailScreen({super.key});

  @override
  State<BookingDetailScreen> createState() => _BookingDetailScreenState();
}

class _BookingDetailScreenState extends State<BookingDetailScreen> {
  static const _bookingService = BookingOverviewService();
  static const _reviewTags = <String>[
    'Punctual',
    'Professional',
    'Friendly',
    'Quality',
    'Clean & Tidy',
  ];

  String? _bookingId;
  CustomerBookingDetail? _booking;
  String? _errorMessage;
  bool _isLoading = true;
  bool _isRefreshing = false;
  bool _isSubmittingPayment = false;
  bool _isSubmittingReview = false;
  bool _isSubmittingIssue = false;
  PickedBrowserFile? _paymentProof;
  final TextEditingController _messageController = TextEditingController();
  final List<_BookingChatMessage> _messages = <_BookingChatMessage>[];
  DateTime? _lastUpdatedAt;
  Timer? _pollTimer;
  bool _didReadRoute = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_didReadRoute) {
      return;
    }

    _didReadRoute = true;
    _bookingId = ModalRoute.of(context)?.settings.arguments as String?;
    unawaited(_loadBooking());
    _pollTimer = Timer.periodic(
      const Duration(seconds: 5),
      (_) => unawaited(_loadBooking(silent: true)),
    );
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _messageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const SwiperAppBar(
        title: 'User Task Path',
        subtitle: 'Track service progress',
        showBack: true,
      ),
      body: _buildBody(context),
    );
  }

  Widget _buildBody(BuildContext context) {
    if (_bookingId == null) {
      return const EmptyState(
        title: 'Booking not found',
        subtitle: 'Please open this screen from your bookings list.',
        icon: Icons.receipt_long_outlined,
      );
    }

    if (_isLoading) {
      return const LoadingState(label: 'Loading booking...');
    }

    if (_errorMessage != null && _booking == null) {
      return const EmptyState(
        title: 'Unable to load booking',
        subtitle: 'Unable to load booking details. Please try again.',
        icon: Icons.error_outline_rounded,
      );
    }

    final booking = _booking;
    if (booking == null) {
      return const EmptyState(
        title: 'Booking not found',
        subtitle: 'We could not find this booking for the signed-in user.',
        icon: Icons.receipt_long_outlined,
      );
    }

    final paymentMarkedPaid =
        booking.paymentStatus.trim().toLowerCase() == 'paid' ||
        const <String>[
          'cash_paid_by_user',
          'payment_received_by_provider',
          'completed',
        ].contains(booking.workflowStatus);
    final canPayNow =
        booking.workflowStatus == 'final_payment_sent' && !paymentMarkedPaid;
    final canReview =
        const <String>[
          'cash_paid_by_user',
          'payment_received_by_provider',
          'completed',
        ].contains(booking.workflowStatus) &&
        booking.userReviewStatus != 'submitted';
    final isTaskCompleted = booking.workflowStatus == 'completed';

    return RefreshIndicator(
      onRefresh: _loadBooking,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: AppSpacing.screenPadding,
        children: [
          _buildHeroCard(context, booking),
          const SizedBox(height: AppSpacing.lg),
          _buildRefreshBanner(),
          if (_errorMessage != null) ...[
            const SizedBox(height: AppSpacing.md),
            _InlineNotice(
              message: _errorMessage!,
              tone: AppColors.error,
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          for (var index = 0; index < booking.activitySteps.length; index++) ...[
            _TaskStepCard(
              number: index + 1,
              title: booking.activitySteps[index].label,
              state: booking.activitySteps[index].status,
              subtitle: _stepSubtitle(booking, index),
              child: index == 9 && canReview
                  ? Padding(
                      padding: const EdgeInsets.only(top: AppSpacing.md),
                      child: SwiperButton(
                        label: 'Review This Service',
                        onPressed: _isSubmittingReview
                            ? null
                            : () => _openReviewSheet(booking),
                        isLoading: _isSubmittingReview,
                      ),
                    )
                  : null,
            ),
            if (index != booking.activitySteps.length - 1) ...[
              _TaskStepConnector(state: booking.activitySteps[index].status),
              const SizedBox(height: AppSpacing.sm),
            ] else
              const SizedBox(height: AppSpacing.md),
          ],
          _buildProviderSummaryCard(context, booking),
          const SizedBox(height: AppSpacing.md),
          _buildPaymentSection(
            context,
            booking,
            canPayNow: canPayNow,
            paymentMarkedPaid: paymentMarkedPaid,
            canReview: canReview,
          ),
          const SizedBox(height: AppSpacing.md),
          _buildMessageSection(context, booking, isTaskCompleted: isTaskCompleted),
          if (isTaskCompleted) ...[
            const SizedBox(height: AppSpacing.md),
            _buildIssueSection(context, booking),
          ],
        ],
      ),
    );
  }

  Future<void> _loadBooking({bool silent = false}) async {
    final bookingId = _bookingId;
    if (bookingId == null) {
      return;
    }

    if (mounted) {
      setState(() {
        if (silent) {
          _isRefreshing = true;
        } else {
          _isLoading = true;
        }
      });
    }

    try {
      final booking = await _bookingService.fetchBookingDetail(bookingId);
      if (!mounted) {
        return;
      }

      setState(() {
        _booking = booking;
        _errorMessage = null;
        _lastUpdatedAt = DateTime.now();
      });
    } catch (error, stackTrace) {
      if (kDebugMode) {
        debugPrint('Booking detail refresh failed: $error');
        debugPrintStack(stackTrace: stackTrace);
      }
      if (!mounted) {
        return;
      }
      setState(() {
        _errorMessage = 'Unable to load booking details. Please try again.';
      });
    } finally {
      if (!mounted) {
        return;
      }
      setState(() {
        _isLoading = false;
        _isRefreshing = false;
      });
    }
  }

  Widget _buildHeroCard(
    BuildContext context,
    CustomerBookingDetail booking,
  ) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.primary, AppColors.primaryDeep],
        ),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        children: [
          const Text(
            'DELLA',
            style: TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w900,
              letterSpacing: 4,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'USER TASK PATH',
            style: TextStyle(
              color: Colors.white,
              fontSize: 28,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            booking.statusLabel,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 14,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            booking.schedule,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white70),
          ),
        ],
      ),
    );
  }

  Widget _buildRefreshBanner() {
    final label = _lastUpdatedAt == null
        ? 'Live refresh is enabled.'
        : 'Live refresh every 5 seconds. Last updated ${DateFormat('h:mm:ss a').format(_lastUpdatedAt!)}';

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: AppColors.primarySoft,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          const Icon(Icons.sync_rounded, color: AppColors.primary, size: 18),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          if (_isRefreshing)
            const SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
        ],
      ),
    );
  }

  String _stepSubtitle(CustomerBookingDetail booking, int index) {
    final dates = <String>[
      booking.createdAt,
      booking.acceptedAt,
      booking.onTheWayAt,
      booking.arrivedAt,
      booking.workFinishedAt.isNotEmpty
          ? booking.workFinishedAt
          : booking.workConfirmedByUserAt,
      booking.paymentSentAt,
      booking.cashPaidByUserAt,
      booking.paymentReceivedByProviderAt,
      booking.completedAt,
      booking.userReviewStatus == 'submitted'
          ? booking.completedAt
          : '',
    ];

    return dates.length > index && dates[index].trim().isNotEmpty
        ? dates[index]
        : 'Waiting';
  }

  Widget _buildProviderSummaryCard(
    BuildContext context,
    CustomerBookingDetail booking,
  ) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 60,
                height: 60,
                decoration: const BoxDecoration(
                  color: AppColors.primarySoft,
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Text(
                  booking.providerFullName.isNotEmpty
                      ? booking.providerFullName.characters.first.toUpperCase()
                      : 'P',
                  style: const TextStyle(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w900,
                    fontSize: 24,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      booking.providerFullName,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.w900,
                          ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      booking.service,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: AppColors.textSecondary,
                          ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          _summaryTile(Icons.calendar_today_rounded, booking.schedule),
          _summaryTile(Icons.place_outlined, booking.location),
          _summaryTile(Icons.wallet_outlined, booking.paymentAmountLabel, emphasize: true),
          _summaryTile(Icons.payments_outlined, booking.paymentMethod),
        ],
      ),
    );
  }

  Widget _buildPaymentSection(
    BuildContext context,
    CustomerBookingDetail booking, {
    required bool canPayNow,
    required bool paymentMarkedPaid,
    required bool canReview,
  }) {
    final paymentTone = canPayNow
        ? AppColors.warning
        : paymentMarkedPaid
            ? AppColors.success
            : AppColors.primary;
    final paymentLabel = paymentMarkedPaid
        ? 'Payment Done'
        : canPayNow
            ? 'Awaiting Customer Payment'
            : canReview
                ? 'Task Completed'
                : 'Awaiting Payment';

    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Payment Proof Actions',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: paymentTone.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: paymentTone.withValues(alpha: 0.25)),
                ),
                child: Text(
                  paymentLabel,
                  style: TextStyle(
                    color: paymentTone,
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Payment method: ${booking.paymentMethod}',
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          if (canPayNow) ...[
            if (_paymentProof != null)
              _SelectedFileCard(
                title: 'Customer Payment Proof',
                fileName: _paymentProof!.name,
                mimeType: _paymentProof!.mimeType,
              ),
            Row(
              children: [
                Expanded(
                  child: SwiperButton(
                    label: _paymentProof == null ? 'Attach Proof' : 'Change Proof',
                    isSecondary: true,
                    onPressed: _pickPaymentProof,
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: SwiperButton(
                    label: 'Mark Cash Paid',
                    isLoading: _isSubmittingPayment,
                    onPressed: _isSubmittingPayment
                        ? null
                        : () => _confirmCashPayment(booking),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
          ],
          if (booking.customerPaymentProofDataUrl.isNotEmpty)
            _ProofPreviewCard(
              title: 'Customer Payment Proof',
              dataUrl: booking.customerPaymentProofDataUrl,
              fileName: booking.customerPaymentProofFileName,
              mimeType: booking.customerPaymentProofMimeType,
            ),
          if (booking.customerPaymentProofDataUrl.isNotEmpty &&
              booking.providerCompanyPaymentProofDataUrl.isNotEmpty)
            const SizedBox(height: AppSpacing.sm),
          if (booking.providerCompanyPaymentProofDataUrl.isNotEmpty)
            _ProofPreviewCard(
              title: 'Provider Company Payment Proof',
              dataUrl: booking.providerCompanyPaymentProofDataUrl,
              fileName: booking.providerCompanyPaymentProofFileName,
              mimeType: booking.providerCompanyPaymentProofMimeType,
            ),
        ],
      ),
    );
  }

  Widget _buildIssueSection(
    BuildContext context,
    CustomerBookingDetail booking,
  ) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Booking Issue Report',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w900,
                ),
          ),
          const SizedBox(height: AppSpacing.sm),
          const Text(
            'Report a task issue using the same backend report flow as the web app.',
            style: TextStyle(
              color: AppColors.textSecondary,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          SwiperButton(
            label: 'Report Booking Issue',
            isSecondary: true,
            isLoading: _isSubmittingIssue,
            onPressed: _isSubmittingIssue
                ? null
                : () => _openIssueReportSheet(booking),
          ),
        ],
      ),
    );
  }

  Widget _buildMessageSection(
    BuildContext context,
    CustomerBookingDetail booking, {
    required bool isTaskCompleted,
  }) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Live message',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            isTaskCompleted
                ? 'Messaging is closed because this task is completed.'
                : 'Send live updates to the provider while this task is active.',
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Container(
            constraints: const BoxConstraints(minHeight: 120),
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppColors.border),
              color: const Color(0xFFFDFCFF),
            ),
            child: _messages.isEmpty
                ? Text(
                    isTaskCompleted
                        ? 'No messages were sent for this booking.'
                        : 'Start the conversation with Maya Suri here.',
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  )
                : Column(
                    children: [
                      for (final message in _messages) ...[
                        Align(
                          alignment: message.isUser
                              ? Alignment.centerRight
                              : Alignment.centerLeft,
                          child: Container(
                            margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                            padding: const EdgeInsets.symmetric(
                              horizontal: AppSpacing.md,
                              vertical: AppSpacing.sm,
                            ),
                            decoration: BoxDecoration(
                              color: message.isUser
                                  ? AppColors.primarySoft
                                  : Colors.white,
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  message.text,
                                  style: const TextStyle(
                                    color: AppColors.textPrimary,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  DateFormat('h:mm a').format(message.sentAt),
                                  style: const TextStyle(
                                    color: AppColors.textSecondary,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
          ),
          const SizedBox(height: AppSpacing.sm),
          TextField(
            controller: _messageController,
            minLines: 2,
            maxLines: 4,
            enabled: !isTaskCompleted,
            decoration: InputDecoration(
              hintText: isTaskCompleted
                  ? 'Messaging closed after task completion.'
                  : 'Type your message here...',
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Expanded(
                child: SwiperButton(
                  label: 'Attach File',
                  isSecondary: true,
                  onPressed: isTaskCompleted
                      ? null
                      : () {
                          _showNotice(
                            'File sharing for live message will be connected next.',
                          );
                        },
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: SwiperButton(
                  label: 'Send',
                  onPressed: isTaskCompleted ? null : () => _sendMessage(booking),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _sendMessage(CustomerBookingDetail booking) {
    final text = _messageController.text.trim();
    if (text.isEmpty) {
      _showNotice('Please type a message first.');
      return;
    }

    setState(() {
      _messages.add(
        _BookingChatMessage(
          text: text,
          sentAt: DateTime.now(),
          isUser: true,
        ),
      );
      _messageController.clear();
    });

    _showNotice('Message sent to ${booking.providerFullName}.');
  }

  Future<void> _pickPaymentProof() async {
    final file = await pickSingleBrowserFile();
    if (!mounted || file == null) {
      return;
    }

    setState(() {
      _paymentProof = file;
    });
  }

  Future<void> _confirmCashPayment(CustomerBookingDetail booking) async {
    setState(() {
      _isSubmittingPayment = true;
    });

    try {
      await _bookingService.confirmCashPayment(
        booking.id,
        proofDataUrl: _paymentProof?.dataUrl,
        proofFileName: _paymentProof?.name,
        proofMimeType: _paymentProof?.mimeType,
      );
      _showNotice('Cash payment confirmed successfully.');
      setState(() {
        _paymentProof = null;
      });
      await _loadBooking(silent: true);
    } catch (error) {
      _showNotice(error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (!mounted) {
        return;
      }
      setState(() {
        _isSubmittingPayment = false;
      });
    }
  }

  Future<void> _openIssueReportSheet(CustomerBookingDetail booking) async {
    final controller = TextEditingController();
    var localError = '';

    final shouldSubmit = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                left: AppSpacing.md,
                right: AppSpacing.md,
                bottom: MediaQuery.of(context).viewInsets.bottom + AppSpacing.md,
              ),
              child: Container(
                padding: const EdgeInsets.all(AppSpacing.lg),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(28),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Report Booking Issue',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    const Text(
                      'Describe the issue and we will submit it through the same report endpoint used by the web app.',
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    TextField(
                      controller: controller,
                      minLines: 4,
                      maxLines: 6,
                      decoration: const InputDecoration(
                        hintText: 'Explain the issue with this booking.',
                      ),
                    ),
                    if (localError.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        localError,
                        style: const TextStyle(
                          color: AppColors.error,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                    const SizedBox(height: AppSpacing.md),
                    Row(
                      children: [
                        Expanded(
                          child: SwiperButton(
                            label: 'Cancel',
                            isSecondary: true,
                            onPressed: () => Navigator.of(sheetContext).pop(false),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: SwiperButton(
                            label: 'Send Report',
                            onPressed: () {
                              if (controller.text.trim().isEmpty) {
                                setModalState(() {
                                  localError =
                                      'Please describe the issue before sending.';
                                });
                                return;
                              }
                              Navigator.of(sheetContext).pop(true);
                            },
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );

    if (shouldSubmit != true) {
      controller.dispose();
      return;
    }

    setState(() {
      _isSubmittingIssue = true;
    });

    try {
      await _bookingService.submitIssueReport(
        booking,
        message: controller.text.trim(),
      );
      _showNotice('Issue report submitted successfully.');
    } catch (error) {
      _showNotice(error.toString().replaceFirst('Exception: ', ''));
    } finally {
      controller.dispose();
      if (!mounted) {
        return;
      }
      setState(() {
        _isSubmittingIssue = false;
      });
    }
  }

  Future<void> _openReviewSheet(CustomerBookingDetail booking) async {
    var rating = 5;
    var recommend = true;
    var localError = '';
    final selectedTags = <String>{};
    final photos = <PickedBrowserFile>[];
    final commentController = TextEditingController();

    final shouldSubmit = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            Future<void> pickPhotos() async {
              final newFiles = await pickMultipleBrowserFiles(maxFiles: 4);
              if (newFiles.isEmpty) {
                return;
              }
              setModalState(() {
                photos
                  ..clear()
                  ..addAll(newFiles.take(4));
              });
            }

            return Padding(
              padding: EdgeInsets.only(
                left: AppSpacing.md,
                right: AppSpacing.md,
                bottom: MediaQuery.of(context).viewInsets.bottom + AppSpacing.md,
              ),
              child: Container(
                padding: const EdgeInsets.all(AppSpacing.lg),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(28),
                ),
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text(
                        'Review This Service',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        booking.providerFullName,
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      const Text(
                        'Your rating',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Row(
                        children: List.generate(5, (index) {
                          final starValue = index + 1;
                          return IconButton(
                            onPressed: () {
                              setModalState(() {
                                rating = starValue;
                              });
                            },
                            icon: Icon(
                              Icons.star_rounded,
                              color: starValue <= rating
                                  ? const Color(0xFFF5B400)
                                  : AppColors.border,
                              size: 32,
                            ),
                          );
                        }),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      const Text(
                        'What did you like?',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Wrap(
                        spacing: AppSpacing.xs,
                        runSpacing: AppSpacing.xs,
                        children: _reviewTags.map((tag) {
                          final active = selectedTags.contains(tag);
                          return FilterChip(
                            label: Text(tag),
                            selected: active,
                            onSelected: (_) {
                              setModalState(() {
                                if (active) {
                                  selectedTags.remove(tag);
                                } else {
                                  selectedTags.add(tag);
                                }
                              });
                            },
                          );
                        }).toList(growable: false),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      SwitchListTile.adaptive(
                        value: recommend,
                        contentPadding: EdgeInsets.zero,
                        title: const Text(
                          'Recommend this provider',
                          style: TextStyle(fontWeight: FontWeight.w800),
                        ),
                        onChanged: (value) {
                          setModalState(() {
                            recommend = value;
                          });
                        },
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      TextField(
                        controller: commentController,
                        minLines: 4,
                        maxLines: 6,
                        maxLength: 200,
                        decoration: const InputDecoration(
                          hintText: 'Great service! Very professional.',
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Row(
                        children: [
                          Expanded(
                            child: SwiperButton(
                              label: photos.isEmpty
                                  ? 'Upload Review Photos'
                                  : 'Change Review Photos',
                              isSecondary: true,
                              onPressed: pickPhotos,
                            ),
                          ),
                        ],
                      ),
                      if (photos.isNotEmpty) ...[
                        const SizedBox(height: AppSpacing.sm),
                        Wrap(
                          spacing: AppSpacing.sm,
                          runSpacing: AppSpacing.sm,
                          children: photos
                              .map(
                                (file) => _SelectedFileCard(
                                  title: 'Photo',
                                  fileName: file.name,
                                  mimeType: file.mimeType,
                                  compact: true,
                                ),
                              )
                              .toList(growable: false),
                        ),
                      ],
                      if (localError.isNotEmpty) ...[
                        const SizedBox(height: AppSpacing.sm),
                        Text(
                          localError,
                          style: const TextStyle(
                            color: AppColors.error,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                      const SizedBox(height: AppSpacing.md),
                      Row(
                        children: [
                          Expanded(
                            child: SwiperButton(
                              label: 'Cancel',
                              isSecondary: true,
                              onPressed: () => Navigator.of(sheetContext).pop(false),
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: SwiperButton(
                              label: 'Submit Review',
                              onPressed: () {
                                if (rating < 1 || rating > 5) {
                                  setModalState(() {
                                    localError = 'Please select a rating.';
                                  });
                                  return;
                                }
                                Navigator.of(sheetContext).pop(true);
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

    if (shouldSubmit != true) {
      commentController.dispose();
      return;
    }

    setState(() {
      _isSubmittingReview = true;
    });

    try {
      await _bookingService.submitReview(
        booking.id,
        rating: rating,
        comment: commentController.text.trim(),
        photos: photos.map((file) => file.dataUrl).toList(growable: false),
        tags: selectedTags.toList(growable: false),
        recommend: recommend,
      );
      _showNotice('Review submitted successfully.');
      await _loadBooking(silent: true);
    } catch (error) {
      _showNotice(error.toString().replaceFirst('Exception: ', ''));
    } finally {
      commentController.dispose();
      if (!mounted) {
        return;
      }
      setState(() {
        _isSubmittingReview = false;
      });
    }
  }

  Widget _summaryTile(
    IconData icon,
    String text, {
    bool emphasize = false,
  }) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: const BoxDecoration(
              color: AppColors.primarySoft,
              borderRadius: BorderRadius.all(Radius.circular(14)),
            ),
            child: Icon(icon, color: AppColors.primary),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: emphasize ? 18 : 14,
                fontWeight: emphasize ? FontWeight.w900 : FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showNotice(String message) {
    if (!mounted) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }
}

class _TaskStepCard extends StatelessWidget {
  const _TaskStepCard({
    required this.number,
    required this.title,
    required this.state,
    required this.subtitle,
    this.child,
  });

  final int number;
  final String title;
  final String state;
  final String subtitle;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    final tone = switch (state) {
      'done' => const Color(0xFF16A34A),
      'current' => AppColors.primary,
      _ => const Color(0xFFF59E0B),
    };
    final stateIcon = switch (state) {
      'done' => Icons.check_circle_rounded,
      'current' => Icons.radio_button_checked_rounded,
      _ => Icons.schedule_rounded,
    };
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: AppColors.primarySoft,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.border),
                ),
                alignment: Alignment.center,
                child: Text(
                  '$number',
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    color: AppColors.primary,
                  ),
                ),
              ),
            ],
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
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              '$number. $title',
                              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                    fontWeight: FontWeight.w800,
                                    height: 1.2,
                                  ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Icon(
                            stateIcon,
                            color: tone,
                            size: 18,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  subtitle,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w600,
                      ),
                ),
                if (child != null) child!,
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TaskStepConnector extends StatefulWidget {
  const _TaskStepConnector({required this.state});

  final String state;

  @override
  State<_TaskStepConnector> createState() => _TaskStepConnectorState();
}

class _TaskStepConnectorState extends State<_TaskStepConnector>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final baseColor = widget.state == 'done'
        ? const Color(0xFF86EFAC)
        : const Color(0xFFD1FAE5);
    final glowColor = widget.state == 'done'
        ? const Color(0xFF16A34A)
        : const Color(0xFF4ADE80);

    return Padding(
      padding: const EdgeInsets.only(left: 27),
      child: SizedBox(
        width: 12,
        height: 46,
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, child) {
            final runnerY = (_controller.value * 2) - 1;
            return Stack(
              alignment: Alignment.center,
              children: [
                Container(
                  width: 2.5,
                  height: double.infinity,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(999),
                    color: baseColor,
                  ),
                ),
                Align(
                  alignment: Alignment(0, runnerY),
                  child: Container(
                    width: 22,
                    height: 24,
                    alignment: Alignment.center,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        boxShadow: [
                          BoxShadow(
                            color: glowColor.withValues(alpha: 0.28),
                            blurRadius: 10,
                            spreadRadius: 0.8,
                          ),
                        ],
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.keyboard_arrow_down_rounded,
                            color: glowColor,
                            size: 18,
                          ),
                          Transform.translate(
                            offset: const Offset(0, -8),
                            child: Icon(
                              Icons.keyboard_arrow_down_rounded,
                              color: glowColor.withValues(alpha: 0.85),
                              size: 18,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _BookingChatMessage {
  const _BookingChatMessage({
    required this.text,
    required this.sentAt,
    required this.isUser,
  });

  final String text;
  final DateTime sentAt;
  final bool isUser;
}

class _InlineNotice extends StatelessWidget {
  const _InlineNotice({
    required this.message,
    required this.tone,
  });

  final String message;
  final Color tone;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: tone.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: tone.withValues(alpha: 0.18)),
      ),
      child: Text(
        message,
        style: TextStyle(
          color: tone,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _SelectedFileCard extends StatelessWidget {
  const _SelectedFileCard({
    required this.title,
    required this.fileName,
    required this.mimeType,
    this.compact = false,
  });

  final String title;
  final String fileName;
  final String mimeType;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: compact ? 132 : double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.primarySoft,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            mimeType == 'application/pdf'
                ? Icons.picture_as_pdf_outlined
                : Icons.image_outlined,
            color: AppColors.primary,
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            title,
            style: const TextStyle(
              fontSize: 11,
              color: AppColors.textSecondary,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            fileName,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _ProofPreviewCard extends StatelessWidget {
  const _ProofPreviewCard({
    required this.title,
    required this.dataUrl,
    required this.fileName,
    required this.mimeType,
  });

  final String title;
  final String dataUrl;
  final String fileName;
  final String mimeType;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surfaceMuted,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w800,
            ),
          ),
          if (fileName.trim().isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              fileName,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.sm),
          _ProofMedia(
            dataUrl: dataUrl,
            mimeType: mimeType,
          ),
        ],
      ),
    );
  }
}

class _ProofMedia extends StatelessWidget {
  const _ProofMedia({
    required this.dataUrl,
    required this.mimeType,
  });

  final String dataUrl;
  final String mimeType;

  @override
  Widget build(BuildContext context) {
    if (mimeType == 'application/pdf' || dataUrl.toLowerCase().startsWith('data:application/pdf')) {
      return Container(
        height: 108,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border),
        ),
        child: const Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.picture_as_pdf_outlined, color: AppColors.primary, size: 34),
              SizedBox(height: AppSpacing.xs),
              Text(
                'PDF proof uploaded',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      );
    }

    final bytes = _tryDecodeDataImage(dataUrl);
    if (bytes != null) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Image.memory(
          bytes,
          height: 180,
          width: double.infinity,
          fit: BoxFit.cover,
        ),
      );
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: Image.network(
        _resolveUrl(dataUrl),
        height: 180,
        width: double.infinity,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) {
          return Container(
            height: 180,
            color: Colors.white,
            alignment: Alignment.center,
            child: const Text(
              'Payment proof preview unavailable',
              style: TextStyle(
                color: AppColors.textSecondary,
                fontWeight: FontWeight.w700,
              ),
            ),
          );
        },
      ),
    );
  }

  static Uint8List? _tryDecodeDataImage(String value) {
    if (!value.startsWith('data:image/')) {
      return null;
    }
    final commaIndex = value.indexOf(',');
    if (commaIndex == -1 || commaIndex + 1 >= value.length) {
      return null;
    }
    try {
      return base64Decode(value.substring(commaIndex + 1));
    } catch (_) {
      return null;
    }
  }

  static String _resolveUrl(String value) {
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }
    if (value.startsWith('/')) {
      return '${AppConfig.appBaseUrl}$value';
    }
    return '${AppConfig.appBaseUrl}/$value';
  }
}
