import 'package:flutter/material.dart';

import '../../../repositories/demo_repository.dart';
import '../../../services/provider_workspace_service.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/loading_state.dart';
import '../../../widgets/swiper_status_badge.dart';

class ProviderJobsScreen extends StatelessWidget {
  const ProviderJobsScreen({
    super.key,
    required this.repository,
  });

  final DemoRepository repository;
  static const _workspaceService = ProviderWorkspaceService();

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<ProviderWorkspaceBooking>>(
      future: _workspaceService.fetchBookings(),
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const LoadingState(label: 'Loading provider bookings...');
        }
        if (snapshot.hasError) {
          return const EmptyState(
            title: 'Unable to load provider bookings',
            subtitle: 'Please try again.',
            icon: Icons.error_outline_rounded,
          );
        }

        final bookings = snapshot.data ?? const [];
        if (bookings.isEmpty) {
          return const EmptyState(
            title: 'No provider bookings yet',
            subtitle: 'Incoming requests and active jobs will appear here.',
            icon: Icons.assignment_outlined,
          );
        }

        return ListView.separated(
          padding: AppSpacing.screenPadding,
          itemCount: bookings.length,
          separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.md),
          itemBuilder: (context, index) => _bookingCard(bookings[index]),
        );
      },
    );
  }

  Widget _bookingCard(ProviderWorkspaceBooking booking) {
    final tone = booking.bucket == 'active'
        ? SwiperStatusTone.success
        : booking.bucket == 'requests'
            ? SwiperStatusTone.warning
            : booking.bucket == 'completed'
                ? SwiperStatusTone.info
                : SwiperStatusTone.error;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE6ECE7)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0F172A0A),
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
                      booking.customerName,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF1F1630),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      booking.serviceLabel,
                      style: const TextStyle(
                        color: Color(0xFF6D6480),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              SwiperStatusBadge(label: booking.statusLabel, tone: tone),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          _info(Icons.schedule_outlined, booking.schedule),
          const SizedBox(height: AppSpacing.sm),
          _info(Icons.place_outlined, booking.location),
          const SizedBox(height: AppSpacing.sm),
          _info(
            Icons.payments_outlined,
            'RM ${booking.quotedAmount.toStringAsFixed(2)}',
          ),
          const SizedBox(height: AppSpacing.sm),
          _info(Icons.info_outline_rounded, booking.customerStatusLabel),
        ],
      ),
    );
  }

  Widget _info(IconData icon, String text) {
    return Row(
      children: [
        Icon(icon, size: 16, color: const Color(0xFF8E5EB5)),
        const SizedBox(width: AppSpacing.xs),
        Expanded(child: Text(text.isEmpty ? '-' : text)),
      ],
    );
  }
}
