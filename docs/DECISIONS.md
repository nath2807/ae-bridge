# Architecture & Design Decisions Log

This document records architectural decisions, evaluated alternatives, and rationale made during the development of AE Bridge v1.3.0.

---

## DEC-001: Environment Variable Isolation via `AE_BRIDGE_HOME`
- **Date**: 2026-11-26
- **Context**: AE Bridge previously wrote state, tokens, and logs directly to `~/.ae-bridge`. Running tests or development instances could overwrite the user's active session token and state files.
- **Decision**: Introduce `AE_BRIDGE_HOME` environment variable, defaulting to `path.join(os.homedir(), ".ae-bridge")`. In all test suites and harnesses, set `AE_BRIDGE_HOME` to a clean temporary directory.
- **Alternatives Considered**:
  - *Keep `~/.ae-bridge` with mocking*: Fragile and requires mocking `fs` across multiple modules.
  - *Pass config object everywhere*: Requires heavy refactoring of all global singletons and CLI callers.
- **Reason**: Environment variable allows zero-overhead path resolution, full process-level isolation for test runners and multi-tenancy, and backward compatibility for end users.

---

## DEC-002: Canonical CEP Extension Folder Name (`com.aebridge`)
- **Date**: 2026-11-26
- **Context**: The extension bundle ID in `cep-panel/CSXS/manifest.xml` is `com.aebridge`. The CLI installed to `<CEP_DIR>/com.aebridge`, but `scripts/install-windows.ps1` previously installed to `<CEP_DIR>/ae-bridge`, causing dual installations or missing symlinks.
- **Decision**: Standardize on `com.aebridge` across all installers, CLI commands, scripts, and documentation. Add automatic cleanup of any legacy `ae-bridge` directory or junction during install.
- **Alternatives Considered**:
  - *Change bundle ID to `ae-bridge`*: Violates reverse-DNS naming convention for Adobe CEP panels and breaks existing CEP panel registrations.
- **Reason**: Consistency with manifest bundle ID and Adobe CEP best practices.

---

## DEC-003: Pinned Dependencies & Integrity Verification for External Assets
- **Date**: 2026-11-26
- **Context**: `CSInterface.js` is fetched from Adobe's GitHub repository. Previously, a simple HTTP stream was downloaded without integrity verification or atomic renaming, leading to corrupted 0-byte files upon network blips.
- **Decision**: Create `server/deps/manifest.json` locking `CSInterface.js` to a specific commit SHA (`1e9d5ea` or release tag) and SHA-256 hash. Downloads write to a temp file, verify hash and size, and atomically rename to destination.
- **Alternatives Considered**:
  - *Bundle `CSInterface.js` inside git repo*: Clean, but licensing and upstream updates require manual tracking.
  - *Always download latest from main branch*: Non-deterministic, insecure, prone to breaking changes.
- **Reason**: Cryptographic reproducibility and resilience against network failures.

---

## DEC-004: Timing-Safe Token Authentication and Origin Check
- **Date**: 2026-11-26
- **Context**: WebSocket authentication verified incoming tokens using standard string comparison `===`, susceptible to timing attacks. WebSockets on loopback were also susceptible to Cross-Site WebSocket Hijacking (CSWSH) from malicious browser tabs.
- **Decision**:
  1. Use `crypto.timingSafeEqual` with constant-time buffer comparison.
  2. Reject WebSocket upgrade requests from browser origins (`http://` or `https://`), while allowing CEP extension origins (`file://`, `null`, `adobe-cep://` or missing Origin header typical of local native clients).
  3. Enforce maximum payload size (100MB) on the WebSocket server.
- **Alternatives Considered**:
  - *Bind to Unix domain socket / named pipe*: Not supported natively by CEP browser context on all platforms.
- **Reason**: Defense-in-depth on loopback interfaces.

---

## DEC-005: Zero New Runtime Dependencies for Core Server
- **Date**: 2026-11-26
- **Context**: The server core must remain lightweight, fast, and strictly MIT licensed.
- **Decision**: Avoid adding new external runtime dependencies. Use Node.js built-ins (`crypto`, `fs`, `path`, `os`, `child_process`, `http`, `events`) and existing installed packages (`@modelcontextprotocol/sdk`, `zod`, `ws`, `sharp`).
- **Alternatives Considered**:
  - *Adding `ws-heartbeat` or external queue libraries*: Unnecessary overhead and dependency vulnerability footprint.
