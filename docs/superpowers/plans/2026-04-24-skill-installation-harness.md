# Skill Installation Harness 实现计划 (v3)

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个 opencode plugin，通过前馈验证 + 三层反馈 + tool 生命周期门控，harness AI 的 skill 安装流程。

**Architecture:** 单文件 plugin（`.opencode/plugins/skill-harness.ts`），包含 4 个 custom tool + 2 个钩子（`tool.definition` 门控 + `tool.execute.before` 拦截）。tool 默认隐藏，AI 调用任意 `skill_*` tool 时自动激活，`skill_mark_complete` 返回 "done" 后去激活。

**Tech Stack:** TypeScript, `@opencode-ai/plugin` (v1.14.22), `zod`, `glob`, Bun runtime APIs

**Spec:** `docs/superpowers/specs/2026-04-24-skill-installation-harness-design.md` (v3)

---

## 文件结构

| 文件 | 操作 | 职责 |
|---|---|---|
| `.opencode/package.json` | **修改** | 添加 `glob` 依赖 |
| `.opencode/plugins/skill-harness.ts` | **新建** | plugin 入口 + 4 个 tool + 2 个钩子 + 门控 + 辅助函数 |
| `.opencode/skills/find-skills/SKILL.md` | **修改** | 简化为引用 custom tool 的指令 |

共 1 个新文件 + 2 个修改。所有逻辑内联在 plugin 中，共享闭包状态。

---

## Chunk 1: 依赖 + plugin 骨架 + 门控层 + `skill_search`

### Task 1: 添加 `glob` 依赖

**Files:**
- 修改: `.opencode/package.json`

- [ ] **Step 1: 修改 package.json**

```json
{
  "dependencies": {
    "@opencode-ai/plugin": "1.14.22",
    "glob": "^11.0.0"
  }
}
```

- [ ] **Step 2: 安装依赖**

Run: `bun install`（在 `.opencode/` 目录下执行）
Expected: `glob` 安装成功，`bun.lock` 更新。

- [ ] **Step 3: 提交**

```
git add .opencode/package.json .opencode/bun.lock
git commit -m "chore: add glob dependency for skill harness"
```

### Task 2: 创建 plugin 骨架（门控层 + `skill_search`）

**Files:**
- 新建: `.opencode/plugins/skill-harness.ts`

- [ ] **Step 1: 编写完整的 plugin 骨架**

创建 `.opencode/plugins/skill-harness.ts`，包含：闭包状态、常量、辅助函数、门控钩子、`skill_search` tool。

