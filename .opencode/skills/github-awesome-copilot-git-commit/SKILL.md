---
name: git-commit
description: 'Execute git commit with conventional commit message analysis, intelligent staging, and message generation. Use when user asks to commit changes, create a git commit, or mentions "/commit". Supports: (1) Auto-detecting type and scope from changes, (2) Generating conventional commit messages from diff, (3) Interactive commit with optional type/scope/description overrides, (4) Intelligent file staging for logical grouping'
---

# Git Commit with Conventional Commits

基于 Conventional Commits 规范创建标准化 git commit。所有 git 操作通过跨平台的 bun TypeScript 脚本执行。

## Conventional Commit 格式

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

## Commit Types

| Type       | Purpose                        |
| ---------- | ------------------------------ |
| `feat`     | New feature                    |
| `fix`      | Bug fix                        |
| `docs`     | Documentation only             |
| `style`    | Formatting/style (no logic)    |
| `refactor` | Code refactor (no feature/fix) |
| `perf`     | Performance improvement        |
| `test`     | Add/update tests               |
| `build`    | Build system/dependencies      |
| `ci`       | CI/config changes              |
| `chore`    | Maintenance/misc               |
| `revert`   | Revert commit                  |

## 脚本路径

脚本位于本 skill 目录下：`scripts/commit.ts`

需要从项目根目录执行：

```bash
bun .opencode/skills/github-awesome-copilot-git-commit/scripts/commit.ts [command|options]
```

## 工作流

### 1. 查看当前变更

```bash
bun .opencode/skills/github-awesome-copilot-git-commit/scripts/commit.ts diff
```

```bash
bun .opencode/skills/github-awesome-copilot-git-commit/scripts/commit.ts status
```

### 2. 执行 Commit

```bash
bun .opencode/skills/github-awesome-copilot-git-commit/scripts/commit.ts -t <type> -d "<description>"
```

完整选项：

| 选项                  | 说明                           |
| --------------------- | ------------------------------ |
| `-t, --type <type>`   | Commit 类型（必填）            |
| `-s, --scope <scope>` | 作用范围（可选）               |
| `-b, --breaking`      | 标记为 breaking change         |
| `-d, --description>`  | 简短描述，<72 字符（必填）     |
| `--body <body>`       | 详细说明（可选）               |
| `--footer <footer>`   | 页脚，如 `Closes #123`（可选） |
| `-S, --stage <files>` | 逗号分隔的文件列表，commit 前暂存 |
| `--dry-run`           | 仅打印消息，不实际 commit      |

### 3. 示例

```bash
bun .opencode/skills/github-awesome-copilot-git-commit/scripts/commit.ts -t feat -s auth -d "add login flow"

bun .opencode/skills/github-awesome-copilot-git-commit/scripts/commit.ts -t fix -d "resolve null pointer" --body "Fixes edge case when input is empty" --footer "Closes #42"

bun .opencode/skills/github-awesome-copilot-git-commit/scripts/commit.ts --dry-run -t refactor -d "extract utils"
```

## Git Safety Protocol

- NEVER update git config
- NEVER run destructive commands (--force, hard reset) without explicit request
- NEVER skip hooks (--no-verify) unless user asks
- NEVER force push to main/master
- If commit fails due to hooks, fix and create NEW commit (don't amend)
- NEVER commit secrets (.env, credentials.json, private keys)
