---
name: box-requesting-code-review
description: Use when completing tasks, implementing major features, or before merging to verify work meets requirements
---

# Requesting Code Review

Perform a structured self-review to catch issues before they cascade. Read the diff with fresh eyes, evaluate it against the requirements, and surface problems clearly.

**Core principle:** Review early, review often.

## When to Request Review

**Mandatory:**
- After completing a major feature
- Before merge to main

**Optional but valuable:**
- When stuck (step back, review what you have)
- Before refactoring (baseline check)
- After fixing complex bug

## How to Review

**1. Get git diff:**
```bash
BASE_SHA=$(git rev-parse origin/main)  # or the commit before your work
HEAD_SHA=$(git rev-parse HEAD)
git diff $BASE_SHA $HEAD_SHA
```

**2. Review the diff against requirements:**

Read every changed file. For each change ask:
- Does this implement what was required?
- Are there edge cases not handled?
- Are there tests covering the logic?
- Is there dead code, debug output, or accidental changes?

**3. Categorize issues:**
- **Critical** — incorrect behavior, data loss risk, security issue → fix now
- **Important** — missing test coverage, unhandled edge case → fix before proceeding
- **Minor** — style, naming, small inefficiency → note for later

**4. Act on findings:**
- Fix Critical issues immediately
- Fix Important issues before proceeding
- Note Minor issues (can defer)
- If you disagree with your own finding, reason it out in a comment

## Self-Review Checklist

```
[ ] Diff matches the stated requirement (no accidental changes)
[ ] New logic has test coverage
[ ] No TODO / placeholder left in production code
[ ] Error paths handled
[ ] No debug output / console.log / puts left in
[ ] Commit messages are clean and descriptive
```

## Example

```
[Just completed Task 2: Add verification function]

BASE_SHA=$(git log --oneline | grep "Task 1" | head -1 | awk '{print $1}')
HEAD_SHA=$(git rev-parse HEAD)
git diff $BASE_SHA $HEAD_SHA

[Review diff against Task 2 requirements from docs/architecture/2026-01-01-deployment-plan.md]

Strengths: Clean architecture, real tests
Issues:
  Important: Missing progress indicators for long-running repair
  Minor: Magic number (100) for reporting interval — extract to constant

[Fix progress indicators]
[Continue to Task 3]
```

## Integration with Workflows

**Executing Plans:**
- Review after each task or batch
- Fix issues before moving to next task

**Ad-Hoc Development:**
- Review before merge
- Review when stuck

## Red Flags

**Never:**
- Skip review because "it's simple"
- Ignore Critical issues
- Proceed with unfixed Important issues
