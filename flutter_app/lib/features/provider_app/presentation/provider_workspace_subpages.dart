import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../services/browser_file_picker.dart';
import '../../../services/image_optimization_service.dart';
import '../../../services/provider_workspace_service.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/cached_image.dart';
import '../../../widgets/compact_media_picker.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/loading_state.dart';
import '../../../widgets/service_category_picker.dart';
import '../../../widgets/specialty_chip_field.dart';
import '../../../widgets/swiper_app_bar.dart';

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
  final _aboutController = TextEditingController();
  List<String> _specialties = [];
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
    _aboutController.dispose();
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
      _aboutController.clear();
      _specialties = [];
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
      _aboutController.clear();
      _specialties = [];
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
      _aboutController.text = service.aboutService;
      _specialties = List<String>.from(service.specialties);
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
    final optimized = await Future.wait(
      picked.map(
        (file) => optimizePublicImage(file, maxDimension: kMediumImageMaxDimension),
      ),
    );
    if (!mounted) {
      return;
    }
    setState(() {
      _serviceImageDataUrls = [
        ..._serviceImageDataUrls,
        ...optimized.map((file) => file.dataUrl),
      ];
      _serviceImageCaptions = List<String>.generate(
        _serviceImageDataUrls.length,
        (index) => 'Work image ${index + 1}',
      );
      _serviceImageFileNames = [
        ..._serviceImageFileNames,
        ...optimized.map((file) => file.name),
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
    // Certificates can be a PDF or an image (accept above) -- optimizePublicImage
    // only ever touches actual raster images and returns PDFs unchanged.
    final optimized = await Future.wait(
      picked.map(
        (file) => optimizePublicImage(file, maxDimension: kMediumImageMaxDimension),
      ),
    );
    if (!mounted) {
      return;
    }
    setState(() {
      _certificateDataUrls = [
        ..._certificateDataUrls,
        ...optimized.map((file) => file.dataUrl),
      ];
      _certificateCaptions = List<String>.generate(
        _certificateDataUrls.length,
        (index) => 'Certificate ${index + 1}',
      );
      _certificateFileNames = [
        ..._certificateFileNames,
        ...optimized.map((file) => file.name),
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
      final specialties = List<String>.from(_specialties);
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
          aboutService: _aboutController.text.trim(),
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
          aboutService: _aboutController.text.trim(),
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
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              _editingServiceId.isEmpty
                                  ? 'Add New Service'
                                  : 'Edit Service',
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w800,
                                color: AppColors.textPrimary,
                              ),
                            ),
                          ),
                          TextButton(
                            onPressed: _startNewService,
                            style: TextButton.styleFrom(
                              padding: EdgeInsets.zero,
                              minimumSize: const Size(0, 32),
                              visualDensity: VisualDensity.compact,
                            ),
                            child: const Text('Cancel'),
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      ServiceCategoryPicker(
                        categories: providerServiceCategories,
                        selectedCategory: _serviceType.isEmpty ? null : _serviceType,
                        enabled: _editingServiceId.isEmpty,
                        onSelect: (category) =>
                            setState(() => _serviceType = category),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      _CompactField(
                        label: 'Years of Experience',
                        controller: _yearsController,
                        keyboardType: TextInputType.number,
                        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      ),
                      const SizedBox(height: AppSpacing.md),
                      SpecialtyChipField(
                        specialties: _specialties,
                        onChanged: () => setState(() {}),
                        category: _serviceType,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      CompactMediaPicker(
                        title: 'Service Images',
                        subtitle: 'Upload up to 3 photos of your work.',
                        emptyLabel: 'Tap to upload work photos',
                        dataUrls: _serviceImageDataUrls,
                        onPick: _pickServiceImages,
                        onRemove: _removeServiceImage,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      Row(
                        children: [
                          const Expanded(
                            child: Text(
                              'About the Service',
                              style: _compactLabelStyle,
                            ),
                          ),
                          TextButton.icon(
                            onPressed: () {
                              setState(() {
                                _aboutController.text = generateServiceAboutText(
                                  category: _serviceType,
                                  yearsExperience: _yearsController.text,
                                  specialties: _specialties,
                                );
                              });
                            },
                            icon: const Icon(Icons.auto_awesome_rounded, size: 16),
                            label: const Text('Auto-generate'),
                            style: TextButton.styleFrom(
                              padding: EdgeInsets.zero,
                              visualDensity: VisualDensity.compact,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      TextField(
                        controller: _aboutController,
                        maxLines: 3,
                        style: const TextStyle(fontSize: 15),
                        decoration: _compactDecoration(),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Optional. Shown on your public profile for this service.',
                        style: _compactHelperStyle,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      CompactMediaPicker(
                        title: 'Certificates',
                        subtitle: 'Upload up to 3 certificates or proof files.',
                        emptyLabel: 'Tap to upload certificates',
                        dataUrls: _certificateDataUrls,
                        onPick: _pickCertificates,
                        onRemove: _removeCertificate,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      Row(
                        children: [
                          Expanded(
                            child: _CompactField(
                              label: 'Rate per Hour',
                              controller: _hourlyController,
                              keyboardType: const TextInputType.numberWithOptions(
                                decimal: true,
                              ),
                              prefixText: 'RM ',
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: _CompactField(
                              label: 'Rate per Day',
                              controller: _dailyController,
                              keyboardType: const TextInputType.numberWithOptions(
                                decimal: true,
                              ),
                              prefixText: 'RM ',
                            ),
                          ),
                        ],
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
                  child: CachedImage(
                    url: service.imageDataUrls[index],
                    height: 96,
                    width: 112,
                    fit: BoxFit.cover,
                    errorWidget: (_, _) => _imagePlaceholder(),
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
    final theme = Theme.of(context);
    final mutedStyle = theme.textTheme.bodySmall?.copyWith(
      color: AppColors.textSecondary,
      height: 1.45,
    );
    final sectionLabelStyle = theme.textTheme.labelSmall?.copyWith(
      color: AppColors.textSecondary,
      fontWeight: FontWeight.w800,
      letterSpacing: 0.8,
    );
    final about = service.aboutService.trim();
    final deleting = _deleting == service.id;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
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
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.md,
              AppSpacing.md,
              AppSpacing.md,
              AppSpacing.sm,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _toTitleCase(service.serviceType),
                        style: theme.textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w900,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'RM${service.hourlyRate.toStringAsFixed(0)}/hr  •  RM${service.dailyRate.toStringAsFixed(0)}/day',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                _miniChip(
                  label: service.yearsExperience.isEmpty
                      ? 'Experience not set'
                      : service.yearsExperience,
                  background: const Color(0xFFF4EDFF),
                  foreground: AppColors.primary,
                ),
              ],
            ),
          ),
          if (service.imageDataUrls.isNotEmpty)
            SizedBox(
              height: 104,
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                scrollDirection: Axis.horizontal,
                itemCount: service.imageDataUrls.length,
                separatorBuilder: (_, _) =>
                    const SizedBox(width: AppSpacing.sm),
                itemBuilder: (context, index) => ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: CachedImage(
                    url: service.imageDataUrls[index],
                    height: 104,
                    width: 128,
                    fit: BoxFit.cover,
                    errorWidget: (_, _) => _imagePlaceholder(),
                  ),
                ),
              ),
            )
          else
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  color: const Color(0xFFFAF7FF),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE9E1F4)),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.photo_library_outlined,
                      color: AppColors.primary,
                      size: 20,
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Text(
                        'No photos yet. Tap Edit to add work photos.',
                        style: mutedStyle,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.md,
              AppSpacing.md,
              AppSpacing.md,
              0,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('ABOUT THIS SERVICE', style: sectionLabelStyle),
                const SizedBox(height: 6),
                Text(
                  about.isEmpty ? 'No description added yet.' : about,
                  style: about.isEmpty
                      ? mutedStyle
                      : theme.textTheme.bodyMedium?.copyWith(
                          color: AppColors.textPrimary,
                          height: 1.5,
                        ),
                ),
                const SizedBox(height: AppSpacing.md),
                Text('SPECIALTIES', style: sectionLabelStyle),
                const SizedBox(height: 8),
                if (service.specialties.isEmpty)
                  Text('No specialties added yet.', style: mutedStyle)
                else
                  Wrap(
                    spacing: AppSpacing.xs,
                    runSpacing: AppSpacing.xs,
                    children: service.specialties
                        .map(
                          (item) => Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 7,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF8F4FF),
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(
                                color: AppColors.primary.withValues(
                                  alpha: 0.10,
                                ),
                              ),
                            ),
                            child: Text(
                              item,
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: AppColors.textSecondary,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        )
                        .toList(growable: false),
                  ),
                if (service.certificateDataUrls.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.md),
                  Row(
                    children: [
                      const Icon(
                        Icons.verified_outlined,
                        size: 16,
                        color: AppColors.warning,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        '${service.certificateDataUrls.length} certificate${service.certificateDataUrls.length == 1 ? '' : 's'} attached',
                        style: mutedStyle,
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          const Divider(height: 1, color: Color(0xFFF0EAF8)),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.sm),
            child: Row(
              children: [
                Expanded(
                  child: TextButton.icon(
                    onPressed: deleting
                        ? null
                        : () => _confirmDeleteService(service),
                    icon: deleting
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.delete_outline_rounded, size: 20),
                    label: const Text('Delete'),
                    style: TextButton.styleFrom(
                      foregroundColor: AppColors.error,
                      minimumSize: const Size.fromHeight(44),
                    ),
                  ),
                ),
                Container(width: 1, height: 24, color: const Color(0xFFF0EAF8)),
                Expanded(
                  child: TextButton.icon(
                    onPressed: () => _editService(service),
                    icon: const Icon(Icons.edit_outlined, size: 20),
                    label: const Text('Edit'),
                    style: TextButton.styleFrom(
                      foregroundColor: AppColors.primary,
                      minimumSize: const Size.fromHeight(44),
                    ),
                  ),
                ),
              ],
            ),
          ),
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


// ---------------------------------------------------------------------------
// Compact form controls for the Add / Edit Service form — same look as the
// service step of provider registration: label above the field, dense
// outlined inputs, and small photo thumbnails with a remove badge and an
// "n/3" counter.
// ---------------------------------------------------------------------------

const double _compactFieldRadius = 13;

const TextStyle _compactLabelStyle = TextStyle(
  fontSize: 13,
  fontWeight: FontWeight.w700,
  color: AppColors.textPrimary,
);

const TextStyle _compactHelperStyle = TextStyle(
  fontSize: 11.5,
  color: AppColors.textMuted,
);

OutlineInputBorder _compactBorder(Color color, {double width = 1}) {
  return OutlineInputBorder(
    borderRadius: BorderRadius.circular(_compactFieldRadius),
    borderSide: BorderSide(color: color, width: width),
  );
}

InputDecoration _compactDecoration({String? prefixText}) {
  return InputDecoration(
    isDense: true,
    filled: true,
    fillColor: Colors.white,
    prefixText: prefixText,
    prefixStyle: const TextStyle(
      fontSize: 15,
      fontWeight: FontWeight.w700,
      color: AppColors.textPrimary,
    ),
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
    border: _compactBorder(AppColors.border),
    enabledBorder: _compactBorder(AppColors.border),
    focusedBorder: _compactBorder(AppColors.primary, width: 1.4),
  );
}

class _CompactField extends StatelessWidget {
  const _CompactField({
    required this.label,
    required this.controller,
    this.keyboardType,
    this.inputFormatters,
    this.prefixText,
  });

  final String label;
  final TextEditingController controller;
  final TextInputType? keyboardType;
  final List<TextInputFormatter>? inputFormatters;
  final String? prefixText;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: _compactLabelStyle),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          keyboardType: keyboardType,
          inputFormatters: inputFormatters,
          style: const TextStyle(fontSize: 15),
          decoration: _compactDecoration(prefixText: prefixText),
        ),
      ],
    );
  }
}
