---
---
name: sengclaw-wechat
description: >-
  微信登录和微信支付完整集成指南。包含 PC 端扫码登录（WxLogin + 开放平台）、移动端 H5 登录（公众号 OAuth）、Native 扫码支付（PC）、JSAPI
  支付（微信内 H5）的架构设计、配置步骤和踩坑经验。当用户需要做微信登录、微信支付、微信 OAuth、WxLogin、JSAPI、Native Pay、公众号授权、unionid、openid、wechat
  login、wechat pay 等相关功能时触发本技能。
disable-model-invocation: true
user-invocable: true
---

# 微信登录 + 微信支付集成指南

> 基于真实项目打通经验沉淀，框架无关的设计原则在此文件，具体实现见 references/。

## 架构总览

```
PC 端登录
  WxLogin JS SDK（开放平台）
  → iframe 内 OmniAuth/OAuth2 回调
  → Handoff Token（解决 iframe SameSite Cookie 问题）
  → 主窗口设置 session cookie

移动端登录（微信内浏览器）
  检测 User-Agent（MicroMessenger）
  → 公众号 MP OAuth（snsapi_userinfo）
  → 获取 unionid + openid
  → 直接设置 session cookie（无 SameSite 问题）

PC 支付（Native）
  下单 → 获取 code_url → 生成二维码 → 展示给用户扫码
  → 异步 Notify 回调更新订单状态 → 实时推送给前端

移动端支付（JSAPI）
  获取用户 openid（公众号维度）→ JSAPI 下单 → 获取 prepay_id
  → 签名生成前端参数 → WeixinJSBridge.invoke 唤起支付
  → 异步 Notify 回调更新状态
```

## AppID 体系（最关键的概念）

微信生态有**两套** AppID，必须搞清楚：

| 类型 | 用途 | 获取 openid |
|------|------|------------|
| **开放平台 AppID** | PC WxLogin 扫码登录 | 开放平台维度的 openid |
| **公众号 AppID** | H5 登录 + JSAPI 支付 | 公众号维度的 openid |

> **⚠️ 关键约束**：JSAPI 支付的 openid 必须是通过**公众号 AppID** 获取的，用开放平台 openid 会报错。

两套 AppID 共享同一个 **unionid**（需绑定到同一开放平台账号），是跨渠道识别同一用户的唯一凭据。

## 必须配置的环境变量

```
# 微信开放平台（PC 扫码）
WECHAT_OPEN_APPID
WECHAT_OPEN_APPSECRET
WECHAT_OPEN_REDIRECT_URI    # 开放平台后台填写的回调域名下的完整 URL

# 微信公众号（H5 登录 + JSAPI 支付）
WECHAT_MP_APPID
WECHAT_MP_APPSECRET

# 微信支付
WECHAT_PAY_MCH_ID
WECHAT_PAY_API_V3_KEY       # 32位，商户平台自设
WECHAT_PAY_CERT_PATH        # 证书目录：apiclient_key.pem / apiclient_cert.pem / pub_key.pem
WECHAT_PAY_NOTIFY_URL       # 异步回调 URL，必须公网可访问

# 域名（框架 URL helper 依赖）
PUBLIC_HOST                 # 仅主机名，不带 https:// 和路径
```

## 微信后台必须手动配置

| 后台 | 配置项 | 值 |
|------|--------|-----|
| 开放平台 | 授权回调域 | `yourdomain.com`（不带 https://） |
| 公众号后台 | 网页授权域名 | `yourdomain.com`（需放域名验证文件） |
| 商户平台 | API v3 密钥 | 32位随机字符串 |
| 商户平台 | 下载证书 | apiclient_key.pem / apiclient_cert.pem |
| 商户平台 | 下载平台证书 | pub_key.pem（用于验证 notify 签名） |

## 完整踩坑清单

| # | 场景 | 现象 | 根因 | 解法 |
|---|------|------|------|------|
| 1 | 所有微信回调 | 报 10003 域名不一致 | `PUBLIC_HOST` 未设，URL helper 生成 localhost | 设 `PUBLIC_HOST=yourdomain.com`，重启服务 |
| 2 | 公众号 OAuth | 回调报错 | 用了开放平台 AppID | 去公众号后台「基本配置」核实 AppID |
| 3 | 网页授权 | 授权页打不开 | 公众号「网页授权域名」未配置 | 手动填写 + 放验证文件到 public/ |
| 4 | PC 扫码登录 | 扫码后无响应 | WxLogin iframe + Chrome SameSite 阻止 set cookie | Handoff Token 模式（cache 存 session_id，JS 跳主窗口） |
| 5 | PC 扫码登录 | SPA/Turbo 导航后二维码不渲染 | WxLogin SDK 脚本在 Turbo Drive 下不重新执行 | 监听框架路由事件，动态插入 script 标签 |
| 6 | JSAPI 支付 | 下单报参数错误 | openid 用的是开放平台维度的 | 必须先走公众号 snsapi_base 拿 mp_openid |
| 7 | JSAPI 支付 | 报「请求重入时，参数与首次请求时不一致」 | 旧 pending 订单 + 新 openid，同一 out_trade_no 参数变了 | 捕获此错误，expired 旧单，新建 out_trade_no 重试 |
| 8 | JSAPI/Native 支付 | 报「该订单已支付」 | 订单在微信侧已支付，本地仍 pending | 同上，标 paid 后重建 |
| 9 | APIv3 签名 | 签名验证失败 | 签名字符串格式错误，每段后必须有 `\n` | 严格按文档：`method\npath\ntimestamp\nnonce\nbody\n` |
| 10 | Notify 回调 | 验签失败 | pub_key.pem 用错了（用了 apiclient_cert.pem） | 在商户平台单独下载「微信支付平台证书」 |
| 11 | 测试价格 | 每次测试都扣真钱 | 无本地覆盖 | 开发环境 plan_config 里强制 `amount: 1`（1分钱） |

## 如何使用本技能

根据你的框架，读取对应的 references 文件：

- **通用登录流程设计** → 读 `references/wechat-login.md`
- **通用支付流程设计** → 读 `references/wechat-pay.md`
- **Rails 7 完整实现代码** → 读 `references/rails-implementation.md`

如果是其他框架（Django、Express、Next.js 等），参考 references/wechat-login.md 和 wechat-pay.md 的原理部分，自行适配接口调用。