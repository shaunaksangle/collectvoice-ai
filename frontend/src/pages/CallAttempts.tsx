import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Ban,
  Bot,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Headphones,
  IndianRupee,
  Loader2,
  MessageSquareText,
  PhoneCall,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UserX,
  X,
  XCircle,
} from "lucide-react";

import { EmptyState } from "../components/EmptyState";
import { MetricCard } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { mockCallsApi } from "../lib/api";
import type {
  MockCallBatchResponse,
  MockCallOutcome,
  MockCallOutcomeDetail,
  MockCallOutcomeType,
  MockCallRunPayload,
  MockCallRunResponse,
  MockCallSummary,
} from "../types";

const pageSize = 10;

const outcomeTypes: MockCallOutcomeType[] = [
  "promise_to_pay",
  "already_paid",
  "callback_requested",
  "no_answer",
  "wrong_number",
  "dispute",
  "refused_to_pay",
  "unreachable",
];

const emptySummary: MockCallSummary = {
  total_outcomes: 0,
  completed_calls: 0,
  failed_calls: 0,
  promise_to_pay_count: 0,
  already_paid_count: 0,
  callback_required_count: 0,
  no_answer_count: 0,
  wrong_number_count: 0,
  dispute_count: 0,
  refused_to_pay_count: 0,
  unreachable_count: 0,
};

type AlertTone = "success" | "error" | "warning" | "info";

interface AlertState {
  tone: AlertTone;
  message: string;
}

interface RunOneForm {
  call_attempt_id: string;
  outcome_type: MockCallOutcomeType;
  promise_date: string;
  promise_amount: string;
  callback_reason: string;
  notes: string;
}

interface BatchForm {
  limit: string;
  campaign_id: string;
  status: "pending" | "scheduled";
  outcome_type: "" | MockCallOutcomeType;
  dry_run: boolean;
}

const defaultRunOneForm: RunOneForm = {
  call_attempt_id: "",
  outcome_type: "promise_to_pay",
  promise_date: "",
  promise_amount: "",
  callback_reason: "",
  notes: "",
};

const defaultBatchForm: BatchForm = {
  limit: "5",
  campaign_id: "",
  status: "pending",
  outcome_type: "",
  dry_run: true,
};

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

function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const amount = typeof value === "number" ? value : Number(value);
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

function toneForValue(value: string | boolean | null | undefined): "blue" | "green" | "amber" | "red" | "slate" {
  if (typeof value === "boolean") {
    return value ? "amber" : "slate";
  }

  switch ((value ?? "").toLowerCase()) {
    case "promise_to_pay":
    case "already_paid":
    case "completed":
    case "cooperative":
      return "green";
    case "callback_requested":
    case "pending":
    case "concerned":
      return "amber";
    case "no_answer":
    case "wrong_number":
    case "dispute":
    case "refused_to_pay":
    case "unreachable":
    case "failed":
    case "unwilling":
      return "red";
    case "unknown":
    case "neutral":
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

function SummaryCards({ summary, unavailable }: { summary: MockCallSummary; unavailable: boolean }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
      <MetricCard
        accent="blue"
        icon={MessageSquareText}
        label="Total Outcomes"
        trend={unavailable ? "Backend unavailable" : "Saved mock results"}
        value={unavailable ? "-" : String(summary.total_outcomes)}
      />
      <MetricCard accent="emerald" icon={CheckCircle2} label="Completed Calls" trend="Mock completed" value={unavailable ? "-" : String(summary.completed_calls)} />
      <MetricCard accent="rose" icon={XCircle} label="Failed Calls" trend="No answer or unreachable" value={unavailable ? "-" : String(summary.failed_calls)} />
      <MetricCard accent="emerald" icon={CalendarCheck} label="Promise To Pay" trend="PTP records created" value={unavailable ? "-" : String(summary.promise_to_pay_count)} />
      <MetricCard accent="blue" icon={IndianRupee} label="Already Paid" trend="Needs verification" value={unavailable ? "-" : String(summary.already_paid_count)} />
      <MetricCard accent="amber" icon={Headphones} label="Callback Required" trend="Human follow-up" value={unavailable ? "-" : String(summary.callback_required_count)} />
      <MetricCard accent="amber" icon={PhoneCall} label="No Answer" trend="Retry later" value={unavailable ? "-" : String(summary.no_answer_count)} />
      <MetricCard accent="rose" icon={UserX} label="Wrong Number" trend="Contact review" value={unavailable ? "-" : String(summary.wrong_number_count)} />
      <MetricCard accent="rose" icon={AlertCircle} label="Disputes" trend="Human review" value={unavailable ? "-" : String(summary.dispute_count)} />
      <MetricCard accent="violet" icon={Ban} label="Unreachable" trend="Could not connect" value={unavailable ? "-" : String(summary.unreachable_count)} />
    </section>
  );
}

function buildRunPayload(form: RunOneForm): { payload?: MockCallRunPayload; error?: string } {
  if (!optionalText(form.call_attempt_id)) {
    return { error: "Enter a call attempt ID before running a mock call." };
  }

  const amountText = optionalText(form.promise_amount);
  const amount = amountText === undefined ? undefined : Number(amountText);
  if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) {
    return { error: "Promise amount must be a valid non-negative number." };
  }

  return {
    payload: {
      outcome_type: form.outcome_type,
      promise_date: optionalText(form.promise_date),
      promise_amount: amountText ? amount : undefined,
      callback_reason: optionalText(form.callback_reason),
      notes: optionalText(form.notes),
    },
  };
}

