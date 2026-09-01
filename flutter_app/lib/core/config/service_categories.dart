import 'package:flutter/material.dart';

import '../../models/service_category.dart';

/// The one canonical list of service categories a customer can browse.
/// Keys and order mirror the backend's own `serviceOrder` in
/// `lib/provider-catalog-shared.ts` exactly, so a category selected here
/// always matches a real `service_type` a provider can register under.
///
/// This intentionally isn't a database table — see the Customer Home audit:
/// there's no product need yet for admins to add/reorder categories at
/// runtime, so a single static Dart source avoids inventing backend
/// complexity for eight fixed values. If that changes, this is the one file
/// to replace with a real fetch.
const List<ServiceCategory> kServiceCategories = [
  ServiceCategory(
    key: 'chef',
    label: 'Chef',
    icon: Icons.restaurant_rounded,
    description: 'Home Cooking',
  ),
  ServiceCategory(
    key: 'maid',
    label: 'Maid',
    icon: Icons.cleaning_services_rounded,
    description: 'Cleaning Service',
  ),
  ServiceCategory(
    key: 'babysitter',
    label: 'Babysitter',
    icon: Icons.child_care_rounded,
    description: 'Childcare',
  ),
  ServiceCategory(
    key: 'driver',
    label: 'Driver',
    icon: Icons.directions_car_filled_rounded,
    description: 'Private Driver',
  ),
  ServiceCategory(
    key: 'cleaner',
    label: 'Cleaner',
    icon: Icons.cleaning_services_outlined,
    description: 'Home Cleaning',
  ),
  ServiceCategory(
    key: 'tutor',
    label: 'Tutor',
    icon: Icons.menu_book_rounded,
    description: 'Private Lessons',
  ),
  ServiceCategory(
    key: 'plumber',
    label: 'Plumber',
    icon: Icons.plumbing_rounded,
    description: 'Fix & Repair',
  ),
  ServiceCategory(
    key: 'electrician',
    label: 'Electrician',
    icon: Icons.electrical_services_rounded,
    description: 'Installation & Repair',
  ),
];
