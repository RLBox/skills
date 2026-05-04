---
name: box-validator-generator
description: 'Generate validator files for AI Agent benchmark testing in any of the five sandbox projects (Goomart, Kangoo, planet, IdleSwap, duvy). Use when the user asks to generate a validator, create a validator file, make a new validator, or add a test case. Generates app/validators/{module}/v{NNN}_{brief_name}_validator.rb with prepare, verify, simulate (and optional seed) methods, following the project''s data_version / RLS conventions. Auto-detects which project to use from the current working directory or user context.'
disable-model-invocation: false
user-invocable: true
---

# Validator Generator（多项目通用版）

## Purpose

自动生成 validator 代码文件，用于 AI Agent 能力测试 / benchmark。支持五个 Agent Benchmark 沙盒项目：**Goomart、Kangoo、planet、IdleSwap、duvy**。

生成的 validator 包含 `prepare`、`verify`、`simulate` 三个核心方法（可选 `seed` 钩子），符合各项目的 data_version / RLS 约定。

**按业务模块分子目录**，模块内三位数字自动编号。

## 🗺️ 项目检测（启动时必做）

**调用本 skill 时，先确定目标项目：**

1. 检查当前工作目录是否在某个项目路径下（`/Volumes/SengclawWorkspace/code/{Project}/`）
2. 用户是否明确指定了项目（"给 Kangoo 生成 validator"）
3. 如果无法确定，询问用户

确定项目后，读取该项目的权威文档（见各项目 Profile 章节）：
- `CLAUDE.md` — 了解项目架构和约定
- `docs/conventions/validator-writing.md` — 编写规范（**优先级高于本 skill 的通用规则**）
- `docs/architecture/validator-system.md` — 验证器生命周期

## When to use this skill

- 用户说："生成 validator"、"创建 validator"、"新建验证器"、"写个测试用例"
- 用户说："make a validator"、"generate validator"、"create a benchmark task"
- 用户给了一个自然语言任务描述（如"给张三加购 2 斤苹果"），要求做成 validator
- 功能开发完成后，参照 spec 里的「Validator Acceptance Scenarios」清单批量生成

## ⚠️ 权威文档

**本 skill 生成的代码必须符合**（以目标项目的文档为准）：
- `docs/conventions/validator-writing.md` — 编写规范（题目 / prepare / simulate / verify 断言）
- `docs/architecture/data-version.md` — data_version 语义与 RLS
- `docs/architecture/validator-system.md` — 生命周期
- `docs/decisions/ADR-001-all-business-tables-have-data-version.md` — 业务表红线

**如果项目规范与本 skill 冲突，以项目规范为准**。发现冲突就更新本 skill。

## Validator 结构总览

```ruby
# frozen_string_literal: true

require_relative '../base_validator'

class Validators::Order::V001BuyApplesValidator < Validators::BaseValidator
  self.validator_id = 'order_v001_buy_apples'
  self.task_id = '任务-UUID'
  self.title = '给张三下单购买 2 斤有机苹果'
  self.timeout_seconds = 180

  # (可选) 题目私有预制数据 —— 在 prepare 之前执行
  # 新建记录自动写入 @data_version，不会污染 baseline
  def seed
    # 例: 给张三预先加一个收货地址（不想出现在全局 baseline 里的）
  end

  def prepare
    # 只查 baseline（data_version: '0'），不写数据
    @user    = User.find_by!(email: 'demo@rlbox.ai', data_version: '0')
    @product = Product.find_by!(name: '有机苹果', data_version: '0')

    {
      task: "请为张三下单购买 2 斤有机苹果",
      hint: '在购物车中加入苹果并完成下单'
    }
  end

  def verify
    add_assertion '订单已创建', weight: 30 do
      @order = Order.where(user: @user, data_version: @data_version)
                    .order(created_at: :desc).first
      expect(@order).not_to be_nil, '未找到张三的订单'
    end

    return if @order.nil?

    add_assertion '订单包含苹果', weight: 40 do
      item = @order.order_items.find_by(product: @product)
      expect(item).not_to be_nil, "订单未包含商品：#{@product.name}"
    end

    add_assertion '数量为 2', weight: 30 do
      item = @order.order_items.find_by(product: @product)
      expect(item.quantity).to eq(2), "预期 2，实际 #{item&.quantity.inspect}"
    end
  end

  def simulate
    order = Order.create!(
      user: @user,
      status: 'pending',
      total_price: @product.price * 2,
      data_version: @data_version
    )
    order.order_items.create!(
      product: @product,
      quantity: 2,
      unit_price: @product.price,
      data_version: @data_version
    )
  end
end
```

