---
name: box-validator-generator
description: 'Generate validator files for AI Agent benchmark testing in any of the five sandbox projects (Goomart, Kangoo, planet, IdleSwap, duvy). Use when the user asks to generate a validator, create a validator file, make a new validator, or add a test case. Generates app/validators/{module}/v{NNN}_{brief_name}_validator.rb with prepare, verify, simulate methods, following IdleSwap''s data_version / RLS / Zeitwerk conventions.'
disable-model-invocation: false
user-invocable: true
---

# Validator Generator (IdleSwap 闲时换版 v2)

## Purpose

自动生成 IdleSwap validator 代码文件，用于 AI Agent 能力测试 / benchmark。生成的 validator 包含 `prepare`、`execution_state_data`、`restore_from_state`、`verify`、`simulate` 五个核心方法（可选 `seed` 钩子），严格遵守 IdleSwap 项目的：
- **Validators:: 命名空间**（Zeitwerk 自动加载，不需要 require_relative）
- **data_version / RLS 隔离**
- **跨请求状态持久化**（ADR-006）
- **五要素 task 描述规范**

## When to use this skill

- 用户说："生成 validator"、"创建 validator"、"新建验证器"、"写个测试用例"
- 用户说："make a validator"、"generate validator"、"create a benchmark task"
- 用户给了一个自然语言任务描述（如"给张三发布一个二手 iPhone"），要求做成 validator

## ⚠️ 权威文档

**本 skill 生成的代码必须符合**：
- [`docs/conventions/validator-writing.md`](../../../docs/conventions/validator-writing.md) — 编写规范
- [`docs/architecture/data-version.md`](../../../docs/architecture/data-version.md) — data_version 语义与 RLS
- [`docs/architecture/validator-system.md`](../../../docs/architecture/validator-system.md) — 生命周期
- [`docs/decisions/ADR-005-validator-subdirectory-structure.md`](../../../docs/decisions/ADR-005-validator-subdirectory-structure.md) — 子目录组织
- [`docs/decisions/ADR-006-verify-cross-request-isolation.md`](../../../docs/decisions/ADR-006-verify-cross-request-isolation.md) — 跨请求隔离
- [`docs/decisions/ADR-007-validators-namespace.md`](../../../docs/decisions/ADR-007-validators-namespace.md) — 命名空间

**如果规范与本 skill 冲突，以规范为准**。发现冲突就更新本 skill。

---

## 🎯 五要素 Task 描述规范（核心改进）

prepare 返回的 `task` 字段必须包含以下五个要素，让 AI Agent 无歧义地执行：

| # | 要素 | 说明 | 示例 |
|---|---|---|---|
| 1 | **身份** | 以谁的身份操作 | 以张三的身份 |
| 2 | **入口** | 从哪里开始（页面/按钮） | 进入「我的」→「地址管理」/ 首页搜索 |
| 3 | **具体动作** | 点击什么、输入什么 | 点击底部「立即购买」按钮 |
| 4 | **目标值** | 精确文字/数字/选项 | 输入「你好，这个硬盘能装PS5吗？」 |
| 5 | **完成标志** | 最终确认动作 | 并点击发送 / 确认支付 / 点击保存 |

### 各模块 task 示例

#### 搜索模块 (search)
```ruby
task: '以张三的身份，点击首页顶部的搜索框，输入「耳机」两个字，然后点击搜索按钮或按回车键执行搜索'
hint: '首页顶部搜索框 → 点击进入搜索页面 → 输入「耳机」→ 点击搜索/回车'
```

#### 评论模块 (comment)
```ruby
task: '以张三的身份，在首页或通过搜索找到「自用iPhone 14 128G 白色 换机出 电池88%」帖子，进入详情页，在底部评论输入框中输入「电池88%实际续航怎么样？」并点击发送按钮提交评论'
hint: '首页/搜索找到帖子 → 点击进入详情 → 底部评论输入框 → 输入评论 → 点击发送'
```

