import 'package:flutter/material.dart';

import '../../../services/provider_workspace_service.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/loading_state.dart';

class ProviderEarningsScreen extends StatelessWidget {
  const ProviderEarningsScreen({super.key});

  static const _workspaceService = ProviderWorkspaceService();

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<ProviderWorkspaceBooking>>(
      future: _workspaceService.fetchBookings(),
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const LoadingState(label: 'Loading provider payments...');
        }
        if (snapshot.hasError) {
          return const EmptyState(
            title: 'Unable to load provider payments',
            subtitle: 'Please try again.',
            icon: Icons.error_outline_rounded,
          );
        }

        final bookings = snapshot.data ?? const [];
        final gross = bookings.fold<double>(
          0,
          (sum, booking) => sum + booking.quotedAmount,
        );
        final net = bookings.fold<double>(
          0,
          (sum, booking) => sum + booking.providerNetAmount,
        );
        final commission = bookings.fold<double>(
          0,
          (sum, booking) => sum + booking.companyCommissionAmount,
        );

        return ListView(
          padding: AppSpacing.screenPadding,
          children: [
            Row(
              children: [
                Expanded(
                  child: _metricCard(
                    context,
                    label: 'Gross',
                    value: 'RM ${gross.toStringAsFixed(2)}',
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: _metricCard(
                    context,
                    label: 'Net',
                    value: 'RM ${net.toStringAsFixed(2)}',
                    color: AppColors.success,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            _ledgerCard(
              context,
              gross: gross,
              net: net,
              commission: commission,
              bookings: bookings,
            ),
          ],
        );
      },
    );
  }

  Widget _metricCard(
    BuildContext context, {
    required String label,
    required String value,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: AppSpacing.xs),
          Text(
            value,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
          ),
        ],
      ),
    );
  }

  Widget _ledgerCard(
    BuildContext context, {
    required double gross,
    required double net,
    required double commission,
    required List<ProviderWorkspaceBooking> bookings,
  }) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE6ECE7)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Provider Payments',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: AppSpacing.md),
          _summaryRow('Gross Received', 'RM ${gross.toStringAsFixed(2)}'),
          _summaryRow('Company Commission', 'RM ${commission.toStringAsFixed(2)}'),
          _summaryRow('Net To Provider', 'RM ${net.toStringAsFixed(2)}'),
          const SizedBox(height: AppSpacing.md),
          if (bookings.isEmpty)
            const EmptyState(
              title: 'No provider payment records yet',
              subtitle: 'Completed provider jobs will appear here.',
              icon: Icons.payments_outlined,
            )
          else
            ...bookings.take(8).map(
                  (booking) => Container(
                    margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                    padding: const EdgeInsets.all(AppSpacing.sm),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFBFCFB),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFE8ECE8)),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                booking.customerName,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                booking.serviceLabel,
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Text(
                          'RM ${booking.providerNetAmount.toStringAsFixed(2)}',
                          style: const TextStyle(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
        ],
      ),
    );
  }

  Widget _summaryRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        children: [
          Expanded(child: Text(label)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}
