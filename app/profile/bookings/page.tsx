import { getBookings } from "@/lib/profile-service";
import type { BookingStatus } from "@/lib/profile-types";

import { BookingsScreen } from "../_components/profile-ui";

type BookingTab = BookingStatus | "all";

export default async function ProfileBookingsPage(props: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const searchParams = await props.searchParams;
  const bookings = await getBookings();
  const requestedTab = searchParams.tab;
  const initialTab: BookingTab =
    requestedTab === "pending" ||
    requestedTab === "ongoing" ||
    requestedTab === "completed" ||
    requestedTab === "cancelled"
      ? requestedTab
      : "all";

  return <BookingsScreen bookings={bookings} initialTab={initialTab} />;
}
