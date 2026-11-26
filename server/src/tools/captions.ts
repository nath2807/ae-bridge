import fs from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callAE } from "../bridge.js";
import { compRefSchema, colorSchema, toolSuccess, toolError } from "./schemas.js";

const execFileAsync = promisify(execFile);

export interface CaptionSegment {
  text: string;
  start: number;
  end: number;
  highlight?: boolean;
}

export function parseSrt(srtText: string): CaptionSegment[] {
  const segments: CaptionSegment[] = [];
  const blocks = srtText.trim().split(/\r?\n\r?\n/);

  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length >= 2) {
      // Find timecode line (e.g. 00:00:01,200 --> 00:00:04,500)
      const timeLine = lines.find((l) => l.includes("-->"));
      if (timeLine) {
        const parts = timeLine.split("-->").map((s) => s.trim());
        const parseTime = (tc: string) => {
          const match = tc.match(/(?:(\d+):)?(\d+):(\d+)[,.](\d+)/);
          if (match) {
            const h = match[1] ? parseInt(match[1], 10) : 0;
            const m = parseInt(match[2], 10);
            const s = parseInt(match[3], 10);
            const ms = parseInt(match[4].padEnd(3, "0").slice(0, 3), 10);
            return h * 3600 + m * 60 + s + ms / 1000;
          }
          return 0;
        };
        const start = parseTime(parts[0]);
        const end = parseTime(parts[1]);
        const textLines = lines.slice(lines.indexOf(timeLine) + 1).join(" ");
        if (textLines) {
          segments.push({ text: textLines, start, end });
        }
      }
    }
  }

  return segments;
}

export async function detectWhisperCli(): Promise<string | null> {
  if (process.env.WHISPER_PATH && fs.existsSync(process.env.WHISPER_PATH)) {
    return process.env.WHISPER_PATH;
  }
  try {
    const isWin = process.platform === "win32";
    const checkCmd = isWin ? "where" : "which";
    const { stdout } = await execFileAsync(checkCmd, ["whisper"]);
    const lines = stdout.split(/\r?\n/).filter(Boolean);
    return lines[0] || null;
  } catch {
    return null;
  }
}

export function registerCaptionTools(server: McpServer): void {
  // 1. ae_transcribe_audio
  server.tool(
    "ae_transcribe_audio",
    "Extract speech timestamps from an audio/video file or format raw transcript text/SRT into structured kinetic caption segments.",
    {
      filePath: z.string().optional().describe("Path to local audio or video media file to transcribe"),
      rawTranscript: z.string().optional().describe("Pre-existing raw transcript, SRT, or VTT string to parse without Whisper"),
      language: z.string().optional().default("en").describe("Audio language code (default 'en')")
    },
    async (params) => {
      try {
        if (params.rawTranscript) {
          const segments = parseSrt(params.rawTranscript);
          return toolSuccess({
            source: "raw_transcript",
            count: segments.length,
            segments
          });
        }

        if (!params.filePath) {
          return toolError("Either 'filePath' or 'rawTranscript' must be provided.");
        }

        const whisperExe = await detectWhisperCli();
        if (!whisperExe) {
          return toolSuccess({
            source: "manual_fallback",
            message:
              "Whisper CLI not detected on system PATH. You can supply transcript text directly using 'rawTranscript' (supports SRT/VTT format), or install OpenAI Whisper via: pip install openai-whisper.",
            exampleUsage: {
              rawTranscript: "1\n00:00:00,500 --> 00:00:02,000\nHello world\n\n2\n00:00:02,100 --> 00:00:04,500\nWelcome to AE Bridge"
            }
          });
        }

        // Run whisper CLI
        const tmpJson = params.filePath + ".json";
        await execFileAsync(whisperExe, [params.filePath, "--language", params.language || "en", "--output_format", "json"]);

        if (fs.existsSync(tmpJson)) {
          const raw = await fs.promises.readFile(tmpJson, "utf-8");
          const data = JSON.parse(raw);
          const segments: CaptionSegment[] = (data.segments || []).map((s: any) => ({
            text: s.text.trim(),
            start: s.start,
            end: s.end
          }));
          return toolSuccess({
            source: "whisper_cli",
            count: segments.length,
            segments
          });
        }

        return toolError("Whisper completed but JSON output was not generated.");
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 2. ae_kinetic_captions
  server.tool(
    "ae_kinetic_captions",
    "Generate animated word-by-word or phrase-by-phrase kinetic typography captions in After Effects with customizable styling (word_pop, bounce, typewriter).",
    {
      compRef: compRefSchema.optional(),
      captions: z.union([
        z.array(
          z.object({
            text: z.string().describe("Caption word or phrase text"),
            start: z.number().min(0).describe("Start time in seconds"),
            end: z.number().min(0).describe("End time in seconds"),
            highlight: z.boolean().optional().describe("Whether to highlight this word with highlightColor")
          })
        ),
        z.string().describe("SRT format subtitle string")
      ]).describe("Caption segments or SRT string to animate"),
      style: z.enum(["word_pop", "bounce", "typewriter"]).optional().default("word_pop").describe("Kinetic animation style"),
      fontSize: z.number().positive().optional().default(72).describe("Caption font size in points (default 72)"),
      fillColor: colorSchema.optional().describe("Base text fill color (defaults to white)"),
      highlightColor: colorSchema.optional().describe("Highlighted word color (defaults to yellow/gold)"),
      position: z.array(z.number()).min(2).max(2).optional().describe("2D position [x, y] in comp coordinates (defaults to bottom center)")
    },
    async (params) => {
      try {
        let captionList: CaptionSegment[];
        if (typeof params.captions === "string") {
          captionList = parseSrt(params.captions);
        } else {
          captionList = params.captions;
        }

        const result = await callAE("ae_kinetic_captions", {
          compRef: params.compRef,
          captions: captionList,
          style: params.style,
          fontSize: params.fontSize,
          fillColor: params.fillColor,
          highlightColor: params.highlightColor,
          position: params.position
        });

        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