#### 私信模块 (message)
```ruby
task: '以张三的身份，在首页或通过搜索找到「三星 990 Pro 2TB NVMe M.2 固态硬盘 全新盒装」帖子，进入详情页，点击底部「私信」按钮，在聊天页面输入「你好，这个硬盘能装PS5吗？」并发送'
hint: '首页/搜索找到帖子 → 进入详情 → 点击底部「私信」按钮 → 输入消息 → 发送'
```

#### 下单模块 (order)
```ruby
task: '以张三的身份，在首页或通过搜索找到「三星 990 Pro 2TB NVMe M.2 固态硬盘 全新盒装」帖子，进入详情页，点击底部「立即购买」按钮，在订单确认页选择收货地址，选择「支付宝」支付方式，点击「确认支付」完成下单'
hint: '首页/搜索 → 进入帖子详情 → 底部「立即购买」→ 选地址 → 选支付宝 → 确认支付'
```

#### 收藏/蹲蹲模块 (favorite / like)
```ruby
task: '以张三的身份，在首页或通过搜索找到「索尼 WH-1000XM5 降噪耳机 国行带发票」帖子，进入详情页，点击底部「收藏」按钮收藏该帖子'
hint: '首页/搜索找到帖子 → 进入详情 → 点击底部「收藏」按钮'
```

#### 地址模块 (address)
```ruby
task: '以张三的身份，进入「我的」页面，点击「地址管理」，点击「新增地址」按钮，依次填写：收货人「张三」、手机号「13800138000」、选择地区「广东省」→「深圳市」→「南山区」、详细地址「科技园南路88号」，然后点击「保存」按钮'
hint: '我的 → 地址管理 → 新增地址 → 填写各项信息 → 保存'
```

#### 用户模块 (user)
```ruby
task: '以张三的身份，进入「我的」页面，点击「编辑资料」，将昵称修改为「小龙虾张三」，然后点击「保存」按钮'
hint: '我的 → 编辑资料 → 修改昵称 → 保存'
```

---

## Validator 完整结构模板

```ruby
# frozen_string_literal: true

# 验证用例 v001_comment: 给帖子添加评论
#
# 任务描述:
#   张三看到一个自用iPhone 14的帖子，想留言询问电池实际续航情况。
#   Agent 需要完成以下操作：
#   1. 找到标题为"自用iPhone 14 128G 白色 换机出 电池88%"的帖子
#   2. 在帖子下添加一条评论
#   3. 评论内容为"电池88%实际续航怎么样？"
#
# 复杂度分析:
#   1. 需要定位到基线数据中的帖子（data_version='0'）
#   2. 创建 Comment 记录并关联到正确的 User 和 Post
#
# 评分标准:
#   - 评论已创建 (35分)
#   - 评论内容正确 (35分)
#   - 评论关联了正确用户 (30分)
#   总分：100分
#
# 规范参考：
#   docs/conventions/validator-writing.md

class Validators::Comment::V001CommentValidator < Validators::BaseValidator
  self.validator_id   = 'comment/v001_comment_validator'
  self.task_id        = '83d30de9-e233-4e8d-b70c-ae5c24b593fb'
  self.title           = '在"自用iPhone 14 128G 白色 换机出 电池88%"帖子里，以张三的身份添加评论'
  self.timeout_seconds = 120

  def prepare
    @user = User.find_by!(email: 'zhangsan@example.com', data_version: '0')
    @post = Post.find_by!(title: '自用iPhone 14 128G 白色 换机出 电池88%', data_version: '0')

    {
      task: '以张三的身份，在首页或通过搜索找到「自用iPhone 14 128G 白色 换机出 电池88%」帖子，进入详情页，在底部评论输入框中输入「电池88%实际续航怎么样？」并点击发送按钮提交评论',
      hint: '首页/搜索找到帖子 → 点击进入详情 → 底部评论输入框 → 输入评论 → 点击发送'
    }
  end

  # 跨请求状态持久化（ADR-006）
  def execution_state_data
    {
      user_id: @user.id,
      post_id: @post.id
    }
  end

  # 从持久化状态恢复实例变量
  def restore_from_state(data)
    @user = User.find(data['user_id'])
    @post = Post.find(data['post_id'])
  end

  def verify
    add_assertion '评论已创建', weight: 35 do
      @comment = Comment.where(user_id: user_ids_for(@user), post: @post, data_version: @data_version)
                        .order(created_at: :desc).first
      expect(@comment).not_to be_nil, '未找到张三在帖子下的评论'
    end

    return if @comment.nil?

    add_assertion '评论内容正确', weight: 35 do
      expect(@comment.content).to eq('电池88%实际续航怎么样？'),
        "预期评论内容'电池88%实际续航怎么样？'，实际'#{@comment.content}'"
    end

    add_assertion '评论关联了正确用户', weight: 30 do
      expect(@comment.user_id).to be_in(user_ids_for(@user)),
        "预期 user_id 在 #{user_ids_for(@user)} 中，实际 #{@comment.user_id}"
    end
  end

  def simulate
    Comment.create!(
      user: @user,
      post: @post,
      content: '电池88%实际续航怎么样？'
    )
  end
end
```

