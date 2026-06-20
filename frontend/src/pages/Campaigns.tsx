import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  Loader2,
  Megaphone,
  PauseCircle,
  PlayCircle,
  PlusCircle,
  RefreshCw,
  Search,
  UsersRound,
  X,
} from "lucide-react";

import { EmptyState } from "../components/EmptyState";
import { MetricCard } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { campaignsApi } from "../lib/api";
import type {
  CampaignCaseAttachResponse,
  CampaignCreatePayload,
  CampaignDetail,
  CampaignListItem,
  CampaignStatus,
  CampaignSummary,
  CampaignType,
} from "../types";

const pageSize = 10;

const emptySummary: CampaignSummary = {
  total_campaigns: 0,
  draft_campaigns: 0,
  ready_campaigns: 0,
  paused_campaigns: 0,
  completed_campaigns: 0,
  total_cases_in_campaigns: 0,
};

const campaignTypeOptions: Array<{ label: string; value: CampaignType }> = [
  { label: "Payment follow up", value: "payment_follow_up" },
  { label: "Reminder", value: "reminder" },
  { label: "Verification", value: "verification" },
  { label: "Custom", value: "custom" },
];

const campaignStatusOptions: Array<{ label: string; value: CampaignStatus }> = [
  { label: "Draft", value: "draft" },
  { label: "Ready", value: "ready" },
  { label: "Paused", value: "paused" },
  { label: "Completed", value: "completed" },
  { label: "Archived", value: "archived" },
];

const priorityOptions = ["high", "medium", "normal", "low", "critical"];
const caseStatusOptions = ["open", "active", "pending", "closed", "paid", "resolved"];

type AlertTone = "success" | "error" | "warning" | "info";

interface AlertState {
  tone: AlertTone;
  message: string;
}

interface FormState {
  name: string;
  description: string;
  campaign_type: CampaignType;
  status: CampaignStatus;
  lender_name: string;
  priority_filter: string;
  status_filter: string;
  assigned_agent_filter: string;
  min_dpd: string;
  max_dpd: string;
}

const defaultFormState: FormState = {
  name: "",
  description: "",
  campaign_type: "payment_follow_up",
  status: "draft",
  lender_name: "",
  priority_filter: "",
  status_filter: "",
  assigned_agent_filter: "",
  min_dpd: "",
  max_dpd: "",
};

