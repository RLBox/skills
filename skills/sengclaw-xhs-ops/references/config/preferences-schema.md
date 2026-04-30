---
name: preferences-schema
description: EXTEND.md YAML schema for sengclaw-xhs-ops user preferences
---

# Preferences Schema

## Full Schema

```yaml
---
version: 1

# 账号基本信息
account:
  nickname: ""          # 小红书昵称
  handle: ""            # 小红书号（@xxx）
  bio: ""               # 简介文案（用于主页承接说明）
  pinned_post: ""       # 置顶内容标题/主题

# 目标用户定位
targeting:
  audience: []          # 目标用户标签，如 ["创业者", "一人公司OPC", "想转型副业的打工仔"]
  niche: ""             # 垂直领域，如 "AI产品 × 一人公司"
  anti_audience: []     # 不想触达的群体，如 ["纯技术极客", "独立开发者"]

# 身份故事（用于评论导流模板动态填充）
identity:
  background: ""        # 背景故事一句话，如 "打工了5年，被AI焦虑逼出来做了自己的产品"
  product: ""           # 当前主要产品/项目，如 "SengClaw AI技能平台"
  milestone: ""         # 里程碑一句话，如 "做到了第一个付费用户"
  signature: ""         # 评论结尾标识，如 "🦞" 或 "@大胜龙虾"

# 评论导流偏好
comment_diversion:
  preferred_types: []   # 优先使用的钩子类型，如 ["A", "C"]（A=身份植入 B=悬念 C=反差 D=福利）
  target_niches: []     # 主要去哪些类型帖子评论，如 ["AI创业", "打工人焦虑", "副业"]
  daily_limit: 5        # 每日评论目标条数（建议3-5）
  avoid_keywords: []    # 敏感词/禁用词扩展

# 内容风格
content:
  tone: ""              # 内容语气，如 "口语化、真实折腾感"
  topics: []            # 内容支柱方向，如 ["AI工具实测", "一人公司日记", "折腾复盘"]
  avoid_topics: []      # 不碰的话题
---
```

## Field Reference

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `account.nickname` | string | "" | 小红书显示昵称 |
| `account.handle` | string | "" | 小红书号 |
| `account.bio` | string | "" | 用于主页承接的简介文案 |
| `account.pinned_post` | string | "" | 置顶笔记主题 |
| `targeting.audience` | array | [] | 目标用户标签列表 |
| `targeting.niche` | string | "" | 垂直赛道定位 |
| `targeting.anti_audience` | array | [] | 明确不想触达的群体 |
| `identity.background` | string | "" | 背景故事，用于C型反差模板 |
| `identity.product` | string | "" | 当前产品，用于A/B型身份植入 |
| `identity.milestone` | string | "" | 里程碑，用于A型情绪共鸣 |
| `identity.signature` | string | "" | 评论结尾符号/标记 |
| `comment_diversion.preferred_types` | array | [] | 优先用哪几型钩子 |
| `comment_diversion.target_niches` | array | [] | 主要去哪类帖子评论 |
| `comment_diversion.daily_limit` | int | 5 | 每日评论目标条数 |
| `content.tone` | string | "" | 整体语气风格 |
| `content.topics` | array | [] | 内容支柱方向 |

## 示例：最小配置

```yaml
---
version: 1
account:
  nickname: "张润胜 - AI做产品"
  handle: "@大胜龙虾"
identity:
  background: "打工了5年，被AI焦虑逼出来做了自己的产品"
  product: "SengClaw AI技能平台"
  signature: "🦞"
targeting:
  audience: ["创业者", "一人公司OPC", "想转型副业的打工仔"]
---
```

## 示例：完整配置

```yaml
---
version: 1
account:
  nickname: "张润胜 - AI做产品"
  handle: "@大胜龙虾"
  bio: "🦞 SengClaw创始人 ⚡️ AI产品人 × AI眼镜，边折腾边记录"
  pinned_post: "我是怎么用AI一个人做产品、从0开始找到第一个付费用户的"

targeting:
  audience: ["创业者", "一人公司OPC", "想转型副业的打工仔"]
  niche: "AI产品 × 一人公司"
  anti_audience: ["纯技术极客"]

identity:
  background: "打工了5年，被AI焦虑逼出来做了自己的产品，没想到反而做成了"
  product: "SengClaw AI技能平台"
  milestone: "做到了第一个付费用户"
  signature: "🦞"

comment_diversion:
  preferred_types: ["A", "C"]
  target_niches: ["AI创业", "打工人焦虑", "副业", "一人公司"]
  daily_limit: 5
  avoid_keywords: ["免费", "加微信", "私信我"]

content:
  tone: "口语化、真实折腾感、不鸡汤"
  topics: ["AI工具实测", "一人公司日记", "折腾复盘"]
  avoid_topics: ["政治", "竞品抨击"]
---
```
