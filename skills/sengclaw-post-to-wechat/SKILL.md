---
name: sengclaw-post-to-wechat
description: 通过 API 或 Chrome CDP 向微信公众号发布内容。支持以 HTML、Markdown 或纯文本方式发布文章（文章），以及带多张图片的图文发布（贴图）。Markdown 文章流程默认将普通外链转换为底部引用，符合微信排版规范。当用户提到"发布公众号"、"post to wechat"、"微信公众号"或"贴图/图文/文章"时使用。
version: 1.56.1
metadata:
  openclaw:
    requires:
      anyBins:
        - bun
        - npx
---

# Post to WeChat Official Account

## Language

**Match user's language**: Respond in the same language the user uses. If user writes in Chinese, respond in Chinese. If user writes in English, respond in English.

## Script Directory

**Agent Execution**: Determine this SKILL.md directory as `{baseDir}`, then use `{baseDir}/scripts/<name>.ts`. Resolve `${BUN_X}` runtime: if `bun` installed → `bun`; if `npx` available → `npx -y bun`; else suggest installing bun.

| Script | Purpose |
|--------|---------|
| `scripts/wechat-browser.ts` | Image-text posts (图文) |
| `scripts/wechat-article.ts` | Article posting via browser (文章) |
| `scripts/wechat-api.ts` | Article posting via API (文章) |
| `scripts/md-to-wechat.ts` | Markdown → WeChat-ready HTML with image placeholders |
| `scripts/check-permissions.ts` | Verify environment & permissions |

## Preferences (EXTEND.md)

Check EXTEND.md existence (priority order):

```bash
# 1. Project level (current working directory)
test -f .sengclaw-skills/sengclaw-post-to-wechat/EXTEND.md && echo "project"
# 2. User level (Clacky workspace — applies across all directories)
test -f "$HOME/clacky_workspace/.sengclaw-skills/sengclaw-post-to-wechat/EXTEND.md" && echo "user"
```

| Level | Path | Scope |
|-------|------|-------|
| Project | `.sengclaw-skills/sengclaw-post-to-wechat/EXTEND.md` | Current directory only |
| User (default) | `~/clacky_workspace/.sengclaw-skills/sengclaw-post-to-wechat/EXTEND.md` | All directories |

| Result | Action |
|--------|--------|
| Found | Read, parse, apply settings |
| Not found | Run first-time setup ([references/config/first-time-setup.md](references/config/first-time-setup.md)) → Save to user-level path → Continue |

**EXTEND.md Supports**: Default theme | Default color | Default publishing method (api/browser) | Default author | Default open-comment switch | Default fans-only-comment switch | Chrome profile path

First-time setup: [references/config/first-time-setup.md](references/config/first-time-setup.md)

**Minimum supported keys** (case-insensitive, accept `1/0` or `true/false`):

| Key | Default | Mapping |
|-----|---------|---------|
| `default_author` | empty | Fallback for `author` when CLI/frontmatter not provided |
| `need_open_comment` | `1` | `articles[].need_open_comment` in `draft/add` request |
| `only_fans_can_comment` | `0` | `articles[].only_fans_can_comment` in `draft/add` request |

**Recommended EXTEND.md example**:

```md
default_theme: default
default_color: blue
default_publish_method: api
default_author: 宝玉
need_open_comment: 1
only_fans_can_comment: 0
chrome_profile_path: /path/to/chrome/profile
```

**Theme options**: default, grace, simple, modern

**Color presets**: blue, green, vermilion, yellow, purple, sky, rose, olive, black, gray, pink, red, orange (or hex value)

**Value priority**:
1. CLI arguments
2. Frontmatter
3. EXTEND.md (account-level → global-level)
4. Skill defaults

## Multi-Account Support

EXTEND.md supports managing multiple WeChat Official Accounts. When `accounts:` block is present, each account can have its own credentials, Chrome profile, and default settings.

**Compatibility rules**:

| Condition | Mode | Behavior |
|-----------|------|----------|
| No `accounts` block | Single-account | Current behavior, unchanged |
| `accounts` with 1 entry | Single-account | Auto-select, no prompt |
| `accounts` with 2+ entries | Multi-account | Prompt to select before publishing |
| `accounts` with `default: true` | Multi-account | Pre-select default, user can switch |

