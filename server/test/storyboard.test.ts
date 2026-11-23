import { describe, it, expect } from "vitest";
import { storyboardSchema, STORYBOARD_EXAMPLE } from "../src/director/storyboard.js";

describe("Storyboard Validation", () => {
  it("validates the built-in example storyboard", () => {
    const parsed = storyboardSchema.parse(STORYBOARD_EXAMPLE);
    expect(parsed.title).toBe("NOVA X — Product Debut");
    expect(parsed.scenes.length).toBe(3);
    expect(parsed.width).toBe(1920);
    expect(parsed.height).toBe(1080);
  });

  it("validates multi-scene storyboard with transitions and effects", () => {
    const customSb = {
      title: "Hype Reel",
      width: 1080,
      height: 1920,
      frameRate: 30,
      look: "action",
      scenes: [
        {
          type: "title",
          duration: 3.5,
          content: {
            text: "BREAK THE LIMITS",
            preset: "stomp"
          },
          effects: [
            {
              kind: "lightEffect",
              name: "lightSweep",
              options: { speed: 1.5 }
            }
          ]
        },
        {
          type: "footage",
          duration: 5.0,
          transitionIn: { type: "flash", duration: 0.4 },
          content: {
            itemId: 42,
            sourceIn: 1.0
          }
        }
      ]
    };

    const parsed = storyboardSchema.parse(customSb);
    expect(parsed.scenes[0].type).toBe("title");
    expect(parsed.scenes[1].transitionIn?.type).toBe("flash");
  });

  it("rejects storyboard with empty scenes", () => {
    expect(() => storyboardSchema.parse({ title: "Empty", scenes: [] })).toThrow();
  });

  it("rejects invalid scene types", () => {
    expect(() =>
      storyboardSchema.parse({
        title: "Invalid",
        scenes: [{ type: "unknownType", duration: 5 }]
      })
    ).toThrow();
  });
});
