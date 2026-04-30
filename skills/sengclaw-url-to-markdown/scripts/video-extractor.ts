#!/usr/bin/env bun
/**
 * video-extractor.ts
 *
 * 视频 URL → Markdown 转换器（含可选下载）
 * 支持：YouTube / B站 / 抖音 / 小红书 / TikTok / 微博
 *
 * 工作流：
 * 1. yt-dlp 提取视频元数据 + 字幕（如有）
 *    - 抖音自动添加 --cookies-from-browser chrome
 * 2. 若无字幕，下载视频 → ffmpeg 截关键帧 → 豆包多模态分析
 * 3. 输出结构化 Markdown
 * 4. 可选：--download-video 把完整视频保存到本地
 *
 * 用法：
 *   bun video-extractor.ts <url> [options]
 *
 * 选项：
 *   -o <path>              输出 Markdown 文件路径（默认自动生成）
 *   --output-dir <dir>     Markdown 输出目录
 *   --download-video       同时下载完整视频文件到 --video-dir 目录
 *   --video-dir <dir>      视频保存目录（默认 ~/Downloads/videos）
 *   --lang <zh|en>         字幕语言优先级（默认 zh-Hans,zh,en）
 *   --frames <n>           截帧数量（默认 8，无字幕时生效）
 *   --no-vision            跳过多模态视觉分析（仅输出字幕/元数据）
 *   --no-cookies           不使用 Chrome cookies（默认对抖音自动开启）
 *   --ark-key <key>        ARK API Key（也可读 ARK_API_KEY 或配置文件）
 *   --model <model>        豆包模型（默认 doubao-seed-2-0-lite）
 */

