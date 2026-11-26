import { EventEmitter } from "node:events";
import { HostAdapter, HostStatus, CallOptions } from "./interface.js";
import {
  startBridge,
  stopBridge,
  callAE,
  getBridgeStatus,
  isConnected
} from "../bridge.js";

/**
 * CepHostAdapter wraps the legacy CEP panel and ExtendScript ES3 engine
 * communicating over loopback WebSocket.
 */
export class CepHostAdapter extends EventEmitter implements HostAdapter {
  readonly engineType = "CEP" as const;
  private port: number = 8765;
  private isConnecting: boolean = false;
  private statusPollTimer: NodeJS.Timeout | null = null;
  private lastConnectedState: boolean = false;

  constructor(defaultPort: number = 8765) {
    super();
    this.port = defaultPort;
  }

  async connect(port?: number): Promise<void> {
    if (port) {
      this.port = port;
    }
    this.isConnecting = true;
    try {
      startBridge(this.port);
      this.lastConnectedState = isConnected();

      // Poll connection state to emit connect/disconnect events
      if (!this.statusPollTimer) {
        this.statusPollTimer = setInterval(() => {
          const current = isConnected();
          if (current !== this.lastConnectedState) {
            this.lastConnectedState = current;
            if (current) {
              this.emit("connect");
            } else {
              this.emit("disconnect");
            }
          }
          this.emit("status", this.getStatus());
        }, 500);
      }
    } catch (err) {
      this.emit("error", err);
      throw err;
    } finally {
      this.isConnecting = false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.statusPollTimer) {
      clearInterval(this.statusPollTimer);
      this.statusPollTimer = null;
    }
    await stopBridge();
    if (this.lastConnectedState) {
      this.lastConnectedState = false;
      this.emit("disconnect");
    }
  }

  async call<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
    options?: CallOptions
  ): Promise<T> {
    return (await callAE(method, params ?? {}, {
      timeoutMs: options?.timeoutMs,
      priority: options?.priority,
      onProgress: options?.onProgress,
      signal: options?.signal
    })) as T;
  }

  getStatus(): HostStatus {
    const raw = getBridgeStatus();
    return {
      connected: raw.connected,
      hostName: "AfterEffects",
      engineType: "CEP",
      version: raw.aeVersion ?? undefined,
      projectName: raw.activeProject ?? undefined,
      latencyMs: raw.latencyMs ?? undefined,
      queueDepth: raw.queueDepth,
      uptimeSeconds: raw.uptimeSeconds,
      capabilities: raw.panelCapabilities
    };
  }

  async executeRawScript(code: string): Promise<string> {
    const result = await this.call<{ result?: string }>("ae_eval_script", { script: code });
    if (typeof result === "string") return result;
    if (result && typeof result === "object" && "result" in result) {
      return String((result as any).result);
    }
    return JSON.stringify(result);
  }
}
