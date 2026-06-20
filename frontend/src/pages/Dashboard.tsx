import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  Bot,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Headphones,
  IndianRupee,
  Layers3,
  ListChecks,
  Loader2,
  Megaphone,
  PhoneCall,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  UploadCloud,
  XCircle,
} from "lucide-react";

import { MetricCard } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import {
  callQueueApi,
  campaignsApi,
  getSummary,
  humanCallbacksApi,
  mockCallsApi,
  promiseToPayApi,
} from "../lib/api";
import type {
  CallQueueSummary,
  CampaignSummary,
  CaseSummary,
  ConnectionState,
  HumanCallbackListItem,
  HumanCallbackSummary,
  MockCallOutcome,
  MockCallSummary,
  PageKey,
  PromiseToPayListItem,
  PromiseToPaySummary,
  SystemStatus,
} from "../types";

interface DashboardProps {
  connectionState: ConnectionState;
  onNavigate: (page: PageKey) => void;
  status: SystemStatus;
}

const emptyCaseSummary: CaseSummary = {
  total_cases: 0,
  total_outstanding: 0,
  active_cases: 0,
  overdue_cases: 0,
  high_priority_cases: 0,
  missing_phone_cases: 0,
};

const emptyCampaignSummary: CampaignSummary = {
  total_campaigns: 0,
  draft_campaigns: 0,
  ready_campaigns: 0,
  paused_campaigns: 0,
  completed_campaigns: 0,
  total_cases_in_campaigns: 0,
};

const emptyQueueSummary: CallQueueSummary = {
  total_queue_items: 0,
  pending_calls: 0,
  scheduled_calls: 0,
  in_progress_calls: 0,
  completed_calls: 0,
  failed_calls: 0,
  cancelled_calls: 0,
};

const emptyMockSummary: MockCallSummary = {
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

const emptyPtpSummary: PromiseToPaySummary = {
  total_ptp: 0,
  pending_ptp: 0,
  fulfilled_ptp: 0,
  broken_ptp: 0,
  cancelled_ptp: 0,
  overdue_ptp: 0,
  total_promised_amount: 0,
  pending_promised_amount: 0,
};

const emptyCallbackSummary: HumanCallbackSummary = {
  total_callbacks: 0,
  pending_callbacks: 0,
  assigned_callbacks: 0,
  completed_callbacks: 0,
  cancelled_callbacks: 0,
  high_priority_callbacks: 0,
};

type BadgeTone = "blue" | "green" | "amber" | "red" | "slate";

interface ModuleStatus {
  cases: boolean;
  campaigns: boolean;
  queue: boolean;
  mockCalls: boolean;
  ptp: boolean;
  callbacks: boolean;
}

interface WorkflowItem {
  count: string;
  description: string;
  icon: typeof ReceiptText;
  label: string;
  ready: boolean;
}

interface QuickAction {
  description: string;
  icon: typeof ReceiptText;
  label: string;
  page: PageKey;
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

function toneForValue(value: string | boolean | null | undefined): BadgeTone {
  if (typeof value === "boolean") {
    return value ? "green" : "amber";
  }

  switch ((value ?? "").toLowerCase()) {
    case "fulfilled":
    case "completed":
    case "already_paid":
    case "promise_to_pay":
    case "online":
    case "ready":
      return "green";
    case "pending":
    case "scheduled":
    case "mock":
    case "draft":
    case "callback_requested":
      return "amber";
    case "failed":
    case "broken":
    case "dispute":
    case "no_answer":
    case "wrong_number":
    case "unreachable":
    case "high":
    case "critical":
      return "red";
    case "cancelled":
    case "disabled":
    case "offline":
      return "slate";
    default:
      return "blue";
  }
}

function SectionTitle({ action, description, title }: { action?: ReactNode; description: string; title: string }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

function Banner({ connectionState, hasErrors }: { connectionState: ConnectionState; hasErrors: boolean }) {
  if (connectionState === "online" && !hasErrors) {
    return null;
  }

  const message =
    connectionState === "offline"
      ? "Backend unavailable. The dashboard layout is intact, but live metrics could not be loaded."
      : hasErrors
        ? "Some dashboard modules could not be loaded. Available modules are still shown below."
        : "Checking backend connection.";

  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}

function EnvironmentBadges({
  connectionState,
  status,
}: {
  connectionState: ConnectionState;
  status: SystemStatus;
}) {
  const apiLabel = connectionState === "online" ? "API Online" : connectionState === "checking" ? "API Checking" : "API Offline";
  const apiTone: BadgeTone = connectionState === "online" ? "green" : connectionState === "checking" ? "amber" : "slate";

  return (
    <section className="flex flex-wrap gap-2">
      <StatusBadge label="Mock Mode Active" tone={status.voice_mode === "mock" ? "amber" : "blue"} />
      <StatusBadge label={apiLabel} tone={apiTone} />
      <StatusBadge label="Live Calling Disabled" tone="slate" />
      <StatusBadge label="Ready for Sarvam Integration Later" tone="blue" />
    </section>
  );
}

function WorkflowReadiness({ items }: { items: WorkflowItem[] }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft" key={item.label}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-500">{item.label}</p>
                <p className="mt-3 text-2xl font-semibold text-slate-950">{item.count}</p>
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${item.ready ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                <Icon aria-hidden="true" className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs font-medium leading-5 text-slate-500">{item.description}</p>
              <StatusBadge label={item.ready ? "Ready" : "Needs data"} tone={item.ready ? "green" : "amber"} />
            </div>
          </article>
        );
      })}
    </section>
  );
}

