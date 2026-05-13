---
name: box-fix
description: Small bug fix workflow with mandatory doc sync. Use when fixing a small, well-understood bug — not a new feature or complex architectural issue. Wraps systematic-debugging → verification → doc sync → commit into one end-to-end flow. Trigger on "fix this bug", "small fix", "quick fix", "box-fix", /fix.
user-invocable: true
---

# Box Fix — Small Bug Complete Workflow

## Overview

Fixing a bug without updating documentation is half a fix. The other half—docs—is what prevents the next person (or the next AI session) from introducing the same bug again.

**Core principle:** Code fix + doc sync + commit. All three. Every time.

**Violating the letter of this process is violating the spirit of it.**

## The Iron Law

```
NO COMMIT WITHOUT VERIFYING BOTH CODE AND DOCS ARE IN SYNC
```

If you haven't checked docs, you haven't finished.

## When to Use

Use `box-fix` for small, contained bugs:
- A function returns the wrong value
- A wrong constant, wrong default, wrong condition
- A single broken validator or rule
- A misnamed method or incorrect reference
- A broken test caused by a prior code change

**Use `box-brainstorming` instead when:**
- You're unsure what the root cause is after initial reading
- The fix requires changing architecture or multiple subsystems
- You need to weigh multiple design tradeoffs
- It's a new feature, not a fix

**When in doubt:** Start with `box-fix`. If Phase 1 reveals the bug is deeper than expected, escalate to `box-brainstorming`.

## The Four Phases

### Phase 1: Root Cause First (via box-systematic-debugging)

**Announce:** "I'm using box-fix → Phase 1: root cause investigation."

Follow `box:systematic-debugging` Phase 1–3 fully:
- Read error messages completely
- Reproduce consistently
- Trace data flow to find WHERE the bug originates
- Form a single hypothesis: "I think X is the root cause because Y"

**Gate:** Do NOT touch any code until root cause is confirmed.

If after investigation the bug turns out to be large/architectural → STOP, report to user, suggest `box-brainstorming`.

### Phase 2: Implement the Fix

Follow `box:systematic-debugging` Phase 4:
1. Write a failing test that captures the bug (if a test framework exists)
2. Make the **smallest possible code change** that fixes the root cause
3. No "while I'm here" improvements — only the fix

Run verification immediately after the fix:
- Re-run the failing test → must now pass
- Run the full test suite → must not regress

If tests fail → return to Phase 1. Do NOT layer more fixes on top.

Announce verification result with actual command output (per `box:verification-before-completion`).

### Phase 3: Doc Sync (THE CRITICAL STEP — DO NOT SKIP)

This is the step that makes `box-fix` different from "just fix the code."

**3a. Identify what docs are affected**

Ask yourself (and check the files):

| Question | Where to look |
|---|---|
| Is there an ADR that governs the pattern you just changed? | `docs/adr/` |
| Is there a CLAUDE.md that describes the module behavior? | `CLAUDE.md`, `docs/CLAUDE.md` |
| Is there a `docs/` page that explains this area? | `docs/` |
| Is there a skill or prompt that references this behavior? | skills directory |
| Is there a rule or anti-pattern list that needs updating? | `SKILL.md`, `RULES.md`, etc. |
| Is there a `FIX.md` or known-issues doc? | project root, `docs/` |

**3b. For each affected doc:**

Option A — **Update the doc** to reflect the fix (most common):
```
Before: "X returns the sum of Y and Z"
After:  "X returns the sum of Y and Z, clamped to [0, max]"
```

Option B — **Add an anti-pattern note** if the bug is easy to re-introduce:
```
⚠️ Anti-pattern: Do NOT use SecureRandom.uuid as self.task_id value.
   Use a hard-coded UUID string generated once. See Task UUID section.
```

Option C — **No doc change needed** — explicitly confirm why:
- The bug was in brand-new code with no existing docs
- The fix is a pure implementation detail with no behavioral change visible outside the module
- You checked all candidate files and none describe this behavior

**You must explicitly report which docs you checked and what action you took for each.**

**3c. Doc sync report format:**

```
📄 Doc Sync Report:
  docs/adr/ADR-012-task-ids.md   → updated: added note about SecureRandom.uuid prohibition
  CLAUDE.md                      → checked: no mention of this module, no update needed
  skills/box-validator-generator → updated: added Rule M + rewrote Task UUID section
```

### Phase 4: Commit (via box-commit)

**Announce:** "I'm using box-fix → Phase 4: commit."

Use `box:commit` to commit code + docs together in one commit (or two if clearly separate concerns). Follow box-commit's noise-detection rules.

Suggested commit format for bug fixes:
```
fix(<scope>): <what was wrong and what you did>
```

Examples:
```
fix(validator): forbid SecureRandom.uuid as task_id — add Rule M
fix(order): clamp quantity to [1, max] instead of allowing negatives
fix(auth): use persisted token instead of regenerating on each request
```

**Do NOT separate the doc update into a standalone `docs:` commit** unless the doc change is completely unrelated to the bug. Docs and code that fix the same bug belong in the same commit.

## Quick Reference

```
Phase 1 → Root cause (box-systematic-debugging phases 1–3)
Phase 2 → Fix + verify (box-systematic-debugging phase 4 + box-verification-before-completion)
Phase 3 → Doc sync (THIS IS THE POINT OF THIS SKILL)
Phase 4 → Commit (box-commit)
```

## Red Flags — STOP

- "I'll update docs later" → Later means never. Do it now.
- "Docs aren't important for a small fix" → Small fixes cause the most doc rot.
- "I checked docs but didn't find anything" → Show your work. List which files you checked.
- "The fix is obvious, no need to document" → If it was obvious, it wouldn't have been a bug.
- Committing without a doc sync report → Phase 3 was skipped.

## Rationalization Prevention

| Excuse | Reality |
|---|---|
| "It's just a small bug" | Small bugs are where doc rot accumulates |
| "No docs exist for this module" | That means the fix IS the documentation — write it |
| "Doc update is trivial, I'll do it in the next PR" | You won't. Do it now, same commit |
| "The code is self-documenting" | Code documents HOW. Docs document WHY and WHAT NOT TO DO |
| "I don't know where the relevant doc is" | Then search: `grep -r "keyword" docs/ CLAUDE.md skills/` |

## Escalation Path

```
bug reported
    │
    ▼
box-fix Phase 1 (root cause)
    │
    ├─ root cause clear, fix is small ──────────────► continue box-fix Phases 2–4
    │
    └─ root cause unclear OR fix requires architecture change
            │
            ▼
        box-brainstorming
```

## Supporting Skills Referenced

- **`box:systematic-debugging`** — Phase 1 & 2 (root cause + fix implementation)
- **`box:verification-before-completion`** — Phase 2 verification gate
- **`box:commit`** — Phase 4 (noise detection, grouping, single-line commit)
- **`box:test-driven-development`** — Writing the failing test in Phase 2 Step 1

## Version History

- Created: 2026-05-13 — Born from the observation that small bug fixes consistently skipped doc sync when no explicit skill enforced it. Code got fixed, docs drifted, next AI session reproduced the same bug.
