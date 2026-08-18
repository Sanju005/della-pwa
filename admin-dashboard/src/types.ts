import type { LucideIcon } from "lucide-react";

export type AdminRole =
  | "super_admin"
  | "admin"
  | "manager"
  | "customer_care"
  | "customer"
  | "provider"
  | string;

export type AdminProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: AdminRole | null;
  status: string | null;
};

export type AuthAccess = "guest" | "allowed" | "denied";

export type MetricCard = {
  title: string;
  value: string;
  delta: string;
  trend: "up" | "down";
  accent: string;
};

export type TableColumn<T> = {
  key: keyof T | string;
  label: string;
  className?: string;
  render?: (row: T) => React.ReactNode;
};

export type NavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  count?: number;
  disabled?: boolean;
};

export type StatusTone =
  | "emerald"
  | "green"
  | "sky"
  | "amber"
  | "rose"
  | "slate"
  | "violet";

export type DashboardBooking = {
  id: string;
  rawId?: string;
  service: string;
  provider: string;
  providerId?: string;
  customer: string;
  customerId?: string;
  status: string;
  amount: string;
  schedule: string;
  bookingDate?: string;
  bookingTime?: string;
  fixedAmount?: string;
  additionalAmount?: string;
  totalAmount?: string;
  description?: string;
  completionImages?: string[];
  paymentBreakdown?: Array<{
    description: string;
    amount: string;
  }>;
  location?: string;
  bookingMode?: string;
  customerNote?: string;
  providerNote?: string;
  declineReason?: string;
  hourlyRate?: string;
  dailyRate?: string;
  durationHours?: string;
  taskPath?: Array<{
    key: string;
    label: string;
    value: string;
    done: boolean;
  }>;
  paymentProofImages?: string[];
  companyPaymentProofUrl?: string;
  companyPaymentProofName?: string;
  customerReview?: {
    rating: string;
    comment: string;
    date: string;
    photos: string[];
    tags: string[];
    recommend: string;
  };
  providerReview?: {
    rating: string;
    comment: string;
    date: string;
    photos: string[];
  };
};

export type PaymentRow = {
  id: string;
  rawId?: string;
  customer: string;
  customerId?: string;
  provider: string;
  providerId?: string;
  amount: string;
  method: string;
  status: string;
  date: string;
  createdAt?: string;
  settlementStatus?: string;
  companySlipName?: string;
  companySlipUrl?: string;
};

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  city: string;
  joined: string;
};

export type ProviderRow = {
  id: string;
  provider: string;
  service: string;
  rating: string;
  status: string;
  zone: string;
  verification: string;
  registeredAt?: string;
  latestTaskAt?: string;
};

export type ReviewRow = {
  id: string;
  customer: string;
  provider: string;
  rating: string;
  comment: string;
  status: string;
  date: string;
};

export type ComplaintRow = {
  id: string;
  ticket: string;
  subject: string;
  customer: string;
  owner: string;
  status: string;
  priority: string;
  updated: string;
};

export type ApprovalItem = {
  title: string;
  pending: number;
  accent: string;
  note: string;
};

export type UserAddress = {
  id: string;
  label: string;
  line1: string;
  line2: string;
  tag?: string;
};

export type UserTimelineItem = {
  id: string;
  title: string;
  note: string;
  time: string;
  tone: StatusTone;
};

export type UserActionItem = {
  id: string;
  label: string;
  time: string;
};

export type UserDocumentItem = {
  id: string;
  label: string;
  status: string;
  updated: string;
};

export type UserReportItem = {
  id: string;
  title: string;
  status: string;
  submitted: string;
};

export type UserReviewItem = {
  id: string;
  provider: string;
  rating: number;
  review: string;
  date: string;
  taskId?: string;
  photos?: string[];
  direction?: "received" | "given";
};

export type UserMetric = {
  id: string;
  label: string;
  value: string;
  note: string;
  tone: StatusTone;
};