function QuickActions({ onNavigate }: { onNavigate: (page: PageKey) => void }) {
  const actions: QuickAction[] = [
    { label: "Upload Cases", description: "Import and validate collection files.", icon: UploadCloud, page: "cases" },
    { label: "Create Campaign", description: "Group eligible cases for calling.", icon: Megaphone, page: "campaigns" },
    { label: "Generate Queue", description: "Prepare pending call attempts.", icon: ListChecks, page: "call-queue" },
    { label: "Run Mock Calls", description: "Simulate safe reminder calls.", icon: Bot, page: "call-attempts" },
    { label: "Review PTP", description: "Track promised payment dates.", icon: CalendarCheck, page: "promise-to-pay" },
    { label: "Review Callbacks", description: "Assign human follow-up work.", icon: Headphones, page: "human-callbacks" },
  ];

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            className="group rounded-lg border border-slate-200 bg-white p-5 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lg"
            key={action.label}
            onClick={() => onNavigate(action.page)}
            type="button"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <Icon aria-hidden="true" className="h-5 w-5" />
              </div>
              <ChevronRight aria-hidden="true" className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-brand-700" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-slate-950">{action.label}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">{action.description}</p>
          </button>
        );
      })}
    </section>
  );
}

function ActivityPanel({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white shadow-soft">
      <div className="border-b border-slate-200 px-5 py-4">
        <h3 className="text-base font-semibold text-slate-950">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </article>
  );
}

function InlineEmptyState({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: typeof ReceiptText;
  title: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
        <Icon aria-hidden="true" className="h-5 w-5" />
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-950">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}

function RecentOutcomes({ items, loading }: { items: MockCallOutcome[]; loading: boolean }) {
  if (loading) {
    return <LoadingRows label="Loading recent outcomes" />;
  }

  if (items.length === 0) {
    return <InlineEmptyState description="Run mock calls to create outcome records for this activity panel." icon={PhoneCall} title="No recent outcomes" />;
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4 last:border-b-0 last:pb-0" key={item.id}>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950">{displayValue(item.customer_name)}</p>
            <p className="mt-1 truncate text-xs text-slate-500">{displayValue(item.case_reference)} · {formatDateTime(item.created_at)}</p>
          </div>
          <StatusBadge label={labelize(item.outcome_type)} tone={toneForValue(item.outcome_type)} />
        </div>
      ))}
    </div>
  );
}

