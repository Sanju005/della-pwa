import 'package:flutter/material.dart';

import '../../../core/routing/app_routes.dart';
import '../../../services/browser_file_picker.dart';
import '../../../services/provider_workspace_service.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/loading_state.dart';
import '../../../widgets/swiper_app_bar.dart';

const List<String> _providerServiceOptions = [
  'Chef',
  'Maid',
  'Tutor',
  'Driver',
  'Cleaner',
  'Babysitter',
  'Plumber',
  'Electrician',
  'Other',
];

const List<String> _availabilityDays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

class ProviderServicesScreen extends StatefulWidget {
  const ProviderServicesScreen({super.key});

  @override
  State<ProviderServicesScreen> createState() => _ProviderServicesScreenState();
}

class _ProviderServicesScreenState extends State<ProviderServicesScreen> {
  static const _workspaceService = ProviderWorkspaceService();

  late Future<ProviderWorkspaceProfile> _future;
  String _editingServiceId = '';
  String _serviceType = '';
  final _yearsController = TextEditingController();
  final _hourlyController = TextEditingController();
  final _dailyController = TextEditingController();
  final _specialtiesController = TextEditingController();
  String _serviceImageDataUrl = '';
  String _serviceImageCaption = 'Cover image';
  String _serviceImageFileName = '';
  bool _saving = false;
  String _message = '';
  String _error = '';

  @override
  void initState() {
    super.initState();
    _future = _workspaceService.fetchProfile();
  }

  @override
  void dispose() {
    _yearsController.dispose();
    _hourlyController.dispose();
    _dailyController.dispose();
    _specialtiesController.dispose();
    super.dispose();
  }

  Future<void> _reload() async {
    setState(() {
      _future = _workspaceService.fetchProfile();
    });
  }

  void _startNewService() {
    setState(() {
      _editingServiceId = '';
      _serviceType = '';
      _yearsController.clear();
      _hourlyController.clear();
      _dailyController.clear();
      _specialtiesController.clear();
      _serviceImageDataUrl = '';
      _serviceImageCaption = 'Cover image';
      _serviceImageFileName = '';
      _message = '';
      _error = '';
    });
  }

  void _editService(ProviderWorkspaceServiceModel service) {
    setState(() {
      _editingServiceId = service.id;
      _serviceType = _toTitleCase(service.serviceType);
      _yearsController.text = service.yearsExperience;
      _hourlyController.text = service.hourlyRate.toStringAsFixed(0);
      _dailyController.text = service.dailyRate.toStringAsFixed(0);
      _specialtiesController.text = service.specialties.join(', ');
      _serviceImageDataUrl =
          service.imageDataUrls.isNotEmpty ? service.imageDataUrls.first : '';
      _serviceImageCaption = service.imageCaptions.isNotEmpty
          ? service.imageCaptions.first
          : 'Cover image';
      _serviceImageFileName = '';
      _message = '';
      _error = '';
    });
  }

  Future<void> _pickServiceImage() async {
    final picked = await pickSingleBrowserFile(accept: 'image/*');
    if (!mounted || picked == null) {
      return;
    }
    setState(() {
      _serviceImageDataUrl = picked.dataUrl;
      _serviceImageFileName = picked.name;
      _serviceImageCaption = 'Cover image';
      _error = '';
      _message = '';
    });
  }

