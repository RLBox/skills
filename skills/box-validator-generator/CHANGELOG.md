# Changelog - box-validator-generator

## 2026-05-09 - v2 大版本升级（IdleSwap 五要素规范）

### 背景
经过对 40+ 个 validator 的 task 描述全面优化（commit d895afa），总结出 AI Agent 无歧义执行任务的「五要素模式」。本次升级将这些实践经验固化到 skill 中。

### 核心变更

1. **五要素 Task 描述规范**：prepare 返回的 task 必须包含身份、入口、动作、目标值、完成 五个要素
2. **Validators:: 命名空间**：类名改为 `Validators::{Module}::V{NNN}{Module}Validator`
3. **validator_id 带模块前缀**：`'comment/v001_comment_validator'`
4. **移除 require_relative**：Zeitwerk 自动加载，不需要手写
5. **simulate 不传 data_version**：DataVersionable 自动从 SESSION 变量读取
6. **verify 用 user_ids_for()**：兼容 baseline 和 sandbox user
7. **必须实现 execution_state_data + restore_from_state**：ADR-006 跨请求隔离
8. **新增模块**：补充 `search`、`like` 模块
9. **更新 evals**：从 6 个扩展到 8 个，覆盖所有模块类型

### 影响
- SKILL.md 全面重写
- TEMPLATE_IDLESWAP.rb 重写（适配新规范）
- QUICK_REFERENCE.md 重写
- validator_number_helper.rb 增加 `class_name_for`、`validator_id_for` 方法
- evals.json 扩展到 8 个测试场景

---

## 2026-04-28 - Step 0 条件判断优化

### 问题
在 **Step 0: 判断任务类型 → 修改现有 validator** 流程中，第 2 点的条件判断过于宽泛：
- 原逻辑："如果用户只给了 URL/路径但未明确需求 → 先输出信息 → 询问"
- 实际场景：用户给 URL + **已明确业务需求描述**（如"对标沃尔玛，不能改规格"）时，应该直接修改，但原措辞可能让 AI 误认为需要先询问

### 改进
重新组织 Step 0 第 2 步，使分支逻辑更清晰：

**修改前**：
```
2. 如果用户只给了 URL/路径但未明确需求：
   - 先输出信息...
3. 如果用户明确了需求（题目/断言/字段/逻辑）：
   - 精准修改...
```

**修改后**：
```
2. 判断用户是否已明确修改需求：
   - 如果用户已说明要改什么（业务逻辑变更、字段修改、断言调整、题目描述问题等）：
     * 直接跳到第 3 步执行修改
   - 如果用户只给了 URL/路径，没说要改什么：
     * 先输出文件关键信息
     * 主动检查常见问题
     * 询问用户需要修改什么
3. 执行修改（用户需求已明确）：
   - 精准修改对应部分
```

### 效果
- ✅ **明确了判断优先级**：先看用户有没有说要改什么，而不是先看有没有给 URL
- ✅ **避免不必要的询问**：当用户已描述清楚问题时直接执行
- ✅ **保留保护机制**：当用户只给 URL 没说需求时，仍然先输出信息并询问

### 触发场景示例

**场景 A（应直接修改）**：
```
用户：/validator-spec-generator http://localhost:3000/admin/validation_tasks/cart_v002_change_coconut_variant
像这条用例实际上不能改商品规格，只能删除重新选择商品时选择规格加入。沃尔玛就是这样做的，我们对标沃尔玛app
```
→ 用户已明确业务逻辑变更需求，直接执行修改（Step 2.1 → Step 3）

**场景 B（应先询问）**：
```
用户：/validator-spec-generator http://localhost:3000/admin/validation_tasks/order_v001_cancel_paid_order
```
→ 用户只给了 URL，没说要改什么，先输出信息 + 检查问题 + 询问（Step 2.2）

---

## 历史记录

### 2026-04-26 - 初始版本
- 支持按模块分目录生成 validator
- 自动编号、命名空间、data_version 处理
- seed 钩子 + load_refs pattern
- 内置 lint 和 execute_simulate 验证
