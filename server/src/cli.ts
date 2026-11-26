#!/usr/bin/env node

import fs from "fs";
import os from "os";
import path from "path";
import net from "net";
import http from "http";
import https from "https";
import crypto from "crypto";
import { execSync, execFileSync } from "child_process";
import { fileURLToPath } from "url";
import { getAuthTokenPath } from "./bridge.js";
import { CSXS_VERSIONS, CANONICAL_EXTENSION_NAME, VERSION } from "./utils/paths.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");

interface DepInfo {
  version: string;
  repository: string;
  commit: string;
  url: string;
  sha256: string;
  size: number;
}

function getDepsManifest(): Record<string, DepInfo> {
  const candidates = [
    path.resolve(__dirname, "../deps/manifest.json"),
    path.resolve(__dirname, "../../server/deps/manifest.json"),
    path.resolve(REPO_ROOT, "server/deps/manifest.json")
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      try {
        const raw = JSON.parse(fs.readFileSync(c, "utf-8"));
        return raw.dependencies || {};
      } catch {}
    }
  }
  return {};
}

function computeFileSha256(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath);
    return crypto.createHash("sha256").update(content).digest("hex");
  } catch {
    return null;
  }
}

async function downloadFileWithVerification(
  url: string,
  destPath: string,
  expectedSha256: string,
  redirectCount = 0
): Promise<void> {
  if (redirectCount > 5) {
    throw new Error(`Too many redirects while downloading ${url}`);
  }

  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tempPath = `${destPath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === "http:" ? http : https;

    client.get(url, (response) => {
      // Handle redirects
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        response.resume(); // consume response data to free memory
        const nextUrl = new URL(response.headers.location, url).toString();
        downloadFileWithVerification(nextUrl, destPath, expectedSha256, redirectCount + 1)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Failed to download ${url}: HTTP ${response.statusCode}`));
        return;
      }

      const fileStream = fs.createWriteStream(tempPath);
      const hash = crypto.createHash("sha256");

      response.on("data", (chunk) => {
        hash.update(chunk);
      });

      response.pipe(fileStream);

      fileStream.on("finish", () => {
        fileStream.close(() => {
          const actualSha256 = hash.digest("hex");
          if (expectedSha256 && actualSha256.toLowerCase() !== expectedSha256.toLowerCase()) {
            try { fs.unlinkSync(tempPath); } catch {}
            reject(
              new Error(
                `Integrity check failed for ${path.basename(destPath)}!\n` +
                `Expected SHA-256: ${expectedSha256}\n` +
                `Actual SHA-256:   ${actualSha256}`
              )
            );
            return;
          }

          // Atomic rename to final destination
          try {
            fs.renameSync(tempPath, destPath);
            resolve();
          } catch (renameErr) {
            try { fs.unlinkSync(tempPath); } catch {}
            reject(renameErr);
          }
        });
      });

      fileStream.on("error", (err) => {
        try { fs.unlinkSync(tempPath); } catch {}
        reject(err);
      });
    }).on("error", (err) => {
      try { fs.unlinkSync(tempPath); } catch {}
      reject(err);
    });
  });
}

async function ensureCSInterface(): Promise<void> {
  const target = path.join(REPO_ROOT, "cep-panel", "lib", "CSInterface.js");
  const manifest = getDepsManifest();
  const csDep = manifest["CSInterface.js"];
  const expectedHash = csDep ? csDep.sha256 : "d940cbc991553b4885d1b3b04d99c17f448041a738a12cc0b24ce688ace2d263";
  const downloadUrl = csDep ? csDep.url : "https://raw.githubusercontent.com/Adobe-CEP/CEP-Resources/ab5e4e3e53a42fad08e1225a22a991bb1ffe73f6/CEP_11.x/CSInterface.js";

  if (fs.existsSync(target)) {
    const stat = fs.statSync(target);
    if (stat.size > 0) {
      const currentHash = computeFileSha256(target);
      if (currentHash && currentHash.toLowerCase() === expectedHash.toLowerCase()) {
        console.log("  ✓ CSInterface.js verified present and intact in cep-panel/lib/");
        return;
      }
      console.warn("  ! Existing CSInterface.js hash mismatch or corruption; re-fetching...");
    }
  }

  console.log("  Fetching verified CSInterface.js from pinned Adobe CEP Resources...");
  await downloadFileWithVerification(downloadUrl, target, expectedHash);
  console.log("  ✓ CSInterface.js saved and verified at cep-panel/lib/CSInterface.js");
}

