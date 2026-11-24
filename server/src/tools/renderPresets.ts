export interface TemplateMatchResult {
  name: string;
  isAeBridge: boolean;
  mbps: number | null;
}

export const PRESET_PATTERNS: Record<string, RegExp[]> = {
  mp4High: [/match.*source.*high/i, /h\.?264.*high/i, /h\.?264/i, /high.*quality/i, /mp4/i, /lossless/i],
  mp4Web: [/web/i, /youtube/i, /vimeo/i, /medium/i, /h\.?264/i, /mp4/i],
  prores422: [/prores.*422/i, /apple prores.*422/i, /apple prores/i, /prores/i],
  proresProxy: [/prores.*proxy/i, /proxy/i],
  prores4444Alpha: [/prores.*4444/i, /lossless.*alpha/i, /with alpha/i, /alpha/i],
  pngSequence: [/png.*sequence/i, /png/i],
  pngAlphaSequence: [/png.*alpha/i, /png.*sequence/i, /png/i],
  wav: [/wav/i, /audio.*only/i, /aiff/i]
};

export function extractMbps(name: string): number | null {
  if (!name) return null;
  const match = String(name).match(/(\d+(?:\.\d+)?)\s*mbps/i);
  if (match) {
    return parseFloat(match[1]);
  }
  return null;
}

export function resolveTemplateMatch(templates: string[], presetName: string): TemplateMatchResult | null {
  if (!templates || templates.length === 0) return null;

  // 1. Template lookup order: templates whose name starts with "AE Bridge" matching the preset
  if (presetName === "mp4High" || presetName === "mp4Web") {
    const targetExact = presetName === "mp4High" ? "AE Bridge H264 High" : "AE Bridge H264 Web";
    const targetKeyword = presetName === "mp4High" ? "high" : "web";

    // Exact match check first
    for (const tExact of templates) {
      if (tExact && tExact.toLowerCase() === targetExact.toLowerCase()) {
        return {
          name: tExact,
          isAeBridge: true,
          mbps: extractMbps(tExact)
        };
      }
    }

    // Check if name starts with "AE Bridge" and contains the preset keyword
    for (const tPrefix of templates) {
      if (tPrefix && tPrefix.toLowerCase().startsWith("ae bridge") && tPrefix.toLowerCase().includes(targetKeyword)) {
        return {
          name: tPrefix,
          isAeBridge: true,
          mbps: extractMbps(tPrefix)
        };
      }
    }
  }

  // 2. Fallback keyword search:
  // choosing the HIGHEST Mbps number found in the template name for mp4High and the lowest for mp4Web
  const patterns = PRESET_PATTERNS[presetName] || [new RegExp(presetName, "i")];

  if (presetName === "mp4High" || presetName === "mp4Web") {
    const candidatesWithMbps: Array<{ name: string; mbps: number; patternIndex: number }> = [];
    const candidatesWithoutMbps: Array<{ name: string; patternIndex: number }> = [];
    const seen = new Set<string>();

    for (let p = 0; p < patterns.length; p++) {
      const regex = patterns[p];
      for (const candidate of templates) {
        if (!seen.has(candidate) && regex.test(candidate)) {
          seen.add(candidate);
          const mbpsVal = extractMbps(candidate);
          if (mbpsVal !== null) {
            candidatesWithMbps.push({ name: candidate, mbps: mbpsVal, patternIndex: p });
          } else {
            candidatesWithoutMbps.push({ name: candidate, patternIndex: p });
          }
        }
      }
    }

    if (candidatesWithMbps.length > 0) {
      if (presetName === "mp4High") {
        // Sort descending: highest Mbps first
        candidatesWithMbps.sort((a, b) => b.mbps - a.mbps);
      } else {
        // Sort ascending: lowest Mbps first
        candidatesWithMbps.sort((a, b) => a.mbps - b.mbps);
      }
      return {
        name: candidatesWithMbps[0].name,
        isAeBridge: false,
        mbps: candidatesWithMbps[0].mbps
      };
    }

    if (candidatesWithoutMbps.length > 0) {
      // Preserves pattern priority
      candidatesWithoutMbps.sort((a, b) => a.patternIndex - b.patternIndex);
      return {
        name: candidatesWithoutMbps[0].name,
        isAeBridge: false,
        mbps: null
      };
    }

    return null;
  }

  // Other presets (prores, pngSequence, wav, etc.)
  for (const regex of patterns) {
    for (const t of templates) {
      if (regex.test(t)) {
        return {
          name: t,
          isAeBridge: false,
          mbps: null
        };
      }
    }
  }

  return null;
}

export function getTemplateWarning(preset: string, match: TemplateMatchResult | null): string | null {
  if (preset !== "mp4High" || !match) return null;
  if (match.isAeBridge) return null;

  if (match.mbps === null || match.mbps < 20) {
    const detail = match.mbps !== null ? `${match.mbps} Mbps, which is under 20 Mbps` : "no high bitrate specified";
    return `Render template '${match.name}' is ${detail}. For optimal broadcast quality, please create the 'AE Bridge H264 High' output module template. See docs/troubleshooting.md#8-creating-custom-h264-render-templates-ae-bridge-h264-high for step-by-step instructions.`;
  }

  return null;
}
