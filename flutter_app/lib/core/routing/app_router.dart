import 'package:flutter/material.dart';

import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/customer_register_screen.dart';
import '../../features/auth/presentation/customer_register_success_screen.dart';
import '../../features/auth/presentation/customer_register_verify_screen.dart';
import '../../features/auth/presentation/provider_register_screen.dart';
import '../../features/booking/presentation/booking_detail_screen.dart';
import '../../features/auth/presentation/signup_entry_screen.dart';
import '../../features/booking/presentation/booking_overview_screen.dart';
import '../../features/booking/presentation/provider_booking_screen.dart';
import '../../features/home/presentation/customer_shell_screen.dart';
import '../../features/profile/presentation/customer_profile_subpages.dart';
import '../../features/provider_app/presentation/provider_more_screens.dart';
import '../../features/provider_app/presentation/provider_workspace_subpages.dart';
import '../../features/provider_app/presentation/provider_shell_screen.dart';
import '../../features/providers/presentation/provider_list_screen.dart';
import '../../features/providers/presentation/provider_profile_screen.dart';
import '../../repositories/demo_repository.dart';
import 'app_page_route.dart';
import 'app_routes.dart';

class AppRouter {
  const AppRouter._();

  static final DemoRepository _repository = DemoRepository();

  static Route<dynamic> onGenerateRoute(RouteSettings settings) {
    switch (settings.name) {
      case AppRoutes.login:
        return buildAppPageRoute<void>(
          builder: (_) => LoginScreen(repository: _repository),
          settings: settings,
        );
      case AppRoutes.signupEntry:
        return buildAppPageRoute<void>(
          builder: (_) => const SignupEntryScreen(),
          settings: settings,
        );
      case AppRoutes.registerCustomer:
        return buildAppPageRoute<void>(
          builder: (_) => const CustomerRegisterScreen(),
          settings: settings,
        );
      case AppRoutes.registerCustomerVerify:
        return buildAppPageRoute<void>(
          builder: (_) => const CustomerRegisterVerifyScreen(),
          settings: settings,
        );
      case AppRoutes.registerCustomerSuccess:
        return buildAppPageRoute<void>(
          builder: (_) => const CustomerRegisterSuccessScreen(),
          settings: settings,
        );
      case AppRoutes.registerProvider:
        return buildAppPageRoute<void>(
          builder: (_) => const ProviderRegisterScreen(),
          settings: settings,
        );
      case AppRoutes.customerShell:
        return buildAppPageRoute<void>(
          builder: (_) => CustomerShellScreen(repository: _repository),
          settings: settings,
        );
      case AppRoutes.providers:
        return buildAppPageRoute<void>(
          builder: (_) => ProviderListScreen(repository: _repository),
          settings: settings,
        );
      case AppRoutes.providerProfile:
        return buildAppPageRoute<void>(
          builder: (_) => ProviderProfileScreen(repository: _repository),
          settings: settings,
        );
      case AppRoutes.bookingOverview:
        return buildAppPageRoute<void>(
          builder: (_) => BookingOverviewScreen(repository: _repository),
          settings: settings,
        );
      case AppRoutes.bookingDetail:
        return buildAppPageRoute<void>(
          builder: (_) => const BookingDetailScreen(),
          settings: settings,
        );
      case AppRoutes.profileVerification:
        return buildAppPageRoute<void>(
          builder: (_) => const CustomerVerificationHubScreen(),
          settings: settings,
        );
      case AppRoutes.profileVerificationEmail:
        return buildAppPageRoute<void>(
          builder: (_) => const CustomerEmailVerificationScreen(),
          settings: settings,
        );
      case AppRoutes.profileVerificationPhone:
        return buildAppPageRoute<void>(
          builder: (_) => const CustomerPhoneVerificationScreen(),
          settings: settings,
        );
      case AppRoutes.profileVerificationIdentity:
        return buildAppPageRoute<void>(
          builder: (_) => const CustomerIdentityVerificationScreen(),
          settings: settings,
        );
      case AppRoutes.profileAddresses:
        return buildAppPageRoute<void>(
          builder: (_) => const CustomerAddressesScreen(),
          settings: settings,
        );
      case AppRoutes.profilePayments:
        return buildAppPageRoute<void>(
          builder: (_) => const CustomerPaymentsScreen(),
          settings: settings,
        );
      case AppRoutes.profileFavorites:
        return buildAppPageRoute<void>(
          builder: (_) => const CustomerFavoritesScreen(),
          settings: settings,
        );
      case AppRoutes.profileNotifications:
        return buildAppPageRoute<void>(
          builder: (_) => CustomerNotificationsScreen(repository: _repository),
          settings: settings,
        );
      case AppRoutes.providerBooking:
        return buildAppPageRoute<void>(
          builder: (_) => const ProviderBookingScreen(),
          settings: settings,
        );
      case AppRoutes.providerShell:
        return buildAppPageRoute<void>(
          builder: (_) => ProviderShellScreen(repository: _repository),
          settings: settings,
        );
      case AppRoutes.providerAvailability:
        return buildAppPageRoute<void>(
          builder: (_) => const ProviderAvailabilityScreen(),
          settings: settings,
        );
      case AppRoutes.providerServices:
        return buildAppPageRoute<void>(
          builder: (_) => const ProviderServicesScreen(),
          settings: settings,
        );
      case AppRoutes.providerReviews:
        return buildAppPageRoute<void>(
          builder: (_) => const ProviderReviewsScreen(),
          settings: settings,
        );
      case AppRoutes.providerCalendar:
        return buildAppPageRoute<void>(
          builder: (_) => const ProviderCalendarScreen(),
          settings: settings,
        );
      case AppRoutes.providerMessages:
        return buildAppPageRoute<void>(
          builder: (_) => const ProviderMessagesScreen(),
          settings: settings,
        );
      case AppRoutes.providerMore:
        return buildAppPageRoute<void>(
          builder: (_) => const ProviderMoreScreen(),
          settings: settings,
        );
      case AppRoutes.providerVerificationEmail:
        return buildAppPageRoute<void>(
          builder: (_) => const ProviderEmailVerificationScreen(),
          settings: settings,
        );
      case AppRoutes.providerVerificationPhone:
        return buildAppPageRoute<void>(
          builder: (_) => const ProviderPhoneVerificationScreen(),
          settings: settings,
        );
      case AppRoutes.providerVerificationIdentity:
        return buildAppPageRoute<void>(
          builder: (_) => const ProviderIdentityVerificationScreen(),
          settings: settings,
        );
      default:
        return buildAppPageRoute<void>(
          builder: (_) => LoginScreen(repository: _repository),
          settings: settings,
        );
    }
  }
}
