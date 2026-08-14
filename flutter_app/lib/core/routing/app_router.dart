import 'package:flutter/material.dart';

import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/customer_register_screen.dart';
import '../../features/auth/presentation/customer_register_success_screen.dart';
import '../../features/auth/presentation/customer_register_verify_screen.dart';
import '../../features/auth/presentation/provider_register_screen.dart';
import '../../features/auth/presentation/signup_entry_screen.dart';
import '../../features/booking/presentation/booking_overview_screen.dart';
import '../../features/home/presentation/customer_shell_screen.dart';
import '../../features/provider_app/presentation/provider_shell_screen.dart';
import '../../features/providers/presentation/provider_list_screen.dart';
import '../../features/providers/presentation/provider_profile_screen.dart';
import '../../repositories/demo_repository.dart';
import 'app_routes.dart';

class AppRouter {
  const AppRouter._();

  static final DemoRepository _repository = DemoRepository();

  static Route<dynamic> onGenerateRoute(RouteSettings settings) {
    switch (settings.name) {
      case AppRoutes.login:
        return MaterialPageRoute<void>(
          builder: (_) => LoginScreen(repository: _repository),
          settings: settings,
        );
      case AppRoutes.signupEntry:
        return MaterialPageRoute<void>(
          builder: (_) => const SignupEntryScreen(),
          settings: settings,
        );
      case AppRoutes.registerCustomer:
        return MaterialPageRoute<void>(
          builder: (_) => const CustomerRegisterScreen(),
          settings: settings,
        );
      case AppRoutes.registerCustomerVerify:
        return MaterialPageRoute<void>(
          builder: (_) => const CustomerRegisterVerifyScreen(),
          settings: settings,
        );
      case AppRoutes.registerCustomerSuccess:
        return MaterialPageRoute<void>(
          builder: (_) => const CustomerRegisterSuccessScreen(),
          settings: settings,
        );
      case AppRoutes.registerProvider:
        return MaterialPageRoute<void>(
          builder: (_) => const ProviderRegisterScreen(),
          settings: settings,
        );
      case AppRoutes.customerShell:
        return MaterialPageRoute<void>(
          builder: (_) => CustomerShellScreen(repository: _repository),
          settings: settings,
        );
      case AppRoutes.providers:
        return MaterialPageRoute<void>(
          builder: (_) => ProviderListScreen(repository: _repository),
          settings: settings,
        );
      case AppRoutes.providerProfile:
        return MaterialPageRoute<void>(
          builder: (_) => ProviderProfileScreen(repository: _repository),
          settings: settings,
        );
      case AppRoutes.bookingOverview:
        return MaterialPageRoute<void>(
          builder: (_) => BookingOverviewScreen(repository: _repository),
          settings: settings,
        );
      case AppRoutes.providerShell:
        return MaterialPageRoute<void>(
          builder: (_) => ProviderShellScreen(repository: _repository),
          settings: settings,
        );
      default:
        return MaterialPageRoute<void>(
          builder: (_) => LoginScreen(repository: _repository),
          settings: settings,
        );
    }
  }
}
