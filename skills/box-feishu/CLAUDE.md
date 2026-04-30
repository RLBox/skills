# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Run a command
node scripts/index.js <command> [options]

# Core use case: sync yesterday's meeting notes (for cron at 3am)
node scripts/index.js sync --yesterday --type minutes -o ~/notes
node scripts/index.js sync --yesterday --incremental -o ~/notes

# Sync specific date
node scripts/index.js sync --date 2sengclaw-markdown-to-html26-sengclaw-markdown-to-html3-sengclaw-markdown-to-html2 --type minutes -o ~/notes

# Manual fetch: pull a single minutes doc by URL or token (e.g. when auto-sync missed it)
node scripts/index.js fetch-minutes "https://xxx.feishu.cn/minutes/obcXXXXXX" -o ~/notes
node scripts/index.js fetch-minutes obcXXXXXXX -o ~/notes --flat

# Other commands
node scripts/index.js get -d doccxxxxxxxxxxxxxx --format markdown
node scripts/index.js create -f foldxxxxxxxxxxxxxx -t "标题" --file content.md
node scripts/index.js list --folder-token foldxxxxxxxxxxxxxx

# Enable debug output
DEBUG=1 node scripts/index.js sync --yesterday
```

## Architecture

All logic lives in a single file: `scripts/index.js`. It is a Node.js CLI built with `commander`.

### API approach (important)

- `get`, `get-blocks`, `sync` (content/transcript fetching) use the **`feishuRequest` helper** (raw `node:https`) — intentional workaround for missing SDK methods.
- `sync` uses `drive.v1.file.list` (SDK) for listing, then `feishuRequest` for per-doc content.
- Minutes content: `GET /open-apis/minutes/v1/minutes/{token}` → metadata (`data.minute`, with `create_time` ms + `duration` ms); `GET .../transcript` → plain text string (new API) or `{ paragraphs }` (legacy).
- `buildMinutesContent(docToken, token, opts)` — shared helper used by both `sync` and `fetch-minutes`.
- `parseMinutesToken(input)` — extracts `obm...` token from a URL or raw token string.
- All other commands (`create`, `import-file`, `list`, `delete`, `update`) use the **`@larksuiteoapi/node-sdk`** client via `createApiClient()`.

### sync command design

- Date filtering: `--yesterday` / `--date YYYY-MM-DD` — filters by `created_time` (seconds) from file list, using `Asia/Shanghai` timezone.
- File date: for `minutes`, overrides to meeting `create_time` ms (from minutes metadata API, more accurate than file creation time).
- Output structure: `{outputDir}/{YYYY-MM-DD}/{title}.md` by default; `--flat` disables subdirs.
- Minutes format: title → meeting time / duration / participants → `---` → transcript (speaker-tagged paragraphs).
- Incremental: compares `modified_time` string from drive API; on-disk state at `{outputDir}/.sync-state.json`.
- Exit code 1 if any document fails (cron-friendly).

### Authentication — two modes

**FSAuth mode** (preferred): set `FSAUTH_APP_ID` in `.env`.
- `getFsauthToken()` manages the full lifecycle: load from `.feishu-token.json` → auto-refresh via `refresh_token` → fall back to interactive OAuth flow (`startFsauthFlow`).
- OAuth flow: POST `/auth/request` → display auth URL → poll `/auth/token` every 2s → save token on `completed`.
- Tokens passed to lark SDK via `lark.withUserAccessToken(token)`.
- Production base URL: `https://fsauth.com` (override with `FSAUTH_BASE_URL`).

**Tenant token mode** (legacy): set `FEISHU_APP_ID` + `FEISHU_APP_SECRET`.
- `getTenantToken()` fetches and caches via lark SDK, refreshes 5 min before expiry.
- Tokens passed via `lark.withTenantToken(token)`.

The `getToken()` / `withToken()` helpers auto-select the active mode based on whether `FSAUTH_APP_ID` is set.

### Environment

```
# FSAuth mode (recommended)
FSAUTH_APP_ID=your-fsauth-app-id
FSAUTH_BASE_URL=https://fsauth.com    # optional
FEISHU_APP_ID=cli_xxxxxxxxxx          # optional, for lark SDK init
FEISHU_DOMAIN=https://open.feishu.cn  # optional

# Legacy mode
FEISHU_APP_ID=cli_xxxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxx
```

Token cache file: `.feishu-token.json` (gitignored). Use `logout` command to clear it.

Sync state file: `{output-dir}/.sync-state.json` — tracks `modified_time` and `date` per doc token.

### Token types

- Document token: starts with `docc`
- Folder token: starts with `fold`
- File token: starts with `file`
- Minutes (妙记) token: starts with `obm`

### Environment

```
# FSAuth mode (recommended)
FSAUTH_APP_ID=your-fsauth-app-id
FSAUTH_BASE_URL=https://fsauth.com    # optional
FEISHU_APP_ID=cli_xxxxxxxxxx          # optional, for lark SDK init
FEISHU_DOMAIN=https://open.feishu.cn  # optional

# sync defaults
FEISHU_FOLDER_TOKEN=foldxxxxxxxxxxxxxx   # default folder for sync command

# Legacy mode
FEISHU_APP_ID=cli_xxxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxx
```
