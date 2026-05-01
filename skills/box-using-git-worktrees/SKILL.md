---
name: box-using-git-worktrees
description: Use when starting feature work that needs isolation from current workspace or before executing implementation plans - creates isolated git worktrees with smart directory selection and safety verification
---

# Using Git Worktrees

## Overview

Git worktrees create isolated workspaces sharing the same repository, allowing work on multiple branches simultaneously without switching.

**Core principle:** Systematic directory selection + safety verification = reliable isolation.

**Announce at start:** "I'm using the using-git-worktrees skill to set up an isolated workspace."

## Directory Selection Process

Follow this priority order:

### 1. Check Existing Directories

```bash
# Check in priority order
ls -d .worktrees 2>/dev/null     # Preferred (hidden)
ls -d worktrees 2>/dev/null      # Alternative
```

**If found:** Use that directory. If both exist, `.worktrees` wins.

### 2. Check CLAUDE.md

```bash
grep -i "worktree.*director" CLAUDE.md 2>/dev/null
```

**If preference specified:** Use it without asking.

### 3. Ask User

If no directory exists and no CLAUDE.md preference:

```
No worktree directory found. Where should I create worktrees?

1. .worktrees/ (project-local, hidden)
2. ~/.config/superpowers/worktrees/<project-name>/ (global location)

Which would you prefer?
```

## Safety Verification

### For Project-Local Directories (.worktrees or worktrees)

**MUST verify directory is ignored before creating worktree:**

```bash
# Check if directory is ignored (respects local, global, and system gitignore)
git check-ignore -q .worktrees 2>/dev/null || git check-ignore -q worktrees 2>/dev/null
```

**If NOT ignored:**

Per Jesse's rule "Fix broken things immediately":
1. Add appropriate line to .gitignore
2. Commit the change
3. Proceed with worktree creation

**Why critical:** Prevents accidentally committing worktree contents to repository.

### For Global Directory (~/.config/superpowers/worktrees)

No .gitignore verification needed - outside project entirely.

## Creation Steps

### 1. Detect Project Name

```bash
project=$(basename "$(git rev-parse --show-toplevel)")
```

### 2. Create Worktree

```bash
# Determine full path
case $LOCATION in
  .worktrees|worktrees)
    path="$LOCATION/$BRANCH_NAME"
    ;;
  ~/.config/superpowers/worktrees/*)
    path="~/.config/superpowers/worktrees/$project/$BRANCH_NAME"
    ;;
esac

# Create worktree with new branch
git worktree add "$path" -b "$BRANCH_NAME"
cd "$path"
```

### 3. Run Project Setup

Auto-detect and run appropriate setup:

```bash
# Node.js
if [ -f package.json ]; then npm install; fi

# Rust
if [ -f Cargo.toml ]; then cargo build; fi

# Python
if [ -f requirements.txt ]; then pip install -r requirements.txt; fi
if [ -f pyproject.toml ]; then poetry install; fi

# Go
if [ -f go.mod ]; then go mod download; fi

# Rails
if [ -f Gemfile ]; then bundle install; fi
```

### 4. Environment Isolation (Database & Port)

**Purpose:** Give each worktree its own database and port so multiple worktrees can run simultaneously without conflicts.

**⚠️ CRITICAL RULE: Never modify Git-tracked config files in the worktree** (like `config/database.yml`). Those changes show up in `git status` and risk accidental commits. All isolation must happen through **untracked files only** (`.env`, `.env.development`, etc.).

**Only for projects with `config/database.yml`** (Rails and similar). Skip this entire step if no database config exists.

#### 4a. Check if Project Supports Env-Based DB Override

Read `config/database.yml` and check whether it reads database names from environment variables:

```bash
grep -E 'ENV\[|ENV\.fetch' config/database.yml
```

**If YES (already supports env vars):** Great — skip to 4c.

**If NO (hardcoded database names):** Tell the user this is a one-time setup. Add a note: *"This project's database.yml doesn't support environment-based override. Run `box-worktree-rails-setup` for a one-time config change. For now, proceeding with default (shared) database."*

<details>
<summary>Recommendation for project maintainers (show once, then skip)</summary>

Modify `config/database.yml` to support environment variable overrides:

```yaml
# config/database.yml
development:
  database: <%= ENV.fetch('WORKTREE_DEV_DB', 'goomart_db') %>

test:
  database: <%= ENV.fetch('WORKTREE_TEST_DB', 'goomart_test') %>
```

And if the project has `bin/db_init`, make it also respect these env vars (add after parsing database.yml):

```ruby
dev_db  = ENV['WORKTREE_DEV_DB']  || db_config.dig('development', 'database')
test_db = ENV['WORKTREE_TEST_DB'] || db_config.dig('test', 'database')
```

After this one-time change (committed to main), all future worktrees get full DB isolation with zero config file edits.

</details>

#### 4b. Generate Unique Suffix

Extract a short identifier from the branch name:

```bash
# feature/coupon → coupon
# fix/login-bug → login-bug
suffix=$(echo "$BRANCH_NAME" | sed 's|.*/||' | tr '/' '-')
```

#### 4c. Allocate Free Port

Find next available port starting from 3001, write to `.env`:

```bash
port=3001
while lsof -ti :$port >/dev/null 2>&1; do port=$((port+1)); done
echo "PORT=$port" >> .env
```

