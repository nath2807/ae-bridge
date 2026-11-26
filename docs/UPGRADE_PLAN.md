# AE Bridge v1.3 Upgrade Plan

## 1. Executive Architecture Summary

AE Bridge is a hybrid Model Context Protocol (MCP) server enabling AI agents (such as Antigravity, Claude Code, Cursor, etc.) to control Adobe After Effects (2024+) and orchestrate 3D workflows in Blender (4.2+).

### Core Components
1. **MCP Server (`server/src`)**:
   - Node 20+, TypeScript, native ESM.
   - Transport: Standard I/O (`stdio`) communicating with AI clients.
   - Loopback Bridge: WebSocket server (`ws://127.0.0.1:8765`) providing bidirectional communication with the Adobe CEP panel.
   - Authentication: Shared secret token written to `$AE_BRIDGE_HOME/token` (default: `~/.ae-bridge/token`).
   - Tool Registry: 165 tools across 38 module files registered with `@modelcontextprotocol/sdk`.

2. **CEP Panel (`cep-panel/`)**:
   - Adobe Common Extensibility Platform (CEP 11-13) HTML/JS extension loaded inside After Effects.
   - Bundle ID: `com.aebridge` (Extension ID `com.aebridge.panel`).
   - Uses `CSInterface.js` to bridge browser DOM / Node.js context inside CEP to After Effects' ExtendScript engine.
   - Connects to the local WebSocket server and dispatches tool requests to ExtendScript.

3. **ExtendScript Dispatcher (`cep-panel/jsx/`)**:
   - Evaluated within After Effects' ES3 JavaScript engine.
   - `dispatcher.jsx` loads all modular tool scripts (`jsx/tools/*.jsx`) and polyfills (`json2.jsx`, `es5-shim.jsx`).
   - Wraps mutations in `app.beginUndoGroup()` / `app.endUndoGroup()` (`withUndo`).

4. **Blender Orchestrator (`server/src/blender/` & `blender/`)**:
   - Optional headless Blender bridge executing background python scripts via `blender -b`.
   - Supports 3D text, camera projection sync, PBR materials, geometry nodes, depth passes, and physics baking.
   - Job tracking stored in `$AE_BRIDGE_HOME/blender_jobs.json`.

---

## 2. Wire Protocol

### Transport
- Local loopback WebSocket (`ws://127.0.0.1:8765`).

### Connection Handshake
1. **CEP Panel -> Server**:
   ```json
   {
     "type": "auth",
     "token": "<32-byte-hex-token>"
   }
   ```
2. **Server -> CEP Panel**:
   ```json
   { "type": "auth_ok" }
   ```
   *(or `{ "type": "auth_failed", "error": "Invalid token" }` followed by socket close)*

### RPC Execution Flow
1. **Server -> CEP Panel**:
   ```json
   {
     "id": "<uuid-v4>",
     "method": "<tool_name>",
     "params": { ... }
   }
   ```
2. **CEP Panel**:
   Calls ExtendScript: `aeBridge.dispatch(method, encodeURIComponent(JSON.stringify(params)))`.
3. **CEP Panel -> Server**:
   ```json
   {
     "id": "<uuid-v4>",
     "ok": true,
     "result": { ... }
   }
   ```
   *(or `{ "id": "<uuid-v4>", "ok": false, "error": "<message>" }`)*

---

## 3. Tool Reconciliation

- **Status in v1.0.0**: 139 tools.
- **Added in v1.1.0**: +11 tools (Design Engine, style packs, quality modes, scored review).
- **Added in v1.2.0**: +15 tools (Blender bridge orchestration, depth pass, camera sync).
- **Total verified count in v1.2.0**: **Exactly 165 tools** across 38 files.
- All docs are consistent with 165 tools.

---

## 4. Verification of Reviewer Findings (B1 – B15)

