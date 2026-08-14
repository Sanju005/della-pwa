import '../models/booking_item.dart';
import '../models/message_item.dart';
import '../models/notification_item.dart';
import '../models/provider_summary.dart';
import '../models/service_category.dart';
import '../services/demo_data_service.dart';
import '../services/provider_directory_store.dart';

class DemoRepository {
  DemoRepository({DemoDataService service = const DemoDataService()})
      : _service = service;

  final DemoDataService _service;

  List<ServiceCategory> getCustomerCategories() => _service.customerCategories();

  List<ProviderSummary> getProviders() => ProviderDirectoryStore.getProviders();

  ProviderSummary getFeaturedProvider() => getProviders().first;

  List<BookingItem> getBookings() => _service.bookings();

  BookingItem getFeaturedBooking() => _service.bookings().first;

  List<MessageItem> getMessages() => _service.messages();

  List<NotificationItem> getNotifications() => _service.notifications();
}
