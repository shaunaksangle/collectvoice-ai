import type { LucideIcon } from "lucide-react";

export type PageKey =
  | "dashboard"
  | "cases"
  | "campaigns"
  | "call-queue"
  | "call-attempts"
  | "promise-to-pay"
  | "human-callbacks"
  | "settings";

export type ConnectionState = "checking" | "online" | "offline";

export interface NavigationItem {
  key: PageKey;
  label: string;
  icon: LucideIcon;
}

export interface SystemStatus {
  app_name: string;
  version: string;
  voice_mode: string;
  telephony_provider: string;
}

export type ApiNumber = number | string;

export interface CaseSummary {
  total_cases: number;
  total_outstanding: number;
  active_cases: number;
  overdue_cases: number;
  high_priority_cases: number;
  missing_phone_cases: number;
}

export interface CaseListItem {
  id: string;
  case_reference: string | null;
  customer_name: string;
  phone_number: string | null;
  lender_name: string | null;
  outstanding_amount: ApiNumber;
  emi_amount: ApiNumber | null;
  due_date: string | null;
  dpd: number | null;
  priority: string;
  assigned_agent: string | null;
  status: string;
  city: string | null;
  state: string | null;
  email: string | null;
  created_at?: string | null;
}

export interface CaseDetail extends CaseListItem {
  principal_amount: ApiNumber;
  currency: string;
  alternate_phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface CaseListParams {
  page?: number;
  page_size?: number;
  search?: string;
  status?: string;
  priority?: string;
  lender_name?: string;
  assigned_agent?: string;
}

export interface PaginatedCaseList {
  total: number;
  page: number;
  page_size: number;
  items: CaseListItem[];
}

export interface UploadValidationError {
  row_number: number;
  field: string;
  issue: string;
  original_value: unknown;
}

export interface CasePreviewRow {
  row_number: number;
  is_valid: boolean;
  customer_name: string | null;
  phone_number: string | null;
  case_reference: string | null;
  lender_name: string | null;
  outstanding_amount: ApiNumber | null;
  emi_amount: ApiNumber | null;
  due_date: string | null;
  dpd: number | string | null;
  priority: string | null;
  assigned_agent: string | null;
  status: string | null;
  city: string | null;
  state: string | null;
  email: string | null;
  alternate_phone: string | null;
}

export interface CaseUploadPreview {
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  errors: UploadValidationError[];
  normalized_columns: Record<string, string>;
  preview_data: CasePreviewRow[];
}

export interface SavedCaseReference {
  id: string;
  case_reference: string;
}

export interface CaseUploadCommit {
  total_rows: number;
  saved_rows: number;
  skipped_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  errors: UploadValidationError[];
  saved_cases: SavedCaseReference[];
  existing_case_references: string[];
  message: string;
}

export type CampaignStatus = "draft" | "ready" | "paused" | "completed" | "archived";

export type CampaignType = "payment_follow_up" | "reminder" | "verification" | "custom";

export interface CampaignSummary {
  total_campaigns: number;
  draft_campaigns: number;
  ready_campaigns: number;
  paused_campaigns: number;
  completed_campaigns: number;
  total_cases_in_campaigns: number;
}

export interface CampaignFilters {
  lender_name?: string | null;
  priority_filter?: string | null;
  status_filter?: string | null;
  assigned_agent_filter?: string | null;
  min_dpd?: number | null;
  max_dpd?: number | null;
}

export interface CampaignCreatePayload extends CampaignFilters {
  name: string;
  description?: string | null;
  campaign_type?: CampaignType;
  status?: CampaignStatus;
}

export interface CampaignUpdatePayload extends Partial<CampaignCreatePayload> {}

export interface CampaignListParams {
  page?: number;
  page_size?: number;
  search?: string;
}

export interface CampaignListItem {
  id: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  campaign_type: CampaignType;
  lender_name: string | null;
  priority_filter: string | null;
  status_filter: string | null;
  assigned_agent_filter: string | null;
  min_dpd: number | null;
  max_dpd: number | null;
  case_count: number;
  created_at: string;
  updated_at: string;
}

export interface CampaignAttachedCase {
  id: string;
  case_reference: string | null;
  customer_name: string;
  phone_number: string | null;
  lender_name: string | null;
  outstanding_amount: ApiNumber;
  dpd: number | null;
  priority: string;
  status: string;
  assigned_agent: string | null;
  added_at: string | null;
}

export interface CampaignDetail extends CampaignListItem {
  attached_cases: CampaignAttachedCase[];
}

export interface PaginatedCampaignList {
  total: number;
  page: number;
  page_size: number;
  items: CampaignListItem[];
}

export interface CampaignCaseAttachRequest extends CampaignFilters {
  case_ids?: string[];
}

export interface CampaignCaseAttachResponse {
  added_count: number;
  skipped_count: number;
  missing_case_ids: string[];
  duplicate_case_ids: string[];
  added_case_ids: string[];
}

export interface CampaignEligibleCasesResponse {
  total: number;
  page: number;
  page_size: number;
  items: CampaignAttachedCase[];
}

export type CallAttemptStatus =
  | "pending"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "failed"
  | "skipped"
  | "cancelled";

export interface CallQueueSummary {
  total_queue_items: number;
  pending_calls: number;
  scheduled_calls: number;
  in_progress_calls: number;
  completed_calls: number;
  failed_calls: number;
  cancelled_calls: number;
}

export interface CallAttempt {
  id: string;
  campaign_id: string | null;
  campaign_name: string | null;
  case_id: string;
  case_reference: string | null;
  customer_id: string | null;
  customer_name: string;
  phone_number: string | null;
  status: CallAttemptStatus;
  attempt_number: number;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  provider_call_id: string | null;
  failure_reason: string | null;
  last_error: string | null;
  lender_name: string | null;
  priority: string;
  assigned_agent: string | null;
  outstanding_amount: ApiNumber;
  created_at: string;
  updated_at: string;
}

export interface CallQueueListParams {
  page?: number;
  page_size?: number;
  campaign_id?: string;
  status?: string;
  priority?: string;
  assigned_agent?: string;
  lender_name?: string;
  scheduled_from?: string;
  scheduled_to?: string;
}

export interface PaginatedCallQueueList {
  total: number;
  page: number;
  page_size: number;
  items: CallAttempt[];
}

export interface CallQueueGeneratePayload {
  scheduled_at?: string | null;
}

export interface CallQueueGenerateResponse {
  campaign_id: string;
  total_campaign_cases: number;
  created_count: number;
  skipped_duplicate_count: number;
  skipped_missing_phone_count: number;
  created_call_attempt_ids: string[];
}

export interface CallAttemptUpdatePayload {
  status?: CallAttemptStatus;
  scheduled_at?: string | null;
  failure_reason?: string | null;
  last_error?: string | null;
}

export type MockCallOutcomeType =
  | "promise_to_pay"
  | "already_paid"
  | "callback_requested"
  | "no_answer"
  | "wrong_number"
  | "dispute"
  | "refused_to_pay"
  | "unreachable";

export interface MockCallSummary {
  total_outcomes: number;
  completed_calls: number;
  failed_calls: number;
  promise_to_pay_count: number;
  already_paid_count: number;
  callback_required_count: number;
  no_answer_count: number;
  wrong_number_count: number;
  dispute_count: number;
  refused_to_pay_count: number;
  unreachable_count: number;
}

export interface MockCallRunPayload {
  outcome_type?: MockCallOutcomeType;
  promise_date?: string | null;
  promise_amount?: ApiNumber | null;
  callback_reason?: string | null;
  notes?: string | null;
}

export interface MockCallOutcome {
  id: string;
  call_attempt_id: string;
  campaign_id: string | null;
  campaign_name: string | null;
  case_id: string;
  case_reference: string | null;
  customer_id: string | null;
  customer_name: string | null;
  phone_number: string | null;
  outcome_type: MockCallOutcomeType;
  disposition: string | null;
  summary: string | null;
  detected_intent: string | null;
  sentiment: string | null;
  promise_date: string | null;
  promise_amount: ApiNumber | null;
  callback_required: boolean;
  callback_reason: string | null;
  human_review_required: boolean;
  created_at: string;
}

export interface MockCallOutcomeDetail extends MockCallOutcome {
  transcript: string | null;
  next_action: string | null;
  call_attempt_status: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  updated_at: string;
}

export interface MockCallOutcomeListParams {
  page?: number;
  page_size?: number;
  outcome_type?: string;
  campaign_id?: string;
  case_id?: string;
  customer_id?: string;
  callback_required?: boolean;
  human_review_required?: boolean;
}

export interface PaginatedMockCallOutcomeList {
  total: number;
  page: number;
  page_size: number;
  items: MockCallOutcome[];
}

export interface MockCallRunResponse {
  call_attempt_id: string;
  final_status: string;
  outcome: {
    id: string;
    outcome_type: MockCallOutcomeType;
    disposition: string | null;
    summary: string | null;
    transcript: string | null;
    detected_intent: string | null;
    sentiment: string | null;
    promise_date: string | null;
    promise_amount: ApiNumber | null;
    callback_required: boolean;
    callback_reason: string | null;
    human_review_required: boolean;
    created_at: string;
    updated_at: string;
  };
  promise_to_pay_id: string | null;
  human_callback_id: string | null;
  transcript: string;
}

export interface MockCallBatchPayload {
  limit?: number;
  campaign_id?: string | null;
  status?: "pending" | "scheduled" | null;
  outcome_type?: MockCallOutcomeType | null;
  dry_run?: boolean;
}

export interface MockCallBatchError {
  call_attempt_id: string;
  issue: string;
}

export interface MockCallBatchResponse {
  dry_run: boolean;
  selected_count: number;
  processed_count: number;
  completed_count: number;
  failed_count: number;
  promise_to_pay_count: number;
  callback_required_count: number;
  skipped_count: number;
  processed_call_attempt_ids: string[];
  skipped_call_attempt_ids: string[];
  errors: MockCallBatchError[];
}

export type PromiseToPayStatus = "pending" | "fulfilled" | "broken" | "cancelled";

export interface PromiseToPaySummary {
  total_ptp: number;
  pending_ptp: number;
  fulfilled_ptp: number;
  broken_ptp: number;
  cancelled_ptp: number;
  overdue_ptp: number;
  total_promised_amount: ApiNumber;
  pending_promised_amount: ApiNumber;
}

export interface PromiseToPayListItem {
  id: string;
  case_id: string;
  case_reference: string | null;
  customer_id: string | null;
  customer_name: string | null;
  phone_number: string | null;
  promised_amount: ApiNumber;
  promised_date: string;
  status: PromiseToPayStatus;
  source: string;
  notes: string | null;
  lender_name: string | null;
  assigned_agent: string | null;
  created_at: string;
  updated_at: string;
}

export interface PromiseToPayDetail extends PromiseToPayListItem {
  call_attempt_id: string | null;
  call_attempt_status: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
}

export interface PromiseToPayListParams {
  page?: number;
  page_size?: number;
  status?: string;
  case_id?: string;
  customer_id?: string;
  assigned_agent?: string;
  due_from?: string;
  due_to?: string;
  overdue_only?: boolean;
}

export interface PaginatedPromiseToPayList {
  total: number;
  page: number;
  page_size: number;
  items: PromiseToPayListItem[];
}

export interface PromiseToPayUpdatePayload {
  status?: PromiseToPayStatus;
  promised_amount?: ApiNumber;
  promised_date?: string;
  notes?: string | null;
}

export type HumanCallbackStatus = "pending" | "assigned" | "completed" | "cancelled";
export type HumanCallbackPriority = "low" | "normal" | "high" | "critical";

export interface HumanCallbackSummary {
  total_callbacks: number;
  pending_callbacks: number;
  assigned_callbacks: number;
  completed_callbacks: number;
  cancelled_callbacks: number;
  high_priority_callbacks: number;
}

export interface HumanCallbackListItem {
  id: string;
  case_id: string;
  case_reference: string | null;
  customer_id: string | null;
  customer_name: string | null;
  phone_number: string | null;
  reason: string | null;
  priority: HumanCallbackPriority;
  status: HumanCallbackStatus;
  assigned_agent: string | null;
  notes: string | null;
  lender_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface HumanCallbackDetail extends HumanCallbackListItem {
  call_attempt_id: string | null;
  call_attempt_status: string | null;
  requested_at: string | null;
  preferred_time: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
}

export interface HumanCallbackListParams {
  page?: number;
  page_size?: number;
  status?: string;
  priority?: string;
  assigned_agent?: string;
  case_id?: string;
  customer_id?: string;
}

export interface PaginatedHumanCallbackList {
  total: number;
  page: number;
  page_size: number;
  items: HumanCallbackListItem[];
}

export interface HumanCallbackUpdatePayload {
  status?: HumanCallbackStatus;
  priority?: HumanCallbackPriority;
  assigned_agent?: string | null;
  notes?: string | null;
}
