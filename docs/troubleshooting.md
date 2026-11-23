# Troubleshooting & FAQ

Common issues and solutions for AE Bridge.

---

### 1. Panel Not Visible in After Effects
**Symptom:** "Window > Extensions" does not show "AE Bridge".
- **Fix 1 — Run Installer:** Run `node server/dist/cli.js install` to ensure `PlayerDebugMode = 1` is registered and the folder junction/symlink exists.
- **Fix 2 — Verify Path:** Check that the extension directory exists:
  - Windows: `%APPDATA%\Adobe\CEP\extensions\com.aebridge`
  - macOS: `~/Library/Application Support/Adobe/CEP/extensions/com.aebridge`
- **Fix 3 — Restart After Effects:** CEP scans extension manifests only during application launch.

---

### 2. Status Shows "Disconnected — retrying"
**Symptom:** The panel is visible in AE, but the badge shows "Disconnected".
- **Fix 1 — Check Server:** Ensure the MCP server is actively running (`node server/dist/cli.js` or via your AI client session).
- **Fix 2 — Check Port Collision:** By default, AE Bridge uses port `8765`. Run `node server/dist/cli.js doctor` to verify port availability.
- **Fix 3 — Firewall:** Verify that `127.0.0.1` local loopback connections are not blocked by host security software.

---

### 3. Status Shows "Auth failed"
**Symptom:** Panel reaches the server but immediately disconnects with "Auth failed".
- **Cause:** The authentication token presented by the CEP panel does not match the token expected by the server.
- **Fix:** Both the server and panel share the secret token located at `~/.ae-bridge/token`.
  1. Delete `~/.ae-bridge/token`.
  2. Start the server (which will generate a fresh token).
  3. Close and reopen the AE Bridge panel in After Effects (it will read the new token via Node.js).

---

### 4. "EvalScript error."
**Symptom:** ExtendScript tool calls fail with "EvalScript error."
- **Cause:** ExtendScript syntax exception or unhandled error inside After Effects.
- **Fix:** Run `ae_reload_tools` to re-evaluate the JSX handlers. Check panel logs for specific line numbers.

---

### 5. Timeouts During Long Operations
**Symptom:** Tool call fails with "Call 'xxx' timed out after 60s waiting for After Effects response".
- **Cause:** Long operations (such as rendering video or complex 3D scenes) block the After Effects thread.
- **Fix:** Pass an extended `timeoutMs` to `callAE(method, params, timeoutMs)`. Storyboard builds support up to 600,000 ms (10 minutes) and in-AE renders support up to 7,200,000 ms (2 hours). Prefer `mode: "ame"` for non-blocking rendering.

---

### 6. Sharp Image Library Fails to Load
**Symptom:** "sharp is not available; contact sheet grid could not be composited."
- **Fix:** Run `npm --prefix server install sharp` to ensure native C++ image processing binaries are compiled for your operating system and CPU architecture.

---

### 7. MCP Schema Errors ("z.tuple is not supported")
**Symptom:** AI client reports tool schema validation error on startup.
- **Fix:** The Model Context Protocol specification requires dynamic arrays (`z.array()`) rather than fixed-length tuples (`z.tuple()`). AE Bridge exclusively uses `z.array()` across all 139 tool definitions.
