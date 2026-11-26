import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "node:crypto";
import { callAE, getOrCreateAuthToken, CallPriority } from "../bridge.js";
import { logger } from "../utils/logger.js";
import crypto from "crypto";

let ipcServer: WebSocketServer | null = null;
let proxyClientSocket: WebSocket | null = null;

const pendingIpcCalls = new Map<string, {
  resolve: (val: unknown) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}>();

function timingSafeTokenCompare(received: unknown, expected: string): boolean {
  if (typeof received !== "string") return false;
  const receivedBuf = Buffer.from(received.trim(), "utf-8");
  const expectedBuf = Buffer.from(expected.trim(), "utf-8");
  if (receivedBuf.length !== expectedBuf.length || receivedBuf.length === 0) {
    return false;
  }
  return crypto.timingSafeEqual(receivedBuf, expectedBuf);
}

/**
 * Starts the Hub IPC server allowing secondary AI client processes to route
 * ExtendScript calls through the primary Hub's single-threaded queue.
 */
export function startHubIpcServer(ipcPort = 8766): Promise<void> {
  const host = "127.0.0.1";
  const expectedToken = getOrCreateAuthToken();

  return new Promise((resolve, reject) => {
    ipcServer = new WebSocketServer({ host, port: ipcPort });

    ipcServer.on("listening", () => {
      logger.info(`Hub IPC server listening on ws://${host}:${ipcPort} (for multi-client proxying)`);
      resolve();
    });

    ipcServer.on("connection", (ws: WebSocket) => {
      let isAuthed = false;

      ws.on("message", async (raw: string | Buffer) => {
        try {
          const payload = JSON.parse(raw.toString());

          if (!isAuthed) {
            if (payload.type === "proxy_auth" && timingSafeTokenCompare(payload.token, expectedToken)) {
              isAuthed = true;
              ws.send(JSON.stringify({ type: "proxy_auth_ok" }));
              logger.info("Proxy client authenticated with Hub IPC server");
              return;
            } else {
              ws.send(JSON.stringify({ type: "proxy_auth_failed", error: "Invalid proxy token" }));
              ws.close(4003, "Invalid token");
              return;
            }
          }

          if (payload.id && payload.method) {
            const { id, method, params, priority, timeoutMs } = payload;
            try {
              const result = await callAE(method, params || {}, {
                priority: (priority as CallPriority) || "user",
                timeoutMs: timeoutMs || 60000
              });
              ws.send(JSON.stringify({ id, ok: true, result }));
            } catch (err: any) {
              ws.send(JSON.stringify({
                id,
                ok: false,
                error: err.message || String(err),
                errorName: err.name,
                line: err.line,
                file: err.file
              }));
            }
          }
        } catch (err) {
          logger.error("Error handling Hub IPC message:", err);
        }
      });
    });

    ipcServer.on("error", (err) => {
      logger.error("Hub IPC server error:", err);
      reject(err);
    });
  });
}

export function stopHubIpcServer(): Promise<void> {
  return new Promise((resolve) => {
    if (ipcServer) {
      ipcServer.close(() => {
        ipcServer = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

/**
 * Starts a proxy client in a secondary process, connecting to the primary Hub's IPC port.
 */
export function startProxyClient(ipcPort = 8766, token: string): Promise<void> {
  return new Promise((resolve, reject) => {
    proxyClientSocket = new WebSocket(`ws://127.0.0.1:${ipcPort}`);

    proxyClientSocket.on("open", () => {
      proxyClientSocket!.send(JSON.stringify({
        type: "proxy_auth",
        token
      }));
    });

    proxyClientSocket.on("message", (raw: string | Buffer) => {
      try {
        const payload = JSON.parse(raw.toString());

        if (payload.type === "proxy_auth_ok") {
          logger.info("Connected to primary AE Bridge Hub over IPC channel");
          resolve();
          return;
        }

        if (payload.type === "proxy_auth_failed") {
          reject(new Error(`Proxy authentication failed: ${payload.error}`));
          return;
        }

        if (payload.id) {
          const pending = pendingIpcCalls.get(payload.id);
          if (pending) {
            clearTimeout(pending.timer);
            pendingIpcCalls.delete(payload.id);
            if (payload.ok) {
              pending.resolve(payload.result);
            } else {
              pending.reject(new Error(payload.error || "IPC execution failed"));
            }
          }
        }
      } catch (err) {
        logger.error("Error in proxy client message handler:", err);
      }
    });

    proxyClientSocket.on("error", (err) => {
      reject(err);
    });
  });
}

/**
 * Dispatches a tool call from the proxy client process through the primary Hub.
 */
export function callHubProxy(
  method: string,
  params: object = {},
  options?: { priority?: CallPriority; timeoutMs?: number }
): Promise<unknown> {
  if (!proxyClientSocket || proxyClientSocket.readyState !== WebSocket.OPEN) {
    throw new Error("Proxy connection to AE Bridge Hub is not open");
  }

  const id = randomUUID();
  const timeoutMs = options?.timeoutMs || 60000;

  return new Promise<unknown>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingIpcCalls.delete(id);
      reject(new Error(`Proxy call '${method}' timed out waiting for Hub after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    pendingIpcCalls.set(id, { resolve, reject, timer });

    try {
      proxyClientSocket!.send(JSON.stringify({
        id,
        method,
        params,
        priority: options?.priority || "user",
        timeoutMs
      }));
    } catch (err) {
      clearTimeout(timer);
      pendingIpcCalls.delete(id);
      reject(err);
    }
  });
}

export function stopProxyClient(): void {
  for (const [id, pending] of pendingIpcCalls.entries()) {
    clearTimeout(pending.timer);
    pending.reject(new Error("Proxy client is stopping"));
  }
  pendingIpcCalls.clear();

  if (proxyClientSocket) {
    try {
      proxyClientSocket.close(1000, "Proxy client stopping");
    } catch {}
    proxyClientSocket = null;
  }
}
