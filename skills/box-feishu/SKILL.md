---
name: sengclaw-feishu
version: 2.1.0
description: >
  飞书全能助手：基于 lark-cli 统一操作飞书所有服务。
  覆盖：妙记/会议纪要、云文档、云空间、电子表格、多维表格、即时消息、日历、任务、邮件、知识库、通讯录、视频会议。
  当用户说「飞书」「妙记」「会议纪要」「云文档」「发飞书消息」「飞书日历」「飞书表格」「飞书多维表格」「飞书知识库」等时使用。
metadata:
  requires:
    bins: ["lark-cli"]
---

# sengclaw-feishu v2 — 飞书全能助手

基于官方 `lark-cli` 工具，统一操作飞书所有服务。

---

## ⚙️ 环境准备

```bash
lark-cli --version      # 确认已安装
lark-cli auth status    # 每次操作前确认 token 有效
```

> 认证/权限问题详见 → [references/auth.md](references/auth.md)

---

## 📋 使用前必读

调用原生 API 前，**必须先用 schema 查参数**，不要猜字段：

```bash
lark-cli schema <resource>.<method>
# 例如：lark-cli schema drive.metas.batch_query
```

**安全规则**：禁止输出 appSecret/accessToken；写入/删除前必须确认用户意图。

---

## 🎙️ 妙记 & 会议纪要

> 详见 → [references/services/miaoji.md](references/services/miaoji.md)
> 断档批量补同步 → [references/recipes/sync-missing-minutes.md](references/recipes/sync-missing-minutes.md)

**取妙记：先走云空间，找不到再走浏览器**

```bash
# 1️⃣ 优先：列云空间，找「智能纪要：」前缀的 docx
lark-cli api GET /open-apis/drive/v1/files --params '{"folder_token": "", "page_size": 20}'
lark-cli docs +fetch --doc <token> | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['markdown'])"

# 2️⃣ Fallback：云空间没找到 → 浏览器爬取 obc token → vc +notes
lark-cli vc +notes --minute-tokens <obc_token>   # 取 AI 摘要 + 转写
lark-cli vc +search --start "2026-04-01" --end "2026-04-02"  # 搜会议
```

---

## 📄 云文档 (docs)

> 详见 → [references/services/docs.md](references/services/docs.md)

```bash
lark-cli docs +fetch --doc <url_or_token>     # 读文档（返回 Markdown）
lark-cli docs +search --query "关键词"         # 搜文档
lark-cli docs +create --title "标题" --markdown "# 内容"
lark-cli docs +update --doc <url> --mode append --markdown "新内容"
```

---

## 📁 云空间 (drive)

> 详见 → [references/services/drive.md](references/services/drive.md)

```bash
lark-cli api GET /open-apis/drive/v1/files    # 列文件
lark-cli drive +download --file-token <token> --output ./file.docx
lark-cli drive +upload --file ./local.pdf --folder-token <token>
```

---

## 📊 电子表格 & 🗃️ 多维表格

> 详见 → [references/services/sheets-base.md](references/services/sheets-base.md)

```bash
lark-cli schema sheets.spreadsheets.values.get   # 先查参数
lark-cli schema bitable.apps.tables.records.list
```

---

## 💬 即时消息 / 📅 日历 / ✅ 任务

> 详见 → [references/services/im-calendar-task.md](references/services/im-calendar-task.md)

```bash
lark-cli im +messages-send --user-id <open_id> --text "消息"
lark-cli calendar +agenda
lark-cli task +get-my-tasks
```

---

## 📧 邮件 / 📚 知识库 / 👥 通讯录

> 详见 → [references/services/mail-wiki-contact.md](references/services/mail-wiki-contact.md)

```bash
lark-cli mail +send --to "xxx@company.com" --subject "主题" --body "内容"
lark-cli wiki spaces list
lark-cli contact +search --query "张润胜"
```

---

## 🔧 常见问题速查

| 问题 | 原因 | 解法 |
|------|------|------|
| Permission denied [99991679] | 缺 scope | 见 [auth.md](references/auth.md) |
| Wiki 链接读取失败 | `/wiki/TOKEN` 非真实 token | 先 `wiki spaces get_node` |
| vc +notes 返回空 | data 结构是 `data.notes[]` | 见 [miaoji.md](references/services/miaoji.md) |
| Token 过期 | refresh token > 7天 | `lark-cli auth login` 重新授权 |
