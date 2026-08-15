import 'package:intl/intl.dart';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class CustomerAddressSummary {
  const CustomerAddressSummary({
    required this.label,
    required this.line1,
    required this.line2,
    required this.city,
    required this.state,
    required this.postcode,
    required this.country,
    required this.isDefault,
  });

  final String label;
  final String line1;
  final String line2;
  final String city;
  final String state;
  final String postcode;
  final String country;
  final bool isDefault;

  String get formattedAddress {
    return [
      line1,
      line2,
      [city, state, postcode].where((item) => item.isNotEmpty).join(', '),
      country,
    ].where((item) => item.isNotEmpty).join('\n');
  }
}

class CustomerPaymentSummaryItem {
  const CustomerPaymentSummaryItem({
    required this.serviceTitle,
    required this.providerName,
    required this.amountLabel,
    required this.paymentMethod,
    required this.statusLabel,
    required this.paidAtLabel,
  });

  final String serviceTitle;
  final String providerName;
  final String amountLabel;
  final String paymentMethod;
  final String statusLabel;
  final String paidAtLabel;
}

class CustomerBookingSummary {
  const CustomerBookingSummary({
    required this.pending,
    required this.ongoing,
    required this.completed,
    required this.cancelled,
  });

  final int pending;
  final int ongoing;
  final int completed;
  final int cancelled;
}

class CustomerPaymentSummary {
  const CustomerPaymentSummary({
    required this.totalPaidLabel,
    required this.lastPaymentLabel,
    required this.recentPayments,
  });

  final String totalPaidLabel;
  final String lastPaymentLabel;
  final List<CustomerPaymentSummaryItem> recentPayments;
}

class CustomerVerificationSummary {
  const CustomerVerificationSummary({
    required this.emailVerified,
    required this.phoneVerified,
    required this.identityStatusLabel,
    required this.verified,
  });

  final bool emailVerified;
  final bool phoneVerified;
  final String identityStatusLabel;
  final bool verified;
}

class CustomerAccountOverview {
  const CustomerAccountOverview({
    required this.firstName,
    required this.lastName,
    required this.fullName,
    required this.email,
    required this.phoneNumber,
    required this.countryCode,
    required this.emergencyContactNumber,
    required this.city,
    required this.region,
    required this.country,
    required this.dateOfBirth,
    required this.sex,
    required this.completion,
    required this.addresses,
    required this.bookingSummary,
    required this.paymentSummary,
    required this.verification,
  });

  final String firstName;
  final String lastName;
  final String fullName;
  final String email;
  final String phoneNumber;
  final String countryCode;
  final String emergencyContactNumber;
  final String city;
  final String region;
  final String country;
  final String dateOfBirth;
  final String sex;
  final int completion;
  final List<CustomerAddressSummary> addresses;
  final CustomerBookingSummary bookingSummary;
  final CustomerPaymentSummary paymentSummary;
  final CustomerVerificationSummary verification;
}

class CustomerAccountService {
  const CustomerAccountService();

  SupabaseClient get _client => Supabase.instance.client;

  String _formatCurrency(num value) => 'RM ${value.toStringAsFixed(2)}';

  String _formatDate(String? value) {
    if ((value ?? '').isEmpty) {
      return '-';
    }

    final parsed = DateTime.tryParse(value!);
    if (parsed == null) {
      return value;
    }

    return DateFormat('d MMM yyyy', 'en_MY').format(parsed);
  }

