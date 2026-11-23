import { describe, it, expect } from "vitest";
import { loadAllRecipes, getRecipeByName } from "../src/director/recipes.js";

describe("Recipes Catalog and Templating", () => {
  it("loads all 12 original video production recipes", () => {
    const recipes = loadAllRecipes();
    expect(recipes.length).toBe(12);

    const recipeNames = recipes.map((r) => r.name);
    expect(recipeNames).toContain("youtubeIntro");
    expect(recipeNames).toContain("logoReveal");
    expect(recipeNames).toContain("productLaunch");
    expect(recipeNames).toContain("hypePromo");
    expect(recipeNames).toContain("socialAd15s");
    expect(recipeNames).toContain("kineticTypography");
    expect(recipeNames).toContain("eventRecap");
    expect(recipeNames).toContain("cinematicTrailer");
    expect(recipeNames).toContain("slideshow");
    expect(recipeNames).toContain("countdown");
    expect(recipeNames).toContain("tutorialIntro");
    expect(recipeNames).toContain("lowerThirdPack");
  });

  it("retrieves specific recipe by name case-insensitively", () => {
    const r1 = getRecipeByName("productlaunch");
    expect(r1).not.toBeNull();
    expect(r1?.duration).toBe(15);

    const r2 = getRecipeByName("YouTubeIntro");
    expect(r2).not.toBeNull();
    expect(r2?.duration).toBe(5);
  });

  it("contains input definitions and storyboards in every recipe", () => {
    const recipes = loadAllRecipes();
    for (const r of recipes) {
      expect(typeof r.name).toBe("string");
      expect(typeof r.description).toBe("string");
      expect(typeof r.duration).toBe("number");
      expect(r.inputs).toBeDefined();
      expect(r.storyboard).toBeDefined();
      expect(Array.isArray(r.storyboard.scenes)).toBe(true);
      expect(r.storyboard.scenes.length).toBeGreaterThan(0);
    }
  });
});
