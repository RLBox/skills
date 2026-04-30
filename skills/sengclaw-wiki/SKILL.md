---
name: sengclaw-wiki
description: '张润胜的个人知识 Wiki 系统（LLM Wiki）。把各类素材编译进结构化知识库，支持 ingest（摄入）、query（查询）、lint（健康检查）三大操作。当用户说「加进 wiki」「ingest 这个」「把这个存进知识库」「wiki 里有没有」「查一下知识库」「从我的 wiki 找」「检查 wiki」「wiki 健康检查」「wiki 状态」「我的知识库有什么」「/wiki ingest」「/wiki query」「/wiki lint」「这篇文章值得记录」「帮我存到知识库」「这个 URL 加进 wiki」「飞书妙记 ingest」「日记加进知识库」「知识库里有关于 xxx 的内容吗」时触发本技能。也应在用户提供了文章/网页/对话洞察并明显希望沉淀知识时主动触发。'
disable-model-invocation: false
user-invocable: true
---

# sengclaw-wiki Skill

张润胜个人知识 Wiki 系统。基于 Karpathy LLM Wiki 理念，把所有素材（飞书妙记、网页文章、日记、对话洞察）编译成结构化、持续增长的个人知识库，存储在 Obsidian vault。

---

## 关键路径

- **Wiki 根目录**：`~/clacky_workspace/wiki/`
- **Schema 文件**：`~/clacky_workspace/wiki/WIKI.md`
- **总目录**：`~/clacky_workspace/wiki/index.md`
- **操作日志**：`~/clacky_workspace/wiki/log.md`
- **子目录**：`sources/` · `topics/` · `entities/` · `synthesis/`

---

## 执行流程

### 启动时（每次调用本 skill 必做）

```
1. 读取 ~/clacky_workspace/wiki/WIKI.md（了解结构和约定）
2. 读取 ~/clacky_workspace/wiki/index.md（了解当前 wiki 状态）
3. 根据用户指令执行对应操作
```

---

## 操作一：Ingest（摄入新素材）

**触发**：用户提供素材（URL / 文件路径 / 粘贴文字 / 飞书妙记 / 日记）并说「ingest」或「加进 wiki」

### Step 1 — 获取素材内容

根据素材类型：

| 素材类型 | 处理方式 |
|---------|---------|
| URL | 检查 `~/clacky_workspace/url-to-markdown/` 是否有缓存，没有则调用 `sengclaw-url-to-markdown` skill 抓取 |
| 文件路径（.md/.txt） | 直接读取文件内容 |
| 粘贴文字 | 直接使用 |
| 飞书妙记 | 在 `~/clacky_workspace/feishu-notes/` 找对应文件 |
| 日记 | 在 `~/clacky_workspace/memory/` 找对应日期文件 |

### Step 2 — 快速摘要确认（可选）

列出 3-5 个关键洞察，问用户：「有什么特别想强调的角度吗？还是直接 ingest？」
如果用户说「直接」，跳过此步。

### Step 3 — 创建 source 摘要页

**文件路径**：`wiki/sources/YYYY-MM-DD-slug.md`（slug 用素材标题的 kebab-case，2-4 个词，中文转拼音或用英文关键词）

**文件内容模板**：

```markdown
---
title: "素材标题"
source_type: article | feishu-note | diary | video | chat | web | other
original_url: "https://..."
date_ingested: "YYYY-MM-DD"
date_original: "YYYY-MM-DD"
tags: [tag1, tag2]
---

# 素材标题

> **来源**：[标题](url) | **类型**：xxx | **日期**：YYYY-MM-DD

## 核心摘要

（3-5 段，提炼最关键内容，保留原文的核心数据和判断）

## 关键观点

- 观点 1
- 观点 2
- 观点 3
- ...

## 涉及主题

[[topics/topic1]] · [[topics/topic2]]

## 涉及实体

[[entities/entity1]] · [[entities/entity2]]

## 原文亮点

> （值得保留的原文引用，1-3 条）

## 与已有认知的关系

（与 wiki 中已有内容的联系或矛盾，用 ⚠️ 标注冲突）
```

### Step 4 — 更新 Topic 页

对每个涉及的主题，在 `wiki/topics/` 中：

**已有该主题页**：
- 在「相关素材」section 添加新 source 双链
- 如有新观点，更新「核心观点」section
- 如有矛盾，用 `> ⚠️ 与 [[source]] 的观点有冲突：...` 标注

**没有该主题页**：新建文件 `wiki/topics/topic-name.md`，模板如下：

