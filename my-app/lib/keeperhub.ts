import { KeeperhubApiClient, type KeeperhubExecutionStatus } from "./keeperhub-client";

export type KhWorkflow = {
  id: string;
  name: string;
  description?: string;
  visibility?: "private" | "public";
  nodes: unknown[];
  edges: unknown[];
  enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type KhExecution = {
  id: string;
  workflowId: string;
  status: KeeperhubExecutionStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  triggerSource?: string;
  error?: string;
  steps?: Array<{
    nodeId: string;
    stepName: string;
    status: KeeperhubExecutionStatus;
    input?: unknown;
    output?: unknown;
    error?: string;
    durationMs?: number;
  }>;
  txHash?: string;
};

export class KeeperhubClient {
  private baseUrl: string;
  private apiKey: string | undefined;
  private appUrlBase: string;

  constructor(apiKey?: string) {
    this.baseUrl = (
      process.env.KEEPERHUB_BASE_URL || "https://app.keeperhub.com"
    ).replace(/\/$/, "");
    this.apiKey = apiKey;
    this.appUrlBase = (
      process.env.KEEPERHUB_APP_URL || "https://app.keeperhub.com"
    ).replace(/\/$/, "");
  }

  get isConfigured(): boolean {
    return !!this.apiKey;
  }

  private get executionClient() {
    return new KeeperhubApiClient({ baseUrl: this.baseUrl, apiKey: this.apiKey });
  }

  editorUrl(workflowId: string): string {
    return `${this.appUrlBase}/workflows/${workflowId}`;
  }

  webhookUrl(workflowId: string): string {
    return `${this.baseUrl}/api/workflows/${workflowId}/webhook`;
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    path: string,
    body?: unknown,
  ): Promise<T> {
    if (!this.apiKey) {
      // If no API key is set in local dev, provide safe simulated fallback or descriptive error
      throw new Error(
        "KEEPERHUB_API_KEY not configured. Set it in .env to sync with KeeperHub.",
      );
    }
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      throw new Error(`KeeperHub request failed (${res.status}). Check your connection and organization permissions.`);
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  async createWorkflow(input: {
    name: string;
    description?: string;
    nodes?: unknown[];
    edges?: unknown[];
  }): Promise<KhWorkflow> {
    return this.request<KhWorkflow>("POST", "/api/workflows/create", {
      name: input.name,
      description: input.description,
      nodes: input.nodes ?? [],
      edges: input.edges ?? [],
    });
  }

  async getWorkflow(workflowId: string): Promise<KhWorkflow> {
    return this.request<KhWorkflow>("GET", `/api/workflows/${workflowId}`);
  }

  async verifyConnection(): Promise<void> {
    await this.request("GET", "/api/keys");
  }

  async updateWorkflow(
    workflowId: string,
    patch: {
      name?: string;
      description?: string;
      nodes?: unknown[];
      edges?: unknown[];
      enabled?: boolean;
    },
  ): Promise<KhWorkflow> {
    return this.request<KhWorkflow>(
      "PATCH",
      `/api/workflows/${workflowId}`,
      patch,
    );
  }

  async deleteWorkflow(workflowId: string, force = true): Promise<void> {
    const q = force ? "?force=true" : "";
    await this.request<void>("DELETE", `/api/workflows/${workflowId}${q}`);
  }

  async executeWorkflow(workflowId: string, payload: Record<string, unknown>) {
    return this.executionClient.executeWorkflow(workflowId, payload);
  }

  async getExecutions(workflowId: string): Promise<KhExecution[]> {
    const data = await this.request<unknown>("GET", `/api/workflows/${workflowId}/executions`);
    if (Array.isArray(data)) return data as KhExecution[];
    if (data && typeof data === "object" && "executions" in data && Array.isArray(data.executions)) {
      return data.executions as KhExecution[];
    }
    throw new Error("KeeperHub executions response is invalid.");
  }
}

export const keeperhub = new KeeperhubClient();
