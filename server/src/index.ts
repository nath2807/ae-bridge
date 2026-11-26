import fs from "fs";
import { fileURLToPath } from "url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { startBridge, stopBridge, setCallDispatcher, getOrCreateAuthToken } from "./bridge.js";
import { killAllBlenderJobs } from "./blender/jobs.js";
import { VERSION } from "./utils/paths.js";
import { acquireHubOrProxy, removeLockFile } from "./hub/lock.js";
import { startHubIpcServer, stopHubIpcServer, startProxyClient, stopProxyClient, callHubProxy } from "./hub/ipc.js";
import { startHttpBridge } from "./hub/http.js";

import { TOOL_MODULES } from "./tools/registry.js";
import { getActiveProfile, createProfileFilter, ProfileName } from "./tools/profiles.js";
import { cleanOldPreviews } from "./tools/preview.js";
import { registerPrompts } from "./prompts.js";

export { stopBridge } from "./bridge.js";
export { getActiveProfile, createProfileFilter, isToolAllowedInProfile } from "./tools/profiles.js";
export { TOOL_MODULES, getToolCatalog } from "./tools/registry.js";

export interface ServerRunOptions {
    httpPort?: number;
    skipHubLock?: boolean;
    profile?: ProfileName;
}

export async function runServer(options?: ServerRunOptions): Promise<void> {
    console.error(`[ae-bridge] Starting server v${VERSION}...`);

    await cleanOldPreviews();

    const server = new McpServer({
        name: "ae-bridge",
        version: VERSION
    });

    const port = Number(process.env.AE_BRIDGE_PORT || 8765);
    const ipcPort = Number(process.env.AE_BRIDGE_IPC_PORT || port + 1);

    if (options?.skipHubLock) {
        await startBridge(port);
    } else {
        const { isHub, hubInfo } = await acquireHubOrProxy(port, ipcPort);
        if (isHub) {
            await startBridge(port);
            try {
                await startHubIpcServer(ipcPort);
            } catch (ipcErr) {
                console.error("[ae-bridge] Warning: Could not start Hub IPC server:", ipcErr);
            }

            if (options?.httpPort) {
                const token = getOrCreateAuthToken();
                await startHttpBridge(options.httpPort, token);
            }
        } else {
            const token = getOrCreateAuthToken();
            await startProxyClient(hubInfo.ipcPort, token);
            setCallDispatcher(callHubProxy);
            console.error(`[ae-bridge] Operating as Proxy client (connected to Hub PID ${hubInfo.pid} on IPC port ${hubInfo.ipcPort})`);
        }
    }

    const activeProfile: ProfileName = options?.profile || getActiveProfile();
    console.error(`[ae-bridge] Active tool profile: '${activeProfile}'`);
    const filteredServer = createProfileFilter(server, activeProfile);

    for (const mod of TOOL_MODULES) {
        mod.register(filteredServer);
    }
    registerPrompts(server);

    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error("[ae-bridge] Server ready and connected via stdio transport.");
}

// Graceful shutdown handling
let shuttingDown = false;
async function handleShutdown(signal: string): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    console.error(`[ae-bridge] Received ${signal}, shutting down gracefully...`);
    try {
        killAllBlenderJobs();
        setCallDispatcher(null);
        stopProxyClient();
        await stopHubIpcServer();
        removeLockFile();
        await stopBridge();
    } catch (err) {
        console.error("[ae-bridge] Error during shutdown:", err);
    }
    process.exit(0);
}

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));
if (process.stdin.isTTY === false) {
    process.stdin.on("close", () => handleShutdown("stdin close"));
}

// Auto-run if executed directly as entrypoint (safely handling spaces in paths)
if (process.argv[1]) {
    try {
        const entryFile = fs.realpathSync(process.argv[1]);
        const currentFile = fs.realpathSync(fileURLToPath(import.meta.url));
        if (entryFile === currentFile) {
            runServer().catch((err) => {
                console.error("[ae-bridge] Fatal startup error:", err);
                process.exit(1);
            });
        }
    } catch {}
}
