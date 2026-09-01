import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';

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
  List<String> _serviceImageDataUrls = const [];
  List<String> _serviceImageCaptions = const [];
  List<String> _serviceImageFileNames = const [];
  List<String> _certificateDataUrls = const [];
  List<String> _certificateCaptions = const [];
  List<String> _certificateFileNames = const [];
  bool _showServiceForm = false;
  bool _saving = false;
  String _message = '';
  String _error = '';
  // Id of the service currently being deleted, if any — lets just that
  // card's delete button show a spinner without disabling the whole screen.
  String _deleting = '';

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
      _showServiceForm = false;
      _editingServiceId = '';
      _serviceType = '';
      _yearsController.clear();
      _hourlyController.clear();
      _dailyController.clear();
      _specialtiesController.clear();
      _serviceImageDataUrls = const [];
      _serviceImageCaptions = const [];
      _serviceImageFileNames = const [];
      _certificateDataUrls = const [];
      _certificateCaptions = const [];
      _certificateFileNames = const [];
      _message = '';
      _error = '';
    });
  }

  void _openNewServiceForm() {
    setState(() {
      _showServiceForm = true;
      _editingServiceId = '';
      _serviceType = '';
      _yearsController.clear();
      _hourlyController.clear();
      _dailyController.clear();
      _specialtiesController.clear();
      _serviceImageDataUrls = const [];
      _serviceImageCaptions = const [];
      _serviceImageFileNames = const [];
      _certificateDataUrls = const [];
      _certificateCaptions = const [];
      _certificateFileNames = const [];
      _message = '';
      _error = '';
    });
  }

  void _editService(ProviderWorkspaceServiceModel service) {
    setState(() {
      _showServiceForm = true;
      _editingServiceId = service.id;
      _serviceType = _toTitleCase(service.serviceType);
      _yearsController.text = service.yearsExperience;
      _hourlyController.text = service.hourlyRate.toStringAsFixed(0);
      _dailyController.text = service.dailyRate.toStringAsFixed(0);
      _specialtiesController.text = service.specialties.join(', ');
      _serviceImageDataUrls = List<String>.from(service.imageDataUrls);
      _serviceImageCaptions = service.imageCaptions.isNotEmpty
          ? List<String>.from(service.imageCaptions)
          : List<String>.generate(
              service.imageDataUrls.length,
              (index) => 'Work image ${index + 1}',
            );
      _serviceImageFileNames = const [];
      _certificateDataUrls = List<String>.from(service.certificateDataUrls);
      _certificateCaptions = service.certificateCaptions.isNotEmpty
          ? List<String>.from(service.certificateCaptions)
          : List<String>.generate(
              service.certificateDataUrls.length,
              (index) => 'Certificate ${index + 1}',
            );
      _certificateFileNames = const [];
      _message = '';
      _error = '';
    });
  }

  Future<void> _pickServiceImages() async {
    final remainingSlots = 3 - _serviceImageDataUrls.length;
    if (remainingSlots <= 0) {
      setState(() => _error = 'You can upload up to 3 service images.');
      return;
    }
    final picked = await pickMultipleBrowserFiles(
      accept: 'image/*',
      maxFiles: remainingSlots,
    );
    if (!mounted || picked.isEmpty) {
      return;
    }
    setState(() {
      _serviceImageDataUrls = [
        ..._serviceImageDataUrls,
        ...picked.map((file) => file.dataUrl),
      ];
      _serviceImageCaptions = List<String>.generate(
        _serviceImageDataUrls.length,
        (index) => 'Work image ${index + 1}',
      );
      _serviceImageFileNames = [
        ..._serviceImageFileNames,
        ...picked.map((file) => file.name),
      ];
      _error = '';
      _message = '';
    });
  }

  Future<void> _pickCertificates() async {
    final remainingSlots = 3 - _certificateDataUrls.length;
    if (remainingSlots <= 0) {
      setState(() => _error = 'You can upload up to 3 certificates.');
      return;
    }
    final picked = await pickMultipleBrowserFiles(
      accept: 'image/*,application/pdf',
      maxFiles: remainingSlots,
    );
    if (!mounted || picked.isEmpty) {
      return;
    }
    setState(() {
      _certificateDataUrls = [
        ..._certificateDataUrls,
        ...picked.map((file) => file.dataUrl),
      ];
      _certificateCaptions = List<String>.generate(
        _certificateDataUrls.length,
        (index) => 'Certificate ${index + 1}',
      );
      _certificateFileNames = [
        ..._certificateFileNames,
        ...picked.map((file) => file.name),
      ];
      _error = '';
      _message = '';
    });
  }

  void _removeServiceImage(int index) {
    setState(() {
      _serviceImageDataUrls = List<String>.from(_serviceImageDataUrls)
        ..removeAt(index);
      _serviceImageCaptions = List<String>.generate(
        _serviceImageDataUrls.length,
        (itemIndex) => 'Work image ${itemIndex + 1}',
      );
      if (index < _serviceImageFileNames.length) {
        _serviceImageFileNames = List<String>.from(_serviceImageFileNames)
          ..removeAt(index);
      }
    });
  }

  void _removeCertificate(int index) {
    setState(() {
      _certificateDataUrls = List<String>.from(_certificateDataUrls)
        ..removeAt(index);
      _certificateCaptions = List<String>.generate(
        _certificateDataUrls.length,
        (itemIndex) => 'Certificate ${itemIndex + 1}',
      );
      if (index < _certificateFileNames.length) {
        _certificateFileNames = List<String>.from(_certificateFileNames)
          ..removeAt(index);
      }
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
      final imageDataUrls = List<String>.from(_serviceImageDataUrls);
      final imageCaptions = List<String>.from(_serviceImageCaptions);
      final certificateDataUrls = List<String>.from(_certificateDataUrls);
      final certificateCaptions = List<String>.from(_certificateCaptions);

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
          certificateDataUrls: certificateDataUrls,
          certificateCaptions: certificateCaptions,
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
          certificateDataUrls: certificateDataUrls,
          certificateCaptions: certificateCaptions,
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

  Future<void> _confirmDeleteService(
    ProviderWorkspaceServiceModel service,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete this service?'),
        content: Text(
          'This removes "${_toTitleCase(service.serviceType)}" and its photos and certificates from your live listing. This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) {
      return;
    }
    await _deleteService(service);
  }

  Future<void> _deleteService(ProviderWorkspaceServiceModel service) async {
    setState(() {
      _deleting = service.id;
      _error = '';
      _message = '';
    });
    try {
      await _workspaceService.deleteService(serviceId: service.id);
      await _reload();
      if (_editingServiceId == service.id) {
        _startNewService();
      }
      if (!mounted) {
        return;
      }
      setState(() => _message = 'Service deleted.');
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _error = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) {
        setState(() => _deleting = '');
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
                    Container(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [Color(0xFFF8F4FF), Color(0xFFF3FBF7)],
                        ),
                        borderRadius: BorderRadius.circular(22),
                        border: Border.all(
                          color: AppColors.primary.withValues(alpha: 0.10),
                        ),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: _serviceStatTile(
                              context,
                              value: '${profile.services.length}',
                              label: 'Live services',
                              tint: AppColors.primary,
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: _serviceStatTile(
                              context,
                              value:
                                  '${profile.services.fold<int>(0, (sum, item) => sum + item.imageDataUrls.length)}',
                              label: 'Portfolio photos',
                              tint: AppColors.success,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
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
                          child: _premiumServiceCard(context, service),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              if (!_showServiceForm && _editingServiceId.isEmpty)
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: _openNewServiceForm,
                    icon: const Icon(Icons.add_rounded),
                    label: const Text('Add Service +'),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size.fromHeight(52),
                      foregroundColor: AppColors.primary,
                      side: BorderSide(
                        color: AppColors.primary.withValues(alpha: 0.22),
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(
                          AppSpacing.radiusMd,
                        ),
                      ),
                    ),
                  ),
                )
              else
                _reactSection(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(AppSpacing.md),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [Color(0xFFF8F4FF), Colors.white],
                          ),
                          borderRadius: BorderRadius.circular(22),
                          border: Border.all(
                            color: AppColors.primary.withValues(alpha: 0.10),
                          ),
                        ),
                        child: Row(
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
                                        ?.copyWith(fontWeight: FontWeight.w900),
                                  ),
                                  const SizedBox(height: AppSpacing.xs),
                                  Text(
                                    _editingServiceId.isEmpty
                                        ? 'Create another listing with pricing, specialties, photos, and certificates.'
                                        : 'Update this service and save changes directly to your live provider listing.',
                                    style: Theme.of(context).textTheme.bodySmall
                                        ?.copyWith(
                                          color: AppColors.textSecondary,
                                          height: 1.45,
                                        ),
                                  ),
                                ],
                              ),
                            ),
                            TextButton(
                              onPressed: _startNewService,
                              child: const Text('Cancel'),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      DropdownButtonFormField<String>(
                        value: _serviceType.isEmpty ? null : _serviceType,
                        decoration: _cleanFieldDecoration(
                          'Service Type',
                          prefixIcon: Icons.work_outline_rounded,
                        ),
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
                            : (value) =>
                                  setState(() => _serviceType = value ?? ''),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _hourlyController,
                              keyboardType: TextInputType.number,
                              decoration: _cleanFieldDecoration(
                                'Hourly Rate',
                                prefixIcon: Icons.payments_outlined,
                                hint: '40',
                              ),
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: TextField(
                              controller: _dailyController,
                              keyboardType: TextInputType.number,
                              decoration: _cleanFieldDecoration(
                                'Daily Rate',
                                prefixIcon: Icons.calendar_today_outlined,
                                hint: '250',
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      TextField(
                        controller: _yearsController,
                        decoration: _cleanFieldDecoration(
                          'Experience',
                          prefixIcon: Icons.timeline_rounded,
                          hint: '5 Years',
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      TextField(
                        controller: _specialtiesController,
                        decoration: _cleanFieldDecoration(
                          'Specialties',
                          prefixIcon: Icons.star_outline_rounded,
                          hint: 'Deep tissue, Prenatal, Sports massage',
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Separate each specialty with a comma — e.g. Deep tissue, Prenatal, Sports massage.',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      _uploadCard(
                        context,
                        title: 'Service Images',
                        subtitle:
                            'Upload up to 3 service images. Remove old images and upload new images anytime.',
                        dataUrls: _serviceImageDataUrls,
                        fileNames: _serviceImageFileNames,
                        emptyLabel: 'No service images selected',
                        onUpload: _pickServiceImages,
                        onRemove: _removeServiceImage,
                        uploadLabel: 'Upload Photos',
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      _uploadCard(
                        context,
                        title: 'Certificates',
                        subtitle:
                            'Upload up to 3 certificates or proof files. Remove old files and upload new ones anytime.',
                        dataUrls: _certificateDataUrls,
                        fileNames: _certificateFileNames,
                        emptyLabel: 'No certificates selected',
                        onUpload: _pickCertificates,
                        onRemove: _removeCertificate,
                        uploadLabel: 'Upload Certificates',
                      ),
                      if (_error.isNotEmpty) ...[
                        const SizedBox(height: AppSpacing.md),
                        _noticeCard(
                          _error,
                          AppColors.error,
                          const Color(0xFFFFF1F2),
                        ),
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
                              borderRadius: BorderRadius.circular(
                                AppSpacing.radiusMd,
                              ),
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
              const SizedBox(height: AppSpacing.lg),
              const _AvailabilitySection(),
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
                      'RM${service.hourlyRate.toStringAsFixed(0)}/hr - RM${service.dailyRate.toStringAsFixed(0)}/day',
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
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: AppColors.textSecondary),
          ),
          if (service.imageDataUrls.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            SizedBox(
              height: 96,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: service.imageDataUrls.length,
                separatorBuilder: (_, __) =>
                    const SizedBox(width: AppSpacing.sm),
                itemBuilder: (context, index) => ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: Image.network(
                    service.imageDataUrls[index],
                    height: 96,
                    width: 112,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => _imagePlaceholder(),
                  ),
                ),
              ),
            ),
          ],
          if (service.certificateDataUrls.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              '${service.certificateDataUrls.length} certificate file${service.certificateDataUrls.length == 1 ? '' : 's'} attached',
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: AppColors.textSecondary),
            ),
          ],
        ],
      ),
    );
  }

  Widget _premiumServiceCard(
    BuildContext context,
    ProviderWorkspaceServiceModel service,
  ) {
    final chipStyle = Theme.of(context).textTheme.bodySmall?.copyWith(
      color: AppColors.textSecondary,
      fontWeight: FontWeight.w700,
    );
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFFFFFFF), Color(0xFFFCFAFF)],
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFE9E1F4)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x120F0B1F),
            blurRadius: 24,
            offset: Offset(0, 10),
          ),
        ],
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
                        fontWeight: FontWeight.w900,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'RM${service.hourlyRate.toStringAsFixed(0)}/hr - RM${service.dailyRate.toStringAsFixed(0)}/day',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                onPressed: _deleting == service.id
                    ? null
                    : () => _confirmDeleteService(service),
                icon: _deleting == service.id
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(
                        Icons.delete_outline_rounded,
                        color: AppColors.error,
                      ),
                visualDensity: VisualDensity.compact,
              ),
              const SizedBox(width: 4),
              FilledButton.tonal(
                onPressed: () => _editService(service),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primarySoft,
                  foregroundColor: AppColors.primary,
                  visualDensity: VisualDensity.compact,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: const Text('Edit'),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              _miniChip(
                label: service.yearsExperience.isEmpty
                    ? 'Experience not set'
                    : service.yearsExperience,
                background: const Color(0xFFF4EDFF),
                foreground: AppColors.primary,
              ),
              _miniChip(
                label:
                    '${service.imageDataUrls.length} image${service.imageDataUrls.length == 1 ? '' : 's'}',
                background: const Color(0xFFEFFAF5),
                foreground: AppColors.success,
              ),
              if (service.certificateDataUrls.isNotEmpty)
                _miniChip(
                  label:
                      '${service.certificateDataUrls.length} certificate${service.certificateDataUrls.length == 1 ? '' : 's'}',
                  background: const Color(0xFFFFF4E8),
                  foreground: AppColors.warning,
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          if (service.specialties.isEmpty)
            Text('No specialties added yet.', style: chipStyle)
          else
            Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xs,
              children: service.specialties
                  .map(
                    (item) => Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 7,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8F4FF),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(
                          color: AppColors.primary.withValues(alpha: 0.10),
                        ),
                      ),
                      child: Text(item, style: chipStyle),
                    ),
                  )
                  .toList(growable: false),
            ),
          if (service.imageDataUrls.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            SizedBox(
              height: 96,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: service.imageDataUrls.length,
                separatorBuilder: (_, __) =>
                    const SizedBox(width: AppSpacing.sm),
                itemBuilder: (context, index) => ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: Image.network(
                    service.imageDataUrls[index],
                    height: 96,
                    width: 112,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => _imagePlaceholder(),
                  ),
                ),
              ),
            ),
          ],
          if (service.certificateDataUrls.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              '${service.certificateDataUrls.length} certificate file${service.certificateDataUrls.length == 1 ? '' : 's'} attached',
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: AppColors.textSecondary),
            ),
          ],
        ],
      ),
    );
  }

  Widget _serviceStatTile(
    BuildContext context, {
    required String value,
    required String label,
    required Color tint,
  }) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: tint.withValues(alpha: 0.12)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              color: tint,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: AppColors.textSecondary,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _miniChip({
    required String label,
    required Color background,
    required Color foreground,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: foreground,
          fontSize: 12,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  Widget _uploadCard(
    BuildContext context, {
    required String title,
    required String subtitle,
    required List<String> dataUrls,
    required List<String> fileNames,
    required String emptyLabel,
    required VoidCallback onUpload,
    required void Function(int index) onRemove,
    required String uploadLabel,
  }) {
    return _inputCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: AppColors.primarySoft,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(
                  Icons.collections_outlined,
                  color: AppColors.primary,
                  size: 22,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${dataUrls.length}/3 uploaded',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            subtitle,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: AppColors.textSecondary,
              height: 1.45,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          if (dataUrls.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppSpacing.lg),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFFF8F4FF), Color(0xFFFFFFFF)],
                ),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFFE7DDF7)),
              ),
              child: Column(
                children: [
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Icon(
                      Icons.add_photo_alternate_outlined,
                      color: AppColors.primary,
                      size: 34,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    emptyLabel,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Add sharp, clear files to improve your listing quality.',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            )
          else
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: dataUrls.length,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: AppSpacing.sm,
                crossAxisSpacing: AppSpacing.sm,
                childAspectRatio: 0.92,
              ),
              itemBuilder: (context, index) {
                final url = dataUrls[index];
                final isPdf = url.startsWith('data:application/pdf');
                final fileName = index < fileNames.length
                    ? fileNames[index]
                    : '';
                return Container(
                  padding: const EdgeInsets.all(AppSpacing.xs),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFFE7DDF7)),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x0D0F0B1F),
                        blurRadius: 16,
                        offset: Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Stack(
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(16),
                              child: isPdf
                                  ? Container(
                                      width: double.infinity,
                                      decoration: const BoxDecoration(
                                        gradient: LinearGradient(
                                          begin: Alignment.topLeft,
                                          end: Alignment.bottomRight,
                                          colors: [
                                            Color(0xFFF8F4FF),
                                            Color(0xFFFFFFFF),
                                          ],
                                        ),
                                      ),
                                      alignment: Alignment.center,
                                      child: const Icon(
                                        Icons.picture_as_pdf_outlined,
                                        color: AppColors.primary,
                                        size: 42,
                                      ),
                                    )
                                  : _uploadPreviewImage(url),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            fileName.isEmpty ? 'Uploaded file' : fileName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(
                                  color: AppColors.textPrimary,
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                        ],
                      ),
                      Positioned(
                        top: 6,
                        right: 6,
                        child: Material(
                          color: Colors.transparent,
                          child: InkWell(
                            onTap: () => onRemove(index),
                            borderRadius: BorderRadius.circular(999),
                            child: Ink(
                              padding: const EdgeInsets.all(6),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.92),
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: AppColors.error.withValues(
                                    alpha: 0.20,
                                  ),
                                ),
                              ),
                              child: const Icon(
                                Icons.delete_outline_rounded,
                                color: AppColors.error,
                                size: 18,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          const SizedBox(height: AppSpacing.sm),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: dataUrls.length >= 3 ? null : onUpload,
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.primary,
                side: BorderSide(
                  color: AppColors.primary.withValues(alpha: 0.24),
                ),
                minimumSize: const Size.fromHeight(50),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                backgroundColor: const Color(0xFFFCFAFF),
              ),
              icon: const Icon(Icons.cloud_upload_outlined),
              label: Text(uploadLabel),
            ),
          ),
          if (dataUrls.length >= 3) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              'Maximum 3 files reached. Remove one to upload a new file.',
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: AppColors.textSecondary),
            ),
          ],
        ],
      ),
    );
  }
}

