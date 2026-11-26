import fs from "fs";
import path from "path";
import { spawn, type ChildProcess } from "child_process";
import { getAeBridgeHome } from "../utils/paths.js";
import { findAerenderExecutable } from "./locator.js";

export interface RenderJobProgress {
  currentFrame: number;
  totalFrames: number;
  percent: number;
}

export interface RenderJobRecord {
  id: string;
  compName: string;
  projectPath?: string;
  outputPath: string;
  preset?: string;
  outputTemplate?: string;
  renderSettingsTemplate?: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  progress: RenderJobProgress;
  pid?: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  exitCode?: number | null;
  error?: string | null;
  logTail: string[];
}

interface ActiveRenderInfo {
  job: RenderJobRecord;
  process: ChildProcess;
}

const activeProcesses = new Map<string, ActiveRenderInfo>();

function getJobsFilePath(): string {
  return path.join(getAeBridgeHome(), "render_jobs.json");
}

export function loadAllRenderJobs(): Record<string, RenderJobRecord> {
  const filePath = getJobsFilePath();
  if (!fs.existsSync(filePath)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);
    return data.jobs || {};
  } catch {
    return {};
  }
}

export function saveRenderJob(job: RenderJobRecord): void {
  const filePath = getJobsFilePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  try {
    const all = loadAllRenderJobs();
    all[job.id] = job;
    fs.writeFileSync(filePath, JSON.stringify({ jobs: all }, null, 2), "utf-8");
  } catch (err) {
    console.error(`[ae-bridge] Error persisting render job ${job.id}:`, err);
  }
}

export function getRenderJob(jobId: string): RenderJobRecord | null {
  const active = activeProcesses.get(jobId);
  if (active) {
    return active.job;
  }
  const all = loadAllRenderJobs();
  return all[jobId] || null;
}

export function listRenderJobs(limit = 20, statusFilter?: string): RenderJobRecord[] {
  const all = loadAllRenderJobs();
  // Merge live status from activeProcesses
  for (const [id, active] of activeProcesses.entries()) {
    all[id] = active.job;
  }

  let list = Object.values(all).sort((a, b) => b.createdAt - a.createdAt);

  if (statusFilter) {
    list = list.filter((j) => j.status === statusFilter);
  }

  return list.slice(0, limit);
}

export interface StartRenderJobOptions {
  compName: string;
  projectPath?: string;
  outputPath: string;
  preset?: string;
  outputTemplate?: string;
  renderSettingsTemplate?: string;
  startFrame?: number;
  endFrame?: number;
}

