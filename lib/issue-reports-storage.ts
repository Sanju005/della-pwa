import "server-only";

export type IssueReportRecord = {
  id: string;
  createdAt: string;
  status: "new";
  bookingId: string;
  bookingTitle: string;
  providerName: string;
  schedule: string;
  location: string;
  paymentAmount: number;
  paymentMethod: string;
  reporterUserId: string;
  reporterEmail: string;
  reporterName: string;
  message: string;
};

async function ensureReportsFile() {
  const path = await import("node:path");
  const { mkdir, readFile, writeFile } = await import("node:fs/promises");
  const reportsFile = path.join(process.cwd(), "data", "issue-reports.json");
  const dataDir = path.dirname(reportsFile);

  await mkdir(dataDir, { recursive: true });

  try {
    await readFile(reportsFile, "utf8");
  } catch {
    await writeFile(reportsFile, "[]", "utf8");
  }
}

async function readReports() {
  const path = await import("node:path");
  const { readFile } = await import("node:fs/promises");
  const reportsFile = path.join(process.cwd(), "data", "issue-reports.json");

  await ensureReportsFile();
  const raw = await readFile(reportsFile, "utf8");
  return JSON.parse(raw) as IssueReportRecord[];
}

async function writeReports(records: IssueReportRecord[]) {
  const path = await import("node:path");
  const { writeFile } = await import("node:fs/promises");
  const reportsFile = path.join(process.cwd(), "data", "issue-reports.json");

  await ensureReportsFile();
  await writeFile(reportsFile, JSON.stringify(records, null, 2), "utf8");
}

export async function createIssueReport(
  payload: Omit<IssueReportRecord, "id" | "createdAt" | "status">,
) {
  const records = await readReports();
  const nextRecord: IssueReportRecord = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: "new",
    ...payload,
  };

  records.unshift(nextRecord);
  await writeReports(records);
  return nextRecord;
}

export async function listIssueReports() {
  return readReports();
}
