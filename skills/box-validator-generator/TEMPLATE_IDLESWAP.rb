# frozen_string_literal: true

# 验证用例 v{NUMBER}_{MODULE}: {BRIEF_TITLE}
#
# 任务描述:
#   {SCENARIO_DESCRIPTION}
#   Agent 需要完成以下操作：
#   1. {STEP_1}
#   2. {STEP_2}
#   3. {STEP_3}
#
# 复杂度分析:
#   1. {COMPLEXITY_POINT_1}
#   2. {COMPLEXITY_POINT_2}
#   3. {COMPLEXITY_POINT_3}
#
# 评分标准:
#   - {ASSERTION_1_DESCRIPTION} ({WEIGHT_1}分)
#   - {ASSERTION_2_DESCRIPTION} ({WEIGHT_2}分)
#   - {ASSERTION_3_DESCRIPTION} ({WEIGHT_3}分)
#   总分：100分
#
# 规范参考：
#   docs/conventions/validator-writing.md

class Validators::{MODULE_CLASS}::V{NUMBER_INT}{MODULE_CLASS}Validator < Validators::BaseValidator
  self.validator_id    = '{MODULE}/v{NUMBER}_{MODULE}_validator'
  self.task_id         = '{TASK_UUID}'
  self.title           = '{TITLE_ONE_LINER}'
  self.timeout_seconds = {TIMEOUT}

  # -------------------------------------------------------------------
  # （可选）题目私有预制数据
  # - 在 prepare 之前执行，SET SESSION app.data_version 已经设置好
  # - 新建记录自动带 data_version（DataVersionable），不会污染 baseline
  # - 只在"Agent 任务起点需要数据"时使用（例如帖子已有 2 条评论，让 Agent 去加第 3 条）
  # -------------------------------------------------------------------
  # def seed
  #   Comment.create!(user: @user, post: @post, content: '已有评论')
  # end

  # -------------------------------------------------------------------
  # prepare: 只查 baseline，设置实例变量，返回任务 Hash
  # - 禁止 create!（属于 simulate / seed 阶段）
  # - 所有 baseline 查询必须带 data_version: '0'
  # - task 遵循五要素：身份 → 入口 → 动作 → 目标值 → 完成
  # -------------------------------------------------------------------
  def prepare
    @user = User.find_by!(email: 'zhangsan@example.com', data_version: '0')
    # @post = Post.find_by!(title: '{POST_TITLE}', data_version: '0')

    {
      task: '以张三的身份，{入口描述}，{具体动作}，{目标值}{完成标志}',
      hint: '{步骤1} → {步骤2} → {步骤3} → {步骤4}'
    }
  end

  # -------------------------------------------------------------------
  # execution_state_data: 声明需要跨请求持久化的状态（ADR-006）
  # - prepare 和 verify 是两次独立 HTTP 请求，实例变量不共享
  # - 框架会将此 Hash 存到 validator_executions.state
  # -------------------------------------------------------------------
  def execution_state_data
    {
      user_id: @user.id
      # post_id: @post.id,
      # expected_amount: @expected_amount
    }
  end

  # -------------------------------------------------------------------
  # restore_from_state: 从持久化状态恢复实例变量
  # - verify 阶段新实例会调此方法
  # - 每个 execution_state_data 返回的 key 都要在这里恢复
  # -------------------------------------------------------------------
  def restore_from_state(data)
    @user = User.find(data['user_id'])
    # @post = Post.find(data['post_id'])
    # @expected_amount = data['expected_amount'].to_f
  end

  # -------------------------------------------------------------------
  # verify: 用 add_assertion 验证 Agent 的操作结果
  # - 权重总和 = 100
  # - 查询必须带 data_version: @data_version
  # - user 相关查询用 user_ids_for(@user) 兼容 sandbox user
  # - 用 guard clause 防止 NPE
  # -------------------------------------------------------------------
  def verify
    # === 第 1 组：核心存在性断言 ===
    add_assertion '{ASSERTION_1_DESCRIPTION}', weight: {WEIGHT_1} do
      @record = {MODEL}.where(user_id: user_ids_for(@user), data_version: @data_version)
                       .order(created_at: :desc).first
      expect(@record).not_to be_nil, '{FAILURE_MESSAGE_1}'
    end

    return if @record.nil?   # guard clause

    # === 第 2 组：属性正确性断言 ===
    add_assertion '{ASSERTION_2_DESCRIPTION}', weight: {WEIGHT_2} do
      expect(@record.{ATTRIBUTE}).to eq('{EXPECTED_VALUE}'),
        "预期 '{EXPECTED_VALUE}'，实际 '#{@record.{ATTRIBUTE}}'"
    end

    # === 第 3 组：业务逻辑断言 ===
    add_assertion '{ASSERTION_3_DESCRIPTION}', weight: {WEIGHT_3} do
      expect(@record.{ATTRIBUTE_2}).to eq({EXPECTED_VALUE_2}),
        "预期 {EXPECTED_VALUE_2}，实际 #{@record.{ATTRIBUTE_2}}"
    end
  end

  # -------------------------------------------------------------------
  # simulate: 模拟 AI Agent 的正确操作（用于自动化回归测试）
  # - 不传 data_version！DataVersionable 自动从 SESSION 变量读取
  # - 不要写 data_version: '0'（污染 baseline）
  # - 不要手动 SET SESSION（base_validator 已做过）
  # -------------------------------------------------------------------
  def simulate
    {MODEL}.create!(
      user: @user,
      {ATTRIBUTE}: '{EXPECTED_VALUE}'
    )
  end
end