## 🔑 通用硬规则（五个项目均适用，违反 = 代码废）

### 1. data_version 永远是字符串

```ruby
# ✅ 正确
User.find_by!(email: 'demo@rlbox.ai', data_version: '0')
CartItem.create!(user: @user, data_version: @data_version)

# ❌ 错（data_version 是 string 类型，不是 integer）
User.find_by!(email: 'demo@rlbox.ai', data_version: 0)
```

### 2. simulate / seed 里创建的记录必须带 `@data_version`（绝不 `'0'`）

```ruby
# ✅ 正确：@data_version 由 base_validator 在 execute_prepare 时生成
Order.create!(user: @user, data_version: @data_version)

# ❌ 反例 1：污染 baseline，永久留存
Order.create!(user: @user, data_version: '0')

# ❌ 反例 2：漏字段，会走 DataVersionable 的 before_create，从 SESSION 取
# 虽然技术上可行，但不显式 = 容易踩坑
Order.create!(user: @user)  # 可读性差，不推荐
```

`rake validator:lint` 会静态扫描复现反例 1。

### 3. verify 的查询必须带 `data_version: @data_version`

```ruby
# ✅ 正确
orders = Order.where(user: @user, data_version: @data_version).to_a

# ❌ 错：漏 data_version，会受 RLS / 跨会话污染影响
orders = Order.where(user: @user).to_a
```

### 4. 禁用业务表三件套（ADR-001 / 003 红线）

**绝不**在业务表（User/Order/Product 等模型）上使用：
- `data_version_excluded!`
- `unscope(where: :data_version)`
- `skip_callback :create, :before, :set_data_version`

这三件套仅限系统表（Administrator / Session / AdminOplog / ValidatorExecution / ActiveStorage*）。具体哪些算系统表见各项目 ADR-001。

### 5. 过滤 vs 断言分离

```ruby
# ❌ 坏：属性塞进 where，只能判"有/无"
items = CartItem.where(product: @product, quantity: 2, data_version: @data_version)

# ✅ 好：where 只锁 scope，断言独立
items = CartItem.where(product: @product, data_version: @data_version).to_a
add_assertion '数量为 2', weight: 15 do
  items.each { |i| expect(i.quantity).to eq(2), "预期 2，实际 #{i.quantity}" }
end
```

### 6. Guard clause 必须有

```ruby
add_assertion '订单存在', weight: 25 do
  @order = Order.where(user: @user, data_version: @data_version).first
  expect(@order).not_to be_nil
end

return if @order.nil?   # ← 没这行，下面断言会 NPE

add_assertion '订单金额正确', weight: 30 do
  expect(@order.total_price).to eq(199), "..."
end
```

### 7. Assertion 权重总和 = 100

### 8. RLS / SET SESSION 不用手动管

`BaseValidator#execute_prepare` 已经做了：
```ruby
ActiveRecord::Base.connection.execute("SET SESSION app.data_version = '#{@data_version}'")
seed if respond_to?(:seed)
```

validator 子类**不要**自己写 `SET SESSION`。

### 9. ⚠️ seed 钩子执行顺序 → 必须用 `load_refs` pattern（硬约定）

`seed` 在 `prepare` **之前**执行。如果你把 `@user = User.find_by!(...)` 放在 `prepare` 里，seed 里 `belongs_to :user` 校验会抛 `Validation failed: User must exist`。

**正确做法**：baseline 引用抽出一个 `load_refs` 私有方法，seed 和 prepare 各调一次，用 `return if @user` memoize。

```ruby
def prepare
  load_refs
  { task: "把购物车里的 #{@product.name} 换成 #{@bulk_variant.name}", hint: '编辑已有 cart item' }
end

def seed
  load_refs
  # @data_version 由 base_validator 自动注入；这里私有数据要显式写
  CartItem.create!(
    user: @user, product: @product, product_variant: @share_variant,
    quantity: 1, data_version: @data_version
  )
end

private

# seed 在 prepare 之前执行 → baseline 引用抽出来共用
def load_refs
  return if @user  # memoize: 只查一次
  # 替换为目标项目的 demo user email（见各项目 Profile）
  @user = User.find_by!(email: 'demo@rlbox.ai', data_version: '0')
  @product = Product.find_by!(name: '椰子水 1L', data_version: '0')
  @share_variant = ProductVariant.find_by!(product: @product, name: '1L【分享装】', data_version: '0')
  @bulk_variant  = ProductVariant.find_by!(product: @product, name: '1L*12【囤货装】', data_version: '0')
end

public  # 恢复，让 verify / simulate 保持默认 public
```

