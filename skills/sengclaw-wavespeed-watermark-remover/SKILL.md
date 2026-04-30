---
---
name: sengclaw-wavespeed-watermark-remover
description: >-
  使用 WaveSpeedAI API 去除 AI 生成视频的水印。支持即梦（Jimeng）、Sora、Kling、Seedance 等 AI 视频工具。当用户需要去除 AI 视频水印、清洗视频内容或批量处理视频（去除 logo/文字叠加）时使用。触发词：去水印、remove watermark、清除水印、video cleanup、视频去水印、wavespeed、watermark remover、去除水印、视频清洗。
disable-model-invocation: true
user-invocable: true
metadata:
  openclaw:
    homepage: https://github.com/sengclaw/sengclaw-wavespeed-watermark-remover
    requires:
      anyBins:
      - bun
---

# WaveSpeedAI Video Watermark Remover

Remove watermarks, logos, captions, and text overlays from AI-generated videos using WaveSpeedAI API.

## Quick Start

```bash
# Single video
${BUN_X} {baseDir}/scripts/main.ts /path/to/video.mp4

# Specify output path
${BUN_X} {baseDir}/scripts/main.ts /path/to/video.mp4 --output /path/to/cleaned.mp4

# Interactive mode (will prompt for API key if not set)
${BUN_X} {baseDir}/scripts/main.ts --interactive
```

## Step 0: Check API Key Configuration ⛔ BLOCKING

**CRITICAL**: Before any operation, check for API key configuration:

```bash
# Check environment variable
echo "WAVESPEED_API_KEY=${WAVESPEED_API_KEY:+[SET]}"

# Check EXTEND.md (user-level)
test -f "$HOME/.clacky/skills/sengclaw-wavespeed-watermark-remover/EXTEND.md" && echo "user_extend=found"

# Check EXTEND.md (project-level)
test -f ".clacky/skills/sengclaw-wavespeed-watermark-remover/EXTEND.md" && echo "project_extend=found"
```

| Result | Action |
|--------|--------|
| API key found | Continue to generation |
| No API key | Prompt user to set `WAVESPEED_API_KEY` environment variable or run with `--api-key` flag |

Get your API key at: https://wavespeed.ai/accesskey

## Workflow

1. **Upload** - Upload local video to WaveSpeedAI storage
2. **Submit** - Submit watermark removal job
3. **Poll** - Check job status every 3 seconds
4. **Download** - Download cleaned video when complete

## Options

| Option | Description |
|--------|-------------|
| `--output`, `-o` | Output file path (default: `<input>_clean.mp4`) |
| `--api-key` | WaveSpeedAI API key (overrides env var) |
| `--interactive` | Interactive mode to enter API key |
| `--poll-interval` | Seconds between status checks (default: 3) |
| `--timeout` | Max seconds to wait (default: 600) |
| `--json` | JSON output |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `WAVESPEED_API_KEY` | WaveSpeedAI API key (required) |

**Load Priority**: CLI `--api-key` > `WAVESPEED_API_KEY` env var

## Supported Sources

- 即梦 (Jimeng)
- Sora / Sora 2
- Kling
- Seedance
- 其他 AI 视频生成工具的水印

## Pricing

- $0.05 per job (minimum 5 seconds)
- $0.01 per second of output
- Compared to ReelVan ($0.17/5s), WaveSpeedAI is ~3x cheaper

## Extension Support (EXTEND.md)

Custom configurations via EXTEND.md at:
- `~/.clacky/skills/sengclaw-wavespeed-watermark-remover/EXTEND.md` (user-level)
- `.clacky/skills/sengclaw-wavespeed-watermark-remover/EXTEND.md` (project-level)

### EXTEND.md Schema

```yaml
---
version: 1

# Default output directory
output_dir: null  # null = same as input directory

# Default poll interval (seconds)
poll_interval: 3

# Default timeout (seconds)
timeout: 600

# Default output filename suffix
output_suffix: "_clean"

# API key (optional, can also use env var WAVESPEED_API_KEY)
# api_key: "your-api-key-here"
---
```

### API Key Configuration

| Method | Description |
|--------|-------------|
| `EXTEND.md` | Set `api_key: "your-key"` in the config file |
| Environment variable | `export WAVESPEED_API_KEY="your-key"` |
| CLI flag | `--api-key "your-key"` |

**Priority**: CLI flag > EXTEND.md > Environment variable

## Troubleshooting

**"API key not set" error:**
- Set `export WAVESPEED_API_KEY="your-api-key"` in your shell
- Or use `--api-key "your-api-key"` flag
- Or use `--interactive` to enter key

**Job times out:**
- Videos over 10 minutes are not supported
- Check your video duration first

**Poor quality results:**
- For best results, ensure video is not heavily compressed
- Semi-transparent watermarks may need multiple passes