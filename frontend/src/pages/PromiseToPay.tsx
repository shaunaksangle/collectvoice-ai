import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  Ban,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  IndianRupee,
  Loader2,
  RefreshCw,
  Search,
  X,
  XCircle,
} from "lucide-react";

import { EmptyState } from "../components/EmptyState";
import { MetricCard } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { promiseToPayApi } from "../lib/api";
import type {
  PromiseToPayDetail,
  PromiseToPayListItem,
  PromiseToPayStatus,
  PromiseToPaySummary,
} from "../types";

const pageSize = 10;

const emptySummary: PromiseToPaySummary = {
  total_ptp: 0,
  pending_ptp: 0,
  fulfilled_ptp: 0,
  broken_ptp: 0,
  cancelled_ptp: 0,
  overdue_ptp: 0,
  total_promised_amount: 0,
  pending_promised_amount: 0,
};

const ptpStatuses: PromiseToPayStatus[] = ["pending", "fulfilled", "broken", "cancelled"];

type AlertTone = "success" | "error" | "warning" | "info";

interface AlertState {
  tone: AlertTone;
  message: string;
}

interface PromiseEditForm {
  status: PromiseToPayStatus;
  promised_amount: string;
  promised_date: string;
  notes: string;
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

function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
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

function statusTone(status: string | null | undefined): "blue" | "green" | "amber" | "red" | "slate" {
  switch ((status ?? "").toLowerCase()) {
    case "fulfilled":
      return "green";
    case "pending":
      return "amber";
    case "broken":
      return "red";
    case "cancelled":
      return "slate";
    default:
      return "blue";
  }
}

function sourceTone(source: string | null | undefined): "blue" | "green" | "amber" | "red" | "slate" {
  switch ((source ?? "").toLowerCase()) {
    case "mock_call":
      return "blue";
    case "live_call":
      return "green";
    case "manual":
      return "amber";
    default:
      return "slate";
  }
}

function makeEditForm(record: PromiseToPayDetail): PromiseEditForm {
  return {
    status: record.status,
    promised_amount: String(record.promised_amount ?? ""),
    promised_date: record.promised_date ?? "",
    notes: record.notes ?? "",
  };
}

function buildUpdatePayload(form: PromiseEditForm): {
  payload?: { status: PromiseToPayStatus; promised_amount: number; promised_date: string; notes?: string | null };
  error?: string;
} {
  const amount = Number(form.promised_amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return { error: "Promised amount must be a valid non-negative number." };
  }

  if (!form.promised_date) {
    return { error: "Promised date is required." };
  }

  return {
    payload: {
      status: form.status,
      promised_amount: amount,
      promised_date: form.promised_date,
      notes: optionalText(form.notes) ?? null,
    },
  };
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
  children: ReactNode;
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

function SummaryCards({ summary, unavailable }: { summary: PromiseToPaySummary; unavailable: boolean }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        accent="blue"
        icon={CalendarCheck}
        label="Total PTP"
        trend={unavailable ? "Backend unavailable" : "All commitments"}
        value={unavailable ? "-" : String(summary.total_ptp)}
      />
      <MetricCard accent="amber" icon={Clock3} label="Pending" trend="Awaiting due date" value={unavailable ? "-" : String(summary.pending_ptp)} />
      <MetricCard accent="emerald" icon={CheckCircle2} label="Fulfilled" trend="Payment confirmed" value={unavailable ? "-" : String(summary.fulfilled_ptp)} />
      <MetricCard accent="rose" icon={AlertCircle} label="Broken" trend="Missed commitment" value={unavailable ? "-" : String(summary.broken_ptp)} />
      <MetricCard accent="violet" icon={Ban} label="Cancelled" trend="No longer active" value={unavailable ? "-" : String(summary.cancelled_ptp)} />
      <MetricCard accent="rose" icon={XCircle} label="Overdue" trend="Pending past date" value={unavailable ? "-" : String(summary.overdue_ptp)} />
      <MetricCard
        accent="blue"
        icon={IndianRupee}
        label="Total Promised Amount"
        trend="All PTP value"
        value={unavailable ? "-" : formatCurrency(summary.total_promised_amount)}
      />
      <MetricCard
        accent="emerald"
        icon={IndianRupee}
        label="Pending Promised Amount"
        trend="Still expected"
        value={unavailable ? "-" : formatCurrency(summary.pending_promised_amount)}
      />
    </section>
  );
}

function PromiseFilters({
  assignedAgent,
  dueFrom,
  dueTo,
  onAssignedAgent,
  onDueFrom,
  onDueTo,
  onOverdueOnly,
  onRefresh,
  onStatus,
  overdueOnly,
  status,
}: {
  assignedAgent: string;
  dueFrom: string;
  dueTo: string;
  onAssignedAgent: (value: string) => void;
  onDueFrom: (value: string) => void;
  onDueTo: (value: string) => void;
  onOverdueOnly: (value: boolean) => void;
  onRefresh: () => void;
  onStatus: (value: string) => void;
  overdueOnly: boolean;
  status: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <label className="flex-1">
          <FieldLabel>Status</FieldLabel>
          <select
            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            onChange={(event) => onStatus(event.target.value)}
            value={status}
          >
            <option value="">All statuses</option>
            {ptpStatuses.map((option) => (
              <option key={option} value={option}>
                {labelize(option)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex-1">
          <FieldLabel>Assigned Agent</FieldLabel>
          <div className="mt-2 flex items-center rounded-lg border border-slate-200 bg-white px-3 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100">
            <Search aria-hidden="true" className="h-4 w-4 text-slate-400" />
            <input
              className="w-full border-0 bg-transparent px-2 py-2 text-sm text-slate-700 outline-none"
              onChange={(event) => onAssignedAgent(event.target.value)}
              placeholder="Search agent"
              value={assignedAgent}
            />
          </div>
        </label>

        <label className="w-full lg:w-44">
          <FieldLabel>Due From</FieldLabel>
          <input
            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            onChange={(event) => onDueFrom(event.target.value)}
            type="date"
            value={dueFrom}
          />
        </label>

        <label className="w-full lg:w-44">
          <FieldLabel>Due To</FieldLabel>
          <input
            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            onChange={(event) => onDueTo(event.target.value)}
            type="date"
            value={dueTo}
          />
        </label>

        <label className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700">
          <input
            checked={overdueOnly}
            className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
            onChange={(event) => onOverdueOnly(event.target.checked)}
            type="checkbox"
          />
          Overdue only
        </label>

        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-800"
          onClick={onRefresh}
          type="button"
        >
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          Refresh
        </button>
      </div>
    </section>
  );
}

function PromiseTable({
  actionLoading,
  items,
  loading,
  onStatus,
  onView,
}: {
  actionLoading: string | null;
  items: PromiseToPayListItem[];
  loading: boolean;
  onStatus: (item: PromiseToPayListItem, status: PromiseToPayStatus) => void;
  onView: (item: PromiseToPayListItem) => void;
}) {
  if (!loading && items.length === 0) {
    return (
      <EmptyState
        description="Promise-to-pay commitments from mock or future live calls will appear here for manager review."
        icon={CalendarCheck}
        title="No promise-to-pay records found"
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
            <th className="px-4 py-3">Promised Amount</th>
            <th className="px-4 py-3">Promised Date</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3">Assigned Agent</th>
            <th className="px-4 py-3">Created At</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? (
            <tr>
              <td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={11}>
                <span className="inline-flex items-center gap-2">
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  Loading promise-to-pay records
                </span>
              </td>
            </tr>
          ) : (
            items.map((item) => {
              const fulfilledLoading = actionLoading === `${item.id}:fulfilled`;
              const brokenLoading = actionLoading === `${item.id}:broken`;
              const cancelLoading = actionLoading === `${item.id}:cancelled`;
              const terminal = item.status === "fulfilled" || item.status === "cancelled";

              return (
                <tr key={item.id}>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-950">{displayValue(item.customer_name)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{displayValue(item.phone_number)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{displayValue(item.case_reference)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{displayValue(item.lender_name)}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">{formatCurrency(item.promised_amount)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(item.promised_date)}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge label={labelize(item.status)} tone={statusTone(item.status)} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge label={labelize(item.source)} tone={sourceTone(item.source)} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{displayValue(item.assigned_agent)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDateTime(item.created_at)}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ActionIconButton label="View details" onClick={() => onView(item)}>
                        <Eye aria-hidden="true" className="h-4 w-4" />
                      </ActionIconButton>
                      <ActionIconButton
                        disabled={item.status === "fulfilled" || fulfilledLoading}
                        label="Mark fulfilled"
                        onClick={() => onStatus(item, "fulfilled")}
                      >
                        {fulfilledLoading ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <CheckCircle2 aria-hidden="true" className="h-4 w-4" />}
                      </ActionIconButton>
                      <ActionIconButton
                        disabled={terminal || item.status === "broken" || brokenLoading}
                        label="Mark broken"
                        onClick={() => onStatus(item, "broken")}
                      >
                        {brokenLoading ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <AlertCircle aria-hidden="true" className="h-4 w-4" />}
                      </ActionIconButton>
                      <ActionIconButton
                        disabled={item.status === "cancelled" || cancelLoading}
                        label="Cancel"
                        onClick={() => onStatus(item, "cancelled")}
                      >
                        {cancelLoading ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <XCircle aria-hidden="true" className="h-4 w-4" />}
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

function PromiseDetailPanel({
  detail,
  detailError,
  editForm,
  loading,
  onChange,
  onClose,
  onSave,
  saving,
}: {
  detail: PromiseToPayDetail | null;
  detailError: string | null;
  editForm: PromiseEditForm;
  loading: boolean;
  onChange: (value: PromiseEditForm) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/30 p-3 sm:p-6" role="dialog" aria-modal="true">
      <article className="ml-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-brand-700">Promise Details</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">{detail?.customer_name ?? "Loading promise"}</h2>
            <p className="mt-1 text-sm text-slate-500">{detail?.case_reference ?? "Review commitment and update collection status."}</p>
          </div>
          <button
            aria-label="Close promise details"
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
                Loading promise details
              </span>
            </div>
          ) : detailError ? (
            <AlertMessage alert={{ tone: "error", message: detailError }} />
          ) : detail ? (
            <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
              <section className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase text-slate-500">Status</p>
                    <div className="mt-2">
                      <StatusBadge label={labelize(detail.status)} tone={statusTone(detail.status)} />
                    </div>
                  </article>
                  <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase text-slate-500">Promised Amount</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">{formatCurrency(detail.promised_amount)}</p>
                  </article>
                  <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase text-slate-500">Promised Date</p>
                    <p className="mt-2 text-sm font-medium text-slate-800">{formatDate(detail.promised_date)}</p>
                  </article>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    ["Customer Name", detail.customer_name],
                    ["Phone Number", detail.phone_number],
                    ["Case Reference", detail.case_reference],
                    ["Lender", detail.lender_name],
                    ["Source", labelize(detail.source)],
                    ["Assigned Agent", detail.assigned_agent],
                    ["Created At", formatDateTime(detail.created_at)],
                    ["Updated At", formatDateTime(detail.updated_at)],
                    ["Call Attempt", detail.call_attempt_id],
                  ].map(([label, value]) => (
                    <div className="border-t border-slate-200 pt-3" key={label}>
                      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
                      <p className="mt-1 break-words text-sm font-medium text-slate-800">{displayValue(value)}</p>
                    </div>
                  ))}
                </div>

                <section className="space-y-3 border-t border-slate-200 pt-5">
                  <h3 className="text-base font-semibold text-slate-950">Notes</h3>
                  <p className="whitespace-pre-line text-sm leading-6 text-slate-700">{displayValue(detail.notes)}</p>
                </section>
              </section>

              <aside className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                <h3 className="text-base font-semibold text-slate-950">Update Commitment</h3>
                <div className="mt-4 space-y-4">
                  <label className="block">
                    <FieldLabel>Status</FieldLabel>
                    <select
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                      onChange={(event) => onChange({ ...editForm, status: event.target.value as PromiseToPayStatus })}
                      value={editForm.status}
                    >
                      {ptpStatuses.map((status) => (
                        <option key={status} value={status}>
                          {labelize(status)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <FieldLabel>Promised Amount</FieldLabel>
                    <input
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                      min="0"
                      onChange={(event) => onChange({ ...editForm, promised_amount: event.target.value })}
                      type="number"
                      value={editForm.promised_amount}
                    />
                  </label>
                  <label className="block">
                    <FieldLabel>Promised Date</FieldLabel>
                    <input
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                      onChange={(event) => onChange({ ...editForm, promised_date: event.target.value })}
                      type="date"
                      value={editForm.promised_date}
                    />
                  </label>
                  <label className="block">
                    <FieldLabel>Notes</FieldLabel>
                    <textarea
                      className="mt-2 min-h-28 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                      onChange={(event) => onChange({ ...editForm, notes: event.target.value })}
                      value={editForm.notes}
                    />
                  </label>
                  <button
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={saving}
                    onClick={onSave}
                    type="button"
                  >
                    {saving ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <CheckCircle2 aria-hidden="true" className="h-4 w-4" />}
                    Save Changes
                  </button>
                </div>
              </aside>
            </div>
          ) : null}
        </div>
      </article>
    </div>
  );
}

export function PromiseToPay() {
  const [summary, setSummary] = useState<PromiseToPaySummary>(emptySummary);
  const [summaryUnavailable, setSummaryUnavailable] = useState(false);
  const [items, setItems] = useState<PromiseToPayListItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [alert, setAlert] = useState<AlertState | null>(null);

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [assignedAgentFilter, setAssignedAgentFilter] = useState("");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<PromiseToPayDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PromiseEditForm>({
    status: "pending",
    promised_amount: "",
    promised_date: "",
    notes: "",
  });
  const [savingDetail, setSavingDetail] = useState(false);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const refreshSummary = useCallback(async () => {
    try {
      const payload = await promiseToPayApi.getSummary();
      setSummary(payload);
      setSummaryUnavailable(false);
    } catch {
      setSummary(emptySummary);
      setSummaryUnavailable(true);
    }
  }, []);

  const refreshList = useCallback(async () => {
    if (dueFrom && dueTo && dueFrom > dueTo) {
      setItems([]);
      setTotalItems(0);
      setListError("Due From must be earlier than or equal to Due To.");
      return;
    }

    setLoading(true);
    setListError(null);

    try {
      const payload = await promiseToPayApi.list({
        page,
        page_size: pageSize,
        status: statusFilter,
        assigned_agent: assignedAgentFilter,
        due_from: dueFrom,
        due_to: dueTo,
        overdue_only: overdueOnly || undefined,
      });
      setItems(payload.items);
      setTotalItems(payload.total);
    } catch (error) {
      setItems([]);
      setTotalItems(0);
      setListError(error instanceof Error ? error.message : "Unable to load promise-to-pay records.");
    } finally {
      setLoading(false);
    }
  }, [assignedAgentFilter, dueFrom, dueTo, overdueOnly, page, statusFilter]);

  useEffect(() => {
    void refreshSummary();
  }, [refreshSummary]);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  useEffect(() => {
    setPage(1);
  }, [assignedAgentFilter, dueFrom, dueTo, overdueOnly, statusFilter]);

  const openDetail = useCallback(async (item: PromiseToPayListItem) => {
    setSelectedId(item.id);
    setSelectedDetail(null);
    setDetailLoading(true);
    setDetailError(null);

    try {
      const detail = await promiseToPayApi.get(item.id);
      setSelectedDetail(detail);
      setEditForm(makeEditForm(detail));
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "Unable to load promise details.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const updateStatus = useCallback(
    async (item: PromiseToPayListItem, nextStatus: PromiseToPayStatus) => {
      setActionLoading(`${item.id}:${nextStatus}`);
      setAlert(null);

      try {
        const detail = await promiseToPayApi.update(item.id, { status: nextStatus });
        setAlert({ tone: "success", message: `Promise marked ${labelize(nextStatus)}.` });
        if (selectedId === item.id) {
          setSelectedDetail(detail);
          setEditForm(makeEditForm(detail));
        }
        await Promise.all([refreshSummary(), refreshList()]);
      } catch (error) {
        setAlert({ tone: "error", message: error instanceof Error ? error.message : "Unable to update promise status." });
      } finally {
        setActionLoading(null);
      }
    },
    [refreshList, refreshSummary, selectedId],
  );

  const saveDetail = useCallback(async () => {
    if (!selectedDetail) {
      return;
    }

    const { payload, error } = buildUpdatePayload(editForm);
    if (error || !payload) {
      setAlert({ tone: "warning", message: error ?? "Review the promise fields before saving." });
      return;
    }

    setSavingDetail(true);
    setAlert(null);

    try {
      const detail = await promiseToPayApi.update(selectedDetail.id, payload);
      setSelectedDetail(detail);
      setEditForm(makeEditForm(detail));
      setAlert({ tone: "success", message: "Promise-to-pay record updated." });
      await Promise.all([refreshSummary(), refreshList()]);
    } catch (updateError) {
      setAlert({ tone: "error", message: updateError instanceof Error ? updateError.message : "Unable to update promise-to-pay record." });
    } finally {
      setSavingDetail(false);
    }
  }, [editForm, refreshList, refreshSummary, selectedDetail]);

  const refreshAll = useCallback(() => {
    void Promise.all([refreshSummary(), refreshList()]);
  }, [refreshList, refreshSummary]);

  const rangeLabel = useMemo(() => {
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, totalItems);
    return totalItems === 0 ? "0 records" : `${start}-${end} of ${totalItems}`;
  }, [page, totalItems]);

  return (
    <div className="space-y-6">
      <PageHeader
        description="Track customer payment commitments from mock and future live calls."
        eyebrow="Follow-ups"
        title="Promise To Pay"
      />

      <SummaryCards summary={summary} unavailable={summaryUnavailable} />

      {alert ? <AlertMessage alert={alert} /> : null}
      {listError ? <AlertMessage alert={{ tone: "error", message: listError }} /> : null}

      <PromiseFilters
        assignedAgent={assignedAgentFilter}
        dueFrom={dueFrom}
        dueTo={dueTo}
        onAssignedAgent={setAssignedAgentFilter}
        onDueFrom={setDueFrom}
        onDueTo={setDueTo}
        onOverdueOnly={setOverdueOnly}
        onRefresh={refreshAll}
        onStatus={setStatusFilter}
        overdueOnly={overdueOnly}
        status={statusFilter}
      />

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Promise Records</h2>
            <p className="mt-1 text-sm text-slate-500">{rangeLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              type="button"
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium text-slate-600">
              Page {page} of {totalPages}
            </span>
            <button
              className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
              disabled={page >= totalPages}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              type="button"
            >
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>

        <PromiseTable
          actionLoading={actionLoading}
          items={items}
          loading={loading}
          onStatus={updateStatus}
          onView={openDetail}
        />
      </section>

      {selectedId ? (
        <PromiseDetailPanel
          detail={selectedDetail}
          detailError={detailError}
          editForm={editForm}
          loading={detailLoading}
          onChange={setEditForm}
          onClose={() => {
            setSelectedId(null);
            setSelectedDetail(null);
            setDetailError(null);
          }}
          onSave={saveDetail}
          saving={savingDetail}
        />
      ) : null}
    </div>
  );
}