---

## 🔑 IdleSwap 专属硬规则（违反 = 代码废）

### 1. 命名空间必须是 `Validators::{Module}::V{NNN}{Module}Validator`

```ruby
# ✅ 正确
class Validators::Comment::V001CommentValidator < Validators::BaseValidator
  self.validator_id = 'comment/v001_comment_validator'

# ❌ 错：污染 Comment 模型命名空间
class Comment::V001CommentValidator < BaseValidator

# ❌ 错：Zeitwerk 找不到文件
class V001CommentValidator < BaseValidator
```

### 2. 不需要 require_relative

Zeitwerk 根据命名空间和文件路径自动加载。

```ruby
# ❌ 多余
require_relative '../base_validator'

# ✅ 什么都不写，直接声明 class
```

### 3. validator_id 带模块前缀

```ruby
# ✅ 正确
self.validator_id = 'comment/v001_comment_validator'

# ❌ 错
self.validator_id = 'v001_comment_validator'
```

### 4. data_version 永远是字符串

```ruby
# ✅ 正确
User.find_by!(email: 'zhangsan@example.com', data_version: '0')

# ❌ 错（data_version 是 string 类型）
User.find_by!(email: 'zhangsan@example.com', data_version: 0)
```

### 5. simulate 不传 data_version（让 DataVersionable 自动处理）

`execute_prepare` 已执行 `SET SESSION app.data_version = @data_version`，`before_create :set_data_version` 自动从 PostgreSQL session 变量读取。

```ruby
# ✅ 正确：让 DataVersionable 自动处理
def simulate
  Comment.create!(user: @user, post: @post, content: '测试')
end

# ❌ 冗余（虽然不会报错，但不推荐）
def simulate
  Comment.create!(user: @user, post: @post, content: '测试', data_version: @data_version)
end

# ❌ 致命：污染 baseline
def simulate
  Comment.create!(user: @user, post: @post, content: '测试', data_version: '0')
end
```

### 6. verify 查询用 `user_ids_for(@user)` 兼容 sandbox user

IdleSwap 的认证系统可能创建 sandbox user（与 baseline user 同 email，不同 data_version）。verify 中查询 user 相关记录时必须同时覆盖 baseline user 和 sandbox user 的 id。

```ruby
# ✅ 正确：兼容 baseline 和 sandbox user
Comment.where(user_id: user_ids_for(@user), post: @post, data_version: @data_version)

# ❌ 可能漏掉 sandbox user 创建的记录
Comment.where(user: @user, post: @post, data_version: @data_version)
```

`user_ids_for` 是 BaseValidator 的 helper：返回 `[sandbox_user_id, baseline_user_id]` 数组。

### 7. 必须实现 execution_state_data + restore_from_state（ADR-006）

**prepare 和 verify 是两次独立 HTTP 请求**，实例变量不共享。必须通过显式持久化传递状态。

```ruby
# ✅ 完整模式
def execution_state_data
  { user_id: @user.id, post_id: @post.id }
end

def restore_from_state(data)
  @user = User.find(data['user_id'])
  @post = Post.find(data['post_id'])
end
```

### 8. Guard clause 必须有

