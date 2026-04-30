# Rails 7 实现代码

## 目录
1. [Gem 依赖](#1-gem-依赖)
2. [数据库迁移](#2-数据库迁移)
3. [OmniAuth 策略（PC 扫码）](#3-omniauth-策略)
4. [OmniAuth 初始化](#4-omniauth-初始化)
5. [PC 登录 Controllers](#5-pc-登录-controllers)
6. [移动端 H5 登录 Controller](#6-移动端-h5-登录)
7. [ApplicationController 公共方法](#7-applicationcontroller)
8. [WechatPayService（APIv3）](#8-wechatpayservice)
9. [支付 Controller](#9-支付-controller)
10. [JSAPI 前端 Stimulus Controller](#10-jsapi-前端)
11. [WxLogin 前端 View](#11-wxlogin-前端)
12. [路由配置](#12-路由配置)

---

## 1. Gem 依赖

```ruby
# Gemfile
gem "omniauth-oauth2"   # PC WxLogin OmniAuth 策略基类
gem "faraday"           # 微信 token 接口 GET 请求
gem "rqrcode"           # Native 支付二维码生成
```

---

## 2. 数据库迁移

```ruby
# db/migrate/xxx_add_wechat_fields_to_users.rb
class AddWechatFieldsToUsers < ActiveRecord::Migration[7.2]
  def change
    add_column :users, :wechat_unionid,   :string
    add_column :users, :wechat_mp_openid, :string
    add_index  :users, :wechat_unionid,   unique: true
    add_index  :users, :wechat_mp_openid, unique: true
  end
end
```

---

## 3. OmniAuth 策略

```ruby
# lib/omniauth/strategies/open_wechat.rb
require "omniauth-oauth2"

module OmniAuth
  module Strategies
    class OpenWechat < OmniAuth::Strategies::OAuth2
      option :name, "open_wechat"
      option :client_options, {
        site:          "https://api.weixin.qq.com",
        authorize_url: "https://open.weixin.qq.com/connect/qrconnect",
        token_url:     "/sns/oauth2/access_token"
      }

      uid { raw_info["unionid"] || raw_info["openid"] }

      info do
        { name:    raw_info["nickname"],
          image:   raw_info["headimgurl"],
          unionid: raw_info["unionid"],
          openid:  raw_info["openid"] }
      end

      def raw_info
        @raw_info ||= begin
          access_token.options[:mode] = :query
          res = access_token.get("/sns/userinfo", params: {
            access_token: access_token.token,
            openid: access_token["openid"], lang: "zh_CN"
          })
          JSON.parse(res.body)
        end
      end

      # 微信 token 接口只接受 GET，覆写默认 POST 行为
      def build_access_token
        conn = Faraday.new(url: "https://api.weixin.qq.com") do |f|
          f.adapter Faraday.default_adapter
        end
        resp = conn.get("/sns/oauth2/access_token") do |req|
          req.params["appid"]      = options.client_id
          req.params["secret"]     = options.client_secret
          req.params["code"]       = request.params["code"]
          req.params["grant_type"] = "authorization_code"
        end
        data = JSON.parse(resp.body)
        raise "WeChat token error: #{data['errmsg']}" if data["errcode"]
        ::OAuth2::AccessToken.new(client, data["access_token"],
          data.merge("token" => data["access_token"]))
      end

      def callback_url
        full_host + script_name + callback_path
      end
    end
  end
end
```

---

## 4. OmniAuth 初始化

```ruby
# config/initializers/omniauth.rb
Rails.application.config.middleware.use OmniAuth::Builder do
  provider :open_wechat,
    ENV.fetch("WECHAT_OPEN_APPID", ""),
    ENV.fetch("WECHAT_OPEN_APPSECRET", ""),
    scope: "snsapi_login"
end
OmniAuth.config.allowed_request_methods = [:get, :post]
```

---

## 5. PC 登录 Controllers

```ruby
# app/controllers/sessions/omniauth_controller.rb
class Sessions::OmniauthController < ApplicationController
  skip_before_action :verify_authenticity_token, raise: false

  def create
    @user = User.from_omniauth(request.env["omniauth.auth"])
    return redirect_to(sign_in_path, alert: "登录失败") unless @user.persisted?

    session_record = @user.sessions.create!

    # iframe 内无法 set cookie（Chrome SameSite），用 Handoff Token 绕过
    if params[:provider] == "open_wechat"
      token = SecureRandom.hex(32)
      Rails.cache.write("wechat_login_token:#{token}", session_record.id, expires_in: 60.seconds)
      url = auth_wechat_handoff_url(token: token)
      return render html: <<~HTML.html_safe, layout: false
        <!DOCTYPE html><html><body><script>
          try { window.top.location.href = #{url.to_json}; }
          catch(e) { window.location.href = #{url.to_json}; }
        </script></body></html>
      HTML
    end

    cookies.signed.permanent[:session_token] = { value: session_record.id, httponly: true }
    redirect_to root_path, notice: "登录成功"
  end
end
```

```ruby
# app/controllers/sessions/wechat_handoff_controller.rb
class Sessions::WechatHandoffController < ApplicationController
  skip_before_action :authenticate_user!, raise: false

  def show
    session_id = Rails.cache.read("wechat_login_token:#{params[:token]}")
    if session_id.present?
      Rails.cache.delete("wechat_login_token:#{params[:token]}")
      cookies.signed.permanent[:session_token] = { value: session_id, httponly: true }
      redirect_to root_path, notice: "微信登录成功"
    else
      redirect_to sign_in_path, alert: "登录已过期，请重新扫码"
    end
  end
end
```

---

## 6. 移动端 H5 登录

```ruby
# app/controllers/wechat/mp_oauth_controller.rb
class Wechat::MpOauthController < ApplicationController
  skip_before_action :authenticate_user!, raise: false

  MP_OAUTH_URL = "https://open.weixin.qq.com/connect/oauth2/authorize"
  TOKEN_URL    = "https://api.weixin.qq.com/sns/oauth2/access_token"

  def authorize
    purpose   = params[:purpose].presence || "pay"
    return_to = params[:return_to] || root_path
    scope     = purpose == "login" ? "snsapi_userinfo" : "snsapi_base"
    state     = "#{purpose}|#{Base64.urlsafe_encode64(return_to, padding: false)}"
    query = {
      appid: ENV.fetch("WECHAT_MP_APPID"), redirect_uri: wechat_mp_oauth_callback_url,
      response_type: "code", scope: scope, state: state
    }.map { |k, v| "#{k}=#{CGI.escape(v.to_s)}" }.join("&")
    redirect_to "#{MP_OAUTH_URL}?#{query}#wechat_redirect", allow_other_host: true
  end

  def callback
    code = params[:code]
    return redirect_to(root_path, alert: "微信授权失败") if code.blank?

    parts     = params[:state].to_s.split("|", 2)
    purpose   = parts[0].presence || "pay"
    return_to = parts[1].present? ? Base64.urlsafe_decode64(parts[1]) : root_path

    data = fetch_token_data(code)
    return redirect_to(root_path, alert: "获取用户信息失败") if data.nil?

    if purpose == "login"
      user = find_or_create_by_wechat(data["unionid"], data["openid"], data["nickname"])
      return redirect_to(root_path, alert: "登录失败") unless user&.persisted?
      user.update_column(:wechat_mp_openid, data["openid"]) if data["openid"].present? && user.wechat_mp_openid.blank?
      session_record = user.sessions.create!
      cookies.signed.permanent[:session_token] = { value: session_record.id, httponly: true }
      redirect_to return_to, notice: "微信登录成功"
    else
      session[:wechat_mp_openid] = data["openid"]
      redirect_to return_to
    end
  end

  private

  def find_or_create_by_wechat(unionid, openid, name)
    User.transaction do
      user  = User.find_by(wechat_unionid: unionid) if unionid.present?
      user ||= User.find_by(wechat_mp_openid: openid) if openid.present?
      if user
        user.update!(wechat_unionid: unionid, provider: "open_wechat", uid: unionid || openid)
        return user
      end
      User.create!(
        wechat_unionid: unionid, wechat_mp_openid: openid,
        name: name.presence || "微信用户",
        email: User.generate_email("wx_#{(unionid || openid).last(8)}"),
        provider: "open_wechat", uid: unionid || openid, verified: false
      ).tap(&:create_profile!)
    end
  rescue => e
    Rails.logger.error "[MpOauth] #{e.message}"; nil
  end

  def fetch_token_data(code)
    uri = URI(TOKEN_URL)
    uri.query = URI.encode_www_form(
      appid: ENV.fetch("WECHAT_MP_APPID"), secret: ENV.fetch("WECHAT_MP_APPSECRET"),
      code: code, grant_type: "authorization_code"
    )
    data = JSON.parse(Net::HTTP.get_response(uri).body)
    return nil if data["errcode"].present? && data["errcode"] != 0
    data
  rescue => e
    Rails.logger.error "[MpOauth] fetch_token: #{e.message}"; nil
  end
end
```

---

## 7. ApplicationController

```ruby
# app/controllers/application_controller.rb（相关部分）

def wechat_browser?
  request.user_agent.to_s.include?("MicroMessenger")
end
helper_method :wechat_browser?

def authenticate_user!
  if (session_record = find_session_record)
    Current.session = session_record
  elsif wechat_browser?
    redirect_to wechat_mp_oauth_authorize_path(
      purpose: "login", return_to: request.fullpath
    )
  else
    redirect_to sign_in_path, alert: "请先登录"
  end
end
```

---

## 8. WechatPayService

```ruby
# app/services/wechat_pay_service.rb
require "net/http"
require "openssl"
require "json"
require "base64"
require "securerandom"

class WechatPayService
  API_BASE   = "https://api.mch.weixin.qq.com"
  NATIVE_URL = "/v3/pay/transactions/native"
  JSAPI_URL  = "/v3/pay/transactions/jsapi"

  def initialize
    @appid      = ENV.fetch("WECHAT_MP_APPID", "")
    @mch_id     = ENV.fetch("WECHAT_PAY_MCH_ID", "")
    @api_v3_key = ENV.fetch("WECHAT_PAY_API_V3_KEY", "")
    @cert_path  = ENV.fetch("WECHAT_PAY_CERT_PATH", "")
    @notify_url = ENV.fetch("WECHAT_PAY_NOTIFY_URL", "")
  end

  def create_native_order(out_trade_no:, amount:, description:)
    body = { appid: @appid, mchid: @mch_id, description: description,
             out_trade_no: out_trade_no, notify_url: @notify_url,
             amount: { total: amount, currency: "CNY" } }
    response = post(NATIVE_URL, body)
    raise "WeChat Pay error: #{response['message']}" unless response["code_url"]
    { code_url: response["code_url"], out_trade_no: out_trade_no }
  end

  def create_jsapi_order(out_trade_no:, amount:, description:, openid:)
    body = { appid: @appid, mchid: @mch_id, description: description,
             out_trade_no: out_trade_no, notify_url: @notify_url,
             amount: { total: amount, currency: "CNY" },
             payer: { openid: openid } }
    response = post(JSAPI_URL, body)
    raise "WeChat Pay JSAPI error: #{response['message']}" unless response["prepay_id"]
    { prepay_id: response["prepay_id"], out_trade_no: out_trade_no }
  end

  def generate_jsapi_params(prepay_id)
    load_certs!
    timestamp = Time.now.to_i.to_s
    nonce_str = SecureRandom.hex(16)
    package   = "prepay_id=#{prepay_id}"
    message   = "#{@appid}\n#{timestamp}\n#{nonce_str}\n#{package}\n"
    pay_sign  = Base64.strict_encode64(
      @private_key.sign(OpenSSL::Digest::SHA256.new, message)
    )
    { appId: @appid, timeStamp: timestamp, nonceStr: nonce_str,
      package: package, signType: "RSA", paySign: pay_sign }
  end

  def decrypt_notify(headers:, body_str:)
    timestamp = headers["wechatpay-timestamp"]
    nonce     = headers["wechatpay-nonce"]
    signature = headers["wechatpay-signature"]
    raise "Missing WeChat Pay headers" unless timestamp && nonce && signature
    verify_signature!(timestamp: timestamp, nonce: nonce,
                      body: body_str, signature: signature)
    payload  = JSON.parse(body_str)
    resource = payload["resource"]
    decrypt_resource(ciphertext: resource["ciphertext"],
                     nonce: resource["nonce"],
                     associated_data: resource["associated_data"])
  end

  private

  def load_certs!
    return if @private_key
    @private_key = OpenSSL::PKey::RSA.new(
      File.read(File.join(@cert_path, "apiclient_key.pem"))
    )
    @public_key = OpenSSL::PKey::RSA.new(
      File.read(File.join(@cert_path, "pub_key.pem"))
    )
    cert    = OpenSSL::X509::Certificate.new(
      File.read(File.join(@cert_path, "apiclient_cert.pem"))
    )
    @serial = cert.serial.to_s(16).upcase
  end

  def decrypt_resource(ciphertext:, nonce:, associated_data:)
    decoded    = Base64.strict_decode64(ciphertext)
    tag        = decoded[-16..]
    ciphertext = decoded[0...-16]
    decipher   = OpenSSL::Cipher.new("aes-256-gcm")
    decipher.decrypt
    decipher.key        = @api_v3_key
    decipher.iv         = nonce
    decipher.auth_tag   = tag
    decipher.auth_data  = associated_data
    JSON.parse(decipher.update(ciphertext) + decipher.final)
  end

  def verify_signature!(timestamp:, nonce:, body:, signature:)
    load_certs!
    message = "#{timestamp}\n#{nonce}\n#{body}\n"
    valid   = @public_key.verify(
      OpenSSL::Digest::SHA256.new,
      Base64.strict_decode64(signature), message
    )
    raise "WeChat Pay signature verification failed" unless valid
  end

  def post(path, body)
    uri  = URI("#{API_BASE}#{path}")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    req  = Net::HTTP::Post.new(uri.path, build_headers("POST", path, body.to_json))
    req.body = body.to_json
    req.content_type = "application/json"
    JSON.parse(http.request(req).body)
  rescue JSON::ParserError => e
    { "error" => e.message }
  end

  def build_headers(method, path, body)
    load_certs!
    nonce_str = SecureRandom.hex(16)
    timestamp = Time.now.to_i.to_s
    message   = "#{method}\n#{path}\n#{timestamp}\n#{nonce_str}\n#{body}\n"
    signature = Base64.strict_encode64(
      @private_key.sign(OpenSSL::Digest::SHA256.new, message)
    )
    auth = %Q(WECHATPAY2-SHA256-RSA2048 mchid="#{@mch_id}",nonce_str="#{nonce_str}",signature="#{signature}",timestamp="#{timestamp}",serial_no="#{@serial}")
    { "Authorization" => auth, "Accept" => "application/json",
      "Content-Type"  => "application/json", "User-Agent" => "myapp/1.0" }
  end
end
```

---

## 9. 支付 Controller

```ruby
# app/controllers/wechat/pay/orders_controller.rb
module Wechat
  module Pay
    class OrdersController < ApplicationController
      before_action :authenticate_user!

      def new
        @plan_key    = params[:plan].presence
        plan_cfg     = plan_config(@plan_key)
        @amount_yuan = plan_cfg[:amount] / 100.0
        @description = plan_cfg[:description]

        # 微信内浏览器：先确保有 openid
        if wechat_browser? && mp_openid.blank?
          redirect_to wechat_mp_oauth_authorize_path(
            purpose: "pay", return_to: wechat_pay_order_new_path(plan: @plan_key)
          )
        end
      end

      def create
        @plan_key = params[:plan].presence
        plan_cfg  = plan_config(@plan_key)

        order = WechatOrder.pending.find_or_initialize_by(user: current_user, plan: @plan_key)
        order.out_trade_no ||= SecureRandom.hex(16)
        order.amount      = plan_cfg[:amount]   # 无条件覆盖，避免旧订单金额缓存
        order.description = plan_cfg[:description]
        order.save!

        service = WechatPayService.new
        wechat_browser? ? create_jsapi(order, service) : create_native(order, service)
      rescue => e
        stale_errors = [
          "该订单已支付", "ORDERPAID",
          "请求重入时，参数与首次请求时不一致", "PARAM_ERROR"
        ]
        if stale_errors.any? { |msg| e.message.include?(msg) }
          order&.update(status: "expired")
          retry_order = WechatOrder.create!(
            user: current_user, plan: @plan_key,
            out_trade_no: SecureRandom.hex(16),
            amount: plan_config(@plan_key)[:amount],
            description: plan_config(@plan_key)[:description]
          )
          service = WechatPayService.new
          return wechat_browser? ? create_jsapi(retry_order, service) : create_native(retry_order, service)
        end
        Rails.logger.error "[WechatPay] #{e.message}"
        render_modal_error("创建支付订单失败，请稍后重试")
      end

      private

      def create_native(order, service)
        result   = service.create_native_order(
          out_trade_no: order.out_trade_no,
          amount: order.amount, description: order.description
        )
        qr_svg   = RQRCode::QRCode.new(result[:code_url])
                     .as_svg(module_size: 4, standalone: true, use_path: true)
        modal_html = render_to_string(
          partial: "payment_modal",
          locals: { qr_svg: qr_svg, out_trade_no: order.out_trade_no,
                    amount_yuan: order.amount_yuan, description: order.description }
        )
        render_modal_html(modal_html)
      end

      def create_jsapi(order, service)
        openid = mp_openid
        raise "No MP openid" if openid.blank?
        result = service.create_jsapi_order(
          out_trade_no: order.out_trade_no,
          amount: order.amount, description: order.description, openid: openid
        )
        @jsapi_params = service.generate_jsapi_params(result[:prepay_id])
        @out_trade_no = order.out_trade_no
        @amount_yuan  = order.amount_yuan
        render :jsapi
      end

      def render_modal_html(inner_html)
        overlay_html = <<~HTML.html_safe
          <div id="payment-modal-overlay"
               class="flex fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
               data-controller="wechat-pay-modal"
               data-action="click->wechat-pay-modal#backdropClick">
            <div id="payment-modal-body" class="w-full h-full"
                 data-wechat-pay-modal-target="body">#{inner_html}</div>
          </div>
        HTML
        render turbo_stream: turbo_stream.replace("payment-modal-overlay", html: overlay_html)
      end

      def render_modal_error(message)
        render_modal_html(render_to_string(
          partial: "wechat/pay/orders/payment_error", locals: { message: message }
        ))
      end

      def plan_config(plan_key)
        cfg = PLANS[plan_key] || TEST_PLAN
        # 开发环境强制 1 分钱，避免真实扣款
        Rails.env.development? ? cfg.merge(amount: 1) : cfg
      end

      def mp_openid
        session[:wechat_mp_openid].presence || current_user&.wechat_mp_openid.presence
      end
    end
  end
end
```

---

## 10. JSAPI 前端

```typescript
// app/javascript/controllers/wechat_jsapi_pay_controller.ts
import { Controller } from "@hotwired/stimulus"

declare global {
  interface Window {
    WeixinJSBridge?: {
      invoke: (api: string, params: object,
               callback: (res: { err_msg: string }) => void) => void
    }
  }
}

export default class extends Controller {
  static targets = ["payBtn", "statusBox", "status", "error"]
  static values  = { params: String, successUrl: String }

  declare readonly payBtnTarget:    HTMLButtonElement
  declare readonly statusBoxTarget: HTMLElement
  declare readonly statusTarget:    HTMLElement
  declare readonly errorTarget:     HTMLElement
  declare paramsValue:    string
  declare successUrlValue: string

  connect() {
    if (typeof window.WeixinJSBridge === "undefined") {
      document.addEventListener("WeixinJSBridgeReady", () => this.pay(), { once: true })
    }
  }

  pay() {
    let jsapiParams: object
    try { jsapiParams = JSON.parse(this.paramsValue) }
    catch { this.showError("支付参数解析失败"); return }

    if (typeof window.WeixinJSBridge === "undefined") {
      this.showError("请在微信内打开此页面"); return
    }

    this.payBtnTarget.disabled = true
    this.statusBoxTarget.classList.remove("hidden")

    window.WeixinJSBridge.invoke("getBrandWCPayRequest", jsapiParams, (res) => {
      if (res.err_msg === "get_brand_wcpay_request:ok") {
        this.statusTarget.textContent = "支付成功，正在跳转..."
        window.location.href = this.successUrlValue
      } else if (res.err_msg === "get_brand_wcpay_request:cancel") {
        this.payBtnTarget.disabled = false
        this.statusBoxTarget.classList.add("hidden")
        this.showError("已取消支付")
      } else {
        this.payBtnTarget.disabled = false
        this.statusBoxTarget.classList.add("hidden")
        this.showError(`支付失败：${res.err_msg}`)
      }
    })
  }

  private showError(msg: string) {
    this.errorTarget.textContent = msg
    this.errorTarget.classList.remove("hidden")
  }
}
```

---

## 11. WxLogin 前端

```erb
<%# app/views/wechat/qrcode/show.html.erb %>
<div id="wx_login_container" style="width:300px; min-height:400px;"></div>

<%# stimulus-validator: allow-script %>
<% if ENV["WECHAT_OPEN_APPID"].present? %>
<script>
  function renderWxLogin() {
    var s = document.createElement('script');
    s.src = 'https://res.wx.qq.com/connect/zh_CN/htmledition/js/wxLogin.js';
    s.onload = function() {
      new WxLogin({
        self_redirect: true,
        id:           "wx_login_container",
        appid:        "<%= ENV['WECHAT_OPEN_APPID'] %>",
        scope:        "snsapi_login",
        redirect_uri: encodeURIComponent("<%= ENV['WECHAT_OPEN_REDIRECT_URI'] %>"),
        state:        "<%= SecureRandom.hex(8) %>",
        style:        "black"
      });
    };
    document.head.appendChild(s);
  }
  // 同时监听两个事件，兼容 Turbo Drive 导航和普通加载
  document.addEventListener("turbo:load", renderWxLogin);
  if (document.readyState === "complete" || document.readyState === "interactive") {
    renderWxLogin();
  } else {
    document.addEventListener("DOMContentLoaded", renderWxLogin);
  }
</script>
<% end %>
```

---

## 12. 路由配置

```ruby
# config/routes.rb
namespace :wechat do
  get "qrcode", to: "qrcode#show"

  get  "mp_oauth/authorize", to: "mp_oauth#authorize",
       as: :wechat_mp_oauth_authorize
  get  "mp_oauth/callback",  to: "mp_oauth#callback",
       as: :wechat_mp_oauth_callback

  namespace :pay do
    resource :order, only: [:new, :create] do
      get :success
    end
    post "notify", to: "notify#create"
  end
end

# OmniAuth（开放平台 PC 扫码）
get  "/auth/open_wechat/callback", to: "sessions/omniauth#create"
post "/auth/open_wechat/callback", to: "sessions/omniauth#create"
get  "/auth/failure",              to: "sessions/omniauth#failure"

# Handoff Token（iframe → 主窗口 set cookie）
get "/auth/wechat/handoff", to: "sessions/wechat_handoff#show",
    as: :auth_wechat_handoff
```
