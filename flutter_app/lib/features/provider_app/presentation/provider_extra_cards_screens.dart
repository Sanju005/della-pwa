import 'package:flutter/material.dart';

import '../../../services/browser_file_picker.dart';
import '../../../services/provider_workspace_service.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/loading_state.dart';
import '../../../widgets/swiper_app_bar.dart';

Widget _panel({required Widget child}) {
  return Container(
    padding: const EdgeInsets.all(AppSpacing.md),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(24),
      border: Border.all(color: AppColors.border),
      boxShadow: const [
        BoxShadow(
          color: AppColors.shadow,
          blurRadius: 24,
          offset: Offset(0, 10),
        ),
      ],
    ),
    child: child,
  );
}

Widget _panelNotice(String text, Color color, Color background) {
  return Container(
    padding: const EdgeInsets.symmetric(
      horizontal: AppSpacing.md,
      vertical: AppSpacing.sm,
    ),
    decoration: BoxDecoration(
      color: background,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: color.withValues(alpha: 0.25)),
    ),
    child: Text(
      text,
      style: TextStyle(color: color, fontWeight: FontWeight.w600),
    ),
  );
}

InputDecoration _panelFieldDecoration(String label, {IconData? prefixIcon}) {
  return InputDecoration(
    labelText: label,
    prefixIcon: prefixIcon == null
        ? null
        : Icon(prefixIcon, size: 20, color: AppColors.primary),
    filled: true,
    fillColor: Colors.white,
    contentPadding: const EdgeInsets.symmetric(
      horizontal: AppSpacing.md,
      vertical: AppSpacing.md,
    ),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(AppSpacing.lg),
      borderSide: BorderSide(color: AppColors.primary.withValues(alpha: 0.14)),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(AppSpacing.lg),
      borderSide: BorderSide(color: AppColors.primary.withValues(alpha: 0.14)),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(AppSpacing.lg),
      borderSide: const BorderSide(color: AppColors.primary, width: 1.4),
    ),
  );
}

/// Emergency contact — split out of Personal Details into its own card so a
/// provider can view/update it independently.
class ProviderEmergencyContactScreen extends StatefulWidget {
  const ProviderEmergencyContactScreen({super.key});

  @override
  State<ProviderEmergencyContactScreen> createState() =>
      _ProviderEmergencyContactScreenState();
}

