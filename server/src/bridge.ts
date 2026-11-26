import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "node:crypto";

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
  socket: WebSocket;
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
const authTimers = new Set<NodeJS.Timeout>();

function rejectPendingForSocket(socket: WebSocket, message: string): void {
  for (const [id, pending] of pendingRequests) {
    if (pending.socket !== socket) continue;
    clearTimeout(pending.timer);
    pendingRequests.delete(id);
    pending.reject(new Error(message));
  }
}

export function getAuthTokenPath(): string {
  const dir = path.join(os.homedir(), ".ae-bridge");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  if (process.platform !== "win32") {
    try {
      fs.chmodSync(dir, 0o700);
    } catch {}
  }
  return path.join(dir, "token");
}

export function getOrCreateAuthToken(): string {
  const tokenFile = getAuthTokenPath();
  try {
    if (fs.existsSync(tokenFile)) {
      if (process.platform !== "win32") {
        try {
          fs.chmodSync(tokenFile, 0o600);
        } catch {}
      }
      const existing = fs.readFileSync(tokenFile, "utf-8").trim();
      if (existing.length >= 16) {
        return existing;
      }
    }
  } catch (err) {
    console.error("[ae-bridge] Error reading existing auth token, regenerating:", err);
  }

  const newToken = crypto.randomBytes(32).toString("hex");
  try {
    fs.writeFileSync(tokenFile, newToken, { encoding: "utf-8", mode: 0o600 });
    if (process.platform !== "win32") {
      try {
        fs.chmodSync(tokenFile, 0o600);
      } catch {}
    }
  } catch (err) {
    console.error("[ae-bridge] Failed to persist auth token:", err);
    throw err;
  }
  return newToken;
}

export function isConnected(): boolean {
  return activeClient !== null && activeClient.readyState === WebSocket.OPEN;
}

export function startBridge(customPort?: number): Promise<void> {
  const port = customPort ?? Number(process.env.AE_BRIDGE_PORT || 8765);
  const host = "127.0.0.1";
  const expectedToken = getOrCreateAuthToken();
  const configuredMaxPayload = Number(process.env.AE_BRIDGE_MAX_PAYLOAD || 64 * 1024 * 1024);
  const maxPayload =
    Number.isSafeInteger(configuredMaxPayload) && configuredMaxPayload > 0
      ? configuredMaxPayload
      : 64 * 1024 * 1024;

  return new Promise((resolve, reject) => {
    wss = new WebSocketServer({ host, port, maxPayload });

    wss.on("listening", () => {
      console.error(`[ae-bridge] WebSocket listening on ws://${host}:${port} (bound to 127.0.0.1)`);
      resolve();
    });

    wss.on("connection", (ws: WebSocket, request) => {
      console.error(
        `[ae-bridge] Incoming WebSocket connection (Origin: ${request.headers.origin ?? "(none)"}); awaiting auth token...`
      );
      let isAuthenticated = false;

      // Reject clients that fail to authenticate within 3s
      const authTimeout = setTimeout(() => {
        authTimers.delete(authTimeout);
        if (!isAuthenticated) {
          console.error("[ae-bridge] WebSocket client authentication timed out (3s)");
          try {
            ws.send(JSON.stringify({ type: "auth_failed", error: "Authentication timeout after 3s" }));
            ws.close(4001, "Auth timeout");
          } catch {}
        }
      }, 3000);
      authTimers.add(authTimeout);

      ws.on("message", (raw: string | Buffer) => {
        if (!isAuthenticated && Buffer.byteLength(raw) > 4096) {
          clearTimeout(authTimeout);
          authTimers.delete(authTimeout);
          console.error("[ae-bridge] Closing unauthenticated WebSocket client for oversized message");
          ws.close(1009, "Pre-authentication message too large");
          return;
        }

        try {
          const payload: AeResponse = JSON.parse(raw.toString());

          // Handle initial authentication handshake
          if (!isAuthenticated) {
            const suppliedToken =
              payload.type === "auth" && typeof payload.token === "string"
                ? Buffer.from(payload.token.trim())
                : null;
            const expectedTokenBuffer = Buffer.from(expectedToken);
            if (
              suppliedToken &&
              suppliedToken.length === expectedTokenBuffer.length &&
              crypto.timingSafeEqual(suppliedToken, expectedTokenBuffer)
            ) {
              isAuthenticated = true;
              clearTimeout(authTimeout);
              authTimers.delete(authTimeout);

              if (activeClient && activeClient !== ws) {
                console.error("[ae-bridge] Replacing existing client connection with newest authenticated panel");
                rejectPendingForSocket(
                  activeClient,
                  "After Effects panel connection was replaced before the request completed"
                );
                activeClient.on("error", () => {});
                activeClient.removeAllListeners();
                activeClient.close();
              }
              activeClient = ws;

              try {
                ws.send(JSON.stringify({ type: "auth_ok" }));
              } catch {}
              console.error("[ae-bridge] After Effects panel authenticated successfully");
              return;
            } else {
              clearTimeout(authTimeout);
              authTimers.delete(authTimeout);
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
          if (!pending || pending.socket !== ws) return;

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

      ws.on("close", () => {
        clearTimeout(authTimeout);
        authTimers.delete(authTimeout);
        rejectPendingForSocket(ws, "After Effects panel disconnected before the request completed");
        if (activeClient === ws) {
          console.error("[ae-bridge] Active After Effects panel disconnected");
          activeClient = null;
        }
      });

      ws.on("error", (err) => {
        clearTimeout(authTimeout);
        console.error("[ae-bridge] Client socket error:", err);
      });
    });

    wss.on("error", (err) => {
      console.error("[ae-bridge] WebSocket server error:", err);
      reject(err);
    });
  });
}

export function stopBridge(): Promise<void> {
  for (const timer of authTimers) clearTimeout(timer);
  authTimers.clear();

  for (const [id, pending] of pendingRequests) {
    clearTimeout(pending.timer);
    pendingRequests.delete(id);
    pending.reject(new Error("After Effects bridge stopped before the request completed"));
  }

  const server = wss;
  wss = null;
  activeClient = null;
  if (!server) return Promise.resolve();

  for (const client of server.clients) client.terminate();
  return new Promise((resolve) => server.close(() => resolve()));
}

/**
 * Dispatch an ExtendScript method call to the active After Effects CEP panel over WebSocket.
 * 
 * Note: During in-AE renders (`mode: "ae"` with `app.project.renderQueue.render()`),
 * After Effects is fully synchronous/blocked. For rendering tools, pass an extended `timeoutMs`
 * (e.g. up to 2 hours: `7200000` ms).
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

  return new Promise<unknown>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      reject(
        new Error(
          `Call '${method}' timed out after ${timeoutMs / 1000}s waiting for After Effects response; the operation may still complete inside After Effects, so do not retry blindly`
        )
      );
    }, timeoutMs);

    const socket = activeClient!;
    pendingRequests.set(id, { resolve, reject, timer, socket });

    try {
      socket.send(requestPayload);
    } catch (err) {
      clearTimeout(timer);
      pendingRequests.delete(id);
      reject(new Error(`Failed to send message to After Effects: ${(err as Error).message}`));
    }
  });
}
