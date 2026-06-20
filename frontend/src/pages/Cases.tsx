import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Search,
  UploadCloud,
  XCircle,
} from "lucide-react";

import { EmptyState } from "../components/EmptyState";
import { MetricCard } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { commitUpload, getCase, getSummary, listCases, previewUpload } from "../lib/api";
import type { CaseListItem, CaseSummary, CaseUploadCommit, CaseUploadPreview, CasePreviewRow } from "../types";

const pageSize = 10;

const emptySummary: CaseSummary = {
  total_cases: 0,
  total_outstanding: 0,
  active_cases: 0,
  overdue_cases: 0,
  high_priority_cases: 0,
  missing_phone_cases: 0,
};

type AlertTone = "success" | "error" | "warning" | "info";

interface AlertState {
  tone: AlertTone;
  message: string;
}

function isSupportedUpload(file: File): boolean {
  return /\.(csv|xlsx)$/i.test(file.name);
}

function formatCurrency(value: number | string | null | undefined): string {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(amount)) {
    return "-";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return String(value);
}

function badgeTone(value: string | null | undefined): "blue" | "green" | "amber" | "red" | "slate" {
  const normalized = (value ?? "").toLowerCase();
  if (["high", "critical", "overdue"].includes(normalized)) {
    return "red";
  }
  if (["open", "active", "normal", "ready"].includes(normalized)) {
    return "green";
  }
  if (["medium", "pending", "in_progress"].includes(normalized)) {
    return "amber";
  }
  if (["low", "closed", "paid", "resolved"].includes(normalized)) {
    return "slate";
  }
  return "blue";
}

