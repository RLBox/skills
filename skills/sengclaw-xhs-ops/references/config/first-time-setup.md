---
name: first-time-setup
description: First-time setup flow for sengclaw-xhs-ops user preferences
---

# First-Time Setup

## Overview

当没有找到 EXTEND.md 时，引导用户完成偏好配置。

**⛔ 阻塞操作**：配置完成前不得进行任何任务内容操作。不要：
- 问内容/选题相关的问题
- 开始写评论/笔记
- 启动任何发布/分析流程

只完成以下问题 → 保存 EXTEND.md → 再继续正式任务。

## 配置检查流程

```
启动任务
    │
    ▼
检查 EXTEND.md 是否存在
~/clacky_workspace/.sengclaw-skills/sengclaw-xhs-ops/EXTEND.md
    │
    ├── 存在 → 读取配置 → 继续任务
    │
    └── 不存在 → 进入首次引导流程
            │
            ▼
        提问（见下）
            │
            ▼
        创建 EXTEND.md
            │
            ▼
        继续正式任务
```

## 引导问题

**语言**：跟随用户输入语言，默认中文。

### 问题 1：账号昵称

```
你的小红书昵称是什么？（用于评论中的身份定位）
例如：张润胜 - AI做产品 / 大胜龙虾 / xx创业日记
```

### 问题 2：身份背景（一句话）

```
用一句话说说你的背景故事？
这句话会用在评论模板的「反差对比」里
例如：打工了5年，被AI焦虑逼出来做了自己的产品
     / 做了10年运营，现在用AI做自己的产品
     / 普通打工仔，用AI跑了个副业
```

### 问题 3：目标用户

```
你主要想吸引哪类人关注你？（可多选）
- 创业者 / 想创业的人
- 一人公司 OPC / 个体经营者
- 想转型副业的打工仔
- 其他（请描述）
```

### 问题 4：每天评论目标数量

```
每天计划在多少条帖子下评论导流？
建议3-5条，质量>数量
（直接输入数字即可，如：5）
```

## 保存路径

始终保存到**用户级路径**，适用所有目录，不需要询问用户。

| 级别 | 路径 | 作用范围 |
|------|------|---------|
| 用户（默认） | `~/clacky_workspace/.sengclaw-skills/sengclaw-xhs-ops/EXTEND.md` | 所有目录 |
| 项目（覆盖） | `.sengclaw-skills/sengclaw-xhs-ops/EXTEND.md` | 当前目录 |

## 保存后

1. 创建目录 `~/clacky_workspace/.sengclaw-skills/sengclaw-xhs-ops/`（如不存在）
2. 写入 EXTEND.md
3. 确认：「已保存到 ~/clacky_workspace/.sengclaw-skills/sengclaw-xhs-ops/EXTEND.md，可随时编辑修改」
4. 继续正式任务

## EXTEND.md 模板

```yaml
---
version: 1
account:
  nickname: "[用户输入]"
  handle: ""
  bio: ""
  pinned_post: ""

targeting:
  audience: [用户选择的目标用户]
  niche: ""
  anti_audience: []

identity:
  background: "[用户输入的背景故事]"
  product: ""
  milestone: ""
  signature: ""

comment_diversion:
  preferred_types: ["A", "C"]
  target_niches: ["AI创业", "打工人焦虑", "副业"]
  daily_limit: [用户输入的数字]
  avoid_keywords: ["免费", "加微信", "私信我"]

content:
  tone: ""
  topics: []
  avoid_topics: []
---
```

## 后续修改配置

用户可直接编辑 EXTEND.md 或重新触发 setup：
- 删除 EXTEND.md → 下次启动重新引导
- 直接编辑 YAML → 即时生效
- 完整 schema 参考：`config/preferences-schema.md`
