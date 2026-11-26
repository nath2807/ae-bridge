import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Returns the root directory used by AE Bridge for state, tokens, logs, and render caches.
 * Honors the AE_BRIDGE_HOME environment variable (defaults to ~/.ae-bridge).
 */
export function getAeBridgeHome(): string {
  const custom = process.env.AE_BRIDGE_HOME;
  const dir = custom ? path.resolve(custom) : path.join(os.homedir(), ".ae-bridge");
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    } catch {}
  }
  return dir;
}

/**
 * Supported Adobe CSXS extension runtime versions (2020 through 2026+).
 */
export const CSXS_VERSIONS = ["10", "11", "12", "13"] as const;

/**
 * Canonical CEP extension folder name matching manifest.xml ExtensionBundleId.
 */
export const CANONICAL_EXTENSION_NAME = "com.aebridge";

/**
 * Reads server package.json to obtain dynamic project metadata.
 */
export function getServerPackageJson(): { name: string; version: string; description?: string } {
  const candidates = [
    path.resolve(__dirname, "../../package.json"),
    path.resolve(__dirname, "../package.json"),
    path.resolve(process.cwd(), "package.json"),
    path.resolve(process.cwd(), "server/package.json")
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      try {
        return JSON.parse(fs.readFileSync(c, "utf-8"));
      } catch {}
    }
  }
  return { name: "ae-bridge", version: "1.3.0" };
}

export const VERSION = getServerPackageJson().version;
