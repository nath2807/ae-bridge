# AE Bridge v1.3 Upgrade Progress Log

## Phase 0 - Reconnaissance & Baseline
- **Timestamp**: 2026-11-26T19:47:00+05:30
- **Summary**:
  - Switched to dedicated branch `upgrade/v1.3-ultimate`.
  - Ran baseline builds and vitest suite: 11 test files, 51 tests passed.
  - Verified exact tool count: 165 tools across 38 category files (reconciled v1.0.0 139 + v1.1.0 11 + v1.2.0 15 = 165).
  - Investigated and confirmed all 15 review leads (B1–B15).
  - Authored `docs/UPGRADE_PLAN.md` with wire protocol analysis and risk registry.
  - Authored `docs/DECISIONS.md` logging DEC-001 through DEC-005.
- **Test Results**: All 51 baseline tests green.
- **Blockers**: None.

---

## Phase 1 - Fix Known Defects (B1–B15)
- **Timestamp**: 2026-11-26T19:58:00+05:30
- **Summary**:
  - Implemented `AE_BRIDGE_HOME` support for full environment isolation across token, state, jobs, renders, and logs.
  - B1: Safe symlink creation and dangling link handling with `lstatSync({ throwIfNoEntry: false })`.
  - B2: Replaced streaming downloads with atomic temp-file download, cryptographic SHA-256 verification, and pinned Adobe CEP commit in `server/deps/manifest.json`.
  - B3: Completely rewrote `doctor` with honest diagnostic checks across all CSXS versions 10–13, no token side-effect creation, non-zero failure exit code, and `--json` support.
  - B4 & B5: Sockets tracked per pending request; immediate rejection on panel disconnect, replacement, or socket error; listener safety.
  - B6: Standardized on canonical `com.aebridge` extension directory with automated migration of legacy `ae-bridge` directories.
  - B7: Fixed Windows junction creation/removal safety (`execFileSync`, safe unlink/rmdir without recursive rmSync).
  - B8: macOS install flushes preferences daemon (`killall cfprefsd`) and loops over shared `CSXS_VERSIONS`.
  - B9: Dynamic import of `index.js` in CLI so commands don't crash if tools fail to load.
  - B10: Fixed entrypoint direct-run path comparison for directories containing spaces.
  - B11: Added graceful shutdown handlers for `SIGINT`, `SIGTERM`, `stdin close`, exporting `stopBridge()` and `killAllBlenderJobs()`.
  - B12: Read dynamic version from `package.json` through `VERSION` constant.
  - B13: Hardened loopback bridge with `crypto.timingSafeEqual`, 100MB payload cap, and rejection of browser origins (`http(s)://`).
  - B14: `ae-bridge config` now validates client name and errors cleanly on unknown clients.
  - B15: Authored dedicated client integration guides (`docs/antigravity.md`, `docs/claude-desktop.md`, `docs/cursor.md`, `docs/prompts.md`) and expanded `.gitignore`.
- **Test Results**: 12 test files, 56 vitest tests passing (including new `test/phase1-defects.test.ts`).
- **Blockers**: None.

---

## Phase 2 - Protocol & Reliability
- **Timestamp**: 2026-11-26T20:06:00+05:30
- **Summary**:
  - Upgraded handshake to Protocol v2 with capability negotiation (`priorityQueue`, `heartbeat`, `structuredErrors`, `progress`).
  - Implemented bidirectional heartbeat ping/pong (5s interval, 10s timeout, round-trip latency tracking).
  - Implemented exponential backoff with +/- 20% random jitter on CEP panel auto-reconnection (500ms to 5s max).
  - Built single-threaded FIFO request queue with 3 priority tiers (`system` > `user` > `batch`) and caller cancellation support.
  - Implemented structured ExtendScript `BridgeError` capturing error name, line, file, and callstack.
  - Added new MCP tool `ae_bridge_status` returning connection state, latency, AE version, queue depth, panel version, memory, and uptime.
  - Added non-disruptive `doctor_ping` probe in `doctor` CLI for real-time live round-trip latency checks.
  - Implemented zero-stdout rotating file logger writing to `$AE_BRIDGE_HOME/logs/bridge.log` (5 MB max, 3 backups).
  - Logged decisions DEC-006 through DEC-009 in `docs/DECISIONS.md`.
- **Test Results**: 13 test files, 63 vitest tests passing (including new `test/phase2-reliability.test.ts`).
- **Blockers**: None.

---

## Phase 3 - Mock-AE Test Harness & CI
- **Timestamp**: 2026-11-26T20:13:00+05:30
- **Summary**:
  - Built `MockAEPanel` harness (`server/test/harness/mock-panel.ts`) simulating the ExtendScript runtime, composition state, render queue, controllable latency, and error overrides.
  - Implemented end-to-end integration test suite (`server/test/mock-integration.test.ts`) covering tool discovery, `ae_ping`, `ae_get_project_info`, `ae_create_comp`, `ae_bridge_status`, and structured error propagation.
  - Added full tool surface assertion test verifying name, description length, and input schema validity across all registered tools.
  - Built headless Python test suite (`blender/test/test_bpy_stub.py`) with a `bpy` stub testing compatibility layers, engine detection, and socket fallbacks without a Blender binary.
  - Added `"test:python"` script in `server/package.json`.
  - Upgraded GitHub Actions matrix in `.github/workflows/ci.yml` across Ubuntu, macOS, and Windows with Node 20 and 22, including Python tests.
- **Test Results**: 14 vitest files (69 tests) + 6 Python tests passing.
- **Blockers**: None.

---
