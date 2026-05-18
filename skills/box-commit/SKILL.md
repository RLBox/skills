---
name: box-commit
description: 'Smart Git commit helper that analyzes changes and creates semantic conventional commits grouped by purpose. Use when the user says commit, /commit, 帮我提交, commit代码, 生成commit, or similar.'
user-invocable: true
disable-model-invocation: false
---

# Smart Commit Skill

This skill helps users create well-structured, semantic git commits by analyzing changes and suggesting appropriate commit messages.

## CRITICAL REQUIREMENT: SINGLE-LINE COMMITS ONLY

**ALL commit messages created by this skill MUST be single-line only.**

- DO: `git commit -m "feat: add user authentication"`
- DON'T: Multi-line commits with body text
- DON'T: Multiple `-m` flags
- DON'T: Commit messages with `\n` or additional paragraphs

Keep commits concise and focused. If more detail is needed, suggest adding it separately in PR descriptions or documentation.

## Overview

This skill automates the process of reviewing git changes and creating meaningful, conventional commits following the semantic commit format (feat/fix/chore/test).

## Core Philosophy

**THINK IN PURPOSES, NOT FILES**

This skill prioritizes understanding the OVERALL GOAL of changes before deciding how to commit them. The default approach is to:
1. Understand what the developer is trying to achieve
2. Group all related changes into meaningful, purpose-driven commits
3. Prefer fewer, cohesive commits over many fragmented ones

DO NOT commit file-by-file. DO NOT separate tests from implementation. DO NOT fragment features across multiple commits.

Ask: "What story do these changes tell?" and commit accordingly.

If a file shouldn't be committed at all (e.g., runtime state, generated artifacts), the right fix is `.gitignore` — not silent revert at commit time.

## Usage

To use this skill, simply say:
- "Help me commit my changes"
- "Create semantic commits"
- "Review and commit changes"
- Use the command: `/commit`

## Process Steps

### 1. Analyze Git Status

First, check the current git status to understand:
- What files have been modified, added, or deleted
- Which files are staged vs unstaged
- Overall state of the working directory

```bash
git status
git --no-pager diff --stat
```

### 2. HOLISTIC ANALYSIS - Understand the Overall Purpose

CRITICAL: Before diving into file-by-file analysis, step back and ask:

- What is the developer trying to achieve overall? (e.g., "Add authentication feature", "Fix login bugs", "Refactor database layer")
- Is there a common theme or goal across these changes?
- Can multiple changes be explained by a single higher-level purpose?

Think strategically, not tactically:
- BAD: "Changed auth.rb, changed user.rb, changed session.rb" -> 3 separate commits
- GOOD: "These are all part of implementing user authentication" -> 1 commit

Review ALL changes together first:
```bash
# Get overview of all changes — ALWAYS use --no-pager (see Commands Used section)
git --no-pager diff --stat
git --no-pager diff
```

Look for patterns:
- Do multiple files serve the same feature?
- Are there related bug fixes across files?
- Is there a refactoring that touches multiple files?
- Are tests accompanying their implementation?

### 3. Review Changes in Detail

Now examine each file to understand specifics:
- The nature of changes (new feature, bug fix, refactoring, tests, documentation)
- How it connects to the overall purpose identified in step 2
- Whether it's part of the main change or a separate concern

```bash
git --no-pager diff <file>
```

### 4. INTELLIGENT GROUPING - Merge Similar Changes

CRITICAL PRINCIPLE: Prefer fewer, meaningful commits over many small commits

**Grouping Strategy:**

1. **Same Feature/Purpose = One Commit**
   - All files contributing to the same feature should be in ONE commit
   - Tests for a feature belong with the feature implementation
   - Related configuration changes belong with the feature

2. **Ask: "Would I explain these separately in a code review?"**
   - If you'd say "I added X, Y, and Z as part of feature F" -> ONE commit
   - If you'd say "I added X, and separately I fixed Y" -> TWO commits

3. **Look for these grouping opportunities:**
   - Feature + Tests: Always together
   - Implementation across multiple files: One commit if same feature
   - Bug fix + Test: Together if addressing same issue
   - Refactoring across modules: One commit if same refactoring goal
   - Documentation + Code: Together if documenting the same change
   - Configuration + Code: Together if config is required for the code

4. **Only split when:**
   - Changes serve genuinely different purposes
   - Mixing would make the commit unclear or too broad
   - One change is risky and should be isolated
   - Different semantic types that shouldn't mix (feat vs fix vs chore)

**Examples of Good Grouping:**

GOOD - Merged into ONE commit:
```
Commit: feat: add user authentication
  - lib/auth/authenticator.rb (new authentication logic)
  - lib/user.rb (user model updates)
  - lib/session.rb (session management)
  - spec/auth/authenticator_spec.rb (tests)
  - spec/user_spec.rb (updated tests)
  - config/routes.rb (auth routes)
```

GOOD - Different purposes, TWO commits:
```
Commit 1: feat: add user authentication
  - lib/auth/authenticator.rb
  - spec/auth/authenticator_spec.rb

Commit 2: fix: resolve database timeout issue
  - lib/database/connection.rb
  - spec/database/connection_spec.rb
```