#### 4d. Set Isolated Database Names in `.env` (only if project supports env override)

```bash
# Only if database.yml uses WORKTREE_DEV_DB / WORKTREE_TEST_DB
echo "WORKTREE_DEV_DB=goomart_db_$suffix" >> .env
echo "WORKTREE_TEST_DB=goomart_test_$suffix" >> .env
```

#### 4e. Initialize Isolated Databases (only if env override is active)

```bash
# For projects with bin/db_init:
bin/db_init

# For standard Rails projects:
bin/rails db:create
bin/rails db:migrate
bin/rails db:test:prepare
```

#### 4f. Cleanup on Worktree Deletion

When the worktree is deleted (by `box-finishing-a-development-branch`), also drop its isolated databases if they were created:

```bash
dropdb --if-exists goomart_db_$suffix
dropdb --if-exists goomart_test_$suffix
```

**Why this matters:** Without cleanup, orphaned databases accumulate and waste disk space. `.env` is untracked and disappears with the worktree — no pollution.

### 5. Verify Clean Baseline

Run tests to ensure worktree starts clean:

```bash
# Examples - use project-appropriate command
npm test
cargo test
pytest
go test ./...
```

**If tests fail:** Report failures, ask whether to proceed or investigate.

**If tests pass:** Report ready.

### 6. Report Location

```
Worktree ready at <full-path>
Tests passing (<N> tests, 0 failures)
Ready to implement <feature-name>
```

## Quick Reference

| Situation | Action |
|-----------|--------|
| `.worktrees/` exists | Use it (verify ignored) |
| `worktrees/` exists | Use it (verify ignored) |
| Both exist | Use `.worktrees/` |
| Neither exists | Check CLAUDE.md → Ask user |
| Directory not ignored | Add to .gitignore + commit |
| Rails/database.yml exists | Try env-based DB isolation (4a-4f) |
| database.yml no env support | Skip DB isolation, suggest one-time config |
| Tests fail during baseline | Report failures + ask |
| No package.json/Cargo.toml | Skip dependency install |

## Common Mistakes

### Skipping ignore verification

- **Problem:** Worktree contents get tracked, pollute git status
- **Fix:** Always use `git check-ignore` before creating project-local worktree

### Assuming directory location

- **Problem:** Creates inconsistency, violates project conventions
- **Fix:** Follow priority: existing > CLAUDE.md > ask

### Modifying Git-tracked config files for isolation

- **Problem:** Changes to `config/database.yml` etc. show up in `git status`, risk accidental commits
- **Fix:** Only modify untracked files (`.env`). If DB names are hardcoded, suggest one-time project config change — don't hack it in the worktree.

### Proceeding with failing tests

- **Problem:** Can't distinguish new bugs from pre-existing issues
- **Fix:** Report failures, get explicit permission to proceed

### Hardcoding setup commands

- **Problem:** Breaks on projects using different tools
- **Fix:** Auto-detect from project files (package.json, etc.)

### Forgetting to clean up isolated databases

- **Problem:** Orphaned databases accumulate, waste disk space
- **Fix:** When worktree is deleted, run `dropdb --if-exists` for its databases

## Example Workflow

```
You: I'm using the using-git-worktrees skill to set up an isolated workspace.

[Check .worktrees/ - exists]
[Verify ignored - git check-ignore confirms .worktrees/ is ignored]
[Create worktree: git worktree add .worktrees/coupon -b feature/coupon]
[Run bundle install]
[Check database.yml - already supports WORKTREE_DEV_DB env var ✓]
[Allocate port: 3001 is free → write PORT=3001 to .env]
[Set DB names: WORKTREE_DEV_DB=goomart_db_coupon, WORKTREE_TEST_DB=goomart_test_coupon → .env]
[bin/db_init → databases created, migrated, baseline loaded]
[Run rspec - 47 passing]

Worktree ready at /Users/runsheng/Goomart/.worktrees/coupon
  Database: goomart_db_coupon / goomart_test_coupon
  Port:     3001
  Tests:    47 passing, 0 failures
  Cleanup:  dropdb goomart_db_coupon goomart_test_coupon (on worktree delete)
Ready to implement coupon feature
```

## Red Flags

**Never:**
- Create worktree without verifying it's ignored (project-local)
- **Modify Git-tracked config files** (database.yml, puma.rb, etc.) for environment isolation
- Skip baseline test verification
- Proceed with failing tests without asking
- Assume directory location when ambiguous
- Skip CLAUDE.md check

**Always:**
- Follow directory priority: existing > CLAUDE.md > ask
- Verify directory is ignored for project-local
- Auto-detect and run project setup
- **Use `.env` (untracked) for port and database isolation** — never touch tracked configs
- Allocate unique port (lsof check, start from 3001)
- Clean up isolated databases when worktree is deleted
- Verify clean test baseline

## Integration

**Called by:**
- **box-brainstorming** (Phase 4) - REQUIRED when design is approved and implementation follows
- **box-subagent-driven-development** - REQUIRED before executing any tasks
- **box-executing-plans** - REQUIRED before executing any tasks
- Any skill needing isolated workspace

**Pairs with:**
- **box-finishing-a-development-branch** - REQUIRED for cleanup after work complete
