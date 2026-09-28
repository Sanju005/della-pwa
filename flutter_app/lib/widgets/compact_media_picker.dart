import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';
import 'cached_image.dart';

const double _compactMediaFieldRadius = 13;

/// Shared "n/3" photo/file picker used anywhere a provider attaches a small
/// batch of images (or images + PDFs) to something — service work photos,
/// certificates, job-completion photos. One look everywhere: a label + count
/// row, a subtitle, an empty-state tap target, and small thumbnails with a
/// remove badge plus an "add" tile once at least one file is attached.
class CompactMediaPicker extends StatelessWidget {
  const CompactMediaPicker({
    super.key,
    required this.title,
    required this.subtitle,
    required this.emptyLabel,
    required this.dataUrls,
    required this.onPick,
    required this.onRemove,
    this.maxFiles = 3,
  });

  final String title;
  final String subtitle;
  final String emptyLabel;
  final List<String> dataUrls;
  final VoidCallback onPick;
  final void Function(int index) onRemove;
  final int maxFiles;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                title,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              ),
            ),
            Text(
              '${dataUrls.length}/$maxFiles',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: dataUrls.length == maxFiles
                    ? AppColors.success
                    : AppColors.textSecondary,
              ),
            ),
          ],
        ),
        const SizedBox(height: 2),
        Text(
          subtitle,
          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
        ),
        const SizedBox(height: AppSpacing.sm),
        if (dataUrls.isEmpty)
          InkWell(
            onTap: onPick,
            borderRadius: BorderRadius.circular(_compactMediaFieldRadius),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
              decoration: BoxDecoration(
                color: AppColors.primarySoft,
                borderRadius: BorderRadius.circular(_compactMediaFieldRadius),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                children: [
                  const Icon(
                    Icons.photo_library_outlined,
                    size: 30,
                    color: AppColors.primary,
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    emptyLabel,
                    style: const TextStyle(
                      fontSize: 12.5,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          )
        else
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              ...List.generate(dataUrls.length, (index) {
                final url = dataUrls[index];
                final isPdf = url.startsWith('data:application/pdf') ||
                    url.toLowerCase().endsWith('.pdf');
                return Stack(
                  clipBehavior: Clip.none,
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(_compactMediaFieldRadius),
                      child: isPdf
                          ? Container(
                              width: 80,
                              height: 80,
                              color: AppColors.primarySoft,
                              alignment: Alignment.center,
                              child: const Icon(
                                Icons.picture_as_pdf_outlined,
                                color: AppColors.primary,
                                size: 30,
                              ),
                            )
                          : CachedImage(
                              url: url,
                              width: 80,
                              height: 80,
                              fit: BoxFit.cover,
                              errorWidget: (_, _) => Container(
                                width: 80,
                                height: 80,
                                color: AppColors.primarySoft,
                                alignment: Alignment.center,
                                child: const Icon(
                                  Icons.image_not_supported_outlined,
                                  color: AppColors.primary,
                                ),
                              ),
                            ),
                    ),
                    Positioned(
                      right: -6,
                      top: -6,
                      child: InkWell(
                        onTap: () => onRemove(index),
                        borderRadius: BorderRadius.circular(999),
                        child: Container(
                          width: 22,
                          height: 22,
                          decoration: const BoxDecoration(
                            color: Colors.black54,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.close_rounded,
                            size: 14,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ],
                );
              }),
              if (dataUrls.length < maxFiles)
                InkWell(
                  onTap: onPick,
                  borderRadius: BorderRadius.circular(_compactMediaFieldRadius),
                  child: Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(
                      color: AppColors.primarySoft,
                      borderRadius: BorderRadius.circular(_compactMediaFieldRadius),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: const Icon(
                      Icons.add_rounded,
                      color: AppColors.primary,
                    ),
                  ),
                ),
            ],
          ),
      ],
    );
  }
}
