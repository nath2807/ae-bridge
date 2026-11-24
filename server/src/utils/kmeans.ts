/**
 * K-Means Color Clustering & Palette Extraction Utility for AE Bridge.
 * Analyzes RGB pixel buffers, extracts dominant color palettes, and calculates aesthetic metrics.
 */

export interface RGBPixel {
  r: number;
  g: number;
  b: number;
}

export interface PaletteCluster {
  hex: string;
  rgb: [number, number, number];
  weight: number; // 0.0 - 1.0 fraction of pixels
}

export interface ImageAnalysisMetrics {
  palette: string[]; // 6 dominant hex colors
  clusters: PaletteCluster[];
  averageLuminance: number; // 0.0 (dark) to 1.0 (light)
  contrast: number; // Standard deviation of luminance (0.0 flat to 0.5+ high contrast)
  saturation: number; // 0.0 (grayscale) to 1.0 (vivid)
  warmCoolBias: number; // -1.0 (cool/cyan/blue) to +1.0 (warm/amber/red)
  isDark: boolean;
  isMonochrome: boolean;
}

/**
 * Converts [r, g, b] (0-255) to hex string.
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const hex = ((1 << 24) + (clamp(r) << 16) + (clamp(g) << 8) + clamp(b))
    .toString(16)
    .slice(1)
    .toUpperCase();
  return `#${hex}`;
}

/**
 * Converts hex string to [r, g, b] (0-255).
 */
