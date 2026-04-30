# 微信登录：原理与流程（框架无关）

## 两种登录场景

### 场景 A：PC 端扫码登录（WxLogin）

适用：桌面浏览器，用户用手机扫网页上的二维码完成登录。

**依赖：** 微信开放平台账号 + WxLogin JS SDK

**完整流程：**

```
1. 前端加载 WxLogin JS SDK
   └─ new WxLogin({ appid, redirect_uri, scope: "snsapi_login", self_redirect: true })
   └─ 微信渲染二维码到指定 div（通过 iframe 嵌入）

2. 用户手机扫码 → 确认登录

3. 微信回调 redirect_uri（在 iframe 内）
   └─ 携带 code 参数：redirect_uri?code=xxx&state=xxx

4. 服务端用 code 换 access_token（GET 请求）
   GET https://api.weixin.qq.com/sns/oauth2/access_token
     ?appid=&secret=&code=&grant_type=authorization_code
   └─ 返回：access_token, openid, unionid（需已绑定开放平台）

5. 用 access_token + openid 拉取用户信息
   GET https://api.weixin.qq.com/sns/userinfo
     ?access_token=&openid=&lang=zh_CN
   └─ 返回：nickname, headimgurl, unionid

6. 用 unionid 查找/创建本地账号

7. 设置 session/cookie → 登录完成
```

**⚠️ iframe SameSite Cookie 问题（必看）**

`self_redirect: true` 让微信在 iframe 内完成回调。现代浏览器（Chrome 80+）的 SameSite=Lax 策略禁止在跨域 iframe 内设置 cookie。

**解决方案：Handoff Token 模式**

```
iframe 回调 → 不设置 cookie
  → 生成随机 token，存入服务端缓存（TTL: 60秒）
  → 返回 HTML + JS：window.top.location.href = "/auth/handoff?token=xxx"

主窗口跳转 /auth/handoff
  → 从缓存读 session_id
  → 在主窗口上下文设置 cookie ✅
  → 跳转首页
```

**微信 token 接口的坑：** 微信 access_token 接口只接受 GET，不接受 POST。标准 OAuth2 库默认用 POST，需要覆写此步骤直接发 GET 请求。

---

### 场景 B：移动端 H5 登录（公众号 OAuth）

适用：用户在微信内置浏览器打开网页，静默或半静默授权。

**依赖：** 微信公众号账号（需认证），已配置网页授权域名

**Scope 选择：**
- `snsapi_base`：静默授权，用户无感知，只能获取 openid（无 unionid）
- `snsapi_userinfo`：弹出授权页，用户点「允许」，可获取 unionid + 用户信息

登录场景用 `snsapi_userinfo`，支付获取 openid 用 `snsapi_base`。

**完整流程：**

```
1. 检测微信内浏览器（User-Agent 含 MicroMessenger）

2. 构造 OAuth 授权 URL，重定向
   https://open.weixin.qq.com/connect/oauth2/authorize
     ?appid=公众号APPID
     &redirect_uri=回调URL（URL编码）
     &response_type=code
     &scope=snsapi_userinfo
     &state=自定义状态
     #wechat_redirect            ← 末尾必须加这个

3. 用户在微信内点击「允许」（snsapi_base 无需点击）

4. 微信回调 redirect_uri?code=xxx&state=xxx

5. 服务端用 code 换 token（注意：用公众号 appid/secret，不是开放平台的）
   GET https://api.weixin.qq.com/sns/oauth2/access_token
     ?appid=公众号APPID&secret=公众号SECRET&code=xxx&grant_type=authorization_code
   └─ 返回：access_token, openid, unionid（snsapi_userinfo 才有 unionid）

6. snsapi_userinfo 还需再拉取用户详情
   GET https://api.weixin.qq.com/sns/userinfo
     ?access_token=&openid=&lang=zh_CN

7. 用 unionid 查找/创建账号，直接设置 cookie（微信内浏览器无 SameSite 限制）
```

**State 参数建议格式：** `"purpose|base64(return_to)"`，便于回调时还原跳转目标和用途。

**域名验证文件：** 配置网页授权域名时，微信要求在该域名根路径放一个验证文件 `MP_verify_xxx.txt`，文件内容是微信给的字符串。

---

## 用户身份统一策略

同一个微信用户可能通过两个渠道登录：PC 扫码（开放平台 openid）和手机 H5（公众号 openid）。通过 **unionid** 统一识别：

```
查找顺序：
1. 按 wechat_unionid 查找（最可靠，跨平台唯一）
2. 按 wechat_mp_openid 查找（兼容旧数据）
3. 找不到 → 创建新用户

更新策略：
- 每次登录都更新 unionid（确保最新）
- H5 登录时顺便存 mp_openid（后续 JSAPI 支付用）
```

**需要存储的字段：**
- `wechat_unionid` — 开放平台跨应用唯一 ID（加唯一索引）
- `wechat_mp_openid` — 公众号维度 openid（JSAPI 支付必须）

---

## 前端注意事项

### WxLogin + SPA / Turbo Drive

WxLogin SDK 通过动态插入 iframe 渲染二维码。在 SPA 或 Turbo Drive 应用中，页面导航不会重新执行 script，需要：

1. 监听框架的路由事件（如 `turbo:load`、`vue-router` afterEach、Next.js `routeChangeComplete`）
2. 动态创建 `<script>` 标签加载 SDK，而非在 HTML 中静态引入
3. 切换页面时先清理旧 WxLogin 实例，避免重复渲染

```javascript
// 通用模式（适配任意框架）
function initWxLogin() {
  const script = document.createElement('script')
  script.src = 'https://res.wx.qq.com/connect/zh_CN/htmledition/js/wxLogin.js'
  script.onload = () => {
    new WxLogin({
      self_redirect: true,
      id: 'wx_login_container',
      appid: WECHAT_OPEN_APPID,
      scope: 'snsapi_login',
      redirect_uri: encodeURIComponent(REDIRECT_URI),
      state: randomHex(8),
      style: 'black'
    })
  }
  document.head.appendChild(script)
}
```