```ruby
add_assertion '帖子存在', weight: 25 do
  @post = Post.where(user_id: user_ids_for(@user), data_version: @data_version).first
  expect(@post).not_to be_nil
end

return if @post.nil?   # ← 没这行，下面断言会 NPE
```

### 9. Assertion 权重总和 = 100

### 10. 过滤 vs 断言分离

```ruby
# ❌ 坏：属性塞进 where，只能判"有/无"
posts = Post.where(user_id: user_ids_for(@user), title: '二手iPhone 15', data_version: @data_version)

# ✅ 好：where 只锁 scope，断言独立
@post = Post.where(user_id: user_ids_for(@user), data_version: @data_version)
            .order(created_at: :desc).first
add_assertion '标题正确', weight: 15 do
  expect(@post.title).to eq('二手iPhone 15'), "预期'二手iPhone 15'，实际'#{@post.title}'"
end
```

---

## 目录结构

```
app/validators/
├── base_validator.rb              ← 框架，不要改
├── support/data_packs/v1/         ← baseline 数据源（不归 skill 管）
│
├── post/                          ← 发布、编辑闲置商品
├── order/                         ← 下单、支付、订单状态
├── comment/                       ← 评论
├── favorite/                      ← 收藏
├── like/                          ← 蹲蹲（点赞）
├── message/                       ← 私信 / 聊天
├── user/                          ← 用户资料
├── address/                       ← 收货地址
└── search/                        ← 搜索
```

---

## 命名规则

| 项 | 格式 | 示例 |
|---|---|---|
| 目录 | `{module}/` | `comment/` |
| 文件名 | `v{NNN}_{module}_validator.rb` | `v001_comment_validator.rb` |
| 类名 | `Validators::{Module}::V{NNN}{Module}Validator` | `Validators::Comment::V001CommentValidator` |
| `validator_id` | `{module}/v{NNN}_{module}_validator` | `comment/v001_comment_validator` |
| 编号 | 三位数字，模块内递增 | `001`, `002`, `003` |

---

## IdleSwap 业务模块表

| 模块 | 用途 | 典型任务 | 涉及模型 |
|---|---|---|---|
| `post` | 发布、编辑闲置商品 | "发布一个二手iPhone" | Post, Category, Brand |
| `order` | 下单、支付、订单状态 | "购买商品，选支付宝付款" | Order, Post, Address |
| `comment` | 商品评论 | "给帖子写一条评论" | Comment, Post |
| `favorite` | 收藏帖子 | "收藏这个商品" | Favorite, Post |
| `like` | 蹲蹲（点赞） | "蹲蹲这个帖子" / "取消蹲蹲" | Like, Post |
| `message` | 私信聊天 | "给卖家发一条私信" | Conversation, Message, Post |
| `user` | 用户资料修改 | "修改昵称" / "更新头像" | User |
| `address` | 收货地址管理 | "新增深圳收货地址" | Address |
| `search` | 搜索商品 | "搜索「耳机」" / "搜索后进入详情" | Post |

---

## 可用 baseline 数据（固定身份，生成 validator 时直接用）

| 类型 | 查询方式 |
|---|---|
| Demo 用户 | `User.find_by!(email: 'zhangsan@example.com', data_version: '0')`（密码 `password123`） |
| 其他用户 | `User.find_by!(email: 'lisi@example.com', data_version: '0')` |
| Categories | `Category.where(data_version: '0')` |
| Brands | `Brand.where(data_version: '0')` |
| Posts (baseline) | `Post.where(data_version: '0')` |
| Addresses (baseline) | `Address.where(data_version: '0')` — 张三有默认地址 |

**注意**：baseline 里已有 Order、Comment、Favorite、Like、Conversation、Message 可能存在也可能不存在，具体看 data_packs。simulate 中创建时不传 data_version。

---

## 技能执行流程（Skill Execution Flow）

### Step 1：解析输入

用户输入形如：
```
生成 validator: [任务描述], 模块 [module_name], 编号 [number]
```

- **任务描述**（必需）：`给张三发布一个二手iPhone`
- **模块名**（可选，默认自动推断）
- **编号**（可选，默认自动分配）