```markdown
---
title: "主题名称"
tags: [category]
created: "YYYY-MM-DD"
updated: "YYYY-MM-DD"
source_count: 1
---

# 主题名称

## 定义 / 概述

（当前最佳理解，随素材积累持续更新）

## 核心观点

- 观点 1（来源：[[sources/xxx]]）
- 观点 2（来源：[[sources/xxx]]）

## 张润胜的判断

> 🦞 个人判断：...（与客观描述区分）

## 相关素材

- [[sources/xxx]] — 一行摘要

## 相关主题

[[topics/related1]] · [[topics/related2]]

## 相关实体

[[entities/entity1]]
```

### Step 5 — 更新 Entity 页（如涉及具体人/产品/公司）

类似 topic 页逻辑，在 `wiki/entities/` 中新建或更新，模板：

```markdown
---
title: "实体名称"
entity_type: person | product | company | tool | project
tags: []
created: "YYYY-MM-DD"
updated: "YYYY-MM-DD"
---

# 实体名称

## 基本信息

（类型、背景、核心定位）

## 最新动态

（按时间，最新在前）

## 张润胜的评价

> 🦞 ...

## 相关素材

- [[sources/xxx]]

## 相关主题

[[topics/xxx]]
```

### Step 6 — 更新 index.md

在对应分类下添加条目（如 Sources 计数 +1，Topics 新增或标记已更新）：

```markdown
- [[sources/YYYY-MM-DD-slug]] — 一行摘要（YYYY-MM-DD）
```

更新文件头部的统计表格。

### Step 7 — 追加 log.md 记录

追加到文件末尾（不是开头）：

```markdown
## [YYYY-MM-DD] ingest | 素材标题

**操作**：ingest
**素材**：[[sources/YYYY-MM-DD-slug]]
**摘要**：一行描述核心内容
**更新页面**：[[topics/xxx]] · [[entities/xxx]]（共 N 页）
```

### Ingest 完成后告知用户

简报：
```
✅ Ingest 完成
- 创建：sources/YYYY-MM-DD-slug.md
- 更新 Topics：X 页（新建 Y 页，更新 Z 页）
- 更新 Entities：X 页
- 日志已追加
```

---

## 操作二：Query（查询知识库）

**触发**：用户问问题，涉及 wiki 内容

### Step 1 — 读 index.md 定位相关页面

搜索 index.md，找可能相关的 source / topic / entity / synthesis 页。

### Step 2 — 读相关 wiki 页内容

优先读 topic 页（综合认知），再读 source 页（具体细节），再读 synthesis 页（已有分析）。

### Step 3 — 综合回答

在回答中用 `[[双链]]` 注明信息来源。

### Step 4 — 判断是否存入 synthesis

如果这次问答产生了有价值的综合分析（比较、归纳、判断），询问用户：
「这个分析值得存档，要存入 wiki/synthesis/ 吗？」

如用户同意，创建 `wiki/synthesis/YYYY-MM-DD-slug.md`，并更新 index.md 和 log.md。

---

## 操作三：Lint（健康检查）

**触发**：用户说「lint wiki」「检查 wiki」

### 执行步骤

```
1. 列出所有 wiki 页面
2. 检查孤立页面（无入链引用）
3. 检查 source 页中提到的 topic/entity 是否有对应 wiki 页
4. 检查 topics/ 中 updated 超过 90 天的页面
5. 统计 index.md 中被多次提及但无独立页的概念
6. 输出健康报告
```

**健康报告格式**：

```markdown
## Wiki 健康报告 YYYY-MM-DD

### 统计
- 总页面数：N
- 孤立页面：N 个
- 过时页面（90天）：N 个

### 🔴 需要处理
1. 孤立页面：[[page]] — 建议：...
2. 缺失页面：概念 X 被提及 N 次但无独立页

### 🟡 建议关注
1. 过时页面：[[topics/xxx]] 最后更新 YYYY-MM-DD
2. 缺少交叉引用：[[sources/xxx]] 提到 Y 但未建链

### 🟢 状态良好
- N 个页面有完整交叉引用
- 最近 30 天新增 N 个 source
```

询问用户是否逐项修复。

---

## 注意事项

1. **永远不修改 Raw Sources**（`feishu-notes/`、`memory/`、`url-to-markdown/`、`articles/` 里的文件）
2. **index.md 统计数据要保持准确**，每次 ingest 后更新数字
3. **双链使用相对路径格式**：`[[sources/xxx]]`（不加 `.md` 后缀，Obsidian 标准）
4. **log.md 只追加，不删除**，这是 wiki 演化的历史记录
5. **矛盾要显式标注**，不要静默覆盖旧有认知
6. **张润胜的个人判断**用 `> 🦞` blockquote，与客观描述严格区分
