import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/booking_item.dart';

class CustomerBookingRecord {
  const CustomerBookingRecord({
    required this.booking,
    required this.activeStepIndex,
    required this.paymentStatus,
    required this.paymentMethod,
    required this.paymentAmountLabel,
    required this.paymentDateLabel,
    required this.isPast,
  });

  final BookingItem booking;
  final int activeStepIndex;
  final String paymentStatus;
  final String paymentMethod;
  final String paymentAmountLabel;
  final String paymentDateLabel;
  final bool isPast;
}

class BookingOverviewData {
  const BookingOverviewData({
    required this.upcomingBookings,
    required this.pastBookings,
  });

  final List<CustomerBookingRecord> upcomingBookings;
  final List<CustomerBookingRecord> pastBookings;
}

class BookingOverviewService {
  const BookingOverviewService();

  SupabaseClient get _client => Supabase.instance.client;

  String _formatCurrency(num value) {
    return 'RM ${value.toStringAsFixed(2)}';
  }

  String _formatStatus(String? value) {
    final normalized = value?.trim().toLowerCase() ?? '';
    if (normalized.isEmpty) {
      return 'Pending';
    }
    return normalized
        .split(RegExp(r'[_\s]+'))
        .where((part) => part.isNotEmpty)
        .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
        .join(' ');
  }

  String _formatSchedule(String? dateValue, String? timeValue) {
    if ((dateValue ?? '').isEmpty) {
      return 'Upcoming booking';
    }

    final parsed = DateTime.tryParse(
      '${dateValue!}T${(timeValue == null || timeValue.isEmpty) ? '09:00:00' : timeValue}',
    );
    if (parsed == null) {
      return 'Upcoming booking';
    }

    return DateFormat('EEE, d MMM • h:mm a', 'en_MY').format(parsed);
  }

  String _formatDateTime(String? value) {
    if ((value ?? '').isEmpty) {
      return '-';
    }
    final parsed = DateTime.tryParse(value!);
    if (parsed == null) {
      return '-';
    }
    return DateFormat('d MMM yyyy, h:mm a', 'en_MY').format(parsed);
  }

  DateTime? _parseScheduledAt(String? dateValue, String? timeValue) {
    if ((dateValue ?? '').isEmpty) {
      return null;
    }
    return DateTime.tryParse(
      '${dateValue!}T${(timeValue == null || timeValue.isEmpty) ? '09:00:00' : timeValue}',
    );
  }

  List<String> _stepsForStatus(String? status) {
    final normalized = status?.trim().toLowerCase() ?? '';
    if ([
      'pending',
      'pending_provider_response',
      'declined',
      'declined_by_provider',
      'cancelled',
      'canceled',
    ].contains(normalized)) {
      return const ['Requested', 'Accepted', 'On the way', 'Completed'];
    }

    return const [
      'Requested',
      'Accepted',
      'On the way',
      'Arrived',
      'Work finished',
      'Payment',
      'Completed',
    ];
  }

  int _activeIndexForStatus(String? status) {
    final normalized = status?.trim().toLowerCase() ?? '';
    const mapping = {
      'pending': 0,
      'pending_provider_response': 0,
      'accepted': 1,
      'confirmed': 1,
      'on_the_way': 2,
      'arrived': 3,
      'work_finished_by_provider': 4,
      'work_confirmed_by_user': 4,
      'final_payment_sent': 5,
      'cash_paid_by_user': 5,
      'payment_received_by_provider': 5,
      'paid': 6,
      'completed': 6,
      'review_requested': 6,
      'reviewed': 6,
      'declined': 0,
      'declined_by_provider': 0,
      'cancelled': 0,
      'canceled': 0,
    };

    return mapping[normalized] ?? 0;
  }

