import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "node:crypto";
import { getAeBridgeHome, VERSION } from "./utils/paths.js";
import { logger } from "./utils/logger.js";
import { BridgeError } from "./utils/errors.js";

export const PROTOCOL_VERSION = 2;
export const SERVER_CAPABILITIES = [
  "priorityQueue",
  "heartbeat",
  "structuredErrors",
  "progress",
  "cancel"
];

export type CallPriority = "system" | "user" | "batch";

export interface CallOptions {
  priority?: CallPriority;
  timeoutMs?: number;
  onProgress?: (percent: number, message?: string) => void;
  signal?: AbortSignal;
}

interface QueueItem {
  id: string;
  method: string;
  params: object;
  priority: CallPriority;
  timeoutMs: number;
  enqueuedAt: number;
  onProgress?: (percent: number, message?: string) => void;
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer?: NodeJS.Timeout;
}

interface ActiveCall {
  item: QueueItem;
  socket: WebSocket;
  timer: NodeJS.Timeout;
}

interface AeMessage {
  id?: string;
  type?: string;
  token?: string;
  protocolVersion?: number;
  panelVersion?: string;
  capabilities?: string[];
  ok?: boolean;
  result?: unknown;
  error?: string;
  errorName?: string;
  line?: number;
  file?: string;
  stack?: string;
  timestamp?: number;
  progress?: number;
  progressMessage?: string;
}

let wss: WebSocketServer | null = null;
let activeClient: WebSocket | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;

// Telemetry state
let panelProtocolVersion: number | null = null;
let panelVersion: string | null = null;
let panelCapabilities: string[] = [];
let lastHeartbeatPing = 0;
let lastHeartbeatPong = 0;
let roundTripLatencyMs: number | null = null;
let serverStartTime = Date.now();
let cachedAeVersion: string | null = null;
let cachedActiveProject: string | null = null;

// Prioritized single-thread queue state
const requestQueue: QueueItem[] = [];
let activeExecution: ActiveCall | null = null;

export function getAuthTokenPath(): string {
  const dir = getAeBridgeHome();
  return path.join(dir, "token");
}

export function getOrCreateAuthToken(): string {
  const tokenFile = getAuthTokenPath();
  try {
    if (fs.existsSync(tokenFile)) {
      const existing = fs.readFileSync(tokenFile, "utf-8").trim();
      if (existing.length >= 16) {
        if (os.platform() !== "win32") {
          try {
            fs.chmodSync(tokenFile, 0o600);
          } catch {}
        }
        return existing;
      }
    }
  } catch (err) {
    logger.error("Error reading existing auth token, regenerating:", err);
  }

  const newToken = crypto.randomBytes(32).toString("hex");
  try {
    fs.writeFileSync(tokenFile, newToken, { encoding: "utf-8", mode: 0o600 });
    if (os.platform() !== "win32") {
      try {
        fs.chmodSync(tokenFile, 0o600);
      } catch {}
    }
  } catch (err) {
    logger.error("Failed to persist auth token:", err);
  }
  return newToken;
}

export function isConnected(): boolean {
  return activeClient !== null && activeClient.readyState === WebSocket.OPEN;
}

function timingSafeTokenCompare(received: unknown, expected: string): boolean {
  if (typeof received !== "string") return false;
  const receivedBuf = Buffer.from(received.trim(), "utf-8");
  const expectedBuf = Buffer.from(expected.trim(), "utf-8");
  if (receivedBuf.length !== expectedBuf.length || receivedBuf.length === 0) {
    return false;
  }
  return crypto.timingSafeEqual(receivedBuf, expectedBuf);
}

const PRIORITY_WEIGHTS: Record<CallPriority, number> = {
  system: 0,
  user: 1,
  batch: 2
};

