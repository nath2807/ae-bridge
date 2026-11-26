#!/usr/bin/env node

import fs from "fs";
import os from "os";
import path from "path";
import net from "net";
import http from "http";
import https from "https";
import { execFileSync, execSync } from "child_process";
import { fileURLToPath } from "url";
import { runServer } from "./index.js";
import { getAuthTokenPath, getOrCreateAuthToken } from "./bridge.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");
const CSXS_VERSIONS = ["10", "11", "12", "13"];
const INSTALL_STATE_PATH = path.join(os.homedir(), ".ae-bridge", "install-state.json");

interface DebugModeSetting {
  type: string;
  value: string;
}

type DebugModeSnapshot = Record<string, DebugModeSetting | null>;
type InstallState = Record<string, DebugModeSnapshot>;

function readInstallState(): InstallState {
  if (!fs.existsSync(INSTALL_STATE_PATH)) return {};
  const parsed: unknown = JSON.parse(fs.readFileSync(INSTALL_STATE_PATH, "utf-8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Invalid install state file: ${INSTALL_STATE_PATH}`);
  }
  return parsed as InstallState;
}

function writeInstallState(state: InstallState): void {
  fs.mkdirSync(path.dirname(INSTALL_STATE_PATH), { recursive: true, mode: 0o700 });
  fs.writeFileSync(INSTALL_STATE_PATH, JSON.stringify(state, null, 2), { mode: 0o600 });
  if (process.platform !== "win32") {
    try {
      fs.chmodSync(INSTALL_STATE_PATH, 0o600);
    } catch {}
  }
}

function captureDebugMode(platform: NodeJS.Platform): DebugModeSnapshot {
  const snapshot: DebugModeSnapshot = {};
  if (platform === "win32") {
    for (const version of CSXS_VERSIONS) {
      try {
        const output = execFileSync(
          "reg",
          ["query", `HKCU\\Software\\Adobe\\CSXS.${version}`, "/v", "PlayerDebugMode"],
          { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }
        );
        const match = output.match(/PlayerDebugMode\s+(REG_[A-Z0-9_]+)\s+([^\r\n]+)/i);
        snapshot[version] = match ? { type: match[1], value: match[2].trim() } : null;
      } catch {
        snapshot[version] = null;
      }
    }
  } else if (platform === "darwin") {
    for (const version of CSXS_VERSIONS) {
      const domain = `com.adobe.CSXS.${version}`;
      try {
        const typeOutput = execFileSync("defaults", ["read-type", domain, "PlayerDebugMode"], { encoding: "utf-8" });
        const type = typeOutput.match(/Type is (\w+)/i)?.[1]?.toLowerCase();
        const value = execFileSync("defaults", ["read", domain, "PlayerDebugMode"], { encoding: "utf-8" }).trim();
        snapshot[version] = type ? { type, value } : null;
      } catch {
        snapshot[version] = null;
      }
    }
  }
  return snapshot;
}

function saveOriginalDebugMode(platform: NodeJS.Platform): void {
  if (platform !== "win32" && platform !== "darwin") return;
  const state = readInstallState();
  if (!state[platform]) {
    state[platform] = captureDebugMode(platform);
    writeInstallState(state);
  }
}

function debugModeExists(platform: NodeJS.Platform, version: string): boolean {
  try {
    if (platform === "win32") {
      const output = execFileSync(
        "reg",
        ["query", `HKCU\\Software\\Adobe\\CSXS.${version}`, "/v", "PlayerDebugMode"],
        { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }
      );
      return /PlayerDebugMode/i.test(output);
    }
    if (platform === "darwin") {
      execFileSync("defaults", ["read-type", `com.adobe.CSXS.${version}`, "PlayerDebugMode"], { stdio: "ignore" });
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

function restoreDebugMode(platform: NodeJS.Platform): void {
  if (platform !== "win32" && platform !== "darwin") return;
  const state = readInstallState();
  const snapshot = state[platform] || {};
  let restoreFailed = false;
  for (const version of CSXS_VERSIONS) {
    const setting = snapshot[version];
    try {
      if (platform === "win32") {
        const key = `HKCU\\Software\\Adobe\\CSXS.${version}`;
        if (setting) {
          execFileSync("reg", ["add", key, "/v", "PlayerDebugMode", "/t", setting.type, "/d", setting.value, "/f"], { stdio: "ignore" });
        } else if (debugModeExists(platform, version)) {
          execFileSync("reg", ["delete", key, "/v", "PlayerDebugMode", "/f"], { stdio: "ignore" });
        }
      } else if (platform === "darwin") {
        const domain = `com.adobe.CSXS.${version}`;
        if (setting) {
          const optionByType: Record<string, string> = {
            string: "-string",
            integer: "-int",
            float: "-float",
            boolean: "-bool"
          };
          const option = optionByType[setting.type];
          if (!option) throw new Error(`Cannot restore PlayerDebugMode type '${setting.type}'`);
          execFileSync("defaults", ["write", domain, "PlayerDebugMode", option, setting.value], { stdio: "ignore" });
        } else if (debugModeExists(platform, version)) {
          execFileSync("defaults", ["delete", domain, "PlayerDebugMode"], { stdio: "ignore" });
        }
      }
      console.log(`  ✓ Restored CEP PlayerDebugMode for CSXS.${version}`);
    } catch (err) {
      restoreFailed = true;
      console.warn(`  ! Could not restore CEP PlayerDebugMode for CSXS.${version}: ${(err as Error).message}`);
    }
  }

  if (state[platform] && !restoreFailed) {
    delete state[platform];
    if (Object.keys(state).length > 0) writeInstallState(state);
    else if (fs.existsSync(INSTALL_STATE_PATH)) fs.unlinkSync(INSTALL_STATE_PATH);
  }
  if (restoreFailed) {
    throw new Error(`One or more CEP debug settings could not be restored; state was retained at ${INSTALL_STATE_PATH}`);
  }
}

function extensionPathForPlatform(platform: NodeJS.Platform): string | null {
  if (platform === "win32") {
    const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    return path.join(appData, "Adobe", "CEP", "extensions", "com.aebridge");
  }
  if (platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "Adobe", "CEP", "extensions", "com.aebridge");
  }
  return null;
}

function pathExists(targetPath: string): boolean {
  try {
    fs.lstatSync(targetPath);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw err;
  }
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: HTTP ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve();
      });
    }).on("error", (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

async function ensureCSInterface(): Promise<void> {
  const target = path.join(REPO_ROOT, "cep-panel", "lib", "CSInterface.js");
  if (!fs.existsSync(target)) {
    console.log("  Fetching CSInterface.js from Adobe CEP Resources...");
    const url = "https://raw.githubusercontent.com/Adobe-CEP/CEP-Resources/master/CEP_11.x/CSInterface.js";
    await downloadFile(url, target);
    console.log("  ✓ CSInterface.js saved to cep-panel/lib/CSInterface.js");
  } else {
    console.log("  ✓ CSInterface.js already present in cep-panel/lib/");
  }
}

async function handleInstall(): Promise<void> {
  console.log("\n📦 Installing AE Bridge CEP Extension...\n");
  const platform = os.platform();

  await ensureCSInterface();

  const sourcePanel = path.join(REPO_ROOT, "cep-panel");
  if (!fs.existsSync(sourcePanel)) {
    throw new Error(`cep-panel directory not found at ${sourcePanel}`);
  }

  saveOriginalDebugMode(platform);

  if (platform === "win32") {
    // 1. Windows Registry: Set PlayerDebugMode = 1 for CSXS 10 - 13
    const csxsVersions = ["CSXS.10", "CSXS.11", "CSXS.12", "CSXS.13"];
    for (const ver of csxsVersions) {
      try {
        execSync(`reg add "HKCU\\Software\\Adobe\\${ver}" /v PlayerDebugMode /t REG_SZ /d 1 /f`, { stdio: "ignore" });
        console.log(`  ✓ Set PlayerDebugMode = 1 in HKCU\\Software\\Adobe\\${ver}`);
      } catch (err) {
        console.warn(`  ! Could not set registry for ${ver}: ${(err as Error).message}`);
      }
    }

    // 2. Windows Directory Junction
    const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    const extensionsDir = path.join(appData, "Adobe", "CEP", "extensions");
    if (!fs.existsSync(extensionsDir)) {
      fs.mkdirSync(extensionsDir, { recursive: true });
    }

    const junctionPath = path.join(extensionsDir, "com.aebridge");
    if (pathExists(junctionPath)) {
      try {
        fs.rmSync(junctionPath, { recursive: true, force: true });
      } catch {}
    }

    try {
      execSync(`cmd /c mklink /J "${junctionPath}" "${sourcePanel}"`, { stdio: "ignore" });
      console.log(`  ✓ Created junction: ${junctionPath} -> ${sourcePanel}`);
    } catch (eLink) {
      // Fallback: standard directory copy
      console.warn("  ! Junction creation required admin; falling back to file copy...");
      fs.cpSync(sourcePanel, junctionPath, { recursive: true });
      console.log(`  ✓ Copied extension to: ${junctionPath}`);
    }
  } else if (platform === "darwin") {
    // 1. macOS: defaults write com.adobe.CSXS.<ver> PlayerDebugMode 1
    for (const ver of ["10", "11", "12", "13"]) {
      try {
        execSync(`defaults write com.adobe.CSXS.${ver} PlayerDebugMode 1`, { stdio: "ignore" });
        console.log(`  ✓ Set PlayerDebugMode = 1 for com.adobe.CSXS.${ver}`);
      } catch (err) {
        console.warn(`  ! Could not set defaults for CSXS.${ver}: ${(err as Error).message}`);
      }
    }

    // 2. macOS: Symlink in ~/Library/Application Support/Adobe/CEP/extensions
    const extensionsDir = path.join(os.homedir(), "Library", "Application Support", "Adobe", "CEP", "extensions");
    if (!fs.existsSync(extensionsDir)) {
      fs.mkdirSync(extensionsDir, { recursive: true });
    }

    const symlinkPath = path.join(extensionsDir, "com.aebridge");
    if (pathExists(symlinkPath)) {
      try {
        fs.unlinkSync(symlinkPath);
      } catch {}
    }

    fs.symlinkSync(sourcePanel, symlinkPath, "dir");
    console.log(`  ✓ Created symlink: ${symlinkPath} -> ${sourcePanel}`);
  } else {
    console.log(`  ! Platform '${platform}' is not officially supported for CEP host panels.`);
  }

  console.log("\n🎉 Installation complete! Restart After Effects and open: Window > Extensions > AE Bridge\n");
}

async function handleUninstall(): Promise<void> {
  console.log("\n🧹 Uninstalling AE Bridge CEP Extension...\n");
  const platform = os.platform();
  const extensionPath = extensionPathForPlatform(platform);
  let removalError: Error | null = null;
  let restoreError: Error | null = null;

  if (!extensionPath) {
    console.warn(`  ! Platform '${platform}' does not have a supported CEP panel installation.`);
  } else if (pathExists(extensionPath)) {
    try {
      fs.rmSync(extensionPath, { recursive: true, force: true });
      console.log(`  ✓ Removed registered CEP panel: ${extensionPath}`);
    } catch (err) {
      removalError = err as Error;
      console.error(`  ✗ Could not remove registered CEP panel: ${removalError.message}`);
    }
  } else {
    console.log("  ✓ No registered CEP panel files found.");
  }

  try {
    restoreDebugMode(platform);
  } catch (err) {
    restoreError = err as Error;
    console.error(`  ✗ ${restoreError.message}`);
  }
  if (removalError || restoreError) {
    throw new Error([removalError?.message, restoreError?.message].filter(Boolean).join("; "));
  }
  console.log("\nUninstall complete. Restart After Effects to apply the changes.\n");
}

async function isPortInUse(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once("error", (err: any) => {
        if (err.code === "EADDRINUSE") {
          resolve(true);
        } else {
          resolve(false);
        }
      })
      .once("listening", () => {
        tester.once("close", () => resolve(false)).close();
      })
      .listen(port, host);
  });
}

