---
name: sengclaw-obsidian
description: >
  Obsidian 全能技能：日记读写与记忆索引更新、笔记创建/搜索/管理、Obsidian Flavored Markdown（双链/callout/frontmatter）、Bases 数据库视图（.base 文件）、JSON Canvas（.canvas 文件）、插件与主题开发调试。
  当用户说「写日记」「记一下」「帮我记一下」「备忘」「我想到」「写到日记」「今天的日记」「追加到日记」「查一下某天」「Obsidian 日记」「日记同步」「记忆更新」「搜索笔记」「创建笔记」「双链」「callout」「frontmatter」「Bases」「canvas」「obsidian」时使用。
user-invocable: true
---

# sengclaw-obsidian — Obsidian 全能技能

---

## ⚙️ 环境信息

- **Vault**：`clacky_workspace`（始终使用这个，除非用户明确说另一个）
- **日记目录**：`memory/`（格式 `YYYY-MM-DD.md`）
- **日记原文路径**：`/Users/zhangrunsheng/clacky_workspace/memory/YYYY-MM-DD.md`
- **记忆索引**：`~/.clacky/memories/daily-journal-index.md`
- **前提**：Obsidian app 必须运行中；未运行时 fallback 到 `file_reader`/`write` 直接操作文件
- **每次运行前加**：`export PATH="$PATH:/Applications/Obsidian.app/Contents/MacOS"`

---

## 🗒️ 日记 & 记忆联动

> 详见 → [references/journal.md](references/journal.md)

```bash
export PATH="$PATH:/Applications/Obsidian.app/Contents/MacOS"
obsidian vault="clacky_workspace" daily:read                          # 读今天
obsidian vault="clacky_workspace" daily:append content="- 新内容"    # 追加
obsidian vault="clacky_workspace" read path="memory/2026-03-28.md"   # 历史某天
ruby SKILL_DIR/scripts/update_journal_index.rb                        # 更新记忆索引
```

### ⚡ 快速记录行为规范（「记一下」「备忘」场景）

> 用户说「记一下」「备忘」「我想到」时，必须**立即执行**，不询问确认。

1. **立即执行**：不需要询问，直接写，不要问"确认吗"
2. **用户说什么记什么**：不改写、不升华、不补充举例，保留原始内容
3. **不加多余前缀**：不加"用户说"、"记录："等，直接写原文
4. **自动标注时间**：用户未给时间时，自动加当前时间戳
5. **静默完成**：写入后只回复 `✅ 已记到日记`，不需要更多解释

**执行流程：**

```bash
TODAY=$(date "+%Y-%m-%d")
DIARY_PATH="/Users/zhangrunsheng/clacky_workspace/memory/${TODAY}.md"
TEMPLATE_PATH="/Users/zhangrunsheng/clacky_workspace/templates/daily-note.md"

# 1. 日记不存在时，用模板创建（模板也没有则创建最小结构）
if [ ! -f "$DIARY_PATH" ]; then
  if [ -f "$TEMPLATE_PATH" ]; then
    sed "s/{{date}}/${TODAY}/g" "$TEMPLATE_PATH" > "$DIARY_PATH"
  else
    printf -- "---\ndate: ${TODAY}\ntags: [日记]\n---\n\n# ${TODAY} 日记\n\n" > "$DIARY_PATH"
  fi
fi

# 2. 追加内容（优先 Obsidian CLI，失败则直接写文件）
export PATH="$PATH:/Applications/Obsidian.app/Contents/MacOS"
obsidian vault="clacky_workspace" daily:append content="[TIME] USER_CONTENT" \
  || ruby -e "
    path = '$DIARY_PATH'
    t = Time.now.strftime('%H:%M')
    content = File.read(path)
    File.write(path, content + \"\n\n## \#{t} 记录\n\nUSER_CONTENT\")
  "
```

---

## 📋 笔记操作（CLI）

> 详见 → [references/cli.md](references/cli.md)

```bash
obsidian read file="My Note"
obsidian create name="New Note" content="# Hello" silent
obsidian append file="My Note" content="新内容"
obsidian search query="关键词" limit=10
obsidian tasks daily todo
```

---

## ✍️ Obsidian Flavored Markdown

> 详见 → [references/markdown.md](references/markdown.md)

```markdown
[[Note Name]]            # 内部链接
![[image.png]]           # 嵌入
> [!note] 标题           # Callout
#tag  #nested/tag        # Tags
```

---

## 🗃️ Bases（.base 文件）

> 详见 → [references/bases.md](references/bases.md)

```yaml
filters: 'file.hasTag("project")'
views:
  - type: table
    name: "Active Projects"
```

---

## 🎨 JSON Canvas（.canvas 文件）

> 详见 → [references/canvas.md](references/canvas.md)

```json
{ "nodes": [...], "edges": [...] }
```

---

## 🔧 插件 & 主题开发

> 详见 → [references/plugin-dev.md](references/plugin-dev.md)

```bash
obsidian plugin:reload id=my-plugin
obsidian dev:errors
obsidian dev:screenshot path=screenshot.png
```

---

## Supporting Files
- `scripts/update_journal_index.rb` — 提炼日记要点并更新 `~/.clacky/memories/daily-journal-index.md`
