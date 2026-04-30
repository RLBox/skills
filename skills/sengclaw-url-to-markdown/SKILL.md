---
---
name: sengclaw-url-to-markdown
description: >-
  通过 Chrome CDP 抓取任意网页并转换为 Markdown；同时支持视频 URL（YouTube、B站、抖音、小红书、TikTok、微博）→ 用 yt-dlp
  提取字幕/关键帧 + 豆包多模态分析，输出结构化 Markdown。支持 --download-video 下载完整视频文件（默认保存到 ~/Downloads/videos）。
  抖音自动使用 Chrome cookies。支持保存渲染后的 HTML 快照，升级版 Defuddle 管道，本地浏览器失败时回退 defuddle.md API。
  当用户说「保存网页」「抓取文章」「把这个页面转成 Markdown」，
  或「分析这个视频」「把视频内容转文字」「学习这个视频」「下载这个视频」「保存小红书视频」「下载抖音视频」时使用。
version: 1.59.0
metadata:
  openclaw:
    requires:
      anyBins:
      - bun
      - npx
disable-model-invocation: false
---

# URL to Markdown

Fetches any URL via Chrome CDP, saves the rendered HTML snapshot, and converts it to clean markdown.

## Script Directory

**Important**: All scripts are located in the `scripts/` subdirectory of this skill.

**Agent Execution Instructions**:
1. Determine this SKILL.md file's directory path as `{baseDir}`
2. Script path = `{baseDir}/scripts/<script-name>.ts`
3. Resolve `${BUN_X}` runtime: if `bun` installed → `bun`; if `npx` available → `npx -y bun`; else suggest installing bun
4. Replace all `{baseDir}` and `${BUN_X}` in this document with actual values

**Script Reference**:
| Script | Purpose |
|--------|---------|
| `scripts/main.ts` | CLI entry point for URL fetching |
| `scripts/html-to-markdown.ts` | Markdown conversion entry point and converter selection |
| `scripts/parsers/index.ts` | Unified parser entry: dispatches URL-specific rules before generic converters |
| `scripts/parsers/types.ts` | Unified parser interface shared by all rule files |
| `scripts/parsers/rules/*.ts` | One file per URL rule, for example X status and X article |
| `scripts/defuddle-converter.ts` | Defuddle-based conversion |
| `scripts/legacy-converter.ts` | Pre-Defuddle legacy extraction and markdown conversion |
| `scripts/markdown-conversion-shared.ts` | Shared metadata parsing and markdown document helpers |
| `scripts/video-extractor.ts` | Video URL → Markdown + optional download (yt-dlp + Doubao vision) |
| `scripts/vision-extractor.ts` | 图片 URL/路径 → 图片文字识别（OpenRouter Gemini Flash Vision API） |

## Video URL Processing

When the input URL is a **video platform URL** (YouTube, Bilibili, Douyin, XiaoHongShu, TikTok, Weibo), use `video-extractor.ts` instead of `main.ts`.

### Supported Platforms

| Platform | URL Pattern | Subtitle Support | Notes |
|----------|-------------|-----------------|-------|
| YouTube | `youtube.com/watch`, `youtu.be/` | ✅ 官方字幕 + 自动字幕 | |
| B站 | `bilibili.com/video`, `b23.tv/` | ✅ CC 字幕 | |
| 抖音 | `douyin.com/`, `v.douyin.com/` | ⚠️ 视觉分析为主 | **自动使用 Chrome cookies** |
| 小红书 | `xiaohongshu.com/`, `xhslink.com/` | ⚠️ 视觉分析为主 | yt-dlp 原生支持 |
| TikTok | `tiktok.com/` | ⚠️ 视觉分析为主 | |
| 微博 | `weibo.com/`, `weibo.cn/` | ⚠️ 视觉分析为主 | |

**抖音特殊处理**：抖音需要登录 cookie，video-extractor.ts 会自动添加 `--cookies-from-browser chrome`。需要确保 Chrome 里已登录抖音。可用 `--no-cookies` 跳过。

### Video Processing Workflow