BAD - Over-splitting, should be ONE commit:
```
Commit 1: feat: add authentication logic
  - lib/auth/authenticator.rb

Commit 2: feat: update user model for authentication
  - lib/user.rb

Commit 3: test: add authentication tests
  - spec/auth/authenticator_spec.rb

Commit 4: chore: add authentication routes
  - config/routes.rb
```

**Decision Tree:**
```
Are changes related to the same goal/feature/purpose?
|-- YES -> Combine into ONE commit
|   +-- Even if they touch different files/modules
+-- NO -> Keep as separate commits
    +-- Ask: Are they different semantic types (feat/fix/chore)?
        |-- YES -> Definitely separate
        +-- NO -> Consider if they could still be combined
```

### 5. Generate Commit Messages

Based on the holistic analysis, generate commit messages following the conventional commit format:

**Format**: `<type>: <description>`

**Types**:
- `feat`: New features or functionality
- `fix`: Bug fixes
- `chore`: Routine tasks, maintenance, dependencies
- `test`: Adding or modifying tests (only if standalone)
- `docs`: Documentation changes (only if standalone)
- `refactor`: Code refactoring without changing functionality
- `style`: Code style changes (formatting, whitespace)
- `perf`: Performance improvements

**CRITICAL GUIDELINES**:
- **MUST BE SINGLE-LINE**: Commit messages MUST be a single line only. DO NOT create multi-line commit messages.
- Keep messages concise (ideally under 50 characters)
- Use imperative mood ("add feature" not "added feature")
- Don't end with a period
- Be specific but brief
- **One logical PURPOSE per commit** (not one file per commit)
- Describe the overall goal, not implementation details
- If more detail is needed, suggest adding it in PR description or commit body separately, but the initial commit MUST be single-line

**Examples**:
- `feat: add user authentication` (not "add authenticator.rb, user.rb, session.rb")
- `fix: resolve login timeout issues` (not "fix auth.rb timeout")
- `chore: update dependencies` (not separate commits for each gem)
- `refactor: simplify database connection logic` (not one commit per file)
- `docs: update API documentation` (only if pure documentation change)

### 6. Execute Commits Immediately

No confirmation needed — analyze, group, and commit right away.

For each commit group:
```bash
# Stage specific files
git add <file1> <file2> ...

# Create commit with SINGLE-LINE message only
git commit -m "<type>: <description>"
```

**IMPORTANT**:
- Use ONLY `git commit -m "single line message"` format
- DO NOT use multi-line commits with additional body text
- DO NOT use `-m` flag multiple times
- Keep the commit message as a single, concise line

### 7. Final Summary

After all commits, show:
- Total number of commits created
- Each commit hash + message
- Suggest next steps (e.g., git push)

## Commands Used

> **⚠️ Non-interactive terminal gotcha — always disable the pager.**
> Git pipes `diff`, `log`, `show`, `blame` through `less` by default. In an AI agent's terminal
> this hangs forever waiting for `q` — wasting tool calls and stalling the session.
> Use `git --no-pager <subcommand>` (or `git -P ...`, or set `PAGER=cat`, or pipe `| cat`).
> Affected subcommands: `diff`, `log`, `show`, `blame`, `reflog`.
> **Unaffected** (no pager): `status`, `add`, `commit`, `checkout`, `diff --stat` (short output).
>
> Real incident (Goomart, 2026-04-29): `git diff lib/tasks/validator.rake` and `git log --oneline -n 3`
> both hung in `waiting` state, wasting 2 tool calls to send `q`. Always prefix with `--no-pager`.

```bash
# Check status (no pager needed — short output)
git status
git status --short

# View changes (MUST use --no-pager to avoid hanging in agent terminal)
git --no-pager diff
git --no-pager diff --stat
git --no-pager diff <file>
git --no-pager diff --ignore-all-space <file>  # detect whitespace-only noise

# Revert a file to HEAD (only when explicitly instructed by user)
git checkout -- <file>

# Stage files
git add <file>

# Create commit (SINGLE-LINE only)
git commit -m "type: single line description"

# NEVER use multi-line format like:
# git commit -m "title" -m "body"  -- DON'T DO THIS
# git commit -m "title\n\nbody"    -- DON'T DO THIS

# View commit history (MUST use --no-pager)
git --no-pager log --oneline -n 5
git --no-pager show <hash>
```

## Workflow Example

BAD Example (Over-splitting):
```
User: /commit

AI (WRONG APPROACH):
Found 5 modified files

Proposed commits:
  Commit 1: feat: add user model
    - lib/user.rb
  Commit 2: test: add user tests
    - spec/user_spec.rb
  Commit 3: fix: fix auth validation
    - lib/auth.rb
  Commit 4: test: add auth tests
    - spec/auth_spec.rb
  Commit 5: chore: update dependencies
    - Gemfile

Problems: Tests separated from code. 5 commits for what should be 3.
```

