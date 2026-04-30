#!/usr/bin/env bun
/**
 * WaveSpeedAI Video Watermark Remover
 * 
 * Usage:
 *   bun main.ts /path/to/video.mp4
 *   bun main.ts /path/to/video.mp4 --output /path/to/cleaned.mp4
 *   bun main.ts --interactive
 */

import { parseArgs } from "node:util";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, basename, dirname, extname } from "node:path";
import { Buffer } from "node:buffer";

const API_BASE = "https://api.wavespeed.ai";
const MODEL_ID = "wavespeed-ai/video-watermark-remover";

interface JobResponse {
  success: boolean;
  data: {
    id: string;
    status: "pending" | "processing" | "completed" | "failed" | "cancelled";
    output?: {
      outputs?: string[];
    };
    error?: string;
  };
  message?: string;
}

interface UploadResponse {
  success: boolean;
  data: {
    url: string;
  };
  message?: string;
}

interface ExtendsConfig {
  version: number;
  output_dir: string | null;
  poll_interval: number;
  timeout: number;
  output_suffix: string;
  api_key: string | null;
}

interface CliArgs {
  videoPath: string | null;
  output: string | null;
  apiKey: string | null;
  interactive: boolean;
  pollInterval: number;
  timeout: number;
  json: boolean;
}

function printUsage(): void {
  console.log(`Usage:
  bun main.ts <video_file> [options]
  bun main.ts --interactive

Options:
  -o, --output <path>       Output file path (default: <input>_clean.mp4)
  --api-key <key>           WaveSpeedAI API key (overrides env var)
  --interactive             Interactive mode to enter API key
  --poll-interval <seconds> Seconds between status checks (default: 3)
  --timeout <seconds>       Max wait time (default: 600)
  --json                    JSON output
  -h, --help                Show help

Examples:
  bun main.ts video.mp4
  bun main.ts video.mp4 --output cleaned.mp4
  bun main.ts video.mp4 --api-key "your-key"
  WAVESPEED_API_KEY=your-key bun main.ts video.mp4
`);
}

/**
 * Load EXTEND.md configuration from user or project level
 */
function loadExtendsConfig(): ExtendsConfig | null {
  const homeExtend = `${process.env.HOME}/.clacky/skills/sengclaw-wavespeed-watermark-remover/EXTEND.md`;
  const projectExtend = ".clacky/skills/sengclaw-wavespeed-watermark-remover/EXTEND.md";

  const extendPaths = [
    { path: projectExtend, source: "project" },
    { path: homeExtend, source: "user" },
  ];

  for (const { path, source } of extendPaths) {
    if (existsSync(path)) {
      console.log(`📋 Loaded EXTEND.md from ${source} level`);
      return parseExtendsFile(readFileSync(path, "utf-8"));
    }
  }

  return null;
}

/**
 * Parse YAML-like EXTEND.md content
 */
function parseExtendsFile(content: string): ExtendsConfig {
  const config: ExtendsConfig = {
    version: 1,
    output_dir: null,
    poll_interval: 3,
    timeout: 600,
    output_suffix: "_clean",
    api_key: null,
  };

  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed === "---") continue;

    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) continue;

    const key = trimmed.slice(0, colonIndex).trim();
    let value = trimmed.slice(colonIndex + 1).trim();

    // Remove quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    switch (key) {
      case "version":
        config.version = parseInt(value, 10) || 1;
        break;
      case "output_dir":
        config.output_dir = value === "null" ? null : value;
        break;
      case "poll_interval":
        config.poll_interval = parseInt(value, 10) || 3;
        break;
      case "timeout":
        config.timeout = parseInt(value, 10) || 600;
        break;
      case "output_suffix":
        config.output_suffix = value || "_clean";
        break;
      case "api_key":
        config.api_key = value || null;
        break;
    }
  }

  return config;
}

async function uploadVideo(apiKey: string, filePath: string): Promise<string> {
  console.log(`📤 Uploading: ${filePath}`);
  
  const fileBuffer = readFileSync(filePath);
  const fileName = basename(filePath);
  const mimeType = getMimeType(filePath);
  
  const boundary = `----FormBoundary${Math.random().toString(36).substring(2)}`;
  
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\n`),
    Buffer.from(`Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`),
    Buffer.from(`Content-Type: ${mimeType}\r\n\r\n`),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  
  const response = await fetch(`${API_BASE}/v2/upload`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });
  
  const data: UploadResponse = await response.json();
  
  if (!response.ok || !data.success) {
    throw new Error(`Upload failed: ${data.message || response.statusText}`);
  }
  
  console.log(`✅ Uploaded: ${data.data.url}`);
  return data.data.url;
}

async function submitJob(apiKey: string, videoUrl: string): Promise<string> {
  console.log(`🔄 Submitting watermark removal job...`);
  
  const response = await fetch(`${API_BASE}/v2/jobs`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL_ID,
      input: {
        video: videoUrl,
      },
    }),
  });
  
  const data: JobResponse = await response.json();
  
  if (!response.ok || !data.success) {
    throw new Error(`Job submission failed: ${data.message || response.statusText}`);
  }
  
  const jobId = data.data.id;
  console.log(`✅ Job submitted: ${jobId}`);
  return jobId;
}

async function waitForJob(
  apiKey: string,
  jobId: string,
  pollInterval: number,
  timeout: number
): Promise<string> {
  console.log(`⏳ Waiting for job completion...`);
  
  const startTime = Date.now();
  const timeoutMs = timeout * 1000;
  
  while (true) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error("Job timed out");
    }
    
    const response = await fetch(`${API_BASE}/v2/jobs/${jobId}`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });
    
    const data: JobResponse = await response.json();
    
    if (!response.ok || !data.success) {
      throw new Error(`Status check failed: ${data.message || response.statusText}`);
    }
    
    const status = data.data.status;
    console.log(`📊 Status: ${status}`);
    
    switch (status) {
      case "completed":
        const outputs = data.data.output?.outputs;
        if (!outputs || outputs.length === 0) {
          throw new Error("Job completed but no output URL found");
        }
        console.log(`✅ Job completed! Output: ${outputs[0]}`);
        return outputs[0];
        
      case "failed":
        throw new Error(`Job failed: ${data.data.error || "Unknown error"}`);
        
      case "cancelled":
        throw new Error("Job was cancelled");
    }
    
    await sleep(pollInterval * 1000);
  }
}

async function downloadFile(url: string, outputPath: string): Promise<void> {
  console.log(`📥 Downloading to: ${outputPath}`);
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Download failed: ${response.statusText}`);
  }
  
  const buffer = await response.arrayBuffer();
  writeFileSync(outputPath, Buffer.from(buffer));
  
  console.log(`✅ Saved: ${outputPath}`);
}

