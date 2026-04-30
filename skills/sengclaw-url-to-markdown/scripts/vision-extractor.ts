#!/usr/bin/env bun
/**
 * vision-extractor.ts
 *
 * 图片 URL → 图片文字提取（vision OCR）
 * 支持：本地图片文件路径 或 远程图片 URL
 *
 * 工作流：
 * 1. 下载远程图片（或直接读取本地图片）→ base64
 * 2. OpenRouter google/gemini-2.5-flash-image 提取文字
 * 3. 输出结构化 Markdown（每张图的结果）
 *
 * 用法：
 *   bun vision-extractor.ts <image-url-or-path> [image2 ...] [options]
 *   bun vision-extractor.ts --urls-file <path>   # 从文件读取图片 URL 列表（一行一个）
 *
 * 选项：
 *   -o <path>              输出文件路径（默认 stdout）
 *   --api-key <key>       OpenRouter API Key（默认读配置文件）
 *   --model <model>       视觉模型（默认 google/gemini-2.5-flash-image）
 *   --batch-size <n>       每批发送图片数（默认 3，控制并发和 token 消耗）
 */

import { execSync, spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { parseArgs } from "util";

// ─────────────────────────────────────────────
// API Key 解析
// ─────────────────────────────────────────────
function resolveOpenRouterKey(overrideKey?: string): string {
  if (overrideKey) return overrideKey;

  if (process.env.OPENROUTER_KEY) return process.env.OPENROUTER_KEY;

  // ~/.clacky/config.yml 是扁平数组，api_key 在 base_url 前面一行（YAML 列表项）
  // 格式：
  //   - api_key: sk-or-xxx
  //     base_url: https://openrouter.ai/api/v1
  try {
    const configPath = path.join(os.homedir(), ".clacky", "config.yml");
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        // 找 openrouter 的 base_url
        if (l.match(/^\s*base_url:\s*(.+)/) && /openrouter/i.test(l)) {
          // api_key 在前一行
          const keyLine = lines[i - 1]?.match(/^\s*-\s*api_key:\s*(.+)/);
          if (keyLine) {
            const key = keyLine[1].trim();
            if (key && key !== "null" && key !== "") return key;
          }
        }
      }
    }
  } catch {}

  throw new Error(
    "OpenRouter API Key not found. Set OPENROUTER_KEY env var, or configure ~/.clacky/config.yml with openrouter base_url entry."
  );
}

// ─────────────────────────────────────────────
// 图片下载/读取
// ─────────────────────────────────────────────
async function fetchImageAsBase64(imageUrl: string): Promise<{ base64: string; mimeType: string }> {
  // 本地文件
  if (!imageUrl.startsWith("http://") && !imageUrl.startsWith("https://")) {
    if (!fs.existsSync(imageUrl)) throw new Error(`Local file not found: ${imageUrl}`);
    const buf = fs.readFileSync(imageUrl);
    const ext = path.extname(imageUrl).toLowerCase().replace(/^\./, "");
    const mimeType = extToMime(ext);
    return { base64: buf.toString("base64"), mimeType };
  }

  // 远程 URL
  const response = await fetch(imageUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      Referer: "https://www.xiaohongshu.com/",
    },
  });

  if (!response.ok) throw new Error(`Failed to fetch image: ${response.status} ${imageUrl}`);

  const buffer = await response.arrayBuffer();
  const buf = Buffer.from(buffer);
  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
  return { base64: buf.toString("base64"), mimeType };
}

function extToMime(ext: string): string {
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    bmp: "image/bmp",
    avif: "image/avif",
    heic: "image/heic",
    svg: "image/svg+xml",
  };
  return map[ext.toLowerCase()] || "image/jpeg";
}

// ─────────────────────────────────────────────
// Vision API 调用
// ─────────────────────────────────────────────
interface VisionResult {
  index: number;
  url: string;
  text: string;
  error?: string;
}