function buildBatchPayload(form: BatchForm): { payload?: { limit: number; campaign_id?: string; status: "pending" | "scheduled"; outcome_type?: MockCallOutcomeType; dry_run: boolean }; error?: string } {
  const limit = Number(form.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    return { error: "Batch limit must be a whole number between 1 and 50." };
  }

  return {
    payload: {
      limit,
      campaign_id: optionalText(form.campaign_id),
      status: form.status,
      outcome_type: form.outcome_type || undefined,
      dry_run: form.dry_run,
    },
  };
}

function RunOneResult({ result }: { result: MockCallRunResponse }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Single Call Result</h2>
          <p className="mt-1 text-sm text-slate-500">{result.call_attempt_id}</p>
        </div>
        <StatusBadge label={labelize(result.final_status)} tone={toneForValue(result.final_status)} />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="border-t border-slate-200 pt-3">
          <p className="text-xs font-semibold uppercase text-slate-500">Outcome Type</p>
          <div className="mt-2">
            <StatusBadge label={labelize(result.outcome.outcome_type)} tone={toneForValue(result.outcome.outcome_type)} />
          </div>
        </div>
        <div className="border-t border-slate-200 pt-3">
          <p className="text-xs font-semibold uppercase text-slate-500">Promise Date</p>
          <p className="mt-2 text-sm font-medium text-slate-800">{formatDate(result.outcome.promise_date)}</p>
        </div>
        <div className="border-t border-slate-200 pt-3">
          <p className="text-xs font-semibold uppercase text-slate-500">Promise Amount</p>
          <p className="mt-2 text-sm font-medium text-slate-800">{formatCurrency(result.outcome.promise_amount)}</p>
        </div>
        <div className="border-t border-slate-200 pt-3">
          <p className="text-xs font-semibold uppercase text-slate-500">Callback Required</p>
          <div className="mt-2">
            <StatusBadge label={result.outcome.callback_required ? "Yes" : "No"} tone={toneForValue(result.outcome.callback_required)} />
          </div>
        </div>
      </div>

      <div className="mt-5 border-t border-slate-200 pt-4">
        <p className="text-xs font-semibold uppercase text-slate-500">Summary</p>
        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{displayValue(result.outcome.summary)}</p>
      </div>
    </article>
  );
}

