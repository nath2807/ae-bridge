import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { spawn, type ChildProcess } from "child_process";
import { findBlenderExecutable, getBlenderRendersDir } from "./locator.js";
import type { SceneSpec } from "./spec.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface JobProgress {
  done: number;
  total: number;
  percent: number;
}

export interface JobRecord {
  id: string;
  action: "render" | "preview" | "save_blend" | "status";
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  progress: JobProgress;
  outputDir: string;
  outputPaths: {
    colorDir?: string;
    depthDir?: string;
    cameraJson?: string;
    previewPath?: string;
    blendPath?: string;
  };
  hardware?: {
    device_type?: string;
    device_name?: string;
    count?: number;
  };
  engine?: string;
  blenderVersion?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string | null;
  pid?: number;
}

interface ActiveProcessInfo {
  job: JobRecord;
  process: ChildProcess;
}

const activeJobs = new Map<string, ActiveProcessInfo>();

export function getJobsStorageDir(): string {
  const dir = path.join(os.homedir(), ".ae-bridge", "jobs");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function saveJobToDisk(job: JobRecord): void {
  try {
    const filePath = path.join(getJobsStorageDir(), `${job.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(job, null, 2), "utf-8");
  } catch (err) {
    console.error(`[ae-bridge] Error persisting job ${job.id}:`, err);
  }
}

export function getJobRecord(jobId: string): JobRecord | null {
  const active = activeJobs.get(jobId);
  if (active) {
    return active.job;
  }

  const filePath = path.join(getJobsStorageDir(), `${jobId}.json`);
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf-8")) as JobRecord;
    } catch {}
  }
  return null;
}

export function getBlenderRunnerScriptPath(): string {
  const candidates = [
    path.resolve(process.cwd(), "blender", "runner.py"),
    path.resolve(__dirname, "../../../blender/runner.py"),
    path.resolve(__dirname, "../../blender/runner.py")
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c.replace(/\\/g, "/");
    }
  }
  return path.resolve(process.cwd(), "blender", "runner.py").replace(/\\/g, "/");
}

export function startBlenderJob(
  spec: SceneSpec,
  action: "render" | "preview" | "save_blend" | "status" = "render",
  options: {
    frame?: number;
    maxWidth?: number;
    blendPath?: string;
    customOutputDir?: string;
  } = {}
): JobRecord {
  const blenderExe = findBlenderExecutable();
  if (!blenderExe) {
    throw new Error(
      "Blender executable not found. Please install Blender 4.2+ or set path via blender_set_path or BLENDER_PATH environment variable."
    );
  }

  const runnerScript = getBlenderRunnerScriptPath();
  if (!fs.existsSync(runnerScript)) {
    throw new Error(`Blender runner script not found at: ${runnerScript}`);
  }

  const randId = Math.random().toString(36).slice(2, 9);
  const jobId = `job_${Date.now()}_${randId}`;
  const outputDir = (options.customOutputDir || path.join(getBlenderRendersDir(), jobId)).replace(/\\/g, "/");
  fs.mkdirSync(outputDir, { recursive: true });

  const jobJsonPath = path.join(outputDir, "job.json").replace(/\\/g, "/");
  const jobPayload = {
    id: jobId,
    action,
    spec,
    outputDir,
    frame: options.frame,
    maxWidth: options.maxWidth,
    blendPath: options.blendPath
  };
  fs.writeFileSync(jobJsonPath, JSON.stringify(jobPayload, null, 2), "utf-8");

  const totalFrames = (spec.frames && spec.frames.end && spec.frames.start)
    ? Math.max(1, spec.frames.end - spec.frames.start + 1)
    : 1;

  const job: JobRecord = {
    id: jobId,
    action,
    status: "running",
    progress: { done: 0, total: totalFrames, percent: 0 },
    outputDir,
    outputPaths: {},
    createdAt: Date.now(),
    startedAt: Date.now()
  };

  saveJobToDisk(job);

  const proc = spawn(
    blenderExe,
    ["-b", "--factory-startup", "-P", runnerScript, "--", jobJsonPath],
    {
      cwd: path.dirname(runnerScript),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    }
  );

  job.pid = proc.pid;
  activeJobs.set(jobId, { job, process: proc });

  let stdoutBuffer = "";

  proc.stdout.on("data", (chunk: Buffer) => {
    stdoutBuffer += chunk.toString();
    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("AEB_PROGRESS")) {
        const parts = line.replace("AEB_PROGRESS", "").trim().split("/");
        if (parts.length === 2) {
          const done = parseInt(parts[0], 10) || 0;
          const total = parseInt(parts[1], 10) || 1;
          job.progress = {
            done,
            total,
            percent: Math.min(100, Math.round((done / total) * 100))
          };
          saveJobToDisk(job);
        }
      } else if (line.startsWith("AEB_RESULT")) {
        try {
          const resultJson = JSON.parse(line.replace("AEB_RESULT", "").trim());
          if (resultJson.ok) {
            job.status = "completed";
            job.completedAt = Date.now();
            job.progress.percent = 100;
            job.progress.done = job.progress.total;
            job.outputPaths = {
              colorDir: resultJson.colorDir,
              depthDir: resultJson.depthDir,
              cameraJson: resultJson.cameraJson,
              previewPath: resultJson.previewPath,
              blendPath: resultJson.blendPath
            };
            job.hardware = resultJson.hardware;
            job.engine = resultJson.engine;
            job.blenderVersion = resultJson.blenderVersion;
          } else {
            job.status = "failed";
            job.completedAt = Date.now();
            job.error = resultJson.error || "Blender task failed";
            job.blenderVersion = resultJson.blenderVersion;
          }
          saveJobToDisk(job);
        } catch (err) {
          console.error("[ae-bridge] Failed to parse AEB_RESULT line:", line, err);
        }
      }
    }
  });

  proc.stderr.on("data", (chunk: Buffer) => {
    // Collect stderr warnings without failing job prematurely
  });

  proc.on("close", (code) => {
    if (job.status === "running") {
      if (code === 0) {
        job.status = "completed";
      } else {
        job.status = "failed";
        job.error = job.error || `Blender process exited with code ${code}`;
      }
      job.completedAt = Date.now();
      saveJobToDisk(job);
    }
    activeJobs.delete(jobId);
  });

  proc.on("error", (err) => {
    job.status = "failed";
    job.error = err.message;
    job.completedAt = Date.now();
    saveJobToDisk(job);
    activeJobs.delete(jobId);
  });

  return job;
}

export async function runBlenderSyncJob(
  spec: SceneSpec,
  action: "render" | "preview" | "save_blend" | "status" = "preview",
  options: {
    frame?: number;
    maxWidth?: number;
    blendPath?: string;
  } = {},
  timeoutMs = 180000
): Promise<JobRecord> {
  const job = startBlenderJob(spec, action, options);

  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const current = getJobRecord(job.id);
      if (!current) {
        clearInterval(interval);
        return reject(new Error(`Job ${job.id} disappeared from queue.`));
      }

      if (current.status === "completed") {
        clearInterval(interval);
        return resolve(current);
      }

      if (current.status === "failed" || current.status === "cancelled") {
        clearInterval(interval);
        return reject(new Error(current.error || `Blender job failed with status: ${current.status}`));
      }

      if (Date.now() - startTime > timeoutMs) {
        clearInterval(interval);
        cancelBlenderJob(job.id);
        return reject(new Error(`Timed out after ${timeoutMs}ms waiting for Blender job ${job.id}`));
      }
    }, 250);
  });
}

export function cancelBlenderJob(jobId: string): boolean {
  const active = activeJobs.get(jobId);
  if (!active) {
    const job = getJobRecord(jobId);
    if (job && job.status === "running") {
      job.status = "cancelled";
      saveJobToDisk(job);
      return true;
    }
    return false;
  }

  try {
    active.process.kill("SIGTERM");
  } catch {}

  active.job.status = "cancelled";
  active.job.completedAt = Date.now();
  saveJobToDisk(active.job);
  activeJobs.delete(jobId);
  return true;
}