```typescript
import { type Plugin, tool } from "@opencode-ai/plugin"
import path from "path"

// ── 闭包状态 ────────────────────────────────────────────────────
let activeSessionID: string | null = null
const reviewRounds = new Map<string, number>()
const MAX_ROUNDS = 5

// ── 常量 ────────────────────────────────────────────────────────
const SKILL_TOOL_IDS = ["skill_search", "skill_install", "skill_mark_complete", "skill_status"]

const BASH_PATTERNS: [RegExp, string][] = [
  [/\bln -sf?\b/, "Use fs.symlink() or fs.copyFile() instead"],
  [/\bset -e\b/, "Use try/catch in TypeScript instead"],
  [/\bchmod\b/, "Use fs.chmod() from node:fs instead"],
  [/\bsource\b/, "Use import or require() instead"],
  [/\/etc\/|\/usr\/local\//, "Use path.resolve() with platform-agnostic paths"],
  [/\$\{?HOME\}?/, "Use os.homedir() or Bun.env.HOME instead"],
]

const NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/
const KNOWN_FM_FIELDS = ["name", "description", "license", "compatibility", "metadata"]

// ── 验证辅助函数 ────────────────────────────────────────────────

interface ValidationResult {
  errors: string[]
  warnings: string[]
}

function validateName(name: string): string[] {
  if (NAME_REGEX.test(name)) return []
  return [
    [
      `ERROR: Invalid skill name "${name}".`,
      `FIX: Name must match /^[a-z0-9]+(-[a-z0-9]+)*$/`,
      `     Only lowercase letters, numbers, and single hyphens.`,
      `     Examples: "git-release", "find-skills", "react-testing"`,
    ].join("\n"),
  ]
}

function validateFrontmatter(content: string, name: string): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!fmMatch) {
    errors.push(
      [
        `ERROR: SKILL.md missing YAML frontmatter.`,
        `FIX: Add frontmatter at the top of the file:`,
        `---`,
        `name: ${name}`,
        `description: 'Brief description of what this skill does'`,
        `---`,
      ].join("\n"),
    )
    return { errors, warnings }
  }

  const fm = fmMatch[1]
  if (!fm.includes("name:")) {
    errors.push(`ERROR: frontmatter missing 'name' field.\nFIX: Add "name: ${name}" to frontmatter.`)
  }
  if (!fm.includes("description:")) {
    errors.push(`ERROR: frontmatter missing 'description' field.\nFIX: Add "description: '...'" to frontmatter.`)
  }

  const nameMatch = fm.match(/name:\s*['"]?([^'"\n]+)/)
  if (nameMatch && nameMatch[1].trim() !== name) {
    errors.push(
      `ERROR: frontmatter name "${nameMatch[1].trim()}" does not match directory name "${name}".\nFIX: Change frontmatter name to "${name}".`,
    )
  }

  const fieldLines = fm.split("\n").filter((l) => /^\w/.test(l))
  for (const line of fieldLines) {
    const field = line.split(":")[0].trim()
    if (!KNOWN_FM_FIELDS.includes(field)) {
      warnings.push(
        `WARNING: Unknown frontmatter field "${field}".\nFIX: Remove "${field}" from frontmatter. Only ${KNOWN_FM_FIELDS.join(", ")} are recognized by opencode.`,
      )
    }
  }

  return { errors, warnings }
}

interface FileEntry {
  path: string
  content: string
}

function scanForBashIssues(files: FileEntry[]): string[] {
  const warnings: string[] = []
  for (const f of files) {
    if (f.path.endsWith(".sh")) {
      const tsPath = f.path.replace(/\.sh$/, ".ts")
      warnings.push(
        [
          `WARNING: Shell script "${f.path}" is not cross-platform.`,
          `FIX: Create "${tsPath}" with equivalent logic using Bun APIs:`,
          `  - Use Bun.spawn() for subprocess calls`,
          `  - Use import { join } from "path" for path operations`,
          `  - Use Bun.file() / Bun.write() for file I/O`,
          `  Then delete "${f.path}" and update SKILL.md to reference "${tsPath}".`,
        ].join("\n"),
      )
    }
    if (/\$\(cat\s*<<['"]?EOF['"]?/.test(f.content)) {
      warnings.push(
        `WARNING: "${f.path}" contains bash heredoc pattern which fails on Windows.\nFIX: Replace with template literals or Bun.write().`,
      )
    }
    for (const [pattern, fix] of BASH_PATTERNS) {
      const match = f.content.match(pattern)
      if (match) {
        warnings.push(`WARNING: "${f.path}" contains bash-only pattern "${match[0]}".\nFIX: ${fix}`)
      }
    }
    const absMatch = f.content.match(/(?<!https?:\/\/[^\s]*)\/(?:home|Users|tmp)\//)
    if (absMatch) {
      warnings.push(
        `WARNING: "${f.path}" contains platform-specific path "${absMatch[0]}".\nFIX: Use path.resolve() or os.homedir() for cross-platform compatibility.`,
      )
    }
  }
  return warnings
}

function buildReviewPrompt(name: string, content: string, existingSkills: string): string {
  return `You are a skill reviewer for an opencode project.

Review the skill "${name}" against these criteria:

1. **Style consistency**: Compare with existing skills (${existingSkills || "none yet"}).
   Does the frontmatter format match? Is the writing style similar?
2. **Project fit**: Does it reference global paths (~/.config, ~/.claude) that should be
   project-relative (.opencode/skills/)? Does it assume a specific OS?
3. **Content quality**: Is the description clear? Are instructions actionable?
   Are there redundant or outdated sections?

IMPORTANT: Do NOT flag issues that are already covered by computational checks
(e.g., .sh files, bash patterns, frontmatter fields). Only flag semantic/style issues.

Skill content:
\`\`\`markdown
${content}
\`\`\`

Return a JSON object with an "issues" array. Each issue has "message" and "fix" fields.
If no issues, return {"issues": []}.`
}

