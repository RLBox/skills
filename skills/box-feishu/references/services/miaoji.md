# 妙记 & 会议纪要

> Scope: `minutes:minutes:readonly` `minutes:minutes.artifacts:read` `minutes:minutes.transcript:export` `vc:meeting:readonly`

---

## 核心概念

- **minute_token**：从 URL 最后段提取，如 `https://*.feishu.cn/minutes/obc123456` → `obc123456`（`obc` 开头）
- **meeting_id**：视频会议 ID，用于查询视频会议产生的纪要
- **AI 产物（artifacts）**：summary（摘要）+ transcript（逐字稿）

---

## 常用命令

```bash
# 获取妙记元信息（标题、时长）
lark-cli minutes minutes get --params '{"minute_token": "obc123456"}'

# 获取妙记 AI 产物（摘要 + 转写文件路径）⭐ 最常用
lark-cli vc +notes --minute-tokens obc123456 --format json

# 搜索已结束的视频会议（时间范围最大1个月，page-size 最大30）
lark-cli vc +search --start "2026-04-01" --end "2026-04-02" --format json --page-size 30

# 通过 meeting_id 批量获取纪要（单次最多50个）
lark-cli vc +notes --meeting-ids "id1,id2,id3"
```

---

## ⚠️ vc +notes 返回数据结构（关键，曾踩坑）

```
stdout 包含两部分：
1. [vc +notes] 开头的日志行（须跳过）
2. JSON 正文（从第一个 { 开始）

JSON 结构：
{
  "ok": true,
  "data": {
    "notes": [           ← 是 data.notes[]，不是 data[]！
      {
        "title": "会议标题",
        "minute_token": "obc...",
        "artifacts": {
          "summary": "AI摘要文本",
          "transcript_file": "artifact-<title>-<token>/transcript.txt"
        }
      }
    ]
  }
}
```

**Python 解析模板**：
```python
result = subprocess.run(
    ["lark-cli", "vc", "+notes", "--minute-tokens", token, "--format", "json"],
    capture_output=True, text=True
)
# 跳过 [vc +notes] 日志行，找到 JSON 部分
lines = result.stdout.splitlines()
json_lines, in_json = [], False
for line in lines:
    if line.startswith("{"):
        in_json = True
    if in_json:
        json_lines.append(line)
d = json.loads("\n".join(json_lines))

notes = d.get("data", {}).get("notes", [])
for note in notes:
    title = note["title"]
    summary = note["artifacts"].get("summary", "")
    transcript_file = note["artifacts"].get("transcript_file", "")
    # transcript_file 是本地路径，直接 open() 读取
```

---

## 获取妙记：两步降级策略

取妙记时按以下顺序执行，**先走云空间，找不到再走浏览器**：

---

### 第一步：云空间（优先）

飞书妙记生成智能纪要后，会以 `docx` 格式存入用户云空间，名称前缀为「智能纪要：」。

```bash
# 列云空间文件，找「智能纪要：」前缀的 docx
lark-cli api GET /open-apis/drive/v1/files --params '{"folder_token": "", "page_size": 20}'
# → 找 type=docx、name 以「智能纪要：」开头的条目，取 token 字段

# 读取完整内容
lark-cli docs +fetch --doc <token> | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['markdown'])"
```

**返回结构**：
```json
{
  "ok": true,
  "data": {
    "doc_id": "B8tddD4MkogAsOx4R5Jc3j4pnOd",
    "markdown": "...",
    "title": "智能纪要：XXX 2026年4月2日"
  }
}
```

> 云空间文件按修改时间倒序，最新智能纪要通常在第一条。

**✅ 云空间找到了 → 直接用，流程结束。**
**❌ 云空间没找到（列表为空 / 没有「智能纪要：」条目）→ 进入第二步。**

---

### 第二步：浏览器爬取 obc Token（fallback）

云空间找不到时（可能是额度不足未生成智能纪要、或文件在其他目录），通过浏览器获取原始妙记的 `obc` token：

```
1. 浏览器打开 https://wcnd6zymwumr.feishu.cn/minutes/home
2. JS 滚动懒加载：
   container = document.querySelector('.list-table-body')
   container.scrollTop += 800  // 重复执行直到加载完
3. 从链接提取 obc token：
   links = document.querySelectorAll('a[href*="/minutes/obc"]')
   tokens = [...new Set([...links].map(a => a.href.match(/obc\w+/)[0]))]
```

取到 token 后用 `vc +notes` 获取 AI 产物（见上方「常用命令」）。

断档批量补同步 → 见 [references/recipes/sync-missing-minutes.md](../recipes/sync-missing-minutes.md)

---

## 会议纪要汇总工作流

```
时间范围
  → vc +search              → 会议列表(meeting_ids)
  → vc +notes --meeting-ids → 纪要文档 tokens
  → drive metas batch_query → 文档链接
  → 结构化报告
```

---

## API vs 命令对照

| 场景 | 命令 |
|------|------|
| 有妙记 URL，取元信息 | `lark-cli minutes minutes get` |
| 有妙记 URL，取转写/总结 | `lark-cli vc +notes --minute-tokens` |
| 有 meeting_id，取纪要 | `lark-cli vc +notes --meeting-ids` |
| 搜索一段时间的会议 | `lark-cli vc +search` |
| 历史断档补同步 | 见 `references/recipes/sync-missing-minutes.md` |
