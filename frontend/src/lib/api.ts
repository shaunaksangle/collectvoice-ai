import type {
  CallAttempt,
  CallAttemptUpdatePayload,
  CallQueueGeneratePayload,
  CallQueueGenerateResponse,
  CallQueueListParams,
  CallQueueSummary,
  CampaignCaseAttachRequest,
  CampaignCaseAttachResponse,
  CampaignCreatePayload,
  CampaignDetail,
  CampaignEligibleCasesResponse,
  CampaignListItem,
  CampaignListParams,
  CampaignSummary,
  CampaignUpdatePayload,
  CaseDetail,
  CaseListParams,
  CaseSummary,
  CaseUploadCommit,
  CaseUploadPreview,
  MockCallBatchPayload,
  MockCallBatchResponse,
  MockCallOutcomeDetail,
  MockCallOutcomeListParams,
  MockCallRunPayload,
  MockCallRunResponse,
  MockCallSummary,
  PaginatedCallQueueList,
  PaginatedCampaignList,
  PaginatedCaseList,
  PaginatedHumanCallbackList,
  PaginatedMockCallOutcomeList,
  PaginatedPromiseToPayList,
  HumanCallbackDetail,
  HumanCallbackListParams,
  HumanCallbackSummary,
  HumanCallbackUpdatePayload,
  PromiseToPayDetail,
  PromiseToPayListParams,
  PromiseToPaySummary,
  PromiseToPayUpdatePayload,
  SystemStatus,
} from "../types";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000/api/v1";

function normalizeBaseUrl(value: string | undefined): string {
  const url = (value ?? DEFAULT_API_BASE_URL).replace(/\/$/, "");
  return url.endsWith("/api/v1") ? url : `${url}/api/v1`;
}

export const API_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE_URL);

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);

  if (!response.ok) {
    let message = `Request failed with ${response.status}`;

    try {
      const payload = (await response.json()) as {
        detail?: string | Array<{ msg?: string }>;
      };
      if (typeof payload.detail === "string") {
        message = payload.detail;
      } else if (Array.isArray(payload.detail)) {
        message = payload.detail.map((issue) => issue.msg ?? "Validation error").join("; ");
      }
    } catch {
      message = response.statusText || message;
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function jsonRequest<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");

  return request<T>(path, {
    ...init,
    headers,
    body: JSON.stringify(body),
  });
}

export async function fetchSystemStatus(signal?: AbortSignal): Promise<SystemStatus> {
  return request<SystemStatus>("/status", { signal });
}

export function getSummary(signal?: AbortSignal): Promise<CaseSummary> {
  return request<CaseSummary>("/cases/summary", { signal });
}

export function listCases(params: CaseListParams = {}, signal?: AbortSignal): Promise<PaginatedCaseList> {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      query.set(key, String(value));
    }
  });

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<PaginatedCaseList>(`/cases${suffix}`, { signal });
}

export function getCase(id: string, signal?: AbortSignal): Promise<CaseDetail> {
  return request<CaseDetail>(`/cases/${id}`, { signal });
}

export function previewUpload(file: File): Promise<CaseUploadPreview> {
  const body = new FormData();
  body.append("file", file);
  return request<CaseUploadPreview>("/cases/upload/preview", {
    method: "POST",
    body,
  });
}

export function commitUpload(file: File): Promise<CaseUploadCommit> {
  const body = new FormData();
  body.append("file", file);
  return request<CaseUploadCommit>("/cases/upload/commit", {
    method: "POST",
    body,
  });
}

export function getCampaignSummary(signal?: AbortSignal): Promise<CampaignSummary> {
  return request<CampaignSummary>("/campaigns/summary", { signal });
}

export function listCampaigns(params: CampaignListParams = {}, signal?: AbortSignal): Promise<PaginatedCampaignList> {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      query.set(key, String(value));
    }
  });

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<PaginatedCampaignList>(`/campaigns${suffix}`, { signal });
}

export function getCampaign(id: string, signal?: AbortSignal): Promise<CampaignDetail> {
  return request<CampaignDetail>(`/campaigns/${id}`, { signal });
}

export function createCampaign(payload: CampaignCreatePayload): Promise<CampaignListItem> {
  return jsonRequest<CampaignListItem>("/campaigns", payload, { method: "POST" });
}

export function updateCampaign(id: string, payload: CampaignUpdatePayload): Promise<CampaignListItem> {
  return jsonRequest<CampaignListItem>(`/campaigns/${id}`, payload, { method: "PATCH" });
}

export function archiveCampaign(id: string): Promise<CampaignListItem> {
  return request<CampaignListItem>(`/campaigns/${id}`, { method: "DELETE" });
}

export function getEligibleCases(
  id: string,
  params: CampaignListParams = {},
  signal?: AbortSignal,
): Promise<CampaignEligibleCasesResponse> {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      query.set(key, String(value));
    }
  });

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<CampaignEligibleCasesResponse>(`/campaigns/${id}/eligible-cases${suffix}`, { signal });
}

export function attachCases(id: string, payload: CampaignCaseAttachRequest): Promise<CampaignCaseAttachResponse> {
  return jsonRequest<CampaignCaseAttachResponse>(`/campaigns/${id}/cases`, payload, { method: "POST" });
}

export function removeCase(campaignId: string, caseId: string): Promise<void> {
  return request<void>(`/campaigns/${campaignId}/cases/${caseId}`, { method: "DELETE" });
}