  String _formatDateTime(String? value) {
    if ((value ?? '').isEmpty) {
      return '-';
    }

    final parsed = DateTime.tryParse(value!);
    if (parsed == null) {
      return value;
    }

    return DateFormat('d MMM yyyy, h:mm a', 'en_MY').format(parsed);
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

  Map<String, String> _normalizePhoneParts(
    String? phone,
    String? phoneNumber,
    String? countryCode,
  ) {
    final localPhone = phoneNumber?.trim() ?? '';
    if (localPhone.isNotEmpty) {
      return {
        'countryCode': (countryCode?.trim().isNotEmpty == true)
            ? countryCode!.trim()
            : '+60',
        'phoneNumber': localPhone,
      };
    }

    final source = phone?.trim() ?? '';
    if (source.isEmpty) {
      return {
        'countryCode': (countryCode?.trim().isNotEmpty == true)
            ? countryCode!.trim()
            : '+60',
        'phoneNumber': '',
      };
    }

    final digits = source.replaceAll(RegExp(r'[^\d+]'), '');
    if (digits.startsWith('+60')) {
      return {
        'countryCode': '+60',
        'phoneNumber': digits.substring(3),
      };
    }

    return {
      'countryCode': (countryCode?.trim().isNotEmpty == true)
          ? countryCode!.trim()
          : '+60',
      'phoneNumber': digits.replaceFirst(RegExp(r'^\+'), ''),
    };
  }

  CustomerBookingSummary _buildBookingSummary(List<dynamic> rows) {
    var pending = 0;
    var ongoing = 0;
    var completed = 0;
    var cancelled = 0;

    for (final row in rows) {
      final status = (row as Map<String, dynamic>)['booking_status']
              ?.toString()
              .trim()
              .toLowerCase() ??
          '';

      if (status == 'declined' ||
          status == 'declined_by_provider' ||
          status == 'cancelled' ||
          status == 'canceled') {
        cancelled += 1;
      } else if (status == 'completed' ||
          status == 'paid' ||
          status == 'review_requested' ||
          status == 'reviewed') {
        completed += 1;
      } else if (status == 'accepted' ||
          status == 'confirmed' ||
          status == 'on_the_way' ||
          status == 'arrived') {
        ongoing += 1;
      } else {
        pending += 1;
      }
    }

    return CustomerBookingSummary(
      pending: pending,
      ongoing: ongoing,
      completed: completed,
      cancelled: cancelled,
    );
  }

  Future<Map<String, dynamic>?> _fetchCustomerProfileRow(String userId) async {
    try {
      return await _client
          .from('customer_profiles')
          .select('''
            first_name,
            last_name,
            date_of_birth,
            sex,
            phone_number,
            country_code,
            emergency_contact_number,
            city,
            region,
            state,
            country,
            verified,
            completion
          ''')
          .eq('id', userId)
          .maybeSingle();
    } catch (error, stackTrace) {
      if (kDebugMode) {
        debugPrint('Customer profile full query failed: $error');
        debugPrintStack(stackTrace: stackTrace);
      }

      try {
        return await _client
            .from('customer_profiles')
            .select('''
              first_name,
              last_name,
              date_of_birth,
              sex,
              phone_number,
              country_code,
              emergency_contact_number,
              city,
              region,
              state,
              country
            ''')
            .eq('id', userId)
            .maybeSingle();
      } catch (fallbackError, fallbackStackTrace) {
        if (kDebugMode) {
          debugPrint('Customer profile fallback query failed: $fallbackError');
          debugPrintStack(stackTrace: fallbackStackTrace);
        }
        return null;
      }
    }
  }

  Future<CustomerAccountOverview?> fetchOverview() async {
    final user = _client.auth.currentUser;
    if (user == null) {
      return null;
    }

    final results = await Future.wait([
      _client
          .from('profiles')
          .select('full_name, email, phone, avatar_url')
          .eq('id', user.id)
          .maybeSingle(),
      _fetchCustomerProfileRow(user.id),
      _client
          .from('addresses')
          .select('label, address_line_1, address_line_2, city, state, postcode, country, is_default')
          .eq('user_id', user.id)
          .order('is_default', ascending: false),
      _client
          .from('bookings')
          .select('booking_status')
          .eq('customer_id', user.id)
          .limit(200),
      _client
          .from('payments')
          .select('provider_id, service_title, amount, payment_method, status, paid_at, created_at')
          .eq('customer_id', user.id)
          .order('paid_at', ascending: false, nullsFirst: false)
          .order('created_at', ascending: false, nullsFirst: false)
          .limit(10),
    ]);

    final profileRow = results[0] as Map<String, dynamic>?;
    final customerRow = results[1] as Map<String, dynamic>?;
    final addressRows = results[2] as List<dynamic>? ?? const [];
    final bookingRows = results[3] as List<dynamic>? ?? const [];
    final paymentRows = results[4] as List<dynamic>? ?? const [];

    final fullName = profileRow?['full_name']?.toString().trim() ?? '';
    final nameParts = fullName.isEmpty ? const <String>[] : fullName.split(RegExp(r'\s+'));
    final firstName = customerRow?['first_name']?.toString().trim().isNotEmpty == true
        ? customerRow!['first_name'].toString().trim()
        : (nameParts.isNotEmpty ? nameParts.first : 'Customer');
    final lastName = customerRow?['last_name']?.toString().trim().isNotEmpty == true
        ? customerRow!['last_name'].toString().trim()
        : (nameParts.length > 1 ? nameParts.skip(1).join(' ') : '');

    final phoneParts = _normalizePhoneParts(
      profileRow?['phone']?.toString(),
      customerRow?['phone_number']?.toString(),
      customerRow?['country_code']?.toString(),
    );

    final providerIds = paymentRows
        .map((row) => (row as Map<String, dynamic>)['provider_id']?.toString())
        .where((value) => value != null && value.isNotEmpty)
        .cast<String>()
        .toSet()
        .toList();

    final providerNameMap = <String, String>{};
    if (providerIds.isNotEmpty) {
      final providerRows = await _client
          .from('provider_profiles')
          .select('id, marketing_name')
          .inFilter('id', providerIds);

      for (final row in providerRows as List<dynamic>) {
        final data = row as Map<String, dynamic>;
        providerNameMap[data['id'].toString()] =
            data['marketing_name']?.toString().trim().isNotEmpty == true
                ? data['marketing_name'] as String
                : 'DELLA Provider';
      }
    }

    final recentPayments = paymentRows
        .map((row) {
          final data = row as Map<String, dynamic>;
          final status = data['status']?.toString().trim().toLowerCase();
          if (status != 'paid' && status != 'refunded') {
            return null;
          }

          final providerId = data['provider_id']?.toString() ?? '';
          return CustomerPaymentSummaryItem(
            serviceTitle:
                data['service_title']?.toString().trim().isNotEmpty == true
                    ? data['service_title'] as String
                    : 'Service Payment',
            providerName: providerNameMap[providerId] ?? 'DELLA Provider',
            amountLabel: _formatCurrency((data['amount'] as num?) ?? 0),
            paymentMethod:
                data['payment_method']?.toString().trim().isNotEmpty == true
                    ? data['payment_method'] as String
                    : 'Cash',
            statusLabel: _formatStatus(status),
            paidAtLabel: _formatDateTime(
              data['paid_at']?.toString() ?? data['created_at']?.toString(),
            ),
          );
        })
        .whereType<CustomerPaymentSummaryItem>()
        .toList();

    final totalPaid = paymentRows.fold<num>(
      0,
      (sum, row) {
        final data = row as Map<String, dynamic>;
        return data['status']?.toString().trim().toLowerCase() == 'paid'
            ? sum + ((data['amount'] as num?) ?? 0)
            : sum;
      },
    );

    final latestPaymentRow = paymentRows.isNotEmpty
        ? paymentRows.first as Map<String, dynamic>
        : null;
    final latestPaymentDate = latestPaymentRow == null
        ? null
        : latestPaymentRow['paid_at']?.toString() ??
            latestPaymentRow['created_at']?.toString();

    final addresses = addressRows.map((row) {
      final data = row as Map<String, dynamic>;
      return CustomerAddressSummary(
        label: data['label']?.toString().trim().isNotEmpty == true
            ? data['label'] as String
            : 'Address',
        line1: data['address_line_1']?.toString().trim() ?? '',
        line2: data['address_line_2']?.toString().trim() ?? '',
        city: data['city']?.toString().trim() ?? '',
        state: data['state']?.toString().trim() ?? '',
        postcode: data['postcode']?.toString().trim() ?? '',
        country: data['country']?.toString().trim() ?? 'Malaysia',
        isDefault: data['is_default'] == true,
      );
    }).toList();

    final metadata = user.userMetadata ?? const <String, dynamic>{};
    final verification = CustomerVerificationSummary(
      emailVerified: metadata['email_verified'] == true,
      phoneVerified: metadata['phone_verified'] == true,
      identityStatusLabel: _formatStatus(
        metadata['identity_verification_status']?.toString(),
      ),
      verified: customerRow?['verified'] == true ||
          metadata['identity_verification_status']?.toString() == 'verified',
    );

    return CustomerAccountOverview(
      firstName: firstName,
      lastName: lastName,
      fullName: [firstName, lastName]
          .where((item) => item.trim().isNotEmpty)
          .join(' '),
      email: profileRow?['email']?.toString().trim() ?? user.email ?? '',
      phoneNumber: phoneParts['phoneNumber'] ?? '',
      countryCode: phoneParts['countryCode'] ?? '+60',
      emergencyContactNumber:
          customerRow?['emergency_contact_number']?.toString().trim() ?? '',
      city: customerRow?['city']?.toString().trim() ?? '',
      region: customerRow?['region']?.toString().trim().isNotEmpty == true
          ? customerRow!['region'].toString().trim()
          : customerRow?['state']?.toString().trim() ?? '',
      country: customerRow?['country']?.toString().trim().isNotEmpty == true
          ? customerRow!['country'].toString().trim()
          : 'Malaysia',
      dateOfBirth: _formatDate(customerRow?['date_of_birth']?.toString()),
      sex: customerRow?['sex']?.toString().trim() ?? '',
      completion: (customerRow?['completion'] as num?)?.round() ?? 80,
      addresses: addresses,
      bookingSummary: _buildBookingSummary(bookingRows),
      paymentSummary: CustomerPaymentSummary(
        totalPaidLabel: _formatCurrency(totalPaid),
        lastPaymentLabel: latestPaymentDate == null
            ? 'No payment yet'
            : 'Latest payment on ${_formatDate(latestPaymentDate)}',
        recentPayments: recentPayments,
      ),
      verification: verification,
    );
  }
}