function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function optionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === "") {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return String(value);
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

function formatDpdRange(campaign: Pick<CampaignListItem, "min_dpd" | "max_dpd">): string {
  if (campaign.min_dpd === null && campaign.max_dpd === null) {
    return "-";
  }
  if (campaign.min_dpd !== null && campaign.max_dpd !== null) {
    return `${campaign.min_dpd}-${campaign.max_dpd}`;
  }
  if (campaign.min_dpd !== null) {
    return `${campaign.min_dpd}+`;
  }
  return `0-${campaign.max_dpd}`;
}

function statusTone(status: string | null | undefined): "blue" | "green" | "amber" | "red" | "slate" {
  switch ((status ?? "").toLowerCase()) {
    case "ready":
    case "completed":
    case "active":
    case "paid":
      return "green";
    case "paused":
    case "pending":
    case "medium":
      return "amber";
    case "archived":
    case "closed":
    case "low":
      return "slate";
    case "high":
    case "critical":
    case "overdue":
      return "red";
    default:
      return "blue";
  }
}

function typeTone(type: CampaignType): "blue" | "green" | "amber" | "red" | "slate" {
  if (type === "payment_follow_up") {
    return "blue";
  }
  if (type === "reminder") {
    return "amber";
  }
  if (type === "verification") {
    return "green";
  }
  return "slate";
}

function AlertMessage({ alert }: { alert: AlertState }) {
  const toneClass: Record<AlertTone, string> = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    error: "border-rose-200 bg-rose-50 text-rose-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    info: "border-brand-100 bg-brand-50 text-brand-800",
  };
  const Icon = alert.tone === "success" ? CheckCircle2 : alert.tone === "error" ? AlertCircle : AlertCircle;

  return (
    <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${toneClass[alert.tone]}`}>
      <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{alert.message}</p>
    </div>
  );
}

function SummaryCards({ summary, unavailable }: { summary: CampaignSummary; unavailable: boolean }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      <MetricCard
        accent="blue"
        icon={Megaphone}
        label="Total Campaigns"
        trend={unavailable ? "Backend unavailable" : "Saved campaign records"}
        value={unavailable ? "-" : String(summary.total_campaigns)}
      />
      <MetricCard
        accent="amber"
        icon={ClipboardList}
        label="Draft"
        trend="Being prepared"
        value={unavailable ? "-" : String(summary.draft_campaigns)}
      />
      <MetricCard
        accent="emerald"
        icon={PlayCircle}
        label="Ready"
        trend="Prepared for queueing"
        value={unavailable ? "-" : String(summary.ready_campaigns)}
      />
      <MetricCard
        accent="violet"
        icon={PauseCircle}
        label="Paused"
        trend="Temporarily held"
        value={unavailable ? "-" : String(summary.paused_campaigns)}
      />
      <MetricCard
        accent="rose"
        icon={CheckCircle2}
        label="Completed"
        trend="Closed campaign work"
        value={unavailable ? "-" : String(summary.completed_campaigns)}
      />
      <MetricCard
        accent="blue"
        icon={UsersRound}
        label="Cases in Campaigns"
        trend="Attached cases"
        value={unavailable ? "-" : String(summary.total_cases_in_campaigns)}
      />
    </section>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <span className="text-xs font-semibold uppercase text-slate-500">{children}</span>;
}

function buildCreatePayload(form: FormState): { payload?: CampaignCreatePayload; error?: string } {
  const name = optionalText(form.name);
  if (!name) {
    return { error: "Campaign name is required." };
  }

  const minDpd = optionalNumber(form.min_dpd);
  const maxDpd = optionalNumber(form.max_dpd);

  if (Number.isNaN(minDpd) || Number.isNaN(maxDpd)) {
    return { error: "DPD filters must be valid numbers." };
  }
  if ((minDpd ?? 0) < 0 || (maxDpd ?? 0) < 0) {
    return { error: "DPD filters cannot be negative." };
  }
  if (minDpd !== undefined && maxDpd !== undefined && minDpd > maxDpd) {
    return { error: "Minimum DPD cannot be greater than maximum DPD." };
  }

  return {
    payload: {
      name,
      description: optionalText(form.description),
      campaign_type: form.campaign_type,
      status: form.status,
      lender_name: optionalText(form.lender_name),
      priority_filter: optionalText(form.priority_filter),
      status_filter: optionalText(form.status_filter),
      assigned_agent_filter: optionalText(form.assigned_agent_filter),
      min_dpd: minDpd,
      max_dpd: maxDpd,
    },
  };
}

function CampaignForm({
  creating,
  form,
  onChange,
  onSubmit,
}: {
  creating: boolean;
  form: FormState;
  onChange: (patch: Partial<FormState>) => void;
  onSubmit: () => void;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Create Campaign</h2>
          <p className="mt-1 text-sm text-slate-500">Set filters now, attach cases before future queue generation.</p>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={creating}
          onClick={onSubmit}
          type="button"
        >
          {creating ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <PlusCircle aria-hidden="true" className="h-4 w-4" />}
          Create Campaign
        </button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-4">
        <label className="space-y-2 lg:col-span-2">
          <FieldLabel>Name</FieldLabel>
          <input
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder="June high priority follow up"
            type="text"
            value={form.name}
          />
        </label>

        <label className="space-y-2">
          <FieldLabel>Campaign Type</FieldLabel>
          <select
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            onChange={(event) => onChange({ campaign_type: event.target.value as CampaignType })}
            value={form.campaign_type}
          >
            {campaignTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <FieldLabel>Status</FieldLabel>
          <select
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            onChange={(event) => onChange({ status: event.target.value as CampaignStatus })}
            value={form.status}
          >
            {campaignStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 lg:col-span-4">
          <FieldLabel>Description</FieldLabel>
          <textarea
            className="min-h-20 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            onChange={(event) => onChange({ description: event.target.value })}
            placeholder="Internal notes for managers"
            value={form.description}
          />
        </label>

        <label className="space-y-2">
          <FieldLabel>Lender</FieldLabel>
          <input
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            onChange={(event) => onChange({ lender_name: event.target.value })}
            placeholder="Demo Bank"
            type="text"
            value={form.lender_name}
          />
        </label>

        <label className="space-y-2">
          <FieldLabel>Priority Filter</FieldLabel>
          <select
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            onChange={(event) => onChange({ priority_filter: event.target.value })}
            value={form.priority_filter}
          >
            <option value="">Any priority</option>
            {priorityOptions.map((option) => (
              <option key={option} value={option}>
                {labelize(option)}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <FieldLabel>Status Filter</FieldLabel>
          <select
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            onChange={(event) => onChange({ status_filter: event.target.value })}
            value={form.status_filter}
          >
            <option value="">Any case status</option>
            {caseStatusOptions.map((option) => (
              <option key={option} value={option}>
                {labelize(option)}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <FieldLabel>Assigned Agent</FieldLabel>
          <input
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            onChange={(event) => onChange({ assigned_agent_filter: event.target.value })}
            placeholder="Collector name"
            type="text"
            value={form.assigned_agent_filter}
          />
        </label>

        <label className="space-y-2">
          <FieldLabel>Min DPD</FieldLabel>
          <input
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            min={0}
            onChange={(event) => onChange({ min_dpd: event.target.value })}
            placeholder="0"
            type="number"
            value={form.min_dpd}
          />
        </label>

        <label className="space-y-2">
          <FieldLabel>Max DPD</FieldLabel>
          <input
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            min={0}
            onChange={(event) => onChange({ max_dpd: event.target.value })}
            placeholder="90"
            type="number"
            value={form.max_dpd}
          />
        </label>
      </div>
    </article>
  );
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

function CampaignsTable({
  actionLoading,
  campaigns,
  loading,
  onArchive,
  onStatus,
  onView,
}: {
  actionLoading: string | null;
  campaigns: CampaignListItem[];
  loading: boolean;
  onArchive: (campaign: CampaignListItem) => void;
  onStatus: (campaign: CampaignListItem, status: CampaignStatus) => void;
  onView: (campaign: CampaignListItem) => void;
}) {
  if (!loading && campaigns.length === 0) {
    return (
      <EmptyState
        description="Created campaigns will appear here after managers define filters and attach cases."
        icon={Megaphone}
        title="No campaigns found"
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-soft">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Lender</th>
            <th className="px-4 py-3">Priority Filter</th>
            <th className="px-4 py-3">DPD Range</th>
            <th className="px-4 py-3">Case Count</th>
            <th className="px-4 py-3">Created At</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? (
            <tr>
              <td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={9}>
                <span className="inline-flex items-center gap-2">
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  Loading campaigns
                </span>
              </td>
            </tr>
          ) : (
            campaigns.map((campaign) => {
              const isArchived = campaign.status === "archived";
              const isCompleted = campaign.status === "completed";
              const readyAction = actionLoading === `${campaign.id}:ready`;
              const pauseAction = actionLoading === `${campaign.id}:paused`;
              const archiveAction = actionLoading === `${campaign.id}:archive`;

              return (
                <tr key={campaign.id}>
                  <td className="min-w-[220px] px-4 py-3">
                    <p className="font-medium text-slate-950">{campaign.name}</p>
                    {campaign.description ? <p className="mt-1 line-clamp-1 text-xs text-slate-500">{campaign.description}</p> : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge label={labelize(campaign.campaign_type)} tone={typeTone(campaign.campaign_type)} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge label={labelize(campaign.status)} tone={statusTone(campaign.status)} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{displayValue(campaign.lender_name)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{labelize(campaign.priority_filter)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDpdRange(campaign)}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">{campaign.case_count}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(campaign.created_at)}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ActionIconButton label="View details" onClick={() => onView(campaign)}>
                        <Eye aria-hidden="true" className="h-4 w-4" />
                      </ActionIconButton>
                      <ActionIconButton
                        disabled={campaign.status === "ready" || isArchived || isCompleted || readyAction}
                        label="Mark ready"
                        onClick={() => onStatus(campaign, "ready")}
                      >
                        {readyAction ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <PlayCircle aria-hidden="true" className="h-4 w-4" />}
                      </ActionIconButton>
                      <ActionIconButton
                        disabled={campaign.status === "paused" || isArchived || isCompleted || pauseAction}
                        label="Pause"
                        onClick={() => onStatus(campaign, "paused")}
                      >
                        {pauseAction ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <PauseCircle aria-hidden="true" className="h-4 w-4" />}
                      </ActionIconButton>
                      <ActionIconButton
                        disabled={isArchived || archiveAction}
                        label="Archive"
                        onClick={() => onArchive(campaign)}
                      >
                        {archiveAction ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Archive aria-hidden="true" className="h-4 w-4" />}
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

function AttachResult({ result }: { result: CampaignCaseAttachResponse }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Added", result.added_count],
          ["Skipped", result.skipped_count],
          ["Duplicates", result.duplicate_case_ids.length],
          ["Missing", result.missing_case_ids.length],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-semibold text-slate-950">{value}</p>
          </div>
        ))}
      </div>

      {result.duplicate_case_ids.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Duplicate Case IDs</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {result.duplicate_case_ids.map((id) => (
              <StatusBadge key={id} label={id} tone="amber" />
            ))}
          </div>
        </div>
      ) : null}

      {result.missing_case_ids.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Missing Case IDs</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {result.missing_case_ids.map((id) => (
              <StatusBadge key={id} label={id} tone="red" />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AttachedCasesTable({ campaign }: { campaign: CampaignDetail }) {
  if (campaign.attached_cases.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
        <p className="text-sm font-semibold text-slate-950">No attached cases yet</p>
        <p className="mt-1 text-sm text-slate-500">Paste case IDs below to attach existing cases to this campaign.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
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
            <th className="px-4 py-3">Assigned Agent</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {campaign.attached_cases.map((item) => (
            <tr key={item.id}>
              <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-950">{item.customer_name}</td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">{displayValue(item.phone_number)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">{displayValue(item.case_reference)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">{displayValue(item.lender_name)}</td>
              <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">{formatCurrency(item.outstanding_amount)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">{displayValue(item.dpd)}</td>
              <td className="whitespace-nowrap px-4 py-3">
                <StatusBadge label={labelize(item.priority)} tone={statusTone(item.priority)} />
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <StatusBadge label={labelize(item.status)} tone={statusTone(item.status)} />
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">{displayValue(item.assigned_agent)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CampaignDetailPanel({
  attachInput,
  attachLoading,
  attachResult,
  detailError,
  loading,
  campaign,
  onAttach,
  onAttachInput,
  onClose,
}: {
  attachInput: string;
  attachLoading: boolean;
  attachResult: CampaignCaseAttachResponse | null;
  detailError: string | null;
  loading: boolean;
  campaign: CampaignDetail | null;
  onAttach: () => void;
  onAttachInput: (value: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/30 p-3 sm:p-6" role="dialog" aria-modal="true">
      <article className="ml-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-brand-700">Campaign Details</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">{campaign?.name ?? "Loading campaign"}</h2>
            <p className="mt-1 text-sm text-slate-500">{campaign?.description ?? "Review attached cases and prepare this campaign."}</p>
          </div>
          <button
            aria-label="Close campaign details"
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
                Loading campaign details
              </span>
            </div>
          ) : detailError ? (
            <AlertMessage alert={{ tone: "error", message: detailError }} />
          ) : campaign ? (
            <div className="space-y-6">
              <section className="grid gap-4 border-b border-slate-200 pb-5 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Status</p>
                  <div className="mt-2">
                    <StatusBadge label={labelize(campaign.status)} tone={statusTone(campaign.status)} />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Type</p>
                  <div className="mt-2">
                    <StatusBadge label={labelize(campaign.campaign_type)} tone={typeTone(campaign.campaign_type)} />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Case Count</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">{campaign.case_count}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Created At</p>
                  <p className="mt-2 text-sm font-medium text-slate-800">{formatDate(campaign.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Lender</p>
                  <p className="mt-2 text-sm text-slate-700">{displayValue(campaign.lender_name)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Priority Filter</p>
                  <p className="mt-2 text-sm text-slate-700">{labelize(campaign.priority_filter)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Case Status Filter</p>
                  <p className="mt-2 text-sm text-slate-700">{labelize(campaign.status_filter)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">DPD Range</p>
                  <p className="mt-2 text-sm text-slate-700">{formatDpdRange(campaign)}</p>
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-slate-950">Attached Cases</h3>
                    <p className="mt-1 text-sm text-slate-500">{campaign.attached_cases.length} case record(s)</p>
                  </div>
                </div>
                <AttachedCasesTable campaign={campaign} />
              </section>

              <section className="space-y-3 border-t border-slate-200 pt-5">
                <div>
                  <h3 className="text-base font-semibold text-slate-950">Attach Cases</h3>
                  <p className="mt-1 text-sm text-slate-500">Paste comma-separated case IDs from the Cases table or API response.</p>
                </div>
                <textarea
                  className="min-h-24 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  onChange={(event) => onAttachInput(event.target.value)}
                  placeholder="case-id-1, case-id-2, case-id-3"
                  value={attachInput}
                />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-slate-500">Duplicate or missing IDs are skipped by the backend and reported here.</p>
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={attachLoading}
                    onClick={onAttach}
                    type="button"
                  >
                    {attachLoading ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <PlusCircle aria-hidden="true" className="h-4 w-4" />}
                    Attach Cases
                  </button>
                </div>
                {attachResult ? <AttachResult result={attachResult} /> : null}
              </section>
            </div>
          ) : null}
        </div>
      </article>
    </div>
  );
}

export function Campaigns() {
  const [summary, setSummary] = useState<CampaignSummary>(emptySummary);
  const [summaryUnavailable, setSummaryUnavailable] = useState(false);
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [totalCampaigns, setTotalCampaigns] = useState(0);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campaignsError, setCampaignsError] = useState<string | null>(null);
  const [alert, setAlert] = useState<AlertState | null>(null);

  const [form, setForm] = useState<FormState>(defaultFormState);
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [attachInput, setAttachInput] = useState("");
  const [attachLoading, setAttachLoading] = useState(false);
  const [attachResult, setAttachResult] = useState<CampaignCaseAttachResponse | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCampaigns / pageSize));

  const refreshSummary = useCallback(async () => {
    try {
      const payload = await campaignsApi.getSummary();
      setSummary(payload);
      setSummaryUnavailable(false);
    } catch {
      setSummary(emptySummary);
      setSummaryUnavailable(true);
    }
  }, []);

  const refreshCampaigns = useCallback(async () => {
    setCampaignsLoading(true);
    setCampaignsError(null);

    try {
      const payload = await campaignsApi.listCampaigns({
        page,
        page_size: pageSize,
        search,
      });
      setCampaigns(payload.items);
      setTotalCampaigns(payload.total);
    } catch (error) {
      setCampaigns([]);
      setTotalCampaigns(0);
      setCampaignsError(error instanceof Error ? error.message : "Unable to load campaigns.");
    } finally {
      setCampaignsLoading(false);
    }
  }, [page, search]);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshSummary(), refreshCampaigns()]);
  }, [refreshCampaigns, refreshSummary]);

  const loadCampaignDetail = useCallback(async (campaignId: string) => {
    setDetailLoading(true);
    setDetailError(null);

    try {
      const detail = await campaignsApi.getCampaign(campaignId);
      setSelectedCampaign(detail);
    } catch (error) {
      setSelectedCampaign(null);
      setDetailError(error instanceof Error ? error.message : "Unable to load campaign details.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const selectedTitle = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedCampaignId)?.name ?? selectedCampaign?.name ?? null,
    [campaigns, selectedCampaign, selectedCampaignId],
  );

  async function handleCreateCampaign() {
    const { payload, error } = buildCreatePayload(form);
    if (error || !payload) {
      setAlert({ tone: "warning", message: error ?? "Check campaign fields." });
      return;
    }

    setCreating(true);
    setAlert(null);

    try {
      await campaignsApi.createCampaign(payload);
      setForm(defaultFormState);
      setAlert({ tone: "success", message: "Campaign created successfully." });
      setPage(1);
      await refreshAll();
    } catch (apiError) {
      setAlert({ tone: "error", message: apiError instanceof Error ? apiError.message : "Unable to create campaign." });
    } finally {
      setCreating(false);
    }
  }

  async function handleStatus(campaign: CampaignListItem, status: CampaignStatus) {
    setActionLoading(`${campaign.id}:${status}`);
    setAlert(null);

    try {
      await campaignsApi.updateCampaign(campaign.id, { status });
      setAlert({ tone: "success", message: `${campaign.name} marked ${labelize(status).toLowerCase()}.` });
      await refreshAll();
      if (selectedCampaignId === campaign.id) {
        await loadCampaignDetail(campaign.id);
      }
    } catch (error) {
      setAlert({ tone: "error", message: error instanceof Error ? error.message : "Unable to update campaign." });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleArchive(campaign: CampaignListItem) {
    setActionLoading(`${campaign.id}:archive`);
    setAlert(null);

    try {
      await campaignsApi.archiveCampaign(campaign.id);
      setAlert({ tone: "success", message: `${campaign.name} archived.` });
      await refreshAll();
      if (selectedCampaignId === campaign.id) {
        await loadCampaignDetail(campaign.id);
      }
    } catch (error) {
      setAlert({ tone: "error", message: error instanceof Error ? error.message : "Unable to archive campaign." });
    } finally {
      setActionLoading(null);
    }
  }

  function handleView(campaign: CampaignListItem) {
    setSelectedCampaignId(campaign.id);
    setSelectedCampaign(null);
    setAttachInput("");
    setAttachResult(null);
    void loadCampaignDetail(campaign.id);
  }

  async function handleAttachCases() {
    if (!selectedCampaignId) {
      return;
    }

    const caseIds = Array.from(
      new Set(
        attachInput
          .split(/[,\n]/)
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    );

    if (caseIds.length === 0) {
      setAlert({ tone: "warning", message: "Paste at least one case ID before attaching." });
      return;
    }

    setAttachLoading(true);
    setAttachResult(null);
    setAlert(null);

    try {
      const result = await campaignsApi.attachCases(selectedCampaignId, { case_ids: caseIds });
      setAttachResult(result);
      setAlert({
        tone: result.added_count > 0 ? "success" : "info",
        message: `Attach complete: ${result.added_count} added, ${result.skipped_count} skipped.`,
      });
      setAttachInput("");
      await Promise.all([refreshSummary(), refreshCampaigns(), loadCampaignDetail(selectedCampaignId)]);
    } catch (error) {
      setAlert({ tone: "error", message: error instanceof Error ? error.message : "Unable to attach cases." });
    } finally {
      setAttachLoading(false);
    }
  }

  function closeDetails() {
    setSelectedCampaignId(null);
    setSelectedCampaign(null);
    setDetailError(null);
    setAttachInput("");
    setAttachResult(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Create and prepare case groups before AI calling"
        eyebrow="Outreach"
        title="Campaigns"
      />

      <SummaryCards summary={summary} unavailable={summaryUnavailable} />

      {alert ? <AlertMessage alert={alert} /> : null}

      <CampaignForm
        creating={creating}
        form={form}
        onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
        onSubmit={() => void handleCreateCampaign()}
      />

      <section className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Campaign List</h2>
              <p className="mt-1 text-sm text-slate-500">{totalCampaigns} campaign record(s)</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="relative block sm:w-72">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  onChange={(event) => {
                    setPage(1);
                    setSearch(event.target.value);
                  }}
                  placeholder="Search campaigns"
                  type="search"
                  value={search}
                />
              </label>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={campaignsLoading}
                onClick={() => void refreshAll()}
                type="button"
              >
                <RefreshCw aria-hidden="true" className={`h-4 w-4 ${campaignsLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {campaignsError ? <AlertMessage alert={{ tone: "error", message: campaignsError }} /> : null}

        <CampaignsTable
          actionLoading={actionLoading}
          campaigns={campaigns}
          loading={campaignsLoading}
          onArchive={(campaign) => void handleArchive(campaign)}
          onStatus={(campaign, status) => void handleStatus(campaign, status)}
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
              disabled={page <= 1 || campaignsLoading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              type="button"
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
              Previous
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={page >= totalPages || campaignsLoading}
              onClick={() => setPage((current) => current + 1)}
              type="button"
            >
              Next
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {selectedCampaignId ? (
        <CampaignDetailPanel
          attachInput={attachInput}
          attachLoading={attachLoading}
          attachResult={attachResult}
          campaign={selectedCampaign}
          detailError={detailError}
          loading={detailLoading}
          onAttach={() => void handleAttachCases()}
          onAttachInput={setAttachInput}
          onClose={closeDetails}
        />
      ) : null}

      {selectedCampaignId && !selectedCampaign && selectedTitle ? (
        <span className="sr-only">Opening {selectedTitle}</span>
      ) : null}
    </div>
  );
}
