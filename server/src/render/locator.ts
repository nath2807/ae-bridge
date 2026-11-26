import fs from "fs";
import os from "os";
import path from "path";

export function findAerenderExecutable(): string | null {
  // 1. Explicit environment variable takes precedence
  if (process.env.AERENDER_PATH) {
    return fs.existsSync(process.env.AERENDER_PATH) ? process.env.AERENDER_PATH : null;
  }

  const isWin = os.platform() === "win32";
  const isMac = os.platform() === "darwin";

  if (isWin) {
    // Windows common locations
    const programFiles = process.env["ProgramFiles"] || "C:\\Program Files";
    const adobeDir = path.join(programFiles, "Adobe");
    if (fs.existsSync(adobeDir)) {
      try {
        const entries = fs.readdirSync(adobeDir);
        // Look for Adobe After Effects folders in reverse order (newest first)
        const aeDirs = entries
          .filter((d) => d.toLowerCase().includes("after effects"))
          .sort()
          .reverse();

        for (const dir of aeDirs) {
          const exe = path.join(adobeDir, dir, "Support Files", "aerender.exe");
          if (fs.existsSync(exe)) {
            return exe;
          }
        }
      } catch {}
    }
  } else if (isMac) {
    // macOS common locations
    const appsDir = "/Applications";
    if (fs.existsSync(appsDir)) {
      try {
        const entries = fs.readdirSync(appsDir);
        const aeDirs = entries
          .filter((d) => d.toLowerCase().includes("after effects"))
          .sort()
          .reverse();

        for (const dir of aeDirs) {
          const exe = path.join(appsDir, dir, "aerender");
          if (fs.existsSync(exe)) {
            return exe;
          }
        }
      } catch {}
    }
  }

  return null;
}