// ── Plugin ──────────────────────────────────────────────────────
export const SkillHarnessPlugin: Plugin = async ({ project, client, $, directory, worktree }) => {
  return {
    // ── 门控钩子 ──────────────────────────────────────────
    "tool.definition": async (input, output) => {
      if (SKILL_TOOL_IDS.includes(input.toolID) && !activeSessionID) {
        output.description = "[DISABLED] Only available during skill installation workflow. Load the find-skills skill to activate."
      }
    },

    "tool.execute.before": async (input, output) => {
      if (!SKILL_TOOL_IDS.includes(input.tool)) return

      // 首次调用任意 skill_* tool → 自动激活
      if (!activeSessionID) {
        activeSessionID = input.sessionID
      }
    },

    // ── 安全网：session idle 时清理 ──────────────────────
    event: async ({ event }) => {
      if (event.type === "session.idle" && activeSessionID) {
        activeSessionID = null
      }
    },

    // ── Custom Tools ────────────────────────────────────────
    tool: {
      skill_search: tool({
        description:
          "Search for installable agent skills by keyword. Returns structured results with install instructions.",
        args: {
          query: tool.schema.string().describe("Search keywords, e.g. 'react testing', 'git hooks'"),
        },
        async execute(args, context) {
          try {
            const result = await $`npx skills find ${args.query}`.text()
            return result
          } catch (err) {
            return [
              `Search for "${args.query}" via CLI failed (${err}).`,
              `Browse manually:`,
              `  - https://skills.sh/`,
              `  - https://www.skillhub.club/skills`,
              `Then use skill_install to install the skill.`,
            ].join("\n")
          }
        },
      }),

      // skill_install, skill_mark_complete, skill_status 在后续 Task 中添加
    },
  }
}
```

- [ ] **Step 2: 验证编译**

Run: `bun build --no-bundle .opencode/plugins/skill-harness.ts`（在 `.opencode/` 目录下）
Expected: 无错误。

重启 opencode，确认 `skill_search` 出现在工具列表（描述显示 `[DISABLED]...`，因为尚未激活）。

- [ ] **Step 3: 提交**

```
git add .opencode/plugins/skill-harness.ts
git commit -m "feat: scaffold skill-harness plugin with gating hooks and skill_search"
```

---

## Chunk 2: `skill_install` 前馈验证拦截器

### Task 3: 实现 `skill_install` tool

**Files:**
- 修改: `.opencode/plugins/skill-harness.ts`（在 `tool: { }` 中 `skill_search` 之后添加）

- [ ] **Step 1: 添加 skill_install tool**

在 `tool: { ... }` 对象中，`skill_search` 之后，添加以下完整代码（替换 `// skill_install, skill_mark_complete, skill_status 在后续 Task 中添加` 注释）：

```typescript
      skill_install: tool({
        description:
          "Install a skill to the project. Validates and writes files to .opencode/skills/<name>/. Returns warnings with fix instructions if cross-platform issues are detected. Hard-rejects invalid names or missing frontmatter.",
        args: {
          name: tool.schema.string().describe("Skill name (lowercase, numbers, single hyphens, e.g. 'git-release')"),
          skill_md_content: tool.schema.string().describe("Full SKILL.md content including YAML frontmatter"),
          auxiliary_files: tool.schema
            .array(
              tool.schema.object({
                path: tool.schema.string().describe("Relative path within skill dir, e.g. 'scripts/helper.ts'"),
                content: tool.schema.string().describe("File content"),
              }),
            )
            .optional()
            .describe("Additional files to install alongside SKILL.md"),
          source_url: tool.schema.string().optional().describe("URL where the skill was found (for reference)"),
        },
        async execute(args, context) {
          const { worktree: wt } = context
          const fs = await import("fs/promises")
          const errors: string[] = []
          let warnings: string[] = []

          // ── 前馈：硬拒绝 ─────────────────────────────────
          errors.push(...validateName(args.name))
          const fmResult = validateFrontmatter(args.skill_md_content, args.name)
          errors.push(...fmResult.errors)
          warnings.push(...fmResult.warnings)

          if (errors.length > 0) {
            return errors.join("\n\n") + "\n\nInstallation rejected. Fix the errors above and call skill_install again."
          }

          // ── 写入文件 ─────────────────────────────────────
          const skillDir = path.join(wt, ".opencode", "skills", args.name)
          await fs.mkdir(skillDir, { recursive: true })
          await fs.writeFile(path.join(skillDir, "SKILL.md"), args.skill_md_content, "utf-8")

          const installedFiles = ["SKILL.md"]
          if (args.auxiliary_files) {
            for (const f of args.auxiliary_files) {
              const filePath = path.join(skillDir, f.path)
              await fs.mkdir(path.dirname(filePath), { recursive: true })
              await fs.writeFile(filePath, f.content, "utf-8")
              installedFiles.push(f.path)
            }
          }

          // ── 前馈：软警告 ─────────────────────────────────
          const allFiles: FileEntry[] = [{ path: "SKILL.md", content: args.skill_md_content }]
          if (args.auxiliary_files) allFiles.push(...args.auxiliary_files)
          warnings.push(...scanForBashIssues(allFiles))

          // ── 返回 ────────────────────────────────────────
          const output: string[] = [
            `Installed skill "${args.name}" to .opencode/skills/${args.name}/`,
            `Files: ${installedFiles.join(", ")}`,
          ]
          if (warnings.length > 0) {
            output.push("", "Cross-platform issues detected. Fix these before calling skill_mark_complete:", "", ...warnings)
          } else {
            output.push("", `No issues detected. Call skill_mark_complete({ name: "${args.name}" }) to finalize.`)
          }
          return output.join("\n")
        },
      }),
```

