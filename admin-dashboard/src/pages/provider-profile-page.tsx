import {
  BadgeCheck,
  Ban,
  BriefcaseBusiness,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  FileBadge2,
  FileText,
  KeyRound,
  Languages,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Star,
  Trash2,
  Upload,
  UserCircle2,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { InfoRow, MetricTile, MiniStatus, PillBadge, SurfaceCard, TableShell } from "../components/user-detail-ui";
import { BookingTaskDetails } from "./booking-detail-page";
import { getBookingDetailWithFallback } from "../lib/admin-bookings";
import {
  deleteProviderIdentityDocument,
  deleteProviderMedia,
  getProviderProfileWithFallback,
  markCompanyPaymentReceived,
  updateProviderAvailability,
  setProviderIdentityVerified,
  setProviderSuspended,
  setProviderVisibility,
  updateProviderProfile,
  uploadProviderIdentityDocument,
  uploadProviderMedia,
} from "../lib/admin-providers";
import type { ProviderAvailabilityEntry, ProviderDetailRecord, ProviderIdentityDocument } from "../types";
import type { DashboardBooking } from "../types";

const tabs = [
  "Overview",
  "Tasks",
  "Accounts",
  "Reviews",
  "Documents & Verification",
] as const;

type TabKey = (typeof tabs)[number];
type TaskStatusFilter = "all" | "completed" | "upcoming" | "canceled";
type ApprovalChecklist = {
  profile: boolean;
  work: boolean;
  certificate: boolean;
  identity: boolean;
};

const ALL_DAYS = [
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" },
  { key: "saturday", label: "Sat" },
  { key: "sunday", label: "Sun" },
] as const;

const metricIcons = [
  <BriefcaseBusiness className="size-5" />,
  <CheckCircle2 className="size-5" />,
  <CalendarCheck2 className="size-5" />,
  <Clock3 className="size-5" />,
  <MapPin className="size-5" />,
  <Wallet className="size-5" />,
  <FileText className="size-5" />,
  <Star className="size-5" />,
];

const metricAccents: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-600",
  rose: "bg-rose-50 text-rose-600",
  violet: "bg-violet-50 text-violet-600",
  amber: "bg-amber-50 text-amber-600",
  sky: "bg-sky-50 text-sky-600",
  slate: "bg-slate-100 text-slate-600",
  green: "bg-green-50 text-green-600",
};

function avatarGradient(name: string) {
  const palette = [
    "from-[#dcecdf] via-[#f2f7f3] to-white",
    "from-[#d8e8f7] via-[#eef6ff] to-white",
    "from-[#efe7d8] via-[#faf5ea] to-white",
  ];
  return palette[name.length % palette.length];
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}

function isPdfAsset(value?: string) {
  const normalized = (value ?? "").toLowerCase();
  return normalized.startsWith("data:application/pdf") || normalized.includes(".pdf");
}

function buildChecklistState(detail?: ProviderDetailRecord | null): ApprovalChecklist {
  return {
    profile: Boolean(detail?.profileImageUrl),
    work: Boolean(detail?.workGallery?.length),
    certificate: Boolean(detail?.certificates?.length),
    identity:
      detail?.identityVerificationStatus === "Verified" ||
      Boolean(detail?.identityDocuments?.length),
  };
}

function buildDefaultAvailabilityDay() {
  return {
    selected: false,
    startTime: "08:00",
    endTime: "20:00",
  };
}

