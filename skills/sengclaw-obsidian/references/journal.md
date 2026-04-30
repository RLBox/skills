# 日记 & 记忆联动

## 日记操作

### 读取今天日记
```bash
export PATH="$PATH:/Applications/Obsidian.app/Contents/MacOS"
obsidian vault="clacky_workspace" daily:read
```

### 追加内容到今天日记
```bash
export PATH="$PATH:/Applications/Obsidian.app/Contents/MacOS"
obsidian vault="clacky_workspace" daily:append content="- 新内容\n- 另一条"
```

### 创建/覆写今天日记（写全文）
```bash
export PATH="$PATH:/Applications/Obsidian.app/Contents/MacOS"
DATE=$(date +%Y-%m-%d)
obsidian vault="clacky_workspace" create path="memory/${DATE}.md" content="# ${DATE}\n\n## 今天的状态\n\n..." silent overwrite
```

### 查询历史某天日记
```bash
export PATH="$PATH:/Applications/Obsidian.app/Contents/MacOS"
obsidian vault="clacky_workspace" read path="memory/2026-03-28.md"
```
若 obsidian 读取失败，fallback：`file_reader("/Users/zhangrunsheng/clacky_workspace/memory/YYYY-MM-DD.md")`

---

## 日记格式规范

```markdown
# YYYY-MM-DD

## 今天的状态
（一句话概括）

## 项目进展
（分项目，用 ### 和 ✅/🔄/❌ 标记）

## 微信聊天要点
（重要的对话摘要）

## 关键洞察
（值得沉淀的想法）
```

---

## 更新记忆索引（daily-journal-index.md）

写完日记或追加重要内容后，提炼 3~5 条要点更新索引：

1. 读取今天日记全文
2. 提炼要点（每条 ≤30 字，聚焦项目进展、关键决策、重要事件）
3. 检查 `~/.clacky/memories/daily-journal-index.md` 是否已有今天条目
4. 没有则追加，已有则更新

**追加格式**：
```markdown
## YYYY-MM-DD
- 要点1（≤30字）
- 要点2
- 要点3
```

用 Ruby 脚本追加（幂等，不重复写）：
```bash
ruby SKILL_DIR/scripts/update_journal_index.rb
```