function enqueueRequest(item: QueueItem): void {
  requestQueue.push(item);
  // Sort queue: lower weight first (system < user < batch), then FIFO by enqueuedAt
  requestQueue.sort((a, b) => {
    const pDiff = PRIORITY_WEIGHTS[a.priority] - PRIORITY_WEIGHTS[b.priority];
    if (pDiff !== 0) return pDiff;
    return a.enqueuedAt - b.enqueuedAt;
  });
  processQueue();
}

function processQueue(): void {
  if (activeExecution !== null) {
    return; // Already executing a call; ExtendScript cannot run concurrently
  }

  if (requestQueue.length === 0) {
    return;
  }

  if (!isConnected() || !activeClient) {
    // If not connected, items stay enqueued until connection arrives or they time out
    return;
  }

  const nextItem = requestQueue.shift()!;
  const socket = activeClient;

  const timer = setTimeout(() => {
    if (activeExecution && activeExecution.item.id === nextItem.id) {
      activeExecution = null;
      nextItem.reject(
        new Error(`Call '${nextItem.method}' timed out after ${nextItem.timeoutMs / 1000}s waiting for After Effects response`)
      );
      processQueue();
    }
  }, nextItem.timeoutMs);

  activeExecution = {
    item: nextItem,
    socket,
    timer
  };

  const requestPayload = JSON.stringify({
    id: nextItem.id,
    method: nextItem.method,
    params: nextItem.params
  });

  try {
    socket.send(requestPayload);
  } catch (err) {
    clearTimeout(timer);
    activeExecution = null;
    nextItem.reject(new Error(`Failed to dispatch message to After Effects: ${(err as Error).message}`));
    processQueue();
  }
}

function dropSocketCalls(socket: WebSocket, reason: string): void {
  // Reject currently executing call if bound to this socket
  if (activeExecution && activeExecution.socket === socket) {
    clearTimeout(activeExecution.timer);
    const item = activeExecution.item;
    activeExecution = null;
    item.reject(new Error(`After Effects panel disconnected while executing '${item.method}': ${reason}`));
  }

  // Reject all enqueued requests if no other socket is available
  if (activeClient === socket || activeClient === null) {
    while (requestQueue.length > 0) {
      const item = requestQueue.shift()!;
      item.reject(new Error(`After Effects panel disconnected before call '${item.method}' could run: ${reason}`));
    }
  }
}

function startHeartbeat(): void {
  stopHeartbeat();
  heartbeatInterval = setInterval(() => {
    if (!isConnected() || !activeClient) return;

    // Check if client missed pong for > 10s
    if (lastHeartbeatPing > 0 && lastHeartbeatPong > 0 && Date.now() - lastHeartbeatPong > 10000) {
      logger.warn("Heartbeat pong timed out (>10s); dropping stale socket connection");
      try {
        activeClient.close(4008, "Heartbeat timeout");
      } catch {}
      return;
    }

    lastHeartbeatPing = Date.now();
    try {
      activeClient.send(JSON.stringify({
        type: "heartbeat_ping",
        timestamp: lastHeartbeatPing
      }));
    } catch {}
  }, 5000);
}

function stopHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