export function startRenderJob(options: StartRenderJobOptions): RenderJobRecord {
  const aerenderPath = findAerenderExecutable();
  if (!aerenderPath) {
    throw new Error(
      "aerender executable not found. Please ensure Adobe After Effects is installed or set the AERENDER_PATH environment variable."
    );
  }

  const jobId = `render_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const totalFramesEstimate =
    options.startFrame !== undefined && options.endFrame !== undefined
      ? Math.max(1, options.endFrame - options.startFrame + 1)
      : 100;

  const job: RenderJobRecord = {
    id: jobId,
    compName: options.compName,
    projectPath: options.projectPath,
    outputPath: options.outputPath,
    preset: options.preset,
    outputTemplate: options.outputTemplate,
    renderSettingsTemplate: options.renderSettingsTemplate,
    status: "queued",
    progress: {
      currentFrame: 0,
      totalFrames: totalFramesEstimate,
      percent: 0
    },
    createdAt: Date.now(),
    logTail: []
  };

  saveRenderJob(job);

  // Build command arguments
  const args: string[] = ["-comp", options.compName, "-output", options.outputPath];

  if (options.projectPath) {
    args.push("-project", options.projectPath);
  }
  if (options.outputTemplate) {
    args.push("-OMtemplate", options.outputTemplate);
  }
  if (options.renderSettingsTemplate) {
    args.push("-RStemplate", options.renderSettingsTemplate);
  }
  if (options.startFrame !== undefined) {
    args.push("-s", String(options.startFrame));
  }
  if (options.endFrame !== undefined) {
    args.push("-e", String(options.endFrame));
  }

  const isBatch = process.platform === "win32" && /\.(bat|cmd)$/i.test(aerenderPath);
  const spawnExe = isBatch ? (process.env.ComSpec || "cmd.exe") : aerenderPath;
  const spawnArgs = isBatch ? ["/d", "/s", "/c", aerenderPath, ...args] : args;

  const child = spawn(spawnExe, spawnArgs, {
    shell: false,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });

  job.status = "running";
  job.startedAt = Date.now();
  job.pid = child.pid;
  activeProcesses.set(jobId, { job, process: child });
  saveRenderJob(job);

  const appendLog = (line: string) => {
    job.logTail.push(line);
    if (job.logTail.length > 50) {
      job.logTail.shift();
    }
  };

  const handleOutput = (chunk: Buffer) => {
    const text = chunk.toString();
    const lines = text.split(/\r?\n/).filter(Boolean);

    for (const line of lines) {
      appendLog(line);

      // Parse progress: PROGRESS: 0:00:05:12 (142): 1 Seconds OR Frame 42 of 300
      const frameMatch = line.match(/\((\d+)\)/) || line.match(/frame\s*(\d+)(?:\s*of\s*(\d+))?/i);
      if (frameMatch) {
        const frameNum = parseInt(frameMatch[1], 10);
        if (!isNaN(frameNum)) {
          job.progress.currentFrame = frameNum;
          if (frameMatch[2]) {
            const tot = parseInt(frameMatch[2], 10);
            if (!isNaN(tot) && tot > 0) {
              job.progress.totalFrames = tot;
            }
          }
          if (job.progress.totalFrames > 0) {
            job.progress.percent = Math.min(
              99,
              Math.round((job.progress.currentFrame / job.progress.totalFrames) * 100)
            );
          }
        }
      }
    }
  };

  if (child.stdout) {
    child.stdout.on("data", handleOutput);
  }
  if (child.stderr) {
    child.stderr.on("data", handleOutput);
  }

  child.on("close", (code) => {
    job.completedAt = Date.now();
    job.exitCode = code;
    activeProcesses.delete(jobId);

    if (code === 0) {
      job.status = "completed";
      job.progress.percent = 100;
      job.progress.currentFrame = job.progress.totalFrames;
    } else if (job.status !== "cancelled") {
      job.status = "failed";
      job.error = job.logTail.slice(-5).join("\n") || `aerender exited with code ${code}`;
    }
    saveRenderJob(job);
  });

  child.on("error", (err) => {
    job.status = "failed";
    job.completedAt = Date.now();
    job.error = err.message;
    activeProcesses.delete(jobId);
    saveRenderJob(job);
  });

  return job;
}

export function cancelRenderJob(jobId: string): boolean {
  const active = activeProcesses.get(jobId);
  if (active) {
    try {
      active.job.status = "cancelled";
      active.job.completedAt = Date.now();
      saveRenderJob(active.job);
      active.process.kill("SIGTERM");
      activeProcesses.delete(jobId);
      return true;
    } catch {
      return false;
    }
  }

  const job = getRenderJob(jobId);
  if (job && (job.status === "running" || job.status === "queued")) {
    job.status = "cancelled";
    job.completedAt = Date.now();
    saveRenderJob(job);
    return true;
  }

  return false;
}

export function killAllRenderJobs(): void {
  for (const [id, active] of activeProcesses.entries()) {
    try {
      active.job.status = "cancelled";
      active.job.completedAt = Date.now();
      saveRenderJob(active.job);
      active.process.kill("SIGTERM");
    } catch {}
  }
  activeProcesses.clear();
}
