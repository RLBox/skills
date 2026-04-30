/**
 * url-cache.ts
 *
 * URL → Markdown 缓存模块
 *
 * 缓存目录：~/.cache/sengclaw-skills/url-to-markdown-cache/
 * 缓存 key ：URL 的 SHA-256 前 16 位 hex
 * 每条缓存：{key}.json（索引） + 关联的 .md 文件路径
 *
 * 索引结构：
 * {
 *   url: string,
 *   cached_at: ISO string,
 *   ttl_hours: number,
 *   md_path: string,    // 实际 markdown 文件绝对路径
 *   html_path?: string  // 可选，已保存的 HTML 快照路径
 * }
 *
 * 命中条件：索引存在 + md 文件存在 + 未过期
 */

import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import path from "node:path";
import { resolveUrlCacheDir } from "./paths.js";

export const DEFAULT_TTL_HOURS_PAGE = 24;   // 普通网页 24 小时
export const DEFAULT_TTL_HOURS_VIDEO = 168; // 视频内容 7 天（168 小时）

export interface CacheEntry {
  url: string;
  cached_at: string;
  ttl_hours: number;
  md_path: string;
  html_path?: string;
}

export interface CacheHit {
  hit: true;
  entry: CacheEntry;
  markdown: string;
}

export interface CacheMiss {
  hit: false;
  reason: string;
}

export type CacheResult = CacheHit | CacheMiss;

// ─── URL → Cache Key ────────────────────────────────────────────────────────

/**
 * 对 URL 做 SHA-256，取前 16 位 hex 作为缓存 key。
 * 相同 URL 永远得到相同 key，不同 URL 碰撞概率极低。
 */
export function urlToCacheKey(url: string): string {
  return createHash("sha256").update(url.trim()).digest("hex").slice(0, 16);
}

// ─── 路径辅助 ─────────────────────────────────────────────────────────────────

function indexPath(key: string): string {
  return path.join(resolveUrlCacheDir(), `${key}.json`);
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

// ─── 读缓存 ───────────────────────────────────────────────────────────────────

/**
 * 查询 URL 是否有有效缓存。
 *
 * @param url        完整 URL
 * @param noCache    true = 强制跳过缓存（--no-cache 时传入）
 * @returns          CacheHit（命中）或 CacheMiss（未命中，含原因）
 */
export async function readCache(url: string, noCache = false): Promise<CacheResult> {
  if (noCache) {
    return { hit: false, reason: "--no-cache flag set" };
  }

  const key = urlToCacheKey(url);
  const idx = indexPath(key);

  if (!(await fileExists(idx))) {
    return { hit: false, reason: "no cache index found" };
  }

  let entry: CacheEntry;
  try {
    const raw = await readFile(idx, "utf-8");
    entry = JSON.parse(raw) as CacheEntry;
  } catch {
    return { hit: false, reason: "failed to parse cache index" };
  }

  // TTL 检查
  const cachedAt = new Date(entry.cached_at).getTime();
  const expiresAt = cachedAt + entry.ttl_hours * 60 * 60 * 1000;
  if (Date.now() > expiresAt) {
    const agoHours = ((Date.now() - cachedAt) / 3_600_000).toFixed(1);
    return { hit: false, reason: `cache expired (${agoHours}h old, ttl=${entry.ttl_hours}h)` };
  }

  // md 文件是否存在
  if (!(await fileExists(entry.md_path))) {
    return { hit: false, reason: `cached md file not found: ${entry.md_path}` };
  }

  let markdown: string;
  try {
    markdown = await readFile(entry.md_path, "utf-8");
  } catch {
    return { hit: false, reason: "failed to read cached markdown" };
  }

  return { hit: true, entry, markdown };
}

// ─── 写缓存 ───────────────────────────────────────────────────────────────────

/**
 * 将成功抓取的结果写入缓存索引。
 * （markdown 文件本身已由调用方写到 md_path，这里只写索引。）
 *
 * @param url       完整 URL
 * @param mdPath    已写入的 markdown 文件绝对路径
 * @param htmlPath  可选，已保存的 HTML 快照绝对路径
 * @param ttlHours  TTL（小时），默认 DEFAULT_TTL_HOURS_PAGE
 */
export async function writeCache(
  url: string,
  mdPath: string,
  htmlPath?: string,
  ttlHours = DEFAULT_TTL_HOURS_PAGE
): Promise<void> {
  const key = urlToCacheKey(url);
  const cacheDir = resolveUrlCacheDir();

  try {
    await mkdir(cacheDir, { recursive: true });
  } catch {
    // ignore if already exists
  }

  const entry: CacheEntry = {
    url,
    cached_at: new Date().toISOString(),
    ttl_hours: ttlHours,
    md_path: path.resolve(mdPath),
    ...(htmlPath ? { html_path: path.resolve(htmlPath) } : {}),
  };

  await writeFile(indexPath(key), JSON.stringify(entry, null, 2), "utf-8");
}

// ─── 缓存状态打印 ─────────────────────────────────────────────────────────────

export function printCacheStatus(result: CacheResult, url: string): void {
  if (result.hit) {
    const cachedAt = new Date(result.entry.cached_at);
    const agoMin = Math.round((Date.now() - cachedAt.getTime()) / 60_000);
    const agoStr = agoMin < 60
      ? `${agoMin}m ago`
      : `${(agoMin / 60).toFixed(1)}h ago`;
    console.log(`Cache HIT  [${urlToCacheKey(url)}]  cached ${agoStr}  →  ${result.entry.md_path}`);
  } else {
    console.log(`Cache MISS [${urlToCacheKey(url)}]  reason: ${result.reason}`);
  }
}