```
视频 URL
  ↓
1. yt-dlp --dump-json → 提取元数据（标题、作者、时长、简介）
   抖音：自动加 --cookies-from-browser chrome
  ↓
2. yt-dlp --write-subs --write-auto-subs → 下载字幕（zh-Hans > zh > en）
  ↓
  ├─ 有字幕 → 轻量视觉分析（4帧，了解视觉风格）
  └─ 无字幕 → 完整视觉分析（8帧，提取内容）
              ↓
              yt-dlp 下载低质量视频 → ffmpeg 截关键帧
              → 豆包多模态 API 分析帧内容
  ↓
3. 可选 --download-video → yt-dlp 下载完整高清视频到 ~/Downloads/videos/
  ↓
4. 生成 Markdown（元数据 + 内容分析 + 字幕 + 视频路径）
```

### Video Extractor Usage

```bash
# 基础用法（只分析，不下载视频）
${BUN_X} {baseDir}/scripts/video-extractor.ts <video-url>

# 分析 + 下载视频到 ~/Downloads/videos/
${BUN_X} {baseDir}/scripts/video-extractor.ts <url> --download-video

# 下载视频到指定目录
${BUN_X} {baseDir}/scripts/video-extractor.ts <url> --download-video --video-dir ~/Desktop

# 指定输出目录
${BUN_X} {baseDir}/scripts/video-extractor.ts <url> --output-dir ./url-to-markdown

# 只要字幕/元数据，跳过视觉分析（快）
${BUN_X} {baseDir}/scripts/video-extractor.ts <url> --no-vision

# 抖音（自动加 cookies，需已在 Chrome 登录抖音）
${BUN_X} {baseDir}/scripts/video-extractor.ts https://v.douyin.com/xxx

# 禁用 cookies（调试用）
${BUN_X} {baseDir}/scripts/video-extractor.ts <url> --no-cookies
```

### Video Extractor Options

| Option | Default | Description |
|--------|---------|-------------|
| `-o <path>` | auto | 输出 Markdown 文件路径 |
| `--output-dir <dir>` | `./url-to-markdown` | 输出目录，自动生成 `{dir}/{platform}/{slug}.md` |
| `--download-video` | false | **同时下载完整视频文件** |
| `--video-dir <dir>` | `~/Downloads/videos` | 视频保存目录（`--download-video` 时生效）|
| `--lang <langs>` | `zh-Hans,zh,en` | 字幕语言优先级（逗号分隔） |
| `--frames <n>` | `8` | 无字幕时截帧数量 |
| `--no-vision` | false | 跳过豆包多模态分析（快速模式） |
| `--no-cookies` | false | 禁用 Chrome cookies（抖音默认开启） |
| `--ark-key <key>` | auto | ARK API Key（优先级：参数 > `ARK_API_KEY` 环境变量 > `~/.clacky/config.yml`） |
| `--model <model>` | `doubao-seed-2-0-lite` | 豆包视觉模型 |

### Intent → Command Mapping

| 用户说 | 触发行为 |
|--------|---------|
| 「分析这个视频」「学习这个视频」| 只分析，不下载 |
| 「把视频内容转文字」| 只分析，`--no-vision` 可加速 |
| 「下载这个视频」「保存视频」| 分析 + `--download-video` |
| 「下载到桌面/指定目录」| 分析 + `--download-video --video-dir <path>` |
| 「快速分析」「只要标题」| 加 `--no-vision` |

```bash
# yt-dlp（必须）
~/.local/bin/yt-dlp --version || yt-dlp --version
# 如未安装：uv tool install yt-dlp

# ffmpeg（视觉分析时需要，字幕模式可选）
which ffmpeg
# 如未安装：brew install ffmpeg

# ARK API Key
# 自动读取 ~/.clacky/config.yml 中 ark.cn-beijing.volces.com 的 api_key
```

### Video Output Format

