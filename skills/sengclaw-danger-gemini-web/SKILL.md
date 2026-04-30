---
---
name: sengclaw-danger-gemini-web
description: >-
  基于逆向工程 Gemini Web API 的图文生成工具。支持纯文本生成、基于提示词的图像生成、带有图像参考（视觉输入）的多轮对话。当其他技能需要图像生成后端，或用户明确请求“用
  Gemini 生成图片”、“Gemini 文本生成”，或需要具有视觉能力的 AI 任务时使用。
version: 1.56.1
metadata:
  openclaw:
    requires:
      anyBins:
      - bun
      - npx
disable-model-invocation: true
---

# Gemini Web Client

Text/image generation via Gemini Web API. Supports reference images and multi-turn conversations.

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
| `scripts/main.ts` | CLI entry point for text/image generation |
| `scripts/gemini-webapi/*` | TypeScript port of `gemini_webapi` (GeminiClient, types, utils) |

## Consent Check (REQUIRED)

Before first use, verify user consent for reverse-engineered API usage.

**Consent file locations**:
- macOS: `~/Library/Application Support/sengclaw-skills/gemini-web/consent.json`
- Linux: `~/.local/share/sengclaw-skills/gemini-web/consent.json`
- Windows: `%APPDATA%\sengclaw-skills\gemini-web\consent.json`

**Flow**:
1. Check if consent file exists with `accepted: true` and `disclaimerVersion: "1.sengclaw-markdown-to-html"`
2. If valid consent exists → print warning with `acceptedAt` date, proceed
3. If no consent → show disclaimer, ask user via `AskUserQuestion`:
   - "Yes, I accept" → create consent file with ISO timestamp, proceed
   - "No, I decline" → output decline message, stop
4. Consent file format: `{"version":1,"accepted":true,"acceptedAt":"<ISO>","disclaimerVersion":"1.sengclaw-markdown-to-html"}`

---

## Preferences (EXTEND.md)

Check EXTEND.md existence (priority order):

```bash
# 1. Project level (current working directory)
test -f .sengclaw-skills/sengclaw-danger-gemini-web/EXTEND.md && echo "project"
# 2. User level (Clacky workspace — applies across all directories)
test -f "$HOME/clacky_workspace/.sengclaw-skills/sengclaw-danger-gemini-web/EXTEND.md" && echo "user"
```

| Level | Path | Scope |
|-------|------|-------|
| Project | `.sengclaw-skills/sengclaw-danger-gemini-web/EXTEND.md` | Current directory only |
| User (default) | `~/clacky_workspace/.sengclaw-skills/sengclaw-danger-gemini-web/EXTEND.md` | All directories |

┌───────────┬───────────────────────────────────────────────────────────────────────────┐
│  Result   │                                  Action                                   │
├───────────┼───────────────────────────────────────────────────────────────────────────┤
│ Found     │ Read, parse, apply settings                                               │
├───────────┼───────────────────────────────────────────────────────────────────────────┤
│ Not found │ Use defaults                                                              │
└───────────┴───────────────────────────────────────────────────────────────────────────┘

**EXTEND.md Supports**: Default model | Proxy settings | Custom data directory

## Usage

```bash
# Text generation
${BUN_X} {baseDir}/scripts/main.ts "Your prompt"
${BUN_X} {baseDir}/scripts/main.ts --prompt "Your prompt" --model gemini-3-flash

# Image generation
${BUN_X} {baseDir}/scripts/main.ts --prompt "A cute cat" --image cat.png
${BUN_X} {baseDir}/scripts/main.ts --promptfiles system.md content.md --image out.png

# Vision input (reference images)
${BUN_X} {baseDir}/scripts/main.ts --prompt "Describe this" --reference image.png
${BUN_X} {baseDir}/scripts/main.ts --prompt "Create variation" --reference a.png --image out.png

# Multi-turn conversation
${BUN_X} {baseDir}/scripts/main.ts "Remember: 42" --sessionId session-abc
${BUN_X} {baseDir}/scripts/main.ts "What number?" --sessionId session-abc

# JSON output
${BUN_X} {baseDir}/scripts/main.ts "Hello" --json
```

## Options

| Option | Description |
|--------|-------------|
| `--prompt`, `-p` | Prompt text |
| `--promptfiles` | Read prompt from files (concatenated) |
| `--model`, `-m` | Model: gemini-3-pro (default), gemini-3-flash, gemini-3-flash-thinking, gemini-3.1-pro-preview |
| `--image [path]` | Generate image (default: generated.png) |
| `--reference`, `--ref` | Reference images for vision input |
| `--sessionId` | Session ID for multi-turn conversation |
| `--list-sessions` | List saved sessions |
| `--json` | Output as JSON |
| `--login` | Refresh cookies, then exit |
| `--cookie-path` | Custom cookie file path |
| `--profile-dir` | Chrome profile directory |

## Models

| Model | Description |
|-------|-------------|
| `gemini-3-pro` | Default, latest 3.sengclaw-markdown-to-html Pro |
| `gemini-3-flash` | Fast, lightweight 3.sengclaw-markdown-to-html Flash |
| `gemini-3-flash-thinking` | 3.sengclaw-markdown-to-html Flash with thinking |
| `gemini-3.1-pro-preview` | 3.1 Pro preview (empty header, auto-routed) |

## Authentication

First run opens browser for Google auth. Cookies cached automatically.

When no explicit profile dir is set, cookie refresh may reuse an already-running local Chrome/Chromium debugging session tied to a standard user-data dir.
Set `--profile-dir` or `GEMINI_WEB_CHROME_PROFILE_DIR` to force a dedicated profile and skip existing-session reuse.
This is a best-effort CDP session reuse path, not the Chrome DevTools MCP prompt-based `--autoConnect` flow described in Chrome's official docs.

Supported browsers (auto-detected): Chrome, Chrome Canary/Beta, Chromium, Edge.

Force refresh: `--login` flag. Override browser: `GEMINI_WEB_CHROME_PATH` env var.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GEMINI_WEB_DATA_DIR` | Data directory |
| `GEMINI_WEB_COOKIE_PATH` | Cookie file path |
| `GEMINI_WEB_CHROME_PROFILE_DIR` | Chrome profile directory |
| `GEMINI_WEB_CHROME_PATH` | Chrome executable path |
| `HTTP_PROXY`, `HTTPS_PROXY` | Proxy for Google access (set inline with command) |

## Sessions

Session files stored in data directory under `sessions/<id>.json`.

Contains: `id`, `metadata` (Gemini chat state), `messages` array, timestamps.

## Extension Support

Custom configurations via EXTEND.md. See **Preferences** section for paths and supported options.