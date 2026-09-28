import 'package:flutter/material.dart';

import '../theme/app_spacing.dart';

class SwiperBottomSheet extends StatelessWidget {
  const SwiperBottomSheet({
    super.key,
    required this.title,
    this.subtitle,
    required this.child,
    this.footer,
  });

  final String title;
  final String? subtitle;
  final Widget child;

  /// Optional widget (typically the primary action button) pinned below the
  /// scrollable content, so it stays visible without needing to scroll or
  /// drag the sheet open further.
  final Widget? footer;

  static Future<T?> show<T>(
    BuildContext context, {
    required String title,
    String? subtitle,
    required Widget child,
    Widget? footer,
  }) {
    return showModalBottomSheet<T>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => SwiperBottomSheet(
        title: title,
        subtitle: subtitle,
        footer: footer,
        child: child,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: AnimatedPadding(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOutCubic,
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.72,
          minChildSize: 0.38,
          maxChildSize: 0.94,
          builder: (context, scrollController) {
            final scrollableContent = SingleChildScrollView(
              controller: scrollController,
              padding: EdgeInsets.fromLTRB(
                AppSpacing.md,
                AppSpacing.md,
                AppSpacing.md,
                footer == null ? AppSpacing.lg : AppSpacing.md,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: Theme.of(context).textTheme.titleLarge),
                  if (subtitle != null) ...[
                    const SizedBox(height: AppSpacing.xs),
                    Text(subtitle!, style: Theme.of(context).textTheme.bodyMedium),
                  ],
                  const SizedBox(height: AppSpacing.md),
                  child,
                ],
              ),
            );

            if (footer == null) {
              return scrollableContent;
            }

            return Column(
              children: [
                Expanded(child: scrollableContent),
                DecoratedBox(
                  decoration: BoxDecoration(
                    color: Theme.of(context).scaffoldBackgroundColor,
                    border: const Border(
                      top: BorderSide(color: Color(0xFFEDE7F6)),
                    ),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.md,
                      AppSpacing.sm,
                      AppSpacing.md,
                      AppSpacing.md,
                    ),
                    child: footer,
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
