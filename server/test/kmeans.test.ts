import { describe, it, expect } from "vitest";
import {
  rgbToHex,
  hexToRgb,
  calculateLuminance,
  calculateSaturation,
  extractKMeansPalette,
  analyzePixels
} from "../src/utils/kmeans.js";

describe("K-Means Palette Extraction and Image Analysis", () => {
  it("converts between RGB and Hex correctly", () => {
    expect(rgbToHex(255, 0, 0)).toBe("#FF0000");
    expect(rgbToHex(0, 229, 255)).toBe("#00E5FF");
    expect(rgbToHex(0, 0, 0)).toBe("#000000");
    expect(rgbToHex(255, 255, 255)).toBe("#FFFFFF");

    expect(hexToRgb("#FF0000")).toEqual([255, 0, 0]);
    expect(hexToRgb("#00E5FF")).toEqual([0, 229, 255]);
    expect(hexToRgb("#FFF")).toEqual([255, 255, 255]);
  });

  it("calculates luminance and saturation accurately", () => {
    // Pure black and pure white
    expect(calculateLuminance(0, 0, 0)).toBe(0);
    expect(calculateLuminance(255, 255, 255)).toBeCloseTo(1, 5);

    // Grayscale has 0 saturation
    expect(calculateSaturation(128, 128, 128)).toBe(0);
    // Pure saturated color
    expect(calculateSaturation(255, 0, 0)).toBeCloseTo(1, 2);
  });

  it("extracts distinct cluster centroids from synthesized multi-color pixels", () => {
    const pixels: Array<[number, number, number]> = [];

    // 100 cyan pixels [0, 229, 255]
    for (let i = 0; i < 100; i++) {
      pixels.push([0 + (i % 3), 229, 255]);
    }
    // 100 dark background pixels [10, 12, 20]
    for (let i = 0; i < 100; i++) {
      pixels.push([10, 12 + (i % 2), 20]);
    }
    // 50 gold pixels [212, 175, 55]
    for (let i = 0; i < 50; i++) {
      pixels.push([212, 175, 55]);
    }

    const clusters = extractKMeansPalette(pixels, 3);
    expect(clusters.length).toBe(3);

    const hexList = clusters.map((c) => c.hex);
    // Verify each expected cluster exists
    expect(hexList.some((h) => h.startsWith("#00E") || h.startsWith("#01E") || h.startsWith("#02E"))).toBe(true);
    expect(hexList.some((h) => h.startsWith("#0A0") || h.startsWith("#0A1") || h.startsWith("#090"))).toBe(true);
    expect(hexList.some((h) => h.startsWith("#D4A") || h.startsWith("#D3A"))).toBe(true);
  });

  it("computes comprehensive visual analysis metrics", () => {
    const pixels: Array<[number, number, number]> = [
      [10, 10, 15],
      [15, 12, 20],
      [20, 18, 25],
      [255, 100, 50], // warm accent
      [220, 90, 40]
    ];

    const metrics = analyzePixels(pixels);
    expect(metrics.palette.length).toBe(6);
    expect(metrics.averageLuminance).toBeGreaterThan(0);
    expect(metrics.averageLuminance).toBeLessThan(1);
    expect(metrics.contrast).toBeGreaterThan(0);
    expect(metrics.warmCoolBias).toBeGreaterThan(-1);
    expect(metrics.warmCoolBias).toBeLessThanOrEqual(1);
    expect(typeof metrics.isDark).toBe("boolean");
    expect(typeof metrics.isMonochrome).toBe("boolean");
  });

  it("handles empty or degenerate pixel buffers gracefully", () => {
    const emptyMetrics = analyzePixels([]);
    expect(emptyMetrics.palette.length).toBe(6);
    expect(emptyMetrics.averageLuminance).toBe(0.5);

    const singlePixel = extractKMeansPalette([[100, 150, 200]], 3);
    expect(singlePixel.length).toBe(3);
    expect(singlePixel[0].hex).toBe("#6496C8");
  });
});