import { execSync, spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { readCache, writeCache, printCacheStatus, DEFAULT_TTL_HOURS_VIDEO } from "./url-cache.js";

// ─────────────────────────────────────────────
// 平台检测
// ─────────────────────────────────────────────
const VIDEO_PLATFORMS = [
  { name: "youtube", patterns: [/youtube\.com\/watch/, /youtu\.be\//] },
  { name: "bilibili", patterns: [/bilibili\.com\/video/, /b23\.tv\//] },
  { name: "douyin", patterns: [/douyin\.com\//, /v\.douyin\.com\//] },
  { name: "xiaohongshu", patterns: [/xiaohongshu\.com\//, /xhslink\.com\//] },
  { name: "tiktok", patterns: [/tiktok\.com\//] },
  { name: "weibo", patterns: [/weibo\.com\//, /weibo\.cn\//] },
];

function detectPlatform(url: string): string {
  for (const p of VIDEO_PLATFORMS) {
    if (p.patterns.some((re) => re.test(url))) return p.name;
  }
  return "unknown";
}

export function isVideoUrl(url: string): boolean {
  return detectPlatform(url) !== "unknown";
}

// 需要 cookies 的平台（抖音国内登录保护）
const PLATFORMS_NEED_COOKIES = new Set(["douyin"]);

function needsCookies(platform: string): boolean {
  return PLATFORMS_NEED_COOKIES.has(platform);
}

// ─────────────────────────────────────────────
// yt-dlp 路径解析
// ─────────────────────────────────────────────
function findYtDlp(): string {
  const candidates = [
    "yt-dlp",
    `${os.homedir()}/.local/bin/yt-dlp`,
    "/opt/homebrew/bin/yt-dlp",
    "/usr/local/bin/yt-dlp",
  ];
  for (const c of candidates) {
    try {
      execSync(`${c} --version`, { stdio: "pipe" });
      return c;
    } catch {}
  }
  throw new Error(
    "yt-dlp not found. Install: uv tool install yt-dlp  OR  brew install yt-dlp"
  );
}

// ─────────────────────────────────────────────
// ARK API Key 解析
// ─────────────────────────────────────────────
function resolveArkKey(overrideKey?: string): string {
  if (overrideKey) return overrideKey;

  if (process.env.ARK_API_KEY) return process.env.ARK_API_KEY;

  try {
    const configPath = path.join(os.homedir(), ".clacky", "config.yml");
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, "utf-8");
      const lines = content.split("\n");
      let inArkBlock = false;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("ark.cn-beijing.volces.com")) inArkBlock = true;
        if (inArkBlock && lines[i].match(/^\s+api_key:\s+(.+)/)) {
          const key = lines[i].match(/^\s+api_key:\s+(.+)/)?.[1]?.trim();
          if (key && key !== "null") return key;
        }
        if (inArkBlock && lines[i].match(/^-\s+base_url/) && i > 3) inArkBlock = false;
      }
    }
  } catch {}

  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;

  throw new Error(
    "ARK API Key not found. Set ARK_API_KEY env var or configure ~/.clacky/config.yml"
  );
}

// ─────────────────────────────────────────────
// 视频元数据 + 字幕提取
// ─────────────────────────────────────────────
interface VideoMeta {
  id: string;
  title: string;
  description: string;
  uploader: string;
  duration: number;
  view_count?: number;
  like_count?: number;
  upload_date?: string;
  webpage_url: string;
  subtitles: Record<string, { url: string; ext: string }[]>;
  automatic_captions: Record<string, { url: string; ext: string }[]>;
  thumbnail?: string;
  platform: string;
}

function extractMeta(ytDlp: string, url: string, useCookies: boolean): VideoMeta {
  console.error("Extracting video metadata...");
  const baseArgs = ["--dump-json", "--no-playlist", "--no-warnings"];
  if (useCookies) {
    baseArgs.push("--cookies-from-browser", "chrome");
    console.error("  Using Chrome cookies (required for Douyin)");
  }
  const result = spawnSync(ytDlp, [...baseArgs, url], {
    encoding: "utf-8",
    timeout: 30000,
  });
  if (result.status !== 0) {
    const stderr = result.stderr || "";
    // 检测"无视频内容"错误，用特殊错误类型标记，让调用方可以回退到浏览器抓取
    if (
      stderr.includes("No video formats found") ||
      stderr.includes("no video formats") ||
      stderr.includes("Unsupported URL") ||
      stderr.includes("Unable to extract") ||
      stderr.includes("This is not a video")
    ) {
      const err = new Error(`yt-dlp: no video content found: ${stderr.trim()}`);
      (err as any).noVideoContent = true;
      throw err;
    }
    throw new Error(`yt-dlp metadata failed: ${stderr}`);
  }
  const raw = JSON.parse(result.stdout);
  return {
    id: raw.id,
    title: raw.title || "Untitled",
    description: raw.description || "",
    uploader: raw.uploader || raw.channel || raw.creator || "Unknown",
    duration: raw.duration || 0,
    view_count: raw.view_count,
    like_count: raw.like_count,
    upload_date: raw.upload_date,
    webpage_url: raw.webpage_url || url,
    subtitles: raw.subtitles || {},
    automatic_captions: raw.automatic_captions || {},
    thumbnail: raw.thumbnail,
    platform: detectPlatform(url),
  };
}

// ─────────────────────────────────────────────
// 字幕下载与解析
// ─────────────────────────────────────────────
function downloadSubtitles(
  ytDlp: string,
  url: string,
  tmpDir: string,
  langPriority: string[],
  useCookies: boolean
): string | null {
  console.error("Trying to download subtitles...");

  const baseArgs = useCookies ? ["--cookies-from-browser", "chrome"] : [];
  const args = [
    ...baseArgs,
    "--skip-download",
    "--write-subs",
    "--write-auto-subs",
    "--sub-format",
    "vtt/srt/best",
    "--sub-langs",
    langPriority.join(","),
    "--output",
    path.join(tmpDir, "sub.%(ext)s"),
    "--no-warnings",
    url,
  ];

  const result = spawnSync(ytDlp, args, {
    encoding: "utf-8",
    timeout: 60000,
    cwd: tmpDir,
  });

  const files = fs.readdirSync(tmpDir);
  const subFile = files.find((f) => f.match(/\.(vtt|srt|ttml|json3)$/));
  if (!subFile) {
    console.error("  No subtitles found");
    return null;
  }

  const content = fs.readFileSync(path.join(tmpDir, subFile), "utf-8");
  console.error(`  Subtitle file: ${subFile}`);
  return parseSubtitle(content, subFile);
}

function parseSubtitle(content: string, filename: string): string {
  if (filename.endsWith(".vtt")) return parseVtt(content);
  if (filename.endsWith(".srt")) return parseSrt(content);
  if (filename.endsWith(".json3")) return parseJson3(content);
  return content;
}

function parseVtt(content: string): string {
  const lines: string[] = [];
  let lastText = "";
  for (const line of content.split("\n")) {
    if (
      line.startsWith("WEBVTT") ||
      line.match(/^\d{2}:\d{2}/) ||
      line.trim() === "" ||
      line.startsWith("NOTE")
    )
      continue;
    const text = line.replace(/<[^>]+>/g, "").trim();
    if (text && text !== lastText) {
      lines.push(text);
      lastText = text;
    }
  }
  return lines.join("\n");
}

function parseSrt(content: string): string {
  const lines: string[] = [];
  let lastText = "";
  for (const line of content.split("\n")) {
    if (line.match(/^\d+$/) || line.match(/^\d{2}:\d{2}/) || line.trim() === "")
      continue;
    const text = line.replace(/<[^>]+>/g, "").trim();
    if (text && text !== lastText) {
      lines.push(text);
      lastText = text;
    }
  }
  return lines.join("\n");
}

function parseJson3(content: string): string {
  try {
    const data = JSON.parse(content);
    const events = data.events || [];
    const lines: string[] = [];
    let last = "";
    for (const e of events) {
      const text = (e.segs || [])
        .map((s: any) => s.utf8 || "")
        .join("")
        .replace(/\n/g, " ")
        .trim();
      if (text && text !== last) {
        lines.push(text);
        last = text;
      }
    }
    return lines.join("\n");
  } catch {
    return content;
  }
}

// ─────────────────────────────────────────────
// 关键帧截取（ffmpeg）
// ─────────────────────────────────────────────
function downloadVideoAndExtractFrames(
  ytDlp: string,
  url: string,
  tmpDir: string,
  frameCount: number,
  useCookies: boolean
): string[] {
  console.error("Downloading video and extracting keyframes...");

  const cookieArgs = useCookies ? ["--cookies-from-browser", "chrome"] : [];
  const videoPath = path.join(tmpDir, "video.mp4");
  const dlArgs = [
    ...cookieArgs,
    "-f",
    "worst[ext=mp4]/worst/bestvideo[height<=480]+bestaudio/best[height<=480]/best",
    "--merge-output-format",
    "mp4",
    "--output",
    videoPath,
    "--no-warnings",
    "--no-playlist",
    url,
  ];

  console.error("  Downloading low-res video...");
  const dlResult = spawnSync(ytDlp, dlArgs, { encoding: "utf-8", timeout: 120000 });
  if (dlResult.status !== 0 || !fs.existsSync(videoPath)) {
    console.error(`  Video download failed: ${dlResult.stderr}`);
    return [];
  }

  const framesDir = path.join(tmpDir, "frames");
  fs.mkdirSync(framesDir, { recursive: true });

  let duration = 60;
  try {
    const probe = spawnSync(
      "ffprobe",
      ["-v", "quiet", "-print_format", "json", "-show_format", videoPath],
      { encoding: "utf-8", timeout: 10000 }
    );
    if (probe.status === 0) {
      const info = JSON.parse(probe.stdout);
      duration = parseFloat(info.format?.duration || "60");
    }
  } catch {}

  const interval = Math.max(1, Math.floor(duration / (frameCount + 1)));
  console.error(`  Video duration: ${duration}s, extracting 1 frame every ${interval}s`);

  const ffmpegResult = spawnSync(
    "ffmpeg",
    [
      "-i",
      videoPath,
      "-vf",
      `fps=1/${interval}`,
      "-vframes",
      String(frameCount),
      "-q:v",
      "2",
      path.join(framesDir, "frame_%03d.jpg"),
      "-y",
    ],
    { encoding: "utf-8", timeout: 60000 }
  );

  if (ffmpegResult.status !== 0) {
    console.error("  ffmpeg failed, trying fallback frame extraction");
    const frames: string[] = [];
    for (let i = 1; i <= frameCount; i++) {
      const t = Math.floor((duration * i) / (frameCount + 1));
      const framePath = path.join(framesDir, `frame_${String(i).padStart(3, "0")}.jpg`);
      spawnSync("ffmpeg", ["-ss", String(t), "-i", videoPath, "-vframes", "1", "-q:v", "2", framePath, "-y"], {
        encoding: "utf-8",
        timeout: 15000,
      });
      if (fs.existsSync(framePath)) frames.push(framePath);
    }
    return frames;
  }

  const frames = fs
    .readdirSync(framesDir)
    .filter((f) => f.endsWith(".jpg"))
    .sort()
    .map((f) => path.join(framesDir, f));

  console.error(`  Extracted ${frames.length} frames`);
  return frames;
}

// ─────────────────────────────────────────────
// 完整视频下载（可选功能）
// ─────────────────────────────────────────────
function downloadFullVideo(
  ytDlp: string,
  url: string,
  meta: VideoMeta,
  videoDir: string,
  useCookies: boolean
): string | null {
  console.error(`\nDownloading full video to ${videoDir} ...`);

  fs.mkdirSync(path.join(videoDir, meta.platform), { recursive: true });

  const slug = slugify(meta.title) || meta.id;
  const outputTemplate = path.join(videoDir, meta.platform, `${slug}.%(ext)s`);

  const cookieArgs = useCookies ? ["--cookies-from-browser", "chrome"] : [];
  const args = [
    ...cookieArgs,
    "-f",
    "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/best",
    "--merge-output-format",
    "mp4",
    "--output",
    outputTemplate,
    "--no-warnings",
    "--no-playlist",
    url,
  ];

  const result = spawnSync(ytDlp, args, {
    encoding: "utf-8",
    timeout: 600000,
    stdio: ["pipe", "pipe", "inherit"],
  });

  if (result.status !== 0) {
    console.error(`  Video download failed: ${result.stderr}`);
    return null;
  }

  const dir = path.join(videoDir, meta.platform);
  const files = fs.readdirSync(dir).filter((f) => f.startsWith(slug));
  if (files.length === 0) return null;

  const videoPath = path.join(dir, files[0]);
  const stat = fs.statSync(videoPath);
  const sizeMB = (stat.size / 1024 / 1024).toFixed(1);
  console.error(`  Video saved: ${videoPath} (${sizeMB} MB)`);
  return videoPath;
}

// ─────────────────────────────────────────────
// Files API：上传本地视频，返回 file_id
// ─────────────────────────────────────────────
async function uploadVideoFile(videoPath: string, arkKey: string): Promise<string> {
  console.error(`Uploading video to ARK Files API: ${path.basename(videoPath)}`);

  const formData = new FormData();
  const fileBlob = new Blob([fs.readFileSync(videoPath)], { type: "video/mp4" });
  formData.append("file", fileBlob, path.basename(videoPath));
  formData.append("purpose", "user_data");

  const uploadResp = await fetch("https://ark.cn-beijing.volces.com/api/v3/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${arkKey}` },
    body: formData,
  });

  if (!uploadResp.ok) {
    throw new Error(`Files API upload failed: ${uploadResp.status} ${await uploadResp.text()}`);
  }

  const uploadData = (await uploadResp.json()) as any;
  const fileId: string = uploadData.id;
  console.error(`  Uploaded → file_id: ${fileId} (status: ${uploadData.status})`);

  // 等待 processing → active
  for (let i = 0; i < 10; i++) {
    if (uploadData.status === "active") break;
    await new Promise((r) => setTimeout(r, 1500));
    const statusResp = await fetch(
      `https://ark.cn-beijing.volces.com/api/v3/files/${fileId}`,
      { headers: { Authorization: `Bearer ${arkKey}` } }
    );
    const statusData = (await statusResp.json()) as any;
    console.error(`  File status: ${statusData.status}`);
    if (statusData.status === "active") break;
    if (statusData.status === "error") throw new Error(`File processing failed: ${JSON.stringify(statusData)}`);
  }

  return fileId;
}

// ─────────────────────────────────────────────
// Files API：删除已上传文件（用完即删）
// ─────────────────────────────────────────────
async function deleteVideoFile(fileId: string, arkKey: string): Promise<void> {
  try {
    await fetch(`https://ark.cn-beijing.volces.com/api/v3/files/${fileId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${arkKey}` },
    });
    console.error(`  Deleted remote file: ${fileId}`);
  } catch (e) {
    console.error(`  Warning: failed to delete remote file ${fileId}: ${e}`);
  }
}

// ─────────────────────────────────────────────
// 视频分析：Responses API + doubao（完整视频，via file_id）
// ─────────────────────────────────────────────
async function analyzeVideoWithResponses(
  fileId: string,
  meta: VideoMeta,
  arkKey: string,
  model: string
): Promise<string> {
  console.error(`Analyzing full video with Responses API (model: ${model})...`);

  const prompt = `你是内容分析专家，请分析这段视频内容。

视频标题：${meta.title}
作者/上传者：${meta.uploader}
平台：${meta.platform}

请分析：
1. **视频主题**：这个视频讲的是什么
2. **教程步骤**（如有）：按时序还原操作步骤
3. **核心技巧**：视频中展示的关键方法、工具或知识点
4. **可见文字**：提取视频中出现的所有字幕/文字
5. **内容特征**：风格、受众、表达方式

用中文回答，结构清晰。`;

  const response = await fetch("https://ark.cn-beijing.volces.com/api/v3/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${arkKey}`,
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_video", file_id: fileId },
          ],
        },
      ],
      max_output_tokens: 4000,
    }),
  });

  if (!response.ok) {
    throw new Error(`Responses API error: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as any;
  // Responses API 输出：output[] 可能含 reasoning + message 两种类型
  // type=message 里的 content[].type=output_text 才是正式回复
  const messageOutput = data.output?.find((o: any) => o.type === "message");
  const textContent = messageOutput?.content?.find((c: any) => c.type === "output_text");
  if (textContent?.text) return textContent.text;

  // fallback：部分模型直接在 output_text 字段
  if (data.output_text) return data.output_text;

  // 如果只有 reasoning 没有 message（token 不够），抛错触发 fallback
  const reasoning = data.output?.find((o: any) => o.type === "reasoning");
  if (reasoning && !messageOutput) {
    throw new Error(`Responses API returned reasoning only (incomplete). status: ${data.status}`);
  }

  return "";
}

// ─────────────────────────────────────────────
// 图片截帧分析（fallback：coding/v3 + claude）
// ─────────────────────────────────────────────
async function analyzeFramesWithVision(
  frames: string[],
  meta: VideoMeta,
  arkKey: string,
  model: string
): Promise<string> {
  console.error(`Analyzing ${frames.length} frames with vision (model: ${model})...`);

  const imageContents = frames.slice(0, 8).map((framePath) => {
    const base64 = fs.readFileSync(framePath).toString("base64");
    return {
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${base64}` },
    };
  });

  const prompt = `你是内容分析专家，以下是视频的 ${frames.length} 张关键帧截图（按时序排列）。

视频标题：${meta.title}
作者/上传者：${meta.uploader}
平台：${meta.platform}

请分析：
1. **视频主题**：这个视频讲的是什么
2. **教程步骤**（如有）：从截帧还原操作步骤
3. **核心技巧**：画面中展示的关键方法或工具
4. **可见文字**：提取帧中出现的所有文字/字幕
5. **内容特征**：风格、受众、表达方式

用中文回答，结构清晰。`;

  const response = await fetch(
    "https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${arkKey}`,
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: prompt }, ...imageContents],
          },
        ],
        max_tokens: 2000,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Vision API error: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as any;
  return data.choices?.[0]?.message?.content || "";
}