  Future<void> _saveService() async {
    final normalizedType = _normalizeServiceType(_serviceType);
    if (normalizedType.isEmpty && _editingServiceId.isEmpty) {
      setState(() => _error = 'Service type is required.');
      return;
    }

    setState(() {
      _saving = true;
      _error = '';
      _message = '';
    });

    try {
      final hourlyRate = double.tryParse(_hourlyController.text.trim()) ?? 0;
      final dailyRate = double.tryParse(_dailyController.text.trim()) ?? 0;
      final specialties = _specialtiesController.text
          .split(',')
          .map((item) => item.trim())
          .where((item) => item.isNotEmpty)
          .toList(growable: false);
      final imageDataUrls = _serviceImageDataUrl.isEmpty
          ? const <String>[]
          : <String>[_serviceImageDataUrl];
      final imageCaptions = imageDataUrls.isEmpty
          ? const <String>[]
          : <String>[_serviceImageCaption];

      final isNewService = _editingServiceId.isEmpty;
      if (isNewService) {
        await _workspaceService.createService(
          serviceType: normalizedType,
          yearsExperience: _yearsController.text.trim(),
          hourlyRate: hourlyRate,
          dailyRate: dailyRate,
          specialties: specialties,
          imageDataUrls: imageDataUrls,
          imageCaptions: imageCaptions,
        );
      } else {
        await _workspaceService.updateService(
          serviceId: _editingServiceId,
          yearsExperience: _yearsController.text.trim(),
          hourlyRate: hourlyRate,
          dailyRate: dailyRate,
          specialties: specialties,
          imageDataUrls: imageDataUrls,
          imageCaptions: imageCaptions,
        );
      }

      await _reload();
      _startNewService();
      if (!mounted) {
        return;
      }
      setState(() {
        _message = isNewService ? 'New service added.' : 'Service updated.';
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
        title: 'My Services',
        subtitle: 'Manage provider services and pricing',
        showBack: true,
      ),
      body: FutureBuilder<ProviderWorkspaceProfile>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const LoadingState(label: 'Loading provider services...');
          }
          if (snapshot.hasError || snapshot.data == null) {
            return const EmptyState(
              title: 'Unable to load services',
              subtitle: 'Please try again.',
              icon: Icons.error_outline_rounded,
            );
          }

          final profile = snapshot.data!;
          return ListView(
            padding: AppSpacing.screenPadding,
            children: [
              _reactSection(
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
                                'Need to edit days and time?',
                                style: Theme.of(context)
                                    .textTheme
                                    .titleMedium
                                    ?.copyWith(fontWeight: FontWeight.w800),
                              ),
                              const SizedBox(height: AppSpacing.xs),
                              Text(
                                'Booking days and working hours are managed in your availability settings.',
                                style: Theme.of(context)
                                    .textTheme
                                    .bodySmall
                                    ?.copyWith(color: AppColors.textSecondary),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        FilledButton(
                          onPressed: () => Navigator.of(context).pushNamed(
                            AppRoutes.providerAvailability,
                          ),
                          style: FilledButton.styleFrom(
                            backgroundColor: AppColors.success,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius:
                                  BorderRadius.circular(AppSpacing.radiusSm),
                            ),
                          ),
                          child: const Text('Back'),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    if (profile.services.isEmpty)
                      const EmptyState(
                        title: 'No services added yet',
                        subtitle:
                            'Your registered provider services will appear here.',
                        icon: Icons.work_outline_rounded,
                      )
                    else
                      ...profile.services.map(
                        (service) => Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.md),
                          child: _serviceCard(context, service),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              _reactSection(
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
                                _editingServiceId.isEmpty
                                    ? 'Add New Service'
                                    : 'Edit Service',
                                style: Theme.of(context)
                                    .textTheme
                                    .titleMedium
                                    ?.copyWith(fontWeight: FontWeight.w800),
                              ),
                              const SizedBox(height: AppSpacing.xs),
                              Text(
                                'Save pricing and specialties directly to your provider listing.',
                                style: Theme.of(context)
                                    .textTheme
                                    .bodySmall
                                    ?.copyWith(color: AppColors.textSecondary),
                              ),
                            ],
                          ),
                        ),
                        if (_editingServiceId.isNotEmpty)
                          TextButton(
                            onPressed: _startNewService,
                            child: const Text('Cancel'),
                          ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.md),
                    _inputCard(
                      child: DropdownButtonFormField<String>(
                        value: _serviceType.isEmpty ? null : _serviceType,
                        decoration:
                            _fieldDecoration('Service Type', compact: true),
                        items: _providerServiceOptions
                            .map(
                              (option) => DropdownMenuItem<String>(
                                value: option,
                                child: Text(option),
                              ),
                            )
                            .toList(growable: false),
                        onChanged: _editingServiceId.isNotEmpty
                            ? null
                            : (value) => setState(() => _serviceType = value ?? ''),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Row(
                      children: [
                        Expanded(
                          child: _textField(
                            controller: _hourlyController,
                            label: 'Hourly Rate',
                            hint: '40',
                            keyboardType: TextInputType.number,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: _textField(
                            controller: _dailyController,
                            label: 'Daily Rate',
                            hint: '250',
                            keyboardType: TextInputType.number,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    _textField(
                      controller: _yearsController,
                      label: 'Experience',
                      hint: '5 Years',
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    _textField(
                      controller: _specialtiesController,
                      label: 'Specialties',
                      hint: 'Malay, Arabic, Event catering',
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    _uploadCard(context),
                    if (_error.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.md),
                      _noticeCard(_error, AppColors.error, const Color(0xFFFFF1F2)),
                    ],
                    if (_message.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.md),
                      _noticeCard(
                        _message,
                        AppColors.success,
                        const Color(0xFFF0FDF4),
                      ),
                    ],
                    const SizedBox(height: AppSpacing.md),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: _saving ? null : _saveService,
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          minimumSize: const Size.fromHeight(52),
                          shape: RoundedRectangleBorder(
                            borderRadius:
                                BorderRadius.circular(AppSpacing.radiusMd),
                          ),
                        ),
                        child: Text(
                          _saving
                              ? 'Saving...'
                              : _editingServiceId.isEmpty
                                  ? 'Add New Service'
                                  : 'Save Changes',
                        ),
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

  Widget _serviceCard(
    BuildContext context,
    ProviderWorkspaceServiceModel service,
  ) {
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
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _toTitleCase(service.serviceType),
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                            color: AppColors.textPrimary,
                          ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'RM${service.hourlyRate.toStringAsFixed(0)}/hr • RM${service.dailyRate.toStringAsFixed(0)}/day',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  ],
                ),
              ),
              IconButton(
                onPressed: () => _editService(service),
                icon: const Icon(Icons.edit_outlined, color: AppColors.success),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            service.yearsExperience.isEmpty
                ? 'Experience not set'
                : service.yearsExperience,
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            service.specialties.isEmpty
                ? 'No specialties added yet.'
                : service.specialties.join(', '),
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: AppColors.textSecondary),
          ),
          if (service.imageDataUrls.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Image.network(
                service.imageDataUrls.first,
                height: 140,
                width: double.infinity,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => _imagePlaceholder(),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _uploadCard(BuildContext context) {
    return _inputCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _editingServiceId.isEmpty ? 'Service Image' : 'Current Service Image',
            style: Theme.of(context)
                .textTheme
                .labelLarge
                ?.copyWith(color: AppColors.textSecondary),
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(14),
                child: _serviceImageDataUrl.isEmpty
                    ? _imagePlaceholder()
                    : Image.network(
                        _serviceImageDataUrl,
                        height: 96,
                        width: 112,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => _imagePlaceholder(),
                      ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _editingServiceId.isEmpty
                          ? 'Upload a cover image for this service.'
                          : 'Replace the current service cover image.',
                      style: Theme.of(context)
                          .textTheme
                          .bodySmall
                          ?.copyWith(color: AppColors.textSecondary),
                    ),
                    if (_serviceImageFileName.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        _serviceImageFileName,
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
                      onPressed: _pickServiceImage,
                      icon: const Icon(Icons.upload_outlined),
                      label: Text(
                        _editingServiceId.isEmpty
                            ? 'Upload Service Image'
                            : 'Change Service Image',
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class ProviderAvailabilityScreen extends StatefulWidget {
  const ProviderAvailabilityScreen({super.key});

  @override
  State<ProviderAvailabilityScreen> createState() =>
      _ProviderAvailabilityScreenState();
}

class _ProviderAvailabilityScreenState extends State<ProviderAvailabilityScreen> {
  static const _workspaceService = ProviderWorkspaceService();

  late Future<ProviderAvailabilitySnapshot> _future;
  bool _enabled = true;
  final Map<String, _DaySetting> _daySettings = {
    for (final day in _availabilityDays)
      day: const _DaySetting(
        selected: false,
        startTime: '08:00',
        endTime: '20:00',
      ),
  };
  bool _initialized = false;
  bool _saving = false;
  String _message = '';
  String _error = '';

  @override
  void initState() {
    super.initState();
    _future = _workspaceService.fetchAvailability();
  }

  void _applySnapshot(ProviderAvailabilitySnapshot snapshot) {
    if (_initialized) {
      return;
    }
    _enabled = snapshot.enabled;
    for (final day in _availabilityDays) {
      _daySettings[day] = const _DaySetting(
        selected: false,
        startTime: '08:00',
        endTime: '20:00',
      );
    }
    for (final entry in snapshot.entries) {
      _daySettings[entry.day] = _DaySetting(
        selected: true,
        startTime: entry.startTime,
        endTime: entry.endTime,
      );
    }
    _initialized = true;
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _message = '';
      _error = '';
    });
    try {
      final entries = _availabilityDays
          .where((day) => _daySettings[day]?.selected == true)
          .map(
            (day) => ProviderAvailabilityEntry(
              id: '',
              day: day,
              dayKey: day.toLowerCase(),
              timeMode: 'custom',
              startTime: _daySettings[day]!.startTime,
              endTime: _daySettings[day]!.endTime,
            ),
          )
          .toList(growable: false);
      await _workspaceService.saveAvailability(
        enabled: _enabled,
        entries: entries,
      );
      setState(() {
        _message = _enabled
            ? 'Availability saved to your live provider profile.'
            : 'Provider visibility is now paused.';
      });
    } catch (error) {
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
        title: 'Availability',
        subtitle: 'Set days and hours for customer bookings',
        showBack: true,
      ),
      body: FutureBuilder<ProviderAvailabilitySnapshot>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const LoadingState(label: 'Loading provider availability...');
          }
          if (snapshot.hasError || snapshot.data == null) {
            return const EmptyState(
              title: 'Unable to load availability',
              subtitle: 'Please try again.',
              icon: Icons.error_outline_rounded,
            );
          }

          _applySnapshot(snapshot.data!);

          return ListView(
            padding: AppSpacing.screenPadding,
            children: [
              _reactSection(
                child: Column(
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              RichText(
                                text: TextSpan(
                                  style: Theme.of(context)
                                      .textTheme
                                      .titleMedium
                                      ?.copyWith(
                                        fontWeight: FontWeight.w800,
                                        color: AppColors.textPrimary,
                                      ),
                                  children: [
                                    const TextSpan(text: 'You are '),
                                    TextSpan(
                                      text: _enabled ? 'Available' : 'Offline',
                                      style: const TextStyle(
                                        color: AppColors.success,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: AppSpacing.xs),
                              Text(
                                'Customers can book you only when availability is enabled.',
                                style: Theme.of(context)
                                    .textTheme
                                    .bodySmall
                                    ?.copyWith(color: AppColors.textSecondary),
                              ),
                            ],
                          ),
                        ),
                        Switch(
                          value: _enabled,
                          activeColor: AppColors.success,
                          onChanged: (value) => setState(() => _enabled = value),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    Row(
                      children: [
                        Text(
                          'Select Days',
                          style: Theme.of(context)
                              .textTheme
                              .titleMedium
                              ?.copyWith(fontWeight: FontWeight.w800),
                        ),
                        const Spacer(),
                        TextButton(
                          onPressed: () {
                            setState(() {
                              for (final day in _availabilityDays) {
                                final current = _daySettings[day]!;
                                _daySettings[day] =
                                    current.copyWith(selected: true);
                              }
                            });
                          },
                          child: const Text('Select all'),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    ..._availabilityDays.map(
                      (day) => Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                        child: _dayCard(context, day),
                      ),
                    ),
                    if (_error.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.md),
                      _noticeCard(_error, AppColors.error, const Color(0xFFFFF1F2)),
                    ],
                    if (_message.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.md),
                      _noticeCard(
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
                            borderRadius:
                                BorderRadius.circular(AppSpacing.radiusMd),
                          ),
                        ),
                        child: Text(_saving ? 'Saving...' : 'Save Availability'),
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

  Widget _dayCard(BuildContext context, String day) {
    final setting = _daySettings[day]!;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: setting.selected
            ? const Color(0xFFF6FFF8)
            : const Color(0xFFFBFFFC),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: setting.selected
              ? const Color(0xFFB7E4C4)
              : const Color(0xFFE7EEE8),
        ),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  day,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ),
              Checkbox(
                value: setting.selected,
                activeColor: AppColors.success,
                onChanged: (value) {
                  setState(() {
                    _daySettings[day] =
                        setting.copyWith(selected: value ?? false);
                  });
                },
              ),
            ],
          ),
          if (setting.selected) ...[
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Expanded(
                  child: _timeField(
                    context,
                    label: 'Start',
                    value: setting.startTime,
                    onTap: () => _pickTime(day, true),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: _timeField(
                    context,
                    label: 'End',
                    value: setting.endTime,
                    onTap: () => _pickTime(day, false),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _timeField(
    BuildContext context, {
    required String label,
    required String value,
    required VoidCallback onTap,
  }) {
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: onTap,
      child: Ink(
        padding: const EdgeInsets.all(AppSpacing.sm),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFDBEEE2)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: Theme.of(context)
                  .textTheme
                  .labelMedium
                  ?.copyWith(color: AppColors.textSecondary),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              value,
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickTime(String day, bool start) async {
    final current = _daySettings[day]!;
    final value = start ? current.startTime : current.endTime;
    final pieces = value.split(':');
    final initial = TimeOfDay(
      hour: int.tryParse(pieces.first) ?? 8,
      minute: int.tryParse(pieces.last) ?? 0,
    );
    final picked = await showTimePicker(
      context: context,
      initialTime: initial,
    );
    if (!mounted || picked == null) {
      return;
    }
    final formatted =
        '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
    setState(() {
      _daySettings[day] = start
          ? current.copyWith(startTime: formatted)
          : current.copyWith(endTime: formatted);
    });
  }
}

class ProviderReviewsScreen extends StatelessWidget {
  const ProviderReviewsScreen({super.key});

  static const _workspaceService = ProviderWorkspaceService();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const SwiperAppBar(
        title: 'Reviews',
        subtitle: 'Customer feedback from completed jobs',
        showBack: true,
      ),
      body: FutureBuilder<List<ProviderReviewItem>>(
        future: _workspaceService.fetchReviews(),
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const LoadingState(label: 'Loading provider reviews...');
          }
          if (snapshot.hasError) {
            return const EmptyState(
              title: 'Unable to load reviews',
              subtitle: 'Please try again.',
              icon: Icons.error_outline_rounded,
            );
          }

          final reviews = snapshot.data ?? const [];
          final average = reviews.isEmpty
              ? 0.0
              : reviews.fold<int>(0, (sum, item) => sum + item.rating) /
                  reviews.length;

          return ListView(
            padding: AppSpacing.screenPadding,
            children: [
              _reactSection(
                child: Row(
                  children: [
                    Expanded(
                      child: _metricBox(
                        context,
                        value: average.toStringAsFixed(1),
                        label: 'Average rating',
                        subtitle: '${reviews.length} total reviews',
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: _metricBox(
                        context,
                        value: '${reviews.where((item) => item.rating >= 4).length}',
                        label: '4★ and above',
                        subtitle: 'Strong customer satisfaction',
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              _reactSection(
                child: reviews.isEmpty
                    ? const EmptyState(
                        title: 'No provider reviews yet',
                        subtitle: 'Customer feedback will appear here.',
                        icon: Icons.star_border_rounded,
                      )
                    : Column(
                        children: reviews
                            .map(
                              (review) => Padding(
                                padding: const EdgeInsets.only(
                                  bottom: AppSpacing.md,
                                ),
                                child: _reviewCard(context, review),
                              ),
                            )
                            .toList(growable: false),
                      ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _metricBox(
    BuildContext context, {
    required String value,
    required String label,
    required String subtitle,
  }) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: const Color(0xFFFCFAFF),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFEEE5F7)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w900,
                  color: AppColors.primary,
                ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            label,
            style: Theme.of(context)
                .textTheme
                .bodyMedium
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 4),
          Text(
            subtitle,
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }

  Widget _reviewCard(BuildContext context, ProviderReviewItem review) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFEEE5F7)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  review.customerName,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                ),
              ),
              Text(
                review.createdLabel.isEmpty ? review.createdAt : review.createdLabel,
                style: Theme.of(context)
                    .textTheme
                    .bodySmall
                    ?.copyWith(color: AppColors.textSecondary),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Row(
            children: [
              const Icon(Icons.star_rounded, color: Color(0xFFF5B301), size: 18),
              const SizedBox(width: 4),
              Text(
                review.rating.toString(),
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(review.comment),
        ],
      ),
    );
  }
}

class _DaySetting {
  const _DaySetting({
    required this.selected,
    required this.startTime,
    required this.endTime,
  });

  final bool selected;
  final String startTime;
  final String endTime;

  _DaySetting copyWith({
    bool? selected,
    String? startTime,
    String? endTime,
  }) {
    return _DaySetting(
      selected: selected ?? this.selected,
      startTime: startTime ?? this.startTime,
      endTime: endTime ?? this.endTime,
    );
  }
}

Widget _reactSection({required Widget child}) {
  return Container(
    padding: const EdgeInsets.all(AppSpacing.md),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(26),
      border: Border.all(color: const Color(0xFFEEE5F7)),
      boxShadow: const [
        BoxShadow(
          color: Color(0x140F0B1F),
          blurRadius: 24,
          offset: Offset(0, 10),
        ),
      ],
    ),
    child: child,
  );
}

Widget _inputCard({required Widget child}) {
  return Container(
    padding: const EdgeInsets.all(AppSpacing.sm),
    decoration: BoxDecoration(
      color: const Color(0xFFFBFFFC),
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: const Color(0xFFE7EEE8)),
    ),
    child: child,
  );
}

InputDecoration _fieldDecoration(String label, {bool compact = false}) {
  return InputDecoration(
    labelText: label,
    isDense: compact,
    border: InputBorder.none,
    contentPadding: EdgeInsets.zero,
  );
}

Widget _textField({
  required TextEditingController controller,
  required String label,
  String hint = '',
  TextInputType keyboardType = TextInputType.text,
}) {
  return _inputCard(
    child: TextField(
      controller: controller,
      keyboardType: keyboardType,
      decoration: _fieldDecoration(label).copyWith(hintText: hint),
    ),
  );
}

Widget _noticeCard(String message, Color color, Color background) {
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
      style: TextStyle(
        color: color,
        fontWeight: FontWeight.w600,
      ),
    ),
  );
}

Widget _imagePlaceholder() {
  return Container(
    height: 96,
    width: 112,
    color: const Color(0xFFF8F4FF),
    alignment: Alignment.center,
    child: const Icon(
      Icons.work_outline_rounded,
      color: AppColors.primary,
      size: 32,
    ),
  );
}

String _normalizeServiceType(String value) {
  return value.trim().toLowerCase().replaceAll(' ', '_');
}

String _toTitleCase(String value) {
  return value
      .replaceAll('_', ' ')
      .split(' ')
      .where((part) => part.isNotEmpty)
      .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
      .join(' ');
}
