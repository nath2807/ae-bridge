# Security Policy

AE Bridge interacts with native software through local process communication. This document describes the security model, configuration safeguards, and vulnerability reporting procedures.

---

## Security Model

### 1. Loopback Binding (`127.0.0.1`)
The WebSocket communication channel between the Node.js MCP server and the Adobe CEP panel binds strictly to `127.0.0.1`. It never listens on external network interfaces (`0.0.0.0`) or accepts remote traffic.

### 2. Token-Based Handshake Authentication
On initial startup, AE Bridge generates a cryptographically secure 32-byte hexadecimal authorization token saved to `~/.ae-bridge/token` with restricted file permissions (`0600`).
- Any incoming WebSocket connection must transmit `{ type: "auth", token: "<token>" }` as its first message within 3.0 seconds.
- Connections that fail or time out are rejected and closed immediately.

### 3. Opting In to Raw ExtendScript Execution
The `ae_execute_extendscript` tool is disabled unless raw code execution is explicitly enabled. To opt in:

```bash
export AE_BRIDGE_ALLOW_RAW_SCRIPTS="true"
```

Only the value `true` (case-insensitive, with no surrounding whitespace) enables this tool. Unset values and all other values disable it. When enabled, raw code can perform any action available to After Effects; use dedicated `ae_*` tools whenever possible.

---

## Reporting a Vulnerability

If you discover a security vulnerability in AE Bridge:
1. Please do **NOT** open a public issue.
2. Email security details privately to the maintainers or report via GitHub Security Advisories.
3. Provide a clear description of the issue, affected versions, and steps to reproduce.
4. We will review and release a patch promptly.
