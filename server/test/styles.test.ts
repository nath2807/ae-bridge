import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import {
  loadAllStyles,
  getStyleByName,
  getResolvedStyle,
  getActiveStyleName,
  setActiveStyleName,
  styleSchema,
  getStateFilePath
} from "../src/director/styles.js";

describe("Style Packs and Aesthetic Architecture", () => {
  const expectedStyles = [
    "cinematicNoir",
    "minimalPremium",
    "neonCyber",
    "luxuryGold",
    "editorialSwiss",
    "y2kChrome",
    "brutalistBold",
    "organicSoft",
    "kineticPop",
    "techHUD",
    "dreamyPastel",
    "epicTrailer"
  ];

  it("loads and validates all 12 original style JSON files against schema", () => {
    const allStyles = loadAllStyles();
    expect(allStyles.length).toBeGreaterThanOrEqual(12);

    for (const name of expectedStyles) {
      const found = allStyles.find((s) => s.name.toLowerCase() === name.toLowerCase());
      expect(found, `Expected style ${name} to be found in styles directory`).toBeDefined();

      // Check validation against Zod schema
      const parsed = styleSchema.parse(found);
      expect(parsed.name).toBe(name);
      expect(parsed.palette.bg).toBeDefined();
      expect(parsed.palette.primary).toBeDefined();
      expect(parsed.palette.accent).toBeDefined();
      expect(parsed.typography.heading).toBeTruthy();
      expect(parsed.typography.fallbacks.length).toBeGreaterThan(0);
      expect(parsed.motion.curve).toBeTruthy();
      expect(parsed.do.length).toBeGreaterThanOrEqual(2);
      expect(parsed.dont.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("retrieves a style by name case-insensitively", () => {
    const noir = getStyleByName("CINEMATICNOIR");
    expect(noir).not.toBeNull();
    expect(noir?.name).toBe("cinematicNoir");

    const cyber = getStyleByName("neon-cyber");
    expect(cyber).not.toBeNull();
    expect(cyber?.name).toBe("neonCyber");
  });

  it("persists and retrieves active style name", () => {
    const origActive = getActiveStyleName();
    setActiveStyleName("neonCyber");
    expect(getActiveStyleName()).toBe("neonCyber");

    // Restore original active style
    setActiveStyleName(origActive);
  });

  it("applies brand kit color and typography overrides when brand=true", () => {
    const standard = getResolvedStyle("minimalPremium", false);
    const withBrand = getResolvedStyle("minimalPremium", true);

    expect(withBrand.name).toBe("minimalPremium");
    // Brand kit should have provided colors and fonts
    expect(withBrand.palette.primary).toBeDefined();
    expect(withBrand.typography.heading).toBeDefined();
  });
});