function PendingPromises({ items, loading }: { items: PromiseToPayListItem[]; loading: boolean }) {
  if (loading) {
    return <LoadingRows label="Loading pending PTP records" />;
  }

  if (items.length === 0) {
    return <InlineEmptyState description="Pending customer commitments will appear after promise-to-pay outcomes." icon={CalendarCheck} title="No pending PTP records" />;
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4 last:border-b-0 last:pb-0" key={item.id}>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950">{displayValue(item.customer_name)}</p>
            <p className="mt-1 truncate text-xs text-slate-500">{formatCurrency(item.promised_amount)} due {formatDate(item.promised_date)}</p>
          </div>
          <StatusBadge label={labelize(item.status)} tone={toneForValue(item.status)} />
        </div>
      ))}
    </div>
  );
}

function PendingCallbacks({ items, loading }: { items: HumanCallbackListItem[]; loading: boolean }) {
  if (loading) {
    return <LoadingRows label="Loading pending callbacks" />;
  }

  if (items.length === 0) {
    return <InlineEmptyState description="Pending human follow-ups will appear after callback or dispute outcomes are created." icon={Headphones} title="No pending callbacks" />;
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4 last:border-b-0 last:pb-0" key={item.id}>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950">{displayValue(item.customer_name)}</p>
            <p className="mt-1 line-clamp-1 text-xs text-slate-500">{displayValue(item.reason)}</p>
          </div>
          <StatusBadge label={labelize(item.priority)} tone={toneForValue(item.priority)} />
        </div>
      ))}
    </div>
  );
}

function LoadingRows({ label }: { label: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center text-sm text-slate-500">
      <span className="inline-flex items-center gap-2">
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        {label}
      </span>
    </div>
  );
}

