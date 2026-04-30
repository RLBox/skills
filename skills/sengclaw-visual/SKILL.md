---
name: sengclaw-visual
description: >
  AI 图像生成全能技能，涵盖4种场景：
  （1）通用图片生成（image-gen）：支持 OpenAI/Google/豆包/即梦/DashScope/MiniMax/Replicate 等多 API，文生图、参考图、批量生成。触发词：生成图片、绘图、创作画面、image gen；
  （2）文章封面图（cover-image）：5维度定制，10种配色×7种渲染风格。触发词：生成封面图、文章封面、做个封面；
  （3）信息图（infographic）：21种版式×20种视觉风格，高密度信息可视化。触发词：信息图、infographic、visual summary、可视化；
  （4）知识漫画（comic）：多种艺术风格×叙事基调，生成分镜脚本+序列化图像。触发词：知识漫画、教育漫画、日漫风、水墨风、漫画。
metadata:
  openclaw:
    requires:
      anyBins:
        - bun
        - npx
---

# sengclaw-visual — AI 图像生成全能技能

合并自：`sengclaw-image-gen` + `sengclaw-cover-image` + `sengclaw-infographic` + `sengclaw-comic`

---

## ⚙️ 环境信息

- **运行时**：优先用 `bun`，回退 `npx -y bun`
- **脚本目录**：`{baseDir}/scripts/`
- **配置文件 EXTEND.md**：首次使用 image-gen 时自动引导创建，路径 `~/.sengclaw-skills/sengclaw-image-gen/EXTEND.md`

---

## 🖼️ 通用图片生成（image-gen）

> 详见 → [references/image-gen.md](references/image-gen.md)

```bash
# 基础用法
${BUN_X} {baseDir}/scripts/main.ts --prompt "A cat" --image out.png

# 指定 provider / 比例 / 参考图
${BUN_X} {baseDir}/scripts/main.ts --prompt "..." --image out.png --provider dashscope --ar 16:9 --ref source.png

# 批量生成
${BUN_X} {baseDir}/scripts/main.ts --batchfile batch.json
```

支持 provider：`openai` `google` `azure` `openrouter` `dashscope` `minimax` `jimeng` `seedream` `replicate`

---

## 🎨 文章封面图（cover-image）

> 详见 → [references/cover-image/](references/cover-image/)

```bash
/sengclaw-visual cover path/to/article.md
/sengclaw-visual cover article.md --type conceptual --palette warm --rendering flat-vector --quick
/sengclaw-visual cover article.md --style blueprint
```

5 个维度：`--type` `--palette` `--rendering` `--text` `--mood`
比例：`16:9`（默认）`2.35:1` `4:3` `1:1` `3:4`

---

## 📊 信息图（infographic）

> 详见 → [references/infographic/](references/infographic/)

```bash
/sengclaw-visual infographic path/to/content.md
/sengclaw-visual infographic content.md --layout bento-grid --style craft-handmade --aspect portrait
```

21 种版式 × 20 种视觉风格，详见 references。

---

## 📚 知识漫画（comic）

> 详见 → [references/comic/](references/comic/)

```bash
/sengclaw-visual comic article.md
/sengclaw-visual comic article.md --art manga --tone warm --layout cinematic
/sengclaw-visual comic article.md --storyboard-only   # 只生成分镜脚本
/sengclaw-visual comic article.md --prompts-only      # 分镜 + 提示词，不生成图
/sengclaw-visual comic article.md --regenerate 3      # 重新生成第3页
```

艺术风格：`ligne-claire` `manga` `realistic` `ink-brush` `chalk`
叙事基调：`neutral` `warm` `dramatic` `romantic` `energetic` `vintage` `action`

---

## Supporting Files
- `scripts/main.ts` — image-gen 主脚本
- `scripts/comic/` — comic 专用脚本
- `references/image-gen.md` — 完整 API 选项、环境变量、批量格式
- `references/cover-image/` — 封面图维度参考
- `references/infographic/` — 版式 & 风格画廊
- `references/comic/` — 漫画艺术风格 & 工作流
