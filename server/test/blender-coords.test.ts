import { describe, it, expect } from "vitest";

/**
 * Pure coordinate conversion function mirroring export_camera.py logic.
 */
function blenderToAfterEffectsCoords(
  blenderPos: [number, number, number],
  compWidth = 1920,
  compHeight = 1080,
  scalePxPerM = 100.0
): [number, number, number] {
  const [bx, by, bz] = blenderPos;
  // Blender: +X Right, +Y Forward, +Z Up (meters)
  // After Effects: +X Right, +Y Down, +Z Forward (pixels, origin at comp center)
  const aeX = ((compWidth / 2.0) + (bx * scalePxPerM)) || 0;
  const aeY = ((compHeight / 2.0) - (bz * scalePxPerM)) || 0;
  const aeZ = (-(by * scalePxPerM)) || 0;
  return [
    Math.round(aeX * 100) / 100 || 0,
    Math.round(aeY * 100) / 100 || 0,
    Math.round(aeZ * 100) / 100 || 0
  ];
}

function computeAeCameraZoom(
  compWidth = 1920,
  sensorWidth = 36.0,
  focalLength = 50.0
): number {
  return Math.round(((compWidth / sensorWidth) * focalLength) * 100) / 100;
}

describe("Blender to After Effects 3D Coordinate Conversion", () => {
  it("converts world origin (0, 0, 0) to After Effects comp center", () => {
    const aeCoords = blenderToAfterEffectsCoords([0, 0, 0], 1920, 1080, 100);
    expect(aeCoords).toEqual([960, 540, 0]);
  });

  it("converts +X lateral movement to positive AE X pixels", () => {
    // 2.5 meters to the right
    const aeCoords = blenderToAfterEffectsCoords([2.5, 0, 0], 1920, 1080, 100);
    expect(aeCoords[0]).toBe(960 + 250);
    expect(aeCoords[1]).toBe(540);
    expect(aeCoords[2]).toBe(0);
  });

  it("converts +Z vertical elevation in Blender to negative AE Y (upward in comp)", () => {
    // 1.8 meters up in Blender
    const aeCoords = blenderToAfterEffectsCoords([0, 0, 1.8], 1920, 1080, 100);
    expect(aeCoords[0]).toBe(960);
    expect(aeCoords[1]).toBe(540 - 180); // 360
    expect(aeCoords[2]).toBe(0);
  });

  it("converts +Y forward depth in Blender to negative AE Z (towards scene)", () => {
    // 3.0 meters forward in Blender
    const aeCoords = blenderToAfterEffectsCoords([0, 3.0, 0], 1920, 1080, 100);
    expect(aeCoords[0]).toBe(960);
    expect(aeCoords[1]).toBe(540);
    expect(aeCoords[2]).toBe(-300);
  });

  it("accurately calculates AE camera zoom in pixels from focal length and sensor width", () => {
    // Standard 50mm on 36mm sensor on 1080p comp
    const zoom50 = computeAeCameraZoom(1920, 36.0, 50.0);
    expect(zoom50).toBe(2666.67);

    // 85mm portrait telephoto
    const zoom85 = computeAeCameraZoom(1920, 36.0, 85.0);
    expect(zoom85).toBe(4533.33);

    // 24mm wide angle
    const zoom24 = computeAeCameraZoom(1920, 36.0, 24.0);
    expect(zoom24).toBe(1280.0);
  });
});
