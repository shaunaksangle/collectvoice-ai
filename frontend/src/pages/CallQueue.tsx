import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Ban,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Loader2,
  ListChecks,
  PhoneCall,
  RefreshCw,
  Search,
  Send,
  Timer,
  X,
  XCircle,
} from "lucide-react";

import { EmptyState } from "../components/EmptyState";
import { MetricCard } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { callQueueApi } from "../lib/api";
import type {
  CallAttempt,
  CallAttemptStatus,
  CallQueueGenerateResponse,
  CallQueueSummary,
} from "../types";

const pageSize = 10;

const emptySummary: CallQueueSummary = {
  total_queue_items: 0,
  pending_calls: 0,
  scheduled_calls: 0,
  in_progress_calls: 0,
  completed_calls: 0,
  failed_calls: 0,
  cancelled_calls: 0,
};

const queueStatusOptions: CallAttemptStatus[] = [
  "pending",
  "scheduled",
  "in_progress",
  "completed",
  "failed",
  "skipped",
  "cancelled",
];

const priorityOptions = ["high", "medium", "normal", "low", "critical"];

type AlertTone = "success" | "error" | "warning" | "info";

interface AlertState {
  tone: AlertTone;
  message: string;
}

function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function labelize(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return String(value);
}

function toApiDateTime(value: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

function formatDateTime(value: string | null | undefined): string {
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
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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

function statusTone(status: string | null | undefined): "blue" | "green" | "amber" | "red" | "slate" {
  switch ((status ?? "").toLowerCase()) {
    case "scheduled":
    case "in_progress":
      return "blue";
    case "completed":
    case "active":
    case "paid":
      return "green";
    case "pending":
    case "medium":
      return "amber";
    case "failed":
    case "high":
    case "critical":
      return "red";
    case "cancelled":
    case "skipped":
    case "low":
    case "closed":
      return "slate";
    default:
      return "blue";
  }
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

function FieldLabel({ children }: { children: string }) {
  return <span className="text-xs font-semibold uppercase text-slate-500">{children}</span>;
}

function ActionIconButton({
  children,
  disabled,
  label,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-45"
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function SummaryCards({ summary, unavailable }: { summary: CallQueueSummary; unavailable: boolean }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-7">
      <MetricCard
        accent="blue"
        icon={ListChecks}
        label="Total Queue Items"
        trend={unavailable ? "Backend unavailable" : "Prepared call attempts"}
        value={unavailable ? "-" : String(summary.total_queue_items)}
      />
      <MetricCard
        accent="amber"
        icon={Clock3}
        label="Pending"
        trend="Waiting to schedule"
        value={unavailable ? "-" : String(summary.pending_calls)}
      />
      <MetricCard
        accent="blue"
        icon={CalendarClock}
        label="Scheduled"
        trend="Ready for future worker"
        value={unavailable ? "-" : String(summary.scheduled_calls)}
      />
      <MetricCard
        accent="violet"
        icon={PhoneCall}
        label="In Progress"
        trend="No execution yet"
        value={unavailable ? "-" : String(summary.in_progress_calls)}
      />
      <MetricCard
        accent="emerald"
        icon={CheckCircle2}
        label="Completed"
        trend="Future outcomes"
        value={unavailable ? "-" : String(summary.completed_calls)}
      />
      <MetricCard
        accent="rose"
        icon={AlertCircle}
        label="Failed"
        trend="Needs review"
        value={unavailable ? "-" : String(summary.failed_calls)}
      />
      <MetricCard
        accent="rose"
        icon={Ban}
        label="Cancelled"
        trend="Stopped attempts"
        value={unavailable ? "-" : String(summary.cancelled_calls)}
      />
    </section>
  );
}

function GenerateResult({ result }: { result: CallQueueGenerateResponse }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Generation Result</h2>
          <p className="mt-1 text-sm text-slate-500">Campaign {result.campaign_id}</p>
        </div>
        <StatusBadge label={`${result.created_count} created`} tone={result.created_count > 0 ? "green" : "slate"} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Campaign Cases", result.total_campaign_cases],
          ["Created", result.created_count],
          ["Duplicate Skips", result.skipped_duplicate_count],
          ["Missing Phone", result.skipped_missing_phone_count],
        ].map(([label, value]) => (
          <div className="border-t border-slate-200 pt-3" key={label}>
            <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-semibold text-slate-950">{value}</p>
          </div>
        ))}
      </div>

      {result.created_call_attempt_ids.length > 0 ? (
        <div className="mt-5 border-t border-slate-200 pt-4">
          <p className="text-sm font-semibold text-slate-950">Created Call Attempt IDs</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {result.created_call_attempt_ids.map((id) => (
              <StatusBadge key={id} label={id} tone="blue" />
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function QueueTable({
  actionLoading,
  items,
  loading,
  onCancel,
  onSchedule,
  onView,
}: {
  actionLoading: string | null;
  items: CallAttempt[];
  loading: boolean;
  onCancel: (attempt: CallAttempt) => void;
  onSchedule: (attempt: CallAttempt) => void;
  onView: (attempt: CallAttempt) => void;
}) {
  if (!loading && items.length === 0) {
    return (
      <EmptyState
        description="Generate queue items from a campaign to prepare future AI call attempts."
        icon={ListChecks}
        title="No call attempts found"
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
            <th className="px-4 py-3">Campaign</th>
            <th className="px-4 py-3">Case Reference</th>
            <th className="px-4 py-3">Lender</th>
            <th className="px-4 py-3">Outstanding Amount</th>
            <th className="px-4 py-3">Priority</th>
            <th className="px-4 py-3">Assigned Agent</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Scheduled At</th>
            <th className="px-4 py-3">Attempt Number</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? (
            <tr>
              <td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={12}>
                <span className="inline-flex items-center gap-2">
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  Loading queue
                </span>
              </td>
            </tr>
          ) : (
            items.map((item) => {
              const isTerminal = ["completed", "failed", "cancelled", "skipped"].includes(item.status);
              const scheduleLoading = actionLoading === `${item.id}:schedule`;
              const cancelLoading = actionLoading === `${item.id}:cancel`;

              return (
                <tr key={item.id}>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-950">{item.customer_name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{displayValue(item.phone_number)}</td>
                  <td className="min-w-[180px] px-4 py-3 text-slate-600">{displayValue(item.campaign_name)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{displayValue(item.case_reference)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{displayValue(item.lender_name)}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">{formatCurrency(item.outstanding_amount)}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge label={labelize(item.priority)} tone={statusTone(item.priority)} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{displayValue(item.assigned_agent)}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge label={labelize(item.status)} tone={statusTone(item.status)} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDateTime(item.scheduled_at)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{item.attempt_number}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ActionIconButton label="View details" onClick={() => onView(item)}>
                        <Eye aria-hidden="true" className="h-4 w-4" />
                      </ActionIconButton>
                      <ActionIconButton
                        disabled={isTerminal || scheduleLoading}
                        label="Mark scheduled"
                        onClick={() => onSchedule(item)}
                      >
                        {scheduleLoading ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <CalendarClock aria-hidden="true" className="h-4 w-4" />}
                      </ActionIconButton>
                      <ActionIconButton
                        disabled={!["pending", "scheduled"].includes(item.status) || cancelLoading}
                        label="Cancel"
                        onClick={() => onCancel(item)}
                      >
                        {cancelLoading ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Ban aria-hidden="true" className="h-4 w-4" />}
                      </ActionIconButton>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function DetailPanel({
  attempt,
  detailError,
  loading,
  onClose,
}: {
  attempt: CallAttempt | null;
  detailError: string | null;
  loading: boolean;
  onClose: () => void;
}) {
  const details = attempt
    ? [
        ["Call Attempt ID", attempt.id],
        ["Customer Name", attempt.customer_name],
        ["Phone Number", attempt.phone_number],
        ["Campaign Name", attempt.campaign_name],
        ["Case Reference", attempt.case_reference],
        ["Outstanding Amount", formatCurrency(attempt.outstanding_amount)],
        ["Status", labelize(attempt.status)],
        ["Scheduled At", formatDateTime(attempt.scheduled_at)],
        ["Started At", formatDateTime(attempt.started_at)],
        ["Ended At", formatDateTime(attempt.ended_at)],
        ["Provider Call ID", attempt.provider_call_id],
        ["Failure Reason", attempt.failure_reason],
        ["Last Error", attempt.last_error],
      ]
    : [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/30 p-3 sm:p-6" role="dialog" aria-modal="true">
      <article className="ml-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-brand-700">Call Queue Details</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">{attempt?.customer_name ?? "Loading call attempt"}</h2>
            <p className="mt-1 text-sm text-slate-500">{attempt?.campaign_name ?? "Review queue state before future calling."}</p>
          </div>
          <button
            aria-label="Close call queue details"
            className="inline-flex h-9 w-9 items-center justify-center self-end rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 sm:self-start"
            onClick={onClose}
            title="Close"
            type="button"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="flex min-h-80 items-center justify-center text-sm text-slate-500">
              <span className="inline-flex items-center gap-2">
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                Loading call attempt
              </span>
            </div>
          ) : detailError ? (
            <AlertMessage alert={{ tone: "error", message: detailError }} />
          ) : attempt ? (
            <div className="space-y-6">
              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">Status</p>
                  <div className="mt-2">
                    <StatusBadge label={labelize(attempt.status)} tone={statusTone(attempt.status)} />
                  </div>
                </article>
                <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">Priority</p>
                  <div className="mt-2">
                    <StatusBadge label={labelize(attempt.priority)} tone={statusTone(attempt.priority)} />
                  </div>
                </article>
                <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">Attempt Number</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">{attempt.attempt_number}</p>
                </article>
              </section>

              <section className="grid gap-4 sm:grid-cols-2">
                {details.map(([label, value]) => (
                  <div className="border-t border-slate-200 pt-3" key={label}>
                    <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
                    <p className="mt-1 break-words text-sm font-medium text-slate-800">{displayValue(value)}</p>
                  </div>
                ))}
              </section>
            </div>
          ) : null}
        </div>
      </article>
    </div>
  );
}

function ScheduleModal({
  loading,
  scheduledAt,
  selected,
  onClose,
  onSubmit,
  onValue,
}: {
  loading: boolean;
  scheduledAt: string;
  selected: CallAttempt;
  onClose: () => void;
  onSubmit: () => void;
  onValue: (value: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4" role="dialog" aria-modal="true">
      <article className="w-full max-w-lg rounded-lg bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-brand-700">Schedule Attempt</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">{selected.customer_name}</h2>
            <p className="mt-1 text-sm text-slate-500">{displayValue(selected.case_reference)}</p>
          </div>
          <button
            aria-label="Close schedule modal"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
            onClick={onClose}
            title="Close"
            type="button"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <label className="mt-5 block space-y-2">
          <FieldLabel>Scheduled At</FieldLabel>
          <input
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            onChange={(event) => onValue(event.target.value)}
            type="datetime-local"
            value={scheduledAt}
          />
        </label>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
            onClick={onSubmit}
            type="button"
          >
            {loading ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <CalendarClock aria-hidden="true" className="h-4 w-4" />}
            Mark Scheduled
          </button>
        </div>
      </article>
    </div>
  );
}

export function CallQueue() {
  const [summary, setSummary] = useState<CallQueueSummary>(emptySummary);
  const [summaryUnavailable, setSummaryUnavailable] = useState(false);
  const [queueItems, setQueueItems] = useState<CallAttempt[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [alert, setAlert] = useState<AlertState | null>(null);

  const [campaignId, setCampaignId] = useState("");
  const [generateScheduledAt, setGenerateScheduledAt] = useState("");
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateResult, setGenerateResult] = useState<CallQueueGenerateResponse | null>(null);

  const [page, setPage] = useState(1);
  const [campaignFilter, setCampaignFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [lenderFilter, setLenderFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [selectedAttempt, setSelectedAttempt] = useState<CallAttempt | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [scheduleAttempt, setScheduleAttempt] = useState<CallAttempt | null>(null);
  const [scheduleValue, setScheduleValue] = useState("");

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const refreshSummary = useCallback(async () => {
    try {
      const payload = await callQueueApi.getSummary();
      setSummary(payload);
      setSummaryUnavailable(false);
    } catch {
      setSummary(emptySummary);
      setSummaryUnavailable(true);
    }
  }, []);

  const refreshQueue = useCallback(async () => {
    setQueueLoading(true);
    setQueueError(null);

    try {
      const payload = await callQueueApi.listCallQueue({
        page,
        page_size: pageSize,
        campaign_id: campaignFilter,
        status: statusFilter,
        priority: priorityFilter,
        lender_name: lenderFilter,
        assigned_agent: agentFilter,
      });
      setQueueItems(payload.items);
      setTotalItems(payload.total);
    } catch (error) {
      setQueueItems([]);
      setTotalItems(0);
      setQueueError(error instanceof Error ? error.message : "Unable to load call queue.");
    } finally {
      setQueueLoading(false);
    }
  }, [agentFilter, campaignFilter, lenderFilter, page, priorityFilter, statusFilter]);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshSummary(), refreshQueue()]);
  }, [refreshQueue, refreshSummary]);

  const loadAttemptDetail = useCallback(async (attemptId: string) => {
    setDetailLoading(true);
    setDetailError(null);

    try {
      const detail = await callQueueApi.getCallAttempt(attemptId);
      setSelectedAttempt(detail);
    } catch (error) {
      setSelectedAttempt(null);
      setDetailError(error instanceof Error ? error.message : "Unable to load call attempt details.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const selectedTitle = useMemo(
    () => queueItems.find((item) => item.id === selectedAttemptId)?.customer_name ?? selectedAttempt?.customer_name ?? null,
    [queueItems, selectedAttempt, selectedAttemptId],
  );

  async function handleGenerateQueue() {
    const cleanedCampaignId = optionalText(campaignId);
    if (!cleanedCampaignId) {
      setAlert({ tone: "warning", message: "Enter a campaign ID before generating queue items." });
      return;
    }

    const scheduledAt = toApiDateTime(generateScheduledAt);
    if (generateScheduledAt && !scheduledAt) {
      setAlert({ tone: "warning", message: "Select a valid scheduled date and time." });
      return;
    }

    setGenerateLoading(true);
    setAlert(null);
    setGenerateResult(null);

    try {
      const result = await callQueueApi.generateFromCampaign(cleanedCampaignId, {
        scheduled_at: scheduledAt,
      });
      setGenerateResult(result);
      setAlert({
        tone: result.created_count > 0 ? "success" : "info",
        message: `Queue generated: ${result.created_count} created, ${result.skipped_duplicate_count} duplicate(s) skipped.`,
      });
      setCampaignFilter(cleanedCampaignId);
      setPage(1);
      await refreshAll();
    } catch (error) {
      setAlert({ tone: "error", message: error instanceof Error ? error.message : "Unable to generate call queue." });
    } finally {
      setGenerateLoading(false);
    }
  }

  function handleView(attempt: CallAttempt) {
    setSelectedAttemptId(attempt.id);
    setSelectedAttempt(null);
    void loadAttemptDetail(attempt.id);
  }

  function openScheduleModal(attempt: CallAttempt) {
    setScheduleAttempt(attempt);
    setScheduleValue("");
  }

  async function handleScheduleAttempt() {
    if (!scheduleAttempt) {
      return;
    }

    const scheduledAt = toApiDateTime(scheduleValue);
    if (!scheduledAt) {
      setAlert({ tone: "warning", message: "Select a valid scheduled date and time." });
      return;
    }

    setActionLoading(`${scheduleAttempt.id}:schedule`);
    setAlert(null);

    try {
      const updated = await callQueueApi.updateCallAttempt(scheduleAttempt.id, {
        status: "scheduled",
        scheduled_at: scheduledAt,
      });
      setAlert({ tone: "success", message: `${updated.customer_name} marked scheduled.` });
      setScheduleAttempt(null);
      setScheduleValue("");
      await refreshAll();
      if (selectedAttemptId === scheduleAttempt.id) {
        await loadAttemptDetail(scheduleAttempt.id);
      }
    } catch (error) {
      setAlert({ tone: "error", message: error instanceof Error ? error.message : "Unable to schedule call attempt." });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancelAttempt(attempt: CallAttempt) {
    setActionLoading(`${attempt.id}:cancel`);
    setAlert(null);

    try {
      const cancelled = await callQueueApi.cancelCallAttempt(attempt.id);
      setAlert({ tone: "success", message: `${cancelled.customer_name} call attempt cancelled.` });
      await refreshAll();
      if (selectedAttemptId === attempt.id) {
        await loadAttemptDetail(attempt.id);
      }
    } catch (error) {
      setAlert({ tone: "error", message: error instanceof Error ? error.message : "Unable to cancel call attempt." });
    } finally {
      setActionLoading(null);
    }
  }

  function closeDetails() {
    setSelectedAttemptId(null);
    setSelectedAttempt(null);
    setDetailError(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Prepare and manage scheduled AI call attempts"
        eyebrow="Execution"
        title="Call Queue"
      />

      <SummaryCards summary={summary} unavailable={summaryUnavailable} />

      {alert ? <AlertMessage alert={alert} /> : null}

      <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Generate Queue from Campaign</h2>
            <p className="mt-1 text-sm text-slate-500">Create pending or scheduled call attempts from attached campaign cases.</p>
          </div>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={generateLoading}
            onClick={() => void handleGenerateQueue()}
            type="button"
          >
            {generateLoading ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Send aria-hidden="true" className="h-4 w-4" />}
            Generate Queue
          </button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_280px]">
          <label className="space-y-2">
            <FieldLabel>Campaign ID</FieldLabel>
            <input
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              onChange={(event) => setCampaignId(event.target.value)}
              placeholder="Paste campaign UUID"
              type="text"
              value={campaignId}
            />
          </label>

          <label className="space-y-2">
            <FieldLabel>Optional Scheduled At</FieldLabel>
            <input
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              onChange={(event) => setGenerateScheduledAt(event.target.value)}
              type="datetime-local"
              value={generateScheduledAt}
            />
          </label>
        </div>
      </article>

      {generateResult ? <GenerateResult result={generateResult} /> : null}

      <section className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Queue Items</h2>
              <p className="mt-1 text-sm text-slate-500">{totalItems} call attempt record(s)</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[220px_150px_150px_180px_180px_auto]">
              <label className="relative block">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  onChange={(event) => {
                    setPage(1);
                    setCampaignFilter(event.target.value);
                  }}
                  placeholder="Campaign ID"
                  type="search"
                  value={campaignFilter}
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
                {queueStatusOptions.map((option) => (
                  <option key={option} value={option}>
                    {labelize(option)}
                  </option>
                ))}
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
                {priorityOptions.map((option) => (
                  <option key={option} value={option}>
                    {labelize(option)}
                  </option>
                ))}
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

              <button
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={queueLoading}
                onClick={() => void refreshAll()}
                type="button"
              >
                <RefreshCw aria-hidden="true" className={`h-4 w-4 ${queueLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {queueError ? <AlertMessage alert={{ tone: "error", message: queueError }} /> : null}

        <QueueTable
          actionLoading={actionLoading}
          items={queueItems}
          loading={queueLoading}
          onCancel={(attempt) => void handleCancelAttempt(attempt)}
          onSchedule={openScheduleModal}
          onView={handleView}
        />

        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-soft sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Page <span className="font-semibold text-slate-950">{page}</span> of{" "}
            <span className="font-semibold text-slate-950">{totalPages}</span>
          </p>
          <div className="flex gap-2">
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={page <= 1 || queueLoading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              type="button"
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
              Previous
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={page >= totalPages || queueLoading}
              onClick={() => setPage((current) => current + 1)}
              type="button"
            >
              Next
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {selectedAttemptId ? (
        <DetailPanel
          attempt={selectedAttempt}
          detailError={detailError}
          loading={detailLoading}
          onClose={closeDetails}
        />
      ) : null}

      {scheduleAttempt ? (
        <ScheduleModal
          loading={actionLoading === `${scheduleAttempt.id}:schedule`}
          scheduledAt={scheduleValue}
          selected={scheduleAttempt}
          onClose={() => {
            setScheduleAttempt(null);
            setScheduleValue("");
          }}
          onSubmit={() => void handleScheduleAttempt()}
          onValue={setScheduleValue}
        />
      ) : null}

      {selectedAttemptId && !selectedAttempt && selectedTitle ? (
        <span className="sr-only">Opening {selectedTitle}</span>
      ) : null}
    </div>
  );
}
