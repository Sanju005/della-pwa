import 'package:flutter/material.dart';

import '../../../core/animation/app_motion.dart';
import '../../../core/routing/app_routes.dart';
import '../../../theme/app_spacing.dart';

/// Colour palette specific to this screen's premium redesign. Kept local
/// rather than folded into the shared `AppColors` so the rest of the app's
/// theming is untouched — this screen alone uses these exact brand values.
class _Palette {
  const _Palette._();

  static const primary = Color(0xFF8968CD);
  static const deep = Color(0xFF6336B4);
  static const bright = Color(0xFF8B5CF6);
  static const lavender = Color(0xFFF4EEFF);
  static const paleBg = Color(0xFFFAF8FF);
  static const heading = Color(0xFF171529);
  static const secondaryText = Color(0xFF656079);
}

class SignupEntryScreen extends StatefulWidget {
  const SignupEntryScreen({super.key});

  @override
  State<SignupEntryScreen> createState() => _SignupEntryScreenState();
}

class _SignupEntryScreenState extends State<SignupEntryScreen>
    with TickerProviderStateMixin {
  late final AnimationController _entrance;
  late final AnimationController _pulse;
  bool _startedEntrance = false;

  @override
  void initState() {
    super.initState();
    _entrance = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_startedEntrance) {
      return;
    }
    _startedEntrance = true;
    if (AppMotion.reduceMotion(context)) {
      _entrance.value = 1;
    } else {
      _entrance.forward();
      _pulse.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _entrance.dispose();
    _pulse.dispose();
    super.dispose();
  }

  Animation<double> _stage(double start, double end) {
    return CurvedAnimation(
      parent: _entrance,
      curve: Interval(start, end, curve: Curves.easeOutCubic),
    );
  }

  @override
  Widget build(BuildContext context) {
    final reduceMotion = AppMotion.reduceMotion(context);
    final logoAnim = _stage(0.0, 0.55);
    final headingAnim = _stage(0.11, 0.62);
    final userCardAnim = _stage(0.22, 0.70);
    final providerCardAnim = _stage(0.34, 0.80);
    final footerAnim = _stage(0.50, 1.0);

    return Scaffold(
      backgroundColor: _Palette.paleBg,
      body: SafeArea(
        child: Stack(
          children: [
            Positioned(
              top: -70,
              right: -60,
              child: Container(
                width: 190,
                height: 190,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      _Palette.lavender.withValues(alpha: 0.85),
                      _Palette.lavender.withValues(alpha: 0),
                    ],
                  ),
                ),
              ),
            ),
            SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(
                22,
                AppSpacing.md,
                22,
                AppSpacing.xl,
              ),
              child: Column(
                children: [
                  _RiseIn(
                    animation: logoAnim,
                    offsetFraction: 0.22,
                    beginScale: 0.88,
                    child: Image.asset('assets/logo/main_logo.png', width: 98),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  _RiseIn(
                    animation: headingAnim,
                    offsetFraction: 0.4,
                    child: Column(
                      children: [
                        RichText(
                          textAlign: TextAlign.center,
                          text: const TextSpan(
                            style: TextStyle(
                              fontSize: 26,
                              fontWeight: FontWeight.w700,
                              color: _Palette.heading,
                              height: 1.15,
                            ),
                            children: [
                              TextSpan(text: 'Create '),
                              TextSpan(
                                text: 'your account',
                                style: TextStyle(color: _Palette.primary),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 10),
                        _SignupProgressIndicator(reduceMotion: reduceMotion),
                        const SizedBox(height: 10),
                        ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 290),
                          child: const Text(
                            'Choose how you want to join Swiper and follow the matching signup flow.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 13.5,
                              color: _Palette.secondaryText,
                              height: 1.45,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  _RiseIn(
                    animation: userCardAnim,
                    offsetFraction: 0.14,
                    beginScale: 0.97,
                    child: _AccountTypeCard(
                      icon: Icons.person_outline_rounded,
                      badgeLabel: 'I need a service',
                      title: 'Create as User',
                      description:
                          'Book trusted services near you and manage all your bookings in one place.',
                      pulse: _pulse,
                      onTap: () => Navigator.of(
                        context,
                      ).pushNamed(AppRoutes.registerCustomer),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  _RiseIn(
                    animation: providerCardAnim,
                    offsetFraction: 0.14,
                    beginScale: 0.97,
                    child: _AccountTypeCard(
                      icon: Icons.work_outline_rounded,
                      badgeLabel: 'I provide services',
                      title: 'Create as Service Provider',
                      description:
                          'Set up your profile, choose services, and submit your listing for review.',
                      pulse: _pulse,
                      onTap: () => Navigator.of(
                        context,
                      ).pushNamed(AppRoutes.registerProvider),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  _RiseIn(
                    animation: footerAnim,
                    offsetFraction: 0.12,
                    child: Column(
                      children: [
                        GestureDetector(
                          onTap: () => Navigator.of(
                            context,
                          ).pushReplacementNamed(AppRoutes.login),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: const [
                              Text(
                                'Already have an account? ',
                                style: TextStyle(
                                  color: _Palette.secondaryText,
                                  fontSize: 13.5,
                                ),
                              ),
                              Text(
                                'Log in',
                                style: TextStyle(
                                  color: _Palette.primary,
                                  fontWeight: FontWeight.w800,
                                  fontSize: 13.5,
                                ),
                              ),
                              SizedBox(width: 4),
                              Icon(
                                Icons.arrow_forward_rounded,
                                size: 15,
                                color: _Palette.primary,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: AppSpacing.lg),
                        const _TrustBadgeRow(),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Fade + rise + (optional) scale entrance, composed from the stock
/// [FadeTransition]/[SlideTransition]/[ScaleTransition] widgets rather than a
/// bespoke animation package.
class _RiseIn extends StatelessWidget {
  const _RiseIn({
    required this.animation,
    required this.child,
    this.offsetFraction = 0.15,
    this.beginScale = 1.0,
  });

  final Animation<double> animation;
  final Widget child;
  final double offsetFraction;
  final double beginScale;

  @override
  Widget build(BuildContext context) {
    final slide = Tween<Offset>(
      begin: Offset(0, offsetFraction),
      end: Offset.zero,
    ).animate(animation);

    Widget content = child;
    if (beginScale != 1.0) {
      content = ScaleTransition(
        scale: Tween<double>(begin: beginScale, end: 1.0).animate(animation),
        child: content,
      );
    }

    return FadeTransition(
      opacity: animation,
      child: SlideTransition(position: slide, child: content),
    );
  }
}

class _SignupProgressIndicator extends StatelessWidget {
  const _SignupProgressIndicator({required this.reduceMotion});

  final bool reduceMotion;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _TwinkleStars(reduceMotion: reduceMotion),
        const SizedBox(width: 8),
        _GrowingProgressLine(reduceMotion: reduceMotion),
      ],
    );
  }
}

class _TwinkleStars extends StatefulWidget {
  const _TwinkleStars({required this.reduceMotion});

  final bool reduceMotion;

  @override
  State<_TwinkleStars> createState() => _TwinkleStarsState();
}

class _TwinkleStarsState extends State<_TwinkleStars>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1300),
    );
    if (!widget.reduceMotion) {
      _controller.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final twinkle = Tween<double>(
      begin: 0.35,
      end: 1.0,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut));

    Widget sparkle(double size) {
      final icon = Icon(Icons.star_rounded, size: size, color: _Palette.bright);
      if (widget.reduceMotion) {
        return icon;
      }
      return FadeTransition(opacity: twinkle, child: icon);
    }

    return SizedBox(
      width: 20,
      height: 16,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          const Positioned(
            left: 4,
            top: 2,
            child: Icon(Icons.star_rounded, size: 12, color: _Palette.primary),
          ),
          Positioned(left: 0, top: 0, child: sparkle(5)),
          Positioned(right: 0, bottom: 0, child: sparkle(5)),
        ],
      ),
    );
  }
}

class _GrowingProgressLine extends StatelessWidget {
  const _GrowingProgressLine({required this.reduceMotion});

  final bool reduceMotion;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(4),
      child: SizedBox(
        width: 130,
        height: 4,
        child: Stack(
          children: [
            Container(color: _Palette.lavender),
            Align(
              alignment: Alignment.centerLeft,
              child: TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: 0.4),
                duration: reduceMotion
                    ? Duration.zero
                    : const Duration(milliseconds: 900),
                curve: Curves.easeOutCubic,
                builder: (context, value, child) => FractionallySizedBox(
                  widthFactor: value,
                  child: Container(
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        colors: [_Palette.primary, _Palette.bright],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AccountTypeCard extends StatefulWidget {
  const _AccountTypeCard({
    required this.icon,
    required this.badgeLabel,
    required this.title,
    required this.description,
    required this.onTap,
    required this.pulse,
  });

  final IconData icon;
  final String badgeLabel;
  final String title;
  final String description;
  final VoidCallback onTap;
  final AnimationController pulse;

  @override
  State<_AccountTypeCard> createState() => _AccountTypeCardState();
}

class _AccountTypeCardState extends State<_AccountTypeCard> {
  bool _pressed = false;

  void _setPressed(bool value) {
    if (_pressed == value) {
      return;
    }
    setState(() => _pressed = value);
  }

  @override
  Widget build(BuildContext context) {
    final reduceMotion = AppMotion.reduceMotion(context);
    final pressed = !reduceMotion && _pressed;

    return Listener(
      onPointerDown: (_) => _setPressed(true),
      onPointerUp: (_) => _setPressed(false),
      onPointerCancel: (_) => _setPressed(false),
      child: GestureDetector(
        onTap: widget.onTap,
        child: AnimatedScale(
          scale: pressed ? 0.985 : 1.0,
          duration: const Duration(milliseconds: 130),
          curve: Curves.easeOut,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            curve: Curves.easeOut,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(30),
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Colors.white, _Palette.lavender],
                stops: [0.55, 1.0],
              ),
              border: Border.all(
                color: _Palette.primary.withValues(
                  alpha: pressed ? 0.30 : 0.15,
                ),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: pressed ? 0.04 : 0.07),
                  blurRadius: pressed ? 14 : 22,
                  offset: Offset(0, pressed ? 5 : 10),
                ),
                BoxShadow(
                  color: _Palette.primary.withValues(
                    alpha: pressed ? 0.22 : 0.10,
                  ),
                  blurRadius: pressed ? 26 : 18,
                  spreadRadius: pressed ? 1 : 0,
                ),
              ],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(30),
              child: Stack(
                children: [
                  // Faint depth layer, larger and softer than the main wave.
                  Positioned(
                    right: 0,
                    bottom: 0,
                    child: ClipPath(
                      clipper: const _WaveCornerClipper(),
                      child: Container(
                        width: 168,
                        height: 126,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [
                              _Palette.lavender.withValues(alpha: 0),
                              _Palette.primary.withValues(alpha: 0.10),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                  // Main wave accent.
                  Positioned(
                    right: 0,
                    bottom: 0,
                    child: ClipPath(
                      clipper: const _WaveCornerClipper(),
                      child: Container(
                        width: 120,
                        height: 90,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [
                              _Palette.bright.withValues(alpha: 0.18),
                              _Palette.deep.withValues(alpha: 0.28),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                  // Glass sheen along the top edge.
                  Positioned(
                    top: 0,
                    left: 0,
                    right: 0,
                    child: Container(
                      height: 36,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.white.withValues(alpha: 0.55),
                            Colors.white.withValues(alpha: 0),
                          ],
                        ),
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              width: 44,
                              height: 44,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(14),
                                gradient: const LinearGradient(
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                  colors: [_Palette.lavender, _Palette.primary],
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: _Palette.primary.withValues(
                                      alpha: 0.25,
                                    ),
                                    blurRadius: 10,
                                    offset: const Offset(0, 4),
                                  ),
                                ],
                              ),
                              child: Icon(
                                widget.icon,
                                color: Colors.white,
                                size: 21,
                              ),
                            ),
                            const Spacer(),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 11,
                                vertical: 6,
                              ),
                              decoration: BoxDecoration(
                                color: _Palette.lavender,
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                widget.badgeLabel,
                                style: const TextStyle(
                                  color: _Palette.deep,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Text(
                          widget.title,
                          style: const TextStyle(
                            fontSize: 17.5,
                            fontWeight: FontWeight.w700,
                            color: _Palette.heading,
                          ),
                        ),
                        const SizedBox(height: 5),
                        SizedBox(
                          width: MediaQuery.of(context).size.width * 0.6,
                          child: Text(
                            widget.description,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 12.5,
                              color: _Palette.secondaryText,
                              height: 1.35,
                            ),
                          ),
                        ),
                        const SizedBox(height: 30),
                      ],
                    ),
                  ),
                  Positioned(
                    right: 16,
                    bottom: 16,
                    child: ScaleTransition(
                      scale: Tween<double>(begin: 1.0, end: 1.04).animate(
                        CurvedAnimation(
                          parent: widget.pulse,
                          curve: Curves.easeInOut,
                        ),
                      ),
                      child: Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: const LinearGradient(
                            colors: [_Palette.bright, _Palette.deep],
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: _Palette.primary.withValues(alpha: 0.35),
                              blurRadius: 14,
                              offset: const Offset(0, 5),
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.arrow_forward_rounded,
                          color: Colors.white,
                          size: 18,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Clips its child to a soft "wave" leaf-shape anchored to the container's
/// own bottom-right corner — used at a small, fixed size so the resulting
/// accent only ever covers a corner of the card, never the whole surface.
class _WaveCornerClipper extends CustomClipper<Path> {
  const _WaveCornerClipper();

  @override
  Path getClip(Size size) {
    final w = size.width;
    final h = size.height;
    return Path()
      ..moveTo(w, 0)
      ..lineTo(w, h)
      ..lineTo(0, h)
      ..quadraticBezierTo(w * 0.55, h * 0.5, w, 0)
      ..close();
  }

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => false;
}

class _TrustBadgeRow extends StatelessWidget {
  const _TrustBadgeRow();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [_Palette.lavender.withValues(alpha: 0.9), _Palette.paleBg],
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: _Palette.primary.withValues(alpha: 0.12)),
      ),
      child: Row(
        children: [
          const Expanded(
            child: _TrustBadge(
              icon: Icons.shield_rounded,
              title: 'Secure',
              caption: 'Your data is protected',
            ),
          ),
          _trustDivider(),
          const Expanded(
            child: _TrustBadge(
              icon: Icons.verified_rounded,
              title: 'Trusted',
              caption: 'Verified providers',
            ),
          ),
          _trustDivider(),
          const Expanded(
            child: _TrustBadge(
              icon: Icons.bolt_rounded,
              title: 'Fast & Easy',
              caption: 'Get started in minutes',
            ),
          ),
        ],
      ),
    );
  }
}

Widget _trustDivider() {
  return Container(
    width: 1,
    height: 32,
    color: _Palette.primary.withValues(alpha: 0.14),
  );
}

class _TrustBadge extends StatelessWidget {
  const _TrustBadge({
    required this.icon,
    required this.title,
    required this.caption,
  });

  final IconData icon;
  final String title;
  final String caption;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Icon(icon, color: _Palette.primary, size: 20),
        const SizedBox(height: 6),
        Text(
          title,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 12,
            color: _Palette.heading,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          caption,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 10, color: _Palette.secondaryText),
        ),
      ],
    );
  }
}
