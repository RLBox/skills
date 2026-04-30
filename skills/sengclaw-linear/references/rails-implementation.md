# Rails OAuth Controller 完整实现

## 路由

```ruby
# config/routes.rb
namespace :oauth do
  get  "linear/authorize", to: "linear#authorize"
  get  "linear/callback",  to: "linear#callback"
  delete "linear/revoke",  to: "linear#revoke"
end
```

## Controller

```ruby
# app/controllers/oauth/linear_controller.rb
class Oauth::LinearController < ApplicationController
  def authorize
    install_token = params.require(:install_token)
    redirect_to linear_authorization_url(install_token), allow_other_host: true
  end

  def callback
    code         = params.require(:code)
    install_token = params.require(:state)

    token_data      = exchange_code_for_token(code)
    access_token    = token_data["access_token"]
    refresh_token   = token_data["refresh_token"]
    organization_id = fetch_organization_id(access_token)
    actor_id        = fetch_actor_id(access_token)

    LinearInstallation.create!(
      install_token:   install_token,
      access_token:    access_token,
      refresh_token:   refresh_token,
      workspace_id:    organization_id,
      actor_id:        actor_id,
      scope:           token_data["scope"]
    )

    render plain: "✅ Connected to Linear!"
  rescue ActionController::ParameterMissing => e
    render plain: "Missing parameter: #{e.param}", status: :bad_request
  rescue ActiveRecord::RecordInvalid => e
    render plain: "Validation Error: #{e.message}", status: :unprocessable_entity
  end

  def revoke
    installation = LinearInstallation.find_by!(install_token: params.require(:install_token))
    revoke_token(installation.access_token)
    installation.destroy!
    render plain: "✅ Revoked."
  end

  private

  def linear_authorization_url(state)
    params = {
      actor:         "app",
      client_id:     ENV["LINEAR_CLIENT_ID"],
      redirect_uri:  oauth_linear_callback_url,
      response_type: "code",
      scope:         "read,write,app:assignable,app:mentionable",
      state:         state
    }
    "https://linear.app/oauth/authorize?#{params.to_query}"
  end

  def exchange_code_for_token(code)
    response = Faraday.post("https://api.linear.app/oauth/token") do |req|
      req.headers["Content-Type"] = "application/x-www-form-urlencoded"
      req.body = URI.encode_www_form(
        code:          code,
        client_id:     ENV["LINEAR_CLIENT_ID"],
        client_secret: ENV["LINEAR_CLIENT_SECRET"],
        redirect_uri:  oauth_linear_callback_url,
        grant_type:    "authorization_code"
      )
    end
    JSON.parse(response.body)
  end

  def fetch_organization_id(access_token)
    graphql_query(access_token, "{ organization { id } }")
      .dig("data", "organization", "id")
  end

  def fetch_actor_id(access_token)
    graphql_query(access_token, "{ viewer { id } }")
      .dig("data", "viewer", "id")
  end

  def graphql_query(access_token, query)
    response = Faraday.post("https://api.linear.app/graphql") do |req|
      req.headers["Content-Type"]  = "application/json"
      req.headers["Authorization"] = access_token  # 不加 Bearer
      req.body = { query: query }.to_json
    end
    JSON.parse(response.body)
  end

  def revoke_token(access_token)
    Faraday.post("https://api.linear.app/oauth/revoke") do |req|
      req.headers["Content-Type"]  = "application/x-www-form-urlencoded"
      req.headers["Authorization"] = access_token
      req.body = URI.encode_www_form(access_token: access_token)
    end
  end
end
```

## Model

```ruby
# app/models/linear_installation.rb
class LinearInstallation < ApplicationRecord
  validates :workspace_id, :access_token, :install_token, presence: true
end
```

## Migration

```ruby
create_table :linear_installations do |t|
  t.string :install_token,   null: false
  t.string :workspace_id,    null: false
  t.string :actor_id
  t.string :access_token,    null: false
  t.string :refresh_token
  t.string :scope
  t.timestamps
end
```

## 环境变量（application.yml）

```yaml
LINEAR_CLIENT_ID:     "your_client_id"
LINEAR_CLIENT_SECRET: "your_client_secret"
```