function removeJunctionOrLinkSafe(targetPath: string): void {
  const stat = fs.lstatSync(targetPath, { throwIfNoEntry: false });
  if (!stat) return;

  if (stat.isSymbolicLink()) {
    fs.unlinkSync(targetPath);
  } else if (stat.isDirectory()) {
    // On Windows, a directory junction can report as a directory in some node versions
    try {
      fs.unlinkSync(targetPath);
    } catch {
      try {
        fs.rmdirSync(targetPath);
      } catch {
        fs.rmSync(targetPath, { recursive: true, force: true });
      }
    }
  } else {
    fs.unlinkSync(targetPath);
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

  if (platform === "win32") {
    // 1. Windows Registry: Set PlayerDebugMode = 1 for CSXS 10 - 13
    for (const ver of CSXS_VERSIONS) {
      const key = `HKCU\\Software\\Adobe\\CSXS.${ver}`;
      try {
        execFileSync("reg.exe", ["add", key, "/v", "PlayerDebugMode", "/t", "REG_SZ", "/d", "1", "/f"], { stdio: "ignore" });
        console.log(`  ✓ Set PlayerDebugMode = 1 in ${key}`);
      } catch (err) {
        console.warn(`  ! Could not set registry for CSXS.${ver}: ${(err as Error).message}`);
      }
    }

    // 2. Windows Directory Junction
    const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    const extensionsDir = path.join(appData, "Adobe", "CEP", "extensions");
    if (!fs.existsSync(extensionsDir)) {
      fs.mkdirSync(extensionsDir, { recursive: true });
    }

    // 2a. Migration: Clean up legacy 'ae-bridge' directory/junction if present
    const legacyPath = path.join(extensionsDir, "ae-bridge");
    if (fs.lstatSync(legacyPath, { throwIfNoEntry: false })) {
      try {
        removeJunctionOrLinkSafe(legacyPath);
        console.log(`  ✓ Cleaned up legacy extension folder at: ${legacyPath}`);
      } catch (err) {
        console.warn(`  ! Could not clean legacy extension folder: ${(err as Error).message}`);
      }
    }

    // 2b. Canonical 'com.aebridge' junction
    const junctionPath = path.join(extensionsDir, CANONICAL_EXTENSION_NAME);
    removeJunctionOrLinkSafe(junctionPath);

    try {
      execFileSync("cmd.exe", ["/c", "mklink", "/J", junctionPath, sourcePanel], { stdio: "pipe" });
      console.log(`  ✓ Created junction: ${junctionPath} -> ${sourcePanel}`);
    } catch (eLink: any) {
      const errMsg = eLink.stderr ? eLink.stderr.toString().trim() : (eLink.message || String(eLink));
      console.warn(`  ! Junction creation failed (${errMsg}); falling back to copy...`);
      console.warn(`  ⚠️ Warning: Copied extension files instead of creating a junction. File edits in repo will NOT automatically reflect in After Effects.`);
      fs.cpSync(sourcePanel, junctionPath, { recursive: true });
      console.log(`  ✓ Copied extension to: ${junctionPath}`);
    }
  } else if (platform === "darwin") {
    // 1. macOS: defaults write com.adobe.CSXS.<ver> PlayerDebugMode 1
    for (const ver of CSXS_VERSIONS) {
      try {
        execFileSync("defaults", ["write", `com.adobe.CSXS.${ver}`, "PlayerDebugMode", "1"], { stdio: "ignore" });
        console.log(`  ✓ Set PlayerDebugMode = 1 for com.adobe.CSXS.${ver}`);
      } catch (err) {
        console.warn(`  ! Could not set defaults for CSXS.${ver}: ${(err as Error).message}`);
      }
    }

    // Flush cfprefsd preferences daemon
    try {
      execFileSync("killall", ["cfprefsd"], { stdio: "ignore" });
    } catch {}

    // 2. macOS: Symlink in ~/Library/Application Support/Adobe/CEP/extensions
    const extensionsDir = path.join(os.homedir(), "Library", "Application Support", "Adobe", "CEP", "extensions");
    if (!fs.existsSync(extensionsDir)) {
      fs.mkdirSync(extensionsDir, { recursive: true });
    }

    // Migration: Clean legacy folder
    const legacyPath = path.join(extensionsDir, "ae-bridge");
    if (fs.lstatSync(legacyPath, { throwIfNoEntry: false })) {
      try {
        removeJunctionOrLinkSafe(legacyPath);
        console.log(`  ✓ Cleaned up legacy extension folder at: ${legacyPath}`);
      } catch (err) {
        console.warn(`  ! Could not clean legacy extension folder: ${(err as Error).message}`);
      }
    }

    const symlinkPath = path.join(extensionsDir, CANONICAL_EXTENSION_NAME);
    const linkStat = fs.lstatSync(symlinkPath, { throwIfNoEntry: false });
    if (linkStat) {
      removeJunctionOrLinkSafe(symlinkPath);
    }

    fs.symlinkSync(sourcePanel, symlinkPath, "dir");
    console.log(`  ✓ Created symlink: ${symlinkPath} -> ${sourcePanel}`);
  } else {
    console.log(`  ! Platform '${platform}' is not officially supported for CEP host panels.`);
  }

  console.log("\n🎉 Installation complete! Restart After Effects and open: Window > Extensions > AE Bridge\n");
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

export interface DoctorCheck {
  id: string;
  name: string;
  status: "pass" | "warn" | "fail";
  message: string;
  hint?: string;
}

export interface DoctorReport {
  ok: boolean;
  version: string;
  timestamp: string;
  checks: DoctorCheck[];
}

export async function runDiagnostics(): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [];
  const platform = os.platform();

  // 1. Node.js Version
  const nodeMajor = parseInt(process.versions.node.split(".")[0], 10);
  if (nodeMajor >= 20) {
    checks.push({
      id: "node_version",
      name: "Node.js Runtime",
      status: "pass",
      message: `v${process.versions.node} (>= 20 required)`
    });
  } else {
    checks.push({
      id: "node_version",
      name: "Node.js Runtime",
      status: "fail",
      message: `v${process.versions.node} (Node 20+ required)`,
      hint: "Upgrade Node.js from https://nodejs.org/ to version 20 or higher."
    });
  }

  // 2. Port Check
  const port = Number(process.env.AE_BRIDGE_PORT || 8765);
  const inUse = await isPortInUse(port);
  if (inUse) {
    checks.push({
      id: "port_status",
      name: `Port ${port}`,
      status: "warn",
      message: `Port ${port} is currently in use by an active process`,
      hint: "An AE Bridge server or another local service is listening on this port."
    });
  } else {
    checks.push({
      id: "port_status",
      name: `Port ${port}`,
      status: "pass",
      message: `Port ${port} is free and ready for WebSocket bridge binding`
    });
  }

  // 3. CEP Extension Link
  let extensionsDir = "";
  if (platform === "win32") {
    const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    extensionsDir = path.join(appData, "Adobe", "CEP", "extensions");
  } else if (platform === "darwin") {
    extensionsDir = path.join(os.homedir(), "Library", "Application Support", "Adobe", "CEP", "extensions");
  }

  const canonicalPath = extensionsDir ? path.join(extensionsDir, CANONICAL_EXTENSION_NAME) : "";
  const legacyPath = extensionsDir ? path.join(extensionsDir, "ae-bridge") : "";

  const canonicalStat = canonicalPath ? fs.lstatSync(canonicalPath, { throwIfNoEntry: false }) : null;
  const legacyStat = legacyPath ? fs.lstatSync(legacyPath, { throwIfNoEntry: false }) : null;

  if (canonicalStat) {
    checks.push({
      id: "cep_installed",
      name: "CEP Panel Extension",
      status: "pass",
      message: `Installed at ${canonicalPath}`
    });
  } else if (legacyStat) {
    checks.push({
      id: "cep_installed",
      name: "CEP Panel Extension",
      status: "warn",
      message: `Found legacy extension folder at ${legacyPath}`,
      hint: "Run 'ae-bridge install' to migrate to the canonical 'com.aebridge' folder."
    });
  } else {
    checks.push({
      id: "cep_installed",
      name: "CEP Panel Extension",
      status: "fail",
      message: "Not found in Adobe CEP extensions directory",
      hint: "Run 'ae-bridge install' or './scripts/install-windows.ps1' / './scripts/install-macos.sh'."
    });
  }

  // 4. CEP PlayerDebugMode Check
  const configuredVersions: string[] = [];
  const missingVersions: string[] = [];

  for (const ver of CSXS_VERSIONS) {
    let isSet = false;
    if (platform === "win32") {
      try {
        const out = execFileSync("reg.exe", ["query", `HKCU\\Software\\Adobe\\CSXS.${ver}`, "/v", "PlayerDebugMode"], {
          encoding: "utf-8",
          stdio: ["ignore", "pipe", "ignore"]
        });
        const match = out.match(/PlayerDebugMode\s+REG_SZ\s+(\d+)/i);
        if (match && match[1] === "1") {
          isSet = true;
        }
      } catch {}
    } else if (platform === "darwin") {
      try {
        const out = execFileSync("defaults", ["read", `com.adobe.CSXS.${ver}`, "PlayerDebugMode"], {
          encoding: "utf-8",
          stdio: ["ignore", "pipe", "ignore"]
        });
        if (out.trim() === "1") {
          isSet = true;
        }
      } catch {}
    }

    if (isSet) {
      configuredVersions.push(ver);
    } else {
      missingVersions.push(ver);
    }
  }

  if (configuredVersions.length === CSXS_VERSIONS.length) {
    checks.push({
      id: "player_debug_mode",
      name: "CEP PlayerDebugMode",
      status: "pass",
      message: `Configured (1) for all CSXS versions [${configuredVersions.join(", ")}]`
    });
  } else if (configuredVersions.length > 0) {
    checks.push({
      id: "player_debug_mode",
      name: "CEP PlayerDebugMode",
      status: "warn",
      message: `Configured for [${configuredVersions.join(", ")}], missing for [${missingVersions.join(", ")}]`,
      hint: "Run 'ae-bridge install' to configure PlayerDebugMode for all versions."
    });
  } else {
    checks.push({
      id: "player_debug_mode",
      name: "CEP PlayerDebugMode",
      status: "fail",
      message: "Not configured (required for loading unsigned CEP extensions)",
      hint: "Run 'ae-bridge install' to enable PlayerDebugMode."
    });
  }

  // 5. Auth Token Check (Non-destructive check: does NOT create token if missing)
  const tokenPath = getAuthTokenPath();
  if (fs.existsSync(tokenPath)) {
    try {
      const content = fs.readFileSync(tokenPath, "utf-8").trim();
      if (content.length >= 16) {
        checks.push({
          id: "auth_token",
          name: "Auth Token",
          status: "pass",
          message: `Present at ${tokenPath}`
        });
      } else {
        checks.push({
          id: "auth_token",
          name: "Auth Token",
          status: "warn",
          message: `Token file at ${tokenPath} is unusually short`,
          hint: "Will be automatically refreshed when the server starts."
        });
      }
    } catch (err) {
      checks.push({
        id: "auth_token",
        name: "Auth Token",
        status: "warn",
        message: `Cannot read token file: ${(err as Error).message}`
      });
    }
  } else {
    checks.push({
      id: "auth_token",
      name: "Auth Token",
      status: "warn",
      message: `Not found at ${tokenPath}`,
      hint: "Will be created automatically on first server startup."
    });
  }

  // 6. Sharp Library
  try {
    const sharpModule = await import("sharp");
    if (typeof sharpModule.default === "function" || typeof sharpModule === "function") {
      checks.push({
        id: "sharp_library",
        name: "Image Pipeline",
        status: "pass",
        message: "'sharp' native module loaded successfully"
      });
    } else {
      throw new Error("sharp default export is not a function");
    }
  } catch (err) {
    checks.push({
      id: "sharp_library",
      name: "Image Pipeline",
      status: "fail",
      message: `Failed to load 'sharp': ${(err as Error).message}`,
      hint: "Run 'npm install sharp' in the server directory to install platform binaries."
    });
  }

  // 7. CSInterface.js integrity check
  const csInterfacePath = path.join(REPO_ROOT, "cep-panel", "lib", "CSInterface.js");
  const manifest = getDepsManifest();
  const csDep = manifest["CSInterface.js"];
  const expectedHash = csDep ? csDep.sha256 : "d940cbc991553b4885d1b3b04d99c17f448041a738a12cc0b24ce688ace2d263";

  if (fs.existsSync(csInterfacePath)) {
    const currentHash = computeFileSha256(csInterfacePath);
    if (currentHash && currentHash.toLowerCase() === expectedHash.toLowerCase()) {
      checks.push({
        id: "csinterface_integrity",
        name: "CSInterface.js Dependency",
        status: "pass",
        message: "Verified present and cryptographically intact"
      });
    } else {
      checks.push({
        id: "csinterface_integrity",
        name: "CSInterface.js Dependency",
        status: "fail",
        message: "File is present but hash does not match pinned manifest",
        hint: "Run 'ae-bridge install' to re-fetch the verified version."
      });
    }
  } else {
    checks.push({
      id: "csinterface_integrity",
      name: "CSInterface.js Dependency",
      status: "fail",
      message: "Missing in cep-panel/lib/CSInterface.js",
      hint: "Run 'ae-bridge install' to download official CSInterface.js."
    });
  }

  const hasFailure = checks.some((c) => c.status === "fail");
  return {
    ok: !hasFailure,
    version: VERSION,
    timestamp: new Date().toISOString(),
    checks
  };
}

async function handleDoctor(isJson = false): Promise<void> {
  const report = await runDiagnostics();

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) {
      process.exit(1);
    }
    return;
  }

  console.log("\n🔍 Running AE Bridge System Diagnostics...\n");
  for (const check of report.checks) {
    const symbol = check.status === "pass" ? "✓" : check.status === "warn" ? "!" : "✗";
    console.log(`  ${symbol} ${check.name}: ${check.message}`);
    if (check.hint && check.status !== "pass") {
      console.log(`    ↳ Fix: ${check.hint}`);
    }
  }

  console.log(`\nDiagnostics finished: ${report.ok ? "All critical systems operational! ✓" : "Some items need attention (see hints above)."}\n`);

  if (!report.ok) {
    process.exit(1);
  }
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
      configObj = {
        mcpServers: {
          "ae-bridge": {
            command: "node",
            args: [cliPath]
          }
        }
      };
      break;

    default:
      console.error(`Error: Unknown client '${clientArg}'. Supported clients: antigravity, claude, cursor, vscode`);
      process.exit(1);
  }

  console.log(JSON.stringify(configObj, null, 2));
}

function printUsage(): void {
  console.log(`
AE Bridge CLI — The Adobe After Effects MCP Bridge (v${VERSION})

USAGE:
  ae-bridge                           Start the MCP server over stdio
  ae-bridge install                   Install the CEP panel extension and set debug modes
  ae-bridge doctor [--json]           Inspect system dependencies, ports, and panel connectivity
  ae-bridge config --client <name>    Output MCP client configuration JSON

OPTIONS:
  --client    Target AI client: 'antigravity', 'claude', 'cursor', 'vscode'
  --json      Output machine-readable JSON (supported by 'doctor')
  --help, -h  Display this help menu
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] ? args[0].toLowerCase() : "";

  if (!command || command === "start" || command === "serve") {
    // Dynamic import to avoid loading heavy tool modules if running CLI utilities
    const { runServer } = await import("./index.js");
    await runServer();
    return;
  }

  switch (command) {
    case "install":
      await handleInstall();
      break;

    case "doctor": {
      const isJson = args.includes("--json");
      await handleDoctor(isJson);
      break;
    }

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
