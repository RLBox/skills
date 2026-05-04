---
name: box-brainstorming
description: "You MUST use this before any creative work - creating features, building components, adding functionality, or modifying behavior. Explores user intent, requirements and design before implementation."
---

# Brainstorming Ideas Into Designs

Turn ideas into fully formed designs through autonomous analysis. The agent does the thinking; the human approves the result.

**Default mode: autonomous.** Explore the codebase, form your own opinions, draft the full design, then present it for a single approval. Do not ask the user questions unless you genuinely cannot make a reasonable assumption.

<HARD-GATE>
Do NOT invoke any implementation skill, write any code, scaffold any project, or take any implementation action until you have presented a design and the user has approved it.
</HARD-GATE>

## Anti-Pattern: "This Is Too Simple To Need A Design"

Every project goes through this process. A todo list, a single-function utility, a config change — all of them. The design can be short (a few sentences), but you MUST present it and get approval before implementing.

## Anti-Pattern: "I Need To Ask Before I Can Think"

Do NOT open with a series of clarifying questions. Explore the codebase first. Read docs, recent commits, existing patterns. Form your own answers. Only ask if you hit a genuine blocker that you cannot reasonably assume away. Most of the time you won't need to ask anything.

---

## How It Works

### Step 1 — Explore silently

Before saying anything to the user, do all of this yourself:

- Read relevant files, docs, recent commits
- Understand what already exists and what the request touches
- Identify scope: is this one coherent feature, or multiple independent subsystems?
  - If multiple subsystems: propose a decomposition and ask the user which to start with (this is the ONE allowed upfront question for large scope)
- Form opinions on approach — pick the best one and be ready to justify it

No message to the user yet.

### Step 2 — Draft the full design internally

Still no message. Write the full design in your head (or scratchpad):

- What the feature does
- How the main pieces relate
- How data flows between them
- What happens when things go wrong
- How success is measured
- Which approach you recommend and why
- If the project has `app/validators/`: draft acceptance scenarios

Keep everything at the **concept level** — what and why, not how. See "Concept Level Rule" below.

### Step 3 — Present everything in one message

Send ONE message that contains:

1. **Your understanding** — "Here's what I think you're building: …" (1-2 sentences)
2. **Approach chosen** — brief note on what you picked and why (skip the alternatives unless the tradeoff is genuinely important for the user to know)
3. **Full design** — all sections, scaled to complexity
4. **Acceptance scenarios** — if the project has `app/validators/`
5. **Assumptions** — list any significant assumptions you made; invite correction
6. **The ask** — "Does this look right? Any changes before I write the spec and plan?"

This is the **single human decision point**. Everything before this is agent work.

### Step 4 — Incorporate feedback (if any) and write the spec

If the user approves with no changes → write spec immediately, then invoke `box-writing-plans`.

If the user requests changes → apply them, update the design in the same thread, confirm the change, then write spec and invoke `box-writing-plans`.

Do NOT ask a follow-up "does this look right now?" loop. Make the change and proceed unless the user says stop.

---

## Concept Level Rule

The design step is about *what* the system does and *why*, not *how* it's built.

- ✅ "商品和内容帖子是多对多关系，一个帖子可以挂多个商品，一个商品也可以出现在多个帖子里"
- ✅ "搜索时同时匹配帖子本身的文字和它挂载的商品名称"
- ❌ "需要一个 feed_products 中间表，包含 feed_id, product_id, position 字段"
- ❌ "`has_many :products, through: :feed_products`"
- ❌ "scope 会 LEFT JOIN feed_products + products，ILIKE 同时匹配"

No table schemas, no field names, no method names, no SQL, no code snippets. Those belong in the implementation plan.

---

## When You CAN Ask Questions

Asking is the exception, not the default. You may ask when:

- **Scope is genuinely ambiguous** and the two interpretations lead to completely different designs (e.g., "is this a user-facing feature or an admin tool?")
- **A key constraint is unknown** and you cannot safely assume it (e.g., "does this need to work offline?")
- **The request decomposes into multiple independent subsystems** — ask which to start with

When you do ask: ask ONE question. Not a list. Make it multiple-choice when possible.

