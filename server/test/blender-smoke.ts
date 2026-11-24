import fs from "fs";
import { findBlenderExecutable } from "../src/blender/locator.js";
import { runBlenderSyncJob } from "../src/blender/jobs.js";
import type { SceneSpec } from "../src/blender/spec.js";

async function runSmokeTest(): Promise<void> {
  console.log("[test:blender] Starting Blender smoke test probe...");

  const blenderBin = findBlenderExecutable();
  if (!blenderBin) {
    console.log("[test:blender] Blender executable not detected on this system. Skipping smoke test.");
    process.exit(0);
  }

  console.log(`[test:blender] Found Blender executable at: ${blenderBin}`);

  const tinySpec: SceneSpec = {
    frames: { start: 1, end: 1, fps: 24 },
    resolution: [320, 180],
    engine: "eevee",
    quality: "preview",
    lighting: "studioDramatic",
    objects: [
      {
        id: "Smoke_Cube",
        kind: "primitive",
        params: { primitive: "roundedCube", size: 1.0 },
        material: { preset: "chrome" }
      }
    ],
    camera: {
      lens: 50.0,
      sensorWidth: 36.0,
      move: "pushIn",
      curve: "smooth"
    },
    passes: [],
    exportCamera: false
  };

  try {
    const job = await runBlenderSyncJob(
      tinySpec,
      "preview",
      { frame: 1, maxWidth: 320 },
      60000
    );

    const imgPath = job.outputPaths?.previewPath;
    if (!imgPath || !fs.existsSync(imgPath)) {
      throw new Error(`Smoke test preview image not found at: ${imgPath}`);
    }

    const stat = fs.statSync(imgPath);
    if (stat.size === 0) {
      throw new Error(`Smoke test preview image is 0 bytes: ${imgPath}`);
    }

    console.log("=================================================");
    console.log("✓ Blender Smoke Test PASSED!");
    console.log(`  Blender Version : ${job.blenderVersion || "5.3+"}`);
    console.log(`  Engine           : ${job.engine || "BLENDER_EEVEE"}`);
    console.log(`  Compute Device   : ${job.hardware?.device_name || "GPU/CPU"} (${job.hardware?.device_type || "EEVEE"})`);
    console.log(`  Render Output    : ${imgPath} (${stat.size} bytes)`);
    console.log("=================================================");
    process.exit(0);
  } catch (err: any) {
    console.error("[test:blender] Smoke test failed:", err.message);
    process.exit(1);
  }
}

runSmokeTest();
