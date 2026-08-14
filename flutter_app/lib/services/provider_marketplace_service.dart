import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/provider_summary.dart';

class ProviderMarketplaceService {
  const ProviderMarketplaceService();

  SupabaseClient get _client => Supabase.instance.client;

  String _humanizeService(String value) {
    const labels = {
      'chef': 'Chef',
      'maid': 'Maid',
      'tutor': 'Tutor',
      'driver': 'Driver',
      'cleaner': 'Cleaner',
      'babysitter': 'Babysitter',
      'plumber': 'Plumber',
      'electrician': 'Electrician',
      'other': 'Other',
    };
    return labels[value] ?? (value.isEmpty ? 'Service Provider' : value);
  }

  Future<List<ProviderSummary>> fetchVisibleProviders() async {
    final response = await _client
        .from('provider_profiles')
        .select('''
          id,
          marketing_name,
          service_location,
          service_radius_km,
          bio,
          average_rating,
          total_reviews,
          approval_status,
          provider_services (
            id,
            service_type,
            years_experience,
            hourly_rate,
            daily_rate,
            provider_service_specialties (
              specialty
            )
          ),
          provider_verifications (
            phone_verified,
            email_verified,
            identity_verified
          )
        ''')
        .eq('is_visible', true)
        .order('average_rating', ascending: false);

    final rows = response as List<dynamic>;

    return rows.map((row) {
      final data = row as Map<String, dynamic>;
      final services =
          (data['provider_services'] as List<dynamic>? ?? const []);
      final firstService = services.isNotEmpty
          ? services.first as Map<String, dynamic>
          : const <String, dynamic>{};
      final verificationValue = data['provider_verifications'];
      final verification = verificationValue is List
          ? (verificationValue.isNotEmpty
                ? verificationValue.first as Map<String, dynamic>
                : const <String, dynamic>{})
          : verificationValue is Map<String, dynamic>
          ? verificationValue
          : const <String, dynamic>{};
      final specialties =
          (firstService['provider_service_specialties'] as List<dynamic>? ??
                  const [])
              .map((item) => item as Map<String, dynamic>)
              .map((item) => item['specialty']?.toString().trim() ?? '')
              .where((item) => item.isNotEmpty)
              .take(3)
              .toList();
      final approvalStatus =
          data['approval_status']?.toString().trim().toLowerCase() ?? '';
      final emailVerified = verification['email_verified'] == true;
      final phoneVerified = verification['phone_verified'] == true;
      final identityVerified = verification['identity_verified'] == true;

      return ProviderSummary(
        name: data['marketing_name']?.toString().trim().isNotEmpty == true
            ? data['marketing_name'] as String
            : 'DELLA Provider',
        service: _humanizeService(
          firstService['service_type']?.toString().trim() ?? 'other',
        ),
        hourlyRate: (firstService['hourly_rate'] as num?)?.toInt() ?? 0,
        rating: (data['average_rating'] as num?)?.toDouble() ?? 0,
        reviewCount: (data['total_reviews'] as num?)?.toInt() ?? 0,
        distanceLabel:
            '${((data['service_radius_km'] as num?)?.toDouble() ?? 0).round()} km service radius',
        description:
            data['bio']?.toString().trim().isNotEmpty == true
            ? data['bio'] as String
            : 'Trusted services available through DELLA.',
        phoneVerified:
            approvalStatus == 'approved' && emailVerified && phoneVerified,
        identityVerified:
            approvalStatus == 'approved' && emailVerified && identityVerified,
        isFavorite: false,
        location: data['service_location']?.toString().trim().isNotEmpty == true
            ? data['service_location'] as String
            : 'Malaysia',
        specialties: specialties,
      );
    }).toList();
  }
}
