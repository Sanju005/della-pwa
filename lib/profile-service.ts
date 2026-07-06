import "server-only";

import type {
  Address,
  Booking,
  CustomerProfile,
  PaymentHistoryItem,
  ProfileOverviewData,
  SettingGroup,
} from "./profile-types";

const emptyProfile: CustomerProfile = {
  firstName: "",
  lastName: "",
  sex: "",
  dateOfBirth: "",
  avatarUrl: "",
  email: "",
  phoneNumber: "",
  countryCode: "+60",
  emergencyContactNumber: "",
  city: "",
  region: "Malaysia",
  country: "Malaysia",
  verified: false,
  completion: 0,
};

const cashOnlyPaymentMethods: ProfileOverviewData["paymentMethods"] = [
  { id: "cash", label: "Cash", type: "Available now", isDefault: true },
];

const paymentHistory: PaymentHistoryItem[] = [];

const addresses: Address[] = [];

const bookings: Booking[] = [];

const settings: SettingGroup[] = [
  {
    title: "Account",
    items: [
      { id: "edit", label: "Edit Personal Information", icon: "user" },
      { id: "password", label: "Change Password", icon: "lock" },
      { id: "notifications", label: "Notification Settings", icon: "bell" },
    ],
  },
  {
    title: "Support",
    items: [
      { id: "help", label: "Help & Support", icon: "help" },
      { id: "report", label: "Report an Issue", icon: "alert" },
      { id: "privacy", label: "Privacy Policy", icon: "privacy" },
      { id: "terms", label: "Terms & Conditions", icon: "terms" },
    ],
  },
  {
    title: "Account Actions",
    items: [
      { id: "delete", label: "Delete Account", icon: "trash", tone: "danger" },
      { id: "logout", label: "Logout", icon: "logout", tone: "danger" },
    ],
  },
];

export async function getProfileOverviewData(): Promise<ProfileOverviewData> {
  return {
    profile: structuredClone(emptyProfile),
    favoriteProviders: [],
    paymentMethods: structuredClone(cashOnlyPaymentMethods),
    paymentSummary: {
      walletBalance: 0,
      companyPayable: 0,
      totalPaid: 0,
      lastPaymentLabel: "No payment yet",
    },
    bookingSummary: {
      pending: 0,
      ongoing: 0,
      completed: 0,
      cancelled: 0,
    },
  };
}

export async function getEditableProfileData(): Promise<CustomerProfile> {
  return structuredClone(emptyProfile);
}

export async function getSavedAddresses(): Promise<Address[]> {
  return structuredClone(addresses);
}

export async function getBookings(): Promise<Booking[]> {
  return structuredClone(bookings);
}

export async function getBookingById(id: string): Promise<Booking | null> {
  const allBookings = await getBookings();
  return allBookings.find((booking) => booking.id === id) ?? null;
}

export async function getProfileSettings(): Promise<SettingGroup[]> {
  return structuredClone(settings);
}

export async function getPaymentHistory(): Promise<PaymentHistoryItem[]> {
  return structuredClone(paymentHistory);
}

export async function getFavoriteProviders() {
  return [];
}
