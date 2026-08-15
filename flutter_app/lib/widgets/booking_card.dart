import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';

import '../core/config/app_config.dart';
import '../models/booking_item.dart';
import '../previews/widget_preview_helpers.dart';
import '../theme/app_spacing.dart';
import 'swiper_status_badge.dart';

class BookingCard extends StatelessWidget {
  const BookingCard({super.key, required this.booking, this.onTap});

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
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _BookingProviderAvatar(booking: booking),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          booking.title,
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          booking.providerName,
                          style: Theme.of(context).textTheme.bodyLarge,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  SwiperStatusBadge(label: booking.status, tone: tone),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                booking.schedule,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                booking.location,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
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

@Preview(
  name: 'Confirmed Booking',
  size: Size(420, 240),
  wrapper: previewSurface,
)
Widget bookingCardPreview() {
  const booking = BookingItem(
    id: 'preview-booking',
    title: 'Chef visit',
    providerName: 'Nur Aisyah',
    providerImageUrl: '',
    schedule: 'Wed, 12 Aug 7:00 PM',
    location: 'Mont Kiara Residence',
    status: 'Confirmed',
    amountLabel: 'RM 190',
    steps: ['Requested', 'Accepted', 'On the way', 'Completed'],
  );

  return const BookingCard(booking: booking);
}

class _BookingProviderAvatar extends StatelessWidget {
  const _BookingProviderAvatar({required this.booking});

  final BookingItem booking;

  @override
  Widget build(BuildContext context) {
    final imageUrl = _resolveImageUrl(booking.providerImageUrl);
    if (imageUrl.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Image.network(
          imageUrl,
          width: 64,
          height: 64,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => _fallbackAvatar(context),
        ),
      );
    }

    return _fallbackAvatar(context);
  }

  Widget _fallbackAvatar(BuildContext context) {
    return Container(
      width: 64,
      height: 64,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(16),
      ),
      alignment: Alignment.center,
      child: Text(
        booking.providerName.isNotEmpty
            ? booking.providerName.characters.first.toUpperCase()
            : 'P',
        style: Theme.of(context).textTheme.titleLarge,
      ),
    );
  }

  String _resolveImageUrl(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) {
      return '';
    }
    if (trimmed.startsWith('http://') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('data:')) {
      return trimmed;
    }
    if (trimmed.startsWith('/')) {
      return '${AppConfig.appBaseUrl}$trimmed';
    }
    return '${AppConfig.appBaseUrl}/$trimmed';
  }
}
