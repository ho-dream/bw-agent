import { type Plugin, tool } from "@opencode-ai/plugin"
import path from "path"

// ── 闭包状态 ────────────────────────────────────────────────────
let activeSessionID: string | null = null
let pendingSkillName: string | null = null
let idlePromptSent = false
let waitingForHuman = false
const reviewRounds = new Map<string, number>()
const MAX_ROUNDS = 5
const TOOL_TIMEOUT_MS = 30_000

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

// ── 状态重置 ────────────────────────────────────────────────────
function deactivate() {
  activeSessionID = null
  pendingSkillName = null
  idlePromptSent = false
  waitingForHuman = false
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("TIMEOUT")), ms)
    }),
  ])
}

function timed<T>(promise: Promise<T>): Promise<T> {
  return withTimeout(promise, TOOL_TIMEOUT_MS).catch((err) => {
    if (err instanceof Error && err.message === "TIMEOUT") {
      deactivate()
      throw new Error(`Tool execution timed out after ${TOOL_TIMEOUT_MS / 1000}s. Harness session deactivated.`)
    }
    throw err
  })
}

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

// ── Plugin ──────────────────────────────────────────────────────
export const SkillHarnessPlugin: Plugin = async ({ project, client, $, directory, worktree }) => {
  return {
    // ── 门控：控制 tool 对 LLM 的可见性 ─────────────────────
    "tool.definition": async (
      input: { toolID: string },
      output: { description: string; parameters: any },
    ) => {
      if (SKILL_TOOL_IDS.includes(input.toolID) && !activeSessionID) {
        output.description =
          "[DISABLED] Only available during skill installation workflow. Load the find-skills skill to activate."
      }
    },

    // ── 门控：未激活时硬拒绝 + AI 响应时重置 idle 防重入 ────
    "tool.execute.before": async (
      input: { tool: string; sessionID: string; callID: string },
      output: { args: any },
    ) => {
      if (SKILL_TOOL_IDS.includes(input.tool) && !activeSessionID) {
        throw new Error("Skill tools are disabled. Load the find-skills skill first.")
      }
      if (SKILL_TOOL_IDS.includes(input.tool)) {
        idlePromptSent = false
      }
    },

    // ── 激活：检测 find-skills skill 被加载 ─────────────────
    "tool.execute.after": async (
      input: { tool: string; sessionID: string; callID: string; args: any },
      output: { title: string; output: string; metadata: any },
    ) => {
      if (input.tool === "skill" && input.args?.name === "find-skills") {
        activeSessionID = input.sessionID
      }
    },

    // ── 监控：session idle 时检查工作流是否完成 ──────────────
    event: async ({ event }: { event: { type: string } }) => {
      if (event.type === "session.idle" && activeSessionID && pendingSkillName) {
        if (idlePromptSent || waitingForHuman) return
        idlePromptSent = true
        const skillName = pendingSkillName
        try {
          await client.session.prompt({
            path: { id: activeSessionID },
            body: {
              parts: [
                {
                  type: "text",
                  text: `Skill installation workflow for "${skillName}" is still in progress. You must complete the Ralph Loop: fix any remaining issues and call skill_mark_complete({ name: "${skillName}" }). Do not stop until skill_mark_complete returns "Installation complete".`,
                },
              ],
            },
          })
        } catch {
          deactivate()
        }
      } else if (event.type === "session.idle" && activeSessionID && !pendingSkillName) {
        deactivate()
      }
    },

    // ── Custom Tools ────────────────────────────────────────────
    tool: {
      skill_search: tool({
        description:
          "Search for installable agent skills by keyword. Returns structured results with install instructions.",
        args: {
          query: tool.schema.string().describe("Search keywords, e.g. 'react testing', 'git hooks'"),
        },
        async execute(args, context) {
          return timed((async () => {
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
          })())
        },
      }),

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
          return timed((async () => {
            const { worktree: wt } = context
            const fs = await import("fs/promises")
            const errors: string[] = []
            const warnings: string[] = []

            errors.push(...validateName(args.name))
            const fmResult = validateFrontmatter(args.skill_md_content, args.name)
            errors.push(...fmResult.errors)
            warnings.push(...fmResult.warnings)

            if (errors.length > 0) {
              return errors.join("\n\n") + "\n\nInstallation rejected. Fix the errors above and call skill_install again."
            }

            pendingSkillName = args.name
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

            const allFiles: FileEntry[] = [{ path: "SKILL.md", content: args.skill_md_content }]
            if (args.auxiliary_files) allFiles.push(...args.auxiliary_files)
            warnings.push(...scanForBashIssues(allFiles))

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
          })())
        },
      }),

      skill_mark_complete: tool({
        description:
          "Finalize skill installation. Runs computational checks: (1) file scan for cross-platform issues, (2) frontmatter validation. Returns fix instructions if issues remain.",
        args: {
          name: tool.schema.string().describe("Skill name to finalize"),
          human_feedback: tool.schema.string().optional().describe("Feedback from human after escalation. Providing this resets the review round counter."),
        },
        async execute(args, context) {
          return timed((async () => {
            const { worktree: wt } = context
            const fs = await import("fs/promises")
            const { glob } = await import("glob")
            const skillDir = path.join(wt, ".opencode", "skills", args.name)

            if (args.human_feedback && args.human_feedback !== "TERMINATE") {
              reviewRounds.set(args.name, 0)
              waitingForHuman = false
            }

            const round = (reviewRounds.get(args.name) ?? 0) + 1
            reviewRounds.set(args.name, round)

            if (round >= MAX_ROUNDS) {
              waitingForHuman = true
              return [
                `⚠ Skill "${args.name}" reached max review rounds (${MAX_ROUNDS}). Remaining issues:`,
                "",
                "Use the question tool to ask the user:",
                "  header: \"Skill 审查升级\"",
                `  question: Describe the remaining issues and ask how to proceed.`,
                "  options:",
                `    - label: \"终止安装\" — description: \"Accept the skill as-is and terminate\"`,
                `    (Do NOT add an option for providing feedback — let the user type their own answer via the built-in custom input)`,
                "",
                "If the user types feedback:",
                `  1. Apply their feedback to fix the skill files`,
                `  2. Call skill_mark_complete({ name: "${args.name}", human_feedback: "<user's feedback>" }) to reset round counter and continue`,
                "",
                "If the user chooses 终止安装:",
                `  Call skill_mark_complete({ name: "${args.name}", human_feedback: "TERMINATE" })`,
              ].join("\n")
            }

            if (args.human_feedback === "TERMINATE") {
              reviewRounds.delete(args.name)
              deactivate()
              return `Skill "${args.name}" installation terminated by user. Manual review recommended.`
            }

            const issues: string[] = []

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

            const skillMdPath = path.join(skillDir, "SKILL.md")
            let skillContent: string
            try {
              skillContent = await fs.readFile(skillMdPath, "utf-8")
            } catch {
              issues.push(`ERROR: SKILL.md not found.\nFIX: Ensure SKILL.md exists in .opencode/skills/${args.name}/`)
              return [
                `Review round ${round}/${MAX_ROUNDS} for "${args.name}":`,
                "",
                ...issues,
                "",
                `Fix these issues and call skill_mark_complete({ name: "${args.name}" }) again.`,
              ].join("\n")
            }

            const fmMatch = skillContent.match(/^---\r?\n([\s\S]*?)\r?\n---/)
            if (!fmMatch || !fmMatch[1].includes("name:") || !fmMatch[1].includes("description:")) {
              issues.push(`ERROR: SKILL.md frontmatter is invalid or incomplete.\nFIX: Ensure frontmatter contains both "name" and "description" fields.`)
            }

            if (issues.length === 0) {
              reviewRounds.delete(args.name)
              deactivate()
              return `Skill "${args.name}" passed all checks (round ${round}). Installation complete.`
            }

            return [
              `Review round ${round}/${MAX_ROUNDS} for "${args.name}":`,
              "",
              ...issues,
              "",
              `Fix these issues and call skill_mark_complete({ name: "${args.name}" }) again.`,
            ].join("\n")
          })())
        },
      }),

      skill_status: tool({
        description: "List all installed skills in .opencode/skills/ and their review status.",
        args: {},
        async execute(args, context) {
          return timed((async () => {
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
            return dirs
              .map((d) => {
                const name = d.split("/")[0]
                const round = reviewRounds.get(name)
                const status = round ? `reviewing (round ${round}/${MAX_ROUNDS})` : "installed"
                return `- ${name}: ${status}`
              })
              .join("\n")
          })())
        },
      }),
    },
  }
}
