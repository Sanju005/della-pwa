export type CustomerProfile = {
  firstName: string;
  lastName: string;
  sex: "" | "Male" | "Female";
  dateOfBirth: string;
  avatarUrl?: string;
  email: string;
  phoneNumber: string;
  countryCode: string;
  emergencyContactNumber: string;
  city: string;
  region: string;
  country: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  identityVerificationStatus: "pending" | "processing" | "verified" | "rejected";
  identityDocumentType?: "ic" | "passport";
  identityFrontImageUrl?: string;
  identityBackImageUrl?: string;
  verified: boolean;
  completion: number;
};

export type FavoriteProvider = {
  id: string;
  name: string;
  role: string;
  initials: string;
  accent: string;
  serviceKey?: string;
  rating?: number;
  priceLabel?: string;
  portraitSrc?: string;
  bookHref?: string;
};

export type PaymentMethod = {
  id: string;
  label: string;
  type: string;
  isDefault?: boolean;
  disabled?: boolean;
};

export type PaymentHistoryItem = {
  id: string;
  serviceCategory: string;
  serviceTitle: string;
  provider: string;
  amount: number;
  paidAt: string;
  paymentMethod: string;
  status: "paid" | "refunded";
};

export type NotificationItem = {
  id: string;
  bookingId?: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
};

export type Address = {
  id: string;
  label: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  isDefault?: boolean;
  kind: "home" | "office" | "other";
};

export type BookingStatus = "pending" | "ongoing" | "completed" | "cancelled";

export type Booking = {
  id: string;
  service: string;
  provider: string;
  providerFullName?: string;
  providerAvatarUrl?: string;
  schedule: string;
  location: string;
  status: BookingStatus;
  workflowStatus:
    | "pending"
    | "pending_provider_response"
    | "declined"
    | "declined_by_provider"
    | "accepted"
    | "on_the_way"
    | "arrived"
    | "work_finished_by_provider"
    | "work_confirmed_by_user"
    | "final_payment_sent"
    | "cash_paid_by_user"
    | "payment_received_by_provider"
    | "completed"
    | "paid"
    | "review_requested"
    | "reviewed"
    | "cancelled";
  statusLabel: string;
  badgeTone: "green" | "amber" | "slate";
  thumbnail: string;
  imageSrc?: string;
  paymentAmount?: number;
  paymentMethod?: string;
  paymentOption?: "cash" | "online";
  paymentStatus?: "pending" | "paid" | "failed" | "cancelled" | "refunded";
  companyCommissionAmount?: number;
  providerNetAmount?: number;
  companyPaymentStatus?: "pending" | "payment_process" | "paid";
  customerPaymentProofDataUrl?: string;
  customerPaymentProofFileName?: string;
  customerPaymentProofMimeType?: string;
  providerCompanyPaymentProofDataUrl?: string;
  providerCompanyPaymentProofFileName?: string;
  providerCompanyPaymentProofMimeType?: string;
  baseAmount?: number;
  additionalCharge?: number;
  additionalChargeDescription?: string;
  paymentBreakdown?: Array<{
    description: string;
    amount: number;
  }>;
  workFinishedImages?: string[];
  cashPaymentProofImages?: string[];
  userReviewStatus?: "pending" | "submitted" | "skipped";
  providerReviewStatus?: "pending" | "submitted" | "skipped";
  paymentNote?: string;
  notes?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  scheduledStartAt?: string;
  scheduledEndAt?: string;
  createdAt?: string;
  acceptedAt?: string;
  onTheWayAt?: string;
  arrivedAt?: string;
  completedAt?: string;
  workFinishedAt?: string;
  workConfirmedByUserAt?: string;
  paymentSentAt?: string;
  cashPaidByUserAt?: string;
  paymentReceivedByProviderAt?: string;
  paidAt?: string;
  cancelledAt?: string;
  activitySteps?: Array<{
    label: string;
    status: "done" | "current" | "pending";
  }>;
};

export type SettingItem = {
  id: string;
  label: string;
  tone?: "default" | "danger";
  icon: "user" | "lock" | "bell" | "help" | "alert" | "privacy" | "terms" | "trash" | "logout";
};

export type SettingGroup = {
  title: string;
  items: SettingItem[];
};

export type ProfileOverviewData = {
  profile: CustomerProfile;
  favoriteProviders: FavoriteProvider[];
  paymentMethods: PaymentMethod[];
  paymentSummary: {
    walletBalance: number;
    companyPayable: number;
    totalPaid: number;
    lastPaymentLabel: string;
  };
  bookingSummary: {
    pending: number;
    ongoing: number;
    completed: number;
    cancelled: number;
  };
};