```markdown
---
url: https://...
title: "视频标题"
author: "UP主/作者"
platform: youtube/bilibili/douyin/xiaohongshu
duration: "12:34"
published: "2026-01-01"
view_count: 123456
captured_at: "2026-04-04T..."
source_type: video
---

# 视频标题

> **平台**：bilibili | **作者**：xxx | **发布**：2026-01-01 | **时长**：12:34

## 简介

...

## 视频内容分析（AI 关键帧解读）

...

## 字幕 / 语音转录

...
```

### When to Use Video Mode vs Web Mode

| 情况 | 使用 |
|------|------|
| URL 包含视频平台域名 | `video-extractor.ts` |
| YouTube 但只需页面文字/描述 | `main.ts`（Defuddle 会提取字幕） |
| 普通网页 / 文章 / 博客 | `main.ts` |
| 视频内容需要深度分析 | `video-extractor.ts` |

**判断规则（优先级由高到低）**：

1. **URL 域名判断优先** — 只要 URL 包含 `youtube.com`、`youtu.be`、`bilibili.com`、`b23.tv`、`douyin.com`、`v.douyin.com`、`xiaohongshu.com`、`xhslink.com`、`tiktok.com`、`weibo.com`，**无论用户说什么**，一律使用 `video-extractor.ts`。不需要用户说"分析视频"才触发。
2. **用户明确说"分析视频/转文字/学习视频"** → 使用 `video-extractor.ts`
3. **URL 是普通网页 / 文章 / 博客** → 使用 `main.ts`

⚠️ **小红书特别注意**：`xhslink.com` 短链和 `xiaohongshu.com` 链接均可能是视频笔记。这类笔记的正文内容极少，台词全在视频里——必须走 `video-extractor.ts`，用 `main.ts` 抓网页只会得到空壳。

**小红书图文笔记（无视频）**：`main.ts` 默认只抓文字 caption，正文内容往往全在图片里。添加 `--xhs-vision` flag，自动识别图片文字并追加到 markdown：
```bash
${BUN_X} {baseDir}/scripts/main.ts <xhs-url> --xhs-vision
```
需要：Chrome 已登录小红书（OpenClaw 浏览器工具已打开任意页面即可，会自动复用 50937 调试端口）。

## Preferences (EXTEND.md)

Check EXTEND.md existence (priority order):

```bash
# 1. Project level (current working directory)
test -f .sengclaw-skills/sengclaw-url-to-markdown/EXTEND.md && echo "project"
# 2. User level (Clacky workspace — applies across all directories)
test -f "$HOME/clacky_workspace/.sengclaw-skills/sengclaw-url-to-markdown/EXTEND.md" && echo "user"
```

| Level | Path | Scope |
|-------|------|-------|
| Project | `.sengclaw-skills/sengclaw-url-to-markdown/EXTEND.md` | Current directory only |
| User (default) | `~/clacky_workspace/.sengclaw-skills/sengclaw-url-to-markdown/EXTEND.md` | All directories |

| Result | Action |
|--------|--------|
| Found | Read, parse, apply settings |
| Not found | **MUST** run first-time setup (see below) — do NOT silently create defaults |

**EXTEND.md Supports**: Download media by default | Default output directory | Default capture mode | Timeout settings

### First-Time Setup (BLOCKING)

**CRITICAL**: When EXTEND.md is not found, you **MUST use `AskUserQuestion`** to ask the user for their preferences before creating EXTEND.md. **NEVER** create EXTEND.md with defaults without asking. This is a **BLOCKING** operation — do NOT proceed with any conversion until setup is complete.

Use `AskUserQuestion` with ALL questions in ONE call:

**Question 1** — header: "Media", question: "How to handle images and videos in pages?"
- "Ask each time (Recommended)" — After saving markdown, ask whether to download media
- "Always download" — Always download media to local imgs/ and videos/ directories
- "Never download" — Keep original remote URLs in markdown

**Question 2** — header: "Output", question: "Default output directory?"
- "url-to-markdown (Recommended)" — Save to ./url-to-markdown/{domain}/{slug}.md
- (User may choose "Other" to type a custom path)

