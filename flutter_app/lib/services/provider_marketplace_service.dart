import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/provider_summary.dart';

class ProviderMarketplaceService {
  const ProviderMarketplaceService();

  SupabaseClient get _client => Supabase.instance.client;

  Future<Map<String, List<Map<String, dynamic>>>> _fetchServicesByProvider(
    List<String> providerIds,
  ) async {
    final uniqueIds = providerIds.where((item) => item.isNotEmpty).toSet().toList();
    if (uniqueIds.isEmpty) {
      return const {};
    }

    final response = await _client
        .from('provider_services')
        .select('id, provider_id, service_type, years_experience, hourly_rate, daily_rate')
        .inFilter('provider_id', uniqueIds);

    final rows = response as List<dynamic>;
    final serviceIds = rows
        .map((row) => (row as Map<String, dynamic>)['id']?.toString() ?? '')
        .where((item) => item.isNotEmpty)
        .toList();
    final specialtiesByService = await _fetchSpecialtiesByService(serviceIds);

    final servicesByProvider = <String, List<Map<String, dynamic>>>{};
    for (final row in rows) {
      final service = row as Map<String, dynamic>;
      final providerId = service['provider_id']?.toString() ?? '';
      if (providerId.isEmpty) {
        continue;
      }

      final serviceId = service['id']?.toString() ?? '';
      final enrichedService = <String, dynamic>{
        ...service,
        'provider_service_specialties':
            specialtiesByService[serviceId] ?? const <Map<String, dynamic>>[],
      };

      servicesByProvider.putIfAbsent(providerId, () => <Map<String, dynamic>>[]).add(
        enrichedService,
      );
    }

    return servicesByProvider;
  }

  Future<Map<String, List<Map<String, dynamic>>>> _fetchSpecialtiesByService(
    List<String> serviceIds,
  ) async {
    final uniqueIds = serviceIds.where((item) => item.isNotEmpty).toSet().toList();
    if (uniqueIds.isEmpty) {
      return const {};
    }

    final response = await _client
        .from('provider_service_specialties')
        .select('provider_service_id, specialty')
        .inFilter('provider_service_id', uniqueIds);

    final rows = response as List<dynamic>;
    final specialtiesByService = <String, List<Map<String, dynamic>>>{};
    for (final row in rows) {
      final specialty = row as Map<String, dynamic>;
      final serviceId = specialty['provider_service_id']?.toString() ?? '';
      if (serviceId.isEmpty) {
        continue;
      }

      specialtiesByService
          .putIfAbsent(serviceId, () => <Map<String, dynamic>>[])
          .add(specialty);
    }

    return specialtiesByService;
  }

  Future<Map<String, Map<String, dynamic>>> _fetchProfileMap(
    List<String> providerIds,
  ) async {
    final uniqueIds = providerIds.where((item) => item.isNotEmpty).toSet().toList();
    if (uniqueIds.isEmpty) {
      return const {};
    }

    final response = await _client
        .from('profiles')
        .select('id, full_name, avatar_url')
        .inFilter('id', uniqueIds);

    final rows = response as List<dynamic>;
    return {
      for (final row in rows)
        (row as Map<String, dynamic>)['id']?.toString() ?? '': row,
    };
  }

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

  String _toTitleCase(String value) {
    if (value.trim().isEmpty) {
      return 'Pending';
    }

    return value
        .replaceAll('_', ' ')
        .split(' ')
        .where((item) => item.isNotEmpty)
        .map(
          (item) =>
              '${item.substring(0, 1).toUpperCase()}${item.substring(1).toLowerCase()}',
        )
        .join(' ');
  }

  Future<List<ProviderSummary>> fetchVisibleProviders() async {
    final response = await _client
        .from('provider_profiles')
        .select(
          'id, marketing_name, service_location, service_radius_km, bio, average_rating, total_reviews, approval_status',
        )
        .eq('is_visible', true)
        .order('average_rating', ascending: false);

    final rows = response as List<dynamic>;
    final providerIds = rows
        .map((row) => (row as Map<String, dynamic>)['id']?.toString() ?? '')
        .toList();
    final servicesByProvider = await _fetchServicesByProvider(providerIds);
    final profileMap = await _fetchProfileMap(
      providerIds,
    );

    return rows.map((row) {
      final data = row as Map<String, dynamic>;
      final providerId = data['id']?.toString() ?? '';
      final profile =
          profileMap[providerId] ?? const <String, dynamic>{};
      final services = servicesByProvider[providerId] ?? const <Map<String, dynamic>>[];
      final firstService = services.isNotEmpty
          ? services.first
          : const <String, dynamic>{};
      final specialties = services
          .expand(
            (service) =>
                service['provider_service_specialties'] as List<dynamic>? ??
                const [],
          )
          .map((item) => item as Map<String, dynamic>)
          .map((item) => item['specialty']?.toString().trim() ?? '')
          .where((item) => item.isNotEmpty)
          .toSet()
          .take(6)
          .toList();
      final serviceLabels = services
          .map((item) => _humanizeService(item['service_type']?.toString().trim() ?? ''))
          .where((item) => item.isNotEmpty)
          .toSet()
          .toList();
      final approvalStatus =
          data['approval_status']?.toString().trim().toLowerCase() ?? '';
      final isApproved = approvalStatus == 'approved';
      final marketingName = data['marketing_name']?.toString().trim() ?? '';
      final fullName = profile['full_name']?.toString().trim() ?? '';
      final displayName = marketingName.isNotEmpty
          ? marketingName
          : (fullName.isNotEmpty ? fullName : 'DELLA Provider');

      return ProviderSummary(
        id: providerId,
        name: displayName,
        providerName: fullName,
        service: _humanizeService(
          firstService['service_type']?.toString().trim() ?? 'other',
        ),
        hourlyRate: (firstService['hourly_rate'] as num?)?.toInt() ?? 0,
        dailyRate: (firstService['daily_rate'] as num?)?.toInt() ?? 0,
        rating: (data['average_rating'] as num?)?.toDouble() ?? 0,
        reviewCount: (data['total_reviews'] as num?)?.toInt() ?? 0,
        distanceLabel:
            '${((data['service_radius_km'] as num?)?.toDouble() ?? 0).round()} km service radius',
        description:
            data['bio']?.toString().trim().isNotEmpty == true
            ? data['bio'] as String
            : 'Trusted services available through DELLA.',
        phoneVerified: isApproved,
        identityVerified: isApproved,
        isFavorite: false,
        location: data['service_location']?.toString().trim().isNotEmpty == true
            ? data['service_location'] as String
            : 'Malaysia',
        specialties: specialties,
        services: serviceLabels,
        yearsExperience:
            firstService['years_experience']?.toString().trim() ?? '',
        approvalStatus: _toTitleCase(approvalStatus),
        avatarUrl: profile['avatar_url']?.toString().trim() ?? '',
      );
    }).toList();
  }
}