> **Canonical 示例**：`app/validators/cart/v002_change_coconut_variant_validator.rb`（Goomart）完整展示 seed 钩子、load_refs pattern、public/private toggle、data_version 处理。

### 10. 命名约定（子目录 validator）

所有子目录 validator 都在 `Validators` 根命名空间下，每级目录名对应一层模块：

- 文件：`app/validators/order/v002_reorder_previous_validator.rb`
- 类名：**`Validators::Order::V002ReorderPreviousValidator < Validators::BaseValidator`**
- validator_id：**`order_v002_reorder_previous`**（`{module}_{文件名去掉_validator}`）

**类名公式**：
```
Validators::{Module}::{文件名 Pascal 化}
```

**validator_id 公式**：
```
'{module}_v{NNN}_{brief_name}'
# 例：'cart_v006_cart' / 'catalog_v001_browse_fruits_best_rating'
```

**真实例子**（以实际文件为准）：
| 文件路径 | 类名 | validator_id |
|---|---|---|
| `cart/v001_add_bottled_water_3_validator.rb` | `Validators::Cart::V001AddBottledWater3Validator` | `cart_v001_add_bottled_water_3` |
| `catalog/v001_browse_fruits_best_rating_validator.rb` | `Validators::Catalog::V001BrowseFruitsBestRatingValidator` | `catalog_v001_browse_fruits_best_rating` |
| `account/v001_add_nanshan_address_validator.rb` | `Validators::Account::V001AddNanshanAddressValidator` | `account_v001_add_nanshan_address` |
| `checkout/v001_default_address_validator.rb` | `Validators::Checkout::V001DefaultAddressValidator` | `checkout_v001_default_address` |

⚠️ **反例**：
- ❌ `V002ReorderPreviousValidator`（缺 `Validators::Order::` 前缀，会报 uninitialized constant）
- ❌ `V002OrderReorderPreviousValidator`（把模块名塞进类名中间了）
- ❌ `validator_id = 'v002_order_validator'`（格式错，应为 `order_v002_reorder_previous`）

### 11. 绝不要用 `be_true` / `be_false`（RSpec 3 已删）

`BaseValidator#expect` 优先走 RSpec（`RSPEC_AVAILABLE`）。RSpec 3 已移除 `be_true` / `be_false` 两个 matcher，继续用会被当 predicate matcher → 尝试调用 `true.true?` → `NoMethodError` → 被 `add_assertion` 的 `rescue StandardError` 吞成 `"执行错误: undefined method 'true?' for true"`，assertion 不明不白地挂掉。

```ruby
# ❌ 错：RSpec 3 会把 be_true 当 predicate matcher
expect(match_result).to be_true, '备注包含晚上 8 点'

# ✅ 对：三选一
expect(match_result).to be_truthy, '备注包含晚上 8 点'   # nil/false 失败，其他通过
expect(match_result).to eq(true), '备注包含晚上 8 点'    # 精确等于 true
expect(match_result).to be true                           # 同上，新语法
```

`add_assertion` 默认 rescue 所有 StandardError → 真实 bug 会被误报成"assertion failed"，写断言时优先 `be_truthy` / `eq`，避开 predicate matcher 风险。

### 12. 查"自己的"集合（addresses / cart_items）要显式 `where(data_version: '0')`

RLS policy 让 session 同时看到 `data_version='0'` 和 `data_version=@data_version` 两类记录。如果 `seed` 里又给同一个 user 造了一条私有 address，那 `@user.addresses.first` 可能拿到私有的而不是 baseline 那条。

```ruby
# ❌ 可能误中 seed 造的私有地址
@home = @user.addresses.order(created_at: :desc).first

# ✅ 显式锁 baseline
@home = @user.addresses.where(data_version: '0').order(created_at: :desc).first
```

