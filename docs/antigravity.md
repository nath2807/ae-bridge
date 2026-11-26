# Antigravity Integration Guide

This guide describes how to configure and use AE Bridge inside **Google Antigravity**.

---

## 1. Global MCP Configuration

To make AE Bridge available across all Antigravity workspaces, add the server configuration to your global Antigravity MCP settings file located at:

- **Windows:** `%USERPROFILE%\.gemini\antigravity\mcp_config.json`
- **macOS / Linux:** `~/.gemini/antigravity/mcp_config.json`

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

Replace `<path-to-ae-bridge>` with the absolute path to your cloned `ae-bridge` repository.

---

## 2. Workspace-Specific Configuration

To enable AE Bridge only within a specific project or repository, add the configuration to:

`.antigravity/mcp_config.json`

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

---

## 3. Automated Configuration via CLI

You can output the formatted JSON snippet for Antigravity anytime using:

```bash
node server/dist/cli.js config --client antigravity
```

---

## 4. Using Slash Commands & Prompts in Antigravity

AE Bridge provides high-level production prompts that integrate smoothly with Antigravity:

- **`/director`**: Launches the Executive Video Director pipeline. Guides your agent through project status inspection, brand kit alignment, storyboard construction, high-end finishing passes, scored rubric evaluations, and final rendering.
- **`/polish`**: Conducts a senior motion graphics polish pass on an existing composition, running automated QA inspections, contact sheet generation, motion easing enhancements, and pacing refinement.
