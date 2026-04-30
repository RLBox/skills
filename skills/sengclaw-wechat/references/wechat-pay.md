# 微信支付：原理与流程（框架无关）

> 本文基于微信支付 **APIv3**，使用 RSA-SHA256 签名（非 MD5）。

## 两种支付场景

| 场景 | 适用端 | 关键参数 |
|------|--------|---------|
| **Native** | PC 浏览器 | 返回 `code_url`，生成二维码供用户扫码 |
| **JSAPI** | 微信内 H5 | 需要用户 `openid`，返回 `prepay_id`，前端调 `WeixinJSBridge` |

---

## Native 支付流程（PC 扫码）

```
1. 服务端调 POST https://api.mch.weixin.qq.com/v3/pay/transactions/native
   请求体：{ appid, mchid, description, out_trade_no, notify_url, amount: { total, currency } }
   返回：{ code_url }

2. 服务端生成二维码（用 code_url）→ 展示给用户

3. 用户用微信扫码 → 确认付款

4. 微信异步 POST 到 notify_url（可能延迟几秒到几分钟）
   → 服务端解密验证 → 更新订单状态

5. 前端通过 WebSocket / 轮询检测订单状态变化 → 展示成功页
```

---

## JSAPI 支付流程（微信内 H5）

```
前提：必须先获取用户在该公众号下的 openid

1. 若无 openid → 走公众号 snsapi_base 授权拿 openid（静默，用户无感知）

2. 服务端调 POST https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi
   请求体：{ appid, mchid, description, out_trade_no, notify_url,
            amount: { total, currency }, payer: { openid } }
   返回：{ prepay_id }

3. 服务端用私钥签名，生成前端所需的 JSAPI 参数
   签名字符串（严格格式，每行末尾必须有 \n）：
     appid\n
     timestamp\n
     nonceStr\n
     prepay_id=xxx\n

4. 前端调用 WeixinJSBridge.invoke('getBrandWCPayRequest', jsapiParams, callback)
   jsapiParams = { appId, timeStamp, nonceStr, package, signType: 'RSA', paySign }

5. 用户在微信收银台确认支付

6. callback 中 err_msg === 'get_brand_wcpay_request:ok' 表示用户已确认
   （不代表到账，到账靠 notify 回调）

7. 异步 Notify 到达 → 更新订单状态
```

---

## APIv3 签名机制

所有请求都需在 Authorization header 携带签名：

```
WECHATPAY2-SHA256-RSA2048
  mchid="商户号",
  nonce_str="随机字符串",
  signature="RSA签名(Base64)",
  timestamp="Unix时间戳",
  serial_no="商户证书序列号"
```

**请求签名字符串格式（严格，每段末尾必须有 `\n`）：**
```
HTTP方法\n
请求路径（含query）\n
时间戳\n
随机字符串\n
请求体（GET时为空字符串）\n
```

**证书文件说明：**
- `apiclient_key.pem` — 商户私钥，用于签名请求和 JSAPI 参数
- `apiclient_cert.pem` — 商户证书，用于提取 serial_no
- `pub_key.pem` — 微信支付平台公钥，用于验证 Notify 签名（在商户平台单独下载！）

---

## Notify 回调处理

微信异步回调，必须验签后再处理：

```
1. 验证签名（Headers: Wechatpay-Timestamp / Wechatpay-Nonce / Wechatpay-Signature）
   验签字符串：timestamp\nnonce\nbody\n
   用 pub_key.pem 的公钥验证

2. 解密 resource（AES-256-GCM）
   ciphertext = Base64解码后，最后16字节是 auth_tag，前面是密文
   key = api_v3_key（32字节）
   iv  = resource.nonce
   aad = resource.associated_data

3. 解密后得到 JSON，含 out_trade_no / trade_state / transaction_id 等

4. 响应 200 + { code: "SUCCESS", message: "成功" }，否则微信会重试

5. 必须跳过框架的 CSRF token 验证（微信不会发 token）
```

---

## 订单幂等与重试策略

**out_trade_no 唯一性：** 同一商户下 out_trade_no 不可重复，微信会缓存。

**旧订单冲突场景（必须处理）：**

| 错误信息 | 原因 | 处理方式 |
|---------|------|---------|
| `该订单已支付 / ORDERPAID` | 微信侧已收款，本地订单仍 pending | 标为已支付，新建订单重试 |
| `请求重入时，参数与首次请求时不一致` | 同一 out_trade_no 但参数变化（如 openid 变了） | 标为 expired，新建订单重试 |

**通用处理逻辑：**
```
捕获微信 API 错误
  → 若是订单冲突类错误
    → 将旧订单状态改为 expired/paid
    → 生成新 out_trade_no（随机32字符）
    → 用新参数重新下单
  → 其他错误 → 展示友好提示
```

**本地开发测试：** 配置开发环境下强制使用最小金额（如 1 分钱），避免真实扣款。

---

## 支付状态实时推送（前端）

Native 支付用户扫码后，服务端通过 Notify 知道结果，但前端不知道。常见方案：

1. **WebSocket / ActionCable（推荐）**：Notify 到达后广播到频道，前端订阅
2. **轮询**：前端每 2-3 秒请求订单状态接口
3. **用户手动刷新**：最简单，体验差

频道命名建议：`wechat_pay_{out_trade_no}`，Notify 收到后广播 `{ type: "payment-success" }`。
