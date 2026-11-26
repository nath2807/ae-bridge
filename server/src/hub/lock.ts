import fs from "fs";
import path from "path";
import net from "net";
import { getAeBridgeHome, VERSION } from "../utils/paths.js";
import { logger } from "../utils/logger.js";

export interface HubLockInfo {
  pid: number;
  port: number;
  ipcPort: number;
  httpPort?: number;
  tokenPath: string;
  startedAt: number;
  version: string;
}

export function getLockFilePath(): string {
  return path.join(getAeBridgeHome(), "hub.lock");
}

export function isPidAlive(pid: number): boolean {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: any) {
    return err.code === "EPERM"; // Process exists, but we don't have permission to signal it
  }
}

export async function isPortResponsive(port: number, host = "127.0.0.1", timeoutMs = 1000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);

    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });

    socket.on("error", () => {
      resolve(false);
    });

    socket.connect(port, host);
  });
}

export function readLockFile(): HubLockInfo | null {
  const lockFile = getLockFilePath();
  if (!fs.existsSync(lockFile)) return null;
  try {
    const content = fs.readFileSync(lockFile, "utf-8");
    return JSON.parse(content) as HubLockInfo;
  } catch {
    return null;
  }
}

export function writeLockFile(info: HubLockInfo): void {
  const lockFile = getLockFilePath();
  fs.writeFileSync(lockFile, JSON.stringify(info, null, 2), "utf-8");
}

export function removeLockFile(): void {
  const lockFile = getLockFilePath();
  if (fs.existsSync(lockFile)) {
    try {
      fs.unlinkSync(lockFile);
    } catch {}
  }
}

export async function acquireHubOrProxy(
  port = 8765,
  ipcPort = 8766
): Promise<{ isHub: boolean; hubInfo: HubLockInfo }> {
  const existing = readLockFile();

  if (existing) {
    // Check if recorded PID is still running
    if (isPidAlive(existing.pid)) {
      // Check if port is responsive
      const responsive = await isPortResponsive(existing.port);
      if (responsive) {
        logger.info(`Existing AE Bridge Hub detected (PID ${existing.pid} on port ${existing.port}). Operating as Proxy client.`);
        return { isHub: false, hubInfo: existing };
      }
    }

    logger.warn(`Stale hub lockfile detected (PID ${existing.pid}). Cleaning up and claiming Hub role.`);
    removeLockFile();
  }

  const newInfo: HubLockInfo = {
    pid: process.pid,
    port,
    ipcPort,
    tokenPath: path.join(getAeBridgeHome(), "token"),
    startedAt: Date.now(),
    version: VERSION
  };

  writeLockFile(newInfo);
  logger.info(`Claimed AE Bridge Hub role (PID ${process.pid}, port ${port}, IPC port ${ipcPort})`);
  return { isHub: true, hubInfo: newInfo };
}
