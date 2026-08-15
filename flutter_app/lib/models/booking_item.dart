class BookingItem {
  const BookingItem({
    required this.id,
    required this.title,
    required this.providerName,
    this.providerImageUrl = '',
    required this.schedule,
    required this.location,
    required this.status,
    required this.amountLabel,
    required this.steps,
    this.scheduledAt,
    this.createdAt,
  });

  final String id;
  final String title;
  final String providerName;
  final String providerImageUrl;
  final String schedule;
  final String location;
  final String status;
  final String amountLabel;
  final List<String> steps;
  final DateTime? scheduledAt;
  final DateTime? createdAt;
}
