# Cursor Integration Guide

This guide describes how to configure AE Bridge within **Cursor**.

---

## Configuration

In Cursor, open **Settings > Features > MCP** or configure `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "ae-bridge": {
      "command": "node",
      "args": ["<path-to-ae-bridge>/server/dist/cli.js"]
    }
  }
}
```

Generate the JSON snippet via CLI:

```bash
node server/dist/cli.js config --client cursor
```

---

## Workflow in Cursor Composer

Once registered, Cursor Composer and Agent mode can invoke any of AE Bridge's tools directly to control After Effects or headless Blender.
