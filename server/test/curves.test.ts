import { describe, it, expect } from "vitest";
import {
  MOTION_CURVES,
  getCurveEasing,
  isValidCurve,
  clampInfluence,
  computeBackOutOvershoot,
  type MotionCurveName
} from "../src/utils/curves.js";

describe("Motion Curves and Keyframe Easing Utility", () => {
  const expectedCurves: MotionCurveName[] = [
    "expoOut",
    "expoInOut",
    "quintOut",
    "backOut",
    "snap",
    "smooth",
    "heavy",
    "elasticOut",
    "linear"
  ];

  it("contains all 9 required motion curves with valid parameters", () => {
    for (const name of expectedCurves) {
      expect(isValidCurve(name)).toBe(true);
      const curve = getCurveEasing(name);
      expect(curve.name).toBe(name);
      expect(curve.inInfluence).toBeGreaterThanOrEqual(0.1);
      expect(curve.inInfluence).toBeLessThanOrEqual(100);
      expect(curve.outInfluence).toBeGreaterThanOrEqual(0.1);
      expect(curve.outInfluence).toBeLessThanOrEqual(100);
      expect(typeof curve.description).toBe("string");
    }
  });

  it("identifies case-insensitive curve names and falls back safely", () => {
    expect(getCurveEasing("EXPOOUT").name).toBe("expoOut");
    expect(getCurveEasing("  Snap  ").name).toBe("snap");
    expect(getCurveEasing("nonExistentCurve").name).toBe("smooth");
  });

  it("clamps influence properly to [0.1, 100]", () => {
    expect(clampInfluence(-10)).toBe(0.1);
    expect(clampInfluence(0)).toBe(0.1);
    expect(clampInfluence(75.46)).toBe(75.5);
    expect(clampInfluence(120)).toBe(100);
    expect(clampInfluence(NaN)).toBe(50);
  });

  it("calculates overshoot for backOut curves on scalar and array values", () => {
    // Scalar overshoot from 0 to 100 with 10% factor
    const scalarVal = computeBackOutOvershoot(0, 100, 0.1);
    expect(scalarVal).toBe(110);

    // Negative movement from 200 to 100
    const negVal = computeBackOutOvershoot(200, 100, 0.08);
    expect(negVal).toBe(92);

    // Array / 2D coordinates: [0, 0] to [1920, 1080] with 8% overshoot
    const arrVal = computeBackOutOvershoot([0, 0], [1000, 500], 0.08) as number[];
    expect(arrVal[0]).toBe(1080);
    expect(arrVal[1]).toBe(540);
  });

  it("identifies backOut as having overshoot and elasticOut as using rig", () => {
    const backOut = getCurveEasing("backOut");
    expect(backOut.hasOvershoot).toBe(true);
    expect(backOut.overshootFactor).toBeGreaterThan(0);

    const elasticOut = getCurveEasing("elasticOut");
    expect(elasticOut.usesRig).toBe(true);
    expect(elasticOut.rigType).toBe("elastic");
  });
});
