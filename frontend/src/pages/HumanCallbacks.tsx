import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Headphones,
  Loader2,
  RefreshCw,
  Search,
  UserCheck,
  X,
  XCircle,
} from "lucide-react";

import { EmptyState } from "../components/EmptyState";
import { MetricCard } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { humanCallbacksApi } from "../lib/api";
import type {
  HumanCallbackDetail,
  HumanCallbackListItem,
  HumanCallbackPriority,
  HumanCallbackStatus,
  HumanCallbackSummary,
} from "../types";

const pageSize = 10;

const emptySummary: HumanCallbackSummary = {
  total_callbacks: 0,
  pending_callbacks: 0,
  assigned_callbacks: 0,
  completed_callbacks: 0,
  cancelled_callbacks: 0,
  high_priority_callbacks: 0,
};

const callbackStatuses: HumanCallbackStatus[] = ["pending", "assigned", "completed", "cancelled"];
const callbackPriorities: HumanCallbackPriority[] = ["low", "normal", "high", "critical"];

type AlertTone = "success" | "error" | "warning" | "info";

interface AlertState {
  tone: AlertTone;
  message: string;
}

interface CallbackEditForm {
  status: HumanCallbackStatus;
  priority: HumanCallbackPriority;
  assigned_agent: string;
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
    case "assigned":
      return "blue";
    case "completed":
      return "green";
    case "pending":
      return "amber";
    case "cancelled":
      return "slate";
    default:
      return "blue";
  }
}

function priorityTone(priority: string | null | undefined): "blue" | "green" | "amber" | "red" | "slate" {
  switch ((priority ?? "").toLowerCase()) {
    case "critical":
    case "high":
      return "red";
    case "normal":
      return "blue";
    case "low":
      return "slate";
    default:
      return "amber";
  }
}

function makeEditForm(record: HumanCallbackDetail): CallbackEditForm {
  return {
    status: record.status,
    priority: record.priority,
    assigned_agent: record.assigned_agent ?? "",
    notes: record.notes ?? "",
  };
}

