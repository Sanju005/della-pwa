import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

class SwiperAppBar extends StatelessWidget implements PreferredSizeWidget {
  const SwiperAppBar({
    super.key,
    required this.title,
    this.subtitle,
    this.actions,
    this.showBack = false,
  });

  final String title;
  final String? subtitle;
  final List<Widget>? actions;
  final bool showBack;

  @override
  Size get preferredSize => Size.fromHeight(subtitle == null ? 60 : 72);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      toolbarHeight: subtitle == null ? 60 : 72,
      automaticallyImplyLeading: false,
      leading: showBack
          ? IconButton(
              onPressed: () => Navigator.of(context).maybePop(),
              icon: const Icon(Icons.arrow_back_ios_new_rounded),
            )
          : null,
      titleSpacing: showBack ? 0 : 16,
      title: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          if (subtitle != null)
            Text(
              subtitle!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                  ),
            ),
        ],
      ),
      actions: actions,
    );
  }
}