export function startBridge(customPort?: number): Promise<void> {
  const port = customPort ?? Number(process.env.AE_BRIDGE_PORT || 8765);
  const host = "127.0.0.1";
  const expectedToken = getOrCreateAuthToken();
  serverStartTime = Date.now();

  return new Promise((resolve, reject) => {
    wss = new WebSocketServer({
      host,
      port,
      maxPayload: 100 * 1024 * 1024 // 100 MB max payload
    });

    wss.on("listening", () => {
      logger.info(`WebSocket listening on ws://${host}:${port} (bound to 127.0.0.1)`);
      resolve();
    });

    wss.on("connection", (ws: WebSocket, req: http.IncomingMessage) => {
      const origin = req.headers.origin;
      if (origin) {
        const lower = origin.toLowerCase();
        if (lower.startsWith("http://") || lower.startsWith("https://")) {
          logger.error(`Rejecting WebSocket connection from untrusted web browser origin: ${origin}`);
          ws.close(4003, "Forbidden origin");
          return;
        }
      }

      logger.info("After Effects panel opened connection, awaiting protocol v2 handshake...");
      let isAuthenticated = false;

      const authTimeout = setTimeout(() => {
        if (!isAuthenticated) {
          logger.error("WebSocket client authentication timed out (3s)");
          try {
            ws.send(JSON.stringify({ type: "auth_failed", error: "Authentication timeout after 3s" }));
            ws.close(4001, "Auth timeout");
          } catch {}
        }
      }, 3000);

      ws.on("message", (raw: string | Buffer) => {
        try {
          const payload: AeMessage = JSON.parse(raw.toString());

          // 1. Initial Handshake & Auth
          if (!isAuthenticated) {
            // Non-disruptive diagnostic probe from doctor CLI
            if (payload.type === "doctor_ping") {
              clearTimeout(authTimeout);
              if (!timingSafeTokenCompare(payload.token, expectedToken)) {
                try {
                  ws.send(JSON.stringify({ type: "doctor_pong", ok: false, error: "Invalid token" }));
                  ws.close(4003, "Invalid token");
                } catch {}
                return;
              }

              if (isConnected()) {
                const start = Date.now();
                callAE("ping", {}, 2000)
                  .then((res: any) => {
                    const elapsed = Date.now() - start;
                    try {
                      ws.send(JSON.stringify({
                        type: "doctor_pong",
                        ok: true,
                        connected: true,
                        latencyMs: elapsed,
                        aeVersion: res?.aeVersion || "unknown",
                        projectName: res?.projectName || "Untitled"
                      }));
                      ws.close(1000, "Doctor probe complete");
                    } catch {}
                  })
                  .catch((err) => {
                    try {
                      ws.send(JSON.stringify({
                        type: "doctor_pong",
                        ok: false,
                        connected: true,
                        error: (err as Error).message
                      }));
                      ws.close(1000, "Doctor probe complete");
                    } catch {}
                  });
              } else {
                try {
                  ws.send(JSON.stringify({
                    type: "doctor_pong",
                    ok: false,
                    connected: false,
                    message: "AE Bridge server is running, but no After Effects panel is connected"
                  }));
                  ws.close(1000, "Doctor probe complete");
                } catch {}
              }
              return;
            }

            if (payload.type === "auth") {
              if (!timingSafeTokenCompare(payload.token, expectedToken)) {
                clearTimeout(authTimeout);
                logger.error("Authentication failed: invalid token received");
                try {
                  ws.send(JSON.stringify({ type: "auth_failed", error: "Invalid authentication token" }));
                  ws.close(4003, "Authentication failed");
                } catch {}
                return;
              }

              // Check Protocol Version (expect protocolVersion 2)
              const clientProto = payload.protocolVersion ?? 1;
              if (clientProto !== PROTOCOL_VERSION) {
                clearTimeout(authTimeout);
                const errMsg = `Protocol version mismatch: client reported ${clientProto}, server requires version ${PROTOCOL_VERSION}. Please update the CEP panel extension and server.`;
                logger.error(errMsg);
                try {
                  ws.send(JSON.stringify({
                    type: "auth_failed",
                    error: errMsg,
                    expectedProtocolVersion: PROTOCOL_VERSION
                  }));
                  ws.close(4002, "Protocol mismatch");
                } catch {}
                return;
              }

              isAuthenticated = true;
              clearTimeout(authTimeout);

              panelProtocolVersion = clientProto;
              panelVersion = payload.panelVersion || "unknown";
              panelCapabilities = payload.capabilities || [];
              lastHeartbeatPong = Date.now();

              if (activeClient && activeClient !== ws) {
                logger.info("Replacing existing client connection with newest authenticated panel");
                const oldClient = activeClient;
                activeClient = ws;
                oldClient.on("error", () => {});
                dropSocketCalls(oldClient, "Replaced by newer panel connection");
                try {
                  oldClient.close(4000, "Replaced by newer panel connection");
                } catch {}
              } else {
                activeClient = ws;
              }

              startHeartbeat();

              try {
                ws.send(JSON.stringify({
                  type: "auth_ok",
                  protocolVersion: PROTOCOL_VERSION,
                  serverVersion: VERSION,
                  capabilities: SERVER_CAPABILITIES
                }));
              } catch {}
              logger.info(`After Effects panel authenticated successfully (panel v${panelVersion}, protocol v${panelProtocolVersion})`);

              // Resume processing queue
              processQueue();
              return;
            } else {
              clearTimeout(authTimeout);
              try {
                ws.send(JSON.stringify({ type: "auth_failed", error: "First message must be auth handshake" }));
                ws.close(4003, "Auth required");
              } catch {}
              return;
            }
          }

          // 2. Heartbeat Ping / Pong Handling
          if (payload.type === "heartbeat_pong") {
            lastHeartbeatPong = Date.now();
            if (payload.timestamp) {
              roundTripLatencyMs = Math.max(0, Date.now() - payload.timestamp);
            }
            return;
          }

          if (payload.type === "heartbeat_ping") {
            try {
              ws.send(JSON.stringify({
                type: "heartbeat_pong",
                timestamp: payload.timestamp || Date.now()
              }));
            } catch {}
            return;
          }

          // 3. Progress notifications during long-running tasks
          if (payload.type === "progress" && payload.id) {
            if (activeExecution && activeExecution.item.id === payload.id) {
              if (activeExecution.item.onProgress && typeof payload.progress === "number") {
                activeExecution.item.onProgress(payload.progress, payload.progressMessage);
              }
            }
            return;
          }

          // 4. Dispatch Call Responses
          if (!payload.id) return;

          if (activeExecution && activeExecution.item.id === payload.id) {
            clearTimeout(activeExecution.timer);
            const { resolve, reject, method } = activeExecution.item;
            activeExecution = null;

            if (payload.ok) {
              if (method === "ping" && payload.result && typeof payload.result === "object") {
                const res = payload.result as any;
                if (res.aeVersion) cachedAeVersion = res.aeVersion;
                if (res.projectName) cachedActiveProject = res.projectName;
              }
              resolve(payload.result);
            } else {
              const bridgeErr = new BridgeError(payload.error || "ExtendScript execution failed", {
                errorName: payload.errorName,
                line: payload.line,
                file: payload.file,
                stackTrace: payload.stack
              });
              reject(bridgeErr);
            }

            processQueue();
          }
        } catch (err) {
          logger.error("Error parsing client message:", err);
        }
      });

      ws.on("close", (code, reason) => {
        clearTimeout(authTimeout);
        const reasonStr = reason ? reason.toString() : "normal";
        dropSocketCalls(ws, `Socket closed (${code}: ${reasonStr})`);
        if (activeClient === ws) {
          logger.warn("Active After Effects panel disconnected");
          activeClient = null;
          panelProtocolVersion = null;
          panelVersion = null;
          roundTripLatencyMs = null;
          stopHeartbeat();
        }
      });

      ws.on("error", (err) => {
        clearTimeout(authTimeout);
        logger.error("Client socket error:", err);
        dropSocketCalls(ws, `Socket error: ${err.message}`);
        if (activeClient === ws) {
          activeClient = null;
          stopHeartbeat();
        }
      });
    });

    wss.on("error", (err) => {
      logger.error("WebSocket server error:", err);
      reject(err);
    });
  });
}

