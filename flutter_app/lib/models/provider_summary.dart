class ProviderSummary {
  const ProviderSummary({
    required this.name,
    required this.service,
    required this.hourlyRate,
    required this.rating,
    required this.reviewCount,
    required this.distanceLabel,
    required this.description,
    required this.phoneVerified,
    required this.identityVerified,
    required this.isFavorite,
    required this.location,
    required this.specialties,
  });

  final String name;
  final String service;
  final int hourlyRate;
  final double rating;
  final int reviewCount;
  final String distanceLabel;
  final String description;
  final bool phoneVerified;
  final bool identityVerified;
  final bool isFavorite;
  final String location;
  final List<String> specialties;

  factory ProviderSummary.fromJson(Map<String, dynamic> json) {
    return ProviderSummary(
      name: json['name'] as String? ?? '',
      service: json['service'] as String? ?? '',
      hourlyRate: (json['hourlyRate'] as num?)?.toInt() ?? 0,
      rating: (json['rating'] as num?)?.toDouble() ?? 0,
      reviewCount: (json['reviewCount'] as num?)?.toInt() ?? 0,
      distanceLabel: json['distanceLabel'] as String? ?? '',
      description: json['description'] as String? ?? '',
      phoneVerified: json['phoneVerified'] as bool? ?? false,
      identityVerified: json['identityVerified'] as bool? ?? false,
      isFavorite: json['isFavorite'] as bool? ?? false,
      location: json['location'] as String? ?? '',
      specialties:
          (json['specialties'] as List?)
              ?.map((item) => item.toString())
              .where((item) => item.isNotEmpty)
              .toList() ??
          const [],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'service': service,
      'hourlyRate': hourlyRate,
      'rating': rating,
      'reviewCount': reviewCount,
      'distanceLabel': distanceLabel,
      'description': description,
      'phoneVerified': phoneVerified,
      'identityVerified': identityVerified,
      'isFavorite': isFavorite,
      'location': location,
      'specialties': specialties,
    };
  }
}
