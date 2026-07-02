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
  service: string;
  provider: string;
  customer: string;
  status: string;
  amount: string;
  schedule: string;
};

export type PaymentRow = {
  id: string;
  customer: string;
  provider: string;
  amount: string;
  method: string;
  status: string;
  date: string;
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
};

export type ProviderTaskRow = {
  id: string;
  service: string;
  customer: string;
  date: string;
  amount: string;
  status: string;
};

export type ProviderUpcomingTaskRow = {
  id: string;
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

export type ProviderCommissionRow = {
  submissionId: string;
  payableAmount: string;
  depositedAmount: string;
  adminReceivedAmount: string;
  submittedAt: string;
  status: "processing" | "paid";
  proofName: string;
};

export type ProviderDetailRecord = {
  providerId: string;
  name: string;
  email: string;
  status: string;
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
  totalTasks: string;
  completedTasks: string;
  upcomingTasks: string;
  activeTime: string;
  areaCount: string;
  totalEarnings: string;
  withdrawn: string;
  reviewsCount: string;
  metrics: UserMetric[];
  serviceAreas: ProviderServiceArea[];
  skills: ProviderSkill[];
  documents: ProviderDocumentItem[];
  completedTaskRows: ProviderTaskRow[];
  upcomingTaskRows: ProviderUpcomingTaskRow[];
  payoutRows: ProviderPayoutRow[];
  commissionRows?: ProviderCommissionRow[];
  recentActions: UserActionItem[];
  activityLog: UserTimelineItem[];
};
