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
  TimerReset,
  Trash2,
  Upload,
  UserCircle2,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { InfoRow, MetricTile, MiniStatus, PillBadge, SurfaceCard, TableShell } from "../components/user-detail-ui";
import {
  deleteProviderIdentityDocument,
  getProviderProfileWithFallback,
  markCompanyPaymentReceived,
  setProviderIdentityVerified,
  setProviderSuspended,
  setProviderVisibility,
  updateProviderProfile,
  uploadProviderIdentityDocument,
} from "../lib/admin-providers";
import type { ProviderDetailRecord } from "../types";

const tabs = [
  "Overview",
  "Tasks",
  "Payments & Withdrawals",
  "Reviews",
  "Profile & Documents",
  "Service Areas",
  "Activity Log",
] as const;

type TabKey = (typeof tabs)[number];

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

export function ProviderProfilePage() {
  const { providerId = "" } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>("Overview");
  const [message, setMessage] = useState<string | null>(null);
  const [provider, setProvider] = useState<ProviderDetailRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifyingIdentity, setVerifyingIdentity] = useState(false);
  const [identityDocumentSaving, setIdentityDocumentSaving] = useState("");
  const [receivingPaymentId, setReceivingPaymentId] = useState("");
  const [receivedAmounts, setReceivedAmounts] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    serviceArea: "",
    about: "",
  });

  useEffect(() => {
    let active = true;

    setActiveTab("Overview");
    setMessage(null);
    setLoading(true);
    setProvider(null);
    setForm({
      name: "",
      email: "",
      phone: "",
      serviceArea: "",
      about: "",
    });

    async function loadProvider() {
      try {
        const payload = await getProviderProfileWithFallback(providerId);

        if (!active) {
          return;
        }

        setProvider(payload.detail);
        setForm({
          name: payload.detail?.name ?? "",
          email: payload.detail?.email ?? "",
          phone: payload.detail?.phone ?? "",
          serviceArea: payload.detail?.serviceArea ?? "",
          about: payload.detail?.about ?? "",
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

  function flash(nextMessage: string) {
    setMessage(nextMessage);
  }

  async function reloadProviderDetails() {
    const payload = await getProviderProfileWithFallback(providerId);
    setProvider(payload.detail);
    if (payload.detail) {
      setForm({
        name: payload.detail.name,
        email: payload.detail.email,
        phone: payload.detail.phone,
        serviceArea: payload.detail.serviceArea,
        about: payload.detail.about,
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

  async function handleSaveProfile() {
    if (saving) {
      return;
    }

    setSaving(true);
    const result = await updateProviderProfile(detail.providerId, {
      full_name: form.name,
      email: form.email,
      phone: form.phone,
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

    const confirmed = window.confirm("Deactivate this provider?");
    if (!confirmed) {
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
    flash("Provider deactivated.");
    window.setTimeout(() => {
      navigate("/service-providers");
    }, 500);
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
    const result = await setProviderIdentityVerified(detail.providerId, verified);
    setVerifyingIdentity(false);

    if (result.error) {
      flash(result.error);
      return;
    }

    setProvider((current) =>
      current
        ? {
            ...current,
            kycStatus: verified ? "Verified" : "Pending",
            identityVerificationStatus: verified ? "Verified" : current.identityDocuments?.length ? "Processing" : "Pending",
            documents: current.documents.map((document) =>
              document.label === "Identity Verification"
                ? {
                    ...document,
                    status: verified ? "Verified" : current.identityDocuments?.length ? "Processing" : "Pending",
                  }
                : document,
            ),
          }
        : current,
    );
    flash(verified ? "Identity documents verified." : "Identity status changed back to pending.");
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

    await reloadProviderDetails();
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

    await reloadProviderDetails();
    flash(`${side === "front" ? "Front" : "Back"} identity image deleted. Status changed to pending review.`);
  }

  function renderOverview() {
    return (
      <>
        <section className="grid gap-4 xl:grid-cols-[1.03fr_0.95fr_0.78fr_1fr]">
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
              <InfoRow label="Date of Birth" value={detail.dob} icon={<CalendarDays className="size-4" />} />
              <InfoRow label="Gender" value={detail.gender} icon={<ShieldCheck className="size-4" />} />
              <InfoRow label="Language" value={detail.language} icon={<Languages className="size-4" />} />
              <InfoRow label="NRIC / ID Number" value={detail.nationalId} icon={<FileBadge2 className="size-4" />} />
              <InfoRow label="Emergency Contact" value={detail.emergencyContact} icon={<Phone className="size-4" />} />
              <InfoRow label="Address" value={<span className="whitespace-pre-line">{detail.address}</span>} icon={<MapPin className="size-4" />} />
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

            <SurfaceCard title="Quick Summary">
              <div className="grid gap-4 sm:grid-cols-2">
                <SummaryMetric label="Average Rating" value={detail.averageRating} />
                <SummaryMetric label="Total Reviews" value={detail.totalReviews} />
                <SummaryMetric label="On-time Rate" value={detail.onTimeRate} />
                <SummaryMetric label="Repeat Customers" value={detail.repeatCustomers} />
              </div>
            </SurfaceCard>
          </div>

          <div className="space-y-4">
            <SurfaceCard title="Provider Status" className="h-full">
              <div className="space-y-4 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500">Account Status</span>
                  <MiniStatus status={detail.status} />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500">Approval Status</span>
                  <MiniStatus status={detail.approvalStatus} />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500">Background Check</span>
                  <MiniStatus status={detail.backgroundCheck} />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500">KYC Status</span>
                  <MiniStatus status={detail.kycStatus} />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500">Member Since</span>
                  <span className="font-medium text-slate-900">{detail.memberSince}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500">Last Login</span>
                  <span className="font-medium text-slate-900">{detail.lastLogin}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500">Device</span>
                  <span className="font-medium text-slate-900">{detail.device}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500">Completed Jobs</span>
                  <span className="font-medium text-slate-900">{detail.completedJobs}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500">Cancellation Rate</span>
                  <span className="font-medium text-slate-900">{detail.cancellationRate}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500">Response Rate</span>
                  <span className="font-medium text-slate-900">{detail.responseRate}</span>
                </div>
              </div>
            </SurfaceCard>
          </div>

          <div className="space-y-4">
            <SurfaceCard title="About Provider">
              {editing ? (
                <textarea
                  value={form.about}
                  onChange={(event) => setForm((current) => ({ ...current, about: event.target.value }))}
                  className="min-h-[132px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                />
              ) : (
                <p className="text-sm leading-7 text-slate-600">{detail.about}</p>
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
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-base font-bold text-slate-950">Documents</h4>
                  <button className="text-xs font-semibold text-emerald-700">View all</button>
                </div>
                <div className="mt-4 space-y-3">
                  {detail.documents.map((document) => (
                    <div key={document.id} className="flex items-center justify-between gap-3 text-sm">
                      <div className="flex items-center gap-3 text-slate-700">
                        <FileText className="size-4 text-slate-400" />
                        <div>
                          <span>{document.label}</span>
                          {document.note ? (
                            <p className="mt-1 text-[11px] text-slate-400">{document.note}</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-emerald-700">
                        <CheckCircle2 className="size-4" />
                        <span className="text-xs font-semibold">{document.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </SurfaceCard>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <SurfaceCard title="Availability">
            <div className="grid gap-4 sm:grid-cols-2">
              <SummaryMetric label="Working Days" value={detail.workingDays} />
              <SummaryMetric label="Working Hours" value={detail.workingHours} />
            </div>
          </SurfaceCard>

          <SurfaceCard title="Recent Actions">
            <div className="space-y-3">
              {detail.recentActions.map((action) => (
                <div key={action.id} className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <TimerReset className="size-4 text-slate-400" />
                    <span>{action.label}</span>
                  </div>
                  <span className="text-[12px] text-slate-400">{action.time}</span>
                </div>
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard title="Activity Log">
            <div className="space-y-4">
              {detail.activityLog.map((item) => (
                <div key={item.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-1 text-[13px] text-slate-500">{item.note}</p>
                  <p className="mt-2 text-[12px] text-slate-400">{item.time}</p>
                </div>
              ))}
            </div>
          </SurfaceCard>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <TableShell title="Completed Tasks" action={<button className="text-xs font-semibold text-emerald-700">View all</button>}>
            <table className="min-w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400">
                  <th className="pb-3 font-semibold">Task ID</th>
                  <th className="pb-3 font-semibold">Service</th>
                  <th className="pb-3 font-semibold">Customer</th>
                  <th className="pb-3 font-semibold">Date</th>
                  <th className="pb-3 font-semibold">Amount</th>
                  <th className="pb-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {detail.completedTaskRows.map((task) => (
                  <tr key={task.id} className="border-b border-slate-50">
                    <td className="py-3 font-semibold text-emerald-700">{task.id}</td>
                    <td className="py-3">{task.service}</td>
                    <td className="py-3">{task.customer}</td>
                    <td className="py-3 text-slate-500">{task.date}</td>
                    <td className="py-3">{task.amount}</td>
                    <td className="py-3"><MiniStatus status={task.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>

          <TableShell title="Upcoming Tasks" action={<button className="text-xs font-semibold text-emerald-700">View all</button>}>
            <table className="min-w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400">
                  <th className="pb-3 font-semibold">Task ID</th>
                  <th className="pb-3 font-semibold">Service</th>
                  <th className="pb-3 font-semibold">Customer</th>
                  <th className="pb-3 font-semibold">Date & Time</th>
                  <th className="pb-3 font-semibold">Amount</th>
                  <th className="pb-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {detail.upcomingTaskRows.map((task) => (
                  <tr key={task.id} className="border-b border-slate-50">
                    <td className="py-3 font-semibold text-emerald-700">{task.id}</td>
                    <td className="py-3">{task.service}</td>
                    <td className="py-3">{task.customer}</td>
                    <td className="py-3 text-slate-500">{task.schedule}</td>
                    <td className="py-3">{task.amount}</td>
                    <td className="py-3"><MiniStatus status={task.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>

          <TableShell title="Payments & Withdrawals" action={<button className="text-xs font-semibold text-emerald-700">View all</button>}>
            <table className="min-w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400">
                  <th className="pb-3 font-semibold">ID</th>
                  <th className="pb-3 font-semibold">Type</th>
                  <th className="pb-3 font-semibold">Amount</th>
                  <th className="pb-3 font-semibold">Date</th>
                  <th className="pb-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {detail.payoutRows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-50">
                    <td className="py-3 font-semibold text-slate-700">{row.id}</td>
                    <td className="py-3">{row.type}</td>
                    <td className="py-3">{row.amount}</td>
                    <td className="py-3 text-slate-500">{row.date}</td>
                    <td className="py-3"><MiniStatus status={row.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
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
        ? renderSimpleRows(
            "All Tasks",
            ["Task ID", "Service", "Customer", "Date", "Amount", "Status"],
            [...detail.completedTaskRows, ...detail.upcomingTaskRows.map((task) => ({
              id: task.id,
              service: task.service,
              customer: task.customer,
              date: task.schedule,
              amount: task.amount,
              status: task.status,
            }))].map((task) => [task.id, task.service, task.customer, task.date, task.amount, task.status])
          )
        : null}
      {activeTab === "Payments & Withdrawals"
        ? (
            <div className="space-y-4">
              {renderSimpleRows(
                "Payments & Withdrawals",
                ["ID", "Type", "Amount", "Date", "Status"],
                detail.payoutRows.map((row) => [row.id, row.type, row.amount, row.date, row.status])
              )}
              <TableShell title="Company Commission Payments">
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
        ? renderSimpleRows(
            "Reviews",
            ["Metric", "Value"],
            [
              ["Average Rating", detail.averageRating],
              ["Total Reviews", detail.totalReviews],
              ["On-time Rate", detail.onTimeRate],
              ["Repeat Customers", detail.repeatCustomers],
            ]
          )
        : null}
      {activeTab === "Profile & Documents" ? (
        <SurfaceCard title="Profile & Documents">
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-4">
              <InfoRow label="Provider Name" value={detail.name} icon={<UserCircle2 className="size-4" />} />
              <InfoRow label="Service Type" value={detail.serviceType} icon={<BriefcaseBusiness className="size-4" />} />
              <InfoRow label="Email" value={detail.email} icon={<Mail className="size-4" />} />
              <InfoRow label="Phone" value={detail.phone} icon={<Phone className="size-4" />} />
            </div>
            <div className="space-y-3">
              {detail.documents.map((document) => (
                <div key={document.id} className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-4">
                  <div className="flex items-center gap-3 text-sm text-slate-700">
                    <FileText className="size-4 text-slate-400" />
                    <div>
                      <span>{document.label}</span>
                      {document.note ? (
                        <p className="mt-1 text-[11px] text-slate-400">{document.note}</p>
                      ) : null}
                    </div>
                  </div>
                  <MiniStatus status={document.status} />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-950">Identity Review</h3>
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
          {detail.profileImageUrl ? (
            <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
              <h3 className="text-sm font-bold text-slate-950">Profile Photo</h3>
              <a
                href={detail.profileImageUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 block max-w-[220px] overflow-hidden rounded-[20px] border border-slate-200 bg-white p-3"
              >
                <img src={detail.profileImageUrl} alt={`${detail.name} profile`} className="aspect-square w-full rounded-[16px] object-cover" />
              </a>
            </div>
          ) : null}
          {detail.workGallery?.length ? (
            <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
              <h3 className="text-sm font-bold text-slate-950">Work Images</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {detail.workGallery.map((item) => (
                  <a
                    key={item.id}
                    href={item.previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-[20px] border border-slate-200 bg-white p-3 transition hover:border-emerald-200"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden rounded-[16px] bg-slate-100">
                      <img src={item.previewUrl} alt={item.label} className="h-full w-full object-cover" />
                    </div>
                    <div className="mt-3">
                      <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                      <p className="mt-1 text-[12px] text-slate-500">{item.fileName}</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ) : null}
          {detail.certificates?.length ? (
            <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
              <h3 className="text-sm font-bold text-slate-950">Certificates</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {detail.certificates.map((item) => (
                  <a
                    key={item.id}
                    href={item.previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-[20px] border border-slate-200 bg-white p-3 transition hover:border-emerald-200"
                  >
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
                    <div className="mt-3">
                      <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                      <p className="mt-1 text-[12px] text-slate-500">{item.fileName}</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </SurfaceCard>
      ) : null}
      {activeTab === "Service Areas" ? (
        <SurfaceCard title="Service Areas">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {detail.serviceAreas.map((area) => (
              <div key={area.id} className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-700">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <MapPin className="size-4 text-slate-400" />
                    {area.label}
                  </span>
                  {area.tag ? (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                      {area.tag}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </SurfaceCard>
      ) : null}
      {activeTab === "Activity Log" ? (
        <SurfaceCard title="Activity Log">
          <div className="space-y-4">
            {detail.activityLog.map((item) => (
              <div key={item.id} className="rounded-2xl bg-slate-50 px-4 py-4">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="mt-1 text-[13px] text-slate-500">{item.note}</p>
                <p className="mt-2 text-[12px] text-slate-400">{item.time}</p>
              </div>
            ))}
          </div>
        </SurfaceCard>
      ) : null}
    </div>
  );
}