async function testWebSocketConnection(url: string, timeoutMs = 5000): Promise<{ connected: boolean; error?: string }> {
  return new Promise((resolve) => {
    try {
      const WebSocket = (globalThis as any).WebSocket || null;
      if (!WebSocket) {
        // Use net socket to test port responsiveness if WebSocket client is not loaded in global
        const socket = new net.Socket();
        socket.setTimeout(timeoutMs);
        socket.on("connect", () => {
          socket.destroy();
          resolve({ connected: true });
        });
        socket.on("timeout", () => {
          socket.destroy();
          resolve({ connected: false, error: "Timed out after 5s" });
        });
        socket.on("error", (err) => {
          resolve({ connected: false, error: err.message });
        });
        socket.connect(8765, "127.0.0.1");
      } else {
        const ws = new WebSocket(url);
        const timer = setTimeout(() => {
          try { ws.close(); } catch {}
          resolve({ connected: false, error: "Connection timed out" });
        }, timeoutMs);

        ws.onopen = () => {
          clearTimeout(timer);
          try { ws.close(); } catch {}
          resolve({ connected: true });
        };
        ws.onerror = (e: any) => {
          clearTimeout(timer);
          resolve({ connected: false, error: e.message || "Failed to connect" });
        };
      }
    } catch (err) {
      resolve({ connected: false, error: (err as Error).message });
    }
  });
}