class _ProviderEmergencyContactScreenState
    extends State<ProviderEmergencyContactScreen> {
  static const _service = ProviderWorkspaceService();

  late Future<ProviderWorkspaceProfile> _future;
  final _controller = TextEditingController();
  String _seed = '';
  bool _saving = false;
  String _message = '';
  String _error = '';

  @override
  void initState() {
    super.initState();
    _future = _service.fetchProfile();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _seedState(ProviderWorkspaceProfile profile) {
    if (_seed == profile.emergencyContactNumber) {
      return;
    }
    _seed = profile.emergencyContactNumber;
    _controller.text = profile.emergencyContactNumber;
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _message = '';
      _error = '';
    });
    try {
      await _service.updateProfile(
        emergencyContactNumber: _controller.text.trim(),
      );
      if (!mounted) {
        return;
      }
      setState(() {
        _future = _service.fetchProfile();
        _message = 'Emergency contact saved.';
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _error = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const SwiperAppBar(
        title: 'Emergency Contact',
        subtitle: 'A number we can reach in an emergency',
        showBack: true,
      ),
      body: FutureBuilder<ProviderWorkspaceProfile>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const LoadingState(label: 'Loading emergency contact...');
          }
          if (snapshot.hasError || snapshot.data == null) {
            return const EmptyState(
              title: 'Unable to load emergency contact',
              subtitle: 'Please try again.',
              icon: Icons.error_outline_rounded,
            );
          }

          _seedState(snapshot.data!);

          return ListView(
            padding: AppSpacing.screenPadding,
            children: [
              _panel(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFF1F2),
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: const Icon(
                            Icons.emergency_share_outlined,
                            color: AppColors.error,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          child: Text(
                            'Kept on file for emergencies during a job. Not shown to customers.',
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: AppColors.textSecondary),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    TextField(
                      controller: _controller,
                      keyboardType: TextInputType.phone,
                      decoration: _panelFieldDecoration(
                        'Emergency Contact Number',
                        prefixIcon: Icons.contact_phone_outlined,
                      ),
                    ),
                    if (_error.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.md),
                      _panelNotice(
                        _error,
                        AppColors.error,
                        const Color(0xFFFFF1F2),
                      ),
                    ],
                    if (_message.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.md),
                      _panelNotice(
                        _message,
                        AppColors.success,
                        const Color(0xFFF0FDF4),
                      ),
                    ],
                    const SizedBox(height: AppSpacing.md),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: _saving ? null : _save,
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          minimumSize: const Size.fromHeight(52),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(
                              AppSpacing.radiusMd,
                            ),
                          ),
                        ),
                        child: Text(_saving ? 'Saving...' : 'Save'),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

/// Wallet — real settlement figures pulled from the same data the Payments
/// tab already uses (`fetchBookings` + `fetchCompanyPaymentSummary`), just
/// summarised into one glanceable card.
class ProviderWalletScreen extends StatefulWidget {
  const ProviderWalletScreen({super.key});

  @override
  State<ProviderWalletScreen> createState() => _ProviderWalletScreenState();
}

class _WalletData {
  const _WalletData({required this.totalEarnings, required this.summary});

  final double totalEarnings;
  final ProviderCompanyPaymentSummary summary;
}

class _ProviderWalletScreenState extends State<ProviderWalletScreen> {
  static const _service = ProviderWorkspaceService();
  late Future<_WalletData> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_WalletData> _load() async {
    final results = await Future.wait<Object>([
      _service.fetchBookings(),
      _service.fetchCompanyPaymentSummary(),
    ]);
    final bookings = results[0] as List<ProviderWorkspaceBooking>;
    final summary = results[1] as ProviderCompanyPaymentSummary;
    final totalEarnings = bookings
        .where((booking) => booking.paidAt.isNotEmpty)
        .fold<double>(0, (sum, booking) => sum + booking.providerNetAmount);
    return _WalletData(totalEarnings: totalEarnings, summary: summary);
  }

  String _currency(double value) => 'RM${value.toStringAsFixed(2)}';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const SwiperAppBar(
        title: 'Wallet',
        subtitle: 'Earnings and company settlement at a glance',
        showBack: true,
      ),
      body: FutureBuilder<_WalletData>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const LoadingState(label: 'Loading wallet...');
          }
          if (snapshot.hasError || snapshot.data == null) {
            return const EmptyState(
              title: 'Unable to load wallet',
              subtitle: 'Please try again.',
              icon: Icons.error_outline_rounded,
            );
          }

          final data = snapshot.data!;
          return ListView(
            padding: AppSpacing.screenPadding,
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(AppSpacing.lg),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [Color(0xFF6B4EA6), Color(0xFF8B5CF6)],
                  ),
                  borderRadius: BorderRadius.circular(28),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Total Earnings',
                      style: TextStyle(
                        color: Colors.white70,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      _currency(data.totalEarnings),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 30,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              Row(
                children: [
                  Expanded(
                    child: _walletTile(
                      context,
                      label: 'Payable to Company',
                      value: _currency(data.summary.payableAmount),
                      color: AppColors.error,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: _walletTile(
                      context,
                      label: 'Processing',
                      value: _currency(data.summary.processingAmount),
                      color: AppColors.warning,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              _walletTile(
                context,
                label: 'Verified & Settled',
                value: _currency(data.summary.verifiedAmount),
                color: AppColors.success,
                fullWidth: true,
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _walletTile(
    BuildContext context, {
    required String label,
    required String value,
    required Color color,
    bool fullWidth = false,
  }) {
    return Container(
      width: fullWidth ? double.infinity : null,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.16)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: AppColors.textSecondary),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w900,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

/// Rewards — demo/visual only for now: explains the "2 tasks a day unlocks
/// 6% commission for 24h" mechanic and shows what it'll look like once live.
class ProviderRewardsScreen extends StatelessWidget {
  const ProviderRewardsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    const tasksToday = 1;
    const tasksNeeded = 2;
    final progress = tasksToday / tasksNeeded;

    return Scaffold(
      appBar: const SwiperAppBar(
        title: 'Rewards',
        subtitle: 'Earn bonus commission by staying active',
        showBack: true,
      ),
      body: ListView(
        padding: AppSpacing.screenPadding,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AppSpacing.lg),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFFF6A000), Color(0xFFFFC24B)],
              ),
              borderRadius: BorderRadius.circular(28),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.25),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Icon(
                        Icons.emoji_events_rounded,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    const Expanded(
                      child: Text(
                        'Daily Streak Bonus',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                          fontSize: 18,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                const Text(
                  'Complete 2 tasks in one day to unlock 6% bonus commission. Once unlocked, it stays active for 24 hours from the moment you redeem it.',
                  style: TextStyle(color: Colors.white, height: 1.45),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          _panel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      "Today's Progress",
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      '$tasksToday / $tasksNeeded tasks',
                      style: const TextStyle(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                ClipRRect(
                  borderRadius: BorderRadius.circular(999),
                  child: LinearProgressIndicator(
                    value: progress.clamp(0, 1).toDouble(),
                    minHeight: 10,
                    backgroundColor: const Color(0xFFF1ECFC),
                    valueColor: const AlwaysStoppedAnimation(AppColors.primary),
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  'Complete 1 more task today to unlock your bonus commission.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          _panel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Active Bonus',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                Container(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8F4FF),
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(
                      color: AppColors.primary.withValues(alpha: 0.12),
                    ),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.bolt_rounded, color: AppColors.primary),
                      const SizedBox(width: AppSpacing.sm),
                      const Expanded(
                        child: Text(
                          'No bonus active right now — finish today\'s tasks to unlock +6% commission for 24 hours.',
                          style: TextStyle(color: AppColors.textSecondary),
                        ),
                      ),
                    ],
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

/// Help Centre — demo/visual only for now: a working-looking support form
/// (subject, description, attach images) with a local success state. Nothing
/// is submitted to a backend yet.
class ProviderHelpCentreScreen extends StatefulWidget {
  const ProviderHelpCentreScreen({super.key});

  @override
  State<ProviderHelpCentreScreen> createState() =>
      _ProviderHelpCentreScreenState();
}

class _ProviderHelpCentreScreenState extends State<ProviderHelpCentreScreen> {
  static const _topics = [
    'Booking issue',
    'Payment issue',
    'Account & verification',
    'App bug',
    'Other',
  ];

  String _topic = _topics.first;
  final _descriptionController = TextEditingController();
  List<PickedBrowserFile> _attachments = const [];
  bool _submitting = false;
  bool _submitted = false;

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _pickAttachment() async {
    if (_attachments.length >= 3) {
      return;
    }
    final picked = await pickMultipleBrowserFiles(
      accept: 'image/*',
      maxFiles: 3 - _attachments.length,
    );
    if (!mounted || picked.isEmpty) {
      return;
    }
    setState(() => _attachments = [..._attachments, ...picked]);
  }

  void _removeAttachment(int index) {
    setState(() {
      _attachments = List<PickedBrowserFile>.from(_attachments)
        ..removeAt(index);
    });
  }

  Future<void> _submit() async {
    if (_descriptionController.text.trim().isEmpty) {
      return;
    }
    setState(() => _submitting = true);
    // Demo only — nothing is sent anywhere yet. Simulates a brief submit so
    // the flow feels real before wiring to a backend ticket system later.
    await Future.delayed(const Duration(milliseconds: 700));
    if (!mounted) {
      return;
    }
    setState(() {
      _submitting = false;
      _submitted = true;
    });
  }

  void _startNewTicket() {
    setState(() {
      _submitted = false;
      _topic = _topics.first;
      _descriptionController.clear();
      _attachments = const [];
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const SwiperAppBar(
        title: 'Help Centre',
        subtitle: 'Tell us what\'s going on and attach photos if it helps',
        showBack: true,
      ),
      body: ListView(
        padding: AppSpacing.screenPadding,
        children: [
          if (_submitted)
            _panel(
              child: Column(
                children: [
                  Container(
                    width: 64,
                    height: 64,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: Color(0xFFE3F6ED),
                    ),
                    child: const Icon(
                      Icons.check_rounded,
                      color: AppColors.success,
                      size: 34,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    'Request Submitted',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Our team will get back to you shortly.',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: _startNewTicket,
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size.fromHeight(48),
                        foregroundColor: AppColors.primary,
                        side: BorderSide(
                          color: AppColors.primary.withValues(alpha: 0.24),
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(
                            AppSpacing.radiusMd,
                          ),
                        ),
                      ),
                      child: const Text('Submit another request'),
                    ),
                  ),
                ],
              ),
            )
          else
            _panel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  DropdownButtonFormField<String>(
                    initialValue: _topic,
                    decoration: _panelFieldDecoration(
                      'Topic',
                      prefixIcon: Icons.help_outline_rounded,
                    ),
                    items: _topics
                        .map(
                          (topic) => DropdownMenuItem(
                            value: topic,
                            child: Text(topic),
                          ),
                        )
                        .toList(growable: false),
                    onChanged: (value) =>
                        setState(() => _topic = value ?? _topic),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  TextField(
                    controller: _descriptionController,
                    maxLines: 5,
                    decoration: _panelFieldDecoration(
                      'Describe the issue',
                      prefixIcon: Icons.notes_rounded,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    'Attach Images (${_attachments.length}/3)',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Wrap(
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.sm,
                    children: [
                      for (var i = 0; i < _attachments.length; i++)
                        _attachmentThumb(i),
                      if (_attachments.length < 3) _addAttachmentTile(),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed:
                          _submitting ||
                              _descriptionController.text.trim().isEmpty
                          ? null
                          : _submit,
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        minimumSize: const Size.fromHeight(52),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(
                            AppSpacing.radiusMd,
                          ),
                        ),
                      ),
                      child: Text(_submitting ? 'Submitting...' : 'Submit'),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _attachmentThumb(int index) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: Container(
            width: 72,
            height: 72,
            color: const Color(0xFFF8F4FF),
            alignment: Alignment.center,
            child: const Icon(Icons.image_outlined, color: AppColors.primary),
          ),
        ),
        Positioned(
          right: -6,
          top: -6,
          child: InkWell(
            onTap: () => _removeAttachment(index),
            borderRadius: BorderRadius.circular(999),
            child: Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                border: Border.all(
                  color: AppColors.error.withValues(alpha: 0.2),
                ),
              ),
              child: const Icon(
                Icons.close_rounded,
                size: 14,
                color: AppColors.error,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _addAttachmentTile() {
    return InkWell(
      onTap: _pickAttachment,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        width: 72,
        height: 72,
        decoration: BoxDecoration(
          color: const Color(0xFFFDFBFF),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE7DDF7)),
        ),
        child: const Icon(
          Icons.add_photo_alternate_outlined,
          color: AppColors.primary,
        ),
      ),
    );
  }
}