同理 `@user.cart_items` / `@user.orders` 等，如果你"只想要 baseline 基线条目"，都要显式 `where(data_version: '0')`。

### 13. 生成前先核对字段（pre-flight schema check）

Goomart 模型字段和 skill 作者记忆里的往往不一样，踩过的坑：

| 以为有 | 实际 |
|---|---|
| `Product.stock` | ❌ 没有（库存是 variant 层或不存库存） |
| `Product.rating` | ❌ 用 `positive_rate` 和 `review_count` |
| `Product.sub_category_key` | ❌ 用 `category_id`（FK 到 Category）|
| `Address.is_default` | ❌ 没有。"默认地址" = `addresses.order(created_at: :desc).first`（checkouts_controller 逻辑）|
| `ProductVariant.stock` | ❌ 没有 |
| `PaymentPassword.password` | ❌ 用 `password_digest`（BCrypt）|

**生成前的预检**（强烈建议）：

```bash
# 查一个模型的实际字段
bundle exec rails runner "puts Product.columns.map(&:name).join(', ')"

# 或直接翻 db/structure.sql
grep -A 40 "CREATE TABLE public.products" db/structure.sql
```

如果模板里引用了一个字段不在实际 schema 里，生成出来 `execute_simulate` 会直接炸（`NoMethodError`）。**不要凭记忆写字段**。

## 目录结构（通用，按业务模块分子目录）

各项目的模块名不同，见下方 Profile。通用结构如下：

```
app/validators/
  ├── base_validator.rb              ← 框架，不要改
  ├── multi_turn_base_validator.rb   ← 多轮对话扩展（部分项目有）
  ├── support/data_packs/v1/         ← baseline 数据源（不归 skill 管）
  │
  ├── {module}/                      ← 按业务模块分目录
  │   ├── v001_{name}_validator.rb
  │   └── v002_{name}_validator.rb
  └── ...
```

**`require_relative '../base_validator'`** —— 子目录 validator 用这个引用父级。

## 命名规则

**核心**：**类名 = `Validators::{Module}::{文件名 Pascal 化}`**（见硬规则 §10）。

| 项 | 格式 | 示例 |
|---|---|---|
| 目录 | `{module}/` | `order/` |
| 文件名 | `v{NNN}_{brief_name}_validator.rb` | `v002_reorder_previous_validator.rb` |
| 类名 | `Validators::{Module}::V{NNN}{BriefName}Validator` | `Validators::Order::V002ReorderPreviousValidator` |
| 父类 | `Validators::BaseValidator` | — |
| `validator_id` | `'{module}_v{NNN}_{brief_name}'` | `'order_v002_reorder_previous'` |
| 编号 | 三位数字（模块内递增） | `001`, `002`, `003` |

⚠️ **反例**：
- `order/v002_reorder_previous_validator.rb` → ❌ `V002ReorderPreviousValidator`（缺命名空间）
- `order/v002_reorder_previous_validator.rb` → ❌ `V002OrderReorderPreviousValidator`（模块名重复塞入）
- `validator_id = 'v002_order_validator'` → ❌（格式错，应为 `order_v002_reorder_previous`）

## 📦 项目 Profile

> 调用本 skill 前先确定目标项目，加载对应 Profile 作为生成上下文。

---

### Profile: Goomart（社区团购商超）

**项目路径**：`/Volumes/SengclawWorkspace/code/Goomart/`
**业务场景**：社区团购电商，用户购物车下单、商品浏览、结算、账号管理

**Demo 用户**：`User.find_by!(email: 'demo@rlbox.ai', data_version: '0')`（密码 `password123`，支付密码 `123456`）
**受益人写法**：`给张三 ...` 或 `帮张三 ...`

**模块表**：

| 模块 | 用途 | 典型任务 |
|---|---|---|
| `common` | 通用 / 多模块混合 | 跨购物车+支付的复合任务 |
| `order` | 下单、支付、订单状态、取消 | "给张三下单购买 2 斤苹果" / "取消订单" |
| `catalog` | 商品浏览、分类、搜索、详情 | "浏览水果分类找最便宜的苹果" / "搜索鸡蛋最低价" |
| `cart` | 购物车增删改查 | "给张三加购 2 斤苹果" / "把酸奶改成 3 盒" |
| `checkout` | 结算、地址选择、备注、运费 | "用非默认地址结算" / "结算时备注配送时间" |
| `account` | 账号资料、收货地址管理、支付密码 | "添加收货地址" / "修改昵称" / "重置支付密码" |