自动推断模块规则：
- 含"发布/编辑/帖子/商品" → `post`
- 含"下单/订单/购买/支付" → `order`
- 含"评论/留言" → `comment`
- 含"收藏" → `favorite`
- 含"蹲蹲/点赞" → `like`
- 含"私信/消息/聊天" → `message`
- 含"搜索" → `search`
- 含"地址/收货" → `address`
- 含"昵称/头像/资料/签名" → `user`

### Step 2：分配编号

扫描 `app/validators/{module}/` 目录，找到最大编号 +1：

```bash
ls app/validators/{module}/v*_{module}_validator.rb 2>/dev/null | sort | tail -1
```

冲突时自动递增。

### Step 3：收集信息（询问或推断）

1. **title**（一句话概括）：给/帮 [受益人] + 动词 + 核心目标
2. **task**（五要素完整描述）：身份 → 入口 → 动作 → 目标值 → 完成
3. **hint**（简化路径提示）：用 → 连接每一步
4. **涉及模型**：这个任务会读/写哪些表？
5. **验证断言**：2-4 条断言，权重总和 100
6. **timeout_seconds**：简单 60-120s，中等 120-180s，复杂 180-300s

### Step 4：生成文件

1. 读本 skill 的模板规范
2. 生成完整 validator 文件
3. 写到 `app/validators/{module}/v{NNN}_{module}_validator.rb`
4. 如果目录不存在，先 `mkdir -p`
5. task_id 用 `ruby -rsecurerandom -e 'puts SecureRandom.uuid'` 生成

### Step 5：自检

```bash
ruby -c app/validators/{module}/v{NNN}_{module}_validator.rb
bin/rails runner "Validators::{Module}::V{NNN}{Module}Validator"
```

如果有错误，**修掉再交付**。

### Step 6：汇报

告诉用户：
- 生成了哪个文件
- validator_id / task_id
- 权重分布
- task 五要素描述
- 是否通过语法检查

---

## 反模式速查（见到就停手）

```ruby
# ❌ 反例 A：类名不在 Validators 命名空间
class V001PostValidator < BaseValidator

# ❌ 反例 B：加了 require_relative
require_relative '../base_validator'

# ❌ 反例 C：validator_id 缺模块前缀
self.validator_id = 'v001_post_validator'

# ❌ 反例 D：simulate 里传 data_version
def simulate
  Post.create!(user: @user, title: 'xxx', data_version: @data_version)
end

# ❌ 反例 E：simulate 里传 '0' 污染 baseline
def simulate
  Post.create!(user: @user, data_version: '0')
end

# ❌ 反例 F：verify 里 user 查询不用 user_ids_for
def verify
  @post = Post.where(user: @user, data_version: @data_version).first
end

# ❌ 反例 G：没有 execution_state_data / restore_from_state
# → verify 在跨请求时读不到 @user 等实例变量

# ❌ 反例 H：task 描述模糊（没有操作路径）
task: '给张三发布一个帖子'
# ✅ 应改为
task: '以张三的身份，点击底部「发布」按钮，选择分类「手机」，填写标题「二手iPhone 15」、价格「4999」、描述「九成新」，点击「发布」完成'

# ❌ 反例 I：prepare 里创建数据（应放 seed）
def prepare
  Address.create!(user: @user, city: '深圳')  # 迁移到 seed
end

# ❌ 反例 J：data_version 用整数
User.find_by!(email: '...', data_version: 0)  # 应是 '0'
```

---

## 完整示例：从需求到文件

**用户输入**：
```
生成 validator：给张三在"三星固态硬盘"帖子下发一条私信问能不能包邮
```

**执行过程**：

1. 自动推断模块 = `message`（含"私信"）
2. 扫描已有编号 → 下一个 = `005`
3. 生成 UUID → `a1b2c3d4-...`

**生成文件**：`app/validators/message/v005_message_validator.rb`

