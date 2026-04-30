# 邮件 / 知识库 / 通讯录 / 事件订阅

## 邮件 (mail)

> Scope: `mail:user_mailbox:write`

```bash
# 发送邮件
lark-cli mail +send --to "xxx@company.com" --subject "主题" --body "内容"

# 查看收件箱
lark-cli mail user_mailboxes.messages list --params '{"user_mailbox_id": "me"}'
```

---

## 知识库 (wiki)

> Scope: `wiki:wiki:readonly`

```bash
# 列出知识空间
lark-cli wiki spaces list

# 查 wiki 节点（获取真实 obj_token）
lark-cli wiki spaces get_node --params '{"token":"wiki_token"}'

# 列出节点下子节点
lark-cli wiki spaces.nodes list \
  --params '{"space_id": "xxx", "parent_node_token": "xxx"}'
```

⚠️ **Wiki 链接不能直接用**：`/wiki/TOKEN` 格式须先 `get_node` 获取真实 `obj_token`，再传给 `docs +fetch`。

---

## 通讯录 (contact)

> Scope: `contact:user.base:readonly`

```bash
# 搜索员工
lark-cli contact +search --query "张润胜"

# 获取当前用户信息
lark-cli contact users get --params '{"user_id": "me"}'
```

---

## 事件订阅

```bash
# 监听飞书消息事件（WebSocket 长连接）
lark-cli event listen \
  --event-type im.message.receive_v1 \
  --format compact
```