**Baseline 数据**：

| 类型 | 查询方式 |
|---|---|
| Demo 用户 | `User.find_by!(email: 'demo@rlbox.ai', data_version: '0')` |
| Demo 默认地址 | `@user.addresses.where(data_version: '0').order(created_at: :desc).first`（科兴科学园 A 座 1801，label=家） |
| Categories | `Category.where(data_version: '0')`（125 条） |
| Products | `Product.where(data_version: '0')`（27 条，含水果/鸡蛋/农夫山泉/椰子水等） |
| ProductVariants | `ProductVariant.where(data_version: '0')`（椰子水有 `1L【分享装】` 和 `1L*12【囤货装】`） |
| Reviews | `Review.where(data_version: '0')`（21 条） |

**无 baseline**：CartItem、Order（运行时产物，在 `simulate` 或 `seed` 阶段按需创建）

**Canonical 示例**：`app/validators/cart/v002_change_coconut_variant_validator.rb`

**schema 预检（生成前必查字段）**：
```bash
bundle exec rails runner "puts Product.columns.map(&:name).join(', ')"
grep -A 40 "CREATE TABLE public.products" db/structure.sql
```
常见踩坑：`Product.stock`（❌ 不存在）、`Product.rating`（❌ 用 `positive_rate`）、`Address.is_default`（❌ 不存在）

---

### Profile: Kangoo（外卖点餐）

**项目路径**：`/Volumes/SengclawWorkspace/code/Kangoo/`
**业务场景**：外卖点餐平台，用户在餐厅下单、购物车、支付、地址管理

**Demo 用户**：`User.find_by!(email: 'demo@rlbox.ai', data_version: '0')`（User ID=14）
**受益人写法**：**不提受益人姓名**，直接说"请取消订单"、"请新增地址"

**关键约定（validator-writing.md 2026-04-29 新增）**：
- 标题必须包含**完整具体值**（联系人/金额/店铺名/地址，不能模糊）
- ✅ `新增收货地址（联系人：张三 13912345678，上海市浦东新区陆家嘴环路1000号，类型：家）`
- ❌ `新增地址`（缺具体值）

**模块表**：

| 模块 | 用途 | 典型任务 |
|---|---|---|
| `order` | 下单、支付、订单状态、取消 | "在老王牛肉面馆下单" / "取消待支付订单" |
| `cart` | 购物车操作 | "把可乐套餐改成 3 份" |
| `address` | 收货地址管理 | "新增收货地址（联系人：张三...）" |
| `support` | 客服、退款 | — |

**RLS 特殊说明**：Kangoo 有 RLS（`bin/db_init` 初始化），validator 里不用手动设置
**`multi_turn_base_validator.rb`**：可用于多轮对话场景（如与客服对话）

---

### Profile: planet（社交派对）

**项目路径**：`/Volumes/SengclawWorkspace/code/planet/`
**业务场景**：社交派对 app，用户发帖、报名活动、社交互动

**Demo 用户**：`::User.find_by!(handle: 'demo', data_version: '0')` 或 `::User.find_by!(email: 'demo@rlbox.ai', data_version: '0')`
**注意**：planet validator 里模型前缀必须用 `::User`（因在 `Validators::` 命名空间下，不加 `::` 会解析成 `Validators::User`）
**受益人写法**：`给张三 ...` 或 `帮张三 ...`

**模块表**：

| 模块 | 用途 | 典型任务 |
|---|---|---|
| `post` | 发帖、编辑、删除、标签 | "给张三发一条关于「周末深圳湾骑行」的帖子" |
| `support` | 客服测试 | — |

**`::` 前缀规则**：所有模型调用都要加 `::` 前缀（`::User`、`::Post`、`::Party` 等）
**`multi_turn_base_validator.rb`**：可用于多轮对话场景

---

### Profile: IdleSwap（闲置物品交易）

**项目路径**：`/Volumes/SengclawWorkspace/code/IdleSwap/`
**业务场景**：闲置物品买卖平台，发布/购买二手商品

**Demo 用户**：`User.find_by!(email: 'demo@rlbox.ai', data_version: '0')`
> ⚠️ 注意：现有部分 validator 代码用了 `zhangsan@example.com`（旧遗留），新生成统一用 `demo@rlbox.ai`

