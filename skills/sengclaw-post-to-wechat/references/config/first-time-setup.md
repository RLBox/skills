---
name: first-time-setup
description: First-time setup flow for sengclaw-post-to-wechat preferences
---

# First-Time Setup

## Overview

When no EXTEND.md is found, guide user through preference setup.

**BLOCKING OPERATION**: This setup MUST complete before ANY other workflow steps. Do NOT:
- Ask about content or files to publish
- Ask about themes or publishing methods
- Proceed to content conversion or publishing

ONLY ask the questions in this setup flow, save EXTEND.md, then continue.

## Setup Flow

```
No EXTEND.md found
        |
        v
+---------------------+
| AskUserQuestion     |
| (all questions)     |
+---------------------+
        |
        v
+---------------------+
| Create EXTEND.md    |
+---------------------+
        |
        v
    Continue to Step 1
```

## Questions

**Language**: Use user's input language or saved language preference.

Use AskUserQuestion with ALL questions in ONE call:

### Question 1: Default Theme

```yaml
header: "Theme"
question: "Default theme for article conversion?"
options:
  - label: "default (Recommended)"
    description: "Classic layout - centered title with border, white-on-color H2 (default: blue)"
  - label: "grace"
    description: "Elegant - text shadows, rounded cards, refined blockquotes (default: purple)"
  - label: "simple"
    description: "Minimal modern - asymmetric rounded corners, clean whitespace (default: green)"
  - label: "modern"
    description: "Large rounded corners, pill headings, spacious (default: orange)"
```

### Question 2: Default Color

```yaml
header: "Color"
question: "Default color preset? (theme default if not set)"
options:
  - label: "Theme default (Recommended)"
    description: "Use the theme's built-in default color"
  - label: "blue"
    description: "#0F4C81 经典蓝"
  - label: "red"
    description: "#A93226 中国红"
  - label: "green"
    description: "#009874 翡翠绿"
```

Note: User can choose "Other" to type any preset name (vermilion, yellow, purple, sky, rose, olive, black, gray, pink, orange) or hex value.

### Question 3: Default Publishing Method

```yaml
header: "Method"
question: "Default publishing method?"
options:
  - label: "api (Recommended)"
    description: "Fast, requires API credentials (AppID + AppSecret)"
  - label: "browser"
    description: "Slow, requires Chrome and login session"
```

### Question 4: Default Author

```yaml
header: "Author"
question: "Default author name for articles?"
options:
  - label: "No default"
    description: "Leave empty, specify per article"
```

Note: User will likely choose "Other" to type their author name.

### Question 5: Open Comments

```yaml
header: "Comments"
question: "Enable comments on articles by default?"
options:
  - label: "Yes (Recommended)"
    description: "Allow readers to comment on articles"
  - label: "No"
    description: "Disable comments by default"
```

### Question 6: Fans-Only Comments

```yaml
header: "Fans only"
question: "Restrict comments to followers only?"
options:
  - label: "No (Recommended)"
    description: "All readers can comment"
  - label: "Yes"
    description: "Only followers can comment"
```

### Question 7: Preview WeChat ID (Browser Method Only)

**Show this question only if user selected `browser` as publishing method in Question 3.**

```yaml
header: "预览微信号"
question: "发布前建议先发预览到手机确认排版。请填写用于接收预览的微信号（微信号/手机号/QQ号均可）："
options:
  - label: "跳过"
    description: "不填写，每次手动处理预览"
```

Note: User will type their WeChat ID / phone / QQ. Save as `preview_wxname`. If user skips, leave the field empty.

## Save Location

Always save to the **user-level path** — applies across all directories. No need to ask the user.

| Level | Path | Scope |
|-------|------|-------|
| User (default) | `~/clacky_workspace/.sengclaw-skills/sengclaw-post-to-wechat/EXTEND.md` | All directories |
| Project (override) | `.sengclaw-skills/sengclaw-post-to-wechat/EXTEND.md` | Current directory only |

## After Setup

1. Create directory `~/clacky_workspace/.sengclaw-skills/sengclaw-post-to-wechat/` if needed
2. Write EXTEND.md
3. Confirm: "Preferences saved to ~/clacky_workspace/.sengclaw-skills/sengclaw-post-to-wechat/EXTEND.md"
4. Continue to Step 0 (load the saved preferences)

## EXTEND.md Template

### Single Account (Default)

```md
default_theme: [default/grace/simple/modern]
default_color: [preset name, hex, or empty for theme default]
default_publish_method: [api/browser]
default_author: [author name or empty]
need_open_comment: [1/0]
only_fans_can_comment: [1/0]
chrome_profile_path:
preview_wxname: [WeChat ID / phone / QQ for preview, browser method only, leave empty to skip]
```

### Multi-Account

```md
default_theme: [default/grace/simple/modern]
default_color: [preset name, hex, or empty for theme default]

accounts:
  - name: [display name]
    alias: [short key, e.g. "baoyu"]
    default: true
    default_publish_method: [api/browser]
    default_author: [author name]
    need_open_comment: [1/0]
    only_fans_can_comment: [1/0]
    app_id: [WeChat App ID, optional]
    app_secret: [WeChat App Secret, optional]
  - name: [second account name]
    alias: [short key, e.g. "ai-tools"]
    default_publish_method: [api/browser]
    default_author: [author name]
    need_open_comment: [1/0]
    only_fans_can_comment: [1/0]
    preview_wxname: [WeChat ID for preview, browser method only]
```

## Adding More Accounts Later

After initial setup, users can add accounts by editing EXTEND.md:

1. Add an `accounts:` block with list items
2. Move per-account settings (author, publish method, comments) into each account entry
3. Keep global settings (theme, color) at the top level
4. Each account needs a unique `alias` (used for CLI `--account` arg and Chrome profile naming)
5. Set `default: true` on the primary account

## Modifying Preferences Later

Users can edit EXTEND.md directly or delete it to trigger setup again.
