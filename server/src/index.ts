import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { startBridge } from "./bridge.js";
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

async function main(): Promise<void> {
    console.error("[ae-bridge] Starting server...");

    const server = new McpServer({
        name: "ae-bridge",
        version: "0.1.0"
    });

    await startBridge();
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

    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error("[ae-bridge] Server ready and connected via stdio transport.");
}

main().catch((err) => {
    console.error("[ae-bridge] Fatal startup error:", err);
    process.exit(1);
});
