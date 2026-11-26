import fs from "fs";
import path from "path";
import { getAeBridgeHome } from "./paths.js";

const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_BACKUPS = 3;

export class BridgeLogger {
  private getLogDir(): string {
    return path.join(getAeBridgeHome(), "logs");
  }

  private getLogFile(): string {
    return path.join(this.getLogDir(), "bridge.log");
  }

  private ensureDir(): void {
    const dir = this.getLogDir();
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      } catch {}
    }
  }

  private rotateIfNeeded(): void {
    try {
      const logFile = this.getLogFile();
      if (!fs.existsSync(logFile)) return;
      const stat = fs.statSync(logFile);
      if (stat.size < MAX_LOG_SIZE) return;

      // Rotate: bridge.log.2 -> bridge.log.3, bridge.log.1 -> bridge.log.2, bridge.log -> bridge.log.1
      for (let i = MAX_BACKUPS - 1; i >= 1; i--) {
        const src = `${logFile}.${i}`;
        const dest = `${logFile}.${i + 1}`;
        if (fs.existsSync(src)) {
          try {
            fs.renameSync(src, dest);
          } catch {}
        }
      }

      const firstBackup = `${logFile}.1`;
      try {
        fs.renameSync(logFile, firstBackup);
      } catch {}
    } catch {}
  }

  private write(level: string, message: string, meta?: unknown): void {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${typeof meta === "string" ? meta : JSON.stringify(meta)}` : "";
    const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}\n`;

    // 1. Output to stderr (NEVER stdout, which is reserved for MCP stdio)
    console.error(`[ae-bridge] [${level.toUpperCase()}] ${message}${metaStr}`);

    // 2. Append to rotating log file
    try {
      this.ensureDir();
      this.rotateIfNeeded();
      fs.appendFileSync(this.getLogFile(), logLine, { encoding: "utf-8" });
    } catch {}
  }

  public info(message: string, meta?: unknown): void {
    this.write("info", message, meta);
  }

  public warn(message: string, meta?: unknown): void {
    this.write("warn", message, meta);
  }

  public error(message: string, meta?: unknown): void {
    this.write("error", message, meta);
  }

  public debug(message: string, meta?: unknown): void {
    if (process.env.DEBUG || process.env.AE_BRIDGE_DEBUG) {
      this.write("debug", message, meta);
    }
  }
}

export const logger = new BridgeLogger();
