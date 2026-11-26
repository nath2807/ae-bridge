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

import { registerCoreTools } from "./tools/core.js";
import { registerCompTools } from "./tools/comps.js";
import { registerLayerTools } from "./tools/layers.js";
import { registerAnimationTools } from "./tools/animation.js";
import { registerEffectTools } from "./tools/effects.js";
import { registerTitleTools } from "./tools/titles.js";
import { registerFootageTools } from "./tools/footage.js";
import { registerEditingTools } from "./tools/editing.js";
import { registerTransitionTools } from "./tools/transitions.js";
import { registerTimeTools } from "./tools/time.js";
import { registerAudioTools } from "./tools/audio.js";
import { registerColorTools } from "./tools/color.js";
import { registerScene3dTools } from "./tools/scene3d.js";
import { registerCameraTools } from "./tools/camera.js";
import { registerLightingTools } from "./tools/lighting.js";
import { registerSceneTools } from "./tools/scenes.js";
import { registerLookTools } from "./tools/looks.js";
import { registerParticleTools } from "./tools/particles.js";
import { registerBackgroundTools } from "./tools/backgrounds.js";
import { registerDistortTools } from "./tools/distort.js";
import { registerRigTools } from "./tools/rigs.js";
import { registerPreviewTools, cleanOldPreviews } from "./tools/preview.js";
import { registerQaTools } from "./tools/qa.js";
import { registerProjectTools } from "./tools/project.js";
import { registerRenderTools } from "./tools/render.js";
import { registerFormatTools } from "./tools/formats.js";
import { registerTemplateTools } from "./tools/templates.js";
import { registerAnalysisTools } from "./tools/analysis.js";
import { registerBrandTools } from "./director/brand.js";
import { registerStoryboardTools } from "./director/storyboard.js";
import { registerRecipeTools } from "./director/recipes.js";
import { registerQualityTools } from "./tools/quality.js";
import { registerMotionTools } from "./tools/motion.js";
import { registerFinishingTools } from "./tools/finishing.js";
import { registerReferenceTools } from "./tools/reference.js";
import { registerStyleTools } from "./director/styles.js";
import { registerBlenderTools } from "./tools/blender.js";
import { registerBlenderAETools } from "./tools/blenderAE.js";
import { registerPrompts } from "./prompts.js";

export { stopBridge } from "./bridge.js";

export interface ServerRunOptions {
    httpPort?: number;
    skipHubLock?: boolean;
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

    registerCoreTools(server);
    registerCompTools(server);
    registerLayerTools(server);
    registerAnimationTools(server);
    registerEffectTools(server);
    registerTitleTools(server);
    registerFootageTools(server);
    registerEditingTools(server);
    registerTransitionTools(server);
    registerTimeTools(server);
    registerAudioTools(server);
    registerColorTools(server);
    registerScene3dTools(server);
    registerCameraTools(server);
    registerLightingTools(server);
    registerSceneTools(server);
    registerLookTools(server);
    registerParticleTools(server);
    registerBackgroundTools(server);
    registerDistortTools(server);
    registerRigTools(server);
    registerPreviewTools(server);
    registerQaTools(server);
    registerProjectTools(server);
    registerRenderTools(server);
    registerFormatTools(server);
    registerTemplateTools(server);
    registerAnalysisTools(server);
    registerBrandTools(server);
    registerStoryboardTools(server);
    registerRecipeTools(server);
    registerQualityTools(server);
    registerMotionTools(server);
    registerStyleTools(server);
    registerFinishingTools(server);
    registerReferenceTools(server);
    registerBlenderTools(server);
    registerBlenderAETools(server);
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
