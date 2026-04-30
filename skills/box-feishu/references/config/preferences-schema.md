---
name: preferences-schema
description: EXTEND.md YAML schema for feishu-miaoji-notes user preferences
---

# Preferences Schema

## Full Schema

```yaml
---
version: 1

# FSAuth 认证（必需）
fsauth_app_id: null        # FSAuth 应用 ID，null = 使用技能内置默认值
fsauth_base_url: null      # FSAuth 服务地址，null = https://fsauth.com

# 飞书域名（可选）
feishu_domain: null        # 飞书域名，null = https://open.feishu.cn

# 妙记主页 URL（可选，用于浏览器爬取妙记列表）
# 飞书没有"列出全部妙记"的开放 API，只能通过妙记主页网页获取完整列表
# 格式：https://<your-domain>.feishu.cn/minutes/home
feishu_minutes_home: null

# sync 命令默认值（可选）
default_folder_token: null # 默认同步文件夹 token
default_output_dir: null   # 默认本地输出目录，null = ./notes
---
```

## Field Reference

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `version` | int | 1 | Schema 版本 |
| `fsauth_app_id` | string\|null | null | FSAuth 应用 ID（null = 使用内置默认值） |
| `fsauth_base_url` | string\|null | null | FSAuth 服务地址（null = https://fsauth.com） |
| `feishu_domain` | string\|null | null | 飞书域名（null = https://open.feishu.cn） |
| `feishu_minutes_home` | string\|null | null | 妙记主页 URL，用于浏览器爬取妙记列表（飞书无官方 list API） |
| `default_folder_token` | string\|null | null | sync 命令的默认文件夹 token |
| `default_output_dir` | string\|null | null | sync 命令的默认输出目录（null = ./notes） |

## Examples

**Minimal（仅指定同步目录）**:
```yaml
---
version: 1
default_output_dir: ~/notes/feishu
---
```

**Full（完整配置）**:
```yaml
---
version: 1
fsauth_app_id: your-fsauth-app-id
fsauth_base_url: https://fsauth.com
feishu_domain: https://open.feishu.cn
feishu_minutes_home: https://yourcompany.feishu.cn/minutes/home
default_folder_token: foldxxxxxxxxxxxxxx
default_output_dir: ~/notes/feishu
---
```