```ruby
# frozen_string_literal: true

# 验证用例 v005_message: 给三星固态硬盘卖家发私信询问包邮
#
# 任务描述:
#   张三看中了三星固态硬盘，想私信卖家问能不能包邮。
#   Agent 需要完成以下操作：
#   1. 找到「三星 990 Pro 2TB NVMe M.2 固态硬盘 全新盒装」帖子
#   2. 进入详情页点击私信按钮
#   3. 发送消息「你好，请问能包邮吗？」
#
# 复杂度分析:
#   1. 需要定位 baseline 帖子
#   2. 需要走完私信发送流程
#   3. 需要创建 Conversation + Message
#
# 评分标准:
#   - 消息已创建 (30分)
#   - 消息内容正确 (30分)
#   - 消息在正确的对话中 (25分)
#   - 消息发送者为张三 (15分)
#   总分：100分
#
# 规范参考：
#   docs/conventions/validator-writing.md

class Validators::Message::V005MessageValidator < Validators::BaseValidator
  self.validator_id    = 'message/v005_message_validator'
  self.task_id         = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  self.title           = '以张三的身份，给「三星 990 Pro 2TB NVMe M.2 固态硬盘 全新盒装」帖子的卖家发私信'
  self.timeout_seconds = 150

  MSG_CONTENT = '你好，请问能包邮吗？'

  def prepare
    @user = User.find_by!(email: 'zhangsan@example.com', data_version: '0')
    @post = Post.find_by!(title: '三星 990 Pro 2TB NVMe M.2 固态硬盘 全新盒装', data_version: '0')
    @seller = @post.user

    {
      task: '以张三的身份，在首页或通过搜索找到「三星 990 Pro 2TB NVMe M.2 固态硬盘 全新盒装」帖子，进入详情页，点击底部「私信」按钮，在聊天页面输入「你好，请问能包邮吗？」并发送',
      hint: '首页/搜索找到帖子 → 进入详情 → 点击底部「私信」按钮 → 输入消息 → 发送'
    }
  end

  def execution_state_data
    {
      user_id: @user.id,
      post_id: @post.id,
      seller_id: @seller.id
    }
  end

  def restore_from_state(data)
    @user   = User.find(data['user_id'])
    @post   = Post.find(data['post_id'])
    @seller = User.find(data['seller_id'])
  end

  def verify
    add_assertion '消息已创建', weight: 30 do
      @message = Message.where(sender_id: user_ids_for(@user), data_version: @data_version)
                        .order(created_at: :desc).first
      expect(@message).not_to be_nil, '未找到张三发送的私信'
    end

    return if @message.nil?

    add_assertion '消息内容正确', weight: 30 do
      expect(@message.content).to eq(MSG_CONTENT),
        "预期消息内容'#{MSG_CONTENT}'，实际'#{@message.content}'"
    end

    add_assertion '消息在正确的对话中', weight: 25 do
      conversation = @message.conversation
      expect(conversation).not_to be_nil
      participant_ids = [conversation.buyer_id, conversation.seller_id]
      expect(participant_ids).to include(@seller.id),
        "对话参与者应包含卖家 #{@seller.id}"
    end

    add_assertion '消息发送者为张三', weight: 15 do
      expect(@message.sender_id).to be_in(user_ids_for(@user)),
        "预期发送者 ID 在 #{user_ids_for(@user)} 中，实际 #{@message.sender_id}"
    end
  end

  def simulate
    conversation = Conversation.find_or_create_by!(
      post: @post,
      buyer: @user,
      seller: @seller
    )
    Message.create!(
      conversation: conversation,
      sender: @user,
      content: MSG_CONTENT
    )
  end
end
```

---

## Task UUID

每个 validator 的 `self.task_id` 需要一个唯一 UUID：

```bash
ruby -rsecurerandom -e 'puts SecureRandom.uuid'
```

Skill 生成时直接写入固定值，**不要**用 `SecureRandom.uuid` 作为运行时值。

---

## 会话结束 Checklist

生成完后：
- [ ] `ruby -c` 语法检查通过
- [ ] `bin/rails runner "Validators::{Module}::V{NNN}{Module}Validator"` 类能加载
- [ ] 如果有条件，`rake validator:lint` 通过
- [ ] 如果有条件，`execute_simulate` 试跑返回 passed