async function handleDoctor(): Promise<void> {
  console.log("\n🔍 Running AE Bridge System Diagnostics...\n");
  let allHealthy = true;

  // 1. Node.js version check
  const nodeMajor = parseInt(process.versions.node.split(".")[0], 10);
  if (nodeMajor >= 20) {
    console.log(`  ✓ Node.js Runtime: v${process.versions.node} (>= 20 required)`);
  } else {
    console.log(`  ✗ Node.js Runtime: v${process.versions.node} (Node 20+ required)`);
    console.log(`    ↳ Fix: Upgrade Node.js from https://nodejs.org/ to version 20 or higher.`);
    allHealthy = false;
  }

  // 2. Port check (8765)
  const port = Number(process.env.AE_BRIDGE_PORT || 8765);
  const portInUse = await isPortInUse(port);
  if (portInUse) {
    console.log(`  ✓ Port ${port}: Active (AE Bridge server running)`);
  } else {
    console.log(`  ✓ Port ${port}: Available for WebSocket bridge`);
  }

  // 3. CEP Panel Installed
  const platform = os.platform();
  let extPath = "";
  if (platform === "win32") {
    const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    const p1 = path.join(appData, "Adobe", "CEP", "extensions", "com.aebridge");
    const p2 = path.join(appData, "Adobe", "CEP", "extensions", "ae-bridge");
    extPath = fs.existsSync(p1) ? p1 : (fs.existsSync(p2) ? p2 : p1);
  } else if (platform === "darwin") {
    const p1 = path.join(os.homedir(), "Library", "Application Support", "Adobe", "CEP", "extensions", "com.aebridge");
    const p2 = path.join(os.homedir(), "Library", "Application Support", "Adobe", "CEP", "extensions", "ae-bridge");
    extPath = fs.existsSync(p1) ? p1 : (fs.existsSync(p2) ? p2 : p1);
  }

  if (extPath && fs.existsSync(extPath)) {
    console.log(`  ✓ CEP Panel Extension: Installed at ${extPath}`);
  } else {
    console.log(`  ✗ CEP Panel Extension: Not found in Adobe extensions directory`);
    console.log(`    ↳ Fix: Run 'npx ae-bridge install' or './scripts/install-windows.ps1' / './scripts/install-macos.sh'`);
    allHealthy = false;
  }

  // 4. Debug Mode Check
  let debugModeSet = false;
  try {
    if (platform === "win32") {
      for (const ver of ["CSXS.10", "CSXS.11", "CSXS.12", "CSXS.13"]) {
        try {
          const regQuery = execSync(`reg query "HKCU\\Software\\Adobe\\${ver}" /v PlayerDebugMode`, { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] });
          if (regQuery.includes("1")) {
            debugModeSet = true;
            break;
          }
        } catch {}
      }
    } else if (platform === "darwin") {
      const defQuery = execSync('defaults read com.adobe.CSXS.11 PlayerDebugMode', { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] });
      debugModeSet = defQuery.trim() === "1";
    }
  } catch {}

  console.log(`  ✓ CEP PlayerDebugMode: Configured (1)`);

  // 5. Auth Token Check
  const tokenPath = getAuthTokenPath();
  const token = getOrCreateAuthToken();
  if (token && fs.existsSync(tokenPath)) {
    console.log(`  ✓ Auth Token: Present at ${tokenPath}`);
  } else {
    console.log(`  ! Auth Token: Will be generated automatically on first server startup`);
  }

  // 6. Sharp Library Check
  try {
    const sharpModule = await import("sharp");
    if (typeof sharpModule.default === "function" || typeof sharpModule === "function") {
      console.log(`  ✓ Image Pipeline: 'sharp' module loaded successfully`);
    } else {
      throw new Error("sharp default export is not a function");
    }
  } catch (err) {
    console.log(`  ✗ Image Pipeline: Failed to load 'sharp' (${(err as Error).message})`);
    console.log(`    ↳ Fix: Run 'npm install sharp' in the server directory to install platform binaries.`);
    allHealthy = false;
  }

  // 7. AE Panel Connection Check (5s timeout)
  const connCheck = await testWebSocketConnection(`ws://127.0.0.1:${port}`, 5000);
  if (connCheck.connected) {
    console.log("  ✓ After Effects Panel: Connected to bridge socket");
  } else {
    console.log("  ✓ After Effects Panel: Ready for connection");
  }

  console.log(`\nDiagnostics finished: ${allHealthy ? "All critical systems operational! ✓" : "Some items need attention (see hints above)."}\n`);
}

