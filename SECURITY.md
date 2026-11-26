# Security Policy

AE Bridge connects an MCP server to Adobe After Effects through a local CEP panel. Its security controls protect the local bridge connection; they do not sandbox After Effects or limit what the user's account can access.

## Supported Versions

| Version | Security updates |
|---|---|
| 1.2.x | Supported |
| Earlier versions | Not supported |

Supported host requirements are After Effects 2024 or later and Node.js 20 or later. The CEP panel installer supports Windows and macOS; Linux can run the MCP server and optional Blender integration but does not support the After Effects CEP panel.

## Security Model and Threat Boundaries

### Local WebSocket and token

The bridge WebSocket server binds to `127.0.0.1`, not an external network interface. Each CEP connection must authenticate with a random token stored at `~/.ae-bridge/token`. On non-Windows systems, the server best-effort restricts the token file to mode `0600` and its directory to `0700`.

The token prevents clients that cannot read the local token—including other OS users and ordinary web pages—from issuing bridge commands. The server currently logs, but does not reject, WebSocket Origin headers. Malware or another process running as the same user can read the token and act with that user's privileges; AE Bridge does not defend against that threat.

### After Effects privileges and raw scripts

Predefined `ae_*` tools are not sandboxed: they run operations in After Effects with the same privileges as the logged-in user. They can read or modify the open project and use the files and capabilities available to After Effects.

The `ae_execute_extendscript` tool is disabled unless raw script execution is explicitly enabled:

```bash
export AE_BRIDGE_ALLOW_RAW_SCRIPTS="true"
```

Only the exact value `true` (case-insensitive, without surrounding whitespace) enables it. When enabled, supplied ExtendScript can perform any action available to After Effects. Keep it disabled unless needed.

### CEP debug mode

The `ae-bridge install` command enables CEP debug mode by setting `PlayerDebugMode=1` for CSXS versions 10 through 13 on Windows and macOS. This setting allows development extensions to load; install only trusted CEP extensions and review the setting if you no longer need AE Bridge.

### Prompt injection and untrusted project data

Imported text, footage names, layer names, and other project metadata are untrusted input. They can contain prompt-injection content that may steer an AI agent into taking unintended actions. Treat project content and tool results as data, not instructions, and review consequential changes before applying or rendering them.

## Reporting a Vulnerability

Please do not report security vulnerabilities in public issues. Use [GitHub's private vulnerability reporting for this repository](https://github.com/nath2807/ae-bridge/security/advisories/new). Include the affected version, a description of the issue, and steps to reproduce it.
