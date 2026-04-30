# 认证与权限指南

## 身份类型

| 身份 | 标识 | 场景 |
|------|------|------|
| user 用户身份 | `--as user`（默认） | 访问用户自己的资源（日历、云空间、妙记等） |
| bot 应用身份 | `--as bot` | 应用级操作，发消息等 |

⚠️ **Bot 看不到用户资源**：云空间、日历、妙记等个人资源必须用 user 身份。

---

## 重新授权（scope 不足时）

**关键原则**：必须用 `--scope` 显式指定，`--domain` 不会自动包含新 scope！

```bash
# 步骤1：发起 device flow（立即返回链接和 device_code）
lark-cli auth login \
  --scope "drive:drive:readonly drive:drive.metadata:readonly drive:file:download drive:file:upload" \
  --no-wait

# 步骤2：浏览器打开 verification_url，点「授权」

# 步骤3：立刻完成握手（有效期 10 分钟）
lark-cli auth login --device-code <device_code>
```

---

## 常用 Scope 速查

| 服务 | Scope |
|------|-------|
| 云文档读写 | `docx:document:readonly docx:document:write` |
| 云空间 | `drive:drive:readonly drive:drive.metadata:readonly drive:file:download drive:file:upload` |
| 妙记元信息 | `minutes:minutes:readonly` |
| 妙记 AI 产物 | `minutes:minutes.artifacts:read` |
| 妙记转写导出 | `minutes:minutes.transcript:export` |
| 视频会议/纪要 | `vc:meeting:readonly` |
| 表格 | `sheets:spreadsheet:readonly sheets:spreadsheet:write` |
| 多维表格 | `bitable:app:readonly bitable:app:write` |
| 即时消息发送 | `im:message:send` |
| 日历 | `calendar:calendar:readonly calendar:calendar:write` |
| 任务 | `task:task:write task:task:readonly` |
| 邮件 | `mail:user_mailbox:write` |
| 知识库 | `wiki:wiki:readonly` |
| 通讯录 | `contact:user.base:readonly` |

---

## 排查权限错误

### [99991679] Permission denied
1. `lark-cli auth status` — 查看已有 scope 列表
2. 缺 scope → 用 `--scope` 重新授权
3. 有 scope 但仍报错 → 去飞书开发者后台检查应用权限是否开通

### 错误 response 示例
报错包含：
- `permission_violations`：缺失的 scope（N 选 1）
- `console_url`：开发者后台配置链接
- `hint`：建议的修复命令

### Token 过期
- access token 过期但 refresh token 有效 → 自动续期
- refresh token 也过期（7天）→ 需要重新 `lark-cli auth login`

---

## 当前环境信息

- App ID: `cli_a947b653abf99bd7`（"飞书 CLI" 个人应用）
- 用户: 张润胜（ou_5055e62190a8b5a65ccbad4e52bb9daf）
- 配置文件: `~/.lark-cli/config.json`
- Token refresh 有效期: 7 天