export function Dashboard({ connectionState, onNavigate, status }: DashboardProps) {
  const [caseSummary, setCaseSummary] = useState<CaseSummary>(emptyCaseSummary);
  const [campaignSummary, setCampaignSummary] = useState<CampaignSummary>(emptyCampaignSummary);
  const [queueSummary, setQueueSummary] = useState<CallQueueSummary>(emptyQueueSummary);
  const [mockSummary, setMockSummary] = useState<MockCallSummary>(emptyMockSummary);
  const [ptpSummary, setPtpSummary] = useState<PromiseToPaySummary>(emptyPtpSummary);
  const [callbackSummary, setCallbackSummary] = useState<HumanCallbackSummary>(emptyCallbackSummary);
  const [recentOutcomes, setRecentOutcomes] = useState<MockCallOutcome[]>([]);
  const [pendingPromises, setPendingPromises] = useState<PromiseToPayListItem[]>([]);
  const [pendingCallbacks, setPendingCallbacks] = useState<HumanCallbackListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [moduleStatus, setModuleStatus] = useState<ModuleStatus>({
    cases: true,
    campaigns: true,
    queue: true,
    mockCalls: true,
    ptp: true,
    callbacks: true,
  });

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setActivityLoading(true);

    const [
      casesResult,
      campaignsResult,
      queueResult,
      mockResult,
      ptpResult,
      callbacksResult,
      outcomesResult,
      pendingPtpResult,
      pendingCallbacksResult,
    ] = await Promise.allSettled([
      getSummary(),
      campaignsApi.getSummary(),
      callQueueApi.getSummary(),
      mockCallsApi.getSummary(),
      promiseToPayApi.getSummary(),
      humanCallbacksApi.getSummary(),
      mockCallsApi.listOutcomes({ page: 1, page_size: 5 }),
      promiseToPayApi.list({ page: 1, page_size: 5, status: "pending" }),
      humanCallbacksApi.list({ page: 1, page_size: 5, status: "pending" }),
    ]);

    setCaseSummary(casesResult.status === "fulfilled" ? casesResult.value : emptyCaseSummary);
    setCampaignSummary(campaignsResult.status === "fulfilled" ? campaignsResult.value : emptyCampaignSummary);
    setQueueSummary(queueResult.status === "fulfilled" ? queueResult.value : emptyQueueSummary);
    setMockSummary(mockResult.status === "fulfilled" ? mockResult.value : emptyMockSummary);
    setPtpSummary(ptpResult.status === "fulfilled" ? ptpResult.value : emptyPtpSummary);
    setCallbackSummary(callbacksResult.status === "fulfilled" ? callbacksResult.value : emptyCallbackSummary);
    setRecentOutcomes(outcomesResult.status === "fulfilled" ? outcomesResult.value.items : []);
    setPendingPromises(pendingPtpResult.status === "fulfilled" ? pendingPtpResult.value.items : []);
    setPendingCallbacks(pendingCallbacksResult.status === "fulfilled" ? pendingCallbacksResult.value.items : []);
    setModuleStatus({
      cases: casesResult.status === "fulfilled",
      campaigns: campaignsResult.status === "fulfilled",
      queue: queueResult.status === "fulfilled",
      mockCalls: mockResult.status === "fulfilled" && outcomesResult.status === "fulfilled",
      ptp: ptpResult.status === "fulfilled" && pendingPtpResult.status === "fulfilled",
      callbacks: callbacksResult.status === "fulfilled" && pendingCallbacksResult.status === "fulfilled",
    });
    setLoading(false);
    setActivityLoading(false);
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const hasModuleErrors = Object.values(moduleStatus).some((isReady) => !isReady);

  const workflowItems = useMemo<WorkflowItem[]>(
    () => [
      {
        label: "Cases uploaded",
        count: moduleStatus.cases ? String(caseSummary.total_cases) : "-",
        description: "Collection cases available for campaigns.",
        icon: ReceiptText,
        ready: caseSummary.total_cases > 0,
      },
      {
        label: "Campaigns created",
        count: moduleStatus.campaigns ? String(campaignSummary.total_campaigns) : "-",
        description: "Campaign shells prepared by managers.",
        icon: Megaphone,
        ready: campaignSummary.total_campaigns > 0,
      },
      {
        label: "Call queue generated",
        count: moduleStatus.queue ? String(queueSummary.total_queue_items) : "-",
        description: "Pending or scheduled attempts exist.",
        icon: ListChecks,
        ready: queueSummary.total_queue_items > 0,
      },
      {
        label: "Mock calls executed",
        count: moduleStatus.mockCalls ? String(mockSummary.total_outcomes) : "-",
        description: "Safe simulated call outcomes saved.",
        icon: Bot,
        ready: mockSummary.total_outcomes > 0,
      },
      {
        label: "Follow-ups created",
        count: moduleStatus.ptp && moduleStatus.callbacks ? String(ptpSummary.total_ptp + callbackSummary.total_callbacks) : "-",
        description: "PTP and callback work ready to review.",
        icon: Layers3,
        ready: ptpSummary.total_ptp + callbackSummary.total_callbacks > 0,
      },
    ],
    [callbackSummary.total_callbacks, campaignSummary.total_campaigns, caseSummary.total_cases, mockSummary.total_outcomes, moduleStatus, ptpSummary.total_ptp, queueSummary.total_queue_items],
  );

  return (
    <div className="space-y-8">
      <div>
        <PageHeader
          description="Production-style manager view for the complete mock collection calling workflow."
          eyebrow="Operations"
          title="Dashboard"
        />
        <EnvironmentBadges connectionState={connectionState} status={status} />
      </div>

      <Banner connectionState={connectionState} hasErrors={hasModuleErrors} />

      <section className="space-y-4">
        <SectionTitle
          action={
            <button
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-soft transition hover:bg-slate-50"
              onClick={() => void loadDashboard()}
              type="button"
            >
              {loading ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <RefreshCw aria-hidden="true" className="h-4 w-4" />}
              Refresh
            </button>
          }
          description="Portfolio scale, campaign preparation, and mock call health."
          title="Operations Overview"
        />
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <MetricCard
            accent="blue"
            icon={ReceiptText}
            label="Total Cases"
            trend={moduleStatus.cases ? "Uploaded portfolio" : "Backend unavailable"}
            value={moduleStatus.cases ? String(caseSummary.total_cases) : "-"}
          />
          <MetricCard
            accent="violet"
            icon={IndianRupee}
            label="Total Outstanding"
            trend="Outstanding balance"
            value={moduleStatus.cases ? formatCurrency(caseSummary.total_outstanding) : "-"}
          />
          <MetricCard
            accent="blue"
            icon={Megaphone}
            label="Total Campaigns"
            trend={`${campaignSummary.ready_campaigns} ready`}
            value={moduleStatus.campaigns ? String(campaignSummary.total_campaigns) : "-"}
          />
          <MetricCard
            accent="amber"
            icon={ListChecks}
            label="Queue Items"
            trend={`${queueSummary.pending_calls} pending, ${queueSummary.scheduled_calls} scheduled`}
            value={moduleStatus.queue ? String(queueSummary.total_queue_items) : "-"}
          />
          <MetricCard
            accent="emerald"
            icon={CheckCircle2}
            label="Completed Calls"
            trend="Mock completed"
            value={moduleStatus.mockCalls ? String(mockSummary.completed_calls) : "-"}
          />
          <MetricCard
            accent="rose"
            icon={XCircle}
            label="Failed Calls"
            trend="No answer or unreachable"
            value={moduleStatus.mockCalls ? String(mockSummary.failed_calls) : "-"}
          />
        </section>
      </section>

      <section className="space-y-4">
        <SectionTitle
          description="Manager attention areas created by mock call outcomes."
          title="Follow-up Outcomes"
        />
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <MetricCard accent="emerald" icon={CalendarCheck} label="Promise To Pay" trend="Total commitments" value={moduleStatus.ptp ? String(ptpSummary.total_ptp) : "-"} />
          <MetricCard
            accent="blue"
            icon={IndianRupee}
            label="Pending Promised Amount"
            trend={`${ptpSummary.pending_ptp} pending PTP`}
            value={moduleStatus.ptp ? formatCurrency(ptpSummary.pending_promised_amount) : "-"}
          />
          <MetricCard accent="amber" icon={Headphones} label="Human Callbacks" trend="Total callback tasks" value={moduleStatus.callbacks ? String(callbackSummary.total_callbacks) : "-"} />
          <MetricCard accent="rose" icon={AlertCircle} label="High Priority Callbacks" trend="Needs manager attention" value={moduleStatus.callbacks ? String(callbackSummary.high_priority_callbacks) : "-"} />
          <MetricCard accent="amber" icon={PhoneCall} label="No Answer" trend="Retry candidates" value={moduleStatus.mockCalls ? String(mockSummary.no_answer_count) : "-"} />
          <MetricCard accent="rose" icon={ShieldCheck} label="Disputes" trend="Human review likely" value={moduleStatus.mockCalls ? String(mockSummary.dispute_count) : "-"} />
        </section>
      </section>

      <section className="space-y-4">
        <SectionTitle description="A quick readiness scan for demo and manager handoff." title="Workflow Readiness" />
        <WorkflowReadiness items={workflowItems} />
      </section>

      <section className="space-y-4">
        <SectionTitle description="Jump to the next operational step without hunting through the sidebar." title="Quick Actions" />
        <QuickActions onNavigate={onNavigate} />
      </section>

      <section className="space-y-4">
        <SectionTitle description="Short activity lists from the current mock data set." title="Recent Activity" />
        <section className="grid gap-6 xl:grid-cols-3">
          <ActivityPanel title="Recent Call Outcomes">
            <RecentOutcomes items={recentOutcomes} loading={activityLoading} />
          </ActivityPanel>
          <ActivityPanel title="Pending Promise To Pay">
            <PendingPromises items={pendingPromises} loading={activityLoading} />
          </ActivityPanel>
          <ActivityPanel title="Pending Human Callbacks">
            <PendingCallbacks items={pendingCallbacks} loading={activityLoading} />
          </ActivityPanel>
        </section>
      </section>
    </div>
  );
}