  bool _isPastBooking(String? status, DateTime? scheduledAt) {
    final normalized = status?.trim().toLowerCase() ?? '';
    if ([
      'paid',
      'completed',
      'review_requested',
      'reviewed',
      'declined',
      'declined_by_provider',
      'cancelled',
      'canceled',
    ].contains(normalized)) {
      return true;
    }

    if (scheduledAt == null) {
      return false;
    }

    return scheduledAt.isBefore(DateTime.now());
  }

  CustomerBookingRecord _mapBookingRecord(Map<String, dynamic> row) {
    final providerValue = row['provider_profiles'];
    final provider = providerValue is List
        ? (providerValue.isNotEmpty
              ? providerValue.first as Map<String, dynamic>
              : const <String, dynamic>{})
        : providerValue is Map<String, dynamic>
        ? providerValue
        : const <String, dynamic>{};

    final paymentRecords =
        (row['payment_records'] as List<dynamic>? ?? const []);
    final payment = paymentRecords.isNotEmpty
        ? paymentRecords.first as Map<String, dynamic>
        : const <String, dynamic>{};

    final amount =
        (row['final_amount'] as num?) ??
        (row['quoted_amount'] as num?) ??
        (row['booking_price'] as num?) ??
        (payment['amount'] as num?) ??
        0;
    final status = row['booking_status']?.toString();
    final steps = _stepsForStatus(status);
    final scheduledAt = _parseScheduledAt(
      row['scheduled_date']?.toString(),
      row['scheduled_start_time']?.toString(),
    );

    return CustomerBookingRecord(
      booking: BookingItem(
        title: row['service_label']?.toString().trim().isNotEmpty == true
            ? row['service_label'] as String
            : 'Service Booking',
        providerName:
            provider['marketing_name']?.toString().trim().isNotEmpty == true
            ? provider['marketing_name'] as String
            : 'DELLA Provider',
        schedule: _formatSchedule(
          row['scheduled_date']?.toString(),
          row['scheduled_start_time']?.toString(),
        ),
        location: row['location_text']?.toString().trim().isNotEmpty == true
            ? row['location_text'] as String
            : 'No location stored',
        status: _formatStatus(status),
        amountLabel: _formatCurrency(amount),
        steps: steps,
      ),
      activeStepIndex: _activeIndexForStatus(status).clamp(0, steps.length - 1),
      paymentStatus: _formatStatus(payment['status']?.toString()),
      paymentMethod:
          payment['payment_method']?.toString().trim().isNotEmpty == true
          ? payment['payment_method'] as String
          : payment['payment_option']?.toString().trim().isNotEmpty == true
          ? payment['payment_option'] as String
          : 'Pending',
      paymentAmountLabel: _formatCurrency(payment['amount'] as num? ?? amount),
      paymentDateLabel: _formatDateTime(
        payment['paid_at']?.toString() ?? payment['created_at']?.toString(),
      ),
      isPast: _isPastBooking(status, scheduledAt),
    );
  }

  Future<BookingOverviewData?> fetchCustomerBookings() async {
    final user = _client.auth.currentUser;
    if (user == null) {
      return null;
    }

    final rows = await _client
        .from('bookings')
        .select('''
          id,
          service_label,
          booking_status,
          location_text,
          scheduled_date,
          scheduled_start_time,
          final_amount,
          quoted_amount,
          booking_price,
          created_at,
          provider_profiles (
            marketing_name
          ),
          payment_records:payments (
            amount,
            status,
            payment_method,
            payment_option,
            paid_at,
            created_at
          )
        ''')
        .eq('customer_id', user.id)
        .order('scheduled_date', ascending: false)
        .order('created_at', ascending: false);

    final list = rows as List<dynamic>;
    if (list.isEmpty) {
      return null;
    }

    final records = list
        .map((row) => _mapBookingRecord(row as Map<String, dynamic>))
        .toList();
    final upcoming = records.where((record) => !record.isPast).toList();
    final past = records.where((record) => record.isPast).toList();

    return BookingOverviewData(upcomingBookings: upcoming, pastBookings: past);
  }
}
