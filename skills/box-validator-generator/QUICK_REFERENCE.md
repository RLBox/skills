# Validator Generator 快速参考（IdleSwap 闲时换版 v2）

## 命令格式

```
生成 validator: [任务描述], 模块 [module_name], 编号 [number]
```

- **任务描述**（必需）：用自然语言描述 Agent 要完成的任务
- **模块名**（可选）：业务模块，默认自动推断
- **编号**（可选）：手动指定，默认按模块自动分配

## 命名规则速查

| 项 | 格式 | 示例 |
|---|---|---|
| 目录 | `{module}/` | `comment/` |
| 文件名 | `v{NNN}_{module}_validator.rb` | `v001_comment_validator.rb` |
| 类名 | `Validators::{Module}::V{NNN}{Module}Validator` | `Validators::Comment::V001CommentValidator` |
| validator_id | `{module}/v{NNN}_{module}_validator` | `comment/v001_comment_validator` |
| 编号 | 三位数字 | `001`, `002`, `003` |

## 业务模块表

| 模块 | 用途 | 典型任务 |
|---|---|---|
| `post` | 发布、编辑闲置商品 | "发布二手iPhone" / "修改帖子价格" |
| `order` | 下单、支付 | "购买商品" / "使用支付宝付款" |
| `comment` | 评论 | "给帖子写评论" |
| `favorite` | 收藏 | "收藏商品" / "取消收藏" |
| `like` | 蹲蹲（点赞） | "蹲蹲帖子" / "取消蹲蹲" |
| `message` | 私信 / 聊天 | "给卖家发私信" |
| `user` | 用户资料 | "修改昵称" / "修改常住地" |
| `address` | 收货地址 | "添加深圳收货地址" |
| `search` | 搜索 | "搜索「耳机」" / "搜索后进详情" |

## 🎯 五要素 Task 描述（核心）

prepare 返回的 task 必须包含：

| # | 要素 | 描述 |
|---|---|---|
| 1 | 身份 | 以张三的身份 |
| 2 | 入口 | 从哪里开始操作 |
| 3 | 动作 | 具体点击/输入什么 |
| 4 | 目标值 | 精确的文字/数字/选项 |
| 5 | 完成 | 最终确认按钮 |

### 各模块 task 模板

```ruby
# 搜索
task: '以张三的身份，点击首页顶部的搜索框，输入「{关键词}」，然后点击搜索按钮执行搜索'

# 评论
task: '以张三的身份，在首页或通过搜索找到「{帖子标题}」帖子，进入详情页，在底部评论输入框中输入「{评论内容}」并点击发送按钮提交评论'

# 私信
task: '以张三的身份，在首页或通过搜索找到「{帖子标题}」帖子，进入详情页，点击底部「私信」按钮，在聊天页面输入「{消息内容}」并发送'

# 下单
task: '以张三的身份，在首页或通过搜索找到「{帖子标题}」帖子，进入详情页，点击底部「立即购买」按钮，在订单确认页选择收货地址，选择「{支付方式}」支付方式，点击「确认支付」完成下单'

# 收藏
task: '以张三的身份，在首页或通过搜索找到「{帖子标题}」帖子，进入详情页，点击底部「收藏」按钮收藏该帖子'

# 蹲蹲
task: '以张三的身份，在首页或通过搜索找到「{帖子标题}」帖子，进入详情页，点击底部「蹲一蹲」按钮'

# 地址
task: '以张三的身份，进入「我的」页面，点击「地址管理」，点击「新增地址」按钮，依次填写：收货人「{姓名}」、手机号「{手机}」、选择地区「{省}」→「{市}」→「{区}」、详细地址「{详细地址}」，然后点击「保存」按钮'

# 用户资料
task: '以张三的身份，进入「我的」页面，点击「编辑资料」，将{字段}修改为「{新值}」，然后点击「保存」按钮'
```

## 文件骨架

```ruby
# frozen_string_literal: true

# 验证用例 v001_comment: 给帖子添加评论
# [头部注释省略]

class Validators::Comment::V001CommentValidator < Validators::BaseValidator
  self.validator_id    = 'comment/v001_comment_validator'
  self.task_id         = '固定-UUID'
  self.title           = '以张三的身份，给帖子添加评论'
  self.timeout_seconds = 120

  def prepare
    @user = User.find_by!(email: 'zhangsan@example.com', data_version: '0')
    @post = Post.find_by!(title: '...', data_version: '0')
    { task: '以张三的身份，...（五要素）', hint: '...' }
  end

  def execution_state_data
    { user_id: @user.id, post_id: @post.id }
  end

  def restore_from_state(data)
    @user = User.find(data['user_id'])
    @post = Post.find(data['post_id'])
  end

  def verify
    add_assertion '评论已创建', weight: 35 do
      @comment = Comment.where(user_id: user_ids_for(@user), post: @post, data_version: @data_version)
                        .order(created_at: :desc).first
      expect(@comment).not_to be_nil
    end

    return if @comment.nil?  # guard clause

    add_assertion '内容正确', weight: 35 do
      expect(@comment.content).to eq('预期内容')
    end

    add_assertion '用户正确', weight: 30 do
      expect(@comment.user_id).to be_in(user_ids_for(@user))
    end
  end

  def simulate
    # 不传 data_version！DataVersionable 自动处理
    Comment.create!(user: @user, post: @post, content: '预期内容')
  end
end
```

## 硬规则速查（违反 = 重写）

| # | 规则 | ✅ 正确 | ❌ 错误 |
|---|---|---|---|
| 1 | 命名空间 | `Validators::Post::V001PostValidator` | `V001PostValidator` |
| 2 | 继承 | `< Validators::BaseValidator` | `< BaseValidator` |
| 3 | 不要 require | 什么都不写 | `require_relative '../base_validator'` |
| 4 | validator_id 带模块 | `'post/v001_post_validator'` | `'v001_post_validator'` |
| 5 | data_version 是字符串 | `data_version: '0'` | `data_version: 0` |
| 6 | simulate 不传 dv | `Post.create!(user: @user)` | `Post.create!(data_version: @data_version)` |
| 7 | verify 用 user_ids_for | `.where(user_id: user_ids_for(@user))` | `.where(user: @user)` |
| 8 | 必须有状态持久化 | `execution_state_data` + `restore_from_state` | 省略 |
| 9 | Guard clause | `return if @record.nil?` | 省略导致 NPE |
| 10 | 权重总和 = 100 | `35 + 35 + 30 = 100` | `30 + 40 = 70` |
| 11 | task 五要素 | 身份→入口→动作→目标→完成 | 模糊描述 |

## Baseline 数据速查

| 类型 | 查询 |
|---|---|
| Demo 用户 | `User.find_by!(email: 'zhangsan@example.com', data_version: '0')` |
| 其他用户 | `User.find_by!(email: 'lisi@example.com', data_version: '0')` |
| 分类 | `Category.where(data_version: '0')` |
| 品牌 | `Brand.where(data_version: '0')` |
| 帖子 | `Post.where(data_version: '0')` |
| 地址 | `Address.where(user: @user, data_version: '0')` |
