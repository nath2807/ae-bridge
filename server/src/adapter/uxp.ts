import { EventEmitter } from "node:events";
import { HostAdapter, HostStatus, CallOptions } from "./interface.js";

export interface UxpManifest {
  id: string;
  name: string;
  version: string;
  main: string;
  manifestVersion: number;
  host: Array<{ app: "AE"; minVersion: string }>;
  requiredPermissions?: {
    network?: {
      domains?: string[];
    };
    localFileSystem?: "fullAccess" | "request";
    clipboard?: "readAndWrite";
  };
  entrypoints?: Array<{
    type: "panel" | "command";
    id: string;
    label: string;
  }>;
}

export type UxpApiHandler = (params: Record<string, unknown>) => Promise<unknown> | unknown;

/**
 * UxpHostAdapter models Adobe's modern UXP (Unified Extensibility Platform) environment
 * featuring V8 modern ECMAScript, executeAsModal transactions, and direct DOM/API dispatch.
 */
export class UxpHostAdapter extends EventEmitter implements HostAdapter {
  readonly engineType = "UXP" as const;
  private connected: boolean = false;
  private manifest: UxpManifest;
  private isModalActive: boolean = false;
  private activeModalTitle: string | null = null;
  private handlers = new Map<string, UxpApiHandler>();
  private startTime: number = 0;
  private mockAeVersion: string = "25.0.0";
  private mockProjectName: string = "UXP_Modern_Project.aep";

  constructor(customManifest?: Partial<UxpManifest>) {
    super();
    this.manifest = {
      id: "com.aebridge.uxp",
      name: "AE Bridge UXP",
      version: "1.3.0",
      main: "index.js",
      manifestVersion: 5,
      host: [{ app: "AE", minVersion: "24.0.0" }],
      requiredPermissions: {
        network: {
          domains: ["ws://127.0.0.1:8765", "http://127.0.0.1:8766"]
        },
        localFileSystem: "fullAccess"
      },
      ...customManifest
    };
  }

  getManifest(): UxpManifest {
    return { ...this.manifest };
  }

  /**
   * Verifies whether network permissions in the UXP manifest permit connecting to a target origin.
   */
  hasNetworkPermission(targetUrl: string): boolean {
    const domains = this.manifest.requiredPermissions?.network?.domains;
    if (!domains) return false;
    if (domains.includes("*") || domains.includes("all")) return true;
    try {
      const parsed = new URL(targetUrl);
      const origin = `${parsed.protocol}//${parsed.host}`;
      return domains.some((d) => d === targetUrl || d === origin || d === parsed.host);
    } catch {
      return domains.includes(targetUrl);
    }
  }

  /**
   * Models UXP's executeAsModal transaction wrapper.
   * In UXP, state-mutating operations on After Effects must execute inside executeAsModal.
   */
  async executeAsModal<T>(
    fn: () => Promise<T> | T,
    options: { title: string }
  ): Promise<T> {
    if (this.isModalActive) {
      throw new Error(
        `Cannot execute modal '${options.title}': another modal operation ('${this.activeModalTitle}') is already in progress.`
      );
    }

    this.isModalActive = true;
    this.activeModalTitle = options.title;
    try {
      const result = await fn();
      return result;
    } finally {
      this.isModalActive = false;
      this.activeModalTitle = null;
    }
  }

  /**
   * Registers a direct API handler in the modern V8 environment.
   */
  registerHandler(method: string, handler: UxpApiHandler): void {
    this.handlers.set(method, handler);
  }

  async connect(port: number = 8765): Promise<void> {
    const targetUrl = `ws://127.0.0.1:${port}`;
    if (!this.hasNetworkPermission(targetUrl)) {
      const err = new Error(
        `UXP Security Violation: Manifest does not grant network domain permission for '${targetUrl}'.`
      );
      this.emit("error", err);
      throw err;
    }

    this.connected = true;
    this.startTime = Date.now();
    this.emit("connect");
    this.emit("status", this.getStatus());
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      this.connected = false;
      this.emit("disconnect");
      this.emit("status", this.getStatus());
    }
  }

  async call<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
    options?: CallOptions
  ): Promise<T> {
    if (!this.connected) {
      throw new Error("UXP Host Adapter is not connected to After Effects.");
    }

    const handler = this.handlers.get(method);
    if (!handler) {
      // If no direct handler is registered, provide a sensible default response or throw
      if (method === "ae_bridge_status") {
        return {
          connected: true,
          engineType: "UXP",
          version: this.mockAeVersion,
          projectName: this.mockProjectName
        } as unknown as T;
      }
      throw new Error(`UXP Method '${method}' not implemented in direct API handler table.`);
    }

    // Run inside executeAsModal transaction boundary
    return await this.executeAsModal(
      async () => {
        const res = await handler(params ?? {});
        return res as T;
      },
      { title: `AE Bridge: ${method}` }
    );
  }

  getStatus(): HostStatus {
    return {
      connected: this.connected,
      hostName: "AfterEffects",
      engineType: "UXP",
      version: this.mockAeVersion,
      projectName: this.mockProjectName,
      latencyMs: 1, // Direct in-process or local V8 call has ~1ms latency
      queueDepth: this.isModalActive ? 1 : 0,
      uptimeSeconds: this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
      capabilities: [
        "v8ModernJs",
        "executeAsModal",
        "directDomAccess",
        "asyncAwait",
        "typedArrays",
        "streamIo"
      ]
    };
  }

  /**
   * Executes modern ECMAScript directly in the V8 engine context.
   */
  async executeRawScript(code: string): Promise<string> {
    if (!this.connected) {
      throw new Error("UXP Host Adapter is not connected to After Effects.");
    }

    // In modern V8, code can utilize modern syntax (arrow functions, const, let, async/await)
    return await this.executeAsModal(
      async () => {
        const evalFn = new Function("params", `"use strict"; return (${code});`);
        const res = await evalFn({});
        if (typeof res === "string") return res;
        return JSON.stringify(res);
      },
      { title: "AE Bridge: executeRawScript" }
    );
  }
}