async function processVideo(
  apiKey: string,
  inputPath: string,
  outputPath: string | null,
  pollInterval: number,
  timeout: number,
  json: boolean
): Promise<{ success: boolean; outputPath: string | null; error: string | null }> {
  try {
    // Generate output filename if not provided
    if (!outputPath) {
      const dir = dirname(inputPath);
      const name = basename(inputPath, extname(inputPath));
      outputPath = join(dir, `${name}_clean.mp4`);
    }
    
    // Step 1: Upload
    const videoUrl = await uploadVideo(apiKey, inputPath);
    
    // Step 2: Submit job
    const jobId = await submitJob(apiKey, videoUrl);
    
    // Step 3: Wait for completion
    const outputUrl = await waitForJob(apiKey, jobId, pollInterval, timeout);
    
    // Step 4: Download result
    await downloadFile(outputUrl, outputPath);
    
    if (json) {
      console.log(JSON.stringify({
        success: true,
        inputPath,
        outputPath,
        jobId,
      }));
    } else {
      console.log(`\n🎉 Complete!`);
      console.log(`   Input:  ${inputPath}`);
      console.log(`   Output: ${outputPath}`);
    }
    
    return { success: true, outputPath, error: null };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (json) {
      console.log(JSON.stringify({
        success: false,
        inputPath,
        error: errorMessage,
      }));
    } else {
      console.log(`\n❌ Error: ${errorMessage}`);
    }
    
    return { success: false, outputPath: null, error: errorMessage };
  }
}

function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
    ".mkv": "video/x-matroska",
    ".flv": "video/x-flv",
    ".wmv": "video/x-ms-wmv",
    ".m4v": "video/x-m4v",
  };
  return mimeTypes[ext] || "video/mp4";
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const args = Bun.argv.slice(2);
  
  // Parse flags
  const { values, positionals } = parseArgs({
    args,
    options: {
      "output": { type: "string", short: "o" },
      "api-key": { type: "string" },
      "interactive": { type: "boolean", default: false },
      "poll-interval": { type: "string" },
      "timeout": { type: "string" },
      "json": { type: "boolean", default: false },
      "help": { type: "boolean", default: false },
    },
    allowPositionals: true,
  });
  
  if (values.help) {
    printUsage();
    process.exit(0);
  }
  
  // Load EXTEND.md config
  const extendsConfig = loadExtendsConfig();
  
  const cliArgs: CliArgs = {
    videoPath: positionals[0] || null,
    output: values.output || null,
    apiKey: values["api-key"] || null,
    interactive: values.interactive,
    pollInterval: parseInt(values["poll-interval"] || String(extendsConfig?.poll_interval || "3"), 10),
    timeout: parseInt(values.timeout || String(extendsConfig?.timeout || "600"), 10),
    json: values.json,
  };
  
  // Get API key: CLI flag > EXTEND.md > env var
  let apiKey = cliArgs.apiKey || extendsConfig?.api_key || process.env.WAVESPEED_API_KEY;
  
  if (!apiKey) {
    if (cliArgs.interactive) {
      console.log("Enter your WaveSpeedAI API key:");
      apiKey = await promptInput();
      apiKey = apiKey.trim();
    }
    
    if (!apiKey) {
      console.error("❌ API key required. Set WAVESPEED_API_KEY env var or use --api-key");
      console.error("   Get your key at: https://wavespeed.ai/accesskey");
      process.exit(1);
    }
  }
  
  if (!cliArgs.videoPath) {
    console.error("❌ Video file path required");
    printUsage();
    process.exit(1);
  }
  
  if (!existsSync(cliArgs.videoPath)) {
    console.error(`❌ File not found: ${cliArgs.videoPath}`);
    process.exit(1);
  }
  
  await processVideo(
    apiKey,
    cliArgs.videoPath,
    cliArgs.output,
    cliArgs.pollInterval,
    cliArgs.timeout,
    cliArgs.json
  );
}

async function promptInput(): Promise<string> {
  const fd = await import("node:fs").then(fs => {
    return { readable: fs.openSync("/dev/stdin", "rs"), writable: fs.openSync("/dev/stdout", "w") };
  });
  
  let input = "";
  const buf = Buffer.alloc(1024);
  
  while (true) {
    const bytes = await import("node:fs").then(fs => 
      fs.readSync(fd.readable, buf, 0, buf.length, null)
    );
    
    if (bytes === 0) break;
    
    const chunk = buf.slice(0, bytes).toString();
    input += chunk;
    
    if (chunk.includes("\n")) {
      input = input.trim();
      break;
    }
  }
  
  return input;
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