- [ ] **Step 2: 验证编译**

Run: `bun build --no-bundle .opencode/plugins/skill-harness.ts`
Expected: 无错误。

- [ ] **Step 3: 提交**

```
git add .opencode/plugins/skill-harness.ts
git commit -m "feat: add skill_install with feedforward validation"
```

---

## Chunk 3: `skill_mark_complete` 三层反馈 + `skill_status`

### Task 4: 实现 `skill_mark_complete` 和 `skill_status`

**Files:**
- 修改: `.opencode/plugins/skill-harness.ts`

- [ ] **Step 1: 添加 skill_mark_complete tool**

在 `skill_install` 之后添加：

```typescript
      skill_mark_complete: tool({
        description:
          "Finalize skill installation. Runs three layers of checks: (1) computational file scan, (2) behavioral load test, (3) LLM style review. Returns fix instructions if issues remain.",
        args: {
          name: tool.schema.string().describe("Skill name to finalize"),
        },
        async execute(args, context) {
          const { worktree: wt } = context
          const fs = await import("fs/promises")
          const { glob } = await import("glob")
          const skillDir = path.join(wt, ".opencode", "skills", args.name)

          // ── 循环保护 ─────────────────────────────────────
          const round = (reviewRounds.get(args.name) ?? 0) + 1
          reviewRounds.set(args.name, round)
          if (round > MAX_ROUNDS) {
            reviewRounds.delete(args.name)
            activeSessionID = null  // 去激活
            return `Skill "${args.name}" reached max review rounds (${MAX_ROUNDS}). Accepting with remaining warnings. Manual review recommended.`
          }

          const issues: string[] = []

          // ── Layer 1: 计算性反馈 ──────────────────────────
          let files: string[]
          try {
            files = await glob("**/*", { cwd: skillDir, nodir: true, posix: true })
          } catch {
            return `ERROR: Skill directory not found at .opencode/skills/${args.name}/\nFIX: Call skill_install first.`
          }

          for (const file of files) {
            const content = await fs.readFile(path.join(skillDir, file), "utf-8")
            if (file.endsWith(".sh")) {
              const tsPath = file.replace(/\.sh$/, ".ts")
              issues.push(
                [`ERROR: Shell script "${file}" still exists.`, `FIX: Transpile to "${tsPath}" using Bun APIs. Delete "${file}" after.`].join("\n"),
              )
            }
            if (/\$\(cat\s*<<['"]?EOF['"]?/.test(content)) {
              issues.push(`ERROR: "${file}" still contains bash heredoc.\nFIX: Replace with template literals or Bun.write().`)
            }
            for (const [pattern, fix] of BASH_PATTERNS) {
              const match = content.match(pattern)
              if (match) {
                issues.push(`WARNING: "${file}" still contains bash pattern "${match[0]}".\nFIX: ${fix}`)
              }
            }
          }

          // ── Layer 2: 行为性反馈 ──────────────────────────
          const skillMdPath = path.join(skillDir, "SKILL.md")
          let skillContent: string
          try {
            skillContent = await fs.readFile(skillMdPath, "utf-8")
          } catch {
            issues.push(`ERROR: SKILL.md not found.\nFIX: Ensure SKILL.md exists in .opencode/skills/${args.name}/`)
            return [
              `Review round ${round}/${MAX_ROUNDS} for "${args.name}":`, "",
              ...issues, "",
              `Fix these issues and call skill_mark_complete({ name: "${args.name}" }) again.`,
            ].join("\n")
          }

          const fmMatch = skillContent.match(/^---\r?\n([\s\S]*?)\r?\n---/)
          if (!fmMatch || !fmMatch[1].includes("name:") || !fmMatch[1].includes("description:")) {
            issues.push(`ERROR: SKILL.md frontmatter is invalid or incomplete.\nFIX: Ensure frontmatter contains both "name" and "description" fields.`)
          }

          // ERROR 存在时跳过昂贵的 LLM 审查
          if (issues.some((i) => i.startsWith("ERROR"))) {
            return [
              `Review round ${round}/${MAX_ROUNDS} for "${args.name}":`, "",
              ...issues, "",
              `Fix these issues and call skill_mark_complete({ name: "${args.name}" }) again.`,
            ].join("\n")
          }

          // ── Layer 3: 推断性反馈（LLM 审查）───────────────
          try {
            const skillsDir = path.join(wt, ".opencode", "skills")
            const existingSkillFiles = await glob("*/SKILL.md", { cwd: skillsDir, posix: true })
            const existingList = existingSkillFiles.map((s) => s.split("/")[0]).filter((s) => s !== args.name).join(", ")

            const reviewSession = await client.session.create({ body: { title: `skill-review-${args.name}` } })
            const reviewResult = await client.session.prompt({
              path: { id: reviewSession.data.id },
              body: {
                parts: [{ type: "text", text: buildReviewPrompt(args.name, skillContent, existingList) }],
                format: {
                  type: "json_schema",
                  schema: {
                    type: "object",
                    properties: {
                      issues: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: { message: { type: "string" }, fix: { type: "string" } },
                          required: ["message", "fix"],
                        },
                      },
                    },
                    required: ["issues"],
                  },
                },
              },
            })

            const structured = (reviewResult.data as any)?.info?.structured_output
            if (structured === undefined) {
              issues.push("WARNING: LLM review returned unexpected response format. Skipping style review.\nFIX: Check SDK response shape.")
            } else {
              const llmIssues: Array<{ message: string; fix: string }> = structured?.issues ?? []
              for (const issue of llmIssues) {
                issues.push(`WARNING: ${issue.message}\nFIX: ${issue.fix}`)
              }
            }
          } catch (err) {
            issues.push(`WARNING: LLM review failed (${err}). Skipping style review.`)
          }

          // ── 返回 ────────────────────────────────────────
          if (issues.length === 0) {
            reviewRounds.delete(args.name)
            activeSessionID = null  // 去激活
            return `Skill "${args.name}" passed all checks (round ${round}). Installation complete.`
          }

          return [
            `Review round ${round}/${MAX_ROUNDS} for "${args.name}":`, "",
            ...issues, "",
            `Fix these issues and call skill_mark_complete({ name: "${args.name}" }) again.`,
          ].join("\n")
        },
      }),
```