export const campaignsApi = {
  getSummary: getCampaignSummary,
  listCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  archiveCampaign,
  getEligibleCases,
  attachCases,
  removeCase,
};

export function getCallQueueSummary(signal?: AbortSignal): Promise<CallQueueSummary> {
  return request<CallQueueSummary>("/call-queue/summary", { signal });
}

export function listCallQueue(params: CallQueueListParams = {}, signal?: AbortSignal): Promise<PaginatedCallQueueList> {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      query.set(key, String(value));
    }
  });

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<PaginatedCallQueueList>(`/call-queue${suffix}`, { signal });
}

export function getCallAttempt(id: string, signal?: AbortSignal): Promise<CallAttempt> {
  return request<CallAttempt>(`/call-queue/${id}`, { signal });
}

export function generateFromCampaign(
  campaignId: string,
  payload: CallQueueGeneratePayload = {},
): Promise<CallQueueGenerateResponse> {
  return jsonRequest<CallQueueGenerateResponse>(`/call-queue/generate/${campaignId}`, payload, { method: "POST" });
}

export function updateCallAttempt(id: string, payload: CallAttemptUpdatePayload): Promise<CallAttempt> {
  return jsonRequest<CallAttempt>(`/call-queue/${id}`, payload, { method: "PATCH" });
}

export function cancelCallAttempt(id: string): Promise<CallAttempt> {
  return request<CallAttempt>(`/call-queue/${id}/cancel`, { method: "POST" });
}

export const callQueueApi = {
  getSummary: getCallQueueSummary,
  listCallQueue,
  getCallAttempt,
  generateFromCampaign,
  updateCallAttempt,
  cancelCallAttempt,
};

export function getMockCallSummary(signal?: AbortSignal): Promise<MockCallSummary> {
  return request<MockCallSummary>("/mock-calls/summary", { signal });
}

export function listMockCallOutcomes(
  params: MockCallOutcomeListParams = {},
  signal?: AbortSignal,
): Promise<PaginatedMockCallOutcomeList> {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      query.set(key, String(value));
    }
  });

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<PaginatedMockCallOutcomeList>(`/mock-calls/outcomes${suffix}`, { signal });
}

export function getMockCallOutcome(id: string, signal?: AbortSignal): Promise<MockCallOutcomeDetail> {
  return request<MockCallOutcomeDetail>(`/mock-calls/outcomes/${id}`, { signal });
}

export function runOneMockCall(callAttemptId: string, payload: MockCallRunPayload): Promise<MockCallRunResponse> {
  return jsonRequest<MockCallRunResponse>(`/mock-calls/run/${callAttemptId}`, payload, { method: "POST" });
}

export function runMockCallBatch(payload: MockCallBatchPayload): Promise<MockCallBatchResponse> {
  return jsonRequest<MockCallBatchResponse>("/mock-calls/run-batch", payload, { method: "POST" });
}

export const mockCallsApi = {
  getSummary: getMockCallSummary,
  listOutcomes: listMockCallOutcomes,
  getOutcome: getMockCallOutcome,
  runOne: runOneMockCall,
  runBatch: runMockCallBatch,
};

export function getPromiseToPaySummary(signal?: AbortSignal): Promise<PromiseToPaySummary> {
  return request<PromiseToPaySummary>("/promise-to-pay/summary", { signal });
}

export function listPromiseToPay(
  params: PromiseToPayListParams = {},
  signal?: AbortSignal,
): Promise<PaginatedPromiseToPayList> {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      query.set(key, String(value));
    }
  });

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<PaginatedPromiseToPayList>(`/promise-to-pay${suffix}`, { signal });
}

export function getPromiseToPay(id: string, signal?: AbortSignal): Promise<PromiseToPayDetail> {
  return request<PromiseToPayDetail>(`/promise-to-pay/${id}`, { signal });
}

export function updatePromiseToPay(
  id: string,
  payload: PromiseToPayUpdatePayload,
): Promise<PromiseToPayDetail> {
  return jsonRequest<PromiseToPayDetail>(`/promise-to-pay/${id}`, payload, { method: "PATCH" });
}

export const promiseToPayApi = {
  getSummary: getPromiseToPaySummary,
  list: listPromiseToPay,
  get: getPromiseToPay,
  update: updatePromiseToPay,
};

export function getHumanCallbackSummary(signal?: AbortSignal): Promise<HumanCallbackSummary> {
  return request<HumanCallbackSummary>("/human-callbacks/summary", { signal });
}

export function listHumanCallbacks(
  params: HumanCallbackListParams = {},
  signal?: AbortSignal,
): Promise<PaginatedHumanCallbackList> {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      query.set(key, String(value));
    }
  });

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<PaginatedHumanCallbackList>(`/human-callbacks${suffix}`, { signal });
}

export function getHumanCallback(id: string, signal?: AbortSignal): Promise<HumanCallbackDetail> {
  return request<HumanCallbackDetail>(`/human-callbacks/${id}`, { signal });
}

export function updateHumanCallback(
  id: string,
  payload: HumanCallbackUpdatePayload,
): Promise<HumanCallbackDetail> {
  return jsonRequest<HumanCallbackDetail>(`/human-callbacks/${id}`, payload, { method: "PATCH" });
}

export const humanCallbacksApi = {
  getSummary: getHumanCallbackSummary,
  list: listHumanCallbacks,
  get: getHumanCallback,
  update: updateHumanCallback,
};
