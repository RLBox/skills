# Recipe: 断档补同步（无 AI 额度时的应急方案）

> ⚠️ **此 Recipe 仅适用于特殊情况**：飞书 AI 额度耗尽期间录音没有生成智能纪要，额度补充后需要补全历史数据。
>
> **正常情况（有额度）请用 miaoji.md 里的「云空间正常流程」，无需浏览器。**

**场景**：飞书妙记 AI 额度耗尽期间，只有录音文件没有生成智能纪要。
额度补充后，妙记会自动生成 AI 产物，但本地目录里仍有断档——用本 recipe 补全。

---

## 第一步：获取断档期间的妙记 token

飞书**没有**妙记列表 API，只能通过浏览器爬主页。

```
1. 打开妙记主页：https://wcnd6zymwumr.feishu.cn/minutes/home
2. 打开浏览器 DevTools Console，执行以下 JS 滚动加载：

   const c = document.querySelector('.list-table-body');
   let last = -1;
   const timer = setInterval(() => {
     c.scrollTop += 600;
     if (c.scrollTop === last) { clearInterval(timer); console.log('加载完毕'); }
     last = c.scrollTop;
   }, 800);

3. 等加载完毕后，提取所有 token：

   const links = document.querySelectorAll('a[href*="/minutes/obc"]');
   const tokens = [...new Set([...links].map(a => a.href.match(/obc\w+/)?.[0]).filter(Boolean))];
   console.log(JSON.stringify(tokens, null, 2));

4. 从日志中找出断档日期对应的 token（看页面上的日期标注）
```

---

## 第二步：确认权限

```bash
lark-cli auth status
# 确认 scope 包含：
# minutes:minutes.artifacts:read
# minutes:minutes.transcript:export

# 如缺失，重新授权：
lark-cli auth login \
  --scope "minutes:minutes.artifacts:read minutes:minutes.transcript:export" \
  --no-wait
# 浏览器打开链接授权后：
lark-cli auth login --device-code <device_code>
```

---

## 第三步：批量同步脚本

```python
#!/usr/bin/env python3
import subprocess, json, re, os

# 填入断档 token 和对应日期
TOKENS = {
    "obcXXXXXXXX": ("2026-03-24", "会议标题提示"),
    # ...更多 token
}

for token, (date, hint) in TOKENS.items():
    print(f"\n→ [{date}] {hint}")
    result = subprocess.run(
        ["lark-cli", "vc", "+notes", "--minute-tokens", token, "--format", "json"],
        capture_output=True, text=True
    )

    # 跳过 [vc +notes] 日志行，提取 JSON
    lines = result.stdout.splitlines()
    json_lines, in_json = [], False
    for line in lines:
        if line.startswith("{"):
            in_json = True
        if in_json:
            json_lines.append(line)

    try:
        d = json.loads("\n".join(json_lines))
    except Exception as e:
        print(f"  ❌ JSON 解析失败: {e}")
        continue

    if not d.get("ok"):
        print(f"  ❌ {d.get('error', {}).get('message', 'unknown')}")
        continue

    # ⚠️ 关键：是 data.notes[]，不是 data[]
    notes = d.get("data", {}).get("notes", [])
    for note in notes:
        title = note.get("title", "untitled")
        artifacts = note.get("artifacts", {})
        summary = artifacts.get("summary", "")
        transcript_file = artifacts.get("transcript_file", "")

        safe_title = re.sub(r'[/\\:*?"<>|]', '_', title)
        out_dir = f"/Users/zhangrunsheng/clacky_workspace/feishu-notes/{date}"
        os.makedirs(out_dir, exist_ok=True)

        # 读取转写文件（本地路径）
        transcript = ""
        if transcript_file and os.path.exists(transcript_file):
            with open(transcript_file, "r") as f:
                transcript = f.read()

        # 写入 Markdown
        path = f"{out_dir}/{safe_title}.md"
        with open(path, "w") as f:
            f.write(f"# {title}\n\n")
            if summary:
                f.write(f"## AI 摘要\n\n{summary}\n\n")
            if transcript:
                f.write(f"## 转写内容\n\n{transcript}\n")
            elif not summary:
                f.write("（无 AI 产物，当时额度已耗尽）\n")

        print(f"  ✅ {safe_title}.md  [摘要:{bool(summary)}, 转写:{bool(transcript)}]")
```

---

## 关键踩坑记录

| 问题 | 根因 | 解法 |
|------|------|------|
| `data[]` 为空 | 数据结构是 `data.notes[]` 不是 `data[]` | 用 `d["data"]["notes"]` |
| JSON 解析失败 | stdout 前有 `[vc +notes]` 日志行 | 跳过非 `{` 开头的行 |
| transcript_file 路径 404 | 是**相对当前目录**的本地路径 | 在正确工作目录下运行脚本 |
| 权限报错 | 缺 `minutes.artifacts:read` scope | 用 device flow 重新授权 |

---

## 验证结果

```bash
ls /Users/zhangrunsheng/clacky_workspace/feishu-notes/2026-03-24/
ls /Users/zhangrunsheng/clacky_workspace/feishu-notes/2026-03-25/
ls /Users/zhangrunsheng/clacky_workspace/feishu-notes/2026-03-26/
```
