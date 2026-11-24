/**
 * Motion Curve and Easing conversion utilities for AE Bridge.
 * Translates high-level animation curves into After Effects keyframe speed & influence parameters.
 */

export type MotionCurveName =
  | "expoOut"
  | "expoInOut"
  | "quintOut"
  | "backOut"
  | "snap"
  | "smooth"
  | "heavy"
  | "elasticOut"
  | "linear";

export interface CurveEasingDefinition {
  name: MotionCurveName;
  inInfluence: number;
  outInfluence: number;
  inSpeed: number;
  outSpeed: number;
  description: string;
  hasOvershoot?: boolean;
  overshootFactor?: number;
  overshootTimeRatio?: number;
  usesRig?: boolean;
  rigType?: "elastic" | "bounce" | "spring";
}

export const MOTION_CURVES: Record<MotionCurveName, CurveEasingDefinition> = {
  linear: {
    name: "linear",
    inInfluence: 0.1,
    outInfluence: 0.1,
    inSpeed: 0,
    outSpeed: 0,
    description: "Constant velocity with no acceleration or deceleration"
  },
  smooth: {
    name: "smooth",
    inInfluence: 60,
    outInfluence: 60,
    inSpeed: 0,
    outSpeed: 0,
    description: "Gentle natural ease in and out"
  },
  expoOut: {
    name: "expoOut",
    inInfluence: 88,
    outInfluence: 16,
    inSpeed: 0,
    outSpeed: 0,
    description: "Rapid explosive burst decaying exponentially into destination"
  },
  expoInOut: {
    name: "expoInOut",
    inInfluence: 85,
    outInfluence: 85,
    inSpeed: 0,
    outSpeed: 0,
    description: "Exponential ramp up, fast midpoint transit, exponential soft settle"
  },
  quintOut: {
    name: "quintOut",
    inInfluence: 78,
    outInfluence: 22,
    inSpeed: 0,
    outSpeed: 0,
    description: "Strong power-5 deceleration for snappy, refined UI feel"
  },
  snap: {
    name: "snap",
    inInfluence: 96,
    outInfluence: 10,
    inSpeed: 0,
    outSpeed: 0,
    description: "Hyper-fast arrival with prolonged micro-settling friction"
  },
  heavy: {
    name: "heavy",
    inInfluence: 35,
    outInfluence: 82,
    inSpeed: 0,
    outSpeed: 0,
    description: "Slow inertia-rich departure with weighted solid landing"
  },
  backOut: {
    name: "backOut",
    inInfluence: 72,
    outInfluence: 40,
    inSpeed: 0,
    outSpeed: 0,
    description: "Dynamic arrival that overshoots target slightly and bounces back to rest",
    hasOvershoot: true,
    overshootFactor: 0.08,
    overshootTimeRatio: 0.72
  },
  elasticOut: {
    name: "elasticOut",
    inInfluence: 68,
    outInfluence: 28,
    inSpeed: 0,
    outSpeed: 0,
    description: "Spring-like decaying oscillation via motion rig or harmonic decay",
    usesRig: true,
    rigType: "elastic"
  }
};

/**
 * Clamp influence percentage to After Effects limits (0.1 to 100).
 */
export function clampInfluence(value: number): number {
  if (isNaN(value)) return 50;
  return Math.max(0.1, Math.min(100, Math.round(value * 10) / 10));
}

/**
 * Get curve easing definition by name.
 */
export function getCurveEasing(name: string): CurveEasingDefinition {
  const norm = name.trim() as MotionCurveName;
  if (norm in MOTION_CURVES) {
    return MOTION_CURVES[norm];
  }
  // Case-insensitive fallback
  const lower = norm.toLowerCase();
  for (const [key, def] of Object.entries(MOTION_CURVES)) {
    if (key.toLowerCase() === lower) {
      return def;
    }
  }
  return MOTION_CURVES.smooth;
}

/**
 * Check if a string is a valid motion curve name.
 */
export function isValidCurve(name: string): boolean {
  const lower = name.trim().toLowerCase();
  return Object.keys(MOTION_CURVES).some((k) => k.toLowerCase() === lower);
}

/**
 * Calculates overshoot keyframe values for backOut motion.
 * Works on scalar numbers or multi-dimensional numerical arrays (e.g. 2D/3D coordinates).
 */
export function computeBackOutOvershoot(
  startVal: number | number[],
  endVal: number | number[],
  overshootFactor: number = 0.08
): number | number[] {
  if (Array.isArray(startVal) && Array.isArray(endVal)) {
    const len = Math.min(startVal.length, endVal.length);
    const result: number[] = [];
    for (let i = 0; i < len; i++) {
      const s = Number(startVal[i]) || 0;
      const e = Number(endVal[i]) || 0;
      const diff = e - s;
      result.push(e + diff * overshootFactor);
    }
    return result;
  }

  const s = Number(startVal) || 0;
  const e = Number(endVal) || 0;
  return e + (e - s) * overshootFactor;
}
