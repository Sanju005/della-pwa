import 'package:flutter/material.dart';

import '../models/booking_item.dart';
import '../models/message_item.dart';
import '../models/notification_item.dart';
import '../models/provider_summary.dart';
import '../models/service_category.dart';

class DemoDataService {
  const DemoDataService();

  List<ServiceCategory> customerCategories() {
    return const [
      ServiceCategory(label: 'Chef', icon: Icons.restaurant_rounded),
      ServiceCategory(label: 'Maid', icon: Icons.cleaning_services_rounded),
      ServiceCategory(label: 'Driver', icon: Icons.directions_car_filled_rounded),
      ServiceCategory(label: 'Tutor', icon: Icons.menu_book_rounded),
      ServiceCategory(label: 'Plumber', icon: Icons.plumbing_rounded),
      ServiceCategory(label: 'Electrician', icon: Icons.electrical_services_rounded),
    ];
  }

  List<ProviderSummary> providers() {
    return const [
      ProviderSummary(
        name: 'Nur Aisyah',
        service: 'Private Chef',
        hourlyRate: 95,
        rating: 4.9,
        reviewCount: 124,
        distanceLabel: '2.3 km away',
        description: 'Home-cooked Malay and fusion meals for busy families.',
        phoneVerified: true,
        identityVerified: true,
        isFavorite: true,
        location: 'Mont Kiara, Kuala Lumpur',
        specialties: ['Malay Cuisine', 'Healthy Meals', 'Family Events'],
      ),
      ProviderSummary(
        name: 'Daniel Tan',
        service: 'Electrician',
        hourlyRate: 80,
        rating: 4.8,
        reviewCount: 98,
        distanceLabel: '4.1 km away',
        description: 'Reliable electrical repairs, fittings, and upgrades.',
        phoneVerified: true,
        identityVerified: false,
        isFavorite: false,
        location: 'Bangsar South, Kuala Lumpur',
        specialties: ['Wiring', 'Lighting', 'Troubleshooting'],
      ),
      ProviderSummary(
        name: 'Siti Rahmah',
        service: 'Home Cleaner',
        hourlyRate: 55,
        rating: 4.7,
        reviewCount: 182,
        distanceLabel: '1.6 km away',
        description: 'Gentle, detail-focused cleaning with flexible scheduling.',
        phoneVerified: true,
        identityVerified: true,
        isFavorite: false,
        location: 'Petaling Jaya, Selangor',
        specialties: ['Deep Cleaning', 'Laundry', 'Weekly Service'],
      ),
    ];
  }

  List<BookingItem> bookings() {
    return const [
      BookingItem(
        id: 'demo-chef-booking',
        title: 'Chef visit',
        providerName: 'Nur Aisyah',
        schedule: 'Wed, 12 Aug • 7:00 PM',
        location: 'Mont Kiara Residence',
        status: 'Confirmed',
        amountLabel: 'RM 190',
        steps: ['Requested', 'Accepted', 'On the way', 'Completed'],
      ),
      BookingItem(
        id: 'demo-wiring-booking',
        title: 'Wiring repair',
        providerName: 'Daniel Tan',
        schedule: 'Thu, 13 Aug • 10:30 AM',
        location: 'Bangsar Apartment',
        status: 'Pending',
        amountLabel: 'RM 80',
        steps: ['Requested', 'Awaiting response', 'Work in progress', 'Completed'],
      ),
    ];
  }

  List<MessageItem> messages() {
    return const [
      MessageItem(
        text: 'Hi, I can arrive 10 minutes early if that helps.',
        timeLabel: '6:40 PM',
        isMine: false,
      ),
      MessageItem(
        text: 'That works perfectly. See you soon.',
        timeLabel: '6:42 PM',
        isMine: true,
      ),
    ];
  }

  List<NotificationItem> notifications() {
    return const [
      NotificationItem(
        title: 'Booking confirmed',
        body: 'Nur Aisyah confirmed your chef booking for tonight.',
        timeLabel: '5 min ago',
        isUnread: true,
      ),
      NotificationItem(
        title: 'Payout scheduled',
        body: 'Your provider payout will arrive in 1-2 business days.',
        timeLabel: '1 hr ago',
        isUnread: false,
      ),
    ];
  }
}