**模块表**：

| 模块 | 用途 | 典型任务 |
|---|---|---|
| `post` | 发布/编辑/删除闲置帖 | "发布一条价格 5000+ 元的 iPhone 13 Pro 帖子" |
| `order` | 买卖交易、支付 | "购买帖子中的商品" |
| `message` | 站内私信 | "给卖家发询价消息" |
| `comment` | 帖子评论 | — |
| `favorite` | 收藏 | — |
| `like` | 点赞 | — |
| `search` | 搜索 | — |
| `address` | 收货地址 | — |
| `user` | 用户资料 | — |
| `support` | 客服 | — |

**`multi_turn_base_validator.rb`**：可用于多轮对话场景

---

### Profile: duvy（社区帖子，早期项目）

**项目路径**：`/Volumes/SengclawWorkspace/code/duvy/`
**业务场景**：社区内容平台（早期，validator 很少）

**Demo 用户**：`User.where(data_version: '0').first`（或查实际 baseline 用户，暂无固定 demo 账号）
**注意**：duvy 的 validator 数量很少，优先参考 `v001_create_post_validator.rb` 的风格

**模块表**：

| 模块 | 用途 |
|---|---|
| `post` | 创建/编辑帖子 |
| `support` | 客服 |

---

## 技能执行流程（Skill Execution Flow）

当用户要求生成 validator 时：

### Step 1：确定目标项目

检测当前工作目录或用户指定，加载对应 Profile（见上方）。

### Step 2：解析输入

用户输入形如：
```
生成 validator: [任务描述], 模块 [module_name], 编号 [number]
```

- **任务描述**（必需）：`给张三加购 2 斤有机苹果`
- **模块名**（可选，默认 `common`）：`order` / `cart` / `post` / ...
- **编号**（可选，默认自动分配）：`001` / `002` / ...

解析不到模块时：从任务描述猜，参考目标项目的模块表。

### Step 3：分配编号

使用 `validator_number_helper.rb`：

```ruby
require_relative 'validator_number_helper'
helper = ValidatorNumberHelper.new
# 如果用户没指定编号
number = helper.find_next_number('order')           # => "003"
# 如果用户指定了编号，检查冲突
info = helper.get_available_number('order', '005')  # => { number: "005", conflict: false }
# 冲突时自动递增到下一个可用编号，并在输出里明确提示
```

### Step 3：收集信息（询问或推断）

对应到 `validator-writing.md` 的规范，至少要回答：

1. **题目（title）与任务描述（task）**：两个字段都必须符合「人类视角」，但侧重点不同。

   ---

   **题目（self.title）= 用一句话概括这个任务是什么**

   题目 = **给 AI Agent 下达的任务指令**，不是测试用例的断言描述。

   ✅ 正确——人类能理解"要做什么"：
   - `给张三加购 2 斤有机苹果`（Goomart）
   - `在首页「打卡」Tab 参加星愿之旅，选「60 天·顶配好物档」`（打卡功能，用 UI 原话）
   - `新增收货地址（联系人：张三 13912345678，南山科技园，类型：家）`（Kangoo，含完整具体值）
   - `给张三发一条关于「周末骑行」的帖子`（planet）
   - `今天已打卡后，再次尝试打卡`（边界/异常路径，仍是操作指令）

   ❌ 错误——测试/断言视角，不是任务指令：
   - `同日内尝试重复打卡不应叠加天数`（「不应」是断言语气，不是任务）
   - `仅完成 3/4 个任务，不应计今日打卡`（「不应」是断言语气）
   - `验证重复打卡不会叠加`（「验证」是测试语气）
   - `加入 30 天档位礼包后完成首日打卡`（「30天档位礼包」是工程师归纳的功能名，不是 UI 原话）
   - `CartItem.create(user_id: 1, ...)`（像代码）
   - `在 /cart 页面点击 + 按钮两次`（像操作手册）

   **判断标准 1**：把这句话告诉真人，他知道该做什么吗？
   - `给张三加购 2 斤有机苹果` → 真人知道怎么做 ✅
   - `同日内尝试重复打卡不应叠加天数` → 真人不知道「做什么」❌

   **判断标准 2**：用的是 UI 上的原文，还是工程师归纳的功能名？
   - `60 天·顶配好物档` → UI 原话 ✅
   - `60 天档位礼包` → 工程师归纳 ❌（先读 app 界面或 spec 确认实际文案）

   如果用户给的输入含有「不应」「应该」「验证」「检查」等断言词，**在写 title 前先把它改写成操作指令**，把预期放进 verify 断言里。

   ---

   **任务描述（prepare 的 task 字段）= 用户打开 app 时对 AI 助手说的话**

   task 字段是真实的自然语言指令，要有完整上下文，像普通用户说话的样子。

   ✅ 正确——有上下文、有具体值、像真人在说话：
   ```ruby
   task: "帮我打开首页的「打卡」Tab，从 3 档星愿礼包里选「60 天·顶配好物档」参加"
   task: "我已经参加了「30 天·品质好物档」，帮我把今天打卡面板里的 4 个任务都完成了（每日签到、逛社区、逛商品、发现入口），让今天算打卡成功"
   task: "帮我在购物车里加 2 斤有机苹果"
   ```

   ❌ 错误——像任务单或工程规范，不像真人说话：
   ```ruby
   task: "请为张三下单购买 2 斤有机苹果"   # 「请为张三」是第三人称，像工程师写的
   task: "完成首日打卡"                     # 太短，缺乏上下文
   task: "让今天的打卡计上去"               # 工程师视角，不是用户视角
   ```
