# 即时消息 / 日历 / 任务

## 即时消息 (im)

> Scope: `im:message:send` `im:message:readonly`

```bash
# 发消息给用户（bot 身份）
lark-cli im +messages-send --user-id <open_id> --text "消息内容"

# 发消息到群组（bot 身份）
lark-cli im +messages-send --chat-id <chat_id> --text "消息内容"

# 回复消息
lark-cli im +messages-reply --message-id <message_id> --text "回复内容"

# 搜索聊天记录（user 身份）
lark-cli im +messages-search --query "关键词" --page-all

# 列出群组消息
lark-cli im +chat-messages-list --chat-id <chat_id>

# 搜索群组（按名称）
lark-cli im +chat-search --query "群名"
```

---

## 日历 (calendar)

> Scope: `calendar:calendar:readonly` `calendar:calendar:write`

```bash
# 查看今日日程
lark-cli calendar +agenda

# 查看指定日期
lark-cli calendar +agenda --date 2026-04-02

# 创建日程
lark-cli calendar +create \
  --title "会议标题" \
  --start "2026-04-02T14:00:00+08:00" \
  --end "2026-04-02T15:00:00+08:00"

# 查忙闲状态
lark-cli calendar +freebusy \
  --user-id <open_id> \
  --start "2026-04-02" \
  --end "2026-04-03"
```

---

## 任务 (task)

> Scope: `task:task:write` `task:task:readonly`

```bash
# 查看我的任务
lark-cli task +get-my-tasks

# 创建任务
lark-cli task tasks create \
  --data '{"summary": "任务标题", "due": {"timestamp": "1775000000000"}}'

# 完成任务
lark-cli task tasks complete --params '{"task_guid": "xxx"}'
```
