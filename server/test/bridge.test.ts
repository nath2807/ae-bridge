import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer } from "node:net";
import WebSocket from "ws";
import { callAE, getOrCreateAuthToken, isConnected, startBridge, stopBridge } from "../src/bridge.js";

let port: number;
const clients: WebSocket[] = [];

async function getAvailablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Failed to determine an available port");
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return address.port;
}

function connect(): Promise<WebSocket> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  clients.push(ws);
  return new Promise((resolve, reject) => {
    ws.once("open", () => resolve(ws));
    ws.once("error", reject);
  });
}

function nextMessage(ws: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    ws.once("message", (data) => {
      try {
        resolve(JSON.parse(data.toString()));
      } catch (error) {
        reject(error);
      }
    });
    ws.once("error", reject);
  });
}

function nextClose(ws: WebSocket): Promise<number> {
  if (ws.readyState === WebSocket.CLOSED) return Promise.resolve(1006);
  return new Promise((resolve) => ws.once("close", (code) => resolve(code)));
}

async function authenticate(ws: WebSocket): Promise<void> {
  const response = nextMessage(ws);
  ws.send(JSON.stringify({ type: "auth", token: getOrCreateAuthToken() }));
  expect(await response).toEqual({ type: "auth_ok" });
}

describe("WebSocket bridge", () => {
  beforeEach(async () => {
    port = await getAvailablePort();
    await startBridge(port);
  });

  afterEach(async () => {
    await stopBridge();
    clients.length = 0;
  });

  it("authenticates and completes a call", async () => {
    const ws = await connect();
    await authenticate(ws);
    const request = nextMessage(ws);
    const result = callAE("test_method", { value: 1 });
    const payload = await request;
    ws.send(JSON.stringify({ id: payload.id, ok: true, result: "done" }));
    await expect(result).resolves.toBe("done");
    expect(isConnected()).toBe(true);
  });

  it("rejects a client with the wrong token", async () => {
    const ws = await connect();
    const response = nextMessage(ws);
    ws.send(JSON.stringify({ type: "auth", token: "wrong-token" }));
    expect(await response).toMatchObject({ type: "auth_failed" });
    await nextClose(ws);
    expect(isConnected()).toBe(false);
  });

  it("closes clients that do not authenticate before the deadline", async () => {
    const ws = await connect();
    const close = nextClose(ws);
    expect(await close).toBe(4001);
  }, 5000);

  it("closes oversized pre-authentication messages", async () => {
    const ws = await connect();
    const close = nextClose(ws);
    ws.send("x".repeat(4097));
    expect(await close).toBe(1009);
  });

  it("replaces an authenticated client and rejects its pending calls", async () => {
    const first = await connect();
    await authenticate(first);
    const pending = callAE("waiting_method");
    const replacementError = expect(pending).rejects.toThrow(/connection was replaced/);
    const firstClose = nextClose(first);

    const second = await connect();
    await authenticate(second);

    await replacementError;
    await firstClose;
    expect(isConnected()).toBe(true);
  });

  it("rejects pending calls when their socket disconnects", async () => {
    const ws = await connect();
    await authenticate(ws);
    const request = nextMessage(ws);
    const pending = callAE("disconnect_method");
    await request;
    const rejected = expect(pending).rejects.toThrow(/panel disconnected/);
    ws.close();
    await rejected;
  });

  it("warns that a timed-out operation may still complete", async () => {
    const ws = await connect();
    await authenticate(ws);
    await expect(callAE("slow_method", {}, 20)).rejects.toThrow(/may still complete inside After Effects/);
  });
});