2. **受益人**：参考目标项目 Profile 的 demo user（大部分项目用 `demo@rlbox.ai`，Kangoo 不写受益人姓名）
3. **涉及模型**：这个任务会读 / 写哪些表？
4. **验证断言**：怎么判断 Agent 做对了？（2-4 条断言，权重总和 100）
5. **timeout_seconds**：简单 60-120s，中等 180-240s，复杂 300-600s
6. **是否需要 seed**：如果题目需要"预制私有数据"（例如购物车里已有 2 个商品，让 Agent 去加第 3 个），用 `seed`；否则不写

### Step 4：生成前 pre-flight

在写文件之前，**先验一下要引用的字段是否真存在**（避免"以为 Product 有 stock"这种坑）：

```bash
# 查 schema 里实际字段
bundle exec rails runner "puts Product.columns.map(&:name).join(', ')"
# 或
grep -A 40 "CREATE TABLE public.products" db/structure.sql
```

模板里引用了什么字段，就 grep 什么。不确定就查。

### Step 5：生成文件

1. 读 `TEMPLATE_GOOMART.rb` 作为骨架
2. 替换 `{占位符}`（见模板注释）
3. 类名按 **文件名 Pascal 化** 生成（见硬规则 §10）—— 不要把模块名重复塞进类名
4. 如果需要 `seed`，直接用 `load_refs` pattern（见硬规则 §9）
5. 写到 `app/validators/{module}/v{NNN}_{module}_validator.rb`
6. 如果目录不存在，先 `mkdir -p`

### Step 6：自检

生成后立刻跑：

```bash
bundle exec rake validator:lint
```

如果 lint 有警告，**修掉再交付**（不要让用户自己处理 lint）。

更强的校验（推荐对每个新 validator 都跑一次）：

```bash
bundle exec rails runner "V002ReorderPreviousValidator.new.execute_simulate"
```

`execute_simulate` 会把 prepare + seed + simulate + verify + rollback 全流程跑完，拿到 `status: passed` 才算真的过。

### Step 7：汇报

告诉用户：
- 生成了哪个文件（绝对路径）
- validator_id / task_id
- 权重分布
- 是否用了 seed（以及 load_refs 里引用了哪些 baseline）
- lint + execute_simulate 结果

## 完整示例：从需求到文件（Goomart）

**用户输入**：
```
生成 validator：给张三下单购买 2 斤有机苹果（总价 < 50 元），模块 order
```

**执行步骤**：
1. 项目 = Goomart，模块 = `order`，自动分配编号 `002`（假设 `v001_order_validator.rb` 已存在）
2. 题目 = `给张三下单购买 2 斤有机苹果（总价 < 50 元）`
3. Demo 用户 = `demo@rlbox.ai`（Goomart Profile）
4. 涉及模型：User / Product / Order / OrderItem
5. 断言设计：
   - 订单已创建 (30)
   - 订单包含苹果 (25)
   - 数量为 2 (20)
   - 总价 < 50 (25)
6. timeout = 180s
7. 不需要 seed（简单下单，不用预制数据）

