import { createInterface } from "node:readline";
import { writeFile, mkdir, access } from "node:fs/promises";
import * as fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "child_process";
import * as os from "os";

import { CdpConnection, getFreePort, findExistingChromePort, launchChrome, waitForChromeDebugPort, waitForNetworkIdle, waitForPageLoad, autoScroll, evaluateScript, killChrome } from "./cdp.js";
import { absolutizeUrlsScript, extractContent, createMarkdownDocument, type ConversionResult } from "./html-to-markdown.js";
import { localizeMarkdownMedia, countRemoteMedia } from "./media-localizer.js";
import { resolveUrlToMarkdownDataDir } from "./paths.js";
import { DEFAULT_TIMEOUT_MS, CDP_CONNECT_TIMEOUT_MS, NETWORK_IDLE_TIMEOUT_MS, POST_LOAD_DELAY_MS, SCROLL_STEP_WAIT_MS, SCROLL_MAX_STEPS } from "./constants.js";
import { readCache, writeCache, printCacheStatus, DEFAULT_TTL_HOURS_PAGE } from "./url-cache.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

interface Args {
  url: string;
  output?: string;
  outputDir?: string;
  wait: boolean;
  timeout: number;
  downloadMedia: boolean;
  browserMode: BrowserMode;
  noCache: boolean;
  cacheTtl: number;
  xhsVision: boolean;
}

type BrowserMode = "auto" | "headless" | "headed";

interface CaptureAttemptOptions {
  headless: boolean;
  wait: boolean;
  existingPort?: number;
  waitPrompt?: string;
}

interface CaptureSnapshot {
  html: string;
  finalUrl: string;
}

const BROWSER_MODES = new Set<BrowserMode>(["auto", "headless", "headed"]);

function parseArgs(argv: string[]): Args {
  const args: Args = {
    url: "",
    wait: false,
    timeout: DEFAULT_TIMEOUT_MS,
    downloadMedia: false,
    browserMode: "auto",
    noCache: false,
    cacheTtl: DEFAULT_TTL_HOURS_PAGE,
    xhsVision: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--wait" || arg === "-w") {
      args.wait = true;
    } else if (arg === "-o" || arg === "--output") {
      args.output = argv[++i];
    } else if (arg === "--timeout" || arg === "-t") {
      args.timeout = parseInt(argv[++i], 10) || DEFAULT_TIMEOUT_MS;
    } else if (arg === "--output-dir") {
      args.outputDir = argv[++i];
    } else if (arg === "--download-media") {
      args.downloadMedia = true;
    } else if (arg === "--no-cache") {
      args.noCache = true;
    } else if (arg === "--cache-ttl") {
      args.cacheTtl = parseInt(argv[++i], 10) || DEFAULT_TTL_HOURS_PAGE;
    } else if (arg === "--browser") {
      args.browserMode = (argv[++i] as BrowserMode | undefined) ?? "auto";
    } else if (arg === "--headless") {
      args.browserMode = "headless";
    } else if (arg === "--headed" || arg === "--noheadless" || arg === "--no-headless") {
      args.browserMode = "headed";
    } else if (arg === "--xhs-vision") {
      args.xhsVision = true;
    } else if (!arg.startsWith("-") && !args.url) {
      args.url = arg;
    }
  }
  return args;
}

const SLUG_STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "shall",
  "should", "may", "might", "must", "can", "could", "to", "of", "in",
  "for", "on", "with", "at", "by", "from", "as", "into", "through",
  "during", "before", "after", "above", "below", "between", "out",
  "off", "over", "under", "again", "further", "then", "once", "here",
  "there", "when", "where", "why", "how", "all", "both", "each",
  "few", "more", "most", "other", "some", "such", "no", "nor", "not",
  "only", "own", "same", "so", "than", "too", "very", "just", "but",
  "and", "or", "if", "this", "that", "these", "those", "it", "its",
  "http", "https", "www", "com", "org", "net", "post", "article",
]);