/**
 * Dispatch an ExtendScript method call to the active After Effects CEP panel over WebSocket.
 * Calls are sequenced through a prioritized single-threaded queue.
 */
export async function callAE(
  method: string,
  params: object = {},
  optionsOrTimeout: number | CallOptions = 60000,
  extraOptions?: CallOptions
): Promise<unknown> {
  let timeoutMs = 60000;
  let priority: CallPriority = "user";
  let onProgress: ((percent: number, message?: string) => void) | undefined;
  let signal: AbortSignal | undefined;

  if (typeof optionsOrTimeout === "number") {
    timeoutMs = optionsOrTimeout;
    if (extraOptions) {
      if (extraOptions.priority) priority = extraOptions.priority;
      if (extraOptions.onProgress) onProgress = extraOptions.onProgress;
      if (extraOptions.signal) signal = extraOptions.signal;
    }
  } else if (typeof optionsOrTimeout === "object") {
    if (optionsOrTimeout.timeoutMs !== undefined) timeoutMs = optionsOrTimeout.timeoutMs;
    if (optionsOrTimeout.priority !== undefined) priority = optionsOrTimeout.priority;
    if (optionsOrTimeout.onProgress !== undefined) onProgress = optionsOrTimeout.onProgress;
    if (optionsOrTimeout.signal !== undefined) signal = optionsOrTimeout.signal;
  }

  if (signal && signal.aborted) {
    throw new Error(`Call '${method}' was aborted before dispatch`);
  }

  const id = randomUUID();

  return new Promise<unknown>((resolve, reject) => {
    let itemRef: QueueItem | null = null;

    if (signal) {
      signal.addEventListener("abort", () => {
        if (itemRef) {
          const idx = requestQueue.indexOf(itemRef);
          if (idx !== -1) {
            requestQueue.splice(idx, 1);
            reject(new Error(`Call '${method}' was aborted by caller`));
          }
        }
      });
    }

    itemRef = {
      id,
      method,
      params,
      priority,
      timeoutMs,
      enqueuedAt: Date.now(),
      onProgress,
      resolve,
      reject
    };

    enqueueRequest(itemRef);
  });
}

