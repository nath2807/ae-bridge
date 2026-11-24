import { describe, it, expect } from "vitest";
import {
  extractMbps,
  resolveTemplateMatch,
  getTemplateWarning
} from "../src/tools/renderPresets.js";

describe("Render Preset Template Resolution", () => {
  const fullTemplateList = [
    "AE Bridge H264 High",
    "AE Bridge H264 Web",
    "AIFF 48kHz",
    "Alpha Only",
    "H.264 - Match Render Settings -  5 Mbps",
    "H.264 - Match Render Settings - 15 Mbps",
    "H.264 - Match Render Settings - 40 Mbps",
    "High Quality",
    "High Quality with Alpha",
    "Lossless",
    "Lossless with Alpha",
    "Photoshop",
    "ProRes 422 HQ",
    "Apple ProRes 4444"
  ];

  it("extracts Mbps correctly from template names", () => {
    expect(extractMbps("H.264 - Match Render Settings -  5 Mbps")).toBe(5);
    expect(extractMbps("H.264 - Match Render Settings - 15 Mbps")).toBe(15);
    expect(extractMbps("H.264 - Match Render Settings - 40 Mbps")).toBe(40);
    expect(extractMbps("Custom 22.5Mbps Stream")).toBe(22.5);
    expect(extractMbps("High Quality")).toBeNull();
    expect(extractMbps("")).toBeNull();
  });

  it("prioritizes 'AE Bridge H264 High' as step 1 for mp4High", () => {
    const match = resolveTemplateMatch(fullTemplateList, "mp4High");
    expect(match).not.toBeNull();
    expect(match?.name).toBe("AE Bridge H264 High");
    expect(match?.isAeBridge).toBe(true);

    const warning = getTemplateWarning("mp4High", match);
    expect(warning).toBeNull();
  });

  it("prioritizes 'AE Bridge H264 Web' as step 1 for mp4Web", () => {
    const match = resolveTemplateMatch(fullTemplateList, "mp4Web");
    expect(match).not.toBeNull();
    expect(match?.name).toBe("AE Bridge H264 Web");
    expect(match?.isAeBridge).toBe(true);
  });

  it("falls back to the HIGHEST Mbps template for mp4High when AE Bridge template is absent", () => {
    const templatesWithoutAeBridge = [
      "H.264 - Match Render Settings -  5 Mbps",
      "H.264 - Match Render Settings - 15 Mbps",
      "H.264 - Match Render Settings - 40 Mbps",
      "High Quality"
    ];

    const match = resolveTemplateMatch(templatesWithoutAeBridge, "mp4High");
    expect(match).not.toBeNull();
    expect(match?.name).toBe("H.264 - Match Render Settings - 40 Mbps");
    expect(match?.isAeBridge).toBe(false);
    expect(match?.mbps).toBe(40);

    // 40 Mbps >= 20 Mbps, so no warning
    const warning = getTemplateWarning("mp4High", match);
    expect(warning).toBeNull();
  });

  it("falls back to the LOWEST Mbps template for mp4Web when AE Bridge template is absent", () => {
    const templatesWithoutAeBridge = [
      "H.264 - Match Render Settings -  5 Mbps",
      "H.264 - Match Render Settings - 15 Mbps",
      "H.264 - Match Render Settings - 40 Mbps"
    ];

    const match = resolveTemplateMatch(templatesWithoutAeBridge, "mp4Web");
    expect(match).not.toBeNull();
    expect(match?.name).toBe("H.264 - Match Render Settings -  5 Mbps");
    expect(match?.isAeBridge).toBe(false);
    expect(match?.mbps).toBe(5);
  });

  it("generates warning when mp4High falls back to a template under 20 Mbps", () => {
    const lowBitrateTemplates = [
      "H.264 - Match Render Settings -  5 Mbps",
      "H.264 - Match Render Settings - 15 Mbps"
    ];

    const match = resolveTemplateMatch(lowBitrateTemplates, "mp4High");
    expect(match).not.toBeNull();
    expect(match?.name).toBe("H.264 - Match Render Settings - 15 Mbps");
    expect(match?.isAeBridge).toBe(false);
    expect(match?.mbps).toBe(15);

    const warning = getTemplateWarning("mp4High", match);
    expect(warning).not.toBeNull();
    expect(warning).toContain("under 20 Mbps");
    expect(warning).toContain("AE Bridge H264 High");
    expect(warning).toContain("docs/troubleshooting.md#8-creating-custom-h264-render-templates-ae-bridge-h264-high");
  });

  it("generates warning when mp4High falls back to template without bitrate specified", () => {
    const genericTemplates = ["High Quality", "Lossless"];

    const match = resolveTemplateMatch(genericTemplates, "mp4High");
    expect(match).not.toBeNull();
    expect(match?.isAeBridge).toBe(false);

    const warning = getTemplateWarning("mp4High", match);
    expect(warning).not.toBeNull();
    expect(warning).toContain("no high bitrate specified");
    expect(warning).toContain("docs/troubleshooting.md#8-creating-custom-h264-render-templates-ae-bridge-h264-high");
  });

  it("resolves non-mp4 presets using keyword patterns", () => {
    const matchProRes = resolveTemplateMatch(fullTemplateList, "prores422");
    expect(matchProRes?.name).toBe("ProRes 422 HQ");

    const matchProResAlpha = resolveTemplateMatch(fullTemplateList, "prores4444Alpha");
    expect(matchProResAlpha?.name).toBe("Apple ProRes 4444");
  });
});