Do NOT ask about:
- Technical approach choices you can reason about yourself
- Whether to follow existing patterns (always do)
- Details you can infer from the codebase

---

## Writing the Spec

After the user approves the design:

**Where to save:**

```
docs/architecture/   → primary spec location
docs/decisions/      → for Architecture Decision Records (ADRs): "we chose X over Y because..."
docs/superpowers/specs/  → legacy fallback only
```

- New architectural pattern or system-wide decision → ADR in `docs/decisions/ADR-NNN-<topic>.md`
- Everything else → `docs/architecture/YYYY-MM-DD-<topic>-design.md`
- Neither path exists → `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`

**After writing:**

Run a quick self-review before committing:
1. Any TBD/TODO/incomplete sections? Fill them in.
2. Internal contradictions? Resolve them.
3. Scope too large for one plan? Flag and decompose.
4. Anything ambiguous? Pick an interpretation and make it explicit.

Then commit the spec, and immediately invoke `box-writing-plans`.

Do NOT send a "please review the spec file" message to the user. The approval already happened in Step 3. Just write, commit, and proceed.

---

## Validator Acceptance Scenarios

Check if the project has `app/validators/`. If yes, add this section to the spec:

```markdown
## Validator Acceptance Scenarios

> 功能完成后，参照此清单生成 validator 代码（使用 box-validator-generator skill）。

| # | 任务指令（Task） | 验证点 |
|---|---|---|
| 1 | 给张三加购 2 斤有机苹果 | 购物车新增苹果，数量为 2 |
| 2 | 选择 60 天档位礼包并加入星愿之旅活动 | 用户加入活动，档位为 60 天 |
| 3 | 完成首日打卡 | 打卡记录新增 1 条，打卡日期为今天 |
```

### 任务指令（Task）列的写法规则

**本质：这是给 AI Agent 下达的任务，不是测试用例的描述。**

✅ 正确——人类视角，说明要做什么：
- `给张三加购 2 斤有机苹果`
- `从 60 天档位切换到 15 天档位`
- `已满 15 天后，领取一份奖品`
- `同日内再次打卡`（让 Agent 做这件事，observe 结果）

❌ 错误——测试/断言视角，说的是预期结果而非任务指令：
- `同日内尝试重复打卡不应叠加天数`（「不应」是断言，不是任务）
- `仅完成 3/4 个任务，不应计今日打卡`（「不应」是断言，不是任务）
- `验证重复打卡不会叠加`（「验证」是测试语气）
- `检查打卡状态是否正确`（「检查」是测试语气）

**判断标准**：把这句话告诉真人，他知道该做什么吗？
- `给张三加购 2 斤有机苹果` → 真人知道怎么做 ✅
- `同日内尝试重复打卡不应叠加天数` → 真人不知道"做什么" ❌

边界场景（异常路径）的写法——描述操作，把预期写进「验证点」：

| # | 任务指令（Task） | 验证点 |
|---|---|---|
| 4 | 今天已打卡后，再次尝试打卡 | 系统拒绝，打卡天数不变 |
| 5 | 只完成 3 个任务后尝试打卡（共需 4 个） | 系统拒绝，打卡天数不变 |

---

- 3 rows for simple features, up to 8 for complex ones
- Task column: what the user/agent does — human language, no field names/IDs/code/assertions
- 验证点 column: what success looks like — observable outcome, not code assertions
- Skip entirely if no `app/validators/`

---

## Working in Existing Codebases

- Read the codebase before proposing anything. Follow existing patterns.
- Note structural issues at the concept level only — don't surface file names, method names, or schema details in the design.
- Don't propose unrelated refactoring. Stay focused on the current goal.

---

## Visual Companion

When upcoming questions will involve visual content (layouts, diagrams), offer the companion once:

> "Some of what we're working on might be easier to explain visually. I can show mockups, diagrams, and comparisons in a browser as we go. Want to try it?"

**This offer must be its own message.** Wait for response before continuing.

Even after the user accepts, use the browser only for genuinely visual content. Text options, tradeoffs, and conceptual questions go in the terminal.

If they agree, read: `skills/brainstorming/visual-companion.md`

---

## Implementation

After spec is written and committed:

- Invoke `box-writing-plans` to create the implementation plan
- Do NOT invoke any other skill
