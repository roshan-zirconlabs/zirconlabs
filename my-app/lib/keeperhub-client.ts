/**
 * KeeperHub execution statuses, as documented in their Executions API.
 *
 * Treat this as a lower bound, not a closed set: KeeperHub explicitly warns
 * that a client routing an unrecognised status into a failing branch will
 * report a failure for a run that is still settling. Unknown statuses are
 * therefore preserved as-is and reported as non-terminal.
 */
export type KeeperhubExecutionStatus =
  | "pending"
  | "running"
  | "unconfirmed"
  | "success"
  | "error"
  | "system_error"
  | "cancelled"
  | (string & {});

const TERMINAL: ReadonlySet<string> = new Set(["success", "error", "system_error", "cancelled"]);

export function isTerminalStatus(status: string): boolean {
  return TERMINAL.has(status.toLowerCase());
}

/** Coarse outcome for display. Unknown statuses are treated as still running. */
export function executionOutcome(status: string): "SUCCESS" | "FAILED" | "CANCELLED" | "RUNNING" {
  const value = status.toLowerCase();
  if (value === "success") return "SUCCESS";
  if (value === "error" || value === "system_error") return "FAILED";
  if (value === "cancelled") return "CANCELLED";
  return "RUNNING";
}

export type KeeperhubTransactionHash = {
  hash: string;
  nodeId?: string;
  nodeName?: string;
  chainId?: number;
  verified?: boolean;
  receiptStatus?: string;
  blockNumber?: number;
};

export type KeeperhubExecution = {
  id?: string;
  executionId?: string;
  workflowId?: string;
  status: KeeperhubExecutionStatus;
  terminal: boolean;
  outcome: "SUCCESS" | "FAILED" | "CANCELLED" | "RUNNING";
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  error?: string;
  transactionHashes?: KeeperhubTransactionHash[];
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

/** Returns the raw status string, lowercased, or null when absent. */
function readStatus(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;
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

  private async request(path: string, init: RequestInit): Promise<{ payload: unknown; response: Response }> {
    if (!this.apiKey) throw new Error("KEEPERHUB_API_KEY is not configured.");
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(45000),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(`KeeperHub request failed (${response.status}). Check the connection and workflow in KeeperHub.`);
    }
    return { payload, response };
  }

  async executeWorkflow(workflowId: string, input: Record<string, unknown> = {}): Promise<{ executionId: string; status: string }> {
    const { payload } = await this.request(`/api/workflows/${workflowId}/execute`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    if (!payload || typeof payload !== "object" || !("executionId" in payload) || typeof payload.executionId !== "string") {
      throw new Error("KeeperHub execution response is missing executionId.");
    }
    const status = readStatus("status" in payload ? payload.status : null) ?? "pending";
    // A terminal status here means the run already finished; that is unusual
    // but not an error, so it is reported rather than rejected.
    return { executionId: payload.executionId, status };
  }

  /**
   * Blocks until the run reaches a terminal state or the timeout elapses.
   * Terminality comes from KeeperHub's own X-Poll-Interval-Hint header when
   * present, so statuses added after this client shipped stay correct.
   */
  async waitForExecution(executionId: string, timeoutMs = 30000): Promise<KeeperhubExecution> {
    const { payload, response } = await this.request(
      `/api/workflows/executions/${executionId}/wait?timeoutMs=${Math.min(Math.max(timeoutMs, 1000), 60000)}`,
      { method: "GET" },
    );
    if (!payload || typeof payload !== "object") throw new Error("KeeperHub execution response is invalid.");
    const status = readStatus("status" in payload ? payload.status : undefined);
    if (!status) throw new Error("KeeperHub execution response is missing execution status.");

    // Terminality, most authoritative first: the server's poll hint, then the
    // explicit `completed` flag on the body, then our own status set.
    const hint = response.headers.get("X-Poll-Interval-Hint");
    const completed = typeof (payload as { completed?: unknown }).completed === "boolean"
      ? (payload as { completed: boolean }).completed
      : null;
    const terminal = hint !== null ? Number(hint) === 0 : completed ?? isTerminalStatus(status);

    return { ...payload, status, terminal, outcome: executionOutcome(status) } as KeeperhubExecution;
  }
}
