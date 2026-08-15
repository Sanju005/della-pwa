class ProviderSummary {
  const ProviderSummary({
    this.id = '',
    required this.name,
    this.providerName = '',
    required this.service,
    required this.hourlyRate,
    this.dailyRate = 0,
    required this.rating,
    required this.reviewCount,
    required this.distanceLabel,
    required this.description,
    required this.phoneVerified,
    required this.identityVerified,
    required this.isFavorite,
    required this.location,
    required this.specialties,
    this.services = const [],
    this.yearsExperience = '',
    this.approvalStatus = '',
    this.avatarUrl = '',
  });

  final String id;
  final String name;
  final String providerName;
  final String service;
  final int hourlyRate;
  final int dailyRate;
  final double rating;
  final int reviewCount;
  final String distanceLabel;
  final String description;
  final bool phoneVerified;
  final bool identityVerified;
  final bool isFavorite;
  final String location;
  final List<String> specialties;
  final List<String> services;
  final String yearsExperience;
  final String approvalStatus;
  final String avatarUrl;

  factory ProviderSummary.fromJson(Map<String, dynamic> json) {
    return ProviderSummary(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      providerName: json['providerName'] as String? ?? '',
      service: json['service'] as String? ?? '',
      hourlyRate: (json['hourlyRate'] as num?)?.toInt() ?? 0,
      dailyRate: (json['dailyRate'] as num?)?.toInt() ?? 0,
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
      services:
          (json['services'] as List?)
              ?.map((item) => item.toString())
              .where((item) => item.isNotEmpty)
              .toList() ??
          const [],
      yearsExperience: json['yearsExperience'] as String? ?? '',
      approvalStatus: json['approvalStatus'] as String? ?? '',
      avatarUrl: json['avatarUrl'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'providerName': providerName,
      'service': service,
      'hourlyRate': hourlyRate,
      'dailyRate': dailyRate,
      'rating': rating,
      'reviewCount': reviewCount,
      'distanceLabel': distanceLabel,
      'description': description,
      'phoneVerified': phoneVerified,
      'identityVerified': identityVerified,
      'isFavorite': isFavorite,
      'location': location,
      'specialties': specialties,
      'services': services,
      'yearsExperience': yearsExperience,
      'approvalStatus': approvalStatus,
      'avatarUrl': avatarUrl,
    };
  }
}
