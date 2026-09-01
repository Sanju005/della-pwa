import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'customer_profile_api_service.dart';

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
    this.latitude,
    this.longitude,
  });

  final String label;
  final String line1;
  final String line2;
  final String city;
  final String state;
  final String postcode;
  final String country;
  final bool isDefault;
  final double? latitude;
  final double? longitude;

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
    required this.avatarUrl,
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
  final String avatarUrl;
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

/// Every field is optional — only the ones set here are sent to
/// `PATCH /api/profile/me`, which now merges against the current stored row
/// (see the backend fix in app/api/profile/me/route.ts) rather than
/// rebuilding the whole record. This lets Personal Details and the
/// Emergency Contact card each save independently without clobbering the
/// other's data. Phone number is intentionally not editable here at all —
/// changing it goes through real re-verification (CustomerPhoneVerificationScreen).
class CustomerPersonalDetailsInput {
  const CustomerPersonalDetailsInput({
    this.firstName,
    this.lastName,
    this.dateOfBirth,
    this.sex,
    this.emergencyContactNumber,
  });

  final String? firstName;
  final String? lastName;
  final String? dateOfBirth;
  final String? sex;
  final String? emergencyContactNumber;
}

class CustomerAccountService {
  const CustomerAccountService();

  static const _profileApi = CustomerProfileApiService();

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
      return {'countryCode': '+60', 'phoneNumber': digits.substring(3)};
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
      final status =
          (row as Map<String, dynamic>)['booking_status']
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

  // latitude/longitude are a newer, optional pair of columns (added so the
  // saved-address map can show and persist an exact, user-dragged pin). On
  // any project where that migration hasn't been applied yet, selecting
  // them throws — so this falls back to the older column list rather than
  // breaking the whole profile screen over two optional fields.
  Future<List<dynamic>> _fetchAddressRows(String userId) async {
    try {
      return await _client
                  .from('addresses')
                  .select(
                    'label, address_line_1, address_line_2, city, state, postcode, country, is_default, latitude, longitude',
                  )
                  .eq('user_id', userId)
                  .order('is_default', ascending: false)
              as List<dynamic>? ??
          const [];
    } catch (_) {
      return await _client
                  .from('addresses')
                  .select(
                    'label, address_line_1, address_line_2, city, state, postcode, country, is_default',
                  )
                  .eq('user_id', userId)
                  .order('is_default', ascending: false)
              as List<dynamic>? ??
          const [];
    }
  }

  Future<CustomerAccountOverview?> fetchOverview() async {
    final user = _client.auth.currentUser;
    if (user == null) {
      return null;
    }

    final profile = await _profileApi.fetchProfile();
    final addressRows = await _fetchAddressRows(user.id);
    final bookingRows =
        await _client
                .from('bookings')
                .select('booking_status')
                .eq('customer_id', user.id)
                .limit(200)
            as List<dynamic>? ??
        const [];
    // Goes through the existing /api/profile/payments route (service-role,
    // already resolves provider display names server-side) instead of a
    // direct client-side query — this screen used to also run its own
    // separate direct query against provider_profiles just to look up
    // marketing_name, which is what made it depend on that table being
    // readable by any authenticated customer. Reusing this route removes
    // that dependency entirely.
    final paymentHistory = await _profileApi.fetchPayments();
    final recentPaymentHistory = paymentHistory
        .where((item) => item.status == 'paid' || item.status == 'refunded')
        .take(10)
        .toList();

    final fullName = profile.fullName.trim();
    final nameParts = fullName.isEmpty
        ? const <String>[]
        : fullName.split(RegExp(r'\s+'));
    final firstName = profile.firstName.trim().isNotEmpty
        ? profile.firstName.trim()
        : (nameParts.isNotEmpty ? nameParts.first : 'Customer');
    final lastName = profile.lastName.trim().isNotEmpty
        ? profile.lastName.trim()
        : (nameParts.length > 1 ? nameParts.skip(1).join(' ') : '');

    final phoneParts = _normalizePhoneParts(
      profile.phoneNumber,
      profile.phoneNumber,
      profile.countryCode,
    );

    final recentPayments = recentPaymentHistory
        .map(
          (item) => CustomerPaymentSummaryItem(
            serviceTitle: item.serviceTitle,
            providerName: item.provider,
            amountLabel: _formatCurrency(item.amount),
            paymentMethod: item.paymentMethod,
            statusLabel: _formatStatus(item.status),
            paidAtLabel: _formatDateTime(item.paidAt),
          ),
        )
        .toList();

    final totalPaid = recentPaymentHistory.fold<num>(
      0,
      (sum, item) => item.status == 'paid' ? sum + item.amount : sum,
    );

    final latestPaymentDate = recentPaymentHistory.isNotEmpty
        ? recentPaymentHistory.first.paidAt
        : null;

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
        latitude: (data['latitude'] as num?)?.toDouble(),
        longitude: (data['longitude'] as num?)?.toDouble(),
      );
    }).toList();

    final verification = CustomerVerificationSummary(
      emailVerified: profile.emailVerified,
      phoneVerified: profile.phoneVerified,
      identityStatusLabel: _formatStatus(profile.identityVerificationStatus),
      verified: profile.verified,
    );

    return CustomerAccountOverview(
      firstName: firstName,
      lastName: lastName,
      fullName: [
        firstName,
        lastName,
      ].where((item) => item.trim().isNotEmpty).join(' '),
      avatarUrl: profile.avatarUrl,
      email: profile.email.isNotEmpty ? profile.email : user.email ?? '',
      phoneNumber: phoneParts['phoneNumber'] ?? '',
      countryCode: phoneParts['countryCode'] ?? '+60',
      emergencyContactNumber: profile.emergencyContactNumber,
      city: profile.city,
      region: profile.region,
      country: profile.country.isNotEmpty ? profile.country : 'Malaysia',
      dateOfBirth: _formatDate(profile.dateOfBirth),
      sex: profile.sex,
      completion: profile.completion,
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

  Future<void> updatePersonalDetails(CustomerPersonalDetailsInput input) async {
    final user = _client.auth.currentUser;
    if (user == null) {
      throw Exception('Please sign in again.');
    }

    final body = <String, dynamic>{};
    if (input.firstName != null) {
      body['firstName'] = input.firstName!.trim();
    }
    if (input.lastName != null) {
      body['lastName'] = input.lastName!.trim();
    }
    if (input.dateOfBirth != null) {
      final trimmed = input.dateOfBirth!.trim();
      body['dateOfBirth'] = trimmed.isEmpty ? null : trimmed;
    }
    if (input.sex != null) {
      body['sex'] = input.sex!.trim();
    }
    if (input.emergencyContactNumber != null) {
      body['emergencyContactNumber'] = input.emergencyContactNumber!.trim();
    }

    if (body.isEmpty) {
      return;
    }
    await _profileApi.updateProfile(body);
  }
}