- **Reason**: High reliability, minimal installation footprint, and strict license separation.

---

## DEC-006: Protocol Version 2 Handshake & Capabilities Negotiation
- **Date**: 2026-11-26
- **Context**: Older panels and servers had no version negotiation during the WebSocket connection handshake, leading to subtle protocol incompatibilities.
- **Decision**: Introduce explicit `protocolVersion: 2` in the auth handshake along with declared capability arrays (`priorityQueue`, `heartbeat`, `structuredErrors`, `progress`). Mismatched versions are cleanly rejected with an informative upgrade message.
- **Alternatives Considered**:
  - *Implicit protocol inference*: Fragile and prone to silent failures.
- **Reason**: Guarantees forward compatibility and explicit version boundaries between CEP panel and server.

---

## DEC-007: Prioritized Single-Threaded ExtendScript Execution Queue
- **Date**: 2026-11-26
- **Context**: After Effects ExtendScript is single-threaded. Concurrent calls from parallel agent workflows can corrupt AE state or drop responses.
- **Decision**: Route all ExtendScript calls through a centralized single-threaded FIFO queue with three priority tiers: `system` (0), `user` (1), and `batch` (2). Calls only dispatch when the previous call finishes or times out. Callers can abort or cancel enqueued jobs.
- **Alternatives Considered**:
  - *Optimistic concurrent dispatch*: Causes race conditions and ExtendScript crashes.
- **Reason**: Absolute execution safety and predictability in Adobe After Effects.

---

## DEC-008: Zero-Dependency Rotating File Logger
- **Date**: 2026-11-26
- **Context**: MCP servers use standard input/output (`stdio`) for protocol communication. Writing log messages to `stdout` breaks the JSON-RPC wire format.
- **Decision**: Centralize all logging through `BridgeLogger`. Log messages are output to `stderr` and appended to `$AE_BRIDGE_HOME/logs/bridge.log`, rotating up to 3 backups when exceeding 5 MB.
- **Alternatives Considered**:
  - *Winston or Pino*: Adds extra dependencies.
  - *Console.error only*: Lacks persistent diagnostics for troubleshooting after restarts.
- **Reason**: Clean stdio separation, zero external dependencies, and persistent system diagnostics.

---

## DEC-009: Non-Disruptive Doctor Diagnostic Probe Protocol
- **Date**: 2026-11-26
- **Context**: The CLI `doctor` command needs to perform live round-trip testing when a panel is connected without displacing the active session or resetting connection state.
- **Decision**: Support a lightweight `doctor_ping` probe in `bridge.ts` that verifies authentication, checks if an active panel is connected, queries `ae_ping` on the panel, and returns telemetry (`latencyMs`, `aeVersion`) without registering as the active panel.
- **Alternatives Considered**:
  - *Full auth handshake*: Would displace the active CEP panel and force it to reconnect.
- **Reason**: Transparent and safe real-time system diagnostics.

---

## DEC-010: Multi-Client Hub & Proxy Architecture
- **Date**: 2026-11-26
- **Context**: When a user runs multiple concurrent AI sessions (e.g. Claude Desktop alongside Antigravity), previous versions crashed because port 8765 was bound and multiple connections displaced the CEP panel socket.
- **Decision**: Implement a single-instance Hub with atomic lockfile (`$AE_BRIDGE_HOME/hub.lock`). The primary process claims the Hub role and opens an IPC WebSocket server (`127.0.0.1:8766`). Secondary processes detect the active Hub, operate as transparent MCP proxies, and route their tool dispatches through the Hub's prioritized single-threaded execution queue.
- **Alternatives Considered**:
  - *Multiple separate ports for CEP panel*: CEP panel can only connect to one WebSocket endpoint without user intervention.
- **Reason**: Enables seamless multi-agent workflows across multiple editors without socket collisions or race conditions.

---

## DEC-011: Safe Config Mutation with Automatic Backups
- **Date**: 2026-11-26
- **Context**: Overwriting user MCP configurations in Claude Desktop or Antigravity can destroy other configured servers if not performed carefully.
- **Decision**: In `ae-bridge config --write`, parse existing configuration JSON, merge the `ae-bridge` server definition, write a timestamped `.backup` file before writing changes, and support `--global` vs `--workspace` targeting.
- **Alternatives Considered**:
  - *Blind file overwrite*: High risk of data loss for user's existing MCP servers.
- **Reason**: Non-destructive, user-friendly client installation.


