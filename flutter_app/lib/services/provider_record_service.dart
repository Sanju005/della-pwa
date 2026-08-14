import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/provider_summary.dart';
import 'phone_utils.dart';

class ProviderRecordPayload {
  const ProviderRecordPayload({
    required this.firstName,
    required this.lastName,
    required this.marketingName,
    required this.dateOfBirth,
    required this.gender,
    required this.email,
    required this.phoneNumber,
    required this.emergencyContactNumber,
    required this.addressLine1,
    required this.addressLine2,
    required this.postcode,
    required this.city,
    required this.state,
    required this.country,
    required this.serviceArea,
    required this.serviceRadiusKm,
    required this.services,
    required this.specialties,
    required this.hourlyRate,
    required this.yearsExperience,
    required this.availabilityDays,
    required this.timePreset,
    required this.phoneVerified,
    required this.identityVerified,
    required this.status,
  });

  final String firstName;
  final String lastName;
  final String marketingName;
  final String dateOfBirth;
  final String gender;
  final String email;
  final String phoneNumber;
  final String emergencyContactNumber;
  final String addressLine1;
  final String addressLine2;
  final String postcode;
  final String city;
  final String state;
  final String country;
  final String serviceArea;
  final double serviceRadiusKm;
  final List<String> services;
  final List<String> specialties;
  final int hourlyRate;
  final int yearsExperience;
  final List<String> availabilityDays;
  final String timePreset;
  final bool phoneVerified;
  final bool identityVerified;
  final String status;

  ProviderSummary toProviderSummary() {
    final displayName = marketingName.trim().isNotEmpty
        ? marketingName.trim()
        : '$firstName $lastName'.trim();
    final primaryService = services.isEmpty ? 'Service Provider' : services.first;
    return ProviderSummary(
      name: displayName,
      service: primaryService,
      hourlyRate: hourlyRate,
      rating: 5.0,
      reviewCount: 0,
      distanceLabel: '${serviceRadiusKm.round()} km service radius',
      description:
          '$primaryService based in $serviceArea with $yearsExperience years of experience.',
      phoneVerified: phoneVerified,
      identityVerified: identityVerified,
      isFavorite: false,
      location: serviceArea,
      specialties: specialties.isEmpty ? [primaryService] : specialties,
    );
  }
}

class ProviderRecordService {
  const ProviderRecordService();

  SupabaseClient get _client => Supabase.instance.client;

  Future<void> upsertProviderProfile(ProviderRecordPayload payload) async {
    await _client.from('provider_profiles').upsert({
      'first_name': payload.firstName,
      'last_name': payload.lastName,
      'marketing_name': payload.marketingName,
      'date_of_birth': payload.dateOfBirth,
      'gender': payload.gender,
      'email': payload.email.trim().toLowerCase(),
      'phone_number': normalizePhoneNumber(payload.phoneNumber),
      'emergency_contact_number': normalizePhoneNumber(
        payload.emergencyContactNumber,
      ),
      'address_line_1': payload.addressLine1,
      'address_line_2': payload.addressLine2,
      'postcode': payload.postcode,
      'city': payload.city,
      'state': payload.state,
      'country': payload.country,
      'service_area': payload.serviceArea,
      'service_radius_km': payload.serviceRadiusKm,
      'services': payload.services,
      'specialties': payload.specialties,
      'hourly_rate': payload.hourlyRate,
      'years_experience': payload.yearsExperience,
      'availability_days': payload.availabilityDays,
      'time_preset': payload.timePreset,
      'phone_verified': payload.phoneVerified,
      'identity_verified': payload.identityVerified,
      'status': payload.status,
      'role': 'provider',
      'source': 'flutter_app',
    }, onConflict: 'phone_number');
  }
}