async function analyzeImagesWithVision(
  images: Array<{ url: string; base64: string; mimeType: string }>,
  apiKey: string,
  model: string,
  batchIndex: number
): Promise<string> {
  const imageContents = images.map(({ base64, mimeType }) => ({
    type: "image_url" as const,
    image_url: { url: `data:${mimeType};base64,${base64}` },
  }));

  const prompt =
    `你是内容分析专家。这是第 ${batchIndex + 1} 组图片（共多组）。` +
    `请逐一提取每张图片中的所有文字内容，用中文回复。\n\n` +
    `要求：\n` +
    `1. 保持原有排版和层级结构\n` +
    `2. 注明每段文字来自哪张图（如"图1:"）\n` +
    `3. 如果图片是纯视觉内容（无文字），标注"无文字内容"\n` +
    `4. 简洁直接，不要解释分析过程\n`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: prompt }, ...imageContents],
        },
      ],
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Vision API error ${response.status}: ${errText}`);
  }

  const data = (await response.json()) as any;
  return data.choices?.[0]?.message?.content || "";
}

// ─────────────────────────────────────────────
// 主流程
// ─────────────────────────────────────────────
interface CliArgs {
  urls: string[];
  outputPath?: string;
  apiKey?: string;
  model: string;
  batchSize: number;
  urlsFile?: string;
}

function parseCliArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    urls: [],
    model: "google/gemini-2.5-flash-image",
    batchSize: 3,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-o" || arg === "--output") {
      args.outputPath = argv[++i];
    } else if (arg === "--api-key") {
      args.apiKey = argv[++i];
    } else if (arg === "--model") {
      args.model = argv[++i];
    } else if (arg === "--batch-size") {
      args.batchSize = parseInt(argv[++i], 10) || 3;
    } else if (arg === "--urls-file") {
      args.urlsFile = argv[++i];
    } else if (!arg.startsWith("-")) {
      args.urls.push(arg);
    }
  }

  return args;
}

async function main() {
  const args = parseCliArgs(process.argv);

  if (args.urlsFile) {
    const content = fs.readFileSync(args.urlsFile, "utf-8");
    const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
    args.urls.push(...lines);
  }

  if (args.urls.length === 0) {
    console.error("Usage: bun vision-extractor.ts <image-url-or-path> [...] [options]");
    console.error("  -o, --output <path>       Output file path");
    console.error("  --api-key <key>           OpenRouter API Key");
    console.error("  --model <model>           Vision model (default: google/gemini-2.5-flash-image)");
    console.error("  --batch-size <n>         Images per batch (default: 3)");
    console.error("  --urls-file <path>        File with one image URL per line");
    process.exit(1);
  }

  const apiKey = resolveOpenRouterKey(args.apiKey);
  console.error(`Using model: ${args.model}`);
  console.error(`Images: ${args.urls.length}, batch size: ${args.batchSize}`);

  // 批量下载 + 分析
  const allResults: string[] = [];
  const totalBatches = Math.ceil(args.urls.length / args.batchSize);

  for (let batch = 0; batch < totalBatches; batch++) {
    const batchUrls = args.urls.slice(batch * args.batchSize, (batch + 1) * args.batchSize);
    console.error(`\nProcessing batch ${batch + 1}/${totalBatches} (${batchUrls.length} images)...`);

    // 下载本批次图片
    const downloaded: Array<{ url: string; base64: string; mimeType: string }> = [];
    for (const url of batchUrls) {
      try {
        console.error(`  Fetching: ${url.slice(0, 80)}...`);
        const { base64, mimeType } = await fetchImageAsBase64(url);
        downloaded.push({ url, base64, mimeType });
      } catch (e) {
        console.error(`  Failed to fetch ${url}: ${e}`);
      }
    }

    if (downloaded.length === 0) {
      console.error(`  No images successfully fetched in this batch, skipping.`);
      continue;
    }

    // Vision 分析
    try {
      const analysis = await analyzeImagesWithVision(downloaded, apiKey, args.model, batch);
      allResults.push(`## 图片组 ${batch + 1}/${totalBatches}\n\n${analysis}`);
    } catch (e) {
      console.error(`  Vision analysis failed: ${e}`);
      allResults.push(`## 图片组 ${batch + 1}/${totalBatches}\n\n[分析失败: ${e}]`);
    }
  }

  // 输出
  const output = allResults.join("\n\n---\n\n");

  if (args.outputPath) {
    fs.mkdirSync(path.dirname(args.outputPath), { recursive: true });
    fs.writeFileSync(args.outputPath, output, "utf-8");
    console.error(`\nSaved: ${args.outputPath}`);
  } else {
    console.log(output);
  }
}

main().catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
