import 'package:flutter/material.dart';

import '../../../core/animation/app_motion.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';

class AuthFlowScaffold extends StatelessWidget {
  const AuthFlowScaffold({
    super.key,
    this.title,
    this.subtitle,
    this.showBack = false,
    this.hero,
    required this.child,
    this.bottom,
    this.onBack,
  });

  final String? title;
  final String? subtitle;
  final bool showBack;
  final Widget? hero;
  final Widget child;
  final Widget? bottom;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: GestureDetector(
          onTap: () => FocusScope.of(context).unfocus(),
          child: Column(
            children: [
              Expanded(
                child: SingleChildScrollView(
                  keyboardDismissBehavior:
                      ScrollViewKeyboardDismissBehavior.onDrag,
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.lg,
                    AppSpacing.lg,
                    AppSpacing.lg,
                    AppSpacing.xl,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (showBack)
                        Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.md),
                          child: IconButton(
                            onPressed:
                                onBack ??
                                () => Navigator.of(context).maybePop(),
                            icon: const Icon(Icons.arrow_back_ios_new_rounded),
                            style: IconButton.styleFrom(
                              backgroundColor: Colors.white,
                              foregroundColor: AppColors.primary,
                            ),
                          ),
                        ),
                      if (hero != null) ...[
                        Center(child: hero!),
                        const SizedBox(height: AppSpacing.lg),
                      ],
                      if (title != null)
                        Center(
                          child: Text(
                            title!,
                            textAlign: TextAlign.center,
                            style: theme.textTheme.headlineMedium?.copyWith(
                              fontSize: 23,
                            ),
                          ),
                        ),
                      if (subtitle != null) ...[
                        const SizedBox(height: AppSpacing.xs),
                        Center(
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 300),
                            child: Text(
                              subtitle!,
                              textAlign: TextAlign.center,
                              style: theme.textTheme.bodyMedium?.copyWith(
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ),
                        ),
                      ],
                      if (title != null || subtitle != null)
                        const SizedBox(height: AppSpacing.xl),
                      child,
                    ],
                  ),
                ),
              ),
              if (bottom != null)
                SafeArea(
                  top: false,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.lg,
                      AppSpacing.md,
                      AppSpacing.lg,
                      AppSpacing.lg,
                    ),
                    child: bottom!,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class AuthCircleHero extends StatefulWidget {
  const AuthCircleHero({super.key, required this.icon, this.size = 72});

  final IconData icon;
  final double size;

  @override
  State<AuthCircleHero> createState() => _AuthCircleHeroState();
}

class _AuthCircleHeroState extends State<AuthCircleHero>
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
    final curved = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOutCubic,
    );

    final circle = Container(
      width: widget.size,
      height: widget.size,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFF5F1FA), Color(0xFFEADCF6)],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
        shape: BoxShape.circle,
      ),
      child: Icon(
        widget.icon,
        color: AppColors.primary,
        size: widget.size * 0.46,
      ),
    );

    return FadeTransition(
      opacity: curved,
      child: SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(0, 0.18),
          end: Offset.zero,
        ).animate(curved),
        child: ScaleTransition(
          scale: Tween<double>(begin: 0.82, end: 1.0).animate(curved),
          child: circle,
        ),
      ),
    );
  }
}