After user answers, create EXTEND.md at the **user-level path** (`~/clacky_workspace/.sengclaw-skills/sengclaw-url-to-markdown/EXTEND.md`), confirm "Preferences saved to ~/clacky_workspace/.sengclaw-skills/sengclaw-url-to-markdown/EXTEND.md", then continue.

Full reference: [references/config/first-time-setup.md](references/config/first-time-setup.md)

### Supported Keys

| Key | Default | Values | Description |
|-----|---------|--------|-------------|
| `download_media` | `ask` | `ask` / `1` / `0` | `ask` = prompt each time, `1` = always download, `0` = never |
| `default_output_dir` | empty | path or empty | Default output directory (empty = `./url-to-markdown/`) |

**EXTEND.md → CLI mapping**:
| EXTEND.md key | CLI argument | Notes |
|---------------|-------------|-------|
| `download_media: 1` | `--download-media` | |
| `default_output_dir: ./posts/` | `--output-dir ./posts/` | Directory path. Do NOT pass to `-o` (which expects a file path) |

**Value priority**:
1. CLI arguments (`--download-media`, `-o`, `--output-dir`)
2. EXTEND.md
3. Skill defaults

## Features

- Chrome CDP for full JavaScript rendering
- Browser strategy fallback: default headless first, then visible Chrome on technical failure
- URL-specific parser layer for sites that need custom HTML rules before generic extraction
- Two capture modes: auto or wait-for-user
- Save rendered HTML as a sibling `-captured.html` file
- Clean markdown output with metadata
- Upgraded Defuddle-first markdown conversion with automatic fallback to the pre-Defuddle extractor from git history
- X/Twitter pages can use HTML-specific parsing for Tweets and Articles, which improves title/body/media extraction on `x.com` / `twitter.com`
- `archive.ph` / related archive mirrors can restore the original URL from `input[name=q]` and prefer `#CONTENT` before falling back to the page body
- Materializes shadow DOM content before conversion so web-component pages survive serialization better
- YouTube pages can include transcript/caption text in the markdown when YouTube exposes a caption track
- If local browser capture fails completely, can fall back to `defuddle.md/<url>` and still save markdown
- Handles login-required pages via wait mode
- Download images and videos to local directories

## Usage

```bash
# Auto mode (default) - capture when page loads
${BUN_X} {baseDir}/scripts/main.ts <url>

# Force headless only
${BUN_X} {baseDir}/scripts/main.ts <url> --browser headless

# Force visible browser
${BUN_X} {baseDir}/scripts/main.ts <url> --browser headed

# Wait mode - wait for user signal before capture
${BUN_X} {baseDir}/scripts/main.ts <url> --wait

# Save to specific file
${BUN_X} {baseDir}/scripts/main.ts <url> -o output.md

# Save to a custom output directory (auto-generates filename)
${BUN_X} {baseDir}/scripts/main.ts <url> --output-dir ./posts/

# Download images and videos to local directories
${BUN_X} {baseDir}/scripts/main.ts <url> --download-media
```

## Options

| Option | Description |
|--------|-------------|
| `<url>` | URL to fetch |
| `-o <path>` | Output file path — must be a **file** path, not directory (default: auto-generated) |
| `--output-dir <dir>` | Base output directory — auto-generates `{dir}/{domain}/{slug}.md` (default: `./url-to-markdown/`) |
| `--wait` | Wait for user signal before capturing |
| `--browser <mode>` | Browser strategy: `auto` (default), `headless`, or `headed` |
| `--headless` | Shortcut for `--browser headless` |
| `--headed` | Shortcut for `--browser headed` |
| `--timeout <ms>` | Page load timeout (default: 30000) |
| `--download-media` | Download image/video assets to local `imgs/` and `videos/`, and rewrite markdown links to local relative paths |
| `--no-cache` | Skip cache lookup and force re-fetch (bypass cache) |
| `--cache-ttl <hours>` | Cache TTL in hours (default: 24h for pages, 168h for videos) |
| `--xhs-vision` | **小红书图文专用**：抓取图文笔记后，自动识别图片中的文字，追加到 markdown 末尾。需要 Chrome 已登录小红书（复用 OpenClaw 调试端口 50937）。 |