**生成文件**：`app/validators/order/v002_buy_apples_validator.rb`
**类名**：`Validators::Order::V002BuyApplesValidator < Validators::BaseValidator`
**validator_id**：`'order_v002_buy_apples'`

## Task UUID

每个 validator 的 `self.task_id` 需要一个唯一 UUID。生成方式：

```ruby
# 在 Ruby 里
require 'securerandom'
SecureRandom.uuid
# => "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

或在 shell 里：
```bash
ruby -rsecurerandom -e 'puts SecureRandom.uuid'
```

Skill 生成时直接写进模板，**不要**用 `SecureRandom.uuid` 作为值（那样每次加载都不同）。

## 反模式速查（见到就停手）

```ruby
# ❌ 反例 A：simulate 写 '0' 污染 baseline
def simulate
  Order.create!(user: @user, data_version: '0')   # NOOO
end

# ❌ 反例 B：业务表加三件套
class Product < ApplicationRecord
  data_version_excluded!                          # ADR-001 禁止
  default_scope { unscope(where: :data_version) }
  skip_callback :create, :before, :set_data_version
end

# ❌ 反例 C：verify 查询漏 data_version
def verify
  orders = Order.where(user: @user).to_a          # 会读到其他会话
end

# ❌ 反例 D：data_version 用整数
User.find_by!(email: 'demo@rlbox.ai', data_version: 0)  # 应是 '0'

# ❌ 反例 E：prepare 里创建数据（应放 seed / simulate）
def prepare
  Address.create!(user: @user, ...)               # ❌ 迁移到 seed
end

# ❌ 反例 F：在 simulate 里手动 SET SESSION
def simulate
  ActiveRecord::Base.connection.execute("SET SESSION app.data_version = ...")
  # base_validator 已经做过了，别重复
end

# ❌ 反例 G：seed 里引用 @user（但 @user 在 prepare 里才查）
# seed 在 prepare 之前执行 → @user 是 nil → belongs_to 校验失败
def prepare
  @user = User.find_by!(email: 'demo@rlbox.ai', data_version: '0')
end
def seed
  CartItem.create!(user: @user, ...)   # ❌ @user == nil
end
# ✅ 正确：抽 load_refs 私有方法，seed 和 prepare 都调

# ❌ 反例 H：用 be_true / be_false（RSpec 3 已删）
add_assertion '...', weight: 50 do
  expect(match_result).to be_true, '...'    # NoMethodError: true.true?
end
# ✅ 正确：be_truthy / eq(true) / be true

# ❌ 反例 I：查"自己"集合没加 data_version 过滤
@home = @user.addresses.first                # 可能拿到 seed 造的私有地址
# ✅ 正确：
@home = @user.addresses.where(data_version: '0').order(created_at: :desc).first

# ❌ 反例 J：类名 ≠ 文件名 Pascal（Zeitwerk::NameError）
# 文件：app/validators/order/v002_reorder_previous_validator.rb
class V002OrderReorderPreviousValidator < BaseValidator   # ❌ 目录名塞进类名
# ✅ 正确：class V002ReorderPreviousValidator < BaseValidator
```

## 会话结束 Checklist

生成完后，按照 [CLAUDE.md 的 Session-End Checklist](../../../CLAUDE.md#-session-end-checklist-agent-必读)：

- [ ] `rake validator:lint` 通过
- [ ] 如果引入新约定（例如新的 assertion 模式），考虑更新 `validator-writing.md` 或开 ADR
- [ ] 生成的 validator 实际试跑一次 `execute_simulate` 应返回 `passed`

## 参考

- **模板骨架**：`TEMPLATE_GOOMART.rb`（本目录下，以 Goomart 为基础，其他项目参考使用）
- **编号助手**：`validator_number_helper.rb`（本目录下）
- **🌟 Canonical 示例（带 seed + load_refs，Goomart）**：`app/validators/cart/v002_change_coconut_variant_validator.rb` —— 完整展示 seed 钩子、load_refs pattern、public/private toggle、data_version 处理
- **Goomart 实战 validator（10+）**：`app/validators/{catalog,cart,checkout,order,account}/v*.rb`
- **planet 实战 validator**：`app/validators/post/v001_like_first_post_validator.rb`
- **duvy 早期 validator（无 seed，参考风格）**：`app/validators/v001_create_post_validator.rb`