- [ ] **Step 2: 添加 skill_status tool**

在 `skill_mark_complete` 之后添加：

```typescript
      skill_status: tool({
        description: "List all installed skills in .opencode/skills/ and their review status.",
        args: {},
        async execute(args, context) {
          const { worktree: wt } = context
          const { glob } = await import("glob")
          const skillsDir = path.join(wt, ".opencode", "skills")
          let dirs: string[]
          try {
            dirs = await glob("*/SKILL.md", { cwd: skillsDir, posix: true })
          } catch {
            return "No skills directory found."
          }
          if (dirs.length === 0) return "No skills installed."
          return dirs.map((d) => {
            const name = d.split("/")[0]
            const round = reviewRounds.get(name)
            const status = round ? `reviewing (round ${round}/${MAX_ROUNDS})` : "installed"
            return `- ${name}: ${status}`
          }).join("\n")
        },
      }),
```

- [ ] **Step 3: 验证编译**

Run: `bun build --no-bundle .opencode/plugins/skill-harness.ts`
Expected: 无错误。

- [ ] **Step 4: 提交**

```
git add .opencode/plugins/skill-harness.ts
git commit -m "feat: add skill_mark_complete (3-layer feedback) and skill_status"
```

---

## Chunk 4: 更新 `find-skills` SKILL.md

