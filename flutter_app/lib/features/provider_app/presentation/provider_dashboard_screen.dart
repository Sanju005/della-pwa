import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

import '../../../core/animation/app_motion.dart';
import '../../../core/routing/app_routes.dart';
import '../../../repositories/demo_repository.dart';
import '../../../services/provider_workspace_service.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/address_live_map.dart';
import '../../../widgets/app_reveal.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/profile_avatar.dart';
import '../../../widgets/swiper_button.dart';
import 'widgets/provider_dashboard_skeleton.dart';

class ProviderDashboardScreen extends StatefulWidget {
  const ProviderDashboardScreen({
    super.key,
    required this.repository,
    this.onNavigateToTab,
  });

  final DemoRepository repository;

  /// Lets the dashboard's task cards switch the shell's bottom-nav tab
  /// (e.g. tapping "Today's Task" jumps to the Bookings tab) instead of
  /// pushing a second, disconnected copy of that screen on top of the shell.
  final ValueChanged<int>? onNavigateToTab;

  @override
  State<ProviderDashboardScreen> createState() =>
      _ProviderDashboardScreenState();
}

class _ProviderDashboardScreenState extends State<ProviderDashboardScreen>
    with SingleTickerProviderStateMixin {
  static const _workspaceService = ProviderWorkspaceService();

  // Shared corner radii so the redesigned cards read as one consistent
  // family instead of the assorted one-off values the screen used before.
  static const _heroRadius = 24.0;
  static const _cardRadius = 20.0;
  static const _tileRadius = 16.0;

  late final AnimationController _sunController;
  late final ValueNotifier<_GreetingStyle> _greetingNotifier;
  Timer? _greetingTimer;
  Timer? _refreshTimer;
  final bool _isSunAnimating = true;

  // Today's task cards need to reflect real bookings as they actually
  // change (a new request coming in, a status update elsewhere) rather
  // than a one-time snapshot captured when the screen first opened.
  // A background poll + pull-to-refresh keeps this live without requiring
  // a full realtime subscription rewrite of this 2000+ line screen.
  static const _autoRefreshInterval = Duration(seconds: 30);

  _ProviderDashboardData? _data;
  bool _initialLoading = true;
  bool _hasLoadError = false;

  @override
  void initState() {
    super.initState();
    unawaited(_loadDashboard(isInitial: true));
    _refreshTimer = Timer.periodic(_autoRefreshInterval, (_) {
      if (mounted) {
        unawaited(_loadDashboard(isInitial: false));
      }
    });
    _sunController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 8),
    )..repeat();
    _greetingNotifier = ValueNotifier(_buildGreetingStyle());
    _greetingTimer = Timer.periodic(const Duration(minutes: 1), (_) {
      if (mounted) {
        _greetingNotifier.value = _buildGreetingStyle();
      }
    });
  }

  @override
  void dispose() {
    _greetingTimer?.cancel();
    _refreshTimer?.cancel();
    _sunController.dispose();
    _greetingNotifier.dispose();
    super.dispose();
  }

  Future<void> _loadDashboard({required bool isInitial}) async {
    try {
      final results = await Future.wait<Object>([
        _workspaceService.fetchWorkspace(),
        _workspaceService.fetchReviews(),
        _workspaceService.fetchMessageThreads(),
      ]);
      if (!mounted) {
        return;
      }
      setState(() {
        _data = _ProviderDashboardData(
          workspace: results[0] as ProviderWorkspaceSnapshot,
          reviews: results[1] as List<ProviderReviewItem>,
          threads: results[2] as List<ProviderMessageThread>,
        );
        _initialLoading = false;
        _hasLoadError = false;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _initialLoading = false;
        // A background poll failing shouldn't blank out data that's
        // already on screen — only surface the error state when there's
        // nothing loaded yet to show instead.
        if (_data == null) {
          _hasLoadError = true;
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_initialLoading) {
      return const ProviderDashboardSkeleton();
    }
    if (_hasLoadError || _data == null) {
      return const EmptyState(
        title: 'Unable to load provider workspace',
        subtitle: 'Please try again.',
        icon: Icons.error_outline_rounded,
      );
    }

    {
        final dashboard = _data!;
        final workspace = dashboard.workspace;
        final profile = workspace.profile;
        final bookings = workspace.bookings;
        final reviews = dashboard.reviews;
        final unreadMessages = dashboard.threads.fold<int>(
          0,
          (sum, thread) => sum + thread.unreadCount,
        );

        final todayKey = _dateKey(DateTime.now());
        final todayBookings = _sortBookings(
          bookings.where((booking) => booking.scheduledDate == todayKey),
        );
        final requests = bookings
            .where(
              (booking) =>
                  booking.bucket == 'requests' ||
                  booking.bookingStatus == 'pending',
            )
            .toList(growable: false);
        final ongoing = bookings
            .where(
              (booking) => const [
                'accepted',
                'on_the_way',
                'arrived',
                'work_finished_by_provider',
                'work_confirmed_by_user',
                'final_payment_sent',
                'cash_paid_by_user',
                'payment_received_by_provider',
              ].contains(booking.bookingStatus),
            )
            .toList(growable: false);
        final pendingToday = todayBookings
            .where(
              (booking) =>
                  booking.bucket == 'requests' ||
                  booking.bookingStatus == 'pending',
            )
            .toList(growable: false);
        final completed = bookings
            .where((booking) => _isCompletedStatus(booking.bookingStatus))
            .toList(growable: false);
        final cancelled = bookings
            .where((booking) => _isCancelledStatus(booking.bookingStatus))
            .toList(growable: false);
        final paidBookings = bookings
            .where(
              (booking) =>
                  booking.paymentStatus == 'paid' ||
                  _isCompletedStatus(booking.bookingStatus),
            )
            .toList(growable: false);
        final walletBalance = paidBookings.fold<double>(
          0,
          (sum, booking) => sum + booking.quotedAmount,
        );
        final companyPayable = paidBookings.fold<double>(
          0,
          (sum, booking) => sum + booking.companyCommissionAmount,
        );
        final todayEarnings = todayBookings
            .where((booking) => _isCompletedStatus(booking.bookingStatus))
            .fold<double>(0, (sum, booking) => sum + booking.quotedAmount);

        return DecoratedBox(
          decoration: const BoxDecoration(color: AppColors.background),
          child: SafeArea(
            bottom: false,
            child: RefreshIndicator(
              onRefresh: () => _loadDashboard(isInitial: false),
              child: ListView(
              // Scaffold already keeps the body clear of the bottom nav bar
              // (NativeTabScaffold doesn't set extendBody), and the nav bar
              // handles its own SafeArea inset — so this only needs a small
              // breathing-room buffer, not another full nav-bar-sized gap.
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.md,
                AppSpacing.sm,
                AppSpacing.md,
                AppSpacing.md,
              ),
              children: [
                AppReveal(
                  child: _homeHeader(
                    context,
                    unreadMessages: unreadMessages,
                    profile: profile,
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                _SectionReveal(
                  child: _liveCoverageSection(
                    context,
                    profile: profile,
                    requests: requests,
                    bookings: bookings,
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                _SectionReveal(
                  child: _todaysTaskSection(
                    requests: requests,
                    ongoing: ongoing,
                    pendingToday: pendingToday,
                    completed: completed,
                    cancelled: cancelled,
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                _SectionReveal(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _walletSection(
                        walletBalance: walletBalance,
                        companyPayable: companyPayable,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      IntrinsicHeight(
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Expanded(
                              child: _miniMetricCard(
                                label: 'Bookings',
                                value: '${todayBookings.length}',
                                meta: 'Today',
                              ),
                            ),
                            const SizedBox(width: AppSpacing.sm),
                            Expanded(
                              child: _miniMetricCard(
                                label: 'Earnings',
                                value: _currencyCompact(todayEarnings),
                                meta: 'Today',
                              ),
                            ),
                            const SizedBox(width: AppSpacing.sm),
                            Expanded(
                              child: _miniMetricCard(
                                label: 'Rating',
                                value: profile.averageRating > 0
                                    ? profile.averageRating.toStringAsFixed(1)
                                    : '0.0',
                                meta: 'From ${profile.totalReviews}',
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                _SectionReveal(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _sectionHeading(
                        title: 'Recent Reviews',
                        subtitle:
                            'Latest customer feedback from your completed jobs.',
                        trailing: TextButton(
                          onPressed: () => Navigator.of(
                            context,
                          ).pushNamed(AppRoutes.providerReviews),
                          child: const Text('View all'),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      if (reviews.isEmpty)
                        const EmptyState(
                          title: 'No reviews yet',
                          subtitle:
                              'Customer feedback will appear here once completed bookings are reviewed.',
                          icon: Icons.star_border_rounded,
                        )
                      else
                        SizedBox(
                          height: 188,
                          child: ListView.separated(
                            scrollDirection: Axis.horizontal,
                            itemCount: reviews.length.clamp(0, 8),
                            separatorBuilder: (_, _) =>
                                const SizedBox(width: AppSpacing.sm),
                            itemBuilder: (context, index) =>
                                _reviewCard(context, reviews[index]),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
            ),
          ),
        );
    }
  }

  Widget _todaysTaskSection({
    required List<ProviderWorkspaceBooking> requests,
    required List<ProviderWorkspaceBooking> ongoing,
    required List<ProviderWorkspaceBooking> pendingToday,
    required List<ProviderWorkspaceBooking> completed,
    required List<ProviderWorkspaceBooking> cancelled,
  }) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppColors.gradientHeroStart,
            AppColors.gradientHeroMid,
            AppColors.gradientHeroEnd,
          ],
        ),
        borderRadius: BorderRadius.circular(_heroRadius),
        boxShadow: const [
          BoxShadow(
            color: AppColors.shadow,
            blurRadius: 28,
            offset: Offset(0, 14),
          ),
        ],
      ),
      child: Column(
        children: [
          _sectionHeading(
            title: 'Today\'s Task',
            subtitle: 'Total task of the day',
            accent: true,
            dark: true,
          ),
          const SizedBox(height: AppSpacing.md),
          _primaryTaskCard(requests, dark: true),
          const SizedBox(height: AppSpacing.md),
          LayoutBuilder(
            builder: (context, constraints) {
              final cards = [
                _taskSummaryCard(
                  title: 'On Going',
                  subtitle: 'Take live task actions',
                  count: ongoing.length,
                  icon: Icons.route_rounded,
                  dark: true,
                ),
                _taskSummaryCard(
                  title: 'Pending Task',
                  subtitle: 'Pending for today',
                  count: pendingToday.length,
                  icon: Icons.notifications_active_outlined,
                  dark: true,
                ),
                _taskSummaryCard(
                  title: 'Completed',
                  subtitle: 'Open finished task details',
                  count: completed.length,
                  icon: Icons.task_alt_rounded,
                  dark: true,
                ),
                _taskSummaryCard(
                  title: 'Cancelled',
                  subtitle: 'View cancelled tasks',
                  count: cancelled.length,
                  icon: Icons.cancel_outlined,
                  dark: true,
                ),
              ];

              // Each card sizes itself from its own content (no forced
              // aspect ratio), and IntrinsicHeight keeps the two cards in
              // a row equal-height — this is what avoids the RenderFlex
              // overflow the fixed-aspect-ratio grid used to hit once a
              // subtitle wrapped to a second line on a narrow phone.
              Widget row(Widget a, Widget b) {
                return IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Expanded(child: a),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(child: b),
                    ],
                  ),
                );
              }

              // Keep a comfortable 2x2 grid on typical phones; only spread
              // to a single row once the available width can host four
              // cards without squeezing them.
              if (constraints.maxWidth >= 480) {
                return IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      for (var i = 0; i < cards.length; i++) ...[
                        if (i > 0) const SizedBox(width: AppSpacing.sm),
                        Expanded(child: cards[i]),
                      ],
                    ],
                  ),
                );
              }

              return Column(
                children: [
                  row(cards[0], cards[1]),
                  const SizedBox(height: AppSpacing.sm),
                  row(cards[2], cards[3]),
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _liveCoverageSection(
    BuildContext context, {
    required ProviderWorkspaceProfile profile,
    required List<ProviderWorkspaceBooking> requests,
    required List<ProviderWorkspaceBooking> bookings,
  }) {
    final location = profile.serviceLocation.trim().isEmpty
        ? 'Kuala Lumpur, Malaysia'
        : profile.serviceLocation.trim();
    final nearbyTaskLabel = requests.isNotEmpty
        ? requests.first.serviceLabel
        : bookings.isNotEmpty
        ? bookings.first.serviceLabel
        : 'Nearby task';
    final nearbyCount =
        requests.length +
        bookings.where((item) {
          return const [
            'accepted',
            'on_the_way',
            'arrived',
          ].contains(item.bookingStatus);
        }).length;
    final markerLabels =
        <String>[
              if (requests.isNotEmpty) requests.first.location,
              if (requests.length > 1) requests[1].location,
              if (bookings.isNotEmpty) bookings.first.location,
            ]
            .map((item) => item.trim())
            .where((item) => item.isNotEmpty)
            .toSet()
            .toList(growable: false);
    final displayMarkers = markerLabels.isEmpty
        ? <String>['Mont Kiara', 'Sri Hartamas', 'Publika']
        : markerLabels.take(3).toList(growable: false);

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(_heroRadius),
        boxShadow: const [
          BoxShadow(
            color: AppColors.shadow,
            blurRadius: 24,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(_heroRadius - 6),
          child: SizedBox(
            height: 260,
            child: Stack(
              children: [
                Positioned.fill(
                  child: kIsWeb
                      ? AddressLiveMap(address: location, height: 260)
                      : _simulatedLiveMapBackdrop(),
                ),
                Positioned.fill(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.white.withValues(alpha: 0.08),
                          AppColors.primarySurface.withValues(alpha: 0.20),
                        ],
                      ),
                    ),
                  ),
                ),
                Positioned(
                  left: 16,
                  top: 14,
                  child: _liveMapBadge(
                    icon: Icons.place_outlined,
                    label: location,
                    background: Colors.white.withValues(alpha: 0.92),
                    foreground: AppColors.textPrimary,
                  ),
                ),
                Positioned(right: 14, top: 14, child: _liveMapActionBubble()),
                if (displayMarkers.isNotEmpty)
                  Positioned(
                    left: 24,
                    top: 72,
                    child: _liveTaskPin(label: displayMarkers.first),
                  ),
                if (displayMarkers.length > 1)
                  Positioned(
                    right: 26,
                    top: 88,
                    child: _liveTaskPin(label: displayMarkers[1]),
                  ),
                if (displayMarkers.length > 2)
                  Positioned(
                    left: 56,
                    bottom: 88,
                    child: _liveTaskPin(label: displayMarkers[2]),
                  ),
                Positioned.fill(
                  child: Center(
                    child: AnimatedBuilder(
                      animation: _sunController,
                      builder: (context, child) {
                        final pulse = Curves.easeOut.transform(
                          (_sunController.value + 0.15) % 1,
                        );
                        return SizedBox(
                          width: 142,
                          height: 142,
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              for (final multiplier in [1.0, 0.72, 0.46])
                                Container(
                                  width:
                                      142 * multiplier * (0.78 + pulse * 0.18),
                                  height:
                                      142 * multiplier * (0.78 + pulse * 0.18),
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: AppColors.primary.withValues(
                                      alpha: 0.05 * multiplier,
                                    ),
                                    border: Border.all(
                                      color: AppColors.primary.withValues(
                                        alpha: 0.10 + (0.08 * (1 - pulse)),
                                      ),
                                    ),
                                  ),
                                ),
                              Container(
                                width: 28,
                                height: 28,
                                decoration: BoxDecoration(
                                  color: AppColors.primary,
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: Colors.white,
                                    width: 4,
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: AppColors.primary.withValues(
                                        alpha: 0.38,
                                      ),
                                      blurRadius: 22,
                                      spreadRadius: 2,
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
                ),
                Positioned(
                  left: 12,
                  right: 12,
                  bottom: 12,
                  child: _liveStatusCard(
                    taskLabel: nearbyTaskLabel,
                    nearbyCount: nearbyCount,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _homeHeader(
    BuildContext context, {
    required int unreadMessages,
    required ProviderWorkspaceProfile profile,
  }) {
    final displayName = profile.marketingName.isNotEmpty
        ? profile.marketingName
        : profile.fullName.isNotEmpty
        ? profile.fullName
        : 'Provider';
    // How far the avatar peeks below the curved hero edge. Reserved
    // explicitly via the SizedBox below so the header's total height
    // always matches its actual content instead of a guessed number.
    const avatarPeek = 30.0;
    // Bottom padding inside the hero band, reserved so the peeking avatar
    // (its portion sitting above the curve) can never reach up into the
    // greeting/name text above it, regardless of how tall that text block
    // gets (e.g. a 2-line name). This is what guarantees no overlap.
    const heroBottomPadding = 88.0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Stack(
          clipBehavior: Clip.none,
          children: [
            LayoutBuilder(
              builder: (context, constraints) {
                // Bleed the hero band past the page's own horizontal
                // padding so it reaches the screen edges, using
                // OverflowBox (not a negative Container margin, which
                // Container's own assertions reject) and
                // OverflowBoxFit.deferToChild so it sizes itself from the
                // band's real (finite) content height rather than trying
                // to fill the ListView's unbounded height.
                final bleedWidth = constraints.maxWidth + AppSpacing.md * 2;
                return OverflowBox(
                  maxWidth: double.infinity,
                  alignment: Alignment.topCenter,
                  fit: OverflowBoxFit.deferToChild,
                  child: SizedBox(
                    width: bleedWidth,
                    child: ClipPath(
                      clipper: const _HeroCurveClipper(),
                      child: Container(
                        padding: const EdgeInsets.fromLTRB(
                          20,
                          14,
                          20,
                          heroBottomPadding,
                        ),
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [
                              AppColors.gradientHeroStart,
                              AppColors.gradientHeroMid,
                            ],
                          ),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  ValueListenableBuilder<_GreetingStyle>(
                                    valueListenable: _greetingNotifier,
                                    builder: (context, greeting, _) {
                                      return Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Flexible(
                                            child: Text(
                                              greeting.label,
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: const TextStyle(
                                                color: Colors.white,
                                                fontSize: 20,
                                                fontWeight: FontWeight.w400,
                                              ),
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                          _animatedGreetingIcon(greeting),
                                        ],
                                      );
                                    },
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    displayName,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 21,
                                      height: 1.2,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: AppSpacing.sm),
                            _IconBubble(
                              icon: Icons.notifications_none_rounded,
                              unreadCount: unreadMessages,
                              onNotificationsTap: () => Navigator.of(
                                context,
                              ).pushNamed(AppRoutes.providerMessages),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: -avatarPeek,
              child: Center(
                child: _animatedProfileAvatar(
                  displayName: displayName,
                  imageUrl: profile.avatarUrl,
                ),
              ),
            ),
          ],
        ),
        // Reserves exactly the peeking avatar's overflow so the next
        // section starts right where the avatar visually ends.
        const SizedBox(height: avatarPeek),
        const SizedBox(height: AppSpacing.sm),
        Center(child: _availabilityPill(isVisible: profile.isVisible)),
        const SizedBox(height: AppSpacing.md),
        _providerSummaryRow(profile),
      ],
    );
  }

  Widget _animatedGreetingIcon(_GreetingStyle style) {
    return AnimatedBuilder(
      animation: _sunController,
      child: Icon(style.icon, color: style.iconColor, size: 36),
      builder: (context, child) {
        final value = _sunController.value;
        final pulse = 0.94 + (math.sin(value * math.pi * 2) + 1) * 0.06;
        final glow = 10 + ((math.sin(value * math.pi * 2) + 1) * 8);
        return Transform.rotate(
          angle: _isSunAnimating && style.rotate ? value * math.pi * 2 : 0,
          child: Transform.scale(
            scale: pulse,
            child: Container(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: style.iconColor.withValues(alpha: 0.35),
                    blurRadius: glow,
                    spreadRadius: 1,
                  ),
                ],
              ),
              child: child,
            ),
          ),
        );
      },
    );
  }

  Widget _animatedProfileAvatar({
    required String displayName,
    required String imageUrl,
  }) {
    return AnimatedBuilder(
      animation: _sunController,
      builder: (context, child) {
        final value = _sunController.value;
        final bob = math.sin(value * math.pi * 2) * 3.5;
        final scale = 1 + (math.sin((value + 0.08) * math.pi * 2) * 0.015);
        return Transform.translate(
          offset: Offset(0, bob),
          child: Transform.scale(scale: scale, child: child),
        );
      },
      child: Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(
          color: Colors.white,
          shape: BoxShape.circle,
          border: Border.all(color: AppColors.textMuted, width: 2),
          boxShadow: const [
            BoxShadow(
              color: AppColors.shadow,
              blurRadius: 18,
              offset: Offset(0, 10),
            ),
          ],
        ),
        child: ProfileAvatar(name: displayName, imageUrl: imageUrl, radius: 50),
      ),
    );
  }

  Widget _availabilityPill({required bool isVisible}) {
    final label = isVisible ? 'Available' : 'Pending';
    final color = isVisible ? AppColors.success : AppColors.warning;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  // Reviews | Radius | Location summary — all three values come from the
  // already-loaded provider profile, no extra fetch involved.
  Widget _providerSummaryRow(ProviderWorkspaceProfile profile) {
    final reviewValue = profile.averageRating > 0
        ? profile.averageRating.toStringAsFixed(1)
        : '0.0';
    final radiusValue = '${profile.serviceRadiusKm.toStringAsFixed(0)} km';
    final locationValue = _cityLabel(profile);

    return Row(
      children: [
        Expanded(
          child: _summaryColumn(value: reviewValue, label: 'Reviews'),
        ),
        _summaryDivider(),
        Expanded(
          child: _summaryColumn(value: radiusValue, label: 'Radius'),
        ),
        _summaryDivider(),
        Expanded(
          child: _summaryColumn(value: locationValue, label: 'Location'),
        ),
      ],
    );
  }

  Widget _summaryColumn({required String value, required String label}) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w800,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: AppColors.textSecondary,
          ),
        ),
      ],
    );
  }

  Widget _summaryDivider() {
    return const SizedBox(
      width: AppSpacing.md,
      height: 28,
      child: Center(
        child: SizedBox(
          width: 1,
          height: 24,
          child: ColoredBox(color: AppColors.divider),
        ),
      ),
    );
  }

  // `city` is the dedicated field the backend already resolves; only fall
  // back to slicing the free-form service location when it's empty.
  String _cityLabel(ProviderWorkspaceProfile profile) {
    final city = profile.city.trim();
    if (city.isNotEmpty) {
      return city;
    }
    final location = profile.serviceLocation.trim();
    if (location.isEmpty) {
      return 'Not set';
    }
    final segments = location.split(',');
    return segments.last.trim();
  }

  Widget _liveMapBadge({
    required IconData icon,
    required String label,
    required Color background,
    required Color foreground,
  }) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 220),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(999),
          boxShadow: const [
            BoxShadow(
              color: AppColors.shadow,
              blurRadius: 12,
              offset: Offset(0, 6),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: foreground),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: foreground,
                  fontWeight: FontWeight.w700,
                  fontSize: 12,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _liveMapActionBubble() {
    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.94),
        shape: BoxShape.circle,
        boxShadow: const [
          BoxShadow(
            color: AppColors.shadow,
            blurRadius: 16,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: const Icon(
        Icons.gps_fixed_rounded,
        color: AppColors.primary,
        size: 22,
      ),
    );
  }

  Widget _liveTaskPin({required String label}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Container(
          width: 52,
          height: 52,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.96),
            shape: BoxShape.circle,
            boxShadow: const [
              BoxShadow(
                color: AppColors.shadow,
                blurRadius: 16,
                offset: Offset(0, 8),
              ),
            ],
          ),
          child: const Icon(
            Icons.home_repair_service_rounded,
            color: AppColors.primary,
            size: 24,
          ),
        ),
        const SizedBox(height: 8),
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 92),
          child: Text(
            label,
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppColors.textSecondary,
            ),
          ),
        ),
      ],
    );
  }

  Widget _liveStatusCard({
    required String taskLabel,
    required int nearbyCount,
  }) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.96),
        borderRadius: BorderRadius.circular(_tileRadius + 4),
        boxShadow: const [
          BoxShadow(
            color: AppColors.shadow,
            blurRadius: 16,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: const BoxDecoration(
              color: AppColors.primarySurface,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.travel_explore_rounded,
              color: AppColors.primary,
              size: 24,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Finding nearby tasks...',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.primarySurface,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        taskLabel,
                        style: const TextStyle(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w700,
                          fontSize: 12,
                        ),
                      ),
                    ),
                    Text(
                      '${nearbyCount <= 0 ? 1 : nearbyCount} live tasks in range',
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w600,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _simulatedLiveMapBackdrop() {
    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFF9FBFF), Color(0xFFF2F7FF), Color(0xFFF8F1FF)],
        ),
      ),
      child: CustomPaint(
        painter: _LiveMapGridPainter(),
        child: const SizedBox.expand(),
      ),
    );
  }

  _GreetingStyle _buildGreetingStyle() {
    final hour = DateTime.now().hour;
    if (hour >= 3 && hour < 12) {
      return const _GreetingStyle(
        label: 'Good Morning',
        icon: Icons.wb_sunny_rounded,
        iconColor: Color(0xFFFFC94D),
        rotate: true,
      );
    }
    if (hour >= 12 && hour < 18) {
      return const _GreetingStyle(
        label: 'Good Afternoon',
        icon: Icons.wb_sunny_rounded,
        iconColor: Color(0xFFFFB347),
        rotate: true,
      );
    }
    if (hour >= 18 && hour < 21) {
      return const _GreetingStyle(
        label: 'Good Evening',
        icon: Icons.wb_sunny_rounded,
        iconColor: Color(0xFFFFC94D),
        rotate: true,
      );
    }
    return const _GreetingStyle(
      label: 'Working late tonight?',
      icon: Icons.nightlight_round,
      iconColor: Color(0xFFB8C3FF),
      rotate: false,
    );
  }

  Widget _walletSection({
    required double walletBalance,
    required double companyPayable,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.gradientCardStart, AppColors.gradientCardEnd],
        ),
        borderRadius: BorderRadius.circular(_heroRadius),
        boxShadow: const [
          BoxShadow(
            color: AppColors.shadow,
            blurRadius: 28,
            offset: Offset(0, 14),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Text(
                      'Wallet Overview',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Live totals from your provider bookings',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: AppColors.primarySurface,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: const Text(
                  'Live',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: AppColors.primary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          _moneyCard(
            title: 'Wallet Balance',
            amount: _currency(walletBalance),
            description: 'Full amount collected from customers',
            icon: Icons.account_balance_wallet_outlined,
            primary: true,
            cta: 'Withdraw',
          ),
          const SizedBox(height: AppSpacing.sm),
          _moneyCard(
            title: 'Payable to Company',
            amount: _currency(companyPayable),
            description: 'Amount due to DELLA from recent customer payments',
            icon: Icons.apartment_rounded,
            cta: 'Pay to Company',
          ),
        ],
      ),
    );
  }

  Widget _moneyCard({
    required String title,
    required String amount,
    required String description,
    required IconData icon,
    bool primary = false,
    String cta = 'Withdraw',
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(_cardRadius),
        boxShadow: const [
          BoxShadow(
            color: AppColors.shadow,
            blurRadius: 18,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: primary
                            ? AppColors.primarySurface
                            : AppColors.surfaceSoft,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: AppColors.primary,
                          letterSpacing: 0.4,
                        ),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      amount,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: primary ? 26 : 22,
                        fontWeight: FontWeight.w900,
                        color: AppColors.textPrimary,
                        letterSpacing: -0.6,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      description,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12,
                        height: 1.3,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: primary
                      ? AppColors.successSurface
                      : AppColors.primarySurface,
                  borderRadius: BorderRadius.circular(_tileRadius),
                ),
                child: Icon(
                  icon,
                  size: 22,
                  color: primary ? AppColors.success : AppColors.primary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: primary
                ? SwiperButton(label: cta, onPressed: () {})
                : OutlinedButton(
                    onPressed: () {},
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.primary,
                      side: const BorderSide(color: AppColors.border),
                      minimumSize: const Size.fromHeight(46),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(_tileRadius),
                      ),
                    ),
                    child: Text(cta),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _miniMetricCard({
    required String label,
    required String value,
    required String meta,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(_tileRadius),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w900,
              color: AppColors.primary,
              height: 1.1,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 1),
          Text(
            meta,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
          ),
        ],
      ),
    );
  }

  Widget _sectionHeading({
    required String title,
    required String subtitle,
    Widget? trailing,
    bool accent = false,
    bool dark = false,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (accent)
          Container(
            width: 6,
            height: 28,
            margin: const EdgeInsets.only(top: 2, right: 12),
            decoration: BoxDecoration(
              color: dark ? Colors.white : AppColors.primary,
              borderRadius: BorderRadius.circular(999),
            ),
          ),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: dark ? Colors.white : AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                subtitle,
                style: TextStyle(
                  fontSize: 12,
                  color: dark
                      ? Colors.white.withValues(alpha: 0.78)
                      : AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
        if (trailing != null) ...[trailing],
      ],
    );
  }

  Widget _primaryTaskCard(
    List<ProviderWorkspaceBooking> requests, {
    bool dark = false,
  }) {
    return GestureDetector(
      onTap: () => widget.onNavigateToTab?.call(1),
      child: Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: dark
              ? const [AppColors.gradientHeroMid, AppColors.gradientHeroEnd]
              : const [AppColors.gradientCardStart, AppColors.gradientCardEnd],
        ),
        borderRadius: BorderRadius.circular(_cardRadius),
        border: Border.all(
          color: dark
              ? AppColors.gradientHeroBorder.withValues(alpha: 0.5)
              : AppColors.border,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: dark
                  ? Colors.white.withValues(alpha: 0.10)
                  : AppColors.primarySurface,
              borderRadius: BorderRadius.circular(_tileRadius),
              border: Border.all(
                color: dark
                    ? Colors.white.withValues(alpha: 0.16)
                    : AppColors.border,
              ),
            ),
            child: Icon(
              Icons.calendar_month_rounded,
              color: dark ? Colors.white : AppColors.primary,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: dark
                        ? Colors.white.withValues(alpha: 0.12)
                        : AppColors.primarySurface,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    'Live from provider bookings',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: dark ? Colors.white : AppColors.primary,
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                RichText(
                  text: TextSpan(
                    style: TextStyle(
                      color: dark ? Colors.white : AppColors.textPrimary,
                    ),
                    children: [
                      TextSpan(
                        text: '${requests.length}',
                        style: TextStyle(
                          fontSize: 30,
                          fontWeight: FontWeight.w900,
                          color: dark
                              ? const Color(0xFFD7C7FF)
                              : AppColors.primary,
                        ),
                      ),
                      const TextSpan(
                        text: ' New Task',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Reviewing and accepting new requests',
                  style: TextStyle(
                    fontSize: 12,
                    color: dark
                        ? Colors.white.withValues(alpha: 0.78)
                        : AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: dark
                  ? Colors.white.withValues(alpha: 0.10)
                  : AppColors.primarySurface,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Icon(
              Icons.chevron_right_rounded,
              color: dark ? Colors.white : AppColors.primary,
              size: 20,
            ),
          ),
        ],
      ),
      ),
    );
  }

  Widget _taskSummaryCard({
    required String title,
    required String subtitle,
    required int count,
    required IconData icon,
    bool dark = false,
  }) {
    final accent = switch (title) {
      'On Going' => AppColors.primaryLight,
      'Pending Task' => AppColors.warning,
      'Completed' => AppColors.success,
      'Cancelled' => AppColors.error,
      _ => AppColors.primary,
    };

    // Softer, translucent surface for the tiles so the status color carries
    // the accent instead of stacking another saturated purple fill on top
    // of the already-dark hero background.
    return GestureDetector(
      onTap: () => widget.onNavigateToTab?.call(1),
      child: Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: dark ? Colors.white.withValues(alpha: 0.08) : AppColors.surface,
        borderRadius: BorderRadius.circular(_cardRadius),
        border: Border.all(
          color: dark ? Colors.white.withValues(alpha: 0.14) : AppColors.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: dark
                      ? Colors.white.withValues(alpha: 0.10)
                      : AppColors.primarySurface,
                  borderRadius: BorderRadius.circular(_tileRadius - 2),
                ),
                child: Icon(icon, color: accent, size: 20),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '$count',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 27,
                        fontWeight: FontWeight.w900,
                        color: accent,
                        height: 1.0,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      count == 1 ? 'task' : 'tasks',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 10,
                        color: dark
                            ? Colors.white.withValues(alpha: 0.6)
                            : AppColors.textMuted,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const Spacer(),
          const SizedBox(height: 8),
          Text(
            title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: dark ? Colors.white : AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            subtitle,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 10,
              height: 1.2,
              color: dark
                  ? Colors.white.withValues(alpha: 0.6)
                  : AppColors.textMuted,
            ),
          ),
        ],
      ),
      ),
    );
  }

  Widget _reviewCard(BuildContext context, ProviderReviewItem review) {
    final textTheme = Theme.of(context).textTheme;
    return Container(
      width: 256,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(_cardRadius),
        border: Border.all(color: AppColors.border),
        boxShadow: const [
          BoxShadow(
            color: AppColors.shadow,
            blurRadius: 16,
            offset: Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ProfileAvatar(name: review.customerName, radius: 18),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      review.customerName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: textTheme.labelLarge,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      review.createdLabel.isEmpty
                          ? review.createdAt
                          : review.createdLabel,
                      style: textTheme.bodySmall?.copyWith(
                        color: AppColors.textMuted,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: List.generate(
              5,
              (index) => Icon(
                index < review.rating
                    ? Icons.star_rounded
                    : Icons.star_outline_rounded,
                size: 16,
                color: const Color(0xFFF5B301),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Expanded(
            child: Text(
              review.comment,
              maxLines: 4,
              overflow: TextOverflow.ellipsis,
              style: textTheme.bodyMedium?.copyWith(height: 1.5),
            ),
          ),
        ],
      ),
    );
  }

  List<ProviderWorkspaceBooking> _sortBookings(
    Iterable<ProviderWorkspaceBooking> bookings,
  ) {
    final list = bookings.toList(growable: false);
    list.sort(
      (a, b) => '${a.scheduledDate}T${a.scheduledStartTime}'.compareTo(
        '${b.scheduledDate}T${b.scheduledStartTime}',
      ),
    );
    return list;
  }

  String _currency(double value) => 'RM ${value.toStringAsFixed(2)}';

  String _currencyCompact(double value) {
    if (value >= 1000) {
      return 'RM ${(value / 1000).toStringAsFixed(1)}k';
    }
    return 'RM ${value.toStringAsFixed(0)}';
  }

  bool _isCompletedStatus(String status) {
    return const [
      'completed',
      'paid',
      'review_requested',
      'reviewed',
    ].contains(status);
  }

  bool _isCancelledStatus(String status) {
    return const [
      'declined',
      'declined_by_provider',
      'cancelled',
    ].contains(status);
  }
}

class _ProviderDashboardData {
  const _ProviderDashboardData({
    required this.workspace,
    required this.reviews,
    required this.threads,
  });

  final ProviderWorkspaceSnapshot workspace;
  final List<ProviderReviewItem> reviews;
  final List<ProviderMessageThread> threads;
}

class _GreetingStyle {
  const _GreetingStyle({
    required this.label,
    required this.icon,
    required this.iconColor,
    required this.rotate,
  });

  final String label;
  final IconData icon;
  final Color iconColor;
  final bool rotate;
}

class _LiveMapGridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final roadPaint = Paint()
      ..color = const Color(0xFFE6EAF8)
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;
    final accentPaint = Paint()
      ..color = const Color(0xFFDDE4F7)
      ..strokeWidth = 6
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final verticals = [
      size.width * 0.16,
      size.width * 0.34,
      size.width * 0.58,
      size.width * 0.82,
    ];
    for (final x in verticals) {
      final path = Path()
        ..moveTo(x, 0)
        ..quadraticBezierTo(x - 16, size.height * 0.45, x + 12, size.height);
      canvas.drawPath(path, roadPaint);
    }

    final horizontals = [
      size.height * 0.18,
      size.height * 0.40,
      size.height * 0.68,
    ];
    for (final y in horizontals) {
      final path = Path()
        ..moveTo(0, y)
        ..quadraticBezierTo(size.width * 0.42, y - 10, size.width, y + 12);
      canvas.drawPath(path, roadPaint);
    }

    final diagonal = Path()
      ..moveTo(size.width * 0.06, size.height * 0.86)
      ..quadraticBezierTo(
        size.width * 0.42,
        size.height * 0.58,
        size.width * 0.92,
        size.height * 0.24,
      );
    canvas.drawPath(diagonal, accentPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Soft, single-arc dip along the bottom edge of the header hero — a
/// lightweight static clip (no animation, no blur) computed once per
/// layout pass.
class _HeroCurveClipper extends CustomClipper<Path> {
  const _HeroCurveClipper();

  @override
  Path getClip(Size size) {
    return Path()
      ..lineTo(0, size.height - 26)
      ..quadraticBezierTo(
        size.width / 2,
        size.height + 22,
        size.width,
        size.height - 26,
      )
      ..lineTo(size.width, 0)
      ..close();
  }

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => false;
}

class _IconBubble extends StatelessWidget {
  const _IconBubble({
    required this.icon,
    required this.unreadCount,
    required this.onNotificationsTap,
  });

  final IconData icon;
  final int unreadCount;
  final VoidCallback onNotificationsTap;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(18),
            onTap: onNotificationsTap,
            child: Ink(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
              ),
              child: Icon(icon, color: Colors.white),
            ),
          ),
        ),
        if (unreadCount > 0)
          Positioned(
            right: -2,
            top: -2,
            child: Container(
              width: 20,
              height: 20,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppColors.error,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(
                  color: AppColors.gradientHeroStart,
                  width: 2,
                ),
              ),
              child: Text(
                unreadCount > 9 ? '9+' : '$unreadCount',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 9,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// Reveals [child] with the same fade + small-upward-slide treatment as
/// [AppReveal], but driven by scroll visibility (with hysteresis) instead
/// of a one-shot timer — so sections below the fold still animate in as
/// they're scrolled into view. Uses only implicit animations (no
/// AnimationController) and a scroll-position listener already present on
/// the ambient Scrollable, so it adds no new tickers or API/data work.
class _SectionReveal extends StatefulWidget {
  const _SectionReveal({required this.child});

  final Widget child;

  @override
  State<_SectionReveal> createState() => _SectionRevealState();
}

class _SectionRevealState extends State<_SectionReveal> {
  bool _visible = false;
  ScrollPosition? _scrollPosition;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final position = Scrollable.maybeOf(context)?.position;
    if (!identical(position, _scrollPosition)) {
      _scrollPosition?.removeListener(_handleScroll);
      _scrollPosition = position;
      _scrollPosition?.addListener(_handleScroll);
    }
    WidgetsBinding.instance.addPostFrameCallback((_) => _handleScroll());
  }

  @override
  void dispose() {
    _scrollPosition?.removeListener(_handleScroll);
    super.dispose();
  }

  void _handleScroll() {
    if (!mounted) {
      return;
    }
    final renderObject = context.findRenderObject();
    if (renderObject is! RenderBox || !renderObject.hasSize) {
      return;
    }
    final viewportHeight = MediaQuery.sizeOf(context).height;
    final top = renderObject.localToGlobal(Offset.zero).dy;
    final bottom = top + renderObject.size.height;

    if (!_visible) {
      // Reveal once the section is mostly within the viewport.
      if (top < viewportHeight * 0.88 && bottom > 0) {
        setState(() => _visible = true);
      }
    } else if (bottom < -viewportHeight * 0.25 || top > viewportHeight * 1.25) {
      // Only re-hide once well clear of the viewport, so a few pixels of
      // scroll jitter near the edge never flickers between states.
      setState(() => _visible = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (AppMotion.reduceMotion(context)) {
      return widget.child;
    }
    final duration = AppMotion.resolveDuration(context, AppMotion.normal);
    return AnimatedOpacity(
      duration: duration,
      curve: AppMotion.enterCurve,
      opacity: _visible ? 1 : 0,
      child: AnimatedSlide(
        duration: duration,
        curve: AppMotion.enterCurve,
        offset: _visible ? Offset.zero : const Offset(0, 0.06),
        child: widget.child,
      ),
    );
  }
}

String _dateKey(DateTime value) {
  final month = value.month.toString().padLeft(2, '0');
  final day = value.day.toString().padLeft(2, '0');
  return '${value.year}-$month-$day';
}
