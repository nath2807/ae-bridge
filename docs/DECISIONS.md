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

---

## DEC-012: Dynamic Tool Profiles and Meta-Tool Pass-Through
- **Date**: 2026-11-26
- **Context**: Exposing 169 tools simultaneously consumes substantial LLM context tokens (often 25k+ tokens just for system tool schemas). Many workflows only require a subset.
- **Decision**: Implement dynamic tool filtering via `AE_BRIDGE_PROFILE` (with four tiers: `minimal` ~24 tools, `standard` ~85 tools as default, `blender` ~38 tools, and `full` all 169+ tools). All profiles retain pass-through access to meta-tools (`ae_search_tools`, `ae_list_profiles`, `ae_bridge_status`, `ae_batch`), and `ae_search_tools` searches the complete catalog regardless of the active profile.
- **Alternatives Considered**:
  - *Static build-time profiles*: Separate binaries or packages for each profile. Unwieldy and inflexible.
  - *Always exposing all 169 tools*: Excess token overhead for lightweight tasks.
- **Reason**: Balances low token usage for standard tasks with instant discovery and full power when needed.

---

## DEC-013: Atomic Multi-Call Batch Execution (`ae_batch`)
- **Date**: 2026-11-26
- **Context**: Multi-step operations (e.g. creating comp, adding solid, adding 3 text layers, applying camera and keyframes) require dozens of round-trips over loopback WebSocket, each creating its own undo entry in After Effects.
- **Decision**: Provide `ae_batch` accepting an array of tool calls. ExtendScript executes each call sequentially within a single `app.beginUndoGroup("AE Bridge Batch")`, returning an array of individual execution results.
- **Alternatives Considered**:
  - *Client-side sequential iteration*: High network latency and multiple undo steps cluttering AE timeline.
- **Reason**: Dramatic latency reduction and clean single-step undo history for AI agents.

---

## DEC-014: MCP Image Payload in Quality Assurance (`ae_qa_check`)
- **Date**: 2026-11-26
- **Context**: Automated QA checks report metrics textually, but multimodal AI models benefit significantly from directly seeing the composition layout, spacing, and visual contrast.
- **Decision**: Add optional `includePreview?: boolean` to `ae_qa_check`. When true, After Effects renders a preview frame or contact sheet, and the MCP server returns an MCP image payload (`type: "image"`, base64 PNG) alongside the structured textual QA report. If preview capture fails, it falls back gracefully with a warning without failing the QA report.
- **Alternatives Considered**:
  - *Require separate call to `ae_preview_frame`*: Requires two round-trips and extra prompt orchestration.
- **Reason**: Unified visual and textual quality assurance in a single tool call.

---

## DEC-015: Headless aerender Background Job Engine
- **Date**: 2026-11-26
- **Context**: In-app After Effects renders (`mode: "ae"`) block the UI and ExtendScript engine for up to 2 hours, preventing further interaction. While Adobe Media Encoder (`mode: "ame"`) queues externally, it lacks programmatic CLI progress reporting.
- **Decision**: Add `mode: "aerender"` and dedicated render job management tools (`ae_render_job_start`, `ae_render_job_status`, `ae_render_job_cancel`, `ae_render_job_list`) spawning background `aerender` processes. Frame progress is parsed in real time and persisted to `$AE_BRIDGE_HOME/render_jobs.json`.
- **Alternatives Considered**:
  - *Rely solely on in-app rendering*: Locks ExtendScript thread and blocks concurrent commands.
- **Reason**: Enables non-blocking, headless, high-throughput renders with frame-by-frame observability.

---

## DEC-016: Cross-Platform aerender Process Spawning Safety
- **Date**: 2026-11-26
- **Context**: Node.js 20+ introduced strict security validations on Windows preventing execution of `.bat`/`.cmd` files with `shell: false` (CVE-2024-27980). Setting `shell: true` with arguments emits deprecation warning `DEP0190`.
- **Decision**: On Windows, when executing batch runners or wrappers, explicitly route execution through `process.env.ComSpec || "cmd.exe"` with `["/d", "/s", "/c", ...]` while keeping `shell: false`. For standard `.exe` binaries, invoke directly without `cmd.exe`.
- **Alternatives Considered**:
  - *Globally setting `shell: true`*: Insecure argument concatenation and Node.js deprecation warnings.
- **Reason**: Secure, warning-free process execution across Windows, macOS, and Linux.

---

## DEC-017: JSON Scene Graph Interchange Format
- **Date**: 2026-11-26
- **Context**: Passing low-level ExtendScript scripts or dozens of individual layer mutation commands to rebuild comps creates fragility and high latency.
- **Decision**: Implement a canonical JSON Scene Graph schema (`ae_export_scene_graph`, `ae_apply_scene_graph`) capturing composition dimensions, layer hierarchy, transforms, text properties, solid colors, effects, and parenting.
- **Alternatives Considered**:
  - *Exporting raw JSX scripts*: Risky, version-dependent, and prone to eval errors.
- **Reason**: Declarative, verifiable, and portable composition interchange for AI agents.

---

## DEC-018: Optical Computer Vision Analysis via Sharp
- **Date**: 2026-11-26
- **Context**: Aesthetic feedback currently requires human review. AI models need quantitative vision metrics to judge render quality, contrast, and focus.
- **Decision**: Implement `ae_measure_frame` and `ae_measure_comp` using `sharp` to extract mean luminance ($Y = 0.299R + 0.587G + 0.114B$), RMS contrast, Laplacian variance blur detection, clipping (black/white percentage), and temporal luminance stability across sample points.
- **Alternatives Considered**:
  - *Pixel manipulation in ExtendScript*: Extremely slow inside After Effects' ES3 runtime.
- **Reason**: High-speed, C++-backed image processing in Node.js without blocking After Effects.

---

## DEC-019: Kinetic Typography and Zero-Dependency Transcription Fallback
- **Date**: 2026-11-26
- **Context**: Kinetic captions are one of the most requested short-form video features. External speech-to-text tools like Whisper may not be installed on every user machine.
- **Decision**: Implement `ae_transcribe_audio` with feature detection for Whisper CLI, alongside zero-dependency parsing for raw SRT, VTT, and JSON timestamps. Provide `ae_kinetic_captions` generating word-pop, bounce, and typewriter kinetic typography in After Effects.
- **Alternatives Considered**:
  - *Hard dependency on Whisper*: Fails on systems without Python or Whisper installed.
- **Reason**: Graceful degradation supporting automated transcription when available and direct subtitle input everywhere.

---

## DEC-020: Blender Engine Enhancements (Denoiser, Turntable, and Spec Validation)
- **Date**: 2026-11-26
- **Context**: 3D product visualization requires automated 360-degree turntable orbits, denoising configuration, and fast schema validation before starting long renders.
- **Decision**: Add `denoiser` option to `sceneSpecSchema`, procedural `turntable` camera trajectory generator, and `blender_validate_spec` tool for instant pre-flight validation.
- **Alternatives Considered**:
  - *Manual keyframe generation for turntables*: Complex and error-prone in client prompts.
- **Reason**: Simplifies 3D product showcase workflows to a single declarative parameter.





