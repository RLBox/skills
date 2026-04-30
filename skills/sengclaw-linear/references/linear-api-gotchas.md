# Linear API 技术细节与陷阱

## 最大陷阱：app actor token 不含 organizationId

### 问题现象

OAuth 授权成功、code 交换成功，但 `workspace_id` 为空，数据库插入报错。

### 根本原因

Linear app actor 模式的 token 响应只有：

```json
["access_token", "token_type", "expires_in", "refresh_token", "scope"]
```

**没有** `organizationId`（user actor 模式才有）。

### 修复方法

token 交换完成后，立刻用拿到的 token 查 GraphQL：

```ruby
def fetch_organization_id(access_token)
  response = Faraday.post("https://api.linear.app/graphql") do |req|
    req.headers["Content-Type"] = "application/json"
    req.headers["Authorization"] = access_token  # 注意：不加 "Bearer "
    req.body = { query: "{ organization { id } }" }.to_json
  end
  JSON.parse(response.body).dig("data", "organization", "id")
end
```

> **Authorization header 格式**：Linear 用 `token_value` 直接传，不需要 `Bearer token_value`。

---

## App 配置要点

### 授权 URL 必须加 actor=app

```
https://linear.app/oauth/authorize
  ?actor=app          ← 少了这个会走 user actor 模式，拿到的 token 权限不同
  &client_id=...
  &redirect_uri=...
  &response_type=code
  &scope=read,write,app:assignable,app:mentionable
  &state=INSTALL_TOKEN
```

### Scopes 最小集

```
read              # 读取 workspace 数据
write             # 写入 issues/comments
app:assignable    # 可被分配 issue
app:mentionable   # 可被 @ 提及
```

不需要 `offline_access`，app actor token 默认有 refresh_token。

---

## Token 交换

```
POST https://api.linear.app/oauth/token
Content-Type: application/x-www-form-urlencoded

code=CODE
&client_id=CLIENT_ID
&client_secret=CLIENT_SECRET
&redirect_uri=CALLBACK_URL
&grant_type=authorization_code
```

---

## App Actor ID 查询

除了 organization_id，还需要拿 app 自身的 actor ID（用于 webhook 过滤自己发的事件）：

```ruby
def fetch_actor_id(access_token)
  response = Faraday.post("https://api.linear.app/graphql") do |req|
    req.headers["Content-Type"] = "application/json"
    req.headers["Authorization"] = access_token
    req.body = { query: "{ viewer { id } }" }.to_json
  end
  JSON.parse(response.body).dig("data", "viewer", "id")
end
```

---

## 常用 GraphQL 查询速查

```graphql
# 获取 workspace 信息
{ organization { id name urlKey } }

# 获取当前 app actor
{ viewer { id name } }

# 获取所有 team
{ teams { nodes { id name key } } }

# 创建 issue
mutation {
  issueCreate(input: {
    title: "标题"
    teamId: "TEAM_ID"
    description: "描述"
  }) {
    issue { id title url }
  }
}
```

curl 示例：

```bash
curl -s -X POST https://api.linear.app/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: YOUR_TOKEN" \
  -d '{"query":"{ organization { id name } }"}'
```
