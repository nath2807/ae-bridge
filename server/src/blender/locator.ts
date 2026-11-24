import fs from "fs";
import os from "os";
import path from "path";
import { execSync } from "child_process";
import { getStateFilePath } from "../director/styles.js";

/**
 * Searches for installed Blender binaries across OS standard locations.
 */
export function findBlenderExecutable(): string | null {
  // 1. Environment variable override
  if (process.env.BLENDER_PATH && fs.existsSync(process.env.BLENDER_PATH)) {
    return path.resolve(process.env.BLENDER_PATH).replace(/\\/g, "/");
  }

  // 2. Persisted state override
  const stored = getStoredBlenderPath();
  if (stored && fs.existsSync(stored)) {
    return path.resolve(stored).replace(/\\/g, "/");
  }

  // 3. User explicit default path (Blender 5.3 on Windows)
  const defaultWin53 = "C:/Program Files/Blender Foundation/Blender 5.3/blender.exe";
  if (fs.existsSync(defaultWin53)) {
    return defaultWin53;
  }

  // 4. Windows directory search: "C:/Program Files/Blender Foundation/Blender */blender.exe"
  if (process.platform === "win32") {
    const baseDir = "C:/Program Files/Blender Foundation";
    if (fs.existsSync(baseDir)) {
      try {
        const entries = fs.readdirSync(baseDir);
        // Sort descending to prefer newest versions (e.g. "Blender 5.3", "Blender 5.0", "Blender 4.2")
        const blenderFolders = entries
          .filter((e) => /^Blender\s+([0-9.]+)/i.test(e))
          .sort((a, b) => {
            const vA = parseFloat(a.replace(/^Blender\s+/i, "")) || 0;
            const vB = parseFloat(b.replace(/^Blender\s+/i, "")) || 0;
            return vB - vA;
          });

        for (const folder of blenderFolders) {
          const exePath = path.join(baseDir, folder, "blender.exe").replace(/\\/g, "/");
          if (fs.existsSync(exePath)) {
            return exePath;
          }
        }
      } catch {}
    }

    // Try PATH check on Windows
    try {
      const out = execSync("where blender", { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] });
      const firstLine = out.split(/\r?\n/)[0]?.trim();
      if (firstLine && fs.existsSync(firstLine)) {
        return firstLine.replace(/\\/g, "/");
      }
    } catch {}
  }

  // 5. macOS standard locations
  if (process.platform === "darwin") {
    const macPaths = [
      "/Applications/Blender.app/Contents/MacOS/Blender",
      path.join(os.homedir(), "Applications/Blender.app/Contents/MacOS/Blender")
    ];
    for (const p of macPaths) {
      if (fs.existsSync(p)) return p;
    }
  }

  // 6. Linux standard locations
  if (process.platform === "linux") {
    const linuxPaths = ["/usr/bin/blender", "/usr/local/bin/blender", "/snap/bin/blender"];
    for (const p of linuxPaths) {
      if (fs.existsSync(p)) return p;
    }
    try {
      const out = execSync("which blender", { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] });
      const trimmed = out.trim();
      if (trimmed && fs.existsSync(trimmed)) return trimmed;
    } catch {}
  }

  return null;
}

export function getStoredBlenderPath(): string | null {
  const statePath = getStateFilePath();
  try {
    if (fs.existsSync(statePath)) {
      const parsed = JSON.parse(fs.readFileSync(statePath, "utf-8"));
      if (parsed.blenderPath && typeof parsed.blenderPath === "string") {
        return parsed.blenderPath;
      }
    }
  } catch {}
  return null;
}

export function setStoredBlenderPath(p: string): void {
  const clean = path.resolve(p).replace(/\\/g, "/");
  if (!fs.existsSync(clean)) {
    throw new Error(`Blender executable not found at specified path: ${clean}`);
  }

  const statePath = getStateFilePath();
  let stateObj: Record<string, any> = {};
  try {
    if (fs.existsSync(statePath)) {
      stateObj = JSON.parse(fs.readFileSync(statePath, "utf-8"));
    }
  } catch {}
  stateObj.blenderPath = clean;
  fs.writeFileSync(statePath, JSON.stringify(stateObj, null, 2), "utf-8");
}

export function getHdriDir(): string {
  const dir = path.join(os.homedir(), ".ae-bridge", "hdri");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir.replace(/\\/g, "/");
}

export function getBlenderRendersDir(): string {
  // Prefer <Videos>/ae-bridge-renders/blender
  const candidates = [
    path.join(os.homedir(), "Videos", "ae-bridge-renders", "blender"),
    path.join(os.homedir(), "Movies", "ae-bridge-renders", "blender"),
    path.join(os.homedir(), ".ae-bridge", "renders", "blender")
  ];

  for (const c of candidates) {
    try {
      const parent = path.dirname(path.dirname(c));
      if (fs.existsSync(parent)) {
        if (!fs.existsSync(c)) fs.mkdirSync(c, { recursive: true });
        return c.replace(/\\/g, "/");
      }
    } catch {}
  }

  const fallback = path.join(os.homedir(), ".ae-bridge", "renders", "blender");
  if (!fs.existsSync(fallback)) fs.mkdirSync(fallback, { recursive: true });
  return fallback.replace(/\\/g, "/");
}
