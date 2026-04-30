---
---
name: sengclaw-linear
description: >-
  Linear OAuth App 集成指南。当需要开发 Linear OAuth 集成、调试授权流程、解决 Token 问题或处理撤销 (revoke) 重新授权时使用。触发词：Linear OAuth、Linear App、Linear Token、Organization ID、Linear 授权、Revoke Access、Linear Actor。
disable-model-invocation: true
user-invocable: true
---

# Linear OAuth Integration

## 核心调试思路

**OAuth 调试的关键**：AI 用浏览器工具独立驾驶整个授权流程，不需要用户手动点击任何东西。

调试循环：
```
修改代码 → 打开授权 URL → 点 Authorize → 读 callback 结果
→ 失败？读日志 → 修改代码 → Revoke → 重复，直到成功
```

完整操作步骤 → 读 `references/browser-debug-playbook.md`

---

## 开始集成

### 1. 准备工作

- Linear 后台创建 OAuth App（Settings → API → Applications）
- Actor mode 选 **Application**（不是 User）
- 设置 Redirect URI、申请 scopes：`read,write,app:assignable,app:mentionable`

### 2. 配置环境变量

```yaml
# config/application.yml
LINEAR_CLIENT_ID:     "your_client_id"
LINEAR_CLIENT_SECRET: "your_client_secret"
```

### 3. 生成 Rails 实现

参考 `references/rails-implementation.md` 创建：
- `app/controllers/oauth/linear_controller.rb`
- `app/models/linear_installation.rb`
- Migration 和路由

### 4. 调试授权流程

按照 `references/browser-debug-playbook.md` 用浏览器工具自主走完整个流程。

---

## 遇到问题时

| 现象 | 原因 | 参考 |
|---|---|---|
| `workspace_id` 为空，DB 插入失败 | app actor token 不含 organizationId | `references/linear-api-gotchas.md` |
| "already installed" 无法重新授权 | Linear 端有记录需要先 revoke | `references/browser-debug-playbook.md` → Revoke 流程 |
| Authorization header 报 401 | Linear 不用加 "Bearer " | `references/linear-api-gotchas.md` |
| 需要调 GraphQL | 查询速查表 | `references/linear-api-gotchas.md` |

---

## References

| 文件 | 内容 |
|---|---|
| `references/browser-debug-playbook.md` | 浏览器工具调试完整手册（7步操作 + Revoke 流程） |
| `references/linear-api-gotchas.md` | Linear API 技术细节、陷阱和 GraphQL 速查 |
| `references/rails-implementation.md` | Rails Controller / Model / Migration 完整代码 |