## Capture Modes

| Mode | Behavior | Use When |
|------|----------|----------|
| Auto (default) | Try headless first, then retry in visible Chrome if needed | Public pages, static content, unknown pages |
| Wait (`--wait`) | User signals when ready | Login-required, lazy loading, paywalls |

**Wait mode workflow**:
1. Run with `--wait` → script outputs "Press Enter when ready"
2. Ask user to confirm page is ready
3. Send newline to stdin to trigger capture

**Default browser fallback**:
1. Auto mode starts with headless Chrome and captures on network idle
2. If headless capture fails technically, retry with visible Chrome
3. If a shared Chrome session for this profile already exists, reuse it instead of launching a new browser
4. The script does not hard-code login or paywall detection; the agent must inspect the captured markdown or HTML and decide whether to rerun with `--browser headed --wait`

## Agent Quality Gate

**CRITICAL**: The agent must treat headless capture as provisional. Some sites render differently in headless mode and can silently return an error shell, partially hydrated page, or low-quality extraction **without** causing the CLI to fail.

After every run that used `--browser auto` or `--browser headless`, the agent **MUST** inspect the saved markdown first, and inspect the saved `-captured.html` when the markdown looks suspicious.

### Quality checks the agent must perform

1. Confirm the markdown title matches the target page, not a generic site shell
2. Confirm the body contains the expected article or page content, not just navigation, footer, or a generic error
3. Watch for obvious failure signs such as:
   - `Application error`
   - `This page could not be found`
   - login, signup, subscribe, or verification shells
   - extremely short markdown for a page that should be long-form
   - raw framework payloads or mostly boilerplate content
4. If the result is low quality, incomplete, or clearly wrong, do **not** accept the run as successful just because the CLI exited with code 0

### Recovery workflow the agent must follow

1. First run with default `auto` unless there is already a clear reason to use wait mode
2. Review markdown quality immediately after the run
3. If the content is low quality, rerun locally with visible Chrome:
   - `--browser headed` for ordinary rendering issues
   - `--browser headed --wait` when the page may need login, anti-bot interaction, cookie acceptance, or extra hydration time
4. If `--wait` is used, tell the user exactly what to do:
   - if login is required, ask them to sign in
   - if the page needs time to hydrate, ask them to wait until the full content is visible
   - once ready, ask them to press Enter so capture can continue
5. Only fall back to hosted `defuddle.md` after the local browser strategies have failed or are clearly lower fidelity

## Output Format

Each run saves two files side by side:

- Markdown: YAML front matter with `url`, `title`, `description`, `author`, `published`, optional `coverImage`, and `captured_at`, followed by converted markdown content
- HTML snapshot: `*-captured.html`, containing the rendered page HTML captured from Chrome

When Defuddle or page metadata provides a language hint, the markdown front matter also includes `language`.

The HTML snapshot is saved before any markdown media localization, so it stays a faithful capture of the page DOM used for conversion.
If the hosted `defuddle.md` API fallback is used, markdown is still saved, but there is no local `-captured.html` snapshot for that run.

## Output Directory

Default: `url-to-markdown/<domain>/<slug>.md`
With `--output-dir ./posts/`: `./posts/<domain>/<slug>.md`

HTML snapshot path uses the same basename:

- `url-to-markdown/<domain>/<slug>-captured.html`
- `./posts/<domain>/<slug>-captured.html`

- `<slug>`: From page title or URL path (kebab-case, 2-6 words)
- Conflict resolution: Append timestamp `<slug>-YYYYMMDD-HHMMSS.md`

When `--download-media` is enabled:
- Images are saved to `imgs/` next to the markdown file
- Videos are saved to `videos/` next to the markdown file
- Markdown media links are rewritten to local relative paths

## Conversion Fallback

Conversion order:

1. Try the URL-specific parser layer first when a site rule matches
2. If no specialized parser matches, try Defuddle
3. For rich pages such as YouTube, prefer Defuddle's extractor-specific output (including transcripts when available) instead of replacing it with the legacy pipeline
4. If Defuddle throws, cannot load, returns obviously incomplete markdown, or captures lower-quality content than the legacy pipeline, automatically fall back to the pre-Defuddle extractor
5. If the agent determines the captured result is a login screen, verification screen, or paywall shell, rerun locally with `--browser headed --wait` and ask the user to complete access before capture
6. If the entire local browser capture flow still fails before markdown can be produced, try the hosted `https://defuddle.md/<url>` API and save its markdown output directly
7. The legacy fallback path uses the older Readability/selector/Next.js-data based HTML-to-Markdown implementation recovered from git history

CLI output will show:

- `Converter: parser:...` when a URL-specific parser succeeded
- `Converter: defuddle` when Defuddle succeeds
- `Converter: legacy:...` plus `Fallback used: ...` when fallback was needed
- `Converter: defuddle-api` when local browser capture failed and the hosted API was used instead

## Media Download Workflow

Based on `download_media` setting in EXTEND.md:

| Setting | Behavior |
|---------|----------|
| `1` (always) | Run script with `--download-media` flag |
| `0` (never) | Run script without `--download-media` flag |
| `ask` (default) | Follow the ask-each-time flow below |

### Ask-Each-Time Flow

1. Run script **without** `--download-media` → markdown saved
2. Check saved markdown for remote media URLs (`https://` in image/video links)
3. **If no remote media found** → done, no prompt needed
4. **If remote media found** → use `AskUserQuestion`:
   - header: "Media", question: "Download N images/videos to local files?"
   - "Yes" — Download to local directories
   - "No" — Keep remote URLs
5. If user confirms → run script **again** with `--download-media` (overwrites markdown with localized links)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `URL_CHROME_PATH` | Custom Chrome executable path |
| `URL_DATA_DIR` | Custom data directory |
| `URL_CHROME_PROFILE_DIR` | Custom Chrome profile directory |

**Troubleshooting**: Chrome not found → set `URL_CHROME_PATH`. Timeout → increase `--timeout`. Complex pages → try `--wait` mode. If markdown quality is poor, inspect the saved `-captured.html` and check whether the run logged a legacy fallback.

### YouTube Notes

- The upgraded Defuddle path uses async extractors, so YouTube pages can include transcript text directly in the markdown body.
- Transcript availability depends on YouTube exposing a caption track. Videos with captions disabled, restricted playback, or blocked regional access may still produce description-only output.
- If the page needs time to finish loading descriptions, chapters, or player metadata, prefer `--wait` and capture after the watch page is fully hydrated.

### Hosted API Fallback

- The hosted fallback endpoint is `https://defuddle.md/<url>`. In shell form: `curl https://defuddle.md/stephango.com`
- Use it only when the local Chrome/CDP capture path fails outright. The local path still has higher fidelity because it can save the captured HTML and handle authenticated pages.
- The hosted API already returns Markdown with YAML frontmatter, so save that response as-is and then apply the normal media-localization step if requested.

## Caching

URL-to-Markdown caches every successful fetch to avoid redundant network requests.

**Cache directory**: `~/.cache/sengclaw-skills/url-to-markdown-cache/`  
**Cache key**: SHA-256 of URL (first 16 hex chars)  
**Default TTL**: 24 hours for web pages · 168 hours (7 days) for videos

| Scenario | Behavior |
|----------|----------|
| Same URL fetched again within TTL | Returns cached markdown instantly, no browser/network call |
| TTL expired | Cache miss → re-fetches and updates cache |
| `--no-cache` passed | Ignores cache, always re-fetches and overwrites cache entry |
| `-o` (custom output path) passed | Skips cache read (user wants a specific file); still writes cache after fetch |
| Cache write failure | Non-fatal warning; normal output is unaffected |

**CLI flags**:
- `--no-cache` — force re-fetch, ignore existing cache
- `--cache-ttl <hours>` — override TTL for this run (e.g. `--cache-ttl 1` for 1-hour cache)

**Environment variable**: `URL_CACHE_DIR` — override cache directory path

## Extension Support

Custom configurations via EXTEND.md. See **Preferences** section for paths and supported options.