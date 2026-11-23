import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "node:crypto";

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
}

interface AeResponse {
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

let wss: WebSocketServer | null = null;
let activeClient: WebSocket | null = null;
const pendingRequests = new Map<string, PendingCall>();

export function isConnected(): boolean {
  return activeClient !== null && activeClient.readyState === WebSocket.OPEN;
}

export function startBridge(customPort?: number): Promise<void> {
  const port = customPort ?? Number(process.env.AE_BRIDGE_PORT || 8765);
  const host = "127.0.0.1";

  return new Promise((resolve, reject) => {
    wss = new WebSocketServer({ host, port });

    wss.on("listening", () => {
      console.error(`[ae-bridge] WebSocket listening on ws://${host}:${port}`);
      resolve();
    });

    wss.on("connection", (ws: WebSocket) => {
      console.error("[ae-bridge] After Effects panel connected");

      if (activeClient && activeClient !== ws) {
        console.error("[ae-bridge] Replacing existing client connection with newest panel");
        activeClient.removeAllListeners();
        activeClient.close();
      }
      activeClient = ws;

      ws.on("message", (raw: string | Buffer) => {
        try {
          const payload: AeResponse = JSON.parse(raw.toString());
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

      ws.on("close", () => {
        if (activeClient === ws) {
          console.error("[ae-bridge] Active After Effects panel disconnected");
          activeClient = null;
        }
      });

      ws.on("error", (err) => {
        console.error("[ae-bridge] Client socket error:", err);
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
      "After Effects panel is not connected. Open Window > Extensions > AE Bridge."
    );
  }

  const id = randomUUID();
  const requestPayload = JSON.stringify({ id, method, params });

  return new Promise<unknown>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`Call '${method}' timed out after ${timeoutMs / 1000}s waiting for After Effects response`));
    }, timeoutMs);

    pendingRequests.set(id, { resolve, reject, timer });

    try {
      activeClient!.send(requestPayload);
    } catch (err) {
      clearTimeout(timer);
      pendingRequests.delete(id);
      reject(new Error(`Failed to send message to After Effects: ${(err as Error).message}`));
    }
  });
}
