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
}