**Multi-account EXTEND.md example**:

```md
default_theme: default
default_color: blue

accounts:
  - name: 宝玉的技术分享
    alias: baoyu
    default: true
    default_publish_method: api
    default_author: 宝玉
    need_open_comment: 1
    only_fans_can_comment: 0
    app_id: your_wechat_app_id
    app_secret: your_wechat_app_secret
  - name: AI工具集
    alias: ai-tools
    default_publish_method: browser
    default_author: AI工具集
    need_open_comment: 1
    only_fans_can_comment: 0
```

**Per-account keys** (can be set per-account or globally as fallback):
`default_publish_method`, `default_author`, `need_open_comment`, `only_fans_can_comment`, `app_id`, `app_secret`, `chrome_profile_path`

**Global-only keys** (always shared across accounts):
`default_theme`, `default_color`

### Account Selection (Step 0.5)

Insert between Step 0 and Step 1 in the Article Posting Workflow:

```
if no accounts block:
    → single-account mode (current behavior)
elif accounts.length == 1:
    → auto-select the only account
elif --account <alias> CLI arg:
    → select matching account
elif one account has default: true:
    → pre-select, show: "Using account: <name> (--account to switch)"
else:
    → prompt user:
      "Multiple WeChat accounts configured:
       1) <name1> (<alias1>)
       2) <name2> (<alias2>)
       Select account [1-N]:"
```

### Credential Resolution (API Method)

For a selected account with alias `{alias}`:

1. `app_id` / `app_secret` inline in EXTEND.md account block
2. Env var `WECHAT_{ALIAS}_APP_ID` / `WECHAT_{ALIAS}_APP_SECRET` (alias uppercased, hyphens → underscores)
3. `.sengclaw-skills/.env` with prefixed key `WECHAT_{ALIAS}_APP_ID`
4. `~/clacky_workspace/.sengclaw-skills/.env` with prefixed key
5. Fallback to unprefixed `WECHAT_APP_ID` / `WECHAT_APP_SECRET`

**.env multi-account example**:

```bash
# Account: baoyu
WECHAT_BAOYU_APP_ID=your_wechat_app_id
WECHAT_BAOYU_APP_SECRET=your_wechat_app_secret

# Account: ai-tools
WECHAT_AI_TOOLS_APP_ID=your_ai_tools_wechat_app_id
WECHAT_AI_TOOLS_APP_SECRET=your_ai_tools_wechat_app_secret
```

### Chrome Profile (Browser Method)

Each account uses an isolated Chrome profile for independent login sessions:

| Source | Path |
|--------|------|
| Account `chrome_profile_path` in EXTEND.md | Use as-is |
| Auto-generated from alias | `{shared_profile_parent}/wechat-{alias}/` |
| Single-account fallback | Shared default profile (current behavior) |

### CLI `--account` Argument

All publishing scripts accept `--account <alias>`:

```bash
${BUN_X} {baseDir}/scripts/wechat-api.ts <file> --theme default --account ai-tools
${BUN_X} {baseDir}/scripts/wechat-article.ts --markdown <file> --theme default --account baoyu
${BUN_X} {baseDir}/scripts/wechat-browser.ts --markdown <file> --images ./photos/ --account baoyu
```

## Pre-flight Check (Optional)

Before first use, suggest running the environment check. User can skip if they prefer.

```bash
${BUN_X} {baseDir}/scripts/check-permissions.ts
```

Checks: Chrome, profile isolation, Bun, Accessibility, clipboard, paste keystroke, API credentials, Chrome conflicts.

**If any check fails**, provide fix guidance per item:

| Check | Fix |
|-------|-----|
| Chrome | Install Chrome or set `WECHAT_BROWSER_CHROME_PATH` env var |
| Profile dir | Shared profile at `sengclaw-skills/chrome-profile` (see CLAUDE.md Chrome Profile section) |
| Bun runtime | `brew install oven-sh/bun/bun` (macOS) or `npm install -g bun` |
| Accessibility (macOS) | System Settings → Privacy & Security → Accessibility → enable terminal app |
| Clipboard copy | Ensure Swift/AppKit available (macOS Xcode CLI tools: `xcode-select --install`) |
| Paste keystroke (macOS) | Same as Accessibility fix above |
| Paste keystroke (Linux) | Install `xdotool` (X11) or `ydotool` (Wayland) |
| API credentials | Follow guided setup in Step 2, or manually set in `.sengclaw-skills/.env` |

