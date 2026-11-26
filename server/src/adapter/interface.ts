export interface HostStatus {
  connected: boolean;
  hostName: "AfterEffects";
  engineType: "CEP" | "UXP" | "Mock";
  version?: string;
  projectName?: string;
  latencyMs?: number;
  queueDepth?: number;
  uptimeSeconds?: number;
  capabilities?: string[];
}

export interface CallOptions {
  timeoutMs?: number;
  priority?: "system" | "user" | "batch";
  cancellationToken?: string;
  onProgress?: (percent: number, message?: string) => void;
  signal?: AbortSignal;
}

export interface CallResult<T = unknown> {
  ok: boolean;
  result?: T;
  error?: string;
  errorName?: string;
  line?: number | null;
  file?: string | null;
  stack?: string | null;
}

export interface HostAdapter {
  readonly engineType: "CEP" | "UXP" | "Mock";
  connect(port?: number): Promise<void>;
  disconnect(): Promise<void>;
  call<T = unknown>(method: string, params?: Record<string, unknown>, options?: CallOptions): Promise<T>;
  getStatus(): HostStatus;
  executeRawScript(code: string): Promise<string>;
  on(event: string, handler: (...args: any[]) => void): void;
  off(event: string, handler: (...args: any[]) => void): void;
}
