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

---

### 8. Creating Custom H.264 Render Templates ("AE Bridge H264 High")
<a id="custom-h264-render-templates"></a>

**Symptom:** `ae_render` warns: `Render template '...' is under 20 Mbps. For optimal broadcast quality, please create the 'AE Bridge H264 High' output module template.`

- **Why this happens:** When `ae_render` renders with preset `mp4High`, it looks first for a dedicated high-bitrate template named `AE Bridge H264 High`. If that template does not exist, it falls back to scanning available output module templates for H.264 presets and selects the one with the highest bitrate. If the highest available bitrate is under 20 Mbps (e.g. 5 Mbps or 15 Mbps), AE Bridge issues this advisory warning so you can ensure optimal broadcast master quality.

- **Step-by-step template creation:**
  1. In After Effects, open **Edit > Templates > Output Module...** (on macOS: **After Effects > Settings / Preferences > Output Module Templates...**).
  2. In the **Output Module Templates** dialog, enter the **Settings Name**:
     - High quality master: `AE Bridge H264 High`
     - Web / draft quality: `AE Bridge H264 Web`
  3. Click **Edit...** to open the Output Module Settings:
     - **Format**: Select `H.264` (or `MP4` depending on your AE version/OS).
     - **Format Options**:
       - For `AE Bridge H264 High`: Set Bitrate Encoding to **VBR, 1 Pass** or **CBR**, with Target Bitrate: **35-40 Mbps** (and Profile: **High**, Level: **5.1**).
       - For `AE Bridge H264 Web`: Set Target Bitrate to **5-10 Mbps**.
     - **Audio Output**: Check audio output (Format: 48.000 kHz, 16-bit Stereo).
  4. Click **OK** in the Format Options dialog.
  5. Click **OK** in the Output Module Settings dialog to save the template.
  6. Click **OK** to close the Output Module Templates manager.
  7. Run `ae_reload_tools` (or call `ae_list_output_templates`) to verify that `AE Bridge H264 High` is recognized. Subsequent `ae_render` calls with `preset: "mp4High"` will automatically prioritize and bind to this template.