GOOD Example (Holistic grouping):
```
User: /commit

AI (CORRECT APPROACH):
1. Analyzing all changes...
   Found 5 modified files

2. Identifying overall purpose...
   Main goal: Implementing user registration feature
   Secondary: Fixing existing auth bug
   Maintenance: Dependency updates

3. Holistic analysis:
   - lib/user.rb: New user registration feature
   - spec/user_spec.rb: Tests for user registration (same feature)
   - lib/auth.rb: Fix password validation bug (separate concern)
   - spec/auth_spec.rb: Tests for auth fix (same bug fix)
   - Gemfile: Updated dependencies (separate maintenance)

4. Proposed commits (grouped by purpose):
   Commit 1: feat: add user registration
     - lib/user.rb (implementation)
     - spec/user_spec.rb (tests)
   Commit 2: fix: correct password validation logic
     - lib/auth.rb (bug fix)
     - spec/auth_spec.rb (tests)
   Commit 3: chore: update gem dependencies
     - Gemfile

AI (executes immediately, no confirmation):
Commit 1 created (a1b2c3d): feat: add user registration
Commit 2 created (e4f5g6h): fix: correct password validation logic
Commit 3 created (i7j8k9l): chore: update gem dependencies

Summary: 3 meaningful commits
Next steps: Review with 'git log' or push with 'git push'
```

## Best Practices

### Commit Message Rules
- **MUST be single-line only** - Never use multi-line commit messages
- Start with lowercase (except proper nouns)
- Use present tense imperative
- Be specific but concise
- Focus on "what" and "why", not "how"
- Maximum 72 characters for the single line

### Commit Organization - THINK PURPOSE, NOT FILES

**GOLDEN RULE: One logical PURPOSE per commit, not one FILE per commit**

### When to COMBINE Changes (Default Approach)
- **Feature implementation + its tests** (ALWAYS together)
- **Multiple files serving the same feature** (one commit)
- **Bug fix + its test** (ALWAYS together)
- **Code + required configuration** (together if config enables the code)
- **Refactoring across multiple files** (one commit if same refactoring goal)
- **Documentation + code it documents** (together if part of same change)
- **Related files in same module/feature** (one commit)

### When to SPLIT Commits (Exception Cases)
- **Truly different purposes**: e.g., "add feature X" vs "fix bug Y"
- **Different semantic types**: feat vs fix vs chore (usually)
- **Risky changes**: isolate if one change is experimental
- **Independent concerns**: changes that could be deployed separately
- **Too broad scope**: if one commit does too many unrelated things

### Anti-Patterns to Avoid
- NEVER split implementation and tests into separate commits
- NEVER create one commit per file unless files are truly independent
- NEVER split configuration from the code that requires it
- NEVER fragment a feature into multiple commits just because it touches multiple files
- NEVER silently revert files without explicit user instruction — if a file shouldn't be tracked, add it to `.gitignore`

### Decision Framework
```
For each changed file, ask in order:
1. "What was the developer trying to accomplish?" (identify the purpose)
2. "Do these files work together toward that purpose?" (YES → combine)
3. "Would splitting these make the history harder to understand?" (YES → combine)
4. "Could these changes be deployed independently?" (NO → combine)
```

## Error Handling

- **No changes detected**: Inform user and exit gracefully
- **Merge conflicts**: Warn user to resolve conflicts first
- **Detached HEAD**: Alert user about repository state
- **Uncommitted changes during conflict**: Suggest stashing or committing
- **Empty commit message**: Request user input for clarification
- **Mixed real+noise in one file**: Do NOT silently revert; ask user how to proceed

## Safety Features

- Always review changes before committing (read diffs first)
- Always detect and report noise before reverting (never silent)
- Execute commits immediately after analysis — no confirmation step
- Preserve git history integrity
- When in doubt about whether something is noise, keep it

## Integration with Workflow

This skill works best:
- After completing a feature or fix
- Before pushing to remote
- During code review preparation
- When cleaning up messy commit history (use with `git reset` first)
- In teams with cross-environment tool-version drift (different pg/node/ruby versions)

## Notes

- This skill does NOT push commits (user controls when to push)
- Follows conventional commits specification
- Encourages atomic, well-documented commits
- Helps maintain clean git history — including rejecting noise, not just grouping real changes
- Useful for both beginners and experienced developers

## Dependencies

- Git installed and configured
- Working directory is a git repository
- User has permissions to commit
- Changes exist to commit

## Version History

- Created: 2025-02-01
- Updated: 2026-04-29 — Mandated `git --no-pager` for `diff`/`log`/`show`/`blame` after Goomart incident where the default `less` pager hung the agent terminal in `waiting` state, wasting 2 tool calls per skill run
- Updated: 2026-05-18 — Removed Step 1.5 (noise diff auto-revert). Rationale: silently reverting files at commit time is wrong — it can mask legitimate changes (e.g., db/validator_statuses.json is the authoritative source per ADR-017, not noise). If a file shouldn't be tracked, the correct fix is `.gitignore`, not commit-time reversion.
- Purpose: Improve commit quality and development workflow
- Compatible with: Any git repository
