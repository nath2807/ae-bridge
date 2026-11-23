import { describe, it, expect } from "vitest";
import { detectBeatsFromVolume } from "../src/utils/beat-detector.js";

describe("Pure Beat and Rhythm Detector", () => {
  it("detects rhythmic peaks from synthesized pulse waveform", () => {
    // Generate 4 beats at 1-second intervals (0s, 1s, 2s, 3s) at 30fps
    const numFrames = 120;
    const samples: number[] = new Array(numFrames).fill(2.0); // noise floor = 2

    // Peaks at frames 0, 30, 60, 90
    samples[0] = 50.0;
    samples[30] = 60.0;
    samples[60] = 55.0;
    samples[90] = 65.0;

    const result = detectBeatsFromVolume(samples, {
      sensitivity: 0.6,
      minGap: 0.25,
      frameDuration: 1 / 30
    });

    expect(result.detectedBeats).toBeGreaterThanOrEqual(3);
    expect(result.estimatedBPM).toBe(60);
    expect(result.beatTimes).toContain(1.0);
    expect(result.beatTimes).toContain(2.0);
    expect(result.beatTimes).toContain(3.0);
  });

  it("handles empty or zero amplitude input gracefully", () => {
    const result = detectBeatsFromVolume([], { sensitivity: 0.5 });
    expect(result.detectedBeats).toBe(0);
    expect(result.beatTimes).toEqual([]);
    expect(result.estimatedBPM).toBe(120);
  });

  it("suppresses double hits within minGap interval", () => {
    // Two rapid spikes 0.1s apart
    const samples = [
      0, 0, 100, 0, 0, 0, 95, 0, 0, 0
    ];

    const result = detectBeatsFromVolume(samples, {
      sensitivity: 0.5,
      minGap: 0.25,
      frameDuration: 0.05
    });

    // 0.05s * 2 = 0.10s, 0.05s * 6 = 0.30s -> diff is 0.20s < 0.25s -> only 1 beat
    expect(result.detectedBeats).toBe(1);
  });
});
