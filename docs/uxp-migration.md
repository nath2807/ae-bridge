# UXP Migration Guide: Future-Proofing AE Bridge

Adobe has signaled the gradual transition of Adobe Creative Cloud applications from **CEP (Common Extensibility Platform)** to **UXP (Unified Extensibility Platform)**. While CEP remains the battle-tested, production-ready foundation in After Effects 2024–2026, `ae-bridge` v1.3.0 introduces an architectural abstraction layer (`HostAdapter`) ensuring immediate zero-downtime transition when UXP reaches full parity in After Effects.

---

## 1. Architectural Differences: CEP vs UXP

| Dimension | CEP (Legacy / Current) | UXP (Modern Architecture) |
| :--- | :--- | :--- |
| **JavaScript Engine** | Dual Engine: Chromium (Panel UI) + ExtendScript (ES3, 1999) | Single Engine: Google V8 Modern ECMAScript (ES2022+) |
| **Process Model** | Out-of-process CEP HTML panel talking to AE via C++ CSInterface IPC | In-process native C++ / V8 hybrid running directly inside AE process space |
| **Bridge Wire Protocol** | Loopback WebSocket (`127.0.0.1:8765`) + JSON-RPC messages | Direct WebSocket / IPC with strict origin and domain sandboxing |
| **Undo / Transactions** | `app.beginUndoGroup()` / `app.endUndoGroup()` in ExtendScript | `executeAsModal(callback, { title })` transaction management |
| **DOM Access** | String evaluation via `evalScript("ae_dispatch(...)")` | Direct native object model and API invocations |
| **Manifest Format** | XML (`CSXS/manifest.xml`) | Modern JSON (`manifest.json` v5) |

---

## 2. ExtendScript ES3 vs Modern V8 JavaScript

One of the largest hurdles in CEP is ExtendScript's 1999 ES3 specification.

### ES3 Constraints in CEP
- No `const` or `let` (only function-scoped `var`).
- No Arrow Functions (`() => {}`).
- No Template Literals (`` `text ${var}` ``).
- No native `JSON` without polyfills.
- No `Array.prototype.map`, `forEach`, `filter`, `reduce` without custom polyfills.
- Synchronous blocking execution: if ExtendScript executes a heavy calculation, the After Effects UI hangs.

### Modern V8 Capabilities in UXP
- Full ECMAScript 2022+ support (`async` / `await`, Promises, classes, destructuring, optional chaining `?.`, nullish coalescing `??`).
- Native TypedArrays (`Uint8Array`, `Float32Array`) and ArrayBuffers for high-performance pixel and audio data interchange.
- Standard Web APIs (`fetch`, `WebSocket`, `FormData`, `crypto.getRandomValues`).
- Microtasks and non-blocking asynchronous event loops.

---

## 3. Transaction Safety: `executeAsModal` vs `withUndo`

In CEP, `ae-bridge` wraps script execution in a helper:
```javascript
// CEP ExtendScript
function withUndo(name, fn) {
  app.beginUndoGroup(name);
  try {
    return fn();
  } finally {
    app.endUndoGroup();
  }
}
```

In UXP, After Effects mandates that any operation altering the project hierarchy, layers, properties, or keyframes **MUST** execute within an `executeAsModal` block:
```typescript
// UXP Modern TypeScript
import { executeAsModal } from "aftereffects";

await executeAsModal(
  async (context) => {
    // Perform transactional mutations on After Effects DOM
    const comp = app.project.activeItem;
    const textLayer = comp.layers.addText("AE Bridge UXP");
  },
  { title: "AE Bridge: Create Text Layer" }
);
```

### Key Differences in `executeAsModal`
1. **Single-Transaction Locking:** Only one modal transaction can run at a time across any plugin. Nested modal calls throw an error unless explicitly permitted via execution context.
2. **User Interaction Suspension:** The After Effects GUI is temporarily protected from user clicks during the transaction, preventing race conditions.
3. **Atomic Rollback:** If an unhandled exception occurs inside `executeAsModal`, After Effects automatically aborts the transaction and reverts the document state cleanly.

---

## 4. Manifest Comparison: `manifest.xml` vs `manifest.json`

### CEP (`cep-panel/CSXS/manifest.xml`)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<ExtensionManifest ExtensionBundleId="com.aebridge" ExtensionBundleVersion="1.3.0" Version="10.0">
  <ExtensionList>
    <Extension Id="com.aebridge.panel" Version="1.3.0" />
  </ExtensionList>
  <HostList>
    <Host Name="AFTNUM" Version="18.0" />
  </HostList>
  <DispatchInfoList>
    <Extension Id="com.aebridge.panel">
      <UI>
        <Type>Custom</Type>
        <Menu>AE Bridge</Menu>
        <Geometry><Size><Height>400</Height><Width>300</Width></Size></Geometry>
      </UI>
    </Extension>
  </DispatchInfoList>
</ExtensionManifest>
```

### UXP (`manifest.json`)
```json
{
  "id": "com.aebridge.uxp",
  "name": "AE Bridge",
  "version": "1.3.0",
  "main": "index.js",
  "manifestVersion": 5,
  "host": [
    {
      "app": "AE",
      "minVersion": "25.0.0"
    }
  ],
  "entrypoints": [
    {
      "type": "panel",
      "id": "aeBridgePanel",
      "label": "AE Bridge"
    }
  ],
  "requiredPermissions": {
    "network": {
      "domains": [
        "ws://127.0.0.1:8765",
        "http://127.0.0.1:8766"
      ]
    },
    "localFileSystem": "fullAccess",
    "clipboard": "readAndWrite"
  }
}
```

---

## 5. Security & Network Domain Sandboxing

In UXP, all outbound network socket connections (`fetch`, `WebSocket`) are sandboxed and must be explicitly whitelisted in `requiredPermissions.network.domains`.
- Connecting to `ws://127.0.0.1:8765` without the domain permission entry results in a security violation.
- `ae-bridge`'s `UxpHostAdapter` checks `hasNetworkPermission(url)` before initiating connections to prevent runtime security rejections.

---

## 6. The `HostAdapter` Abstraction Layer

In `ae-bridge` v1.3.0, callers and tool handlers can interact with After Effects through the polymorphic `HostAdapter` interface:

```typescript
import { HostAdapter, CepHostAdapter, UxpHostAdapter } from "./adapter/index.js";

// Instantiate appropriate adapter based on environment configuration
const adapter: HostAdapter = process.env.AE_BRIDGE_HOST === "uxp"
  ? new UxpHostAdapter()
  : new CepHostAdapter();

await adapter.connect();

// Polymorphic call execution
const comp = await adapter.call("ae_create_comp", {
  compName: "Main",
  width: 1920,
  height: 1080
});

const status = adapter.getStatus();
console.log(`Connected to ${status.hostName} via ${status.engineType}`);
```

---

## 7. Migration Roadmap for Developers

When Adobe officially announces CEP deprecation for After Effects:
1. **Step 1: Manifest Addition:** Add `manifest.json` alongside the existing `CSXS/manifest.xml`.
2. **Step 2: Dispatcher Transpilation:** Convert `cep-panel/jsx/` scripts to standard ES modules using Babel/TypeScript with zero polyfills required.
3. **Step 3: Replace `withUndo` with `executeAsModal`:** Wrap all mutating operations in `executeAsModal`.
4. **Step 4: Switch Adapter Flag:** Toggle `AE_BRIDGE_HOST=uxp` in production deployment.
5. **Step 5: Deprecate CSXS Folder:** Remove `CSXS/` once AE drops CEP support entirely.
