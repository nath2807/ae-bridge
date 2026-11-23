/**
 * Pure TypeScript beat and rhythmic peak detection utility.
 * Used for audio keyframe analysis, tempo estimation, and unit testing.
 */

export interface VolumeSample {
  time: number;
  val: number;
}

export interface BeatDetectionOptions {
  sensitivity?: number; // 0.0 to 1.0 (default 0.5)
  minGap?: number; // minimum seconds between consecutive beats (default 0.25)
  frameDuration?: number; // duration of one sample frame (default 1/30)
}

export interface BeatDetectionResult {
  detectedBeats: number;
  estimatedBPM: number;
  beatTimes: number[];
  threshold: number;
  mean: number;
  stdDev: number;
}

export function detectBeatsFromVolume(
  samples: VolumeSample[] | number[],
  options: BeatDetectionOptions = {}
): BeatDetectionResult {
  const sensitivity = options.sensitivity ?? 0.5;
  const minGap = options.minGap ?? 0.25;
  const frameDur = options.frameDuration ?? (1 / 30);

  // Normalize inputs to VolumeSample[]
  const normalized: VolumeSample[] = [];
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (typeof s === "number") {
      normalized.push({ time: Number((i * frameDur).toFixed(3)), val: s });
    } else {
      normalized.push(s);
    }
  }

  if (normalized.length === 0) {
    return {
      detectedBeats: 0,
      estimatedBPM: 120,
      beatTimes: [],
      threshold: 0,
      mean: 0,
      stdDev: 0
    };
  }

  // 1. Calculate Mean
  let sum = 0;
  for (const s of normalized) {
    sum += s.val;
  }
  const mean = sum / normalized.length;

  // 2. Calculate Standard Deviation
  let varianceSum = 0;
  for (const s of normalized) {
    const diff = s.val - mean;
    varianceSum += diff * diff;
  }
  const stdDev = Math.sqrt(varianceSum / normalized.length);

  // 3. Dynamic Adaptive Threshold
  // Higher sensitivity -> smaller multiplier -> lower threshold -> more detected beats
  const multiplier = 0.5 + (1.0 - Math.max(0, Math.min(1, sensitivity))) * 1.5;
  const threshold = mean + multiplier * stdDev;

  // 4. Peak Detection with MinGap Suppression
  const beatTimes: number[] = [];
  let lastBeatTime = -minGap;

  for (let p = 1; p < normalized.length - 1; p++) {
    const prev = normalized[p - 1];
    const cur = normalized[p];
    const next = normalized[p + 1];

    if (cur.val >= threshold && cur.val > prev.val && cur.val >= next.val) {
      if (cur.time - lastBeatTime >= minGap) {
        beatTimes.push(Number(cur.time.toFixed(3)));
        lastBeatTime = cur.time;
      }
    }
  }

  // 5. Estimate BPM from Median Interval
  let estimatedBPM = 120;
  if (beatTimes.length >= 2) {
    const intervals: number[] = [];
    for (let b = 1; b < beatTimes.length; b++) {
      intervals.push(beatTimes[b] - beatTimes[b - 1]);
    }
    intervals.sort((a, b) => a - b);
    const medianInterval = intervals[Math.floor(intervals.length / 2)];

    if (medianInterval > 0) {
      estimatedBPM = Math.round(60.0 / medianInterval);
      while (estimatedBPM > 180) estimatedBPM = Math.round(estimatedBPM / 2);
      while (estimatedBPM < 60) estimatedBPM = Math.round(estimatedBPM * 2);
    }
  }

  return {
    detectedBeats: beatTimes.length,
    estimatedBPM,
    beatTimes,
    threshold: Number(threshold.toFixed(3)),
    mean: Number(mean.toFixed(3)),
    stdDev: Number(stdDev.toFixed(3))
  };
}