function ReviewSlideSection({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: NonNullable<ProviderDetailRecord["providerReviewsReceived"]>;
}) {
  return (
    <SurfaceCard title={title}>
      {rows.length ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {rows.map((review) => (
            <article
              key={`${title}-${review.id}`}
              className="min-w-[320px] max-w-[420px] rounded-[22px] border border-slate-100 bg-[#fff8fb] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Task {review.taskId || "-"}
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-950">{review.provider}</p>
                </div>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-[12px] font-bold text-amber-700">
                  {review.rating}.0
                </span>
              </div>
              <p className="mt-3 min-h-[72px] text-sm leading-6 text-slate-700">{review.review}</p>
              <p className="mt-3 text-[12px] text-slate-400">{review.date}</p>
              {review.photos?.length ? (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {review.photos.slice(0, 3).map((photo, index) => (
                    <a
                      key={`${review.id}-photo-${index}`}
                      href={photo}
                      target="_blank"
                      rel="noreferrer"
                      className="block aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-white"
                    >
                      {isPdfAsset(photo) ? (
                        <div className="grid h-full place-items-center text-[11px] font-bold text-violet-700">PDF</div>
                      ) : (
                        <img src={photo} alt={`Review photo ${index + 1}`} className="h-full w-full object-cover" />
                      )}
                    </a>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-[12px] text-slate-400">
                  No review images
                </p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">{empty}</p>
      )}
    </SurfaceCard>
  );
}

function SummaryMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[12px] font-semibold text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-bold text-slate-950">{value}</p>
    </div>
  );
}

function renderSimpleRows(title: string, headers: string[], rows: string[][]) {
  return (
    <TableShell title={title}>
      <table className="min-w-full text-left text-[13px]">
        <thead>
          <tr className="border-b border-slate-100 text-slate-400">
            {headers.map((header) => (
              <th key={header} className="pb-3 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-slate-50">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="py-3 text-slate-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  );
}

function parseCurrencyValue(value?: string) {
  const numeric = Number((value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatRinggitAmount(value: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
  }).format(value);
}

export function ProviderProfilePage() {
  const { providerId = "" } = useParams();
  const [activeTab, setActiveTab] = useState<TabKey>("Overview");
  const [message, setMessage] = useState<string | null>(null);
  const [provider, setProvider] = useState<ProviderDetailRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifyingIdentity, setVerifyingIdentity] = useState(false);
  const [identityDocumentSaving, setIdentityDocumentSaving] = useState("");
  const [mediaSaving, setMediaSaving] = useState("");
  const [receivingPaymentId, setReceivingPaymentId] = useState("");
  const [receivedAmounts, setReceivedAmounts] = useState<Record<string, string>>({});
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selectedTask, setSelectedTask] = useState<DashboardBooking | null>(null);
  const [selectedTaskLoading, setSelectedTaskLoading] = useState(false);
  const [taskStatusFilter, setTaskStatusFilter] = useState<TaskStatusFilter>("all");
  const [taskDateFrom, setTaskDateFrom] = useState("");
  const [taskDateTo, setTaskDateTo] = useState("");
  const [approvalNote, setApprovalNote] = useState("");
  const [checklist, setChecklist] = useState<ApprovalChecklist>(buildChecklistState(null));
  const [editing, setEditing] = useState(false);
  const [editingAvailability, setEditingAvailability] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    dob: "",
    gender: "",
    language: "",
    nationalId: "",
    emergencyContact: "",
    address: "",
    serviceArea: "",
    about: "",
  });
  const [availabilityForm, setAvailabilityForm] = useState<{
    enabled: boolean;
    entries: Record<string, { selected: boolean; startTime: string; endTime: string }>;
  }>({
    enabled: true,
    entries: Object.fromEntries(
      ALL_DAYS.map((day) => [day.key, buildDefaultAvailabilityDay()]),
    ) as Record<string, { selected: boolean; startTime: string; endTime: string }>,
  });

  useEffect(() => {
    let active = true;

    setActiveTab("Overview");
    setMessage(null);
    setLoading(true);
    setProvider(null);
    setSelectedTaskId("");
    setSelectedTask(null);
    setSelectedTaskLoading(false);
    setTaskStatusFilter("all");
    setTaskDateFrom("");
    setTaskDateTo("");
    setApprovalNote("");
    setChecklist(buildChecklistState(null));
    setForm({
      name: "",
      email: "",
      phone: "",
      dob: "",
      gender: "",
      language: "",
      nationalId: "",
      emergencyContact: "",
      address: "",
      serviceArea: "",
      about: "",
    });
    setEditingAvailability(false);
    setAvailabilityForm({
      enabled: true,
      entries: Object.fromEntries(
        ALL_DAYS.map((day) => [day.key, buildDefaultAvailabilityDay()]),
      ) as Record<string, { selected: boolean; startTime: string; endTime: string }>,
    });

    async function loadProvider() {
      try {
        const payload = await getProviderProfileWithFallback(providerId);

        if (!active) {
          return;
        }

        setProvider(payload.detail);
        setChecklist(buildChecklistState(payload.detail));
        setForm({
          name: payload.detail?.name ?? "",
          email: payload.detail?.email ?? "",
          phone: payload.detail?.phone ?? "",
          dob: payload.detail?.dob ?? "",
          gender: payload.detail?.gender ?? "",
          language: payload.detail?.language ?? "",
          nationalId: payload.detail?.nationalId ?? "",
          emergencyContact: payload.detail?.emergencyContact ?? "",
          address: payload.detail?.address ?? "",
          serviceArea: payload.detail?.serviceArea ?? "",
          about: payload.detail?.about ?? "",
        });
        const nextAvailabilityEntries = Object.fromEntries(
          ALL_DAYS.map((day) => [day.key, buildDefaultAvailabilityDay()]),
        ) as Record<string, { selected: boolean; startTime: string; endTime: string }>;
        (payload.detail?.availabilityEntries ?? []).forEach((entry) => {
          nextAvailabilityEntries[entry.dayKey] = {
            selected: true,
            startTime: entry.startTime,
            endTime: entry.endTime,
          };
        });
        setAvailabilityForm({
          enabled: payload.detail?.availabilityEnabled ?? true,
          entries: nextAvailabilityEntries,
        });
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProvider();

    return () => {
      active = false;
    };
  }, [providerId]);

  useEffect(() => {
    let active = true;

    if (!selectedTaskId) {
      setSelectedTask(null);
      setSelectedTaskLoading(false);
      return () => {
        active = false;
      };
    }

    async function loadSelectedTask() {
      setSelectedTaskLoading(true);
      const detail = await getBookingDetailWithFallback(selectedTaskId);

      if (!active) {
        return;
      }

      setSelectedTask(detail);
      setSelectedTaskLoading(false);
    }

    void loadSelectedTask();

    return () => {
      active = false;
    };
  }, [selectedTaskId]);

  function flash(nextMessage: string) {
    setMessage(nextMessage);
  }

  async function reloadProviderDetails() {
    const payload = await getProviderProfileWithFallback(providerId);
    setProvider(payload.detail);
    if (payload.detail) {
      setChecklist(buildChecklistState(payload.detail));
      setForm({
        name: payload.detail.name,
        email: payload.detail.email,
        phone: payload.detail.phone,
        dob: payload.detail.dob,
        gender: payload.detail.gender,
        language: payload.detail.language,
        nationalId: payload.detail.nationalId,
        emergencyContact: payload.detail.emergencyContact,
        address: payload.detail.address,
        serviceArea: payload.detail.serviceArea,
        about: payload.detail.about,
      });
      const nextAvailabilityEntries = Object.fromEntries(
        ALL_DAYS.map((day) => [day.key, buildDefaultAvailabilityDay()]),
      ) as Record<string, { selected: boolean; startTime: string; endTime: string }>;
      (payload.detail.availabilityEntries ?? []).forEach((entry) => {
        nextAvailabilityEntries[entry.dayKey] = {
          selected: true,
          startTime: entry.startTime,
          endTime: entry.endTime,
        };
      });
      setAvailabilityForm({
        enabled: payload.detail.availabilityEnabled ?? true,
        entries: nextAvailabilityEntries,
      });
    }
  }

  function fileToDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error ?? new Error("Unable to read selected file."));
      reader.readAsDataURL(file);
    });
  }

  function isPassportDocument(documentType?: string) {
    return documentType?.toLowerCase().includes("passport") ?? false;
  }

  function buildOptimisticIdentityDocument(
    side: "front" | "back",
    previewUrl: string,
    fileName: string,
    documentType?: string,
  ): ProviderIdentityDocument {
    const passport = isPassportDocument(documentType);

    return {
      id: `identity-${side}`,
      label:
        side === "front"
          ? passport
            ? "Passport Main Page"
            : "IC Front"
          : passport
            ? "Passport Supporting Page"
            : "IC Back",
      fileName: fileName || (passport ? `passport-${side}` : `ic-${side}`),
      previewUrl,
    };
  }

  function updateIdentityDocumentStatus(
    documents: ProviderDetailRecord["documents"],
    nextStatus: string,
    nextCount: number,
  ) {
    return documents.map((document) =>
      document.label === "Identity Verification"
        ? {
            ...document,
            status: nextStatus,
            note: nextCount > 0 ? `${nextCount} document image${nextCount > 1 ? "s" : ""} submitted` : undefined,
          }
        : document,
    );
  }

  if (loading && !provider) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-600" />
      </div>
    );
  }

  if (!provider) {
    return (
      <SurfaceCard title="Provider Details">
        <p className="text-sm text-slate-500">Provider record was not found.</p>
      </SurfaceCard>
    );
  }

  const detail = provider;
  const allChecklistReady = Object.values(checklist).every(Boolean);
  const isProviderApproved =
    detail.approvalStatus === "Approved" &&
    detail.identityVerificationStatus === "Verified" &&
    detail.status !== "Paused" &&
    detail.status !== "Suspended";
  const allTaskRows =
    detail.allTaskRows?.length
      ? detail.allTaskRows
      : [
          ...detail.completedTaskRows,
          ...detail.upcomingTaskRows.map((task) => ({
            id: task.id,
            rawId: task.rawId,
            service: task.service,
            customer: task.customer,
            date: task.schedule,
            amount: task.amount,
            status: task.status,
          })),
        ];
  const taskFilterOptions: { value: TaskStatusFilter; label: string }[] = [
    { value: "all", label: "All Tasks" },
    { value: "completed", label: "Completed" },
    { value: "upcoming", label: "Upcoming" },
    { value: "canceled", label: "Canceled" },
  ];
  const filteredTaskRows = allTaskRows.filter((task) => {
    const normalizedStatus = task.status.toLowerCase();
    const statusMatches =
      taskStatusFilter === "all" ||
      (taskStatusFilter === "completed" && (normalizedStatus.includes("completed") || normalizedStatus.includes("reviewed"))) ||
      (taskStatusFilter === "upcoming" &&
        (normalizedStatus.includes("pending") ||
          normalizedStatus.includes("upcoming") ||
          normalizedStatus.includes("scheduled") ||
          normalizedStatus.includes("accepted"))) ||
      (taskStatusFilter === "canceled" && (normalizedStatus.includes("cancel") || normalizedStatus.includes("declined")));

    if (!statusMatches) {
      return false;
    }

    const taskTimestamp = Date.parse(task.date);
    const fromTimestamp = taskDateFrom ? Date.parse(taskDateFrom) : Number.NaN;
    const toTimestamp = taskDateTo ? Date.parse(`${taskDateTo}T23:59:59`) : Number.NaN;

    if (!Number.isNaN(fromTimestamp) && !Number.isNaN(taskTimestamp) && taskTimestamp < fromTimestamp) {
      return false;
    }

    if (!Number.isNaN(toTimestamp) && !Number.isNaN(taskTimestamp) && taskTimestamp > toTimestamp) {
      return false;
    }

    return true;
  });
  const cashRows = detail.cashRows ?? [];
  const cashTotals = cashRows.reduce(
    (summary, row) => ({
      gross: summary.gross + parseCurrencyValue(row.grossAmount),
      commission: summary.commission + parseCurrencyValue(row.commissionAmount),
      net: summary.net + parseCurrencyValue(row.netAmount),
      payable: summary.payable + (row.companyPaymentStatus === "paid" ? 0 : parseCurrencyValue(row.commissionAmount)),
      paid: summary.paid + (row.companyPaymentStatus === "paid" ? parseCurrencyValue(row.paidToCompany) : 0),
    }),
    { gross: 0, commission: 0, net: 0, payable: 0, paid: 0 },
  );

  async function handleSaveProfile() {
    if (saving) {
      return;
    }

    setSaving(true);
    const result = await updateProviderProfile(detail.providerId, {
      full_name: form.name,
      email: form.email,
      phone: form.phone,
      date_of_birth: form.dob,
      gender: form.gender,
      language: form.language,
      national_id: form.nationalId,
      emergency_contact: form.emergencyContact,
      address: form.address,
      marketing_name: form.name,
      service_location: form.serviceArea,
      bio: form.about,
    });
    setSaving(false);

    if (result.error) {
      flash(result.error);
      return;
    }

    setProvider((current) =>
      current
        ? {
            ...current,
            name: form.name,
            email: form.email,
            phone: form.phone,
            dob: form.dob,
            gender: form.gender,
            language: form.language,
            nationalId: form.nationalId,
            emergencyContact: form.emergencyContact,
            address: form.address,
            serviceArea: form.serviceArea,
            about: form.about,
          }
        : current
    );
    setEditing(false);
    flash("Provider details updated.");
  }

  async function handleSuspend() {
    if (saving) {
      return;
    }

    const suspended = detail.status !== "Suspended";
    setSaving(true);
    const result = await setProviderSuspended(detail.providerId, suspended);
    setSaving(false);

    if (result.error) {
      flash(result.error);
      return;
    }

    setProvider((current) =>
      current ? { ...current, status: suspended ? "Suspended" : "Active" } : current
    );
    flash(suspended ? "Provider suspended." : "Provider restored.");
  }

  async function handleDeactivate() {
    if (saving) {
      return;
    }

    const typed = window.prompt('Type "DISABLE" to disable this provider.');
    if (typed !== "DISABLE") {
      flash("Provider was not disabled. You must type DISABLE to confirm.");
      return;
    }

    setSaving(true);
    const result = await setProviderVisibility(detail.providerId, false);
    setSaving(false);

    if (result.error) {
      flash(result.error);
      return;
    }

    setProvider((current) => (current ? { ...current, status: "Paused" } : current));
    flash("Provider disabled.");
  }

  async function handleSaveAvailability() {
    if (saving) {
      return;
    }

    const entries = ALL_DAYS.reduce<ProviderAvailabilityEntry[]>((result, day) => {
        const entry = availabilityForm.entries[day.key] ?? buildDefaultAvailabilityDay();

        if (!entry.selected) {
          return result;
        }

        result.push({
          day: day.label,
          dayKey: day.key,
          startTime: entry.startTime,
          endTime: entry.endTime,
          timeMode: "custom",
        });

        return result;
      }, []);

    setSaving(true);
    const result = await updateProviderAvailability(detail.providerId, {
      enabled: availabilityForm.enabled,
      entries,
    });
    setSaving(false);

    if (result.error) {
      flash(result.error);
      return;
    }

    await reloadProviderDetails();
    setEditingAvailability(false);
    flash("Provider availability updated.");
  }

  async function handleMarkCompanyPaymentReceived(submissionId: string) {
    const rawAmount = receivedAmounts[submissionId] ?? "";

    if (!rawAmount.trim()) {
      flash("Enter the received amount before marking payment received.");
      return;
    }

    setReceivingPaymentId(submissionId);
    const result = await markCompanyPaymentReceived(submissionId, Number(rawAmount), detail.providerId);
    setReceivingPaymentId("");

    if (result.error) {
      flash(result.error);
      return;
    }

    setProvider((current) =>
      current
        ? {
            ...current,
            commissionRows: (current.commissionRows ?? []).map((row) =>
              row.submissionId === submissionId
                ? {
                    ...row,
                    status: "paid",
                    adminReceivedAmount: `RM ${Number(rawAmount).toFixed(2)}`,
                  }
                : row,
            ),
          }
        : current,
    );
    flash("Company payment marked as received.");
  }

  async function handleIdentityVerification(verified: boolean) {
    if (verifyingIdentity) {
      return;
    }

    setVerifyingIdentity(true);
    const result = await setProviderIdentityVerified(
      detail.providerId,
      verified,
      detail.identityDocumentType,
    );
    setVerifyingIdentity(false);

    if (result.error) {
      flash(result.error);
      return;
    }

    await reloadProviderDetails();
    flash(verified ? "Identity documents verified." : "Identity status changed back to pending.");
  }

  async function handleApproveProvider() {
    if (!approvalNote.trim()) {
      flash("Please add an admin note before approving this provider.");
      return;
    }

    if (!allChecklistReady) {
      flash("Complete all document checklist items before approving this provider.");
      return;
    }

    if (isProviderApproved) {
      flash("Provider is already approved.");
      return;
    }

    setVerifyingIdentity(true);
    const result = await setProviderIdentityVerified(
      detail.providerId,
      true,
      detail.identityDocumentType,
      approvalNote.trim(),
      true,
    );
    setVerifyingIdentity(false);

    if (result.error) {
      flash(result.error);
      return;
    }

    await reloadProviderDetails();
    setChecklist((current) => ({ ...current, identity: true }));
    flash("Provider approved. App verification and visibility were updated.");
  }

  async function handleProviderMediaUpload(kind: "profile" | "work" | "certificate", file?: File | null) {
    if (!file || mediaSaving) {
      return;
    }

    setMediaSaving(`upload-${kind}`);
    let dataUrl = "";

    try {
      dataUrl = await fileToDataUrl(file);
    } catch (error) {
      setMediaSaving("");
      flash(error instanceof Error ? error.message : "Unable to read selected file.");
      return;
    }

    const result = await uploadProviderMedia(detail.providerId, kind, dataUrl, file.name);
    setMediaSaving("");

    if (result.error) {
      flash(result.error);
      return;
    }

    await reloadProviderDetails();
    flash(
      kind === "profile"
        ? "Profile photo uploaded. The app will show the new photo."
        : kind === "work"
          ? "Service image uploaded. The app will show the new service image."
          : "Certificate uploaded.",
    );
  }

  async function handleProviderMediaDelete(kind: "profile" | "work" | "certificate", mediaId?: string) {
    if (mediaSaving) {
      return;
    }

    const confirmed = window.confirm(
      kind === "profile"
        ? "Delete this profile photo?"
        : kind === "work"
          ? "Delete this service image?"
          : "Delete this certificate?",
    );

    if (!confirmed) {
      return;
    }

    setMediaSaving(`delete-${kind}-${mediaId ?? "profile"}`);
    const result = await deleteProviderMedia(detail.providerId, kind, mediaId);
    setMediaSaving("");

    if (result.error) {
      flash(result.error);
      return;
    }

    await reloadProviderDetails();
    flash(
      kind === "profile"
        ? "Profile photo deleted. The app will no longer show it."
        : kind === "work"
          ? "Service image deleted. The app has been updated."
          : "Certificate deleted.",
    );
  }

  async function handleIdentityDocumentUpload(side: "front" | "back", file?: File | null) {
    if (!file || identityDocumentSaving) {
      return;
    }

    setIdentityDocumentSaving(`upload-${side}`);
    let dataUrl = "";

    try {
      dataUrl = await fileToDataUrl(file);
    } catch (error) {
      setIdentityDocumentSaving("");
      flash(error instanceof Error ? error.message : "Unable to read selected file.");
      return;
    }

    const result = await uploadProviderIdentityDocument(
      detail.providerId,
      side,
      dataUrl,
      file.name,
      detail.identityDocumentType,
    );
    setIdentityDocumentSaving("");

    if (result.error) {
      flash(result.error);
      return;
    }

    const optimisticDocument = buildOptimisticIdentityDocument(
      side,
      dataUrl,
      file.name,
      detail.identityDocumentType,
    );
    setProvider((current) => {
      if (!current) {
        return current;
      }

      const otherDocuments = (current.identityDocuments ?? []).filter(
        (document) => document.id !== `identity-${side}`,
      );
      const nextDocuments =
        side === "front"
          ? [optimisticDocument, ...otherDocuments]
          : [...otherDocuments, optimisticDocument];

      return {
        ...current,
        identityVerificationStatus: "Processing",
        kycStatus: "Pending",
        documents: updateIdentityDocumentStatus(current.documents, "Processing", nextDocuments.length),
        identityDocuments: nextDocuments,
      };
    });
    flash(`${side === "front" ? "Front" : "Back"} identity image uploaded. Status changed to pending review.`);
  }

  async function handleIdentityDocumentDelete(side: "front" | "back") {
    if (identityDocumentSaving) {
      return;
    }

    const confirmed = window.confirm(`Delete the ${side} identity image?`);
    if (!confirmed) {
      return;
    }

    setIdentityDocumentSaving(`delete-${side}`);
    const result = await deleteProviderIdentityDocument(
      detail.providerId,
      side,
      detail.identityDocumentType,
    );
    setIdentityDocumentSaving("");

    if (result.error) {
      flash(result.error);
      return;
    }

    setProvider((current) => {
      if (!current) {
        return current;
      }

      const nextDocuments = (current.identityDocuments ?? []).filter(
        (document) => document.id !== `identity-${side}`,
      );
      const nextStatus = nextDocuments.length ? "Processing" : "Pending";

      return {
        ...current,
        identityVerificationStatus: nextStatus,
        kycStatus: "Pending",
        documents: updateIdentityDocumentStatus(current.documents, nextStatus, nextDocuments.length),
        identityDocuments: nextDocuments,
      };
    });
    flash(`${side === "front" ? "Front" : "Back"} identity image deleted. Status changed to pending review.`);
  }

  function renderOverview() {
    return (
      <>
        <section className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-4">
            <SurfaceCard
              title="Personal Details"
              action={
                <button
                  type="button"
                  onClick={() => setEditing((current) => !current)}
                  className="rounded-xl border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700"
                >
                  {editing ? "Cancel" : "Edit"}
                </button>
              }
            >
              <div className="space-y-4">
              <InfoRow
                label="Full Name"
                value={
                  editing ? (
                    <input
                      value={form.name}
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                    />
                  ) : (
                    detail.name
                  )
                }
                icon={<UserCircle2 className="size-4" />}
              />
              <InfoRow
                label="Email Address"
                value={
                  editing ? (
                    <input
                      value={form.email}
                      onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                    />
                  ) : (
                    detail.email
                  )
                }
                icon={<Mail className="size-4" />}
              />
              <InfoRow
                label="Phone Number"
                value={
                  editing ? (
                    <input
                      value={form.phone}
                      onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                    />
                  ) : (
                    detail.phone
                  )
                }
                icon={<Phone className="size-4" />}
              />
              <InfoRow
                label="Date of Birth"
                value={
                  editing ? (
                    <input
                      value={form.dob}
                      onChange={(event) => setForm((current) => ({ ...current, dob: event.target.value }))}
                      placeholder="YYYY-MM-DD or 6 Jul 1966"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                    />
                  ) : (
                    detail.dob
                  )
                }
                icon={<CalendarDays className="size-4" />}
              />
              <InfoRow
                label="Gender"
                value={
                  editing ? (
                    <select
                      value={form.gender}
                      onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                    >
                      <option value="">Not provided</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  ) : (
                    detail.gender
                  )
                }
                icon={<ShieldCheck className="size-4" />}
              />
              <InfoRow
                label="Language"
                value={
                  editing ? (
                    <input
                      value={form.language}
                      onChange={(event) => setForm((current) => ({ ...current, language: event.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                    />
                  ) : (
                    detail.language
                  )
                }
                icon={<Languages className="size-4" />}
              />
              <InfoRow
                label="NRIC / ID Number"
                value={
                  editing ? (
                    <input
                      value={form.nationalId}
                      onChange={(event) => setForm((current) => ({ ...current, nationalId: event.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                    />
                  ) : (
                    detail.nationalId
                  )
                }
                icon={<FileBadge2 className="size-4" />}
              />
              <InfoRow
                label="Emergency Contact"
                value={
                  editing ? (
                    <input
                      value={form.emergencyContact}
                      onChange={(event) => setForm((current) => ({ ...current, emergencyContact: event.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                    />
                  ) : (
                    detail.emergencyContact
                  )
                }
                icon={<Phone className="size-4" />}
              />
              <InfoRow
                label="Address"
                value={
                  editing ? (
                    <textarea
                      value={form.address}
                      onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                      className="min-h-[96px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                    />
                  ) : (
                    <span className="whitespace-pre-line">{detail.address}</span>
                  )
                }
                icon={<MapPin className="size-4" />}
              />
            </div>
            {editing ? (
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            ) : null}
          </SurfaceCard>

          </div>

          <div className="space-y-4">
            <SurfaceCard
              title="Service Areas"
              action={
                <button className="rounded-xl border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                  Edit
                </button>
              }
            >
              <div className="space-y-4">
                {detail.serviceAreas.map((area) => (
                  <div key={area.id} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 text-sm text-slate-700">
                      <MapPin className="size-4 text-slate-400" />
                      <span>{area.label}</span>
                    </div>
                    {area.tag ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                        {area.tag}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </SurfaceCard>

            <SurfaceCard title="Service Details & Images">
              <div className="grid gap-4 sm:grid-cols-2">
                <SummaryMetric label="Service Type" value={detail.serviceType} />
                <SummaryMetric label="Service Area" value={detail.serviceArea} />
              </div>

              {editing ? (
                <textarea
                  value={form.about}
                  onChange={(event) => setForm((current) => ({ ...current, about: event.target.value }))}
                  className="mt-5 min-h-[132px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                />
              ) : (
                <p className="mt-5 text-sm leading-7 text-slate-600">{detail.about}</p>
              )}

              <div className="mt-8">
                <h4 className="text-base font-bold text-slate-950">Skills & Services</h4>
                <div className="mt-4 flex flex-wrap gap-2">
                  {detail.skills.map((skill) => (
                    <span
                      key={skill.id}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] font-semibold text-slate-600"
                    >
                      {skill.label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-8">
                <h4 className="text-base font-bold text-slate-950">Work Images</h4>
                {detail.workGallery?.length ? (
                  <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
                    {detail.workGallery.slice(0, 4).map((item) => (
                      <a
                        key={item.id}
                        href={item.previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block min-w-[260px] overflow-hidden rounded-[20px] border border-slate-200 bg-white p-3 transition hover:border-emerald-200 sm:min-w-[320px]"
                      >
                        <div className="relative aspect-[4/3] overflow-hidden rounded-[16px] bg-slate-100">
                          <img src={item.previewUrl} alt={item.label} className="h-full w-full object-cover" />
                        </div>
                        <p className="mt-3 text-sm font-semibold text-slate-900">{item.label}</p>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
                    No work images are stored yet.
                  </p>
                )}
              </div>
            </SurfaceCard>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <SurfaceCard
            title="Availability"
            action={
              <button
                type="button"
                onClick={() => setEditingAvailability((current) => !current)}
                className="rounded-xl border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700"
              >
                {editingAvailability ? "Cancel" : "Edit"}
              </button>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <SummaryMetric label="Working Days" value={detail.workingDays} />
              <SummaryMetric label="Working Hours" value={detail.workingHours} />
            </div>
            {editingAvailability ? (
              <div className="mt-6 space-y-4 rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                <label className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3 text-sm">
                  <span className="font-semibold text-slate-900">Provider visible for booking</span>
                  <input
                    type="checkbox"
                    checked={availabilityForm.enabled}
                    onChange={(event) =>
                      setAvailabilityForm((current) => ({
                        ...current,
                        enabled: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                  />
                </label>
                <div className="space-y-3">
                  {ALL_DAYS.map((day) => (
                    <div key={day.key} className="grid gap-3 rounded-2xl bg-white px-4 py-3 md:grid-cols-[90px_1fr_120px_120px] md:items-center">
                      <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <input
                          type="checkbox"
                          checked={availabilityForm.entries[day.key]?.selected ?? false}
                          onChange={(event) =>
                            setAvailabilityForm((current) => {
                              const nextDay = current.entries[day.key] ?? buildDefaultAvailabilityDay();

                              return {
                                ...current,
                                entries: {
                                  ...current.entries,
                                  [day.key]: {
                                    ...nextDay,
                                    selected: event.target.checked,
                                  },
                                },
                              };
                            })
                          }
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                        />
                        {day.label}
                      </label>
                      <span className="text-xs text-slate-500">
                        {availabilityForm.entries[day.key]?.selected ? "Available" : "Off"}
                      </span>
                      <input
                        type="time"
                        value={availabilityForm.entries[day.key]?.startTime ?? "08:00"}
                        disabled={!availabilityForm.entries[day.key]?.selected}
                        onChange={(event) =>
                          setAvailabilityForm((current) => {
                            const nextDay = current.entries[day.key] ?? buildDefaultAvailabilityDay();

                            return {
                              ...current,
                              entries: {
                                ...current.entries,
                                [day.key]: {
                                  ...nextDay,
                                  startTime: event.target.value,
                                },
                              },
                            };
                          })
                        }
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none disabled:bg-slate-100"
                      />
                      <input
                        type="time"
                        value={availabilityForm.entries[day.key]?.endTime ?? "20:00"}
                        disabled={!availabilityForm.entries[day.key]?.selected}
                        onChange={(event) =>
                          setAvailabilityForm((current) => {
                            const nextDay = current.entries[day.key] ?? buildDefaultAvailabilityDay();

                            return {
                              ...current,
                              entries: {
                                ...current.entries,
                                [day.key]: {
                                  ...nextDay,
                                  endTime: event.target.value,
                                },
                              },
                            };
                          })
                        }
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none disabled:bg-slate-100"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => void handleSaveAvailability()}
                    disabled={saving}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Save Availability"}
                  </button>
                </div>
              </div>
            ) : null}
          </SurfaceCard>
        </section>
      </>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-[#E7ECE7] bg-white px-5 py-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)] sm:px-6">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex flex-col gap-5 sm:flex-row">
            <div className="relative">
              <div
                className={`grid size-[104px] shrink-0 place-items-center rounded-[30px] bg-gradient-to-br ${avatarGradient(detail.name)} shadow-inner ring-8 ring-slate-50`}
              >
                {detail.profileImageUrl ? (
                  <img
                    src={detail.profileImageUrl}
                    alt={detail.name}
                    className="size-[82px] rounded-[26px] object-cover ring-4 ring-white/70"
                  />
                ) : (
                  <div className="grid size-[82px] place-items-center rounded-[26px] bg-white/70 backdrop-blur">
                    <span className="font-display text-[2rem] font-extrabold text-slate-700">
                      {initials(detail.name)}
                    </span>
                  </div>
                )}
              </div>
              <span className="absolute bottom-2 right-2 size-4 rounded-full border-2 border-white bg-emerald-500" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-display text-[2rem] font-extrabold tracking-tight text-slate-950">
                  {detail.name}
                </h1>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-[12px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  {detail.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">Provider ID: {detail.providerId}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                <PillBadge tone="emerald"><BadgeCheck className="size-3.5" /> Email Verified</PillBadge>
                <PillBadge tone="emerald"><Phone className="size-3.5" /> Phone Verified</PillBadge>
                <PillBadge tone="emerald"><ShieldCheck className="size-3.5" /> KYC Verified</PillBadge>
                <PillBadge tone="blue">{detail.roleBadge}</PillBadge>
              </div>

              <div className="mt-5 grid gap-4 text-sm text-slate-500 sm:grid-cols-2 xl:grid-cols-5">
                <div className="flex items-start gap-3">
                  <CalendarDays className="mt-0.5 size-4 text-slate-400" />
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">Joined</p>
                    <p className="mt-1 font-medium text-slate-900">{detail.joinedAt}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock3 className="mt-0.5 size-4 text-slate-400" />
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">Last Login</p>
                    <p className="mt-1 font-medium text-slate-900">{detail.lastLogin}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <BriefcaseBusiness className="mt-0.5 size-4 text-slate-400" />
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">Service Type</p>
                    <p className="mt-1 font-medium text-slate-900">{detail.serviceType}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 size-4 text-slate-400" />
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">Service Area</p>
                    <p className="mt-1 font-medium text-slate-900">{detail.serviceArea}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Star className="mt-0.5 size-4 text-amber-400" />
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">Rating</p>
                    <p className="mt-1 font-medium text-slate-900">{detail.rating} {detail.ratingNote}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 xl:max-w-[620px] xl:justify-end">
            <button
              type="button"
              onClick={() => flash("Public provider profile opened.")}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 px-5 py-3 text-sm font-semibold text-emerald-700"
            >
              <Eye className="size-4" />
              View Profile
            </button>
            <button
              type="button"
              onClick={handleSuspend}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 px-5 py-3 text-sm font-semibold text-amber-700"
            >
              <Ban className="size-4" />
              {detail.status === "Suspended" ? "Restore Provider" : "Suspend Provider"}
            </button>
            <button
              type="button"
              onClick={() => flash("Password reset link sent.")}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 px-5 py-3 text-sm font-semibold text-blue-700"
            >
              <KeyRound className="size-4" />
              Reset Password
            </button>
            <button
              type="button"
              onClick={handleDeactivate}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 px-5 py-3 text-sm font-semibold text-rose-600"
            >
              <Trash2 className="size-4" />
              Deactivate
            </button>
          </div>
        </div>

        {message ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {message}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-8">
        {detail.metrics.map((metric, index) => (
          <MetricTile
            key={metric.id}
            icon={metricIcons[index] ?? <BriefcaseBusiness className="size-5" />}
            label={metric.label}
            value={metric.value}
            note={metric.note}
            accent={(metricAccents[metric.tone] ?? metricAccents.slate) as string}
            action={metric.label === "Total Tasks" ? "View all tasks" : undefined}
          />
        ))}
      </section>

      <section className="rounded-[22px] border border-[#E7ECE7] bg-white px-4 py-2 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap gap-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                activeTab === tab
                  ? "border-b-2 border-emerald-500 text-emerald-700"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </section>

      {activeTab === "Overview" ? renderOverview() : null}
      {activeTab === "Tasks"
        ? (
            <div className="space-y-4">
              <TableShell title="All Tasks">
                <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl bg-slate-50 p-3">
                  <div className="flex flex-wrap gap-2">
                    {taskFilterOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setTaskStatusFilter(option.value)}
                        className={`rounded-full px-3 py-2 text-xs font-bold transition ${
                          taskStatusFilter === option.value
                            ? "bg-emerald-600 text-white"
                            : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-950"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <label className="text-[12px] font-semibold text-slate-500">
                    From
                    <input
                      type="date"
                      value={taskDateFrom}
                      onChange={(event) => setTaskDateFrom(event.target.value)}
                      className="mt-1 block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none"
                    />
                  </label>
                  <label className="text-[12px] font-semibold text-slate-500">
                    To
                    <input
                      type="date"
                      value={taskDateTo}
                      onChange={(event) => setTaskDateTo(event.target.value)}
                      className="mt-1 block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setTaskStatusFilter("all");
                      setTaskDateFrom("");
                      setTaskDateTo("");
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-950"
                  >
                    Reset
                  </button>
                </div>
                <table className="min-w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400">
                      <th className="pb-3 font-semibold">Task ID</th>
                      <th className="pb-3 font-semibold">Service</th>
                      <th className="pb-3 font-semibold">Customer</th>
                      <th className="pb-3 font-semibold">Date</th>
                      <th className="pb-3 font-semibold">Amount</th>
                      <th className="pb-3 font-semibold">Status</th>
                      <th className="pb-3 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTaskRows.length ? filteredTaskRows.map((task) => {
                      const taskKey = task.rawId ?? task.id;
                      const selected = selectedTaskId === taskKey;

                      return (
                        <tr
                          key={taskKey}
                          onClick={() => setSelectedTaskId(taskKey)}
                          className={`cursor-pointer border-b border-slate-50 transition hover:bg-emerald-50/50 ${
                            selected ? "bg-emerald-50/70" : ""
                          }`}
                        >
                          <td className="py-3 font-semibold text-emerald-700">
                            <button type="button" className="font-semibold hover:underline">
                              {task.id}
                            </button>
                          </td>
                          <td className="py-3">{task.service}</td>
                          <td className="py-3">{task.customer}</td>
                          <td className="py-3 text-slate-500">{task.date}</td>
                          <td className="py-3">{task.amount}</td>
                          <td className="py-3"><MiniStatus status={task.status} /></td>
                          <td className="py-3">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedTaskId(taskKey);
                              }}
                              className="rounded-full bg-emerald-50 px-3 py-1.5 text-[12px] font-bold text-emerald-700 hover:bg-emerald-100"
                            >
                              View details
                            </button>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan={7} className="py-5 text-center text-sm text-slate-500">
                          No tasks match this filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </TableShell>

              {selectedTaskLoading ? (
                <SurfaceCard title="Task Details">
                  <div className="grid min-h-[12rem] place-items-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-600" />
                  </div>
                </SurfaceCard>
              ) : selectedTask ? (
                <BookingTaskDetails
                  booking={selectedTask}
                  action={
                    <Link to={`/tasks-bookings/${selectedTask.rawId ?? selectedTask.id}`} className="text-sm font-semibold text-[#b4236b]">
                      Open full page
                    </Link>
                  }
                />
              ) : selectedTaskId ? (
                <SurfaceCard title="Task Details">
                  <p className="text-sm text-slate-500">Booking record was not found.</p>
                </SurfaceCard>
              ) : (
                <SurfaceCard title="Task Details">
                  <p className="text-sm text-slate-500">Click any task row above to see the full task path, timings, images, payments, and reviews.</p>
                </SurfaceCard>
              )}
            </div>
          )
        : null}
      {activeTab === "Accounts"
        ? (
            <div className="space-y-4">
              <section className="grid gap-4 md:grid-cols-5">
                <SurfaceCard title="Gross">
                  <SummaryMetric label="All bookings" value={formatRinggitAmount(cashTotals.gross)} />
                </SurfaceCard>
                <SurfaceCard title="Commission">
                  <SummaryMetric label="Company share" value={formatRinggitAmount(cashTotals.commission)} />
                </SurfaceCard>
                <SurfaceCard title="Net">
                  <SummaryMetric label="Provider earnings" value={formatRinggitAmount(cashTotals.net)} />
                </SurfaceCard>
                <SurfaceCard title="Payable">
                  <SummaryMetric label="Not yet paid" value={formatRinggitAmount(cashTotals.payable)} />
                </SurfaceCard>
                <SurfaceCard title="Paid">
                  <SummaryMetric label="Received by company" value={formatRinggitAmount(cashTotals.paid)} />
                </SurfaceCard>
              </section>

              <TableShell title="Cash">
                <table className="min-w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400">
                      <th className="pb-3 font-semibold">Date</th>
                      <th className="pb-3 font-semibold">Booking ID</th>
                      <th className="pb-3 font-semibold">Gross Amount</th>
                      <th className="pb-3 font-semibold">Commission</th>
                      <th className="pb-3 font-semibold">Net Amount</th>
                      <th className="pb-3 font-semibold">Payable to Company</th>
                      <th className="pb-3 font-semibold">Paid to Company</th>
                      <th className="pb-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-4 text-slate-500">
                          No cash records found for this provider yet.
                        </td>
                      </tr>
                    ) : (
                      cashRows.map((row) => (
                        <tr key={row.id} className="border-b border-slate-50 align-top">
                          <td className="py-3 text-slate-600">{row.date}</td>
                          <td className="py-3 font-semibold text-emerald-700">{row.bookingId}</td>
                          <td className="py-3 text-slate-700">{row.grossAmount}</td>
                          <td className="py-3 text-slate-700">{row.commissionAmount}</td>
                          <td className="py-3 font-semibold text-slate-900">{row.netAmount}</td>
                          <td className="py-3 text-amber-700">{row.payableToCompany}</td>
                          <td className="py-3 text-emerald-700">{row.paidToCompany}</td>
                          <td className="py-3">
                            <MiniStatus
                              status={
                                row.companyPaymentStatus === "paid"
                                  ? "Paid"
                                  : row.companyPaymentStatus === "processing"
                                    ? "Processing"
                                    : "Pending"
                              }
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {cashRows.length ? (
                    <tfoot>
                      <tr className="border-t border-slate-200 bg-slate-50/70 text-slate-900">
                        <td className="py-3 font-bold" colSpan={2}>Total</td>
                        <td className="py-3 font-bold">{formatRinggitAmount(cashTotals.gross)}</td>
                        <td className="py-3 font-bold">{formatRinggitAmount(cashTotals.commission)}</td>
                        <td className="py-3 font-bold">{formatRinggitAmount(cashTotals.net)}</td>
                        <td className="py-3 font-bold text-amber-700">{formatRinggitAmount(cashTotals.payable)}</td>
                        <td className="py-3 font-bold text-emerald-700">{formatRinggitAmount(cashTotals.paid)}</td>
                        <td className="py-3 font-bold">Summary</td>
                      </tr>
                    </tfoot>
                  ) : null}
                </table>
              </TableShell>

              {renderSimpleRows(
                "Others",
                ["ID", "Type", "Amount", "Date", "Status"],
                detail.payoutRows.map((row) => [row.id, row.type, row.amount, row.date, row.status])
              )}
              <TableShell title="Others: Company Commission Payments">
                <table className="min-w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400">
                      <th className="pb-3 font-semibold">Payable</th>
                      <th className="pb-3 font-semibold">Provider Deposited</th>
                      <th className="pb-3 font-semibold">Admin Received</th>
                      <th className="pb-3 font-semibold">Slip</th>
                      <th className="pb-3 font-semibold">Submitted</th>
                      <th className="pb-3 font-semibold">Status</th>
                      <th className="pb-3 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.commissionRows ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-4 text-slate-500">
                          No company commission payments yet.
                        </td>
                      </tr>
                    ) : (
                      detail.commissionRows?.map((row) => (
                        <tr key={row.submissionId} className="border-b border-slate-50 align-top">
                          <td className="py-3 font-semibold text-slate-700">{row.payableAmount}</td>
                          <td className="py-3">{row.depositedAmount}</td>
                          <td className="py-3">
                            {row.status === "paid" ? (
                              row.adminReceivedAmount
                            ) : (
                              <input
                                value={receivedAmounts[row.submissionId] ?? ""}
                                onChange={(event) =>
                                  setReceivedAmounts((current) => ({
                                    ...current,
                                    [row.submissionId]: event.target.value,
                                  }))
                                }
                                placeholder="RM amount"
                                className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                              />
                            )}
                          </td>
                          <td className="py-3 text-slate-500">
                            {row.proofUrl ? (
                              <a
                                href={row.proofUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="font-semibold text-violet-700 underline decoration-violet-200 underline-offset-2"
                              >
                                {row.proofName || "View slip"}
                              </a>
                            ) : (
                              row.proofName
                            )}
                          </td>
                          <td className="py-3 text-slate-500">{row.submittedAt}</td>
                          <td className="py-3"><MiniStatus status={row.status === "processing" ? "Pending" : row.status} /></td>
                          <td className="py-3">
                            {row.status === "processing" ? (
                              <button
                                type="button"
                                onClick={() => void handleMarkCompanyPaymentReceived(row.submissionId)}
                                disabled={receivingPaymentId === row.submissionId}
                                className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                              >
                                {receivingPaymentId === row.submissionId ? "Saving..." : "Mark Received"}
                              </button>
                            ) : (
                              <span className="text-slate-400">Completed</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </TableShell>
            </div>
          )
        : null}
      {activeTab === "Reviews"
        ? (
            <div className="space-y-4">
              <section className="grid gap-4 md:grid-cols-4">
                <SurfaceCard title="Average Rating"><SummaryMetric label="Rating" value={detail.averageRating} /></SurfaceCard>
                <SurfaceCard title="Received"><SummaryMetric label="Customer Reviews" value={String((detail.providerReviewsReceived ?? []).length)} /></SurfaceCard>
                <SurfaceCard title="Given"><SummaryMetric label="Provider Reviews" value={String((detail.providerReviewsGiven ?? []).length)} /></SurfaceCard>
                <SurfaceCard title="Repeat Customers"><SummaryMetric label="Rate" value={detail.repeatCustomers} /></SurfaceCard>
              </section>
              <ReviewSlideSection
                title="Reviews Provider Received"
                empty="No customer reviews received yet."
                rows={detail.providerReviewsReceived ?? []}
              />
              <ReviewSlideSection
                title="Reviews Provider Gave"
                empty="No provider-to-customer reviews submitted yet."
                rows={detail.providerReviewsGiven ?? []}
              />
            </div>
          )
        : null}
      {activeTab === "Documents & Verification" ? (
        <SurfaceCard title="Documents & Verification">
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-4">
              <InfoRow label="Provider Name" value={detail.name} icon={<UserCircle2 className="size-4" />} />
              <InfoRow label="Service Type" value={detail.serviceType} icon={<BriefcaseBusiness className="size-4" />} />
              <InfoRow label="Email" value={detail.email} icon={<Mail className="size-4" />} />
              <InfoRow label="Phone" value={detail.phone} icon={<Phone className="size-4" />} />
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-950">Approval Status</h3>
                  <p className="mt-1 text-[12px] text-slate-500">
                    Provider stays hidden from users until admin completes all checks and approves.
                  </p>
                </div>
                <MiniStatus status={detail.approvalStatus || "Pending"} />
              </div>
              <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm text-slate-600">
                {isProviderApproved
                  ? "Approved providers are visible to users in the app."
                  : "Provider app should remain in processing / pending review until approval is completed here."}
              </p>
            </div>
          </div>
          <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-slate-950">Profile Photo</h3>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700">
                <Upload className="size-3.5" />
                {mediaSaving === "upload-profile" ? "Uploading..." : "Upload New"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={Boolean(mediaSaving)}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    event.target.value = "";
                    void handleProviderMediaUpload("profile", file);
                  }}
                />
              </label>
            </div>
            {detail.profileImageUrl ? (
              <div className="mt-4 max-w-[240px] overflow-hidden rounded-[20px] border border-slate-200 bg-white p-3">
                <a href={detail.profileImageUrl} target="_blank" rel="noreferrer" className="block">
                  <img src={detail.profileImageUrl} alt={`${detail.name} profile`} className="aspect-square w-full rounded-[16px] object-cover" />
                </a>
                <button
                  type="button"
                  onClick={() => void handleProviderMediaDelete("profile")}
                  disabled={Boolean(mediaSaving)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 disabled:opacity-60"
                >
                  <Trash2 className="size-3.5" />
                  {mediaSaving === "delete-profile-profile" ? "Deleting..." : "Delete"}
                </button>
              </div>
            ) : (
              <p className="mt-4 rounded-[20px] border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
                No profile photo is currently stored.
              </p>
            )}
          </div>

          <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-slate-950">Service Images</h3>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700">
                <Upload className="size-3.5" />
                {mediaSaving === "upload-work" ? "Uploading..." : "Upload Image"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={Boolean(mediaSaving)}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    event.target.value = "";
                    void handleProviderMediaUpload("work", file);
                  }}
                />
              </label>
            </div>
            {detail.workGallery?.length ? (
              <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
                {detail.workGallery.map((item) => (
                  <div key={item.id} className="min-w-[280px] overflow-hidden rounded-[20px] border border-slate-200 bg-white p-3 sm:min-w-[360px]">
                    <a href={item.previewUrl} target="_blank" rel="noreferrer" className="block transition hover:opacity-90">
                      <div className="relative aspect-[4/3] overflow-hidden rounded-[16px] bg-slate-100">
                        <img src={item.previewUrl} alt={item.label} className="h-full w-full object-cover" />
                      </div>
                    </a>
                    <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                        <p className="mt-1 text-[12px] text-slate-500">{item.fileName}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleProviderMediaDelete("work", item.id)}
                        disabled={Boolean(mediaSaving)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 disabled:opacity-60"
                      >
                        <Trash2 className="size-3.5" />
                        {mediaSaving === `delete-work-${item.id}` ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-[20px] border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
                No service images are currently stored.
              </p>
            )}
          </div>

          <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-slate-950">Certificates</h3>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700">
                <Upload className="size-3.5" />
                {mediaSaving === "upload-certificate" ? "Uploading..." : "Upload Certificate"}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  disabled={Boolean(mediaSaving)}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    event.target.value = "";
                    void handleProviderMediaUpload("certificate", file);
                  }}
                />
              </label>
            </div>
            {detail.certificates?.length ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {detail.certificates.map((item) => (
                  <div key={item.id} className="overflow-hidden rounded-[20px] border border-slate-200 bg-white p-3">
                    <a href={item.previewUrl} target="_blank" rel="noreferrer" className="block transition hover:opacity-90">
                      <div className="relative aspect-[4/3] overflow-hidden rounded-[16px] bg-slate-100">
                        {isPdfAsset(item.previewUrl) ? (
                          <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center text-violet-700">
                            <span className="rounded-full border border-current px-3 py-1 text-[11px] font-extrabold">PDF</span>
                            <span className="text-[12px] font-semibold">{item.fileName}</span>
                          </div>
                        ) : (
                          <img src={item.previewUrl} alt={item.label} className="h-full w-full object-cover" />
                        )}
                      </div>
                    </a>
                    <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                        <p className="mt-1 text-[12px] text-slate-500">{item.fileName}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleProviderMediaDelete("certificate", item.id)}
                        disabled={Boolean(mediaSaving)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 disabled:opacity-60"
                      >
                        <Trash2 className="size-3.5" />
                        {mediaSaving === `delete-certificate-${item.id}` ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-[20px] border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
                No certificates are currently stored.
              </p>
            )}
          </div>

          <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-950">IC / Passport</h3>
                <p className="mt-1 text-[12px] text-slate-500">
                  {detail.identityDocuments?.length
                    ? `${detail.identityDocumentType} submitted ${detail.identitySubmittedAt ? `on ${detail.identitySubmittedAt}` : "for review"}.`
                    : "No identity image is currently stored for this provider."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <MiniStatus status={detail.identityVerificationStatus ?? "Pending"} />
                <button
                  type="button"
                  onClick={() => void handleIdentityVerification(detail.identityVerificationStatus !== "Verified")}
                  disabled={verifyingIdentity}
                  className="rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-700 disabled:opacity-60"
                >
                  {verifyingIdentity
                    ? "Saving..."
                    : detail.identityVerificationStatus === "Verified"
                      ? "Mark Pending"
                      : "Mark Verified"}
                </button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {(["front", "back"] as const).map((side) => (
                <label
                  key={side}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700"
                >
                  <Upload className="size-3.5" />
                  {identityDocumentSaving === `upload-${side}`
                    ? "Uploading..."
                    : `Upload ${side === "front" ? "Front" : "Back"}`}
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    disabled={Boolean(identityDocumentSaving)}
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      event.target.value = "";
                      void handleIdentityDocumentUpload(side, file);
                    }}
                  />
                </label>
              ))}
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {detail.identityDocuments?.length ? (
                detail.identityDocuments.map((document) => {
                  const side = document.id.includes("back") ? "back" : "front";

                  return (
                    <div
                      key={document.id}
                      className="overflow-hidden rounded-[20px] border border-slate-200 bg-white p-3"
                    >
                      <a
                        href={document.previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block transition hover:opacity-90"
                      >
                        <div className="relative aspect-[4/3] overflow-hidden rounded-[16px] bg-slate-100">
                          {isPdfAsset(document.previewUrl) ? (
                            <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center text-violet-700">
                              <span className="rounded-full border border-current px-3 py-1 text-[11px] font-extrabold">PDF</span>
                              <span className="text-[12px] font-semibold">{document.fileName}</span>
                            </div>
                          ) : (
                            <img src={document.previewUrl} alt={document.label} className="h-full w-full object-cover" />
                          )}
                        </div>
                      </a>
                      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{document.label}</p>
                          <p className="mt-1 text-[12px] text-slate-500">{document.fileName}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleIdentityDocumentDelete(side)}
                          disabled={Boolean(identityDocumentSaving)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 disabled:opacity-60"
                        >
                          <Trash2 className="size-3.5" />
                          {identityDocumentSaving === `delete-${side}` ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-[20px] border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500 md:col-span-2">
                  Upload front and back identity images to start review.
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-[24px] border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-bold text-slate-950">Approval Checklist</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {([
                ["profile", "Profile picture checked"],
                ["work", "Work images checked"],
                ["certificate", "Certificates checked"],
                ["identity", "IC / Passport checked"],
              ] as Array<[keyof typeof checklist, string]>).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-700"
                >
                  <span>{label}</span>
                  <input
                    type="checkbox"
                    checked={checklist[key as keyof typeof checklist]}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setChecklist((current) => ({ ...current, [key]: checked }));
                      if (key === "identity") {
                        void handleIdentityVerification(checked);
                      }
                    }}
                    className="size-5 accent-emerald-600"
                  />
                </label>
              ))}
            </div>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Admin approval note
              <textarea
                value={approvalNote}
                onChange={(event) => setApprovalNote(event.target.value)}
                placeholder="Add a note before approving this provider..."
                className="mt-2 min-h-[110px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-emerald-300"
              />
            </label>
            <div className="mt-4 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => void handleApproveProvider()}
                disabled={saving || verifyingIdentity || isProviderApproved || !allChecklistReady}
                className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
              >
                {isProviderApproved ? "Approved" : "Approve Provider"}
              </button>
              <button
                type="button"
                onClick={handleDeactivate}
                disabled={saving || !isProviderApproved}
                className="px-2 py-2 text-xs font-semibold text-rose-600 underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-slate-300 disabled:no-underline"
              >
                Disable provider
              </button>
            </div>
          </div>
        </SurfaceCard>
      ) : null}
    </div>
  );
}
