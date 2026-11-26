import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "node:crypto";
import { getAeBridgeHome } from "./utils/paths.js";

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
  socket: WebSocket;
  method: string;
}

interface AeResponse {
  id?: string;
  type?: string;
  token?: string;
  ok?: boolean;
  result?: unknown;
  error?: string;
}

let wss: WebSocketServer | null = null;
let activeClient: WebSocket | null = null;
const pendingRequests = new Map<string, PendingCall>();

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
    console.error("[ae-bridge] Error reading existing auth token, regenerating:", err);
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
    console.error("[ae-bridge] Failed to persist auth token:", err);
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

function rejectPendingForSocket(socket: WebSocket, reason: string): void {
  for (const [id, pending] of pendingRequests.entries()) {
    if (pending.socket === socket) {
      clearTimeout(pending.timer);
      pending.reject(new Error(`After Effects panel disconnected while executing '${pending.method}': ${reason}`));
      pendingRequests.delete(id);
    }
  }
}

export function startBridge(customPort?: number): Promise<void> {
  const port = customPort ?? Number(process.env.AE_BRIDGE_PORT || 8765);
  const host = "127.0.0.1";
  const expectedToken = getOrCreateAuthToken();

  return new Promise((resolve, reject) => {
    wss = new WebSocketServer({
      host,
      port,
      maxPayload: 100 * 1024 * 1024 // 100 MB max payload
    });

    wss.on("listening", () => {
      console.error(`[ae-bridge] WebSocket listening on ws://${host}:${port} (bound to 127.0.0.1)`);
      resolve();
    });

    wss.on("connection", (ws: WebSocket, req: http.IncomingMessage) => {
      // Validate Origin header (Cross-Site WebSocket Hijacking defense)
      const origin = req.headers.origin;
      if (origin) {
        const lower = origin.toLowerCase();
        if (lower.startsWith("http://") || lower.startsWith("https://")) {
          console.error(`[ae-bridge] Rejecting WebSocket connection from untrusted web browser origin: ${origin}`);
          ws.close(4003, "Forbidden origin");
          return;
        }
      }

      console.error("[ae-bridge] After Effects panel opened connection, awaiting auth token...");
      let isAuthenticated = false;

      // Reject clients that fail to authenticate within 3s
      const authTimeout = setTimeout(() => {
        if (!isAuthenticated) {
          console.error("[ae-bridge] WebSocket client authentication timed out (3s)");
          try {
            ws.send(JSON.stringify({ type: "auth_failed", error: "Authentication timeout after 3s" }));
            ws.close(4001, "Auth timeout");
          } catch {}
        }
      }, 3000);

      ws.on("message", (raw: string | Buffer) => {
        try {
          const payload: AeResponse = JSON.parse(raw.toString());

          // Handle initial authentication handshake
          if (!isAuthenticated) {
            if (payload.type === "auth" && timingSafeTokenCompare(payload.token, expectedToken)) {
              isAuthenticated = true;
              clearTimeout(authTimeout);

              if (activeClient && activeClient !== ws) {
                console.error("[ae-bridge] Replacing existing client connection with newest authenticated panel");
                const oldClient = activeClient;
                activeClient = ws;
                // Keep error listener alive to avoid uncaught exceptions during closing
                oldClient.on("error", () => {});
                rejectPendingForSocket(oldClient, "Replaced by newer panel connection");
                try {
                  oldClient.close(4000, "Replaced by newer panel connection");
                } catch {}
              } else {
                activeClient = ws;
              }

              try {
                ws.send(JSON.stringify({ type: "auth_ok" }));
              } catch {}
              console.error("[ae-bridge] After Effects panel authenticated successfully");
              return;
            } else {
              clearTimeout(authTimeout);
              console.error("[ae-bridge] Authentication failed: invalid token received");
              try {
                ws.send(JSON.stringify({ type: "auth_failed", error: "Invalid authentication token" }));
                ws.close(4003, "Authentication failed");
              } catch {}
              return;
            }
          }

          // Handle authenticated ExtendScript responses
          if (!payload.id) return;

          const pending = pendingRequests.get(payload.id);
          if (!pending) return;

          clearTimeout(pending.timer);
          pendingRequests.delete(payload.id);

          if (payload.ok) {
            pending.resolve(payload.result);
          } else {
            pending.reject(new Error(payload.error || "ExtendScript execution failed"));
          }
        } catch (err) {
          console.error("[ae-bridge] Error parsing client message:", err);
        }
      });

      ws.on("close", (code, reason) => {
        clearTimeout(authTimeout);
        const reasonStr = reason ? reason.toString() : "normal";
        rejectPendingForSocket(ws, `Socket closed (${code}: ${reasonStr})`);
        if (activeClient === ws) {
          console.error("[ae-bridge] Active After Effects panel disconnected");
          activeClient = null;
        }
      });

      ws.on("error", (err) => {
        clearTimeout(authTimeout);
        console.error("[ae-bridge] Client socket error:", err);
        rejectPendingForSocket(ws, `Socket error: ${err.message}`);
        if (activeClient === ws) {
          activeClient = null;
        }
      });
    });

    wss.on("error", (err) => {
      console.error("[ae-bridge] WebSocket server error:", err);
      reject(err);
    });
  });
}

/**
 * Dispatch an ExtendScript method call to the active After Effects CEP panel over WebSocket.
 */
export async function callAE(
  method: string,
  params: object = {},
  timeoutMs = 60000
): Promise<unknown> {
  if (!isConnected() || !activeClient) {
    throw new Error(
      "After Effects panel is not connected or authenticated. Open Window > Extensions > AE Bridge."
    );
  }

  const id = randomUUID();
  const requestPayload = JSON.stringify({ id, method, params });
  const socket = activeClient;

  return new Promise<unknown>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`Call '${method}' timed out after ${timeoutMs / 1000}s waiting for After Effects response`));
    }, timeoutMs);

    pendingRequests.set(id, { resolve, reject, timer, socket, method });

    try {
      socket.send(requestPayload);
    } catch (err) {
      clearTimeout(timer);
      pendingRequests.delete(id);
      reject(new Error(`Failed to send message to After Effects: ${(err as Error).message}`));
    }
  });
}

/**
 * Stops the WebSocket server, terminates active clients, and rejects all pending calls.
 */
export async function stopBridge(): Promise<void> {
  for (const [id, pending] of pendingRequests.entries()) {
    clearTimeout(pending.timer);
    pending.reject(new Error("Server is shutting down"));
  }
  pendingRequests.clear();

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
}
