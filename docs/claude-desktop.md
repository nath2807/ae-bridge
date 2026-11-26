# Claude Desktop Integration Guide

This guide describes how to configure AE Bridge with **Claude Desktop**.

---

## Configuration File Location

Locate your Claude Desktop configuration file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

---

## Configuration

Add `ae-bridge` to the `mcpServers` object in your configuration file:

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

*(Replace `<path-to-ae-bridge>` with your absolute path, using forward slashes `/` on Windows).*

Alternatively, generate the JSON configuration using the CLI:

```bash
node server/dist/cli.js config --client claude
```

---

## Verifying Connection

1. Launch Adobe After Effects and open **Window > Extensions > AE Bridge**.
2. Restart Claude Desktop.
3. Look for the hammer / tool icon in Claude Desktop indicating tools are loaded from `ae-bridge`.