### Task 5: 更新 `find-skills/SKILL.md`

**Files:**
- 修改: `.opencode/skills/find-skills/SKILL.md`

- [ ] **Step 1: 重写 SKILL.md**

替换 `.opencode/skills/find-skills/SKILL.md` 全部内容为：

```markdown
---
name: find-skills
description: 'Helps users discover and install agent skills when they ask questions like "how do I do X", "find a skill for X", "is there a skill that can...", or express interest in extending capabilities. This skill should be used when the user is looking for functionality that might exist as an installable skill.'
---

# Find Skills

使用以下 custom tools 完成 skill 的发现和安装：

1. `skill_search({ query: "关键词" })` -- 搜索可用的 skills
2. `skill_install({ name, skill_md_content, auxiliary_files? })` -- 安装到项目
3. `skill_mark_complete({ name })` -- 触发审查，确认安装完成
4. `skill_status()` -- 查看所有 skill 的安装状态

## 安装流程

1. 用 `skill_search` 搜索，或在 https://skills.sh/ / https://www.skillhub.club/skills 浏览
2. 获取 SKILL.md 内容和辅助文件
3. 调用 `skill_install` 安装（工具会自动校验并返回跨平台问题的修复指令）
4. 根据返回的修复指令修改文件
5. 调用 `skill_mark_complete` 触发最终审查
6. 如有问题继续修复，再次调用 `skill_mark_complete`，循环直到通过

## 未找到 Skill 时

1. 告知用户未找到匹配的 skill
2. 直接用通用能力帮助用户完成任务
3. 建议用户创建自定义 skill
```

- [ ] **Step 2: 提交**

```
git add .opencode/skills/find-skills/SKILL.md
git commit -m "refactor: simplify find-skills to reference skill harness tools"
```

---

## Chunk 5: 端到端验证

### Task 6: 验证完整流程

**Files:** 无文件变更，纯验证。

- [ ] **Step 1: 验证门控——未激活时 tool 描述为 [DISABLED]**

重启 opencode。在不加载 find-skills skill 的情况下，观察 tool 列表。
Expected: `skill_search`、`skill_install`、`skill_mark_complete`、`skill_status` 的描述均显示 `[DISABLED]...`

- [ ] **Step 2: 验证激活——调用 skill_search 自动激活**

加载 find-skills skill，然后调用 `skill_search({ query: "test" })`。
Expected: tool 执行成功（不被拦截），后续 `skill_install` 等 tool 的描述恢复正常。

- [ ] **Step 3: 验证前馈拒绝**

Run: `skill_install({ name: "BAD!", skill_md_content: "no frontmatter" })`
Expected:
- `ERROR: Invalid skill name "BAD!"`
- `ERROR: SKILL.md missing YAML frontmatter`
- `Installation rejected.`

- [ ] **Step 4: 验证安装 + 警告**

Run:
```
skill_install({
  name: "test-e2e",
  skill_md_content: "---\nname: test-e2e\ndescription: 'E2E test'\n---\n# Test",
  auxiliary_files: [{ path: "scripts/setup.sh", content: "#!/bin/bash\nset -e\necho hello" }]
})
```
Expected: 安装成功 + WARNING（.sh 文件 + set -e）

- [ ] **Step 5: 验证 skill_mark_complete 反馈循环**

Run: `skill_mark_complete({ name: "test-e2e" })`
Expected: `Review round 1/5` + ERROR（.sh 文件仍存在）

- [ ] **Step 6: 验证去激活**

删除 `.opencode/skills/test-e2e/scripts/setup.sh`，创建等效的 `.ts` 文件，再次调用 `skill_mark_complete`。
当返回 "Installation complete" 后，确认 `activeSessionID` 被清除（tool 描述重新变为 `[DISABLED]`）。

- [ ] **Step 7: 清理**

删除 `.opencode/skills/test-e2e/` 目录。无需提交。
