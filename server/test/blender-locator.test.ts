import { describe, it, expect } from "vitest";
import fs from "fs";
import {
  findBlenderExecutable,
  getHdriDir,
  getBlenderRendersDir
} from "../src/blender/locator.js";

describe("Blender Locator and Asset Directories", () => {
  it("locates Blender executable on systems with Blender installed", () => {
    const bin = findBlenderExecutable();
    if (bin) {
      expect(typeof bin).toBe("string");
      expect(fs.existsSync(bin)).toBe(true);
      expect(bin.toLowerCase()).toContain("blender");
    }
  });

  it("resolves and creates HDRI asset storage directory", () => {
    const hdriDir = getHdriDir();
    expect(fs.existsSync(hdriDir)).toBe(true);
    expect(hdriDir).toContain(".ae-bridge");
  });

  it("resolves dedicated blender renders directory", () => {
    const rendersDir = getBlenderRendersDir();
    expect(fs.existsSync(rendersDir)).toBe(true);
    expect(rendersDir.toLowerCase()).toContain("blender");
  });
});