function extractSlugFromContent(content: string): string | null {
  const body = content.replace(/^---\n[\s\S]*?\n---\n?/, "").slice(0, 1000);
  const words = body
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => /^[a-zA-Z]/.test(w) && w.length >= 2 && !SLUG_STOP_WORDS.has(w.toLowerCase()))
    .map((w) => w.toLowerCase());

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const w of words) {
    if (!seen.has(w)) {
      seen.add(w);
      unique.push(w);
      if (unique.length >= 6) break;
    }
  }
  return unique.length >= 2 ? unique.join("-").slice(0, 50) : null;
}

function generateSlug(title: string, url: string, content?: string): string {
  const asciiWords = title
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => /[a-zA-Z]/.test(w) && w.length >= 2 && !SLUG_STOP_WORDS.has(w.toLowerCase()))
    .map((w) => w.toLowerCase());

  if (asciiWords.length >= 2) {
    return asciiWords.slice(0, 6).join("-").slice(0, 50);
  }

  if (content) {
    const contentSlug = extractSlugFromContent(content);
    if (contentSlug) return contentSlug;
  }

  const GENERIC_PATH_SEGMENTS = new Set(["status", "article", "post", "posts", "p", "blog", "news", "articles"]);
  const parsed = new URL(url);
  const pathSlug = parsed.pathname
    .split("/")
    .filter((s) => s.length > 0 && !/^\d{10,}$/.test(s) && !GENERIC_PATH_SEGMENTS.has(s.toLowerCase()))
    .join("-")
    .toLowerCase()
    .replace(/[^\w-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

  const prefix = asciiWords.slice(0, 2).join("-");
  const combined = prefix ? `${prefix}-${pathSlug}` : pathSlug;
  return combined.slice(0, 50) || "page";
}

function formatTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function deriveHtmlSnapshotPath(markdownPath: string): string {
  const parsed = path.parse(markdownPath);
  const basename = parsed.ext ? parsed.name : parsed.base;
  return path.join(parsed.dir, `${basename}-captured.html`);
}

function extractTitleFromMarkdownDocument(document: string): string {
  const normalized = document.replace(/\r\n/g, "\n");
  const frontmatterMatch = normalized.match(/^---\n([\s\S]*?)\n---\n?/);
  if (frontmatterMatch) {
    const titleLine = frontmatterMatch[1]
      .split("\n")
      .find((line) => /^title:\s*/i.test(line));

    if (titleLine) {
      const rawValue = titleLine.replace(/^title:\s*/i, "").trim();
      const unquoted = rawValue
        .replace(/^"(.*)"$/, "$1")
        .replace(/^'(.*)'$/, "$1")
        .replace(/\\"/g, '"');
      if (unquoted) return unquoted;
    }
  }

  const headingMatch = normalized.match(/^#\s+(.+)$/m);
  return headingMatch?.[1]?.trim() ?? "";
}

function buildDefuddleApiUrl(targetUrl: string): string {
  return `https://defuddle.md/${encodeURIComponent(targetUrl)}`;
}

async function fetchDefuddleApiMarkdown(targetUrl: string): Promise<{ markdown: string; title: string }> {
  const apiUrl = buildDefuddleApiUrl(targetUrl);
  const response = await fetch(apiUrl, {
    headers: {
      accept: "text/markdown,text/plain;q=0.9,*/*;q=0.1",
    },
  });

  if (!response.ok) {
    throw new Error(`defuddle.md returned ${response.status} ${response.statusText}`);
  }

  const markdown = (await response.text()).replace(/\r\n/g, "\n").trim();
  if (!markdown) {
    throw new Error("defuddle.md returned empty markdown");
  }

  return {
    markdown,
    title: extractTitleFromMarkdownDocument(markdown),
  };
}

async function generateOutputPath(url: string, title: string, outputDir?: string, content?: string): Promise<string> {
  const domain = new URL(url).hostname.replace(/^www\./, "");
  const slug = generateSlug(title, url, content);
  const dataDir = outputDir ? path.resolve(outputDir) : resolveUrlToMarkdownDataDir();
  const basePath = path.join(dataDir, domain, slug, `${slug}.md`);

  if (!(await fileExists(basePath))) {
    return basePath;
  }

  const timestampSlug = `${slug}-${formatTimestamp()}`;
  return path.join(dataDir, domain, timestampSlug, `${timestampSlug}.md`);
}

function defaultWaitPrompt(): string {
  return "A browser window has been opened. If the page requires login or verification, complete it first, then press Enter to capture.";
}

async function waitForUserSignal(prompt: string): Promise<void> {
  console.log(prompt);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  await new Promise<void>((resolve) => {
    rl.once("line", () => { rl.close(); resolve(); });
  });
}

async function captureUrlOnce(args: Args, options: CaptureAttemptOptions): Promise<ConversionResult> {
  const reusing = options.existingPort !== undefined;
  const port = options.existingPort ?? await getFreePort();
  const chrome = reusing ? null : await launchChrome(args.url, port, options.headless);

  if (reusing) {
    console.log(`Reusing existing Chrome on port ${port}`);
  } else {
    console.log(`Launching Chrome (${options.headless ? "headless" : "headed"})...`);
  }

  let cdp: CdpConnection | null = null;
  let targetId: string | null = null;
  try {
    const wsUrl = await waitForChromeDebugPort(port, 30_000);
    cdp = await CdpConnection.connect(wsUrl, CDP_CONNECT_TIMEOUT_MS);

    let sessionId: string;
    if (reusing) {
      const created = await cdp.send<{ targetId: string }>("Target.createTarget", { url: args.url });
      targetId = created.targetId;
      const attached = await cdp.send<{ sessionId: string }>("Target.attachToTarget", { targetId, flatten: true });
      sessionId = attached.sessionId;
      await cdp.send("Network.enable", {}, { sessionId });
      await cdp.send("Page.enable", {}, { sessionId });
    } else {
      const targets = await cdp.send<{ targetInfos: Array<{ targetId: string; type: string; url: string }> }>("Target.getTargets");
      const pageTarget = targets.targetInfos.find(t => t.type === "page" && t.url.startsWith("http"));
      if (!pageTarget) throw new Error("No page target found");
      targetId = pageTarget.targetId;
      const attached = await cdp.send<{ sessionId: string }>("Target.attachToTarget", { targetId, flatten: true });
      sessionId = attached.sessionId;
      await cdp.send("Network.enable", {}, { sessionId });
      await cdp.send("Page.enable", {}, { sessionId });
    }

    if (options.wait) {
      await waitForUserSignal(options.waitPrompt ?? defaultWaitPrompt());
    } else {
      console.log("Waiting for page to load...");
      await Promise.race([
        waitForPageLoad(cdp, sessionId, 15_000),
        sleep(8_000)
      ]);
      await waitForNetworkIdle(cdp, sessionId, NETWORK_IDLE_TIMEOUT_MS);
      await sleep(POST_LOAD_DELAY_MS);
      console.log("Scrolling to trigger lazy load...");
      await autoScroll(cdp, sessionId, SCROLL_MAX_STEPS, SCROLL_STEP_WAIT_MS);
      await sleep(POST_LOAD_DELAY_MS);
    }

    console.log("Capturing page content...");
    let snapshot: CaptureSnapshot;
    try {
      const rawSnapshot = await evaluateScript<CaptureSnapshot>(
        cdp, sessionId, absolutizeUrlsScript, args.timeout
      );
      if (rawSnapshot?.html) {
        snapshot = rawSnapshot;
      } else {
        // absolutizeUrlsScript 因页面 JS 异常返回 undefined，降级用简单抓取
        throw new Error("absolutizeUrlsScript returned empty result");
      }
    } catch (evalErr) {
      // 页面自身 JS 异常（如小红书的 "Can't find variable: outputPath"）不应 crash 抓取流程。
      // 降级用简单脚本拿 HTML，功能完整但不做 URL 绝对化处理。
      console.warn(`[capture] absolutizeUrlsScript failed (${evalErr instanceof Error ? evalErr.message : evalErr}), falling back to raw HTML extraction`);
      const fallbackHtml = await evaluateScript<string>(
        cdp, sessionId, `document.documentElement.outerHTML`, 10_000
      );
      const finalUrl = await evaluateScript<string>(
        cdp, sessionId, `location.href`, 5_000
      );
      snapshot = { html: fallbackHtml ?? "", finalUrl: finalUrl ?? args.url };
    }
    return await extractContent(snapshot.html, snapshot.finalUrl || args.url, {
      preserveBase64Images: args.downloadMedia,
    });
  } finally {
    if (reusing) {
      if (cdp && targetId) {
        try { await cdp.send("Target.closeTarget", { targetId }, { timeoutMs: 5_000 }); } catch {}
      }
      if (cdp) cdp.close();
    } else {
      if (cdp) {
        try { await cdp.send("Browser.close", {}, { timeoutMs: 5_000 }); } catch {}
        cdp.close();
      }
      if (chrome) killChrome(chrome);
    }
  }
}

async function runHeadedFlow(
  args: Args,
  options: { existingPort?: number; wait: boolean; waitPrompt?: string }
): Promise<ConversionResult> {
  return await captureUrlOnce(args, {
    headless: false,
    wait: options.wait,
    existingPort: options.existingPort,
    waitPrompt: options.waitPrompt,
  });
}

async function captureUrl(args: Args): Promise<ConversionResult> {
  const existingPort = await findExistingChromePort();
  if (existingPort !== null) {
    console.log("Found an existing Chrome session for this profile. Reusing it instead of launching a new browser.");
    return await runHeadedFlow(args, {
      existingPort,
      wait: args.wait,
      waitPrompt: args.wait ? defaultWaitPrompt() : undefined,
    });
  }

  if (args.browserMode === "headless") {
    return await captureUrlOnce(args, { headless: true, wait: false });
  }

  if (args.browserMode === "headed") {
    return await runHeadedFlow(args, {
      wait: args.wait,
      waitPrompt: args.wait ? defaultWaitPrompt() : undefined,
    });
  }

  if (args.wait) {
    return await runHeadedFlow(args, {
      wait: true,
      waitPrompt: defaultWaitPrompt(),
    });
  }

  try {
    return await captureUrlOnce(args, { headless: true, wait: false });
  } catch (error) {
    const headlessMessage = error instanceof Error ? error.message : String(error);
    console.warn(`Headless capture failed: ${headlessMessage}`);
    console.log("Retrying with a visible browser window...");

    try {
      return await runHeadedFlow(args, { wait: false });
    } catch (headedError) {
      const headedMessage = headedError instanceof Error ? headedError.message : String(headedError);
      throw new Error(`Headless capture failed (${headlessMessage}); headed retry failed (${headedMessage})`);
    }
  }
}

// ─────────────────────────────────────────────
// 视频平台自动路由（平台分层路由）
// ─────────────────────────────────────────────

// 纯视频平台：URL 出现即代表有视频，直接走 yt-dlp，无需探测
const PURE_VIDEO_PLATFORM_PATTERNS = [
  /youtube\.com\/watch/,
  /youtu\.be\//,
  /bilibili\.com\/video/,
  /b23\.tv\//,
  /douyin\.com\//,
  /v\.douyin\.com\//,
  /tiktok\.com\//,
];

// 混合平台：图文+视频都有，需要先探测页面是否有 <video> 元素
const MIXED_PLATFORM_PATTERNS = [
  /xiaohongshu\.com\//,
  /xhslink\.com\//,
  /weibo\.com\//,
  /weibo\.cn\//,
];

function isPureVideoPlatformUrl(url: string): boolean {
  return PURE_VIDEO_PLATFORM_PATTERNS.some((re) => re.test(url));
}

function isMixedPlatformUrl(url: string): boolean {
  return MIXED_PLATFORM_PATTERNS.some((re) => re.test(url));
}

/**
 * 对混合平台（小红书/微博）使用浏览器探测是否存在 <video> 元素。
 * 返回 true 表示页面有视频，应走 video-extractor；
 * 返回 false 表示图文帖，应走普通浏览器抓取。
 */
async function detectVideoElementInPage(url: string, browserMode: string): Promise<boolean> {
  console.log(`[auto-route] Mixed platform detected, probing for <video> element...`);
  const headless = browserMode !== "headed";
  const port = await getFreePort();
  const chromeProc = await launchChrome(port, headless);
  let cdp: CdpConnection | null = null;
  let targetId: string | undefined;
  try {
    await waitForChromeDebugPort(port, 10_000);
    const wsUrl = `ws://127.0.0.1:${port}/json`;
    cdp = await CdpConnection.connect(wsUrl, 10_000);
    const created = await cdp.send<{ targetId: string }>("Target.createTarget", { url });
    targetId = created.targetId;
    const attached = await cdp.send<{ sessionId: string }>("Target.attachToTarget", { targetId, flatten: true });
    const sessionId = attached.sessionId;
    await cdp.send("Page.enable", {}, { sessionId });
    await waitForPageLoad(cdp, sessionId, 15_000).catch(() => {});
    // 额外等待 2 秒让视频元素渲染出来
    await new Promise(r => setTimeout(r, 2000));
    const result = await evaluateScript(cdp, sessionId, `
      (function() {
        var videos = document.querySelectorAll("video");
        return videos.length > 0 && Array.from(videos).some(function(v) {
          return v.src || v.querySelector("source");
        });
      })()
    `, 8_000);
    const hasVideo = result === true;
    console.log(`[auto-route] Video element probe: ${hasVideo ? "found ✅" : "not found ❌"}`);
    return hasVideo;
  } catch (e) {
    console.log(`[auto-route] Probe failed (${e}), defaulting to browser extraction`);
    return false;
  } finally {
    if (cdp && targetId) {
      try { await cdp.send("Target.closeTarget", { targetId }, { timeoutMs: 3_000 }); } catch {}
    }
    if (cdp) cdp.close();
    killChrome(chromeProc);
  }
}

// ─────────────────────────────────────────────
// XHS 图文 Vision 提取（通过 Chrome CDP 下载图片 + OpenRouter 识别文字）
// ─────────────────────────────────────────────

const XHS_CDN_PATTERN = /xiaohongshu\.com|xhslink\.com/;

function extractImageUrlsFromMarkdown(markdown: string): string[] {
  const urls: string[] = [];
  const imgRe = /!\[([^\]]*)\]\(([^)\s]+)\)/g;
  let m;
  while ((m = imgRe.exec(markdown)) !== null) {
    const url = m[2].trim();
    if (url.startsWith("http://") || url.startsWith("https://")) {
      urls.push(url);
    }
  }
  return urls;
}

/**
 * 通过 Chrome CDP 下载图片（使用已有的 Chrome 调试端口，包含登录态）
 */
async function downloadImageViaChromeCDP(imageUrl: string, existingPort: number): Promise<Buffer> {
  const wsUrl = `ws://127.0.0.1:${existingPort}/json`;
  const cdp = await CdpConnection.connect(wsUrl, CDP_CONNECT_TIMEOUT_MS);

  // 创建新标签页打开图片 URL
  const created = await cdp.send<{ targetId: string }>("Target.createTarget", { url: "about:blank" });
  const targetId = created.targetId;
  const attached = await cdp.send<{ sessionId: string }>("Target.attachToTarget", { targetId, flatten: true });
  const sessionId = attached.sessionId;

  await cdp.send("Page.enable", {}, { sessionId });

  try {
    // 导航到图片 URL
    await cdp.send("Page.navigate", { url: imageUrl }, { sessionId });

    // 等待图片加载（等待 networkidle 或最多 10 秒）
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 10_000);
      const handler = () => { clearTimeout(timeout); cdp.removeListener("Page.loadEventFired", handler); resolve(); };
      cdp.on("Page.loadEventFired", handler);
    });
    await sleep(2_000); // 额外等待确保图片完全渲染

    // 使用 evaluateScript 把图片转成 base64
    const dataUrl: string = await evaluateScript<string>(cdp, sessionId, `
      (function() {
        var imgs = document.querySelectorAll("img");
        if (imgs.length === 0) {
          // 可能直接是图片（没有 <img> 标签），尝试 <image> 或 background
          var imgs2 = document.getElementsByTagName("image");
          if (imgs2.length > 0) return null;
        }
        for (var i = 0; i < imgs.length; i++) {
          var c = document.createElement("canvas");
          c.width = imgs[i].naturalWidth || imgs[i].clientWidth;
          c.height = imgs[i].naturalHeight || imgs[i].clientHeight;
          var ctx = c.getContext("2d");
          if (!ctx) continue;
          try {
            ctx.drawImage(imgs[i], 0, 0);
            return c.toDataURL("image/png");
          } catch(e) {}
        }
        return null;
      })()
    `, 10_000);

    // 如果 JS 方式失败，用截图方式
    if (!dataUrl) {
      console.log(`  [xhs-vision] JS extraction failed, using screenshot fallback`);
      const screenshot = await cdp.send<{ data: string }>("Page.captureScreenshot", { format: "png" }, { sessionId });
      const buf = Buffer.from(screenshot.data, "base64");
      return buf;
    }

    // 解析 dataUrl（格式：data:image/png;base64,xxxxx）
    const base64 = dataUrl.split(",")[1];
    if (!base64) throw new Error("Failed to extract base64 from data URL");
    return Buffer.from(base64, "base64");
  } finally {
    if (cdp && targetId) {
      try { await cdp.send("Target.closeTarget", { targetId }, { timeoutMs: 5_000 }); } catch {}
    }
    if (cdp) cdp.close();
  }
}