export function hexToRgb(hex: string): [number, number, number] {
  let clean = hex.replace(/^#/, "");
  if (clean.length === 3) {
    clean = clean.split("").map((c) => c + c).join("");
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return [0, 0, 0];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/**
 * Calculates Euclidean distance squared between two RGB colors.
 */
function distSq(c1: [number, number, number], c2: [number, number, number]): number {
  const dr = c1[0] - c2[0];
  const dg = c1[1] - c2[1];
  const db = c1[2] - c2[2];
  return dr * dr + dg * dg + db * db;
}

/**
 * Calculates perceived relative luminance (ITU-R BT.709).
 */
export function calculateLuminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0;
}

/**
 * Calculates saturation (0.0 to 1.0) from RGB.
 */
export function calculateSaturation(r: number, g: number, b: number): number {
  const rn = r / 255.0;
  const gn = g / 255.0;
  const bn = b / 255.0;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  if (delta === 0) return 0;
  const lum = (max + min) / 2.0;
  return lum > 0.5 ? delta / (2.0 - max - min) : delta / (max + min);
}

/**
 * Runs K-Means clustering on an array of RGB pixels to extract k dominant colors.
 */
export function extractKMeansPalette(
  pixels: Array<[number, number, number]>,
  k: number = 6,
  maxIterations: number = 20
): PaletteCluster[] {
  if (pixels.length === 0) {
    const fallbackHexes = ["#000000", "#333333", "#666666", "#999999", "#CCCCCC", "#FFFFFF"];
    return fallbackHexes.slice(0, k).map((h) => ({
      hex: h,
      rgb: hexToRgb(h),
      weight: 1 / k
    }));
  }

  // Handle small pixel count: pad up to k clusters
  if (pixels.length <= k) {
    const res = pixels.map((px) => ({
      hex: rgbToHex(px[0], px[1], px[2]),
      rgb: px,
      weight: 1 / Math.max(1, pixels.length)
    }));
    while (res.length < k && res.length > 0) {
      const src = res[res.length - 1];
      res.push({
        hex: src.hex,
        rgb: [...src.rgb],
        weight: 0
      });
    }
    return res;
  }

  // K-means++ initialization
  const centroids: Array<[number, number, number]> = [];
  // Pick first centroid randomly from pixels
  centroids.push([...pixels[Math.floor(pixels.length / 2)]]);

  while (centroids.length < k) {
    // For each pixel, find distance to nearest existing centroid
    const distances: number[] = [];
    let sumDist = 0;
    for (const px of pixels) {
      let minD = Infinity;
      for (const c of centroids) {
        const d = distSq(px, c);
        if (d < minD) minD = d;
      }
      distances.push(minD);
      sumDist += minD;
    }

    if (sumDist === 0) {
      // All remaining pixels are identical to existing centroids
      while (centroids.length < k) {
        centroids.push([...pixels[0]]);
      }
      break;
    }

    // Weighted random selection
    const rVal = Math.random() * sumDist;
    let acc = 0;
    let chosen = pixels[0];
    for (let i = 0; i < pixels.length; i++) {
      acc += distances[i];
      if (acc >= rVal) {
        chosen = pixels[i];
        break;
      }
    }
    centroids.push([...chosen]);
  }

  // Iterative clustering
  const assignments = new Int32Array(pixels.length);
  for (let iter = 0; iter < maxIterations; iter++) {
    // 1. Assign each pixel to nearest centroid
    let changed = false;
    for (let pIdx = 0; pIdx < pixels.length; pIdx++) {
      const px = pixels[pIdx];
      let bestDist = Infinity;
      let bestCentroid = 0;
      for (let cIdx = 0; cIdx < k; cIdx++) {
        const d = distSq(px, centroids[cIdx]);
        if (d < bestDist) {
          bestDist = d;
          bestCentroid = cIdx;
        }
      }
      if (assignments[pIdx] !== bestCentroid) {
        assignments[pIdx] = bestCentroid;
        changed = true;
      }
    }

    if (!changed && iter > 0) break;

    // 2. Recompute centroids
    const counts = new Uint32Array(k);
    const sumR = new Float64Array(k);
    const sumG = new Float64Array(k);
    const sumB = new Float64Array(k);

    for (let pIdx = 0; pIdx < pixels.length; pIdx++) {
      const c = assignments[pIdx];
      counts[c]++;
      sumR[c] += pixels[pIdx][0];
      sumG[c] += pixels[pIdx][1];
      sumB[c] += pixels[pIdx][2];
    }

    for (let cIdx = 0; cIdx < k; cIdx++) {
      if (counts[cIdx] > 0) {
        centroids[cIdx][0] = Math.round(sumR[cIdx] / counts[cIdx]);
        centroids[cIdx][1] = Math.round(sumG[cIdx] / counts[cIdx]);
        centroids[cIdx][2] = Math.round(sumB[cIdx] / counts[cIdx]);
      }
    }
  }

  // Calculate cluster weights and format results
  const counts = new Uint32Array(k);
  for (let pIdx = 0; pIdx < pixels.length; pIdx++) {
    counts[assignments[pIdx]]++;
  }

  const clusters: PaletteCluster[] = [];
  for (let cIdx = 0; cIdx < k; cIdx++) {
    const r = centroids[cIdx][0];
    const g = centroids[cIdx][1];
    const b = centroids[cIdx][2];
    clusters.push({
      hex: rgbToHex(r, g, b),
      rgb: [r, g, b],
      weight: counts[cIdx] / pixels.length
    });
  }

  // Sort clusters descending by weight
  clusters.sort((a, b) => b.weight - a.weight);

  return clusters;
}

/**
 * Comprehensive visual analysis of an array of RGB pixels.
 */
export function analyzePixels(pixels: Array<[number, number, number]>): ImageAnalysisMetrics {
  const k = 6;
  const clusters = extractKMeansPalette(pixels, k);
  const palette = clusters.map((c) => c.hex);

  if (pixels.length === 0) {
    return {
      palette,
      clusters,
      averageLuminance: 0.5,
      contrast: 0.1,
      saturation: 0.0,
      warmCoolBias: 0.0,
      isDark: false,
      isMonochrome: true
    };
  }

  let totalLum = 0;
  let totalSat = 0;
  let totalWarm = 0;
  const luminances: number[] = new Array(pixels.length);

  for (let i = 0; i < pixels.length; i++) {
    const [r, g, b] = pixels[i];
    const lum = calculateLuminance(r, g, b);
    luminances[i] = lum;
    totalLum += lum;
    totalSat += calculateSaturation(r, g, b);

    // Warm bias: R vs B relative to total
    const tot = r + g + b + 0.001;
    totalWarm += (r - b) / tot;
  }

  const avgLum = totalLum / pixels.length;
  const avgSat = totalSat / pixels.length;
  const avgWarm = Math.max(-1, Math.min(1, totalWarm / pixels.length));

  // Contrast: standard deviation of luminance
  let varLum = 0;
  for (let i = 0; i < pixels.length; i++) {
    const diff = luminances[i] - avgLum;
    varLum += diff * diff;
  }
  const contrast = Math.sqrt(varLum / pixels.length);

  return {
    palette,
    clusters,
    averageLuminance: Math.round(avgLum * 1000) / 1000,
    contrast: Math.round(contrast * 1000) / 1000,
    saturation: Math.round(avgSat * 1000) / 1000,
    warmCoolBias: Math.round(avgWarm * 1000) / 1000,
    isDark: avgLum < 0.35,
    isMonochrome: avgSat < 0.12
  };
}
