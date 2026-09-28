import 'package:url_launcher/url_launcher.dart';

/// Opens the device's email app pre-addressed to Swiper support. Shared by
/// every screen that offers a "contact support" affordance so the address
/// and subject only ever need to change in one place.
Future<void> emailSwiperSupport({String subject = 'Swiper support request'}) async {
  final uri = Uri(
    scheme: 'mailto',
    path: 'support@myswiper.my',
    query: 'subject=${Uri.encodeComponent(subject)}',
  );
  await launchUrl(uri);
}
