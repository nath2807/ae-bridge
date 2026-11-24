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
import { registerPrompts } from "./prompts.js";

export async function runServer(): Promise<void> {
    console.error("[ae-bridge] Starting server v1.0.0...");

    await cleanOldPreviews();

    const server = new McpServer({
        name: "ae-bridge",
        version: "1.0.0"
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
    registerPrompts(server);

    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error("[ae-bridge] Server ready and connected via stdio transport.");
}

// Auto-run if executed directly as entrypoint
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
    runServer().catch((err) => {
        console.error("[ae-bridge] Fatal startup error:", err);
        process.exit(1);
    });
}
