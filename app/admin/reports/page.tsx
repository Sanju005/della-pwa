import { listIssueReports } from "@/lib/issue-reports-storage";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  const reports = await listIssueReports();

  return (
    <main className="min-h-screen bg-[#fbf8ff] px-5 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-[26px] border border-[#eadff8] bg-white p-6 shadow-[0_18px_38px_rgba(106,69,160,0.08)]">
          <h1 className="text-[1.8rem] font-extrabold tracking-[-0.04em] text-[#1f1630]">
            Reports
          </h1>
          <p className="mt-2 text-[14px] text-[#6d6480]">
            Booking issue reports submitted by users.
          </p>
        </div>

        <div className="mt-6 space-y-4">
          {reports.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-[#dcccf0] bg-white p-8 text-center text-[14px] text-[#6d6480]">
              No reports submitted yet.
            </div>
          ) : null}

          {reports.map((report) => (
            <section
              key={report.id}
              className="rounded-[24px] border border-[#eadff8] bg-white p-5 shadow-[0_14px_30px_rgba(106,69,160,0.06)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[1.1rem] font-bold text-[#1f1630]">
                    {report.bookingTitle}
                  </h2>
                  <p className="mt-1 text-[13px] text-[#6d6480]">
                    Booking ID: {report.bookingId}
                  </p>
                </div>
                <span className="rounded-full bg-[#fff3e8] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#d97706]">
                  {report.status}
                </span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <InfoRow label="Reporter" value={`${report.reporterName} (${report.reporterEmail || "No email"})`} />
                <InfoRow label="Provider" value={report.providerName} />
                <InfoRow label="Schedule" value={report.schedule} />
                <InfoRow label="Payment" value={`RM${report.paymentAmount} • ${report.paymentMethod}`} />
                <InfoRow label="Location" value={report.location} />
                <InfoRow label="Submitted" value={new Intl.DateTimeFormat("en-MY", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(report.createdAt))} />
              </div>

              <div className="mt-4 rounded-[18px] border border-[#efe6fb] bg-[#fcf9ff] p-4">
                <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#8E5EB5]">
                  Issue Report
                </p>
                <p className="mt-2 whitespace-pre-wrap text-[14px] leading-6 text-[#374151]">
                  {report.message}
                </p>
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] border border-[#efe6fb] bg-[#fcfbfe] px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#8E5EB5]">
        {label}
      </p>
      <p className="mt-1 text-[13px] leading-6 text-[#374151]">{value}</p>
    </div>
  );
}