export interface BridgeStatusReport {
  connected: boolean;
  protocolVersion: number | null;
  serverVersion: string;
  panelVersion: string | null;
  panelCapabilities: string[];
  latencyMs: number | null;
  aeVersion: string | null;
  activeProject: string | null;
  queueDepth: number;
  uptimeSeconds: number;
  memory: {
    rssMb: number;
    heapUsedMb: number;
  };
}

export function getBridgeStatus(): BridgeStatusReport {
  const mem = process.memoryUsage();
  return {
    connected: isConnected(),
    protocolVersion: panelProtocolVersion,
    serverVersion: VERSION,
    panelVersion,
    panelCapabilities,
    latencyMs: roundTripLatencyMs,
    aeVersion: cachedAeVersion,
    activeProject: cachedActiveProject,
    queueDepth: requestQueue.length + (activeExecution ? 1 : 0),
    uptimeSeconds: Math.floor((Date.now() - serverStartTime) / 1000),
    memory: {
      rssMb: Math.round((mem.rss / (1024 * 1024)) * 100) / 100,
      heapUsedMb: Math.round((mem.heapUsed / (1024 * 1024)) * 100) / 100
    }
  };
}

/**
 * Stops the WebSocket server, terminates active clients, and rejects all pending calls.
 */
export async function stopBridge(): Promise<void> {
  stopHeartbeat();

  if (activeExecution) {
    clearTimeout(activeExecution.timer);
    activeExecution.item.reject(new Error("Server is shutting down"));
    activeExecution = null;
  }

  while (requestQueue.length > 0) {
    const item = requestQueue.shift()!;
    item.reject(new Error("Server is shutting down"));
  }

  if (activeClient) {
    activeClient.on("error", () => {});
    try {
      activeClient.close(1000, "Server shutdown");
    } catch {}
    activeClient = null;
  }

  if (wss) {
    await new Promise<void>((resolve) => {
      wss!.close(() => resolve());
    });
    wss = null;
  }

  panelProtocolVersion = null;
  panelVersion = null;
  roundTripLatencyMs = null;
}