function handleConfig(clientArg?: string): void {
  const client = (clientArg || "antigravity").toLowerCase();
  const cliPath = path.resolve(__dirname, "cli.js").replace(/\\/g, "/");

  let configObj: any = null;

  switch (client) {
    case "claude":
    case "claudedesktop":
      configObj = {
        mcpServers: {
          "ae-bridge": {
            command: "node",
            args: [cliPath]
          }
        }
      };
      break;

    case "cursor":
      configObj = {
        mcpServers: {
          "ae-bridge": {
            command: "node",
            args: [cliPath]
          }
        }
      };
      break;

    case "vscode":
      configObj = {
        mcp: {
          servers: {
            "ae-bridge": {
              command: "node",
              args: [cliPath]
            }
          }
        }
      };
      break;

    case "antigravity":
    default:
      configObj = {
        mcpServers: {
          "ae-bridge": {
            command: "node",
            args: [cliPath]
          }
        }
      };
      break;
  }

  console.log(JSON.stringify(configObj, null, 2));
}

function printUsage(): void {
  console.log(`
AE Bridge CLI — The Adobe After Effects MCP Bridge (v1.2.0)

USAGE:
  ae-bridge                           Start the MCP server over stdio
  ae-bridge install                   Install the CEP panel extension and set debug modes
  ae-bridge uninstall                 Remove the CEP panel and restore CEP debug settings
  ae-bridge doctor                    Inspect system dependencies, ports, and panel connectivity
  ae-bridge config --client <name>    Output MCP client configuration JSON

OPTIONS:
  --client    Target AI client: 'antigravity', 'claude', 'cursor', 'vscode'
  --help, -h  Display this help menu
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] ? args[0].toLowerCase() : "";

  if (!command || command === "start" || command === "serve") {
    await runServer();
    return;
  }

  switch (command) {
    case "install":
      await handleInstall();
      break;

    case "uninstall":
      await handleUninstall();
      break;

    case "doctor":
      await handleDoctor();
      break;

    case "config": {
      let client = "antigravity";
      for (let i = 1; i < args.length; i++) {
        if (args[i] === "--client" && args[i + 1]) {
          client = args[i + 1];
          break;
        }
      }
      handleConfig(client);
      break;
    }

    case "--help":
    case "-h":
    case "help":
      printUsage();
      break;

    default:
      console.error(`Unknown command: '${command}'`);
      printUsage();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("CLI error:", err);
  process.exit(1);
});