function BatchResult({ result }: { result: MockCallBatchResponse }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Batch Result</h2>
          <p className="mt-1 text-sm text-slate-500">{result.dry_run ? "Dry run only. No records were changed." : "Mock batch completed."}</p>
        </div>
        <StatusBadge label={result.dry_run ? "Dry Run" : "Executed"} tone={result.dry_run ? "amber" : "green"} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Selected", result.selected_count],
          ["Processed", result.processed_count],
          ["Completed", result.completed_count],
          ["Failed", result.failed_count],
          ["Promise To Pay", result.promise_to_pay_count],
          ["Callbacks", result.callback_required_count],
          ["Skipped", result.skipped_count],
        ].map(([label, value]) => (
          <div className="border-t border-slate-200 pt-3" key={label}>
            <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-semibold text-slate-950">{value}</p>
          </div>
        ))}
      </div>

      {result.processed_call_attempt_ids.length > 0 ? (
        <div className="mt-5 border-t border-slate-200 pt-4">
          <p className="text-sm font-semibold text-slate-950">{result.dry_run ? "Would Process" : "Processed Call Attempts"}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {result.processed_call_attempt_ids.map((id) => (
              <StatusBadge key={id} label={id} tone="blue" />
            ))}
          </div>
        </div>
      ) : null}

      {result.errors.length > 0 ? (
        <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Call Attempt ID</th>
                <th className="px-4 py-3">Issue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.errors.map((error) => (
                <tr key={`${error.call_attempt_id}-${error.issue}`}>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-950">{error.call_attempt_id}</td>
                  <td className="px-4 py-3 text-slate-600">{error.issue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </article>
  );
}

function OutcomesTable({
  loading,
  outcomes,
  onView,
}: {
  loading: boolean;
  outcomes: MockCallOutcome[];
  onView: (outcome: MockCallOutcome) => void;
}) {
  if (!loading && outcomes.length === 0) {
    return (
      <EmptyState
        description="Run one mock call or a batch to create outcome records and transcripts."
        icon={MessageSquareText}
        title="No mock call outcomes found"
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
            <th className="px-4 py-3">Outcome Type</th>
            <th className="px-4 py-3">Disposition</th>
            <th className="px-4 py-3">Intent</th>
            <th className="px-4 py-3">Sentiment</th>
            <th className="px-4 py-3">Promise Date</th>
            <th className="px-4 py-3">Promise Amount</th>
            <th className="px-4 py-3">Callback Required</th>
            <th className="px-4 py-3">Human Review</th>
            <th className="px-4 py-3">Created At</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? (
            <tr>
              <td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={14}>
                <span className="inline-flex items-center gap-2">
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  Loading outcomes
                </span>
              </td>
            </tr>
          ) : (
            outcomes.map((outcome) => (
              <tr key={outcome.id}>
                <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-950">{displayValue(outcome.customer_name)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{displayValue(outcome.phone_number)}</td>
                <td className="min-w-[180px] px-4 py-3 text-slate-600">{displayValue(outcome.campaign_name)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{displayValue(outcome.case_reference)}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusBadge label={labelize(outcome.outcome_type)} tone={toneForValue(outcome.outcome_type)} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{labelize(outcome.disposition)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{labelize(outcome.detected_intent)}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusBadge label={labelize(outcome.sentiment)} tone={toneForValue(outcome.sentiment)} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(outcome.promise_date)}</td>
                <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">{formatCurrency(outcome.promise_amount)}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusBadge label={outcome.callback_required ? "Yes" : "No"} tone={toneForValue(outcome.callback_required)} />
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusBadge label={outcome.human_review_required ? "Yes" : "No"} tone={outcome.human_review_required ? "red" : "slate"} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDateTime(outcome.created_at)}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  <ActionIconButton label="View details" onClick={() => onView(outcome)}>
                    <Eye aria-hidden="true" className="h-4 w-4" />
                  </ActionIconButton>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function TranscriptBlock({ transcript }: { transcript: string | null }) {
  const lines = (transcript ?? "").split("\n").filter(Boolean);

  if (lines.length === 0) {
    return <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">No transcript available.</div>;
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      {lines.map((line, index) => {
        const isAgent = line.toLowerCase().startsWith("agent:");
        const isCustomer = line.toLowerCase().startsWith("customer:") || line.toLowerCase().startsWith("recipient:");
        return (
          <div
            className={`max-w-3xl rounded-lg border px-4 py-3 text-sm leading-6 ${
              isAgent
                ? "border-brand-100 bg-brand-50 text-brand-900"
                : isCustomer
                  ? "ml-auto border-emerald-100 bg-emerald-50 text-emerald-900"
                  : "border-slate-200 bg-white text-slate-700"
            }`}
            key={`${line}-${index}`}
          >
            {line}
          </div>
        );
      })}
    </div>
  );
}

function OutcomeDetailPanel({
  detail,
  detailError,
  loading,
  onClose,
}: {
  detail: MockCallOutcomeDetail | null;
  detailError: string | null;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/30 p-3 sm:p-6" role="dialog" aria-modal="true">
      <article className="ml-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-brand-700">Outcome Details</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">{detail?.customer_name ?? "Loading outcome"}</h2>
            <p className="mt-1 text-sm text-slate-500">{detail?.case_reference ?? "Review transcript and collection outcome."}</p>
          </div>
          <button
            aria-label="Close outcome details"
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
                Loading outcome
              </span>
            </div>
          ) : detailError ? (
            <AlertMessage alert={{ tone: "error", message: detailError }} />
          ) : detail ? (
            <div className="space-y-6">
              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">Outcome Type</p>
                  <div className="mt-2">
                    <StatusBadge label={labelize(detail.outcome_type)} tone={toneForValue(detail.outcome_type)} />
                  </div>
                </article>
                <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">Sentiment</p>
                  <div className="mt-2">
                    <StatusBadge label={labelize(detail.sentiment)} tone={toneForValue(detail.sentiment)} />
                  </div>
                </article>
                <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">Callback Required</p>
                  <div className="mt-2">
                    <StatusBadge label={detail.callback_required ? "Yes" : "No"} tone={toneForValue(detail.callback_required)} />
                  </div>
                </article>
                <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">Human Review</p>
                  <div className="mt-2">
                    <StatusBadge label={detail.human_review_required ? "Yes" : "No"} tone={detail.human_review_required ? "red" : "slate"} />
                  </div>
                </article>
              </section>

              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ["Customer", detail.customer_name],
                  ["Phone", detail.phone_number],
                  ["Campaign", detail.campaign_name],
                  ["Case Reference", detail.case_reference],
                  ["Disposition", labelize(detail.disposition)],
                  ["Detected Intent", labelize(detail.detected_intent)],
                  ["Promise Date", formatDate(detail.promise_date)],
                  ["Promise Amount", formatCurrency(detail.promise_amount)],
                  ["Call Status", labelize(detail.call_attempt_status)],
                  ["Created At", formatDateTime(detail.created_at)],
                  ["Started At", formatDateTime(detail.started_at)],
                  ["Ended At", formatDateTime(detail.ended_at)],
                ].map(([label, value]) => (
                  <div className="border-t border-slate-200 pt-3" key={label}>
                    <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
                    <p className="mt-1 break-words text-sm font-medium text-slate-800">{displayValue(value)}</p>
                  </div>
                ))}
              </section>

              <section className="space-y-3 border-t border-slate-200 pt-5">
                <h3 className="text-base font-semibold text-slate-950">Summary</h3>
                <p className="whitespace-pre-line text-sm leading-6 text-slate-700">{displayValue(detail.summary)}</p>
              </section>

              {detail.callback_reason ? (
                <section className="space-y-3 border-t border-slate-200 pt-5">
                  <h3 className="text-base font-semibold text-slate-950">Callback Reason</h3>
                  <p className="text-sm leading-6 text-slate-700">{detail.callback_reason}</p>
                </section>
              ) : null}

              <section className="space-y-3 border-t border-slate-200 pt-5">
                <h3 className="text-base font-semibold text-slate-950">Transcript</h3>
                <TranscriptBlock transcript={detail.transcript} />
              </section>
            </div>
          ) : null}
        </div>
      </article>
    </div>
  );
}

export function CallAttempts() {
  const [summary, setSummary] = useState<MockCallSummary>(emptySummary);
  const [summaryUnavailable, setSummaryUnavailable] = useState(false);
  const [outcomes, setOutcomes] = useState<MockCallOutcome[]>([]);
  const [totalOutcomes, setTotalOutcomes] = useState(0);
  const [outcomesLoading, setOutcomesLoading] = useState(false);
  const [outcomesError, setOutcomesError] = useState<string | null>(null);
  const [alert, setAlert] = useState<AlertState | null>(null);

  const [runOneForm, setRunOneForm] = useState<RunOneForm>(defaultRunOneForm);
  const [runOneLoading, setRunOneLoading] = useState(false);
  const [runOneResult, setRunOneResult] = useState<MockCallRunResponse | null>(null);

  const [batchForm, setBatchForm] = useState<BatchForm>(defaultBatchForm);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResult, setBatchResult] = useState<MockCallBatchResponse | null>(null);

  const [page, setPage] = useState(1);
  const [outcomeTypeFilter, setOutcomeTypeFilter] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("");
  const [callbackFilter, setCallbackFilter] = useState("");
  const [humanReviewFilter, setHumanReviewFilter] = useState("");

  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<MockCallOutcomeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalOutcomes / pageSize));

  const refreshSummary = useCallback(async () => {
    try {
      const payload = await mockCallsApi.getSummary();
      setSummary(payload);
      setSummaryUnavailable(false);
    } catch {
      setSummary(emptySummary);
      setSummaryUnavailable(true);
    }
  }, []);

  const refreshOutcomes = useCallback(async () => {
    setOutcomesLoading(true);
    setOutcomesError(null);

    try {
      const payload = await mockCallsApi.listOutcomes({
        page,
        page_size: pageSize,
        outcome_type: outcomeTypeFilter,
        campaign_id: campaignFilter,
        callback_required: callbackFilter === "" ? undefined : callbackFilter === "true",
        human_review_required: humanReviewFilter === "" ? undefined : humanReviewFilter === "true",
      });
      setOutcomes(payload.items);
      setTotalOutcomes(payload.total);
    } catch (error) {
      setOutcomes([]);
      setTotalOutcomes(0);
      setOutcomesError(error instanceof Error ? error.message : "Unable to load mock call outcomes.");
    } finally {
      setOutcomesLoading(false);
    }
  }, [callbackFilter, campaignFilter, humanReviewFilter, outcomeTypeFilter, page]);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshSummary(), refreshOutcomes()]);
  }, [refreshOutcomes, refreshSummary]);

  const loadOutcomeDetail = useCallback(async (outcomeId: string) => {
    setDetailLoading(true);
    setDetailError(null);

    try {
      const detail = await mockCallsApi.getOutcome(outcomeId);
      setSelectedOutcome(detail);
    } catch (error) {
      setSelectedOutcome(null);
      setDetailError(error instanceof Error ? error.message : "Unable to load outcome details.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const selectedTitle = useMemo(
    () => outcomes.find((outcome) => outcome.id === selectedOutcomeId)?.customer_name ?? selectedOutcome?.customer_name ?? null,
    [outcomes, selectedOutcome, selectedOutcomeId],
  );

  async function handleRunOne() {
    const { payload, error } = buildRunPayload(runOneForm);
    const callAttemptId = optionalText(runOneForm.call_attempt_id);
    if (error || !payload || !callAttemptId) {
      setAlert({ tone: "warning", message: error ?? "Check mock call fields." });
      return;
    }

    setRunOneLoading(true);
    setRunOneResult(null);
    setAlert(null);

    try {
      const result = await mockCallsApi.runOne(callAttemptId, payload);
      setRunOneResult(result);
      setAlert({ tone: "success", message: `Mock call completed with outcome ${labelize(result.outcome.outcome_type)}.` });
      await refreshAll();
    } catch (error) {
      setAlert({ tone: "error", message: error instanceof Error ? error.message : "Unable to run mock call." });
    } finally {
      setRunOneLoading(false);
    }
  }

  async function handleRunBatch() {
    const { payload, error } = buildBatchPayload(batchForm);
    if (error || !payload) {
      setAlert({ tone: "warning", message: error ?? "Check batch fields." });
      return;
    }

    setBatchLoading(true);
    setBatchResult(null);
    setAlert(null);

    try {
      const result = await mockCallsApi.runBatch(payload);
      setBatchResult(result);
      setAlert({
        tone: result.dry_run ? "info" : "success",
        message: result.dry_run
          ? `Dry run selected ${result.selected_count} call attempt(s).`
          : `Batch processed ${result.processed_count} call attempt(s).`,
      });
      if (!result.dry_run) {
        await refreshAll();
      }
    } catch (error) {
      setAlert({ tone: "error", message: error instanceof Error ? error.message : "Unable to run mock batch." });
    } finally {
      setBatchLoading(false);
    }
  }

  function handleViewOutcome(outcome: MockCallOutcome) {
    setSelectedOutcomeId(outcome.id);
    setSelectedOutcome(null);
    void loadOutcomeDetail(outcome.id);
  }

  function closeDetails() {
    setSelectedOutcomeId(null);
    setSelectedOutcome(null);
    setDetailError(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Simulate safe AI collection calls before live telephony integration"
        eyebrow="Mock mode"
        title="Mock Calls"
      />

      <div className="flex items-start gap-3 rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-800">
        <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <p>Mock mode only. These actions create simulated outcomes and transcripts; they do not place real calls or contact providers.</p>
      </div>

      <SummaryCards summary={summary} unavailable={summaryUnavailable} />

      {alert ? <AlertMessage alert={alert} /> : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Run One Mock Call</h2>
              <p className="mt-1 text-sm text-slate-500">Simulate one pending or scheduled queue item.</p>
            </div>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={runOneLoading}
              onClick={() => void handleRunOne()}
              type="button"
            >
              {runOneLoading ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Sparkles aria-hidden="true" className="h-4 w-4" />}
              Run Mock Call
            </button>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <label className="space-y-2 lg:col-span-2">
              <FieldLabel>Call Attempt ID</FieldLabel>
              <input
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                onChange={(event) => setRunOneForm((current) => ({ ...current, call_attempt_id: event.target.value }))}
                placeholder="Paste call attempt UUID"
                type="text"
                value={runOneForm.call_attempt_id}
              />
            </label>

            <label className="space-y-2">
              <FieldLabel>Outcome Type</FieldLabel>
              <select
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                onChange={(event) => setRunOneForm((current) => ({ ...current, outcome_type: event.target.value as MockCallOutcomeType }))}
                value={runOneForm.outcome_type}
              >
                {outcomeTypes.map((type) => (
                  <option key={type} value={type}>
                    {labelize(type)}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <FieldLabel>Promise Date</FieldLabel>
              <input
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                onChange={(event) => setRunOneForm((current) => ({ ...current, promise_date: event.target.value }))}
                type="date"
                value={runOneForm.promise_date}
              />
            </label>

            <label className="space-y-2">
              <FieldLabel>Promise Amount</FieldLabel>
              <input
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                min={0}
                onChange={(event) => setRunOneForm((current) => ({ ...current, promise_amount: event.target.value }))}
                placeholder="2500"
                type="number"
                value={runOneForm.promise_amount}
              />
            </label>

            <label className="space-y-2">
              <FieldLabel>Callback Reason</FieldLabel>
              <input
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                onChange={(event) => setRunOneForm((current) => ({ ...current, callback_reason: event.target.value }))}
                placeholder="Customer asked for later callback"
                type="text"
                value={runOneForm.callback_reason}
              />
            </label>

            <label className="space-y-2 lg:col-span-2">
              <FieldLabel>Notes</FieldLabel>
              <textarea
                className="min-h-20 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                onChange={(event) => setRunOneForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Internal manager notes"
                value={runOneForm.notes}
              />
            </label>
          </div>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Run Batch Mock Calls</h2>
              <p className="mt-1 text-sm text-slate-500">Preview or process pending/scheduled queue attempts.</p>
            </div>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={batchLoading}
              onClick={() => void handleRunBatch()}
              type="button"
            >
              {batchLoading ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Bot aria-hidden="true" className="h-4 w-4" />}
              Run Batch
            </button>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <label className="space-y-2">
              <FieldLabel>Limit</FieldLabel>
              <input
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                max={50}
                min={1}
                onChange={(event) => setBatchForm((current) => ({ ...current, limit: event.target.value }))}
                type="number"
                value={batchForm.limit}
              />
            </label>

            <label className="space-y-2">
              <FieldLabel>Status</FieldLabel>
              <select
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                onChange={(event) => setBatchForm((current) => ({ ...current, status: event.target.value as "pending" | "scheduled" }))}
                value={batchForm.status}
              >
                <option value="pending">Pending</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </label>

            <label className="space-y-2 lg:col-span-2">
              <FieldLabel>Campaign ID</FieldLabel>
              <input
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                onChange={(event) => setBatchForm((current) => ({ ...current, campaign_id: event.target.value }))}
                placeholder="Optional campaign UUID"
                type="text"
                value={batchForm.campaign_id}
              />
            </label>

            <label className="space-y-2">
              <FieldLabel>Outcome Type</FieldLabel>
              <select
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                onChange={(event) => setBatchForm((current) => ({ ...current, outcome_type: event.target.value as "" | MockCallOutcomeType }))}
                value={batchForm.outcome_type}
              >
                <option value="">Default outcome</option>
                {outcomeTypes.map((type) => (
                  <option key={type} value={type}>
                    {labelize(type)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex h-10 items-center gap-3 self-end rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700">
              <input
                checked={batchForm.dry_run}
                className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
                onChange={(event) => setBatchForm((current) => ({ ...current, dry_run: event.target.checked }))}
                type="checkbox"
              />
              Dry run
            </label>
          </div>
        </article>
      </section>

      {runOneResult ? <RunOneResult result={runOneResult} /> : null}
      {batchResult ? <BatchResult result={batchResult} /> : null}

      <section className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Call Outcomes</h2>
              <p className="mt-1 text-sm text-slate-500">{totalOutcomes} outcome record(s)</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[170px_220px_170px_170px_auto]">
              <select
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                onChange={(event) => {
                  setPage(1);
                  setOutcomeTypeFilter(event.target.value);
                }}
                value={outcomeTypeFilter}
              >
                <option value="">All outcomes</option>
                {outcomeTypes.map((type) => (
                  <option key={type} value={type}>
                    {labelize(type)}
                  </option>
                ))}
              </select>

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
                  setCallbackFilter(event.target.value);
                }}
                value={callbackFilter}
              >
                <option value="">Any callback</option>
                <option value="true">Callback required</option>
                <option value="false">No callback</option>
              </select>

              <select
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                onChange={(event) => {
                  setPage(1);
                  setHumanReviewFilter(event.target.value);
                }}
                value={humanReviewFilter}
              >
                <option value="">Any review</option>
                <option value="true">Human review</option>
                <option value="false">No review</option>
              </select>

              <button
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={outcomesLoading}
                onClick={() => void refreshAll()}
                type="button"
              >
                <RefreshCw aria-hidden="true" className={`h-4 w-4 ${outcomesLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {outcomesError ? <AlertMessage alert={{ tone: "error", message: outcomesError }} /> : null}

        <OutcomesTable loading={outcomesLoading} outcomes={outcomes} onView={handleViewOutcome} />

        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-soft sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Page <span className="font-semibold text-slate-950">{page}</span> of{" "}
            <span className="font-semibold text-slate-950">{totalPages}</span>
          </p>
          <div className="flex gap-2">
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={page <= 1 || outcomesLoading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              type="button"
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
              Previous
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={page >= totalPages || outcomesLoading}
              onClick={() => setPage((current) => current + 1)}
              type="button"
            >
              Next
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {selectedOutcomeId ? (
        <OutcomeDetailPanel
          detail={selectedOutcome}
          detailError={detailError}
          loading={detailLoading}
          onClose={closeDetails}
        />
      ) : null}

      {selectedOutcomeId && !selectedOutcome && selectedTitle ? (
        <span className="sr-only">Opening {selectedTitle}</span>
      ) : null}
    </div>
  );
}
