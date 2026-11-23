import { describe, it, expect } from "vitest";
import { colorSchema, compRefSchema, layerRefSchema } from "../src/tools/schemas.js";
import { brandKitSchema } from "../src/director/brand.js";

describe("Core Zod Schemas", () => {
  it("validates hex color strings", () => {
    expect(colorSchema.parse("#00E5FF")).toBe("#00E5FF");
    expect(colorSchema.parse("#fff")).toBe("#fff");
    expect(colorSchema.parse("#123456")).toBe("#123456");
  });

  it("validates RGB color arrays", () => {
    expect(colorSchema.parse([0.1, 0.5, 0.9])).toEqual([0.1, 0.5, 0.9]);
    expect(colorSchema.parse([255, 128, 0])).toEqual([255, 128, 0]);
  });

  it("rejects invalid color inputs", () => {
    expect(() => colorSchema.parse("not-a-color")).toThrow();
    expect(() => colorSchema.parse([1, 2])).toThrow();
  });

  it("validates comp references", () => {
    expect(compRefSchema.parse({ compId: 10 })).toEqual({ compId: 10 });
    expect(compRefSchema.parse({ compName: "Main Comp" })).toEqual({ compName: "Main Comp" });
  });

  it("validates layer references", () => {
    expect(layerRefSchema.parse({ layerIndex: 1 })).toEqual({ layerIndex: 1 });
    expect(layerRefSchema.parse({ layerName: "Text Layer" })).toEqual({ layerName: "Text Layer" });
  });

  it("validates full brand kit configuration", () => {
    const validKit = {
      name: "Cyber Motion",
      colors: {
        primary: "#00E5FF",
        secondary: "#FF148C",
        accent: "#D4AF37",
        background: "#05060A",
        text: "#F5F5F7"
      },
      fonts: {
        heading: "Montserrat-Bold",
        body: "Inter-Regular"
      },
      style: "tech"
    };

    const parsed = brandKitSchema.parse(validKit);
    expect(parsed.name).toBe("Cyber Motion");
    expect(parsed.style).toBe("tech");
  });
});
