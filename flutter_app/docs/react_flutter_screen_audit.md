# React To Flutter Screen Audit

Last updated: August 15, 2026

## Rules

- React app remains unchanged.
- Supabase schema, RLS, and backend behavior remain unchanged.
- Flutter should follow the same data path and screen order as the working React app.

## Customer Screens

| React screen | React component | Current Flutter status |
| --- | --- | --- |
| `/login` | page wrapper | Implemented |
| `/register` | register UI | Implemented |
| `/register/verify` | register UI | Implemented |
| `/register/success` | page wrapper | Implemented |
| `/providers` | `providers-catalog-screen.tsx` | Implemented, still needs tighter visual parity |
| `/providers/[id]` | provider profile page | Implemented, still needs tighter visual parity |
| `/providers/[id]/book` | provider booking screen | Implemented, still needs tighter visual parity |
| `/profile` | `ProfileOverviewScreen` | Implemented, still needs exact parity for favorites, wallet, rewards, payment cards |
| `/profile/verification` | `CustomerVerificationHubScreen` | Partially represented inside profile overview, dedicated page not yet added |
| `/profile/verification/email` | `CustomerEmailVerificationScreen` | Not yet added as dedicated Flutter screen |
| `/profile/verification/phone` | `CustomerPhoneVerificationScreen` | Not yet added as dedicated Flutter screen |
| `/profile/verification/identity` | `CustomerIdentityVerificationScreen` | Not yet added as dedicated Flutter screen |
| `/profile/rewards` | `RewardsScreen` | Not yet added |
| `/profile/wallet` | `WalletTopUpScreen` | Not yet added |
| `/profile/favourites` | `FavoritesScreen` | Not yet added as dedicated screen |
| `/profile/edit` | `EditProfileScreen` | Partially covered by Flutter bottom-sheet edit flow |
| `/profile/addresses` | `AddressesScreen` | Partially covered inside profile overview |
| `/profile/bookings` | `BookingsScreen` | Implemented |
| `/profile/bookings/[id]` | `BookingDetailScreen` | Implemented |
| `/profile/bookings/[id]/review` | `BookingReviewScreen` | Partially represented inside task path flow |
| `/profile/payments` | `PaymentsScreen` | Not yet added as dedicated screen |
| `/profile/notifications` | `NotificationsScreen` | Not yet added as dedicated screen |
| `/profile/messages` | `MessagesScreen` | Partially represented by Flutter messages demo screen |
| `/profile/settings` | `SettingsScreen` | Not yet added |

## Provider Screens

| React screen | React component | Current Flutter status |
| --- | --- | --- |
| `/provider/dashboard` | `DashboardScreen` | Partially implemented, still very simplified |
| `/provider/bookings` | `BookingsScreen` | Partially implemented via provider jobs screen |
| `/provider/bookings/[id]` | booking detail page | Not yet matched |
| `/provider/calendar` | `CalendarScreen` | Not yet added |
| `/provider/messages` | `MessagesScreen` | Not yet added |
| `/provider/earnings` | `EarningsScreen` | Partially implemented, still simplified |
| `/provider/payments` | `PaymentsScreen` | Not yet matched |
| `/provider/tasks` | `TasksScreen` | Not yet added |
| `/provider/services` | `ServicesScreen` | Not yet added |
| `/provider/availability` | `AvailabilityScreen` | Not yet added |
| `/provider/reviews` | `ReviewsScreen` | Not yet added |
| `/provider/profile` | `ProfileScreen` | Partially implemented, still simplified |
| `/provider/profile/phone-verification` | `PhoneVerificationScreen` | Not yet added |
| `/provider/profile/email-verification` | `EmailVerificationScreen` | Not yet added |
| `/provider/profile/identity-verification` | `IdentityVerificationScreen` | Not yet added |
| `/provider/more` | `MoreScreen` | Not yet added |
| `/provider/register` | wizard | Implemented, still needs visual parity pass |

## React Data Paths Already Confirmed

- Customer profile overview: React uses `/api/profile/me` plus `/api/profile/favorites` for live refresh.
- Provider catalog: React uses `/api/providers`.
- Provider detail: React uses `/api/providers/[id]`.
- Booking creation/list/detail flows: React uses `/api/bookings` and related booking action routes.
- Provider workspace: React uses `/api/provider/me`, `/api/provider/bookings`, `/api/provider/availability`, `/api/provider/messages`, `/api/provider/reviews`.

## Flutter Changes Completed In This Audit Pass

- Customer home avatar now uses the real profile avatar from Supabase when available.
- Customer profile overview is closer to React structure and uses real profile avatar.
- Audit checklist added to keep React and Flutter parity work explicit.

## Highest Priority Remaining Work

1. Add dedicated Flutter screens for customer verification, addresses, payments, notifications, and favorites.
2. Bring Flutter provider shell closer to React route structure: dashboard, bookings, payments, profile.
3. Replace provider demo screens with live data screens that follow the existing React provider endpoints.
4. Match the remaining React profile cards: wallet, rewards, favorites, and payment method management.
