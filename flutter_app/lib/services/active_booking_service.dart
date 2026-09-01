import 'booking_overview_service.dart';

/// Picks the single most relevant booking for Home's compact summary card
/// out of the same list `My Bookings`/`Ongoing Task` already fetch — no new
/// endpoint. "Upcoming" from [BookingOverviewService] already means
/// "not completed/cancelled", so this just prefers an in-progress
/// ('ongoing') booking over a merely-pending one when both exist.
class ActiveBookingService {
  const ActiveBookingService();

  static const _bookingService = BookingOverviewService();

  Future<CustomerBookingRecord?> fetchActiveBooking() async {
    final data = await _bookingService.fetchCustomerBookings();
    final upcoming = data?.upcomingBookings ?? const [];
    if (upcoming.isEmpty) {
      return null;
    }

    // activeStepIndex 2 means "In Progress" (see _stepsForStatus/
    // _activeIndexForStatusGroup in BookingOverviewService) — prefer
    // surfacing a booking that's actively happening right now over one
    // that's merely pending a provider's response.
    for (final record in upcoming) {
      if (record.activeStepIndex >= 2) {
        return record;
      }
    }

    return upcoming.first;
  }
}