// ─────────────────────────────────────────────
// Markdown 输出生成
// ─────────────────────────────────────────────
function formatDate(yyyymmdd?: string): string {
  if (!yyyymmdd || yyyymmdd.length !== 8) return "";
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function buildMarkdown(
  meta: VideoMeta,
  subtitle: string | null,
  visionAnalysis: string | null,
  videoPath?: string | null
): string {
  const capturedAt = new Date().toISOString();
  const uploadDate = formatDate(meta.upload_date);

  let frontmatter = `---
url: ${meta.webpage_url}
title: "${meta.title.replace(/"/g, '\\"')}"
author: "${meta.uploader}"
platform: ${meta.platform}
duration: "${formatDuration(meta.duration)}"`;

  if (uploadDate) frontmatter += `\npublished: "${uploadDate}"`;
  if (meta.view_count) frontmatter += `\nview_count: ${meta.view_count}`;
  if (meta.thumbnail) frontmatter += `\nthumbnail: "${meta.thumbnail}"`;
  if (videoPath) frontmatter += `\nvideo_path: "${videoPath}"`;
  frontmatter += `\ncaptured_at: "${capturedAt}"
source_type: video
---`;

  let body = `# ${meta.title}\n\n`;
  body += `> **Platform**: ${meta.platform} | **Author**: ${meta.uploader}`;
  if (uploadDate) body += ` | **Published**: ${uploadDate}`;
  if (meta.duration) body += ` | **Duration**: ${formatDuration(meta.duration)}`;
  body += "\n\n";

  if (videoPath) {
    body += `## Local Video\n\n\`${videoPath}\`\n\n`;
  }

  if (meta.description && meta.description.trim()) {
    const desc = meta.description.trim().slice(0, 500);
    body += `## Description\n\n${desc}${meta.description.length > 500 ? "..." : ""}\n\n`;
  }

  if (visionAnalysis) {
    body += `## Video Content Analysis (AI Keyframe Analysis)\n\n${visionAnalysis}\n\n`;
  }

  if (subtitle && subtitle.trim()) {
    body += `## Subtitles / Transcript\n\n${subtitle.trim()}\n\n`;
  }

  return `${frontmatter}\n\n${body}`;
}

// ─────────────────────────────────────────────
// 输出路径生成
// ─────────────────────────────────────────────
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60)
    .replace(/-+$/, "");
}