/// The availability editor embedded at the bottom of the Services screen —
/// previously its own screen/route, merged in so providers manage services
/// and their working days/hours in one continuous flow, matching
/// registration.
class _AvailabilitySection extends StatefulWidget {
  const _AvailabilitySection();

  @override
  State<_AvailabilitySection> createState() => _AvailabilitySectionState();
}

class _AvailabilitySectionState extends State<_AvailabilitySection> {
  static const _workspaceService = ProviderWorkspaceService();

  late Future<ProviderAvailabilitySnapshot> _future;
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

  // Availability is now automatic — once a provider sets at least one day
  // and time, they're considered available. No separate on/off toggle.
  bool get _isAvailable =>
      _daySettings.values.any((setting) => setting.selected);

  @override
  void initState() {
    super.initState();
    _future = _workspaceService.fetchAvailability();
  }

  void _applySnapshot(ProviderAvailabilitySnapshot snapshot) {
    if (_initialized) {
      return;
    }
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
        enabled: _isAvailable,
        entries: entries,
      );
      setState(() {
        _message = _isAvailable
            ? 'Availability saved to your live provider profile.'
            : 'Add at least one day and time to become available for bookings.';
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
    return FutureBuilder<ProviderAvailabilitySnapshot>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: AppSpacing.lg),
            child: LoadingState(label: 'Loading availability...'),
          );
        }
        if (snapshot.hasError || snapshot.data == null) {
          return const EmptyState(
            title: 'Unable to load availability',
            subtitle: 'Please try again.',
            icon: Icons.error_outline_rounded,
          );
        }

        _applySnapshot(snapshot.data!);

        return _reactSection(
          child: Column(
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Availability',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 4),
                  RichText(
                    text: TextSpan(
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                      children: [
                        const TextSpan(text: 'You are currently '),
                        TextSpan(
                          text: _isAvailable ? 'Available' : 'Offline',
                          style: const TextStyle(
                            color: AppColors.success,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const TextSpan(
                          text:
                              '. Set at least one day and time below to become available for bookings.',
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),
              Row(
                children: [
                  Text(
                    'Select Days',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const Spacer(),
                  TextButton(
                    onPressed: () {
                      setState(() {
                        for (final day in _availabilityDays) {
                          final current = _daySettings[day]!;
                          _daySettings[day] = current.copyWith(selected: true);
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
                      borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                    ),
                  ),
                  child: Text(_saving ? 'Saving...' : 'Save Availability'),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _dayCard(BuildContext context, String day) {
    final setting = _daySettings[day]!;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: 6,
      ),
      decoration: BoxDecoration(
        color: setting.selected
            ? const Color(0xFFF6FFF8)
            : const Color(0xFFFBFFFC),
        borderRadius: BorderRadius.circular(16),
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
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              Transform.scale(
                scale: 0.85,
                child: Checkbox(
                  value: setting.selected,
                  activeColor: AppColors.success,
                  visualDensity: VisualDensity.compact,
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  onChanged: (value) {
                    setState(() {
                      _daySettings[day] = setting.copyWith(
                        selected: value ?? false,
                      );
                    });
                  },
                ),
              ),
            ],
          ),
          if (setting.selected) ...[
            const SizedBox(height: 6),
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
      borderRadius: BorderRadius.circular(14),
      onTap: onTap,
      child: Ink(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: 6,
        ),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFDBEEE2)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: Theme.of(
                context,
              ).textTheme.labelSmall?.copyWith(color: AppColors.textSecondary),
            ),
            const SizedBox(height: 2),
            Text(
              value,
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
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
    final picked = await showTimePicker(context: context, initialTime: initial);
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
                        value:
                            '${reviews.where((item) => item.rating >= 4).length}',
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
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 4),
          Text(
            subtitle,
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: AppColors.textSecondary),
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
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                ),
              ),
              Text(
                review.createdLabel.isEmpty
                    ? review.createdAt
                    : review.createdLabel,
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: AppColors.textSecondary),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Row(
            children: [
              const Icon(
                Icons.star_rounded,
                color: Color(0xFFF5B301),
                size: 18,
              ),
              const SizedBox(width: 4),
              Text(
                review.rating.toString(),
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
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

  _DaySetting copyWith({bool? selected, String? startTime, String? endTime}) {
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

/// Matches `_personalFieldDecoration` in the Personal Details screen —
/// bordered, roomy fields with an icon prefix, rather than the compact
/// borderless fields nested inside `_inputCard`.
InputDecoration _cleanFieldDecoration(
  String label, {
  IconData? prefixIcon,
  String? hint,
}) {
  return InputDecoration(
    labelText: label,
    hintText: hint,
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
      style: TextStyle(color: color, fontWeight: FontWeight.w600),
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

/// A freshly-picked (not yet saved) service image or certificate carries a
/// `data:<mime>;base64,...` URL, not a real network URL — rendering that
/// through [Image.network] either fails silently or, for a large base64
/// string, can crash the app. Only an already-saved http(s) URL goes through
/// [Image.network]; anything else is decoded and shown via [Image.memory].
Widget _uploadPreviewImage(String url) {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return Image.network(
      url,
      width: double.infinity,
      fit: BoxFit.cover,
      errorBuilder: (_, __, ___) => _imagePlaceholder(),
    );
  }

  final bytes = _decodeDataUrlBytes(url);
  if (bytes == null) {
    return _imagePlaceholder();
  }
  return Image.memory(bytes, width: double.infinity, fit: BoxFit.cover);
}

/// Decodes a `data:<mime>;base64,<...>` URL into raw bytes for
/// [Image.memory]. Returns null for anything else.
Uint8List? _decodeDataUrlBytes(String dataUrl) {
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