function AlertMessage({ alert }: { alert: AlertState }) {
  const toneClass: Record<AlertTone, string> = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    error: "border-rose-200 bg-rose-50 text-rose-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    info: "border-brand-100 bg-brand-50 text-brand-800",
  };
  const Icon = alert.tone === "success" ? CheckCircle2 : alert.tone === "error" ? XCircle : AlertCircle;

  return (
    <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${toneClass[alert.tone]}`}>
      <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{alert.message}</p>
    </div>
  );
}

function SummaryStrip({ summary, unavailable }: { summary: CaseSummary; unavailable: boolean }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        accent="blue"
        icon={Database}
        label="Total Cases"
        trend={unavailable ? "Backend unavailable" : "Saved in PostgreSQL"}
        value={unavailable ? "-" : String(summary.total_cases)}
      />
      <MetricCard
        accent="emerald"
        icon={CheckCircle2}
        label="Active Cases"
        trend="Open portfolio"
        value={unavailable ? "-" : String(summary.active_cases)}
      />
      <MetricCard
        accent="rose"
        icon={AlertCircle}
        label="High Priority"
        trend="Manager attention"
        value={unavailable ? "-" : String(summary.high_priority_cases)}
      />
      <MetricCard
        accent="violet"
        icon={FileSpreadsheet}
        label="Outstanding"
        trend="Total balance"
        value={unavailable ? "-" : formatCurrency(summary.total_outstanding)}
      />
    </section>
  );
}

function PreviewMetrics({ preview }: { preview: CaseUploadPreview }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard accent="blue" icon={FileSpreadsheet} label="Total Rows" trend="Rows parsed" value={String(preview.total_rows)} />
      <MetricCard accent="emerald" icon={CheckCircle2} label="Valid Rows" trend="Ready to commit" value={String(preview.valid_rows)} />
      <MetricCard accent="rose" icon={XCircle} label="Invalid Rows" trend="Skipped on commit" value={String(preview.invalid_rows)} />
      <MetricCard accent="amber" icon={AlertCircle} label="Duplicate Rows" trend="Duplicate references" value={String(preview.duplicate_rows)} />
    </section>
  );
}

function PreviewTable({ rows }: { rows: CasePreviewRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">
        No valid rows were found in this upload.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-soft">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Customer Name</th>
            <th className="px-4 py-3">Phone</th>
            <th className="px-4 py-3">Case Reference</th>
            <th className="px-4 py-3">Lender</th>
            <th className="px-4 py-3">Outstanding</th>
            <th className="px-4 py-3">DPD</th>
            <th className="px-4 py-3">Priority</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={`${row.row_number}-${row.case_reference ?? "row"}`}>
              <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-950">{displayValue(row.customer_name)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">{displayValue(row.phone_number)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">{displayValue(row.case_reference)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">{displayValue(row.lender_name)}</td>
              <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">{formatCurrency(row.outstanding_amount)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">{displayValue(row.dpd)}</td>
              <td className="whitespace-nowrap px-4 py-3">
                <StatusBadge label={displayValue(row.priority)} tone={badgeTone(row.priority)} />
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <StatusBadge label={displayValue(row.status)} tone={badgeTone(row.status)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ErrorsTable({ preview }: { preview: CaseUploadPreview }) {
  if (preview.errors.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
        No validation errors found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-soft">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Row Number</th>
            <th className="px-4 py-3">Field</th>
            <th className="px-4 py-3">Issue</th>
            <th className="px-4 py-3">Original Value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {preview.errors.map((error, index) => (
            <tr key={`${error.row_number}-${error.field}-${index}`}>
              <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-950">{error.row_number}</td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">{error.field}</td>
              <td className="min-w-[260px] px-4 py-3 text-slate-600">{error.issue}</td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">{displayValue(error.original_value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CommitResult({ result }: { result: CaseUploadCommit }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Commit Result</h2>
          <p className="mt-1 text-sm text-slate-500">{result.message}</p>
        </div>
        <StatusBadge label={`${result.saved_rows} saved`} tone={result.saved_rows > 0 ? "green" : "slate"} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Saved Rows", result.saved_rows],
          ["Skipped Rows", result.skipped_rows],
          ["Invalid Rows", result.invalid_rows],
          ["Duplicate Rows", result.duplicate_rows],
        ].map(([label, value]) => (
          <div className="border-t border-slate-200 pt-3" key={label}>
            <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-semibold text-slate-950">{value}</p>
          </div>
        ))}
      </div>

      {result.existing_case_references.length > 0 ? (
        <div className="mt-5 border-t border-slate-200 pt-4">
          <p className="text-sm font-semibold text-slate-950">Existing Case References</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {result.existing_case_references.map((reference) => (
              <StatusBadge key={reference} label={reference} tone="amber" />
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function CasesTable({
  cases,
  loading,
}: {
  cases: CaseListItem[];
  loading: boolean;
}) {
  if (!loading && cases.length === 0) {
    return (
      <EmptyState
        description="Uploaded and committed cases will appear here."
        icon={Database}
        title="No saved cases found"
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-soft">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Customer Name</th>
            <th className="px-4 py-3">Phone</th>
            <th className="px-4 py-3">Case Reference</th>
            <th className="px-4 py-3">Lender</th>
            <th className="px-4 py-3">Outstanding Amount</th>
            <th className="px-4 py-3">DPD</th>
            <th className="px-4 py-3">Priority</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Assigned Agent</th>
            <th className="px-4 py-3">Created At</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? (
            <tr>
              <td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={10}>
                <span className="inline-flex items-center gap-2">
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  Loading cases
                </span>
              </td>
            </tr>
          ) : (
            cases.map((item) => (
              <tr key={item.id}>
                <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-950">{item.customer_name}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{displayValue(item.phone_number)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{displayValue(item.case_reference)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{displayValue(item.lender_name)}</td>
                <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">{formatCurrency(item.outstanding_amount)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{displayValue(item.dpd)}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusBadge label={displayValue(item.priority)} tone={badgeTone(item.priority)} />
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusBadge label={displayValue(item.status)} tone={badgeTone(item.status)} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{displayValue(item.assigned_agent)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(item.created_at)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Cases() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewResult, setPreviewResult] = useState<CaseUploadPreview | null>(null);
  const [commitResult, setCommitResult] = useState<CaseUploadCommit | null>(null);
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [commitLoading, setCommitLoading] = useState(false);

  const [summary, setSummary] = useState<CaseSummary>(emptySummary);
  const [summaryUnavailable, setSummaryUnavailable] = useState(false);
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [totalCases, setTotalCases] = useState(0);
  const [casesLoading, setCasesLoading] = useState(false);
  const [casesError, setCasesError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [lenderFilter, setLenderFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("");

  const validPreviewRows = useMemo(
    () => previewResult?.preview_data.filter((row) => row.is_valid) ?? [],
    [previewResult],
  );
  const totalPages = Math.max(1, Math.ceil(totalCases / pageSize));

  const refreshSummary = useCallback(async () => {
    try {
      const payload = await getSummary();
      setSummary(payload);
      setSummaryUnavailable(false);
    } catch {
      setSummary(emptySummary);
      setSummaryUnavailable(true);
    }
  }, []);

  const refreshCases = useCallback(async () => {
    setCasesLoading(true);
    setCasesError(null);

    try {
      const payload = await listCases({
        page,
        page_size: pageSize,
        search,
        status: statusFilter,
        priority: priorityFilter,
        lender_name: lenderFilter,
        assigned_agent: agentFilter,
      });
      const enrichedItems = await Promise.all(
        payload.items.map(async (item) => {
          if (item.created_at) {
            return item;
          }

          try {
            const detail = await getCase(item.id);
            return { ...item, created_at: detail.created_at };
          } catch {
            return item;
          }
        }),
      );
      setCases(enrichedItems);
      setTotalCases(payload.total);
    } catch (error) {
      setCases([]);
      setTotalCases(0);
      setCasesError(error instanceof Error ? error.message : "Unable to load cases.");
    } finally {
      setCasesLoading(false);
    }
  }, [agentFilter, lenderFilter, page, priorityFilter, search, statusFilter]);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshSummary(), refreshCases()]);
  }, [refreshCases, refreshSummary]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  function handleFile(file: File | null) {
    setAlert(null);
    setPreviewResult(null);
    setCommitResult(null);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!isSupportedUpload(file)) {
      setSelectedFile(null);
      setAlert({ tone: "error", message: "Upload a CSV or XLSX file." });
      return;
    }

    setSelectedFile(file);
  }

  async function handlePreview() {
    if (!selectedFile) {
      setAlert({ tone: "warning", message: "Select a CSV or XLSX file first." });
      return;
    }

    if (!isSupportedUpload(selectedFile)) {
      setAlert({ tone: "error", message: "Unsupported file type. Use CSV or XLSX." });
      return;
    }

    setPreviewLoading(true);
    setAlert(null);
    setCommitResult(null);

    try {
      const result = await previewUpload(selectedFile);
      setPreviewResult(result);
      setAlert({
        tone: result.invalid_rows > 0 ? "warning" : "success",
        message: `Preview complete: ${result.valid_rows} valid row(s), ${result.invalid_rows} invalid row(s).`,
      });
    } catch (error) {
      setPreviewResult(null);
      setAlert({ tone: "error", message: error instanceof Error ? error.message : "Preview failed." });
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleCommit() {
    if (!selectedFile) {
      setAlert({ tone: "warning", message: "Select a CSV or XLSX file first." });
      return;
    }

    setCommitLoading(true);
    setAlert(null);

    try {
      const result = await commitUpload(selectedFile);
      setCommitResult(result);
      setAlert({
        tone: result.saved_rows > 0 ? "success" : "info",
        message: result.message,
      });
      await refreshAll();
    } catch (error) {
      setCommitResult(null);
      setAlert({ tone: "error", message: error instanceof Error ? error.message : "Commit failed." });
    } finally {
      setCommitLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Upload, validate, and manage collection cases"
        eyebrow="Portfolio"
        title="Cases"
      />

      <SummaryStrip summary={summary} unavailable={summaryUnavailable} />

      {alert ? <AlertMessage alert={alert} /> : null}

      <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Case Upload</h2>
            <p className="mt-1 text-sm text-slate-500">CSV and XLSX files are validated before commit.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={casesLoading}
              onClick={() => void refreshAll()}
              type="button"
            >
              <RefreshCw aria-hidden="true" className={`h-4 w-4 ${casesLoading ? "animate-spin" : ""}`} />
              Refresh Cases
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_auto]">
          <label
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center transition hover:border-brand-300 hover:bg-brand-50"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              handleFile(event.dataTransfer.files.item(0));
            }}
          >
            <UploadCloud aria-hidden="true" className="h-8 w-8 text-brand-700" />
            <span className="mt-3 text-sm font-semibold text-slate-950">
              {selectedFile ? selectedFile.name : "Choose or drop a CSV/XLSX file"}
            </span>
            <span className="mt-1 text-xs text-slate-500">
              {selectedFile ? `${Math.max(1, Math.round(selectedFile.size / 1024))} KB selected` : "CSV or XLSX"}
            </span>
            <input
              accept=".csv,.xlsx"
              className="sr-only"
              onChange={(event) => handleFile(event.target.files?.item(0) ?? null)}
              type="file"
            />
          </label>

          <div className="flex min-w-[220px] flex-col gap-2">
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={previewLoading || !selectedFile}
              onClick={() => void handlePreview()}
              type="button"
            >
              {previewLoading ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <FileSpreadsheet aria-hidden="true" className="h-4 w-4" />}
              Preview Upload
            </button>

            {previewResult ? (
              <button
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={commitLoading || !selectedFile}
                onClick={() => void handleCommit()}
                type="button"
              >
                {commitLoading ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <CheckCircle2 aria-hidden="true" className="h-4 w-4" />}
                Commit Valid Rows
              </button>
            ) : null}
          </div>
        </div>
      </article>

      {previewResult ? (
        <section className="space-y-4">
          <PreviewMetrics preview={previewResult} />

          {commitResult ? <CommitResult result={commitResult} /> : null}

          <div>
            <h2 className="mb-3 text-base font-semibold text-slate-950">Validation Errors</h2>
            <ErrorsTable preview={previewResult} />
          </div>

          <div>
            <h2 className="mb-3 text-base font-semibold text-slate-950">Valid Preview Rows</h2>
            <PreviewTable rows={validPreviewRows} />
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Saved Cases</h2>
              <p className="mt-1 text-sm text-slate-500">{totalCases} case record(s)</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[220px_150px_150px_180px_180px]">
              <label className="relative block">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  onChange={(event) => {
                    setPage(1);
                    setSearch(event.target.value);
                  }}
                  placeholder="Search cases"
                  type="search"
                  value={search}
                />
              </label>

              <select
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                onChange={(event) => {
                  setPage(1);
                  setStatusFilter(event.target.value);
                }}
                value={statusFilter}
              >
                <option value="">All statuses</option>
                <option value="open">Open</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
                <option value="paid">Paid</option>
              </select>

              <select
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                onChange={(event) => {
                  setPage(1);
                  setPriorityFilter(event.target.value);
                }}
                value={priorityFilter}
              >
                <option value="">All priorities</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>

              <input
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                onChange={(event) => {
                  setPage(1);
                  setLenderFilter(event.target.value);
                }}
                placeholder="Lender"
                type="search"
                value={lenderFilter}
              />

              <input
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                onChange={(event) => {
                  setPage(1);
                  setAgentFilter(event.target.value);
                }}
                placeholder="Assigned agent"
                type="search"
                value={agentFilter}
              />
            </div>
          </div>
        </div>

        {casesError ? <AlertMessage alert={{ tone: "error", message: casesError }} /> : null}

        <CasesTable cases={cases} loading={casesLoading} />

        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-soft sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Page <span className="font-semibold text-slate-950">{page}</span> of{" "}
            <span className="font-semibold text-slate-950">{totalPages}</span>
          </p>
          <div className="flex gap-2">
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={page <= 1 || casesLoading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              type="button"
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
              Previous
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={page >= totalPages || casesLoading}
              onClick={() => setPage((current) => current + 1)}
              type="button"
            >
              Next
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
