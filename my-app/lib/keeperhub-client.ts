export type KeeperhubExecutionStatus = "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED";

export type KeeperhubExecution = {
  id?: string;
  executionId?: string;
  workflowId?: string;
  status: KeeperhubExecutionStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  error?: string;
  transactionHash?: string;
  txHash?: string;
  steps?: Array<{
    nodeId?: string;
    stepName?: string;
    status: KeeperhubExecutionStatus;
    error?: string;
    durationMs?: number;
  }>;
};

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type ClientOptions = {
  baseUrl: string;
  apiKey?: string;
  fetcher?: Fetcher;
};

function normalizeStatus(value: unknown): KeeperhubExecutionStatus | null {
  if (typeof value !== "string") return null;
  const status = value.toUpperCase();
  return status === "PENDING" || status === "RUNNING" || status === "SUCCESS" || status === "FAILED" || status === "CANCELLED"
    ? status
    : null;
}

export class KeeperhubApiClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetcher: Fetcher;

  constructor({ baseUrl, apiKey, fetcher = fetch }: ClientOptions) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
    this.fetcher = fetcher;
  }

  private async request(path: string, init: RequestInit): Promise<unknown> {
    if (!this.apiKey) throw new Error("KEEPERHUB_API_KEY is not configured.");
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(`KeeperHub request failed (${response.status}). Check the connection and workflow in KeeperHub.`);
    }
    return payload;
  }

  async executeWorkflow(workflowId: string, input: Record<string, unknown> = {}): Promise<{ executionId: string; status: "PENDING" | "RUNNING" }> {
    const payload = await this.request(`/api/workflows/${workflowId}/execute`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    if (!payload || typeof payload !== "object" || !("executionId" in payload) || typeof payload.executionId !== "string") {
      throw new Error("KeeperHub execution response is missing executionId.");
    }
    const status = normalizeStatus("status" in payload ? payload.status : "RUNNING");
    if (status !== "PENDING" && status !== "RUNNING") {
      throw new Error("KeeperHub execution response is missing a pending execution status.");
    }
    return { executionId: payload.executionId, status };
  }

  async waitForExecution(executionId: string): Promise<KeeperhubExecution> {
    const payload = await this.request(`/api/workflows/executions/${executionId}/wait`, { method: "GET" });
    if (!payload || typeof payload !== "object") throw new Error("KeeperHub execution response is invalid.");
    const status = normalizeStatus("status" in payload ? payload.status : undefined);
    if (!status) throw new Error("KeeperHub execution response is missing execution status.");
    return { ...payload, status } as KeeperhubExecution;
  }
}