/**
 * 运行 XHS 图文 Vision 提取流程
 * 返回追加到 markdown 的内容片段
 */
async function runXhsVisionExtraction(htmlSnapshotPath: string | null, outputPath: string, xhsImageUrls: string[]): Promise<string | null> {
  if (xhsImageUrls.length === 0) return null;

  // 找已有 Chrome 调试端口（复用登录态）
  const existingPort = await findExistingChromePort();
  if (existingPort === null) {
    console.log(`[xhs-vision] No existing Chrome session found. Skipping vision extraction.`);
    console.log(`[xhs-vision] Tip: Open Chrome with remote debugging first (e.g., via OpenClaw browser tool).`);
    return null;
  }

  console.log(`[xhs-vision] Using Chrome port ${existingPort} for authenticated image download`);

  const tmpDir = path.join(os.tmpdir(), `xhs-vision-${Date.now()}`);
  await mkdir(tmpDir, { recursive: true });

  const downloadedPaths: string[] = [];

  // 下载每张图片
  for (let i = 0; i < xhsImageUrls.length; i++) {
    const url = xhsImageUrls[i];
    const ext = path.extname(new URL(url).pathname).replace(/^\./, "") || "png";
    const localPath = path.join(tmpDir, `img-${String(i + 1).padStart(3, "0")}.${ext}`);
    console.log(`[xhs-vision] Downloading image ${i + 1}/${xhsImageUrls.length}: ${url.slice(0, 80)}...`);
    try {
      const buf = await downloadImageViaChromeCDP(url, existingPort);
      await writeFile(localPath, buf);
      downloadedPaths.push(localPath);
    } catch (e) {
      console.log(`[xhs-vision] Failed to download ${url}: ${e}`);
    }
  }

  if (downloadedPaths.length === 0) {
    console.log(`[xhs-vision] No images successfully downloaded.`);
    return null;
  }

  console.log(`[xhs-vision] Analyzing ${downloadedPaths.length} images with vision API...`);

  // 调用 vision-extractor.ts
  const scriptDir = new URL(".", import.meta.url).pathname;
  const visionScript = path.join(scriptDir, "vision-extractor.ts");
  const outputFile = path.join(tmpDir, "vision-result.md");

  const result = spawnSync(process.execPath, [
    visionScript,
    "--urls-file", "/dev/null", // 忽略，放前面会被误读
    "--batch-size", "3",
    "-o", outputFile,
    ...downloadedPaths, // 传本地文件路径
  ], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env }, // 继承环境变量，OPENROUTER_KEY 在其中
  });

  if (result.status !== 0) {
    console.log(`[xhs-vision] vision-extractor failed: ${result.stderr?.toString()}`);
    return null;
  }

  if (!fs.existsSync(outputFile)) {
    console.log(`[xhs-vision] No vision output file produced.`);
    return null;
  }

  const visionText = fs.readFileSync(outputFile, "utf-8");

  // 清理临时目录
  try { fs.rmSync(tmpDir, { recursive: true }); } catch {}

  return visionText;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  if (!args.url) {
    console.error("Usage: bun main.ts <url> [-o output.md] [--output-dir dir] [--wait] [--browser auto|headless|headed] [--timeout ms] [--download-media] [--xhs-vision]");
    process.exit(1);
  }

  try {
    new URL(args.url);
  } catch {
    console.error(`Invalid URL: ${args.url}`);
    process.exit(1);
  }

  // ── 自动路由：平台分层路由 ──────────────────────────────────────────────
  // exit code 88 = video-extractor 遇到"无视频内容"，回退到浏览器抓取
  const EXIT_CODE_NO_VIDEO = 88;

  const routeToVideoExtractor = async () => {
    const { spawnSync } = await import("child_process");
    const scriptDir = new URL(".", import.meta.url).pathname;
    const videoExtractor = path.join(scriptDir, "video-extractor.ts");
    const forwardArgs = process.argv.slice(2);
    const result = spawnSync(process.execPath, [videoExtractor, ...forwardArgs], {
      stdio: "inherit",
      env: process.env,
    });
    return result.status ?? 0;
  };

  if (isPureVideoPlatformUrl(args.url)) {
    // 纯视频平台：直接走 yt-dlp，不需要探测
    console.log(`[auto-route] Pure video platform → video-extractor.ts`);
    const exitCode = await routeToVideoExtractor();
    if (exitCode === EXIT_CODE_NO_VIDEO) {
      // 极少数情况（如视频已删除），回退到浏览器抓取
      console.log(`[auto-route] yt-dlp: no video found (exit 88), falling back to browser extraction`);
    } else {
      process.exit(exitCode);
    }
  } else if (isMixedPlatformUrl(args.url)) {
    // 混合平台（小红书/微博）：先探测是否有 <video> 元素
    const hasVideo = await detectVideoElementInPage(args.url, args.browserMode);
    if (hasVideo) {
      console.log(`[auto-route] Mixed platform: video found → video-extractor.ts`);
      const exitCode = await routeToVideoExtractor();
      if (exitCode === EXIT_CODE_NO_VIDEO) {
        console.log(`[auto-route] yt-dlp: no video formats (exit 88), falling back to browser extraction`);
        // 不 exit，继续走下方普通浏览器抓取
      } else {
        process.exit(exitCode);
      }
    } else {
      console.log(`[auto-route] Mixed platform: no video detected → browser extraction`);
      // 不 exit，继续走普通浏览器抓取流程
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  if (!BROWSER_MODES.has(args.browserMode)) {
    console.error(`Invalid --browser mode: ${args.browserMode}. Expected auto, headless, or headed.`);
    process.exit(1);
  }

  if (args.wait && args.browserMode === "headless") {
    console.error("Error: --wait requires a visible browser. Use --browser auto or --browser headed.");
    process.exit(1);
  }

  if (args.output) {
    const stat = await import("node:fs").then(fs => fs.statSync(args.output!, { throwIfNoEntry: false }));
    if (stat?.isDirectory()) {
      console.error(`Error: -o path is a directory, not a file: ${args.output}`);
      process.exit(1);
    }
  }

  console.log(`Fetching: ${args.url}`);
  console.log(`Mode: ${args.wait ? "wait" : "auto"}`);
  console.log(`Browser: ${args.browserMode}`);

  // ─── 缓存检查 ────────────────────────────────────────────────────────────
  const cacheResult = await readCache(args.url, args.noCache);
  printCacheStatus(cacheResult, args.url);
  if (cacheResult.hit && !args.output) {
    // 命中且用户没有指定自定义输出路径 → 直接返回缓存内容，不拉网络
    console.log(`Saved: ${cacheResult.entry.md_path}  (from cache)`);
    if (cacheResult.entry.html_path) {
      console.log(`Saved HTML: ${cacheResult.entry.html_path}  (from cache)`);
    }
    console.log(`Title: ${extractTitleFromMarkdownDocument(cacheResult.markdown) || "(no title)"}`);
    console.log(`Converter: cache`);
    return;
  }
  // ─────────────────────────────────────────────────────────────────────────

  let outputPath: string;
  let htmlSnapshotPath: string | null = null;
  let document: string;
  let conversionMethod: string;
  let fallbackReason: string | undefined;

  try {
    const result = await captureUrl(args);
    document = createMarkdownDocument(result);
    outputPath = args.output || await generateOutputPath(result.metadata.url || args.url, result.metadata.title, args.outputDir, document);
    const outputDir = path.dirname(outputPath);
    htmlSnapshotPath = deriveHtmlSnapshotPath(outputPath);
    await mkdir(outputDir, { recursive: true });
    await writeFile(htmlSnapshotPath, result.rawHtml, "utf-8");
    conversionMethod = result.conversionMethod;
    fallbackReason = result.fallbackReason;
  } catch (error) {
    const primaryError = error instanceof Error ? error.message : String(error);
    console.warn(`Primary capture failed: ${primaryError}`);
    console.warn("Trying defuddle.md API fallback...");

    try {
      const remoteResult = await fetchDefuddleApiMarkdown(args.url);
      document = remoteResult.markdown;
      outputPath = args.output || await generateOutputPath(args.url, remoteResult.title, args.outputDir, document);
      await mkdir(path.dirname(outputPath), { recursive: true });
      conversionMethod = "defuddle-api";
      fallbackReason = `Local browser capture failed: ${primaryError}`;
    } catch (remoteError) {
      const remoteMessage = remoteError instanceof Error ? remoteError.message : String(remoteError);
      throw new Error(`Local browser capture failed (${primaryError}); defuddle.md fallback failed (${remoteMessage})`);
    }
  }

  if (args.downloadMedia) {
    const mediaResult = await localizeMarkdownMedia(document, {
      markdownPath: outputPath,
      log: console.log,
    });
    document = mediaResult.markdown;
    if (mediaResult.downloadedImages > 0 || mediaResult.downloadedVideos > 0) {
      console.log(`Downloaded: ${mediaResult.downloadedImages} images, ${mediaResult.downloadedVideos} videos`);
    }
  } else {
    const { images, videos } = countRemoteMedia(document);
    if (images > 0 || videos > 0) {
      console.log(`Remote media found: ${images} images, ${videos} videos`);
    }
  }

  await writeFile(outputPath, document, "utf-8");

  // ─── XHS 图文 Vision 提取 ───────────────────────────────────────────────
  if (args.xhsVision && isMixedPlatformUrl(args.url)) {
    console.log(`[xhs-vision] XHS image post detected, running vision extraction...`);
    const imgUrls = extractImageUrlsFromMarkdown(document).filter((u) => XHS_CDN_PATTERN.test(u));
    if (imgUrls.length > 0) {
      const visionText = await runXhsVisionExtraction(htmlSnapshotPath, outputPath, imgUrls);
      if (visionText && visionText.trim()) {
        const updatedDoc = document + "\n\n## 图片文字识别\n\n" + visionText.trim() + "\n";
        await writeFile(outputPath, updatedDoc, "utf-8");
        console.log(`[xhs-vision] Appended vision extraction results (${visionText.trim().length} chars)`);
      }
    } else {
      console.log(`[xhs-vision] No XHS image URLs found in markdown, skipping.`);
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  // ─── 写入缓存索引 ─────────────────────────────────────────────────────────
  try {
    await writeCache(
      args.url,
      outputPath,
      htmlSnapshotPath ?? undefined,
      args.cacheTtl
    );
  } catch (cacheErr) {
    // 缓存写入失败不影响主流程
    console.warn(`Cache write skipped: ${cacheErr instanceof Error ? cacheErr.message : String(cacheErr)}`);
  }
  // ─────────────────────────────────────────────────────────────────────────

  console.log(`Saved: ${outputPath}`);
  if (htmlSnapshotPath) {
    console.log(`Saved HTML: ${htmlSnapshotPath}`);
  } else {
    console.log("Saved HTML: unavailable (defuddle.md fallback)");
  }
  console.log(`Title: ${extractTitleFromMarkdownDocument(document) || "(no title)"}`);
  console.log(`Converter: ${conversionMethod}`);
  if (fallbackReason) {
    console.warn(`Fallback used: ${fallbackReason}`);
  }
}

main().catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
