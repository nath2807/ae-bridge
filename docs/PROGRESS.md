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
