import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { startBridge } from "./bridge.js";
import { registerCoreTools } from "./tools/core.js";

async function main(): Promise<void> {
    console.error("[ae-bridge] Starting server...");

    const server = new McpServer({
        name: "ae-bridge",
        version: "0.1.0"
    });

    await startBridge();
    registerCoreTools(server);

    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error("[ae-bridge] Server ready and connected via stdio transport.");
}

main().catch((err) => {
    console.error("[ae-bridge] Fatal startup error:", err);
    process.exit(1);
});