function buildUpdatePayload(form: CallbackEditForm): {
  payload: {
    status: HumanCallbackStatus;
    priority: HumanCallbackPriority;
    assigned_agent?: string | null;
    notes?: string | null;
  };
} {
  return {
    payload: {
      status: form.status,
      priority: form.priority,
      assigned_agent: optionalText(form.assigned_agent) ?? null,
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

function SummaryCards({ summary, unavailable }: { summary: HumanCallbackSummary; unavailable: boolean }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      <MetricCard
        accent="blue"
        icon={Headphones}
        label="Total Callbacks"
        trend={unavailable ? "Backend unavailable" : "All follow-up tasks"}
        value={unavailable ? "-" : String(summary.total_callbacks)}
      />
      <MetricCard accent="amber" icon={Clock3} label="Pending" trend="Needs triage" value={unavailable ? "-" : String(summary.pending_callbacks)} />
      <MetricCard accent="blue" icon={UserCheck} label="Assigned" trend="With an agent" value={unavailable ? "-" : String(summary.assigned_callbacks)} />
      <MetricCard accent="emerald" icon={CheckCircle2} label="Completed" trend="Follow-up done" value={unavailable ? "-" : String(summary.completed_callbacks)} />
      <MetricCard accent="violet" icon={Ban} label="Cancelled" trend="No action needed" value={unavailable ? "-" : String(summary.cancelled_callbacks)} />
      <MetricCard accent="rose" icon={AlertCircle} label="High Priority" trend="Manager attention" value={unavailable ? "-" : String(summary.high_priority_callbacks)} />
    </section>
  );
}

function CallbackFilters({
  assignedAgent,
  onAssignedAgent,
  onPriority,
  onRefresh,
  onStatus,
  priority,
  status,
}: {
  assignedAgent: string;
  onAssignedAgent: (value: string) => void;
  onPriority: (value: string) => void;
  onRefresh: () => void;
  onStatus: (value: string) => void;
  priority: string;
  status: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1.5fr_auto] lg:items-end">
        <label>
          <FieldLabel>Status</FieldLabel>
          <select
            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            onChange={(event) => onStatus(event.target.value)}
            value={status}
          >
            <option value="">All statuses</option>
            {callbackStatuses.map((option) => (
              <option key={option} value={option}>
                {labelize(option)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <FieldLabel>Priority</FieldLabel>
          <select
            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            onChange={(event) => onPriority(event.target.value)}
            value={priority}
          >
            <option value="">All priorities</option>
            {callbackPriorities.map((option) => (
              <option key={option} value={option}>
                {labelize(option)}
              </option>
            ))}
          </select>
        </label>

        <label>
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

function CallbackTable({
  actionLoading,
  items,
  loading,
  onStatus,
  onView,
}: {
  actionLoading: string | null;
  items: HumanCallbackListItem[];
  loading: boolean;
  onStatus: (item: HumanCallbackListItem, status: HumanCallbackStatus) => void;
  onView: (item: HumanCallbackListItem, preferredStatus?: HumanCallbackStatus) => void;
}) {
  if (!loading && items.length === 0) {
    return (
      <EmptyState
        description="Disputes, callback requests, and future escalations will appear here for human follow-up."
        icon={Headphones}
        title="No human callback records found"
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
            <th className="px-4 py-3">Reason</th>
            <th className="px-4 py-3">Priority</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Assigned Agent</th>
            <th className="px-4 py-3">Created At</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? (
            <tr>
              <td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={10}>
                <span className="inline-flex items-center gap-2">
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  Loading callback records
                </span>
              </td>
            </tr>
          ) : (
            items.map((item) => {
              const assignLoading = actionLoading === `${item.id}:assigned`;
              const completeLoading = actionLoading === `${item.id}:completed`;
              const cancelLoading = actionLoading === `${item.id}:cancelled`;
              const terminal = item.status === "completed" || item.status === "cancelled";

              return (
                <tr key={item.id}>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-950">{displayValue(item.customer_name)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{displayValue(item.phone_number)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{displayValue(item.case_reference)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{displayValue(item.lender_name)}</td>
                  <td className="min-w-[240px] px-4 py-3 text-slate-600">
                    <p className="line-clamp-2">{displayValue(item.reason)}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge label={labelize(item.priority)} tone={priorityTone(item.priority)} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge label={labelize(item.status)} tone={statusTone(item.status)} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{displayValue(item.assigned_agent)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDateTime(item.created_at)}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ActionIconButton label="View details" onClick={() => onView(item)}>
                        <Eye aria-hidden="true" className="h-4 w-4" />
                      </ActionIconButton>
                      <ActionIconButton
                        disabled={terminal || item.status === "assigned" || assignLoading}
                        label="Assign"
                        onClick={() => onView(item, "assigned")}
                      >
                        {assignLoading ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <UserCheck aria-hidden="true" className="h-4 w-4" />}
                      </ActionIconButton>
                      <ActionIconButton
                        disabled={item.status === "completed" || completeLoading}
                        label="Mark completed"
                        onClick={() => onStatus(item, "completed")}
                      >
                        {completeLoading ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <CheckCircle2 aria-hidden="true" className="h-4 w-4" />}
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

function CallbackDetailPanel({
  detail,
  detailError,
  editForm,
  loading,
  onChange,
  onClose,
  onSave,
  saving,
}: {
  detail: HumanCallbackDetail | null;
  detailError: string | null;
  editForm: CallbackEditForm;
  loading: boolean;
  onChange: (value: CallbackEditForm) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/30 p-3 sm:p-6" role="dialog" aria-modal="true">
      <article className="ml-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-brand-700">Callback Details</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">{detail?.customer_name ?? "Loading callback"}</h2>
            <p className="mt-1 text-sm text-slate-500">{detail?.case_reference ?? "Review the callback request and assign human follow-up."}</p>
          </div>
          <button
            aria-label="Close callback details"
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
                Loading callback details
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
                    <p className="text-xs font-semibold uppercase text-slate-500">Priority</p>
                    <div className="mt-2">
                      <StatusBadge label={labelize(detail.priority)} tone={priorityTone(detail.priority)} />
                    </div>
                  </article>
                  <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase text-slate-500">Assigned Agent</p>
                    <p className="mt-2 text-sm font-medium text-slate-800">{displayValue(detail.assigned_agent)}</p>
                  </article>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    ["Customer Name", detail.customer_name],
                    ["Phone Number", detail.phone_number],
                    ["Case Reference", detail.case_reference],
                    ["Lender", detail.lender_name],
                    ["Created At", formatDateTime(detail.created_at)],
                    ["Updated At", formatDateTime(detail.updated_at)],
                    ["Requested At", formatDateTime(detail.requested_at)],
                    ["Call Attempt", detail.call_attempt_id],
                    ["Call Status", labelize(detail.call_attempt_status)],
                  ].map(([label, value]) => (
                    <div className="border-t border-slate-200 pt-3" key={label}>
                      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
                      <p className="mt-1 break-words text-sm font-medium text-slate-800">{displayValue(value)}</p>
                    </div>
                  ))}
                </div>

                <section className="space-y-3 border-t border-slate-200 pt-5">
                  <h3 className="text-base font-semibold text-slate-950">Reason</h3>
                  <p className="whitespace-pre-line text-sm leading-6 text-slate-700">{displayValue(detail.reason)}</p>
                </section>

                <section className="space-y-3 border-t border-slate-200 pt-5">
                  <h3 className="text-base font-semibold text-slate-950">Notes</h3>
                  <p className="whitespace-pre-line text-sm leading-6 text-slate-700">{displayValue(detail.notes)}</p>
                </section>
              </section>

              <aside className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                <h3 className="text-base font-semibold text-slate-950">Update Callback</h3>
                <div className="mt-4 space-y-4">
                  <label className="block">
                    <FieldLabel>Status</FieldLabel>
                    <select
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                      onChange={(event) => onChange({ ...editForm, status: event.target.value as HumanCallbackStatus })}
                      value={editForm.status}
                    >
                      {callbackStatuses.map((status) => (
                        <option key={status} value={status}>
                          {labelize(status)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <FieldLabel>Priority</FieldLabel>
                    <select
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                      onChange={(event) => onChange({ ...editForm, priority: event.target.value as HumanCallbackPriority })}
                      value={editForm.priority}
                    >
                      {callbackPriorities.map((priority) => (
                        <option key={priority} value={priority}>
                          {labelize(priority)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <FieldLabel>Assigned Agent</FieldLabel>
                    <input
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                      onChange={(event) => onChange({ ...editForm, assigned_agent: event.target.value })}
                      placeholder="Agent name"
                      value={editForm.assigned_agent}
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

export function HumanCallbacks() {
  const [summary, setSummary] = useState<HumanCallbackSummary>(emptySummary);
  const [summaryUnavailable, setSummaryUnavailable] = useState(false);
  const [items, setItems] = useState<HumanCallbackListItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [alert, setAlert] = useState<AlertState | null>(null);

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [assignedAgentFilter, setAssignedAgentFilter] = useState("");

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<HumanCallbackDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<CallbackEditForm>({
    status: "pending",
    priority: "normal",
    assigned_agent: "",
    notes: "",
  });
  const [savingDetail, setSavingDetail] = useState(false);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const refreshSummary = useCallback(async () => {
    try {
      const payload = await humanCallbacksApi.getSummary();
      setSummary(payload);
      setSummaryUnavailable(false);
    } catch {
      setSummary(emptySummary);
      setSummaryUnavailable(true);
    }
  }, []);

  const refreshList = useCallback(async () => {
    setLoading(true);
    setListError(null);

    try {
      const payload = await humanCallbacksApi.list({
        page,
        page_size: pageSize,
        status: statusFilter,
        priority: priorityFilter,
        assigned_agent: assignedAgentFilter,
      });
      setItems(payload.items);
      setTotalItems(payload.total);
    } catch (error) {
      setItems([]);
      setTotalItems(0);
      setListError(error instanceof Error ? error.message : "Unable to load human callback records.");
    } finally {
      setLoading(false);
    }
  }, [assignedAgentFilter, page, priorityFilter, statusFilter]);

  useEffect(() => {
    void refreshSummary();
  }, [refreshSummary]);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  useEffect(() => {
    setPage(1);
  }, [assignedAgentFilter, priorityFilter, statusFilter]);

  const openDetail = useCallback(async (item: HumanCallbackListItem, preferredStatus?: HumanCallbackStatus) => {
    setSelectedId(item.id);
    setSelectedDetail(null);
    setDetailLoading(true);
    setDetailError(null);

    try {
      const detail = await humanCallbacksApi.get(item.id);
      setSelectedDetail(detail);
      const form = makeEditForm(detail);
      setEditForm(preferredStatus ? { ...form, status: preferredStatus } : form);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "Unable to load callback details.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const updateStatus = useCallback(
    async (item: HumanCallbackListItem, nextStatus: HumanCallbackStatus) => {
      setActionLoading(`${item.id}:${nextStatus}`);
      setAlert(null);

      try {
        const detail = await humanCallbacksApi.update(item.id, { status: nextStatus });
        setAlert({ tone: "success", message: `Callback marked ${labelize(nextStatus)}.` });
        if (selectedId === item.id) {
          setSelectedDetail(detail);
          setEditForm(makeEditForm(detail));
        }
        await Promise.all([refreshSummary(), refreshList()]);
      } catch (error) {
        setAlert({ tone: "error", message: error instanceof Error ? error.message : "Unable to update callback status." });
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

    const { payload } = buildUpdatePayload(editForm);
    setSavingDetail(true);
    setAlert(null);

    try {
      const detail = await humanCallbacksApi.update(selectedDetail.id, payload);
      setSelectedDetail(detail);
      setEditForm(makeEditForm(detail));
      setAlert({ tone: "success", message: "Human callback record updated." });
      await Promise.all([refreshSummary(), refreshList()]);
    } catch (updateError) {
      setAlert({ tone: "error", message: updateError instanceof Error ? updateError.message : "Unable to update human callback record." });
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
        description="Manage customer cases that require human follow-up."
        eyebrow="Follow-ups"
        title="Human Callbacks"
      />

      <SummaryCards summary={summary} unavailable={summaryUnavailable} />

      {alert ? <AlertMessage alert={alert} /> : null}
      {listError ? <AlertMessage alert={{ tone: "error", message: listError }} /> : null}

      <CallbackFilters
        assignedAgent={assignedAgentFilter}
        onAssignedAgent={setAssignedAgentFilter}
        onPriority={setPriorityFilter}
        onRefresh={refreshAll}
        onStatus={setStatusFilter}
        priority={priorityFilter}
        status={statusFilter}
      />

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Callback Records</h2>
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

        <CallbackTable
          actionLoading={actionLoading}
          items={items}
          loading={loading}
          onStatus={updateStatus}
          onView={openDetail}
        />
      </section>

      {selectedId ? (
        <CallbackDetailPanel
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
