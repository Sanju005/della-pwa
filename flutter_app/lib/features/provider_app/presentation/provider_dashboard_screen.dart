import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/routing/app_routes.dart';
import '../../../repositories/demo_repository.dart';
import '../../../services/provider_workspace_service.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/loading_state.dart';
import '../../../widgets/profile_avatar.dart';
import '../../../widgets/swiper_button.dart';

class ProviderDashboardScreen extends StatefulWidget {
  const ProviderDashboardScreen({
    super.key,
    required this.repository,
  });

  final DemoRepository repository;

  @override
  State<ProviderDashboardScreen> createState() => _ProviderDashboardScreenState();
}

class _ProviderDashboardScreenState extends State<ProviderDashboardScreen>
    with SingleTickerProviderStateMixin {
  static const _workspaceService = ProviderWorkspaceService();

  late Future<_ProviderDashboardData> _future;
  late final AnimationController _sunController;
  Timer? _greetingTimer;
  final bool _isSunAnimating = true;

  @override
  void initState() {
    super.initState();
    _future = _loadDashboard();
    _sunController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 8),
    )..repeat();
    _greetingTimer = Timer.periodic(const Duration(minutes: 1), (_) {
      if (mounted) {
        setState(() {});
      }
    });
  }

  @override
  void dispose() {
    _greetingTimer?.cancel();
    _sunController.dispose();
    super.dispose();
  }

  Future<_ProviderDashboardData> _loadDashboard() async {
    final results = await Future.wait<Object>([
      _workspaceService.fetchWorkspace(),
      _workspaceService.fetchReviews(),
      _workspaceService.fetchMessageThreads(),
    ]);
    return _ProviderDashboardData(
      workspace: results[0] as ProviderWorkspaceSnapshot,
      reviews: results[1] as List<ProviderReviewItem>,
      threads: results[2] as List<ProviderMessageThread>,
    );
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<_ProviderDashboardData>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const LoadingState(label: 'Loading provider workspace...');
        }
        if (snapshot.hasError || snapshot.data == null) {
          return const EmptyState(
            title: 'Unable to load provider workspace',
            subtitle: 'Please try again.',
            icon: Icons.error_outline_rounded,
          );
        }

        final dashboard = snapshot.data!;
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
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Color(0xFFFCFBFF),
                Color(0xFFF7F2FB),
              ],
            ),
          ),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.md,
              AppSpacing.md,
              AppSpacing.md,
              112,
            ),
            children: [
              _homeHeader(
                context,
                unreadMessages: unreadMessages,
                profile: profile,
                reviewCount: reviews.length,
              ),
              const SizedBox(height: AppSpacing.lg),
              _sectionHeading(
                title: 'Today\'s Task',
                subtitle: 'Total task of the day',
                accent: true,
              ),
              const SizedBox(height: AppSpacing.md),
              _primaryTaskCard(requests),
              const SizedBox(height: AppSpacing.md),
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: AppSpacing.sm,
                crossAxisSpacing: AppSpacing.sm,
                childAspectRatio: 1.22,
                children: [
                  _taskSummaryCard(
                    title: 'On Going',
                    subtitle: 'Take live task actions',
                    count: ongoing.length,
                    icon: Icons.route_rounded,
                  ),
                  _taskSummaryCard(
                    title: 'Pending Task',
                    subtitle: 'Pending for today',
                    count: pendingToday.length,
                    icon: Icons.notifications_active_outlined,
                  ),
                  _taskSummaryCard(
                    title: 'Completed',
                    subtitle: 'Open finished task details',
                    count: completed.length,
                    icon: Icons.task_alt_rounded,
                  ),
                  _taskSummaryCard(
                    title: 'Cancelled',
                    subtitle: 'View cancelled tasks',
                    count: cancelled.length,
                    icon: Icons.cancel_outlined,
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),
              _walletSection(
                walletBalance: walletBalance,
                companyPayable: companyPayable,
              ),
              const SizedBox(height: AppSpacing.md),
              Row(
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
              const SizedBox(height: AppSpacing.lg),
              _sectionHeading(
                title: 'Recent Reviews',
                subtitle: 'Latest customer feedback from your completed jobs.',
                trailing: TextButton(
                  onPressed: () => Navigator.of(context).pushNamed(
                    AppRoutes.providerReviews,
                  ),
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
                    separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
                    itemBuilder: (context, index) =>
                        _reviewCard(reviews[index]),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  Widget _homeHeader(
    BuildContext context, {
    required int unreadMessages,
    required ProviderWorkspaceProfile profile,
    required int reviewCount,
  }) {
    final greeting = _buildGreetingStyle();
    final displayName = profile.marketingName.isNotEmpty
        ? profile.marketingName
        : profile.fullName.isNotEmpty
            ? profile.fullName
            : 'Provider';
    final location = profile.serviceLocation.isEmpty
        ? 'Location not set yet'
        : profile.serviceLocation;
    return Column(
      children: [
        Container(
          margin: const EdgeInsets.symmetric(horizontal: -AppSpacing.md),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(34),
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Color(0xFF170C43),
                Color(0xFF2C1567),
                Color(0xFF4B2391),
              ],
            ),
            boxShadow: const [
              BoxShadow(
                color: Color(0x331E0E58),
                blurRadius: 34,
                offset: Offset(0, 18),
              ),
            ],
          ),
          child: Stack(
            children: [
              const Positioned(
                right: -92,
                top: 146,
                child: _HeroArc(size: 280, opacity: 0.2),
              ),
              const Positioned(
                right: -12,
                top: 178,
                child: _HeroArc(size: 180, opacity: 0.14),
              ),
              Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(34),
                    gradient: RadialGradient(
                      center: const Alignment(-0.95, -0.95),
                      radius: 1.1,
                      colors: [
                        Colors.white.withValues(alpha: 0.08),
                        Colors.transparent,
                      ],
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 18, 18, 98),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            'Hello, ${_firstName(displayName)}',
                            style: Theme.of(context)
                                .textTheme
                                .headlineLarge
                                ?.copyWith(
                                  color: Colors.white,
                                  fontSize: 34,
                                  height: 1.05,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: -0.8,
                                ),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        _IconBubble(
                          icon: Icons.notifications_none_rounded,
                          unreadCount: unreadMessages,
                          onNotificationsTap: () => Navigator.of(context)
                              .pushNamed(AppRoutes.providerMessages),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Flexible(
                          child: Text(
                            greeting.label,
                            maxLines: 1,
                            overflow: TextOverflow.visible,
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: greeting.label.length > 24 ? 20 : 27,
                              fontWeight: FontWeight.w600,
                              height: 1.1,
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        AnimatedBuilder(
                          animation: _sunController,
                          builder: (context, child) {
                            final glow = _isSunAnimating
                                ? 0.78 +
                                    (math.sin(_sunController.value * math.pi * 2) *
                                        0.18)
                                : 0.78;
                            return DecoratedBox(
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                boxShadow: [
                                  BoxShadow(
                                    color: greeting.iconColor.withValues(
                                      alpha: glow.clamp(0.0, 1.0),
                                    ),
                                    blurRadius: 10,
                                    spreadRadius: 0.5,
                                  ),
                                ],
                              ),
                              child: Transform.rotate(
                                angle: greeting.rotate && _isSunAnimating
                                    ? _sunController.value * math.pi * 2
                                    : 0,
                                child: child,
                              ),
                            );
                          },
                          child: Icon(
                            greeting.icon,
                            color: greeting.iconColor,
                            size: greeting.label.length > 24 ? 28 : 32,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Live provider workspace overview',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: Colors.white.withValues(alpha: 0.76),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        Transform.translate(
          offset: const Offset(0, -72),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 0),
            child: Column(
              children: [
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Transform.translate(
                      offset: const Offset(0, -20),
                      child: Container(
                        padding: const EdgeInsets.all(5),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                          boxShadow: const [
                            BoxShadow(
                              color: Color(0x2919154A),
                              blurRadius: 26,
                              offset: Offset(0, 14),
                            ),
                          ],
                        ),
                        child: ProfileAvatar(
                          name: displayName,
                          imageUrl: profile.avatarUrl,
                          radius: 55,
                        ),
                      ),
                    ),
                    Positioned(
                      bottom: -20,
                      left: 0,
                      right: 0,
                      child: Center(
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 7,
                          ),
                          decoration: BoxDecoration(
                            color: profile.isVisible
                                ? AppColors.success
                                : AppColors.warning,
                            borderRadius: BorderRadius.circular(999),
                            boxShadow: const [
                              BoxShadow(
                                color: Color(0x2416A34A),
                                blurRadius: 18,
                                offset: Offset(0, 8),
                              ),
                            ],
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 10,
                                height: 10,
                                decoration: const BoxDecoration(
                                  color: Colors.white,
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                profile.isVisible ? 'Available' : 'Pending',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 52),
                Text(
                  displayName,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF0F172A),
                    letterSpacing: -0.7,
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _inlinePill(
                      icon: Icons.location_on_outlined,
                      text: location,
                      foreground: AppColors.success,
                      background: const Color(0xFFECF9F2),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _inlinePill(
                      icon: Icons.route_rounded,
                      text:
                          '${profile.serviceRadiusKm.toStringAsFixed(0)} km radius',
                      foreground: AppColors.primary,
                      background: const Color(0xFFF3EEFF),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(
                      Icons.star_rounded,
                      size: 18,
                      color: Color(0xFFF5B301),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      profile.averageRating > 0
                          ? profile.averageRating.toStringAsFixed(1)
                          : '0.0',
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF334155),
                      ),
                    ),
                    Text(
                      ' ($reviewCount reviews)',
                      style: const TextStyle(color: Color(0xFF475569)),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _inlinePill({
    required IconData icon,
    required String text,
    required Color foreground,
    required Color background,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: foreground),
          const SizedBox(width: 6),
          Text(
            text,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: foreground,
            ),
          ),
        ],
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
    if (hour >= 12 && hour < 15) {
      return const _GreetingStyle(
        label: 'Good Afternoon',
        icon: Icons.sunny,
        iconColor: Color(0xFFFFB347),
        rotate: true,
      );
    }
    if (hour >= 15 && hour < 20) {
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
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFFFFFFFF),
            Color(0xFFF7F1FF),
          ],
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFE5D9F8)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x14562687),
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
                  color: const Color(0xFFEDE6FF),
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
          const SizedBox(height: AppSpacing.md),
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
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: primary
              ? const [
                  Color(0xFFFFFFFF),
                  Color(0xFFF5EEFF),
                ]
              : const [
                  Color(0xFFFFFFFF),
                  Color(0xFFFDFCFF),
                ],
        ),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: primary
              ? const Color(0xFFDCCCF7)
              : const Color(0xFFEAE0F8),
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0B562687),
            blurRadius: 18,
            offset: Offset(0, 8),
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
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: primary
                            ? const Color(0xFFEDE6FF)
                            : const Color(0xFFF3EEFB),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        title,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: AppColors.primary,
                          letterSpacing: 0.4,
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      amount,
                      style: TextStyle(
                        fontSize: primary ? 34 : 28,
                        fontWeight: FontWeight.w900,
                        color: AppColors.textPrimary,
                        letterSpacing: -0.8,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      description,
                      style: const TextStyle(
                        fontSize: 12,
                        height: 1.45,
                        color: Color(0xFF7C728F),
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: primary
                        ? const [
                            Color(0xFFEAF8EF),
                            Color(0xFFF7FFF8),
                          ]
                        : const [
                            Color(0xFFF4EEFF),
                            Color(0xFFFCFAFF),
                          ],
                  ),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Icon(
                  icon,
                  color: primary ? const Color(0xFF22C55E) : AppColors.primary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            child: primary
                ? SwiperButton(label: cta, onPressed: () {})
                : OutlinedButton(
                    onPressed: () {},
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.primary,
                      side: const BorderSide(color: Color(0xFFD9C8EE)),
                      minimumSize: const Size.fromHeight(46),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
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
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: const Color(0xFFFCFAFF),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFEEE5F7)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0C562687),
            blurRadius: 18,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w900,
              color: AppColors.primary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: Color(0xFF544B66),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            meta,
            style: const TextStyle(
              fontSize: 11,
              color: Color(0xFF9A90AC),
            ),
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
              color: const Color(0xFF645394),
              borderRadius: BorderRadius.circular(999),
            ),
          ),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0F172A),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                subtitle,
                style: const TextStyle(
                  fontSize: 12,
                  color: Color(0xFF7B728A),
                ),
              ),
            ],
          ),
        ),
        if (trailing != null) ...[trailing],
      ],
    );
  }

  Widget _primaryTaskCard(List<ProviderWorkspaceBooking> requests) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFFFFFFFF),
            Color(0xFFF2EBFF),
          ],
        ),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFE3D9F5)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x14562687),
            blurRadius: 24,
            offset: Offset(0, 12),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Color(0xFFF6F0FF),
                  Colors.white,
                ],
              ),
              borderRadius: const BorderRadius.all(Radius.circular(18)),
              border: Border.all(color: const Color(0xFFE5D8FA)),
            ),
            child: const Icon(
              Icons.calendar_month_rounded,
              color: Color(0xFF645394),
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
                    color: const Color(0xFFEFE8FF),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: const Text(
                    'Live from provider bookings',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary,
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                RichText(
                  text: TextSpan(
                    style: const TextStyle(
                      color: Color(0xFF1F1630),
                    ),
                    children: [
                      TextSpan(
                        text: '${requests.length}',
                        style: const TextStyle(
                          fontSize: 30,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF645394),
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
                const Text(
                  'Reviewing and accepting new requests',
                  style: TextStyle(
                    fontSize: 12,
                    color: Color(0xFF7B728A),
                  ),
                ),
              ],
            ),
          ),
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: const Color(0xFFF4EEFF),
              borderRadius: BorderRadius.circular(999),
            ),
            child: const Icon(
              Icons.chevron_right_rounded,
              color: Color(0xFF645394),
              size: 20,
            ),
          ),
        ],
      ),
    );
  }

  Widget _taskSummaryCard({
    required String title,
    required String subtitle,
    required int count,
    required IconData icon,
  }) {
    final accent = switch (title) {
      'On Going' => const Color(0xFF7C5AE0),
      'Pending Task' => const Color(0xFFF0A53A),
      'Completed' => const Color(0xFF22A06B),
      'Cancelled' => const Color(0xFFE26774),
      _ => AppColors.primary,
    };

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFFFFFFFF),
            Color(0xFFF7F2FF),
          ],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE5DAF7)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x10562687),
            blurRadius: 20,
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
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      Color(0xFFF6F0FF),
                      Colors.white,
                    ],
                  ),
                  borderRadius: const BorderRadius.all(Radius.circular(15)),
                  border: Border.all(color: const Color(0xFFE7DCF8)),
                ),
                child: Icon(icon, color: accent),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '$count',
                      style: TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w900,
                        color: accent,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      count == 1 ? 'task' : 'tasks',
                      style: const TextStyle(
                        fontSize: 11,
                        color: Color(0xFF8C829E),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const Spacer(),
          Text(
            title,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: Color(0xFF1F1630),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            subtitle,
            style: const TextStyle(
              fontSize: 11,
              color: Color(0xFF7B728A),
            ),
          ),
        ],
      ),
    );
  }

  Widget _reviewCard(ProviderReviewItem review) {
    return Container(
      width: 256,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Colors.white,
            Color(0xFFF3EAFD),
          ],
        ),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFEEE5F7)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0D562687),
            blurRadius: 20,
            offset: Offset(0, 8),
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
                      review.customerName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      review.createdLabel.isEmpty
                          ? review.createdAt
                          : review.createdLabel,
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF64748B),
                      ),
                    ),
                  ],
                ),
              ),
              Row(
                children: List.generate(
                  review.rating,
                  (index) => const Padding(
                    padding: EdgeInsets.only(left: 2),
                    child: Icon(
                      Icons.star_rounded,
                      size: 16,
                      color: AppColors.primary,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Expanded(
            child: Text(
              review.comment,
              maxLines: 4,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 13,
                height: 1.5,
                color: Color(0xFF475569),
              ),
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
      (a, b) => '${a.scheduledDate}T${a.scheduledStartTime}'
          .compareTo('${b.scheduledDate}T${b.scheduledStartTime}'),
    );
    return list;
  }

  String _firstName(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) {
      return 'Provider';
    }
    return trimmed.split(' ').first;
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

class _HeroArc extends StatelessWidget {
  const _HeroArc({
    required this.size,
    required this.opacity,
  });

  final double size;
  final double opacity;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: Colors.white.withValues(alpha: opacity),
        ),
      ),
    );
  }
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
                border: Border.all(
                  color: Colors.white.withValues(alpha: 0.14),
                ),
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
                  color: const Color(0xFF2D1A6B),
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

String _dateKey(DateTime value) {
  final month = value.month.toString().padLeft(2, '0');
  final day = value.day.toString().padLeft(2, '0');
  return '${value.year}-$month-$day';
}