## Image-Text Posting (图文)

For short posts with multiple images (up to 9):

```bash
${BUN_X} {baseDir}/scripts/wechat-browser.ts --markdown article.md --images ./images/
${BUN_X} {baseDir}/scripts/wechat-browser.ts --title "标题" --content "内容" --image img.png --submit
```

See [references/image-text-posting.md](references/image-text-posting.md) for details.

## Article Posting Workflow (文章)

Copy this checklist and check off items as you complete them:

```
Publishing Progress:
- [ ] Step 0: Load preferences (EXTEND.md)
- [ ] Step 0.5: Resolve account (multi-account only)
- [ ] Step 1: Determine input type
- [ ] Step 2: Select method and configure credentials
- [ ] Step 3: Resolve theme/color and validate metadata
- [ ] Step 4: Publish to WeChat
- [ ] Step 5: Report completion
```

### Step 0: Load Preferences

Check and load EXTEND.md settings (see Preferences section above).

**CRITICAL**: If not found, complete first-time setup BEFORE any other steps or questions.

Resolve and store these defaults for later steps:
- `default_theme` (default `default`)
- `default_color` (omit if not set — theme default applies)
- `default_author`
- `need_open_comment` (default `1`)
- `only_fans_can_comment` (default `0`)

### Step 1: Determine Input Type

| Input Type | Detection | Action |
|------------|-----------|--------|
| HTML file | Path ends with `.html`, file exists | Skip to Step 3 |
| Markdown file | Path ends with `.md`, file exists | Continue to Step 2 |
| Plain text | Not a file path, or file doesn't exist | Save to markdown, continue to Step 2 |

**Plain Text Handling**:

1. Generate slug from content (first 2-4 meaningful words, kebab-case)
2. Create directory and save file:

```bash
mkdir -p "$(pwd)/post-to-wechat/$(date +%Y-%m-%d)"
# Save content to: post-to-wechat/yyyy-MM-dd/[slug].md
```

3. Continue processing as markdown file

**Slug Examples**:
- "Understanding AI Models" → `understanding-ai-models`
- "人工智能的未来" → `ai-future` (translate to English for slug)

### Step 2: Select Publishing Method and Configure

**Ask publishing method** (unless specified in EXTEND.md or CLI):

| Method | Speed | Requirements |
|--------|-------|--------------|
| `api` (Recommended) | Fast | API credentials |
| `browser` | Slow | Chrome, login session |

**If Browser Selected - Check Preview Wxname**:

If `default_publish_method` is `browser` (or user selects browser), check EXTEND.md for `preview_wxname`:

- **Found**: Use it automatically for `--preview-wxname`
- **Not found**: Ask user once and save to EXTEND.md:

```
预览需要发送到手机确认排版，请提供用于接收预览的微信号（微信号/手机号/QQ号均可）：
> _

保存后每次发布会自动发送预览到该微信号。
```

Save the value to EXTEND.md as `preview_wxname: <input>`.

**If API Selected - Check Credentials**:

```bash
# 1. Project level (current working directory)
test -f .sengclaw-skills/.env && grep -q "WECHAT_APP_ID" .sengclaw-skills/.env && echo "project"
# 2. User level (Clacky workspace — applies across all directories)
test -f "$HOME/clacky_workspace/.sengclaw-skills/.env" && grep -q "WECHAT_APP_ID" "$HOME/clacky_workspace/.sengclaw-skills/.env" && echo "user"
```

**If Credentials Missing - Guide Setup**:

```
WeChat API credentials not found.

To obtain credentials:
1. Visit https://mp.weixin.qq.com
2. Go to: 开发 → 基本配置
3. Copy AppID and AppSecret

Credentials will be saved to: ~/clacky_workspace/.sengclaw-skills/.env (applies across all directories)
```

After location choice, prompt for values and write to `.env`:

```
WECHAT_APP_ID=<user_input>
WECHAT_APP_SECRET=<user_input>
```

### Step 3: Resolve Theme/Color and Validate Metadata

1. **Resolve theme** (first match wins, do NOT ask user if resolved):
   - CLI `--theme` argument
   - EXTEND.md `default_theme` (loaded in Step 0)
   - Fallback: `default`

