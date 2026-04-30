# 浏览器自主调试 OAuth 完整操作手册

## 完整调试循环

```
修改代码
  → 生成 install_token
  → browser navigate 打开授权 URL
  → Linear 页面：读取状态 → 点 Authorize
  → 读 callback 结果
  → 成功？结束 / 失败？读日志 → 修改代码 → Revoke → 重复
```

每一步都用工具完成，**不需要用户手动操作任何东西**。

---

## Step 1：生成 install_token

```bash
python3 -c "import uuid; print(str(uuid.uuid4()))"
```

---

## Step 2：打开授权 URL

```
browser navigate → http://localhost:PORT/oauth/linear/authorize?install_token=UUID
browser act kind=wait ms=2000
browser evaluate → document.body.innerText.substring(0, 400)
```

**判断页面状态：**

| 页面显示 | 含义 | 下一步 |
|---|---|---|
| "is requesting access" | ✅ 正常授权页面 | → Step 3 点击 Authorize |
| "already installed" | Linear 端有授权，DB 无记录 | → 先执行 Revoke 流程 |
| "Loading…" | 还没渲染完 | 再 wait 2000ms |

---

## Step 3：点击 Authorize

```
browser snapshot interactive=true compact=true
→ 找到 button "Authorize" [ref=X_XX]

browser act kind=click ref=X_XX
browser act kind=wait ms=5000
```

---

## Step 4：读取 callback 结果

```
browser evaluate → document.URL + "\n\n" + document.body.innerText.substring(0, 300)
```

| 结果 | 含义 |
|---|---|
| "✅ Connected to Linear!" | **成功，结束** |
| "Workspace can't be blank" | organizationId 未获取 → 看 linear-api-gotchas.md |
| 其他错误 | → Step 5 读日志 |

---

## Step 5：读 Rails 日志定位错误

```bash
tail -100 log/development.log | grep -A5 "Linear token\|Error\|organization_id\|Validation"
```

关键日志行含义：

```
Linear token response keys: ["access_token", ...]     ← 无 organizationId = 踩坑
Linear organization_id fetched: "719aa..."            ← 修复后有此行
LinearInstallation Create (2.3ms) INSERT INTO ...     ← 成功
Validation Error: Workspace can't be blank            ← workspace_id 为空
```

---

## Revoke 流程（需要重试时）

> code 是一次性的，callback 已处理过就失效，必须 Revoke 后才能拿新 code。

```
browser navigate → https://linear.app/WORKSPACE_SLUG/settings/applications
browser act kind=wait ms=2000
browser snapshot interactive=true compact=true
```

页面上有多个 "Open menu" 按钮，**第一个**对应列表里第一个 App：

```
browser act kind=click ref=X_XX   ← 点目标 App 的 Open menu
browser act kind=wait ms=800
```

菜单里的选项可能捕捉不到 ref（动态渲染），改用坐标：

```
browser evaluate →
  Array.from(document.querySelectorAll('[role="option"]')).map(function(el) {
    return {text: el.textContent.trim(), rect: el.getBoundingClientRect()}
  })
```

找到 "Revoke access" 的坐标，计算中心点后点击：

```
browser act kind=click_at x=中心X y=中心Y
browser act kind=wait ms=500
```

确认弹框出现，找 Revoke 确认按钮：

```
browser snapshot interactive=true compact=true
→ button "Revoke" [ref=X_X]
browser act kind=click ref=X_X
browser act kind=wait ms=2000
browser evaluate → document.body.innerText.substring(300, 600)
```

看到 "tokens revoked" 即成功，然后从 Step 1 重新开始。

---

## 关键技巧

- `innerText.substring(0, 400)` — 截断避免输出过长
- `getBoundingClientRect()` + `click_at` — 处理动态菜单，snapshot 捕捉不到时的备选
- code 是一次性的 — callback 处理过（哪怕失败）就作废，必须 Revoke 重来
- 授权成功的标志 — URL 回到 callback 地址，页面有 "✅ Connected" 文字
