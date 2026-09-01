import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:latlong2/latlong.dart';

import '../../../core/animation/app_motion.dart';
import '../../../core/routing/app_routes.dart';
import '../../../services/browser_file_picker.dart';
import '../../../services/device_location_service.dart';
import '../../../services/image_crop_service.dart';
import '../../../services/otp_service.dart';
import '../../../services/provider_workspace_service.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/loading_state.dart';
import '../../../widgets/malaysia_state_autocomplete_field.dart';
import '../../../widgets/profile_avatar.dart';
import '../../../widgets/service_radius_map.dart';
import '../../../widgets/swiper_app_bar.dart';
import '../../../widgets/swiper_status_badge.dart';

class ProviderCalendarScreen extends StatefulWidget {
  const ProviderCalendarScreen({super.key});

  @override
  State<ProviderCalendarScreen> createState() => _ProviderCalendarScreenState();
}

class _ProviderCalendarScreenState extends State<ProviderCalendarScreen> {
  static const _service = ProviderWorkspaceService();
  late Future<List<ProviderWorkspaceBooking>> _future;
  late DateTime _month;
  String _selectedDate = DateFormat('yyyy-MM-dd').format(DateTime.now());

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _month = DateTime(now.year, now.month, 1);
    _future = _service.fetchBookings();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const SwiperAppBar(
        title: 'Calendar',
        subtitle: 'See provider bookings by date',
        showBack: true,
      ),
      body: FutureBuilder<List<ProviderWorkspaceBooking>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const LoadingState(label: 'Loading provider calendar...');
          }
          if (snapshot.hasError) {
            return const EmptyState(
              title: 'Unable to load calendar',
              subtitle: 'Please try again.',
              icon: Icons.error_outline_rounded,
            );
          }
          final bookings = snapshot.data ?? const [];
          final selected = bookings
              .where((booking) => booking.scheduledDate == _selectedDate)
              .toList(growable: false);
          final monthLabel = DateFormat('MMMM yyyy').format(_month);
          final firstWeekday =
              DateTime(_month.year, _month.month, 1).weekday % 7;
          final daysInMonth = DateTime(_month.year, _month.month + 1, 0).day;
          final cells = <_CalendarCell>[
            for (var i = 0; i < firstWeekday; i++) const _CalendarCell.empty(),
            for (var day = 1; day <= daysInMonth; day++)
              _CalendarCell(
                day: day,
                key: DateFormat(
                  'yyyy-MM-dd',
                ).format(DateTime(_month.year, _month.month, day)),
              ),
          ];

          return ListView(
            padding: AppSpacing.screenPadding,
            children: [
              _card(
                child: Column(
                  children: [
                    Row(
                      children: [
                        _circleIconButton(
                          icon: Icons.chevron_left_rounded,
                          onTap: () {
                            setState(() {
                              _month = DateTime(
                                _month.year,
                                _month.month - 1,
                                1,
                              );
                            });
                          },
                        ),
                        Expanded(
                          child: Text(
                            monthLabel,
                            textAlign: TextAlign.center,
                            style: Theme.of(context).textTheme.titleLarge
                                ?.copyWith(fontWeight: FontWeight.w900),
                          ),
                        ),
                        _circleIconButton(
                          icon: Icons.chevron_right_rounded,
                          onTap: () {
                            setState(() {
                              _month = DateTime(
                                _month.year,
                                _month.month + 1,
                                1,
                              );
                            });
                          },
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.md),
                    const Row(
                      children: [
                        _WeekLabel('Sun'),
                        _WeekLabel('Mon'),
                        _WeekLabel('Tue'),
                        _WeekLabel('Wed'),
                        _WeekLabel('Thu'),
                        _WeekLabel('Fri'),
                        _WeekLabel('Sat'),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: cells
                          .map((cell) {
                            final count = cell.key == null
                                ? 0
                                : bookings
                                      .where(
                                        (booking) =>
                                            booking.scheduledDate == cell.key,
                                      )
                                      .length;
                            final active = cell.key == _selectedDate;
                            return _CalendarDateCell(
                              cell: cell,
                              active: active,
                              count: count,
                              onTap: cell.key == null
                                  ? null
                                  : () => setState(
                                      () => _selectedDate = cell.key!,
                                    ),
                            );
                          })
                          .toList(growable: false),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              _card(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _formatDisplayDate(_selectedDate),
                                style: Theme.of(context).textTheme.titleLarge
                                    ?.copyWith(fontWeight: FontWeight.w900),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Jobs scheduled for the selected day.',
                                style: Theme.of(context).textTheme.bodySmall
                                    ?.copyWith(color: AppColors.textSecondary),
                              ),
                            ],
                          ),
                        ),
                        TextButton(
                          onPressed: () => Navigator.of(
                            context,
                          ).pushNamed(AppRoutes.providerServices),
                          child: const Text('Availability'),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.md),
                    if (selected.isEmpty)
                      const EmptyState(
                        title: 'No bookings on this day',
                        subtitle: 'Pick another date to see scheduled jobs.',
                        icon: Icons.calendar_month_outlined,
                      )
                    else
                      ...selected.map(
                        (booking) => Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                          child: _bookingDayCard(context, booking),
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

  Widget _bookingDayCard(
    BuildContext context,
    ProviderWorkspaceBooking booking,
  ) {
    final tone = _bookingTone(booking.bookingStatus);
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: const Color(0xFFFBFFFC),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE7EEE8)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      booking.serviceLabel,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      booking.customerName,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              SwiperStatusBadge(label: booking.statusLabel, tone: tone),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          _infoLine(
            Icons.schedule_outlined,
            _timeOnly(booking.scheduledDate, booking.scheduledStartTime),
          ),
        ],
      ),
    );
  }
}

class ProviderMessagesScreen extends StatefulWidget {
  const ProviderMessagesScreen({super.key});

  @override
  State<ProviderMessagesScreen> createState() => _ProviderMessagesScreenState();
}

class _ProviderMessagesScreenState extends State<ProviderMessagesScreen> {
  static const _service = ProviderWorkspaceService();
  late Future<List<ProviderMessageThread>> _threadsFuture;
  ProviderConversationDetail? _selectedThread;
  bool _loadingThread = false;
  bool _sending = false;
  String _error = '';
  String _composerText = '';
  PickedBrowserFile? _attachment;

  @override
  void initState() {
    super.initState();
    _threadsFuture = _service.fetchMessageThreads();
  }

  Future<void> _openThread(String bookingId) async {
    setState(() {
      _loadingThread = true;
      _error = '';
    });
    try {
      final detail = await _service.fetchMessageThreadDetail(bookingId);
      await _service.markConversationRead(bookingId);
      if (!mounted) {
        return;
      }
      setState(() {
        _selectedThread = detail;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _error = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) {
        setState(() => _loadingThread = false);
      }
    }
  }

  Future<void> _sendMessage() async {
    final thread = _selectedThread;
    if (thread == null || (!thread.canSendMessages)) {
      return;
    }
    final trimmed = _composerText.trim();
    if (trimmed.isEmpty && _attachment == null) {
      return;
    }
    setState(() {
      _sending = true;
      _error = '';
    });
    try {
      final detail = await _service.sendMessage(
        bookingId: thread.bookingId,
        messageText: trimmed,
        attachmentDataUrl: _attachment?.dataUrl ?? '',
        attachmentFileName: _attachment?.name ?? '',
        attachmentMimeType: _attachment?.mimeType ?? '',
      );
      if (!mounted) {
        return;
      }
      setState(() {
        _selectedThread = detail;
        _composerText = '';
        _attachment = null;
        _threadsFuture = _service.fetchMessageThreads();
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _error = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) {
        setState(() => _sending = false);
      }
    }
  }

  Future<void> _pickAttachment() async {
    final picked = await pickSingleBrowserFile();
    if (!mounted || picked == null) {
      return;
    }
    setState(() => _attachment = picked);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: SwiperAppBar(
        title: _selectedThread == null
            ? 'Messages'
            : _selectedThread!.counterpartName,
        subtitle: _selectedThread == null
            ? 'Live booking updates and provider alerts'
            : _selectedThread!.serviceLabel,
        showBack: true,
        actions: [
          IconButton(
            onPressed: () =>
                Navigator.of(context).pushNamed(AppRoutes.providerMore),
            icon: const Icon(Icons.settings_outlined),
          ),
        ],
      ),
      body: _selectedThread == null ? _buildThreads() : _buildConversation(),
    );
  }

  Widget _buildThreads() {
    return FutureBuilder<List<ProviderMessageThread>>(
      future: _threadsFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const LoadingState(label: 'Loading provider messages...');
        }
        if (snapshot.hasError) {
          return const EmptyState(
            title: 'Unable to load messages',
            subtitle: 'Please try again.',
            icon: Icons.error_outline_rounded,
          );
        }
        final threads = snapshot.data ?? const [];
        if (threads.isEmpty) {
          return const Padding(
            padding: AppSpacing.screenPadding,
            child: EmptyState(
              title: 'No messages yet',
              subtitle:
                  'Customer notes and booking conversations will appear here once someone books your service.',
              icon: Icons.chat_bubble_outline_rounded,
            ),
          );
        }

        return ListView.separated(
          padding: AppSpacing.screenPadding,
          itemCount: threads.length,
          separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
          itemBuilder: (context, index) {
            final thread = threads[index];
            return InkWell(
              borderRadius: BorderRadius.circular(20),
              onTap: () => _openThread(thread.bookingId),
              child: Ink(
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  color: thread.unreadCount > 0
                      ? const Color(0xFFF6FFF8)
                      : Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: thread.unreadCount > 0
                        ? const Color(0xFFBBF7D0)
                        : AppColors.border,
                  ),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ProfileAvatar(
                      name: thread.counterpartName,
                      imageUrl: '',
                      radius: 24,
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  thread.counterpartName,
                                  style: Theme.of(context).textTheme.titleSmall
                                      ?.copyWith(fontWeight: FontWeight.w800),
                                ),
                              ),
                              Text(
                                _relativeTime(thread.lastMessageAt),
                                style: Theme.of(context).textTheme.bodySmall
                                    ?.copyWith(color: AppColors.textSecondary),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            thread.serviceLabel,
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(
                                  color: AppColors.primary,
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            thread.preview,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.bodyMedium
                                ?.copyWith(color: AppColors.textSecondary),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            thread.schedule,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    if (thread.unreadCount > 0)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 6,
                        ),
                        decoration: const BoxDecoration(
                          color: AppColors.success,
                          shape: BoxShape.circle,
                        ),
                        child: Text(
                          '${thread.unreadCount}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            fontSize: 12,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildConversation() {
    final thread = _selectedThread!;
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: AppSpacing.screenPadding,
            children: [
              if (_loadingThread)
                const LoadingState(label: 'Loading conversation...'),
              if (_error.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.md),
                  child: _notice(
                    _error,
                    AppColors.error,
                    const Color(0xFFFFF1F2),
                  ),
                ),
              _card(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      thread.counterpartName,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      thread.schedule,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      thread.location,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              ...thread.messages.map(
                (message) => Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                  child: Align(
                    alignment: message.isOwnMessage
                        ? Alignment.centerRight
                        : Alignment.centerLeft,
                    child: _messageBubble(message),
                  ),
                ),
              ),
            ],
          ),
        ),
        Container(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.md,
            AppSpacing.sm,
            AppSpacing.md,
            AppSpacing.md,
          ),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(top: BorderSide(color: AppColors.border)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_attachment != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.attach_file_rounded,
                        color: AppColors.primary,
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      Expanded(child: Text(_attachment!.name)),
                      IconButton(
                        onPressed: () => setState(() => _attachment = null),
                        icon: const Icon(Icons.close_rounded),
                      ),
                    ],
                  ),
                ),
              Row(
                children: [
                  IconButton(
                    onPressed: thread.canSendMessages ? _pickAttachment : null,
                    icon: const Icon(Icons.attach_file_rounded),
                  ),
                  Expanded(
                    child: TextField(
                      minLines: 1,
                      maxLines: 4,
                      enabled: thread.canSendMessages && !_sending,
                      onChanged: (value) =>
                          setState(() => _composerText = value),
                      controller: TextEditingController(text: _composerText)
                        ..selection = TextSelection.fromPosition(
                          TextPosition(offset: _composerText.length),
                        ),
                      decoration: InputDecoration(
                        hintText: thread.canSendMessages
                            ? 'Type a message about this booking'
                            : 'Messaging is closed for this booking',
                        filled: true,
                        fillColor: const Color(0xFFF8F4FF),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(
                            AppSpacing.radiusMd,
                          ),
                          borderSide: BorderSide.none,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  FilledButton(
                    onPressed: thread.canSendMessages && !_sending
                        ? _sendMessage
                        : null,
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.success,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(
                          AppSpacing.radiusMd,
                        ),
                      ),
                    ),
                    child: Text(_sending ? '...' : 'Send'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _messageBubble(ProviderConversationMessage message) {
    final own = message.isOwnMessage;
    return Container(
      constraints: const BoxConstraints(maxWidth: 290),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: own ? AppColors.success : const Color(0xFFF8FCF9),
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: own ? null : Border.all(color: const Color(0xFFBBF7D0)),
      ),
      child: Column(
        crossAxisAlignment: own
            ? CrossAxisAlignment.end
            : CrossAxisAlignment.start,
        children: [
          if (message.messageText.trim().isNotEmpty)
            Text(
              message.messageText,
              style: TextStyle(
                color: own ? Colors.white : AppColors.textPrimary,
              ),
            ),
          if (message.attachmentDataUrl.isNotEmpty) ...[
            if (message.messageText.trim().isNotEmpty)
              const SizedBox(height: AppSpacing.sm),
            _attachmentPreview(message, own),
          ],
          const SizedBox(height: 4),
          Text(
            _messageTime(message.createdAt),
            style: TextStyle(
              color: own ? Colors.white70 : AppColors.textSecondary,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }

  Widget _attachmentPreview(ProviderConversationMessage message, bool own) {
    final isImage = message.attachmentMimeType.startsWith('image/');
    if (isImage) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Image.network(
          message.attachmentDataUrl,
          height: 120,
          width: 180,
          fit: BoxFit.cover,
          errorBuilder: (context, error, stackTrace) => Container(
            height: 80,
            width: 180,
            color: Colors.white,
            alignment: Alignment.center,
            child: Text(
              message.attachmentFileName.isEmpty
                  ? 'Image attachment'
                  : message.attachmentFileName,
              textAlign: TextAlign.center,
            ),
          ),
        ),
      );
    }
    return Container(
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: own ? Colors.white24 : Colors.white,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.insert_drive_file_outlined,
            color: own ? Colors.white : AppColors.primary,
          ),
          const SizedBox(width: AppSpacing.xs),
          Flexible(
            child: Text(
              message.attachmentFileName.isEmpty
                  ? 'Attachment'
                  : message.attachmentFileName,
              style: TextStyle(
                color: own ? Colors.white : AppColors.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class ProviderPersonalDetailsScreen extends StatefulWidget {
  const ProviderPersonalDetailsScreen({super.key});

  @override
  State<ProviderPersonalDetailsScreen> createState() =>
      _ProviderPersonalDetailsScreenState();
}

class _ProviderPersonalDetailsScreenState
    extends State<ProviderPersonalDetailsScreen> {
  static const _service = ProviderWorkspaceService();

  late Future<ProviderWorkspaceProfile> _future;
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _dobController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _marketingNameController = TextEditingController();
  final _addressLine1Controller = TextEditingController();
  final _addressLine2Controller = TextEditingController();
  final _postcodeController = TextEditingController();
  final _cityController = TextEditingController();
  final _stateController = TextEditingController();
  final _countryController = TextEditingController();
  final _bioController = TextEditingController();
  PickedBrowserFile? _avatarFile;
  String _gender = 'Female';
  String _seed = '';
  bool _saving = false;
  String _message = '';
  String _error = '';

  InputDecoration _personalFieldDecoration({
    required String label,
    IconData? prefixIcon,
  }) {
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
        borderSide: BorderSide(
          color: AppColors.primary.withValues(alpha: 0.14),
        ),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppSpacing.lg),
        borderSide: BorderSide(
          color: AppColors.primary.withValues(alpha: 0.14),
        ),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppSpacing.lg),
        borderSide: const BorderSide(color: AppColors.primary, width: 1.4),
      ),
      disabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppSpacing.lg),
        borderSide: BorderSide(color: AppColors.primary.withValues(alpha: 0.1)),
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    _future = _service.fetchProfile();
  }

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _dobController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _marketingNameController.dispose();
    _addressLine1Controller.dispose();
    _addressLine2Controller.dispose();
    _postcodeController.dispose();
    _cityController.dispose();
    _stateController.dispose();
    _countryController.dispose();
    _bioController.dispose();
    super.dispose();
  }

  void _seedControllers(ProviderWorkspaceProfile profile) {
    final nextSeed = [
      profile.providerId,
      profile.fullName,
      profile.firstName,
      profile.lastName,
      profile.dateOfBirth,
      profile.gender,
      profile.email,
      profile.phone,
      profile.marketingName,
      profile.addressLine1,
      profile.addressLine2,
      profile.postcode,
      profile.city,
      profile.state,
      profile.country,
      profile.emergencyContactNumber,
      profile.bio,
      profile.avatarUrl,
    ].join('|');
    if (_seed == nextSeed) {
      return;
    }
    _seed = nextSeed;
    final derivedNames = profile.fullName.trim().split(RegExp(r'\s+'));
    _firstNameController.text = profile.firstName.isNotEmpty
        ? profile.firstName
        : (derivedNames.isNotEmpty ? derivedNames.first : '');
    _lastNameController.text = profile.lastName.isNotEmpty
        ? profile.lastName
        : (derivedNames.length > 1 ? derivedNames.skip(1).join(' ') : '');
    _dobController.text = profile.dateOfBirth;
    _emailController.text = profile.email;
    _phoneController.text = profile.phone;
    _gender = profile.gender.isNotEmpty ? profile.gender : 'Female';
    _marketingNameController.text = profile.marketingName;
    _addressLine1Controller.text = profile.addressLine1;
    _addressLine2Controller.text = profile.addressLine2;
    _postcodeController.text = profile.postcode;
    _cityController.text = profile.city;
    _stateController.text = profile.state;
    _countryController.text = profile.country;
    _bioController.text = profile.bio;
  }

  Future<void> _pickAvatar() async {
    final picked = await pickAndCropImage(toolbarTitle: 'Crop Profile Photo');
    if (!mounted || picked == null) {
      return;
    }
    setState(() {
      _avatarFile = picked;
      _message = '';
      _error = '';
    });
  }

  Future<void> _pickDateOfBirth() async {
    final now = DateTime.now();
    final initial =
        DateTime.tryParse(_dobController.text.trim()) ??
        DateTime(now.year - 25, now.month, now.day);
    final picked = await showDatePicker(
      context: context,
      initialDate: initial.isAfter(now) ? now : initial,
      firstDate: DateTime(1950),
      lastDate: now,
    );
    if (!mounted || picked == null) {
      return;
    }
    setState(() {
      _dobController.text = DateFormat('yyyy-MM-dd').format(picked);
    });
  }

  Future<void> _save() async {
    final firstName = _firstNameController.text.trim();
    final lastName = _lastNameController.text.trim();
    final fullName = [
      firstName,
      lastName,
    ].where((item) => item.isNotEmpty).join(' ').trim();
    if (firstName.isEmpty || lastName.isEmpty) {
      setState(() => _error = 'First name and last name are required.');
      return;
    }

    setState(() {
      _saving = true;
      _message = '';
      _error = '';
    });

    try {
      await _service.updateProfile(
        fullName: fullName,
        firstName: firstName,
        lastName: lastName,
        dateOfBirth: _dobController.text.trim(),
        gender: _gender,
        email: _emailController.text.trim(),
        phone: _phoneController.text.trim(),
        marketingName: _marketingNameController.text.trim(),
        addressLine1: _addressLine1Controller.text.trim(),
        addressLine2: _addressLine2Controller.text.trim(),
        postcode: _postcodeController.text.trim(),
        city: _cityController.text.trim(),
        state: _stateController.text.trim(),
        country: _countryController.text.trim(),
        bio: _bioController.text.trim(),
        avatarUrl: _avatarFile?.dataUrl,
      );
      if (!mounted) {
        return;
      }
      setState(() {
        _future = _service.fetchProfile();
        _message = 'Personal details saved successfully.';
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
        title: 'Personal Card',
        subtitle: 'Edit provider identity and profile details',
        showBack: true,
      ),
      body: FutureBuilder<ProviderWorkspaceProfile>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const LoadingState(label: 'Loading personal details...');
          }
          if (snapshot.hasError || snapshot.data == null) {
            return const EmptyState(
              title: 'Unable to load personal details',
              subtitle: 'Please try again.',
              icon: Icons.error_outline_rounded,
            );
          }

          final profile = snapshot.data!;
          _seedControllers(profile);
          final displayName = _marketingNameController.text.trim().isEmpty
              ? [
                  _firstNameController.text.trim(),
                  _lastNameController.text.trim(),
                ].where((item) => item.isNotEmpty).join(' ').trim()
              : _marketingNameController.text.trim();

          return ListView(
            padding: AppSpacing.screenPadding,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(AppSpacing.xl),
                      border: Border.all(
                        color: AppColors.primary.withValues(alpha: 0.12),
                      ),
                    ),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 112,
                          height: 112,
                          child: Stack(
                            clipBehavior: Clip.none,
                            children: [
                              Positioned(
                                left: 4,
                                top: 4,
                                child: ProfileAvatar(
                                  name: displayName.isEmpty
                                      ? 'Provider'
                                      : displayName,
                                  imageUrl:
                                      _avatarFile?.dataUrl ?? profile.avatarUrl,
                                  radius: 52,
                                ),
                              ),
                              Positioned(
                                right: 0,
                                bottom: 0,
                                child: InkWell(
                                  onTap: _pickAvatar,
                                  borderRadius: BorderRadius.circular(999),
                                  child: Ink(
                                    width: 32,
                                    height: 32,
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      shape: BoxShape.circle,
                                      border: Border.all(
                                        color: const Color(0xFF645394),
                                        width: 1.4,
                                      ),
                                    ),
                                    child: const Icon(
                                      Icons.photo_camera_rounded,
                                      size: 17,
                                      color: Color(0xFF645394),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                displayName.isEmpty ? 'Provider' : displayName,
                                style: Theme.of(context).textTheme.titleLarge
                                    ?.copyWith(fontWeight: FontWeight.w900),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Update your public profile identity.',
                                style: Theme.of(context).textTheme.bodySmall
                                    ?.copyWith(color: AppColors.textSecondary),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (_avatarFile != null) ...[
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      _avatarFile!.name,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                  const SizedBox(height: AppSpacing.lg),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _firstNameController,
                          decoration: _personalFieldDecoration(
                            label: 'First Name',
                            prefixIcon: Icons.person_outline_rounded,
                          ),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: TextField(
                          controller: _lastNameController,
                          decoration: _personalFieldDecoration(
                            label: 'Last Name',
                            prefixIcon: Icons.person_outline_rounded,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  GestureDetector(
                    onTap: _pickDateOfBirth,
                    child: AbsorbPointer(
                      child: TextField(
                        controller: _dobController,
                        decoration: _personalFieldDecoration(
                          label: 'Date of Birth',
                          prefixIcon: Icons.calendar_month_rounded,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  DropdownButtonFormField<String>(
                    initialValue: _gender,
                    items: const ['Female', 'Male']
                        .map(
                          (item) =>
                              DropdownMenuItem(value: item, child: Text(item)),
                        )
                        .toList(),
                    onChanged: (value) {
                      setState(() => _gender = value ?? _gender);
                    },
                    decoration: _personalFieldDecoration(
                      label: 'Gender',
                      prefixIcon: Icons.wc_rounded,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  TextField(
                    controller: _marketingNameController,
                    decoration: _personalFieldDecoration(
                      label: 'Marketing Name',
                      prefixIcon: Icons.badge_outlined,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  TextField(
                    controller: _emailController,
                    decoration: _personalFieldDecoration(
                      label: 'Email Address',
                      prefixIcon: Icons.mail_outline_rounded,
                    ),
                    keyboardType: TextInputType.emailAddress,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  TextField(
                    controller: _phoneController,
                    decoration: _personalFieldDecoration(
                      label: 'Phone Number',
                      prefixIcon: Icons.call_outlined,
                    ),
                    keyboardType: TextInputType.phone,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  TextField(
                    controller: _addressLine1Controller,
                    decoration: _personalFieldDecoration(
                      label: 'Address Line 1',
                      prefixIcon: Icons.home_outlined,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  TextField(
                    controller: _addressLine2Controller,
                    decoration: _personalFieldDecoration(
                      label: 'Address Line 2',
                      prefixIcon: Icons.apartment_rounded,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _postcodeController,
                          decoration: _personalFieldDecoration(
                            label: 'Postcode',
                            prefixIcon: Icons.markunread_mailbox_outlined,
                          ),
                          keyboardType: TextInputType.number,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: TextField(
                          controller: _cityController,
                          decoration: _personalFieldDecoration(
                            label: 'City',
                            prefixIcon: Icons.location_city_outlined,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  MalaysiaStateAutocompleteField(
                    controller: _stateController,
                    label: 'State',
                    hintText: 'Type first letter',
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  TextField(
                    controller: _countryController,
                    decoration: _personalFieldDecoration(
                      label: 'Country',
                      prefixIcon: Icons.public_rounded,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  TextField(
                    controller: _bioController,
                    maxLines: 4,
                    decoration: _personalFieldDecoration(
                      label: 'Bio',
                      prefixIcon: Icons.notes_rounded,
                    ),
                  ),
                  if (_error.isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.md),
                    _providerNoticeCard(
                      _error,
                      AppColors.error,
                      const Color(0xFFFFF1F2),
                    ),
                  ],
                  if (_message.isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.md),
                    _providerNoticeCard(
                      _message,
                      AppColors.success,
                      const Color(0xFFF0FDF4),
                    ),
                  ],
                  const SizedBox(height: AppSpacing.md),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: _saving ? null : _save,
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.primary,
                        side: const BorderSide(color: AppColors.primary),
                        minimumSize: const Size.fromHeight(52),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(
                            AppSpacing.radiusLg,
                          ),
                        ),
                      ),
                      child: Text(_saving ? 'Saving...' : 'Save Details'),
                    ),
                  ),
                ],
              ),
            ],
          );
        },
      ),
    );
  }
}

class ProviderVerificationHubScreen extends StatefulWidget {
  const ProviderVerificationHubScreen({super.key});

  @override
  State<ProviderVerificationHubScreen> createState() =>
      _ProviderVerificationHubScreenState();
}

class _ProviderVerificationHubScreenState
    extends State<ProviderVerificationHubScreen> {
  static const _service = ProviderWorkspaceService();
  late Future<ProviderWorkspaceProfile> _future;

  @override
  void initState() {
    super.initState();
    _future = _service.fetchProfile();
  }

  void _refresh() {
    if (!mounted) return;
    setState(() => _future = _service.fetchProfile());
  }

  Future<void> _openAndRefresh(String route) async {
    await Navigator.of(context).pushNamed(route);
    _refresh();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const SwiperAppBar(
        title: 'Verification',
        subtitle: 'See what is pending and update verification items',
        showBack: true,
      ),
      body: FutureBuilder<ProviderWorkspaceProfile>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const LoadingState(label: 'Loading verification...');
          }
          if (snapshot.hasError || snapshot.data == null) {
            return const EmptyState(
              title: 'Unable to load verification',
              subtitle: 'Please try again.',
              icon: Icons.error_outline_rounded,
            );
          }

          final profile = snapshot.data!;
          return ListView(
            padding: AppSpacing.screenPadding,
            children: [
              _card(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Verification Status',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Open each section to complete pending items.',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    _moreTile(
                      context,
                      icon: Icons.mail_outline_rounded,
                      title: 'Email Verification',
                      statusLabel: profile.emailVerified
                          ? 'Verified'
                          : 'Pending',
                      statusColor: profile.emailVerified
                          ? AppColors.success
                          : AppColors.warning,
                      subtitle: profile.emailVerified
                          ? 'Verified email address'
                          : 'Pending email verification',
                      onTap: () =>
                          _openAndRefresh(AppRoutes.providerVerificationEmail),
                    ),
                    _moreTile(
                      context,
                      icon: Icons.phone_outlined,
                      title: 'Phone Verification',
                      statusLabel: profile.phoneVerified
                          ? 'Verified'
                          : 'Pending',
                      statusColor: profile.phoneVerified
                          ? AppColors.success
                          : AppColors.warning,
                      subtitle: profile.phoneVerified
                          ? 'Verified phone number'
                          : 'Pending phone verification',
                      onTap: () =>
                          _openAndRefresh(AppRoutes.providerVerificationPhone),
                    ),
                    _moreTile(
                      context,
                      icon: Icons.badge_outlined,
                      title: 'IC / Passport',
                      statusLabel: _identityStatusLabel(profile),
                      statusColor: _identityStatusColor(profile),
                      subtitle: _identityStatusSubtitle(profile),
                      onTap: () => _openAndRefresh(
                        AppRoutes.providerVerificationIdentity,
                      ),
                      isLast: true,
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

  String _identityStatusLabel(ProviderWorkspaceProfile profile) {
    if (profile.identityVerified) {
      return 'Verified';
    }
    return switch (profile.identityVerificationStatus) {
      'processing' => 'Processing',
      'rejected' => 'Rejected',
      _ => 'Pending',
    };
  }

  Color _identityStatusColor(ProviderWorkspaceProfile profile) {
    if (profile.identityVerified) {
      return AppColors.success;
    }
    return switch (profile.identityVerificationStatus) {
      'processing' => AppColors.info,
      'rejected' => AppColors.error,
      _ => AppColors.warning,
    };
  }

  String _identityStatusSubtitle(ProviderWorkspaceProfile profile) {
    if (profile.identityVerified) {
      return 'Verified identity documents';
    }
    return switch (profile.identityVerificationStatus) {
      'processing' => 'Your documents are under review',
      'rejected' => 'Previous submission was rejected',
      _ => 'Pending identity review',
    };
  }
}

class ProviderServiceAreaScreen extends StatefulWidget {
  const ProviderServiceAreaScreen({super.key});

  @override
  State<ProviderServiceAreaScreen> createState() =>
      _ProviderServiceAreaScreenState();
}

class _ProviderServiceAreaScreenState extends State<ProviderServiceAreaScreen> {
  static const _service = ProviderWorkspaceService();

  late Future<ProviderWorkspaceProfile> _future;
  final _areaController = TextEditingController();
  String _seed = '';
  double _radiusKm = 15;
  bool _saving = false;
  bool _fetchingLocation = false;
  String _message = '';
  String _error = '';
  LatLng? _providerLatLng;

  @override
  void initState() {
    super.initState();
    _future = _service.fetchProfile();
    _fetchCurrentLocation();
  }

  @override
  void dispose() {
    _areaController.dispose();
    super.dispose();
  }

  Future<void> _fetchCurrentLocation() async {
    setState(() => _fetchingLocation = true);
    try {
      final result = await fetchDeviceLocation();
      if (!mounted) {
        return;
      }
      setState(() {
        _providerLatLng = LatLng(result.latitude, result.longitude);
        if (_areaController.text.trim().isEmpty) {
          _areaController.text = result.label;
        }
      });
    } catch (_) {
      // Silently keep the map's default centre if location isn't
      // available/permitted — the provider can still edit the area by hand.
    } finally {
      if (mounted) {
        setState(() => _fetchingLocation = false);
      }
    }
  }

  void _seedState(ProviderWorkspaceProfile profile) {
    final nextSeed = [
      profile.providerId,
      profile.serviceLocation,
      profile.serviceRadiusKm.toStringAsFixed(2),
    ].join('|');
    if (_seed == nextSeed) {
      return;
    }
    _seed = nextSeed;
    if (profile.serviceLocation.trim().isNotEmpty) {
      _areaController.text = profile.serviceLocation;
    }
    _radiusKm = profile.serviceRadiusKm > 0
        ? profile.serviceRadiusKm.clamp(1, 100).toDouble()
        : 15;
  }

  Future<void> _save() async {
    if (_areaController.text.trim().isEmpty) {
      setState(() => _error = 'Service area is required.');
      return;
    }

    setState(() {
      _saving = true;
      _message = '';
      _error = '';
    });

    try {
      await _service.updateProfile(
        serviceLocation: _areaController.text.trim(),
        serviceRadiusKm: _radiusKm.roundToDouble(),
      );
      if (!mounted) {
        return;
      }
      setState(() {
        _future = _service.fetchProfile();
        _message = 'Service area updated successfully.';
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
        title: 'Service Area',
        subtitle: 'Adjust coverage radius and area location',
        showBack: true,
      ),
      body: FutureBuilder<ProviderWorkspaceProfile>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const LoadingState(label: 'Loading service area...');
          }
          if (snapshot.hasError || snapshot.data == null) {
            return const EmptyState(
              title: 'Unable to load service area',
              subtitle: 'Please try again.',
              icon: Icons.error_outline_rounded,
            );
          }

          _seedState(snapshot.data!);

          return ListView(
            padding: AppSpacing.screenPadding,
            children: [
              _card(
                child: Column(
                  children: [
                    SizedBox(
                      height: 210,
                      child: Stack(
                        children: [
                          Positioned.fill(
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(24),
                              child: ServiceRadiusMap(
                                center:
                                    _providerLatLng ??
                                    const LatLng(3.1390, 101.6869),
                                radiusKm: _radiusKm,
                                height: 210,
                              ),
                            ),
                          ),
                          Positioned(
                            left: 18,
                            top: 18,
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 8,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.92),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                _fetchingLocation
                                    ? 'Locating…'
                                    : '${_radiusKm.round()} km radius',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.primary,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    _providerFormField(
                      controller: _areaController,
                      label: 'Service Area',
                      onChanged: (_) => setState(() {}),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Container(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFDFBFF),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: const Color(0xFFE9E0F5)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Service Radius',
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          SliderTheme(
                            data: SliderTheme.of(context).copyWith(
                              activeTrackColor: AppColors.primary,
                              inactiveTrackColor: const Color(0xFFE7DDF7),
                              thumbColor: AppColors.primary,
                              overlayColor: AppColors.primary.withValues(
                                alpha: 0.14,
                              ),
                              trackHeight: 5,
                            ),
                            child: Slider(
                              value: _radiusKm,
                              min: 1,
                              max: 100,
                              divisions: 99,
                              label: '${_radiusKm.round()} km',
                              onChanged: (value) {
                                setState(() => _radiusKm = value);
                              },
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (_error.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.md),
                      _providerNoticeCard(
                        _error,
                        AppColors.error,
                        const Color(0xFFFFF1F2),
                      ),
                    ],
                    if (_message.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.md),
                      _providerNoticeCard(
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
                        child: Text(_saving ? 'Saving...' : 'Save Area'),
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

Widget _providerFormField({
  required TextEditingController controller,
  required String label,
  int maxLines = 1,
  ValueChanged<String>? onChanged,
}) {
  return Container(
    padding: const EdgeInsets.all(AppSpacing.sm),
    decoration: BoxDecoration(
      color: const Color(0xFFFBFFFC),
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: const Color(0xFFE7EEE8)),
    ),
    child: TextField(
      controller: controller,
      maxLines: maxLines,
      onChanged: onChanged,
      decoration: InputDecoration(
        labelText: label,
        border: InputBorder.none,
        contentPadding: EdgeInsets.zero,
      ),
    ),
  );
}

Widget _providerNoticeCard(String message, Color color, Color background) {
  return Container(
    padding: const EdgeInsets.symmetric(
      horizontal: AppSpacing.md,
      vertical: AppSpacing.sm,
    ),
    decoration: BoxDecoration(
      color: background,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: color.withValues(alpha: 0.3)),
    ),
    child: Text(
      message,
      style: TextStyle(color: color, fontWeight: FontWeight.w600),
    ),
  );
}

class ProviderMoreScreen extends StatelessWidget {
  const ProviderMoreScreen({super.key, this.onOpenProfile});

  final VoidCallback? onOpenProfile;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.md,
        AppSpacing.md,
        112,
      ),
      children: [
        _paymentsHeader(context),
        const SizedBox(height: AppSpacing.md),
        _sectionTitle(
          icon: Icons.chevron_left_rounded,
          title: 'More',
          subtitle: 'Provider settings, support, and verification',
        ),
        const SizedBox(height: AppSpacing.md),
        _card(
          child: Column(
            children: [
              _moreTile(
                context,
                icon: Icons.person_outline_rounded,
                title: 'Personal Information',
                subtitle: 'Open provider profile',
                onTap: onOpenProfile ?? () {},
              ),
              _moreTile(
                context,
                icon: Icons.work_outline_rounded,
                title: 'My Services',
                subtitle: 'Manage services and pricing',
                onTap: () =>
                    Navigator.of(context).pushNamed(AppRoutes.providerServices),
              ),
              _moreTile(
                context,
                icon: Icons.reviews_outlined,
                title: 'Reviews',
                subtitle: 'View customer feedback',
                onTap: () =>
                    Navigator.of(context).pushNamed(AppRoutes.providerReviews),
              ),
              _moreTile(
                context,
                icon: Icons.chat_bubble_outline_rounded,
                title: 'Messages',
                subtitle: 'Open live booking conversations',
                onTap: () =>
                    Navigator.of(context).pushNamed(AppRoutes.providerMessages),
              ),
              _moreTile(
                context,
                icon: Icons.calendar_view_month_outlined,
                title: 'Calendar',
                subtitle: 'See bookings by date',
                onTap: () =>
                    Navigator.of(context).pushNamed(AppRoutes.providerCalendar),
                isLast: true,
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        _card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Verification',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              _moreTile(
                context,
                icon: Icons.mail_outline_rounded,
                title: 'Email Verification',
                subtitle: 'Add and verify your email address',
                onTap: () => Navigator.of(
                  context,
                ).pushNamed(AppRoutes.providerVerificationEmail),
              ),
              _moreTile(
                context,
                icon: Icons.phone_outlined,
                title: 'Phone Verification',
                subtitle: 'Verify your phone number with OTP',
                onTap: () => Navigator.of(
                  context,
                ).pushNamed(AppRoutes.providerVerificationPhone),
              ),
              _moreTile(
                context,
                icon: Icons.badge_outlined,
                title: 'IC / Passport Verification',
                subtitle: 'Upload identity documents for review',
                onTap: () => Navigator.of(
                  context,
                ).pushNamed(AppRoutes.providerVerificationIdentity),
                isLast: true,
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _paymentsHeader(BuildContext context) {
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
          'Banking, services, and support',
          style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
        ),
      ],
    );
  }

  Widget _sectionTitle({
    required IconData icon,
    required String title,
    required String subtitle,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 2, right: AppSpacing.sm),
          child: Icon(icon, color: AppColors.textPrimary, size: 22),
        ),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class ProviderEmailVerificationScreen extends StatefulWidget {
  const ProviderEmailVerificationScreen({super.key});

  @override
  State<ProviderEmailVerificationScreen> createState() =>
      _ProviderEmailVerificationScreenState();
}

class _ProviderEmailVerificationScreenState
    extends State<ProviderEmailVerificationScreen> {
  static const _service = ProviderWorkspaceService();
  static const OtpService _otpService = DevelopmentOtpService();
  late Future<ProviderWorkspaceProfile> _future;
  final _emailController = TextEditingController();
  final _otpController = TextEditingController();
  bool _otpSent = false;
  int _countdown = 30;
  String _notice = '';
  bool _verifying = false;

  @override
  void initState() {
    super.initState();
    _future = _service.fetchProfile();
  }

  @override
  void dispose() {
    _emailController.dispose();
    _otpController.dispose();
    super.dispose();
  }

  Future<void> _handleSendOtp() async {
    await _otpService.sendOtp(_emailController.text.trim());
    if (!mounted) return;
    setState(() {
      _otpSent = true;
      _countdown = 30;
      _notice = 'We sent a 6-digit code to your email.';
    });
  }

  Future<void> _handleVerify() async {
    final email = _emailController.text.trim();
    setState(() => _verifying = true);
    try {
      // The dev OTP service keys off a normalized-phone-shaped string in its
      // interface, but only checks the code value — reusing it here for
      // email avoids a second parallel OTP mechanism.
      final matched = await _otpService.verifyOtp(
        email,
        _otpController.text.trim(),
      );
      if (!matched) {
        if (!mounted) return;
        setState(() {
          _verifying = false;
          _notice = 'Incorrect code. Please try again.';
        });
        return;
      }

      await _service.updateProfile(email: email, emailVerified: true);

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Email verified successfully.')),
      );
      Navigator.of(context).pop();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _verifying = false;
        _notice = error is Exception
            ? error.toString().replaceFirst('Exception: ', '')
            : 'Unable to verify email.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return _ProviderOtpVerificationScaffold(
      title: 'Email Verification',
      description: 'Add your email address and verify it with a one-time code.',
      future: _future,
      fieldLabel: 'Email Address',
      fieldHint: 'Enter email address',
      keyboardType: TextInputType.emailAddress,
      statusSelector: (profile) => profile.emailVerified,
      onSeedValue: (profile) {
        if (_emailController.text.isEmpty) {
          _emailController.text = profile.email;
        }
      },
      fieldController: _emailController,
      otpController: _otpController,
      otpSent: _otpSent,
      countdown: _countdown,
      idleMessage: 'We sent a 6-digit code to your email',
      notice: _notice,
      onSendOtp: () {
        _handleSendOtp();
      },
      onVerify: () {
        if (!_verifying) _handleVerify();
      },
    );
  }
}

class ProviderPhoneVerificationScreen extends StatefulWidget {
  const ProviderPhoneVerificationScreen({super.key});

  @override
  State<ProviderPhoneVerificationScreen> createState() =>
      _ProviderPhoneVerificationScreenState();
}

class _ProviderPhoneVerificationScreenState
    extends State<ProviderPhoneVerificationScreen> {
  static const _service = ProviderWorkspaceService();
  late Future<ProviderWorkspaceProfile> _future;
  final _phoneController = TextEditingController();
  final _otpController = TextEditingController();
  bool _otpSent = false;
  int _countdown = 30;
  String _notice = '';

  @override
  void initState() {
    super.initState();
    _future = _service.fetchProfile();
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _otpController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _ProviderOtpVerificationScaffold(
      title: 'Phone Verification',
      description: 'Add your phone number and verify it with a one-time code.',
      future: _future,
      fieldLabel: 'Phone Number',
      fieldHint: 'Enter phone number',
      keyboardType: TextInputType.phone,
      leadingPrefix: const Text(
        '+60',
        style: TextStyle(
          fontWeight: FontWeight.w700,
          color: AppColors.textPrimary,
        ),
      ),
      statusSelector: (profile) => profile.phoneVerified,
      onSeedValue: (profile) {
        if (_phoneController.text.isEmpty) {
          _phoneController.text = profile.phone.replaceFirst(
            RegExp(r'^\+?60\s?'),
            '',
          );
        }
      },
      fieldController: _phoneController,
      otpController: _otpController,
      otpSent: _otpSent,
      countdown: _countdown,
      idleMessage: 'We sent a 6-digit code by SMS',
      notice: _notice,
      onSendOtp: () => setState(() {
        _otpSent = true;
        _countdown = 30;
        _notice = 'We sent a 6-digit code by SMS to your phone.';
      }),
      onVerify: () {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Phone verification submitted successfully.'),
          ),
        );
        Navigator.of(context).pop();
      },
    );
  }
}

class ProviderIdentityVerificationScreen extends StatefulWidget {
  const ProviderIdentityVerificationScreen({super.key});

  @override
  State<ProviderIdentityVerificationScreen> createState() =>
      _ProviderIdentityVerificationScreenState();
}

class _ProviderIdentityVerificationScreenState
    extends State<ProviderIdentityVerificationScreen> {
  static const _service = ProviderWorkspaceService();
  late Future<ProviderWorkspaceProfile> _future;
  // Nationality drives the document type: Malaysian providers verify with an
  // IC (front + back required); foreigners verify with a passport (one
  // photo page is enough).
  String _nationality = 'malaysian';
  final _documentNumberController = TextEditingController();
  PickedBrowserFile? _front;
  PickedBrowserFile? _back;
  bool _submitting = false;
  String _error = '';

  String get _documentType => _nationality == 'foreigner' ? 'passport' : 'ic';

  @override
  void initState() {
    super.initState();
    _future = _service.fetchProfile();
  }

  @override
  void dispose() {
    _documentNumberController.dispose();
    super.dispose();
  }

  Future<void> _pickFront() async {
    final file = await pickAndCropImage(
      toolbarTitle: _nationality == 'foreigner'
          ? 'Crop Passport Photo Page'
          : 'Crop IC Front',
    );
    if (!mounted || file == null) {
      return;
    }
    setState(() => _front = file);
  }

  Future<void> _pickBack() async {
    final file = await pickAndCropImage(toolbarTitle: 'Crop IC Back');
    if (!mounted || file == null) {
      return;
    }
    setState(() => _back = file);
  }

  Future<void> _submit() async {
    final documentNumber = _documentNumberController.text.trim();
    final requiresBack = _nationality != 'foreigner';
    if (_front == null ||
        (requiresBack && _back == null) ||
        documentNumber.isEmpty) {
      return;
    }
    setState(() {
      _submitting = true;
      _error = '';
    });
    try {
      await _service.updateProfile(
        identityVerified: false,
        identityVerificationStatus: 'processing',
        identityDocumentType: _documentType,
        nationality: _nationality,
        identityDocumentNumber: documentNumber,
        identityFrontImageUrl: _front!.dataUrl,
        identityBackImageUrl: _back?.dataUrl ?? '',
      );
      if (!mounted) {
        return;
      }
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (context) => _SubmissionSuccessDialog(
          title: 'Details Submitted',
          message:
              'Your ${_documentType == 'passport' ? 'Passport' : 'IC'} has been submitted for verification. Your status will show as Processing until our team reviews it.',
        ),
      );
      if (!mounted) {
        return;
      }
      Navigator.of(context).pop();
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _error = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const SwiperAppBar(
        title: 'IC / Passport Verification',
        subtitle: 'Upload identity documents for review',
        showBack: true,
      ),
      body: FutureBuilder<ProviderWorkspaceProfile>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const LoadingState(
              label: 'Loading identity verification...',
            );
          }
          if (snapshot.hasError || snapshot.data == null) {
            return const EmptyState(
              title: 'Unable to load verification',
              subtitle: 'Please try again.',
              icon: Icons.error_outline_rounded,
            );
          }
          final profile = snapshot.data!;
          final identityStatus = profile.identityVerificationStatus;
          final locked =
              profile.identityVerified || identityStatus == 'processing';
          if (profile.nationality.isNotEmpty) {
            _nationality = profile.nationality;
          } else if (profile.identityDocumentType == 'passport') {
            _nationality = 'foreigner';
          }
          if (_documentNumberController.text.isEmpty &&
              profile.identityDocumentNumber.isNotEmpty) {
            _documentNumberController.text = profile.identityDocumentNumber;
          }
          final isForeigner = _nationality == 'foreigner';

          return ListView(
            padding: AppSpacing.screenPadding,
            children: [
              if (profile.identityVerified)
                _notice(
                  'IC / Passport verified. No further action is needed.',
                  AppColors.success,
                  const Color(0xFFECFDF3),
                ),
              if (identityStatus == 'processing') ...[
                if (profile.identityVerified)
                  const SizedBox(height: AppSpacing.sm),
                _notice(
                  'Your IC / Passport successfully submitted for verification. It will take up to 24 hours to activate.',
                  const Color(0xFF4338CA),
                  const Color(0xFFEEF2FF),
                ),
              ],
              if (identityStatus == 'rejected') ...[
                if (profile.identityVerified || identityStatus == 'processing')
                  const SizedBox(height: AppSpacing.sm),
                _notice(
                  'Your previous identity verification was rejected. Please upload your IC / Passport again.',
                  const Color(0xFFBE123C),
                  const Color(0xFFFFF1F2),
                ),
              ],
              const SizedBox(height: AppSpacing.lg),
              _card(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Nationality',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Row(
                      children: [
                        Expanded(
                          child: _docTypeButton(
                            label: 'Malaysian',
                            active: !isForeigner,
                            disabled: locked,
                            onTap: () =>
                                setState(() => _nationality = 'malaysian'),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: _docTypeButton(
                            label: 'Foreigner',
                            active: isForeigner,
                            disabled: locked,
                            onTap: () =>
                                setState(() => _nationality = 'foreigner'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              _card(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isForeigner ? 'Passport Number' : 'IC Number',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    TextField(
                      controller: _documentNumberController,
                      enabled: !locked,
                      onChanged: (_) => setState(() {}),
                      decoration: InputDecoration(
                        hintText: isForeigner
                            ? 'Enter passport number'
                            : 'Enter IC number',
                        filled: true,
                        fillColor: Colors.white,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(
                            AppSpacing.radiusMd,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              _card(
                child: Column(
                  children: [
                    _docUploadCard(
                      context,
                      title: isForeigner ? 'Passport Photo Page' : 'IC Front',
                      subtitle: isForeigner
                          ? 'Upload clear image of the passport photo page'
                          : 'Upload clear image of front side',
                      file: _front,
                      locked: locked,
                      onTap: _pickFront,
                    ),
                    if (!isForeigner) ...[
                      const SizedBox(height: AppSpacing.md),
                      _docUploadCard(
                        context,
                        title: 'IC Back',
                        subtitle: 'Upload clear image of back side',
                        file: _back,
                        locked: locked,
                        onTap: _pickBack,
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              _card(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Text(
                      'Image Requirements',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    SizedBox(height: AppSpacing.sm),
                    Text(
                      'Ensure the full IC or passport page is visible within the frame',
                    ),
                    SizedBox(height: 4),
                    Text('All text must be clear and readable'),
                    SizedBox(height: 4),
                    Text('Image must be in focus and not blurry'),
                    SizedBox(height: 4),
                    Text('No glare or reflections on the card'),
                  ],
                ),
              ),
              if (_error.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.lg),
                _notice(_error, AppColors.error, const Color(0xFFFFF1F2)),
              ],
              const SizedBox(height: AppSpacing.lg),
              FilledButton(
                onPressed:
                    locked ||
                        _front == null ||
                        (!isForeigner && _back == null) ||
                        _documentNumberController.text.trim().isEmpty ||
                        _submitting
                    ? null
                    : _submit,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  minimumSize: const Size.fromHeight(52),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                  ),
                ),
                child: Text(
                  locked
                      ? 'Submitted for Review'
                      : _submitting
                      ? 'Submitting...'
                      : 'Submit for Verification',
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _docTypeButton({
    required String label,
    required bool active,
    required bool disabled,
    required VoidCallback onTap,
  }) {
    return OutlinedButton(
      onPressed: disabled ? null : onTap,
      style: OutlinedButton.styleFrom(
        backgroundColor: active ? AppColors.primarySoft : Colors.white,
        foregroundColor: active ? AppColors.primary : AppColors.textSecondary,
        side: BorderSide(color: active ? AppColors.primary : AppColors.border),
        minimumSize: const Size.fromHeight(48),
      ),
      child: Text(label),
    );
  }

  /// Locally-picked files carry a `data:<mime>;base64,...` URL, not a real
  /// network URL — rendering that through [Image.network] either fails to
  /// load or, for a multi-hundred-KB base64 string, can crash the app. Only
  /// already-uploaded/stored files (a real https URL) go through
  /// [Image.network]; anything else is decoded and shown via [Image.memory].
  Widget _buildDocPreview(String dataUrl) {
    if (dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) {
      return Image.network(
        dataUrl,
        width: 110,
        height: 90,
        fit: BoxFit.cover,
        errorBuilder: (context, error, stackTrace) =>
            _docPreviewFallback(Icons.image_not_supported_outlined),
      );
    }

    final bytes = _decodeDataUrlBytes(dataUrl);
    if (bytes == null) {
      return _docPreviewFallback(Icons.image_not_supported_outlined);
    }
    return Image.memory(bytes, width: 110, height: 90, fit: BoxFit.cover);
  }

  Widget _docPreviewFallback(IconData icon) {
    return Container(
      width: 110,
      height: 90,
      color: const Color(0xFFF8F4FF),
      alignment: Alignment.center,
      child: Icon(icon, color: AppColors.primary),
    );
  }

  Widget _docUploadCard(
    BuildContext context, {
    required String title,
    required String subtitle,
    required PickedBrowserFile? file,
    required bool locked,
    required VoidCallback onTap,
  }) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: const Color(0xFFFDFBFF),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFDCCFF3)),
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(14),
            child: file == null
                ? Container(
                    width: 110,
                    height: 90,
                    color: const Color(0xFFF8F4FF),
                    alignment: Alignment.center,
                    child: const Icon(
                      Icons.badge_outlined,
                      color: AppColors.primary,
                      size: 32,
                    ),
                  )
                : _buildDocPreview(file.dataUrl),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
                if (file != null) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    file.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
                const SizedBox(height: AppSpacing.sm),
                OutlinedButton.icon(
                  onPressed: locked ? null : onTap,
                  icon: const Icon(Icons.upload_outlined),
                  label: Text(file == null ? 'Upload' : 'Change'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A modal, non-dismissible-by-tapping-outside confirmation shown right
/// after a successful submission — closed only via its own small close
/// button, at which point the caller pops back to wherever shows the
/// resulting status (e.g. the Verification hub).
class _SubmissionSuccessDialog extends StatefulWidget {
  const _SubmissionSuccessDialog({required this.title, required this.message});

  final String title;
  final String message;

  @override
  State<_SubmissionSuccessDialog> createState() =>
      _SubmissionSuccessDialogState();
}

class _SubmissionSuccessDialogState extends State<_SubmissionSuccessDialog>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  bool _started = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 550),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) {
      return;
    }
    _started = true;
    if (AppMotion.reduceMotion(context)) {
      _controller.value = 1;
    } else {
      _controller.forward();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final iconScale = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOutBack,
    );
    final textFade = CurvedAnimation(
      parent: _controller,
      curve: const Interval(0.35, 1.0, curve: Curves.easeOut),
    );

    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 32),
      child: Container(
        padding: const EdgeInsets.fromLTRB(24, 12, 24, 28),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(28),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Align(
              alignment: Alignment.topRight,
              child: IconButton(
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(
                  Icons.close_rounded,
                  color: AppColors.textSecondary,
                ),
                visualDensity: VisualDensity.compact,
              ),
            ),
            ScaleTransition(
              scale: Tween<double>(begin: 0.5, end: 1.0).animate(iconScale),
              child: Container(
                width: 84,
                height: 84,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.successSurface,
                ),
                child: const Icon(
                  Icons.check_rounded,
                  color: AppColors.success,
                  size: 46,
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            FadeTransition(
              opacity: textFade,
              child: Text(
                widget.title,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              ),
            ),
            const SizedBox(height: 8),
            FadeTransition(
              opacity: textFade,
              child: Text(
                widget.message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 13.5,
                  color: AppColors.textSecondary,
                  height: 1.4,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProviderOtpVerificationScaffold extends StatefulWidget {
  const _ProviderOtpVerificationScaffold({
    required this.title,
    required this.description,
    required this.future,
    required this.fieldLabel,
    required this.fieldHint,
    required this.keyboardType,
    required this.statusSelector,
    required this.onSeedValue,
    required this.fieldController,
    required this.otpController,
    required this.otpSent,
    required this.countdown,
    required this.idleMessage,
    required this.notice,
    required this.onSendOtp,
    required this.onVerify,
    this.leadingPrefix,
  });

  final String title;
  final String description;
  final Future<ProviderWorkspaceProfile> future;
  final String fieldLabel;
  final String fieldHint;
  final TextInputType keyboardType;
  final bool Function(ProviderWorkspaceProfile) statusSelector;
  final void Function(ProviderWorkspaceProfile) onSeedValue;
  final TextEditingController fieldController;
  final TextEditingController otpController;
  final bool otpSent;
  final int countdown;
  final String idleMessage;
  final String notice;
  final VoidCallback onSendOtp;
  final VoidCallback onVerify;
  final Widget? leadingPrefix;

  @override
  State<_ProviderOtpVerificationScaffold> createState() =>
      _ProviderOtpVerificationScaffoldState();
}

class _ProviderOtpVerificationScaffoldState
    extends State<_ProviderOtpVerificationScaffold> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: SwiperAppBar(
        title: widget.title,
        subtitle: widget.description,
        showBack: true,
      ),
      body: FutureBuilder<ProviderWorkspaceProfile>(
        future: widget.future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const LoadingState(label: 'Loading verification...');
          }
          if (snapshot.hasError || snapshot.data == null) {
            return const EmptyState(
              title: 'Unable to load verification',
              subtitle: 'Please try again.',
              icon: Icons.error_outline_rounded,
            );
          }
          final profile = snapshot.data!;
          widget.onSeedValue(profile);
          final verified = widget.statusSelector(profile);
          final value = widget.fieldController.text.trim();
          final canSend = widget.keyboardType == TextInputType.emailAddress
              ? RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(value)
              : value.length >= 7;
          final canVerify =
              canSend && widget.otpController.text.trim().length == 6;

          return ListView(
            padding: AppSpacing.screenPadding,
            children: [
              _card(
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        verified ? 'Verified' : 'Pending',
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.w800),
                      ),
                    ),
                    SwiperStatusBadge(
                      label: verified ? 'Verified' : 'Pending',
                      tone: verified
                          ? SwiperStatusTone.success
                          : SwiperStatusTone.warning,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              _card(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.fieldLabel,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    TextField(
                      controller: widget.fieldController,
                      keyboardType: widget.keyboardType,
                      onChanged: (_) => setState(() {}),
                      decoration: InputDecoration(
                        prefixIcon: widget.leadingPrefix == null
                            ? const Icon(Icons.mail_outline_rounded)
                            : null,
                        prefix: widget.leadingPrefix == null
                            ? null
                            : Padding(
                                padding: const EdgeInsets.only(right: 8),
                                child: widget.leadingPrefix,
                              ),
                        hintText: widget.fieldHint,
                        filled: true,
                        fillColor: Colors.white,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(
                            AppSpacing.radiusMd,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: canSend ? widget.onSendOtp : null,
                        icon: const Icon(Icons.send_outlined),
                        label: const Text('Send OTP'),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    Text(
                      'Enter OTP',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    TextField(
                      controller: widget.otpController,
                      keyboardType: TextInputType.number,
                      maxLength: 6,
                      onChanged: (_) => setState(() {}),
                      decoration: InputDecoration(
                        counterText: '',
                        hintText: 'Enter 6-digit code',
                        filled: true,
                        fillColor: Colors.white,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(
                            AppSpacing.radiusMd,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      widget.notice.isEmpty
                          ? widget.idleMessage
                          : widget.notice,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Resend code in 00:${widget.countdown.toString().padLeft(2, '0')}',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              _card(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.shield_outlined, color: AppColors.primary),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Text(
                        widget.keyboardType == TextInputType.emailAddress
                            ? 'Your email address will be used for account verification and important updates.'
                            : 'Your phone number will be used for account verification and important security alerts.',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              FilledButton(
                onPressed: canVerify ? widget.onVerify : null,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  minimumSize: const Size.fromHeight(52),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                  ),
                ),
                child: Text(
                  widget.keyboardType == TextInputType.emailAddress
                      ? 'Verify Email'
                      : 'Verify Number',
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

Widget _card({required Widget child}) {
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

Widget _notice(String text, Color color, Color background) {
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

Widget _circleIconButton({
  required IconData icon,
  required VoidCallback onTap,
}) {
  return InkWell(
    borderRadius: BorderRadius.circular(999),
    onTap: onTap,
    child: Ink(
      width: 40,
      height: 40,
      decoration: const BoxDecoration(
        color: Color(0xFFF4FAF5),
        shape: BoxShape.circle,
      ),
      child: Icon(icon, size: 18),
    ),
  );
}

Widget _moreTile(
  BuildContext context, {
  required IconData icon,
  required String title,
  required String subtitle,
  required VoidCallback onTap,
  String? statusLabel,
  Color? statusColor,
  bool isLast = false,
}) {
  return Container(
    margin: EdgeInsets.only(bottom: isLast ? 0 : AppSpacing.sm),
    decoration: BoxDecoration(
      border: Border(
        bottom: isLast
            ? BorderSide.none
            : const BorderSide(color: Color(0xFFF0EAF8)),
      ),
    ),
    child: ListTile(
      contentPadding: EdgeInsets.zero,
      onTap: onTap,
      leading: Container(
        width: 46,
        height: 46,
        decoration: const BoxDecoration(
          color: AppColors.primarySoft,
          shape: BoxShape.circle,
        ),
        child: Icon(icon, color: AppColors.primary),
      ),
      title: Text(
        title,
        style: Theme.of(
          context,
        ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
      ),
      subtitle: Text(
        subtitle,
        style: Theme.of(
          context,
        ).textTheme.bodySmall?.copyWith(color: AppColors.textSecondary),
      ),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (statusLabel != null) ...[
            Text(
              statusLabel,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: statusColor ?? AppColors.textSecondary,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(width: 6),
          ],
          const Icon(Icons.chevron_right_rounded, color: AppColors.primary),
        ],
      ),
    ),
  );
}

class _CalendarCell {
  const _CalendarCell({required this.day, required this.key});
  const _CalendarCell.empty() : day = null, key = null;

  final int? day;
  final String? key;
}

class _CalendarDateCell extends StatelessWidget {
  const _CalendarDateCell({
    required this.cell,
    required this.active,
    required this.count,
    required this.onTap,
  });

  final _CalendarCell cell;
  final bool active;
  final int count;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Ink(
        width: 44,
        height: 56,
        decoration: BoxDecoration(
          color: cell.key == null
              ? Colors.transparent
              : active
              ? AppColors.success
              : const Color(0xFFF8FBF9),
          borderRadius: BorderRadius.circular(14),
        ),
        child: cell.key == null
            ? const SizedBox.shrink()
            : Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    '${cell.day}',
                    style: TextStyle(
                      color: active ? Colors.white : AppColors.textPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '$count',
                    style: TextStyle(
                      fontSize: 10,
                      color: active
                          ? Colors.white70
                          : count > 0
                          ? AppColors.success
                          : const Color(0xFFCBD5E1),
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

class _WeekLabel extends StatelessWidget {
  const _WeekLabel(this.label);
  final String label;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Text(
        label,
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
          color: const Color(0xFF94A3B8),
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

SwiperStatusTone _bookingTone(String status) {
  switch (status) {
    case 'accepted':
    case 'on_the_way':
    case 'arrived':
    case 'work_finished_by_provider':
    case 'work_confirmed_by_user':
    case 'final_payment_sent':
    case 'cash_paid_by_user':
    case 'payment_received_by_provider':
      return SwiperStatusTone.success;
    case 'completed':
    case 'paid':
    case 'review_requested':
    case 'reviewed':
      return SwiperStatusTone.info;
    case 'declined':
    case 'declined_by_provider':
    case 'cancelled':
      return SwiperStatusTone.error;
    default:
      return SwiperStatusTone.warning;
  }
}

Widget _infoLine(IconData icon, String label) {
  return Row(
    children: [
      Icon(icon, size: 16, color: AppColors.success),
      const SizedBox(width: AppSpacing.xs),
      Expanded(child: Text(label)),
    ],
  );
}

String _timeOnly(String date, String time) {
  if (date.isEmpty || time.isEmpty) {
    return '-';
  }
  try {
    return DateFormat('h:mm a').format(DateTime.parse('${date}T$time'));
  } catch (_) {
    return time;
  }
}

String _formatDisplayDate(String date) {
  if (date.isEmpty) {
    return 'Select a date';
  }
  try {
    return DateFormat('d MMM yyyy').format(DateTime.parse(date));
  } catch (_) {
    return date;
  }
}

String _relativeTime(String value) {
  if (value.isEmpty) {
    return '';
  }
  try {
    final date = DateTime.parse(value);
    final diff = DateTime.now().difference(date);
    if (diff.inMinutes < 60) {
      return '${diff.inMinutes.clamp(1, 59)} min ago';
    }
    if (diff.inHours < 24) {
      return '${diff.inHours} hr ago';
    }
    return '${diff.inDays} day${diff.inDays == 1 ? '' : 's'} ago';
  } catch (_) {
    return value;
  }
}

String _messageTime(String value) {
  if (value.isEmpty) {
    return '';
  }
  try {
    return DateFormat('d MMM, h:mm a').format(DateTime.parse(value));
  } catch (_) {
    return value;
  }
}

/// Decodes a `data:<mime>;base64,<...>` URL into raw bytes for
/// [Image.memory]. Returns null for anything else.
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