| ID | Finding Lead | Status | Details & Remediation |
|---|---|---|---|
| **B1** | `cli.ts` macOS symlink install throws ENOENT | **CONFIRMED** | `fs.lstatSync(symlinkPath)` does not pass `{ throwIfNoEntry: false }`. Fresh install throws. Fixed with safe lstat and dangling link resolution. |
| **B2** | `downloadFile` leaves 0-byte corrupt files on HTTP error / redirect | **CONFIRMED** | Stream is opened before checking HTTP status; redirects open second stream to same file. Rewrite with `fetch`, temp file, size + SHA-256 verification, and atomic rename. Pin commit SHA in a manifest. |
| **B3** | `doctor` is dishonest and generates token as side effect | **CONFIRMED** | Exit code is always 0. `debugModeSet` evaluated but ignored in message output. Checks only CSXS.11 on macOS. Port check assumes "AE Bridge running" without testing protocol. Fix: honesty, check CSXS 10-13, exit 1 on failure, `--json` flag, read-only token check. |
| **B4** | Pending requests hang when panel disconnects / replaced | **CONFIRMED** | `bridge.ts` tracks pending requests globally without socket affiliation; on disconnect, callers wait for full timeout (up to 2h). Fix: track socket per request, reject immediately on close or replacement. |
| **B5** | `activeClient.removeAllListeners()` strips error handler | **CONFIRMED** | Stripping error listeners causes unhandled `error` events to crash Node process. Fix: clean up specific listeners or leave no-op error handler. |
| **B6** | Install folder name conflict (`com.aebridge` vs `ae-bridge`) | **CONFIRMED** | Manifest specifies bundle ID `com.aebridge`. `install-windows.ps1` used `ae-bridge`. Standardize on `com.aebridge` everywhere and add automatic migration for legacy `ae-bridge`. |
| **B7** | Windows install dangerous recursive rm on junctions | **CONFIRMED** | `fs.rmSync(path, { recursive: true, force: true })` can recurse into repo if junction is traversed. Use `lstat` + `unlinkSync`/`rmdirSync`. Fix admin permission messaging. Use `execFileSync`. |
| **B8** | macOS lacks `killall cfprefsd` and CSXS versions fragmented | **CONFIRMED** | Added `killall cfprefsd` after defaults write. Centralize CSXS versions [10..13] in shared constants. |
| **B9** | `cli.ts` eager import of `index.js` causes crashes | **CONFIRMED** | Importing tools eagerly crashes `doctor`/`install`/`config` if optional dependencies fail to load. Dynamic import inside `start` path only. |
| **B10** | `index.ts` direct-run check fails on paths with spaces | **CONFIRMED** | `import.meta.url.endsWith(...)` fails on URL-encoded characters. Use `fileURLToPath(import.meta.url)` and `fs.realpathSync`. |
| **B11** | No graceful shutdown in `index.ts` | **CONFIRMED** | Missing SIGINT/SIGTERM/stdin close handlers. Implement graceful shutdown, `stopBridge()` export, and blender process termination. |
| **B12** | Hardcoded version "1.2.0" in multiple places | **CONFIRMED** | Read version dynamically from `package.json` as single source of truth. |
| **B13** | Security: token timing attack, origin header, payload limit | **CONFIRMED** | Use `crypto.timingSafeEqual` for auth token, restrict WebSocket origin to CEP extensions, set `maxPayload: 100 * 1024 * 1024` (100MB), secure token file permissions (0600 on POSIX). |
| **B14** | `cli.ts` defaults unknown client to `antigravity` | **CONFIRMED** | `handleConfig` defaults silently to `antigravity`. Throw descriptive error listing supported clients (`antigravity`, `claude`, `cursor`, `vscode`). |
| **B15** | Antigravity config path and documentation updates | **CONFIRMED** | Modern Antigravity uses `~/.gemini/antigravity/mcp_config.json` and project `.antigravity/mcp_config.json`. Ensure full MIT license text in root and expand `.gitignore`. |

---

## 5. Architectural Upgrade Phases

- **Phase 0**: Recon, tool count reconciliation, baseline tests, upgrade plan.
- **Phase 1**: Fix all 15 known defects (B1–B15) + regression tests + `AE_BRIDGE_HOME` support.
- **Phase 2**: Protocol hardening (versioning, ping/pong heartbeats, reconnect with exponential backoff, priority serialization, structured ExtendScript errors, `ae_bridge_status` tool, file logging).
- **Phase 3**: Mock-AE test harness (simulated wire protocol, integration tests over stdio, bpy stubs, CI matrix).
- **Phase 4**: Multi-Client Hub & Proxy (single-instance lockfile, transparent proxying, `config` CLI command enhancements).
- **Phase 5**: Tool surface quality (dynamic tool filtering via profiles `AE_BRIDGE_PROFILE`, `ae_search_tools`, `ae_batch`, image payload returns).
- **Phase 6**: Non-blocking render pipeline (`aerender` background spawns, persistent job state, bitrate-aware template lookup).
- **Phase 7**: Major capability leap (Introspection, Scene Graph export/apply, Data-driven MOGRT batching, Vision metrics via sharp, Audio transcription & kinetic captions, 3D asset import, Blender denoiser & turntable, safety rails & undo).
- **Phase 8**: UXP Future-Proofing (`HostAdapter` interface, CEP implementation, migration guide).
- **Phase 9**: Antigravity-native packaging (`.agents/` packaging, skills, rules, workflows).
- **Phase 10**: Release hygiene, version bump (1.3.0), ZXP packaging script, CHANGELOG, final report.

---

## 6. Risk Assessment & Mitigations

1. **ExtendScript ES3 Constraints**:
   - *Risk*: Modern JS constructs in JSX code trigger silent syntax errors in After Effects.
   - *Mitigation*: ESLint / ES3 checks, strict adherence to `var`, no arrows, no destructuring, using polyfills.
2. **WebSocket Hangs & Race Conditions**:
   - *Risk*: Long-running AE scripts block the ExtendScript thread and fail to process incoming messages.
   - *Mitigation*: Heartbeats, request cancellation, request timeouts, and tracking owning socket.
3. **Environment & Path Collisions**:
   - *Risk*: Tests modifying `~/.ae-bridge/token` corrupting user's live installation.
   - *Mitigation*: Mandatory `AE_BRIDGE_HOME` environment variable override pointing to temporary test directories.
