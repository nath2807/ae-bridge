# Contributing New Tools

Adding a new tool to AE Bridge requires three coordinated steps: ExtendScript execution, Zod schema definition, and documentation generation.

---

## Step 1: Implement the ExtendScript Handler
Add your logic to the appropriate file in `cep-panel/jsx/tools/<category>.jsx`:

```javascript
// In cep-panel/jsx/tools/mycategory.jsx
(function () {
    if (!$.global.aeBridge) return;

    function myNewAction(params) {
        return withUndo("My New Action", function () {
            var comp = findComp(params.compRef);
            // Perform native After Effects operations
            var layer = comp.layers.addSolid([1, 0, 0], "My Red Solid", comp.width, comp.height, 1);
            return {
                layerIndex: layer.index,
                layerName: layer.name
            };
        });
    }

    // Register on the shared dispatcher
    $.global.aeBridge.handlers.ae_my_new_action = myNewAction;
})();
```

---

## Step 2: Implement the Node.js MCP Tool
Define the input validation schema and MCP tool registration in `server/src/tools/<category>.ts`:

```typescript
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callAE } from "../bridge.js";
import { compRefSchema, toolSuccess, toolError } from "./schemas.js";

export function registerMyCategoryTools(server: McpServer): void {
  server.tool(
    "ae_my_new_action",
    "Description of what the tool accomplishes in After Effects.",
    {
      compRef: compRefSchema.optional().describe("Composition reference"),
      customParam: z.string().describe("Descriptive input parameter")
    },
    async (params) => {
      try {
        const result = await callAE("ae_my_new_action", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
```

> **Important:** Always use `z.array(...)` rather than `z.tuple(...)` to maintain MCP compatibility.

---

## Step 3: Register in Server Entrypoint
If creating a new category, import and call `registerMyCategoryTools(server)` in `server/src/index.ts` and add it to `server/scripts/gen-docs.ts`.

---

## Step 4: Re-generate Documentation & Test
```bash
# Run unit tests
npm --prefix server test

# Auto-generate updated docs/tools.md
npm --prefix server run docs

# Compile TypeScript
npm --prefix server run build
```
Hot-reload your JSX changes in After Effects without restarting by calling `ae_reload_tools`.