export type UserDetailRecord = {
  userId: string;
  name: string;
  email: string;
  profileImageUrl?: string;
  role: string;
  status: string;
  phone: string;
  dob: string;
  gender: string;
  city: string;
  joined: string;
  lastLogin: string;
  registeredAt: string;
  device: string;
  ipAddress: string;
  referrer: string;
  accountType: string;
  loginCount: string;
  failedLogins: string;
  twoFactorAuth: string;
  walletBalance: string;
  totalSpent: string;
  reviewsGiven: string;
  reportsSubmitted: string;
  completionRate: string;
  cancellationRate: string;
  averageRating: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  identityVerificationStatus?: "pending" | "processing" | "verified" | "rejected" | string;
  emailVerifiedAt: string;
  phoneVerifiedAt: string;
  kycVerifiedAt: string;
  addresses: UserAddress[];
  timeline: UserTimelineItem[];
  recentActions: UserActionItem[];
  documents: UserDocumentItem[];
  reports: UserReportItem[];
  recentReviews: UserReviewItem[];
  metrics: UserMetric[];
};

export type ProviderServiceArea = {
  id: string;
  label: string;
  tag?: string;
};

export type ProviderSkill = {
  id: string;
  label: string;
};

export type ProviderDocumentItem = {
  id: string;
  label: string;
  status: string;
  note?: string;
  previewUrl?: string;
};

export type ProviderIdentityDocument = {
  id: string;
  label: string;
  fileName: string;
  previewUrl: string;
};

export type ProviderMediaItem = {
  id: string;
  label: string;
  fileName: string;
  previewUrl: string;
};

export type ProviderTaskRow = {
  id: string;
  rawId?: string;
  service: string;
  customer: string;
  date: string;
  amount: string;
  status: string;
};

export type ProviderUpcomingTaskRow = {
  id: string;
  rawId?: string;
  service: string;
  customer: string;
  schedule: string;
  amount: string;
  status: string;
};

export type ProviderPayoutRow = {
  id: string;
  type: string;
  amount: string;
  date: string;
  status: string;
};

export type ProviderCashRow = {
  id: string;
  paymentId?: string;
  date: string;
  bookingId: string;
  grossAmount: string;
  commissionAmount: string;
  netAmount: string;
  payableToCompany: string;
  paidToCompany: string;
  companyPaymentStatus: "pending" | "processing" | "paid";
};

export type ProviderAvailabilityEntry = {
  day: string;
  dayKey: string;
  startTime: string;
  endTime: string;
  timeMode: string;
};

export type ProviderCommissionRow = {
  submissionId: string;
  payableAmount: string;
  depositedAmount: string;
  adminReceivedAmount: string;
  submittedAt: string;
  status: "processing" | "paid";
  proofName: string;
  proofUrl?: string;
  proofMimeType?: string;
};

export type ProviderDetailRecord = {
  providerId: string;
  name: string;
  email: string;
  status: string;
  profileImageUrl?: string;
  roleBadge: string;
  joinedAt: string;
  lastLogin: string;
  serviceType: string;
  serviceArea: string;
  rating: string;
  ratingNote: string;
  phone: string;
  dob: string;
  gender: string;
  language: string;
  nationalId: string;
  emergencyContact: string;
  address: string;
  about: string;
  approvalStatus: string;
  backgroundCheck: string;
  kycStatus: string;
  memberSince: string;
  device: string;
  completedJobs: string;
  cancellationRate: string;
  responseRate: string;
  averageRating: string;
  totalReviews: string;
  onTimeRate: string;
  repeatCustomers: string;
  workingDays: string;
  workingHours: string;
  availabilityEnabled?: boolean;
  availabilityEntries?: ProviderAvailabilityEntry[];
  totalTasks: string;
  completedTasks: string;
  upcomingTasks: string;
  activeTime: string;
  areaCount: string;
  totalEarnings: string;
  withdrawn: string;
  reviewsCount: string;
  identityVerificationStatus?: string;
  identityDocumentType?: string;
  identitySubmittedAt?: string;
  metrics: UserMetric[];
  serviceAreas: ProviderServiceArea[];
  skills: ProviderSkill[];
  documents: ProviderDocumentItem[];
  identityDocuments?: ProviderIdentityDocument[];
  workGallery?: ProviderMediaItem[];
  certificates?: ProviderMediaItem[];
  allTaskRows?: ProviderTaskRow[];
  completedTaskRows: ProviderTaskRow[];
  upcomingTaskRows: ProviderUpcomingTaskRow[];
  cashRows?: ProviderCashRow[];
  payoutRows: ProviderPayoutRow[];
  commissionRows?: ProviderCommissionRow[];
  providerReviewsReceived?: UserReviewItem[];
  providerReviewsGiven?: UserReviewItem[];
  recentActions: UserActionItem[];
  activityLog: UserTimelineItem[];
};
