import 'package:flutter/material.dart';

import '../models/booking_item.dart';
import '../theme/app_spacing.dart';
import 'swiper_status_badge.dart';

class BookingCard extends StatelessWidget {
  const BookingCard({
    super.key,
    required this.booking,
    this.onTap,
  });

  final BookingItem booking;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final tone = booking.status == 'Confirmed'
        ? SwiperStatusTone.success
        : booking.status == 'Pending'
            ? SwiperStatusTone.warning
            : SwiperStatusTone.info;

    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      booking.title,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
                  SwiperStatusBadge(label: booking.status, tone: tone),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(booking.providerName, style: Theme.of(context).textTheme.bodyLarge),
              const SizedBox(height: AppSpacing.xs),
              Text(booking.schedule, style: Theme.of(context).textTheme.bodyMedium),
              const SizedBox(height: AppSpacing.xs),
              Text(booking.location, style: Theme.of(context).textTheme.bodyMedium),
              const SizedBox(height: AppSpacing.md),
              Row(
                children: [
                  Text(
                    booking.amountLabel,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const Spacer(),
                  const Icon(Icons.arrow_forward_ios_rounded, size: 16),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
