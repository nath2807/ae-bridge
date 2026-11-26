import fs from "fs";
import path from "path";

// A mock runner simulating aerender process output
console.log("aerender version 24.2.0x12");
console.log("PROGRESS: 0:00:00:00 (1): 0 Seconds");
console.log("PROGRESS: Frame 1 of 10");

setTimeout(() => {
  console.log("PROGRESS: Frame 5 of 10");
  setTimeout(() => {
    console.log("PROGRESS: Frame 10 of 10");
    console.log("Finished composition.");
    process.exit(0);
  }, 100);
}, 100);
