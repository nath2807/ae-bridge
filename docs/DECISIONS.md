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
