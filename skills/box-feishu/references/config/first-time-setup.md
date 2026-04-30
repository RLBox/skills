---
name: first-time-setup
description: First-time setup flow for feishu-miaoji-notes when no EXTEND.md is found
---

# First-Time Setup

## 触发条件

1. **No EXTEND.md found** → 引导用户完成首次配置，保存到用户级路径
2. **EXTEND.md found but default_output_dir is null** → 仅询问输出目录
3. **EXTEND.md found but feishu_minutes_home is null** → 询问妙记主页 URL（用于获取全部妙记列表）

> ⚠️ **为什么需要妙记主页 URL？**
> 飞书官方 API 没有"列出全部妙记"的接口（`minutes.minutes.get` 只能按 token 查单条）。
> 当需要同步/补全妙记列表时，唯一途径是通过浏览器打开妙记主页 `https://<domain>.feishu.cn/minutes/home`，
> 从页面爬取 token 列表。URL 因企业/个人域名不同而不同，需用户提供。

## EXTEND.md 保存路径优先级

**默认保存目标**：`~/clacky_workspace/.sengclaw-skills/feishu-miaoji-notes/EXTEND.md`（用户级，跨目录生效）

| 级别 | 路径 | 作用域 |
|------|------|--------|
| Project | `.sengclaw-skills/feishu-miaoji-notes/EXTEND.md` | 当前目录，临时覆盖 |
| User（默认）| `~/clacky_workspace/.sengclaw-skills/feishu-miaoji-notes/EXTEND.md` | 所有目录 |

## Setup Flow

```
No EXTEND.md          output null      minutes_home null
      │                    │                   │
      ▼                    ▼                   ▼
┌───────────────┐  ┌──────────────┐  ┌──────────────────────┐
│ 询问输出目录  │  │ 仅询问输出   │  │ 仅询问妙记主页 URL   │
│ 询问妙记 URL  │  │ 目录         │  └──────────────────────┘
│ 可选 folder   │  └──────────────┘          │
└───────────────┘          │                 │
        │                  └────────┬────────┘
        ▼                           ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 保存到 ~/clacky_workspace/.sengclaw-skills/feishu-miaoji-notes/EXTEND.md │
└──────────────────────────────────────────────────────────────────────────┘
        │
        ▼
    继续执行命令
```

## Flow 1: No EXTEND.md（首次设置）

用 AskUserQuestion 一次询问所有配置：

### Question 1: 本地输出目录

```yaml
header: "同步输出目录"
question: "飞书文档/会议纪要同步到哪个本地目录？"
options:
  - label: "~/clacky_workspace/feishu-notes（推荐）"
    description: "Clacky 工作区下的 feishu-notes 文件夹"
  - label: "~/notes/feishu"
    description: "用户主目录下的 notes/feishu 文件夹"
  - label: "自定义路径"
    description: "手动输入本地路径"
```

### Question 2: 妙记主页 URL（重要）

```yaml
header: "飞书妙记主页 URL"
question: |
  请提供你的飞书妙记主页 URL。
  飞书没有"列出全部妙记"的 API，只能通过网页获取完整列表。
  格式：https://<你的飞书域名>/minutes/home
  例如：https://yourcompany.feishu.cn/minutes/home
  （可留空，需要时手动指定）
```

### Question 3: 默认文件夹 Token（可选）

```yaml
header: "飞书文件夹 Token（可选）"
question: "是否有常用的飞书文件夹 token？可以留空，每次 sync 时手动指定。"
```

## Flow 2: EXTEND.md found but output null

仅询问输出目录（Question 1），不询问其他配置。

## Flow 3: EXTEND.md found but feishu_minutes_home null

仅询问妙记主页 URL（Question 2），提示用户原因：
> "飞书没有列出全部妙记的 API，需要妙记主页 URL 才能通过浏览器获取完整列表。请提供你的妙记主页地址（格式：https://xxx.feishu.cn/minutes/home）"

## 保存格式

生成 EXTEND.md 时使用以下格式（只写非 null 的字段）：

```yaml
---
version: 1
default_output_dir: ~/clacky_workspace/feishu-notes
feishu_minutes_home: https://yourcompany.feishu.cn/minutes/home
# default_folder_token: foldxxxxxxxxxxxxxx  # 如用户提供则取消注释
---
```

## 运行方式（Agent 执行）

```bash
# Resolve BUN_X: bun installed → bun; else → npx -y bun
${BUN_X} {baseDir}/scripts/index.ts <command> [options]
```

无需 npm install，无 package.json，零依赖，bun 直接运行 TypeScript。
