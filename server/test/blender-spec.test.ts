import { describe, it, expect } from "vitest";
import {
  sceneSpecSchema,
  materialPresetEnum,
  cameraMoveEnum,
  physicsPresetEnum,
  type SceneSpec
} from "../src/blender/spec.js";

describe("Blender SceneSpec Schema Validation", () => {
  it("validates a minimal SceneSpec and applies sensible defaults", () => {
    const rawSpec = {
      objects: [
        {
          id: "Cube_Hero",
          kind: "primitive",
          params: { primitive: "cube", size: 1.5 },
          material: { preset: "chrome" }
        }
      ]
    };

    const parsed: SceneSpec = sceneSpecSchema.parse(rawSpec);
    expect(parsed.frames.start).toBe(1);
    expect(parsed.frames.end).toBe(90);
    expect(parsed.frames.fps).toBe(30);
    expect(parsed.resolution).toEqual([1920, 1080]);
    expect(parsed.engine).toBe("eevee");
    expect(parsed.quality).toBe("final");
    expect(parsed.camera.lens).toBe(50.0);
    expect(parsed.camera.sensorWidth).toBe(36.0);
    expect(parsed.camera.move).toBe("pushIn");
    expect(parsed.exportCamera).toBe(true);
    expect(parsed.objects.length).toBe(1);
  });

  it("validates all 14 PBR material presets", () => {
    const validPresets = [
      "chrome",
      "gold",
      "brushedAluminum",
      "glass",
      "frostedGlass",
      "glossyPlastic",
      "matteClay",
      "ceramic",
      "rubber",
      "carbonFiber",
      "holographic",
      "neonEmission",
      "liquidMetal",
      "marble"
    ];

    for (const preset of validPresets) {
      expect(materialPresetEnum.safeParse(preset).success).toBe(true);
    }

    expect(materialPresetEnum.safeParse("unsupportedShading").success).toBe(false);
  });

  it("validates all 9 camera moves", () => {
    const validMoves = [
      "orbit",
      "orbitHalf",
      "pushIn",
      "pullOut",
      "craneUp",
      "flyThrough",
      "turntable",
      "heroReveal",
      "dollyZoom"
    ];

    for (const move of validMoves) {
      expect(cameraMoveEnum.safeParse(move).success).toBe(true);
    }

    expect(cameraMoveEnum.safeParse("randomTwist").success).toBe(false);
  });

  it("validates all 5 physics simulation presets", () => {
    const validPhysics = [
      "dropAndBounce",
      "shatter",
      "clothReveal",
      "windFlag",
      "scatterFall"
    ];

    for (const p of validPhysics) {
      expect(physicsPresetEnum.safeParse(p).success).toBe(true);
    }
  });

  it("rejects invalid specifications", () => {
    // Negative resolution
    expect(() => {
      sceneSpecSchema.parse({ resolution: [-1920, 1080] });
    }).toThrow();

    // Invalid engine
    expect(() => {
      sceneSpecSchema.parse({ engine: "octane" });
    }).toThrow();
  });
});