2. **Resolve color** (first match wins):
   - CLI `--color` argument
   - EXTEND.md `default_color` (loaded in Step 0)
   - Omit if not set (theme default applies)

3. **Validate metadata** from frontmatter (markdown) or HTML meta tags (HTML input):

| Field | If Missing |
|-------|------------|
| Title | Prompt: "Enter title, or press Enter to auto-generate from content" |
| Summary | Prompt: "Enter summary, or press Enter to auto-generate (recommended for SEO)" |
| Author | Use fallback chain: CLI `--author` → frontmatter `author` → EXTEND.md `default_author` |

**Auto-Generation Logic**:
- **Title**: First H1/H2 heading, or first sentence
- **Summary**: First paragraph, truncated to 120 characters

4. **Cover Image Check** (required for API `article_type=news`):
   1. Use CLI `--cover` if provided.
   2. Else use frontmatter (`coverImage`, `featureImage`, `cover`, `image`).
   3. Else check article directory default path: `imgs/cover.png`.
   4. Else fallback to first inline content image.
   5. If still missing, stop and request a cover image before publishing.

### Step 4: Publish to WeChat

**CRITICAL**: Publishing scripts handle markdown conversion internally. Do NOT pre-convert markdown to HTML — pass the original markdown file directly. This ensures the API method renders images as `<img>` tags (for API upload) while the browser method uses placeholders (for paste-and-replace workflow).

**Markdown citation default**:
- For markdown input, ordinary external links are converted to bottom citations by default.
- Use `--no-cite` only if the user explicitly wants to keep ordinary external links inline.
- Existing HTML input is left as-is; no extra citation conversion is applied.

**API method** (accepts `.md` or `.html`):

```bash
${BUN_X} {baseDir}/scripts/wechat-api.ts <file> --theme <theme> [--color <color>] [--title <title>] [--summary <summary>] [--author <author>] [--cover <cover_path>] [--no-cite]
```

**CRITICAL**: Always include `--theme` parameter. Never omit it, even if using `default`. Only include `--color` if explicitly set by user or EXTEND.md.

**`draft/add` payload rules**:
- Use endpoint: `POST https://api.weixin.qq.com/cgi-bin/draft/add?access_token=ACCESS_TOKEN`
- `article_type`: `news` (default) or `newspic`
- For `news`, include `thumb_media_id` (cover is required)
- Always resolve and send:
  - `need_open_comment` (default `1`)
  - `only_fans_can_comment` (default `0`)
- `author` resolution: CLI `--author` → frontmatter `author` → EXTEND.md `default_author`

If script parameters do not expose the two comment fields, still ensure final API request body includes resolved values.

**Browser method** (accepts `--markdown` or `--html`):

**Recommended flow: always preview first, then publish after confirmation.**

```bash
# Step A: Save draft + send preview to phone
${BUN_X} {baseDir}/scripts/wechat-article.ts --markdown <markdown_file> --theme <theme> [--color <color>] [--no-cite] --cover <cover_path> --submit --preview-wxname <wxname>

# Step B (after user confirms on phone): publish the draft
# → Guide user to open https://mp.weixin.qq.com → 内容管理 → 草稿箱 → 发布
```

**If `preview_wxname` is not available** (user skipped or not configured), fall back to manual preview:

```bash
${BUN_X} {baseDir}/scripts/wechat-article.ts --markdown <markdown_file> --theme <theme> [--color <color>] [--no-cite] --cover <cover_path> --submit --preview
```

**Preview → Confirm → Publish workflow**:

```
1. Run wechat-article.ts with --submit --preview-wxname <wxname>
   → Script saves draft to WeChat and sends preview message to phone

2. Tell user:
   "已保存草稿并发送预览到 <wxname> 的微信，
    请在手机上查看排版效果。
    确认没问题后回复「发布」，我来帮你完成发布。"

3. Wait for user confirmation ("发布" / "ok" / "没问题" / "publish")

4. Guide user to publish:
   → Open https://mp.weixin.qq.com → 内容管理 → 草稿箱
   → Find the draft → 点击「发布」
   OR remind user they can publish directly from the draft management page.
```

> **Note**: The script currently handles save + preview automation. Final publishing requires the user to click "发布" in the WeChat draft management page — this is intentional to give the user final control.

