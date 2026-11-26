import http from "http";
import crypto from "crypto";
import { callAE, getBridgeStatus, CallPriority } from "../bridge.js";
import { logger } from "../utils/logger.js";

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
 * Starts an optional lightweight HTTP bridge server allowing external, remote,
 * or browser-based AI agents to query status and dispatch calls over HTTP POST.
 */
export function startHttpBridge(port: number, expectedToken: string): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      // CORS headers for authorized local/web environments
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-AE-Bridge-Token");

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      // Authenticate via Authorization header or query token
      const authHeader = req.headers.authorization || (req.headers["x-ae-bridge-token"] as string) || "";
      const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();

      const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
      const queryToken = url.searchParams.get("token") || "";

      const providedToken = bearerToken || queryToken;

      if (!timingSafeTokenCompare(providedToken, expectedToken)) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "Unauthorized: Invalid or missing token" }));
        return;
      }

      // Endpoint: GET /status or GET /health
      if (req.method === "GET" && (url.pathname === "/status" || url.pathname === "/health")) {
        const status = getBridgeStatus();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(status, null, 2));
        return;
      }

      // Endpoint: POST /call
      if (req.method === "POST" && url.pathname === "/call") {
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });

        req.on("end", async () => {
          try {
            const payload = JSON.parse(body || "{}");
            const { method, params = {}, priority = "user", timeoutMs = 60000 } = payload;

            if (!method) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ ok: false, error: "Missing required 'method' parameter" }));
              return;
            }

            const result = await callAE(method, params, {
              priority: priority as CallPriority,
              timeoutMs
            });

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true, result }));
          } catch (err: any) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: false, error: err.message || String(err) }));
          }
        });
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Not Found" }));
    });

    server.listen(port, "127.0.0.1", () => {
      logger.info(`Streamable HTTP Bridge listening on http://127.0.0.1:${port}`);
      resolve(server);
    });

    server.on("error", (err) => {
      logger.error("HTTP Bridge error:", err);
      reject(err);
    });
  });
}