function resolveOutputPath(
  meta: VideoMeta,
  outputFile?: string,
  outputDir?: string
): string {
  if (outputFile) return outputFile;
  const base = outputDir || "./url-to-markdown";
  const slug = slugify(meta.title) || meta.id;
  return path.join(base, meta.platform, `${slug}.md`);
}

// ─────────────────────────────────────────────
// CLI 入口
// ─────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === "--help") {
    console.log(`Usage: bun video-extractor.ts <url|--local-video> [options]
Options:
  -o <path>              Output Markdown file path
  --output-dir <dir>     Markdown output directory
  --local-video <path>   Analyze a local video file (skips yt-dlp download)
  --title <title>        Video title (used with --local-video)
  --download-video       Also download the full video file
  --video-dir <dir>      Video save directory (default: ~/Downloads/videos)
  --lang <langs>         Subtitle language priority (default: zh-Hans,zh,en)
  --frames <n>           Keyframe count for vision fallback (default: 8)
  --no-vision            Skip AI vision analysis
  --no-cookies           Disable Chrome cookies (auto-enabled for Douyin)
  --ark-key <key>        ARK API Key
  --model <model>        Doubao model for Responses API (default: doubao-seed-2-0-lite-260215)
  --vision-model <m>     Claude model for frame fallback (default: claude-3-5-sonnet-20241022)`);
    process.exit(0);
  }

  let url = "";
  let localVideoPath: string | undefined;
  let localVideoTitle: string | undefined;
  let outputFile: string | undefined;
  let outputDir: string | undefined;
  let downloadVideo = false;
  let videoDir = path.join(os.homedir(), "Downloads", "videos");
  let langPriority = ["zh-Hans", "zh", "en"];
  let frameCount = 8;
  let noVision = false;
  let noCookies = false;
  let noCache = false;
  let cacheTtl = DEFAULT_TTL_HOURS_VIDEO;
  let arkKeyOverride: string | undefined;
  let model = "doubao-seed-2-0-lite-260215";
  let visionModel = "claude-3-5-sonnet-20241022";

  // first positional arg = url (unless it's --local-video)
  if (args[0] && !args[0].startsWith("--")) {
    url = args[0];
  }

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "-o" && args[i + 1]) outputFile = args[++i];
    else if (args[i] === "--output-dir" && args[i + 1]) outputDir = args[++i];
    else if (args[i] === "--local-video" && args[i + 1]) localVideoPath = args[++i];
    else if (args[i] === "--title" && args[i + 1]) localVideoTitle = args[++i];
    else if (args[i] === "--download-video") downloadVideo = true;
    else if (args[i] === "--video-dir" && args[i + 1]) videoDir = args[++i];
    else if (args[i] === "--lang" && args[i + 1]) langPriority = args[++i].split(",");
    else if (args[i] === "--frames" && args[i + 1]) frameCount = parseInt(args[++i]);
    else if (args[i] === "--no-vision") noVision = true;
    else if (args[i] === "--no-cookies") noCookies = true;
    else if (args[i] === "--no-cache") noCache = true;
    else if (args[i] === "--cache-ttl" && args[i + 1]) cacheTtl = parseInt(args[++i]) || DEFAULT_TTL_HOURS_VIDEO;
    else if (args[i] === "--ark-key" && args[i + 1]) arkKeyOverride = args[++i];
    else if (args[i] === "--model" && args[i + 1]) model = args[++i];
    else if (args[i] === "--vision-model" && args[i + 1]) visionModel = args[++i];
  }

  // ── LOCAL VIDEO 模式 ──
  if (localVideoPath) {
    const resolvedPath = localVideoPath.startsWith("~")
      ? path.join(os.homedir(), localVideoPath.slice(1))
      : localVideoPath;

    if (!fs.existsSync(resolvedPath)) {
      console.error(`Local video not found: ${resolvedPath}`);
      process.exit(1);
    }

    const title = localVideoTitle || path.basename(resolvedPath, path.extname(resolvedPath));
    const meta: VideoMeta = {
      id: path.basename(resolvedPath, path.extname(resolvedPath)),
      title,
      description: "",
      uploader: "local",
      duration: 0,
      webpage_url: resolvedPath,
      subtitles: {},
      automatic_captions: {},
      platform: "local",
    };

    // 尝试从 ffprobe 获取时长
    try {
      const probe = spawnSync(
        "ffprobe",
        ["-v", "quiet", "-print_format", "json", "-show_format", resolvedPath],
        { encoding: "utf-8", timeout: 10000 }
      );
      if (probe.status === 0) {
        const info = JSON.parse(probe.stdout);
        meta.duration = parseFloat(info.format?.duration || "0");
      }
    } catch {}

    console.error(`Local video: ${title} (${formatDuration(meta.duration)})`);

    let visionAnalysis: string | null = null;
    if (!noVision) {
      const arkKey = resolveArkKey(arkKeyOverride);
      let fileId: string | null = null;
      try {
        // 优先：Files API 上传 → Responses API（完整视频）
        fileId = await uploadVideoFile(resolvedPath, arkKey);
        visionAnalysis = await analyzeVideoWithResponses(fileId, meta, arkKey, model);
      } catch (e) {
        console.error(`Responses API failed: ${e}`);
        console.error("Falling back to frame-based analysis...");
        // fallback：截帧 → claude 图片分析
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "video-extractor-"));
        try {
          const framesDir = path.join(tmpDir, "frames");
          fs.mkdirSync(framesDir, { recursive: true });
          const frames: string[] = [];
          const duration = meta.duration || 60;
          for (let i = 1; i <= frameCount; i++) {
            const t = Math.floor((duration * i) / (frameCount + 1));
            const framePath = path.join(framesDir, `frame_${String(i).padStart(3, "0")}.jpg`);
            spawnSync("ffmpeg", ["-ss", String(t), "-i", resolvedPath, "-vframes", "1", "-q:v", "2", framePath, "-y"], {
              encoding: "utf-8", timeout: 15000,
            });
            if (fs.existsSync(framePath)) frames.push(framePath);
          }
          if (frames.length > 0) {
            visionAnalysis = await analyzeFramesWithVision(frames, meta, arkKey, visionModel);
          }
        } finally {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        }
      } finally {
        if (fileId) await deleteVideoFile(fileId, arkKey);
      }
    }

    const markdown = buildMarkdown(meta, null, visionAnalysis, resolvedPath);
    const outPath = resolveOutputPath(meta, outputFile, outputDir);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, markdown, "utf-8");
    console.error(`\nMarkdown saved: ${outPath}`);
    console.log(outPath);
    return;
  }

  // ── URL 模式 ──
  if (!url) {
    console.error("Error: provide a URL or use --local-video <path>");
    process.exit(1);
  }
  const platform = detectPlatform(url);
  if (platform === "unknown") {
    console.error(`Unrecognized video platform, URL: ${url}`);
    console.error("Supported: YouTube / Bilibili / Douyin / XiaoHongShu / TikTok / Weibo");
    process.exit(1);
  }

  const useCookies = !noCookies && needsCookies(platform);
  console.error(
    `Platform: ${platform}${useCookies ? " (using Chrome cookies)" : ""}`
  );

  // ─── 缓存检查 ─────────────────────────────────────────────────────────────
  const cacheResult = await readCache(url, noCache);
  printCacheStatus(cacheResult, url);
  if (cacheResult.hit && !outputFile) {
    console.error(`Loaded from cache: ${cacheResult.entry.md_path}`);
    console.log(cacheResult.entry.md_path); // stdout for upstream scripts
    return;
  }
  // ─────────────────────────────────────────────────────────────────────────

  const ytDlp = findYtDlp();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "video-extractor-"));

  try {
    // Step 1: metadata
    const meta = extractMeta(ytDlp, url, useCookies);
    console.error(`Video: ${meta.title} (${formatDuration(meta.duration)})`);

    // Step 2: subtitles
    const subtitle = downloadSubtitles(ytDlp, url, tmpDir, langPriority, useCookies);

    // Step 3: vision analysis
    let visionAnalysis: string | null = null;
    if (!noVision) {
      const arkKey = resolveArkKey(arkKeyOverride);
      let fileId: string | null = null;
      try {
        // 下载低画质视频用于分析
        const videoPath = path.join(tmpDir, "analysis_video.mp4");
        const dlFrameCount = subtitle ? 4 : frameCount; // 有字幕时只需少量帧
        const cookieArgs = useCookies ? ["--cookies-from-browser", "chrome"] : [];
        const dlArgs = [
          ...cookieArgs,
          "-f", "worst[ext=mp4]/worst/bestvideo[height<=480]+bestaudio/best[height<=480]/best",
          "--merge-output-format", "mp4",
          "--output", videoPath,
          "--no-warnings", "--no-playlist",
          url,
        ];
        console.error("Downloading video for analysis...");
        const dlResult = spawnSync(ytDlp, dlArgs, { encoding: "utf-8", timeout: 120000 });

        if (dlResult.status === 0 && fs.existsSync(videoPath)) {
          // 优先：Files API 上传 → Responses API（完整视频）
          fileId = await uploadVideoFile(videoPath, arkKey);
          visionAnalysis = await analyzeVideoWithResponses(fileId, meta, arkKey, model);
        } else {
          throw new Error(`Video download failed: ${dlResult.stderr}`);
        }
      } catch (e) {
        console.error(`Responses API path failed: ${e}`);
        console.error("Falling back to frame-based analysis...");
        // fallback：截帧 → claude 图片分析
        const frames = downloadVideoAndExtractFrames(ytDlp, url, tmpDir, frameCount, useCookies);
        if (frames.length > 0) {
          try {
            visionAnalysis = await analyzeFramesWithVision(frames, meta, arkKey, visionModel);
          } catch (e2) {
            console.error(`Frame vision analysis also failed: ${e2}`);
          }
        }
      } finally {
        if (fileId) await deleteVideoFile(fileId, arkKey);
      }
    }

    // Step 4: optional full video download
    let savedVideoPath: string | null = null;
    if (downloadVideo) {
      savedVideoPath = downloadFullVideo(ytDlp, url, meta, videoDir, useCookies);
    }

    // Step 5: generate Markdown
    const markdown = buildMarkdown(meta, subtitle, visionAnalysis, savedVideoPath);

    // Step 6: write file
    const outPath = resolveOutputPath(meta, outputFile, outputDir);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, markdown, "utf-8");

    // ─── 写入缓存索引 ──────────────────────────────────────────────────────
    try {
      await writeCache(url, outPath, undefined, cacheTtl);
    } catch (cacheErr) {
      console.error(`Cache write skipped: ${cacheErr instanceof Error ? cacheErr.message : String(cacheErr)}`);
    }
    // ──────────────────────────────────────────────────────────────────────

    console.error(`\nMarkdown saved: ${outPath}`);
    if (savedVideoPath) {
      console.error(`Video saved: ${savedVideoPath}`);
    }
    console.log(outPath); // stdout for upstream scripts
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

main().catch((e) => {
  // exit code 88 = 无视频内容，上层 main.ts 可以检测并回退到浏览器抓取
  if ((e as any).noVideoContent) {
    console.error(`[video-extractor] No video content found, exiting with code 88 for fallback`);
    process.exit(88);
  }
  console.error(`Error: ${e.message}`);
  process.exit(1);
});