### Step 5: Completion Report

**For API method**, include draft management link:

```
WeChat Publishing Complete!

Input: [type] - [path]
Method: API
Theme: [theme name] [color if set]

Article:
• Title: [title]
• Summary: [summary]
• Images: [N] inline images
• Comments: [open/closed], [fans-only/all users]

Result:
✓ Draft saved to WeChat Official Account
• media_id: [media_id]

Next Steps:
→ Manage drafts: https://mp.weixin.qq.com (登录后进入「内容管理」→「草稿箱」)

Files created:
[• post-to-wechat/yyyy-MM-dd/slug.md (if plain text)]
[• slug.html (converted)]
```

**For Browser method (with preview)**:

```
草稿已保存 ✓

Input: [type] - [path]
Method: Browser
Theme: [theme name] [color if set]

Article:
• Title: [title]
• Summary: [summary]
• Images: [N] inline images

Result:
✓ 草稿已保存到微信公众号
✓ 预览已发送到 [wxname] 的微信（请在手机上查看排版效果）

Files created:
[• post-to-wechat/yyyy-MM-dd/slug.md (if plain text)]
[• slug.html (converted)]

---
📱 请在手机上查看预览效果，确认无误后回复「发布」。
如有需要修改，告诉我哪里需要改。
```

**For Browser method (no preview / preview failed)**:

```
草稿已保存 ✓

Input: [type] - [path]
Method: Browser
Theme: [theme name] [color if set]

Article:
• Title: [title]
• Summary: [summary]
• Images: [N] inline images

Result:
✓ 草稿已保存到微信公众号

Files created:
[• post-to-wechat/yyyy-MM-dd/slug.md (if plain text)]
[• slug.html (converted)]

---
→ 草稿箱：https://mp.weixin.qq.com（内容管理 → 草稿箱）
📋 建议：发布前可在草稿箱点击「预览」，扫码在手机上确认排版效果，再点「发布」。
```

## Detailed References

| Topic | Reference |
|-------|-----------|
| Image-text parameters, auto-compression | [references/image-text-posting.md](references/image-text-posting.md) |
| Article themes, image handling | [references/article-posting.md](references/article-posting.md) |

## Feature Comparison

| Feature | Image-Text | Article (API) | Article (Browser) |
|---------|------------|---------------|-------------------|
| Plain text input | ✗ | ✓ | ✓ |
| HTML input | ✗ | ✓ | ✓ |
| Markdown input | Title/content | ✓ | ✓ |
| Multiple images | ✓ (up to 9) | ✓ (inline) | ✓ (inline) |
| Themes | ✗ | ✓ | ✓ |
| Auto-generate metadata | ✗ | ✓ | ✓ |
| Default cover fallback (`imgs/cover.png`) | ✗ | ✓ | ✗ |
| Comment control (`need_open_comment`, `only_fans_can_comment`) | ✗ | ✓ | ✗ |
| Requires Chrome | ✓ | ✗ | ✓ |
| Requires API credentials | ✗ | ✓ | ✗ |
| Speed | Medium | Fast | Slow |

## Prerequisites

**For API method**:
- WeChat Official Account API credentials
- Guided setup in Step 2, or manually set in `.sengclaw-skills/.env`

**For Browser method**:
- Google Chrome
- First run: log in to WeChat Official Account (session preserved)

**Config File Locations** (priority order):
1. Environment variables
2. `<cwd>/.sengclaw-skills/.env` (project level)
3. `~/clacky_workspace/.sengclaw-skills/.env` (user level, applies across all directories)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Missing API credentials | Follow guided setup in Step 2 |
| Access token error | Check if API credentials are valid and not expired |
| Not logged in (browser) | First run opens browser - scan QR to log in |
| Chrome not found | Set `WECHAT_BROWSER_CHROME_PATH` env var |
| Title/summary missing | Use auto-generation or provide manually |
| No cover image | Add frontmatter cover or place `imgs/cover.png` in article directory |
| Wrong comment defaults | Check `EXTEND.md` keys `need_open_comment` and `only_fans_can_comment` |
| Paste fails | Check system clipboard permissions |

## Extension Support

Custom configurations via EXTEND.md. See **Preferences** section for paths and supported options.
