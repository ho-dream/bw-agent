import type { Plugin, PluginInput } from "@opencode-ai/plugin"
import path from "path"

// ── 配置 ────────────────────────────────────────────────────────
const SKILLS_DIR = path.join(".opencode", "plugins", "superpower-harness", "skills")
const CLASSIFY_MAX_ROUNDS = 3
const VALID_CATEGORIES = ["feature", "bugfix", "skill-creation"] as const

// 子任务（分类等）使用的模型，设为 null 则跟随主 session 的默认模型
const SUBTASK_MODEL: { providerID: string; modelID: string } | null = {
  providerID: "anthropic",
  modelID: "claude-sonnet-4-20250514",
}

// ── SDK 类型补充 ────────────────────────────────────────────────
// opencode SDK client 类型
type Client = PluginInput["client"]

// v1 SDK 的 SessionPromptData.body 不包含 format 字段，
// 但运行时支持（v2 SDK 已声明）。用此类型扩展 body 以通过类型检查。
interface OutputFormat {
  type: "json_schema"
  schema: Record<string, unknown>
}

interface PromptBodyWithFormat {
  parts: Array<{ type: string; text: string }>
  format?: OutputFormat
  model?: { providerID: string; modelID: string }
}

// session.prompt() 返回值中，structured output 的运行时字段
// v2 SDK 类型为 AssistantMessage.structured?: unknown
interface PromptResultData {
  info?: {
    structured?: unknown
  }
}

interface ClassifyOutput {
  category: string
}

function getStructuredOutput(data: PromptResultData | undefined): ClassifyOutput | null {
  const raw = data?.info?.structured
  if (raw == null || typeof raw !== "object") return null
  return raw as ClassifyOutput
}

// 封装 session.prompt 调用，绕过 v1 SDK body 类型限制
async function promptSession(
  client: Client,
  sessionID: string,
  body: PromptBodyWithFormat,
) {
  return client.session.prompt({
    path: { id: sessionID },
    body: body as Parameters<Client["session"]["prompt"]>[0]["body"],
  })
}

// ── DAG 节点定义 ────────────────────────────────────────────────
type DagNode =
  | "idle"
  | "entry-router"
  | "brainstorming"
  | "writing-plans"
  | "execution-router"
  | "subagent-driven-development"
  | "executing-plans"
  | "using-git-worktrees"
  | "test-driven-development"
  | "requesting-code-review"
  | "receiving-code-review"
  | "systematic-debugging"
  | "writing-skills"
  | "dispatching-parallel-agents"
  | "verification-before-completion"
  | "finishing-a-development-branch"
  | "done"

// ── DAG 边定义 ──────────────────────────────────────────────────
interface DagEdge {
  inject: string | null
  companions: string[]
  next: (ctx: DagContext) => DagNode
}

interface DagContext {
  prompt: string
  entryPath: "feature" | "bugfix" | "skill-creation"
  executionMode: "subagent" | "inline" | null
}

const DAG: Record<string, DagEdge> = {
  "entry-router": {
    inject: null,
    companions: [],
    next: (ctx) => {
      if (ctx.entryPath === "bugfix") return "systematic-debugging"
      if (ctx.entryPath === "skill-creation") return "writing-skills"
      return "brainstorming"
    },
  },

  "brainstorming": {
    inject: "brainstorming",
    companions: [],
    next: () => "writing-plans",
  },

  "writing-plans": {
    inject: "writing-plans",
    companions: [],
    next: () => "execution-router",
  },

  "execution-router": {
    inject: null,
    companions: [],
    next: (ctx) => {
      if (ctx.executionMode === "inline") return "executing-plans"
      return "subagent-driven-development"
    },
  },

  "subagent-driven-development": {
    inject: "subagent-driven-development",
    companions: ["using-git-worktrees", "test-driven-development"],
    next: () => "requesting-code-review",
  },

  "executing-plans": {
    inject: "executing-plans",
    companions: ["using-git-worktrees"],
    next: () => "verification-before-completion",
  },

  "requesting-code-review": {
    inject: "requesting-code-review",
    companions: ["receiving-code-review"],
    next: () => "verification-before-completion",
  },

  "verification-before-completion": {
    inject: "verification-before-completion",
    companions: [],
    next: () => "finishing-a-development-branch",
  },

  "finishing-a-development-branch": {
    inject: "finishing-a-development-branch",
    companions: ["using-git-worktrees"],
    next: () => "done",
  },

  "systematic-debugging": {
    inject: "systematic-debugging",
    companions: ["test-driven-development"],
    next: () => "verification-before-completion",
  },

  "writing-skills": {
    inject: "writing-skills",
    companions: ["test-driven-development"],
    next: () => "verification-before-completion",
  },

  "dispatching-parallel-agents": {
    inject: "dispatching-parallel-agents",
    companions: [],
    next: () => "verification-before-completion",
  },
}

// ── 入口分类：子 session + Ralph Loop ───────────────────────────

type EntryPath = DagContext["entryPath"]

function validateCategory(data: PromptResultData | undefined): EntryPath | null {
  const output = getStructuredOutput(data)
  if (!output) return null
  if (!VALID_CATEGORIES.includes(output.category as EntryPath)) return null
  return output.category as EntryPath
}

async function classifyPrompt(
  client: Client,
  prompt: string,
): Promise<EntryPath> {
  const session = await client.session.create({
    body: { title: "superpower-classify" },
  })
  if (!session.data) {
    throw new Error(`classifyPrompt: failed to create sub-session. Error: ${JSON.stringify(session.error)}`)
  }
  const sessionID = session.data.id

  const format = {
    type: "json_schema" as const,
    schema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["feature", "bugfix", "skill-creation"],
        },
      },
      required: ["category"],
    },
  }

  // 首次分类请求
  let result = await promptSession(client, sessionID, {
    parts: [
      {
        type: "text",
        text: [
          `Classify the following task into exactly one category.`,
          ``,
          `Task: ${prompt}`,
          ``,
          `Categories:`,
          `- "feature": Building something new, adding functionality, refactoring, improving existing code`,
          `- "bugfix": Fixing a bug, resolving an error, debugging a failure, something is broken or not working`,
          `- "skill-creation": Creating, writing, or modifying an agent skill file`,
        ].join("\n"),
      },
    ],
    format,
    ...(SUBTASK_MODEL && { model: SUBTASK_MODEL }),
  })

  let category = validateCategory(result.data as PromptResultData)
  if (category) return category

  // Ralph Loop：同一个子 session 中修复（有之前对话的完整上下文）
  for (let round = 1; round <= CLASSIFY_MAX_ROUNDS; round++) {
    const received = getStructuredOutput(result.data as PromptResultData)

    result = await promptSession(client, sessionID, {
      parts: [
        {
          type: "text",
          text: [
            `Your classification response was invalid.`,
            ``,
            `Received: ${JSON.stringify(received)}`,
            ``,
            `You must return a JSON object with a "category" field set to exactly one of: "feature", "bugfix", "skill-creation".`,
            ``,
            `Re-read the original task and classify it again.`,
          ].join("\n"),
        },
      ],
      format,
      ...(SUBTASK_MODEL && { model: SUBTASK_MODEL }),
    })

    category = validateCategory(result.data as PromptResultData)
    if (category) return category
  }

  const lastOutput = getStructuredOutput(result.data as PromptResultData)
  throw new Error(
    `classifyPrompt failed after ${CLASSIFY_MAX_ROUNDS} repair rounds. ` +
    `Last response: ${JSON.stringify(lastOutput)}`,
  )
}

// ── 闭包状态 ────────────────────────────────────────────────────
let activeSessionID: string | null = null
let currentPrompt: string | null = null
let dagState: DagNode = "idle"
let dagContext: DagContext = { prompt: "", entryPath: "feature", executionMode: null }

function reset() {
  activeSessionID = null
  currentPrompt = null
  dagState = "idle"
  dagContext = { prompt: "", entryPath: "feature", executionMode: null }
}

// ── 读取 skill 文件 ─────────────────────────────────────────────
async function readSkill(worktree: string, skillName: string): Promise<string | null> {
  const fs = await import("fs/promises")
  const skillPath = path.join(worktree, SKILLS_DIR, skillName, "SKILL.md")
  try {
    const content = await fs.readFile(skillPath, "utf-8")
    return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trim()
  } catch {
    return null
  }
}

// ── 构建 DAG 节点的注入内容 ─────────────────────────────────────
async function buildNodeInjection(worktree: string, node: DagNode): Promise<string | null> {
  const edge = DAG[node]
  if (!edge || !edge.inject) return null

  const sections: string[] = []

  const mainContent = await readSkill(worktree, edge.inject)
  if (mainContent) {
    sections.push(`<skill name="${edge.inject}">\n${mainContent}\n</skill>`)
  }

  for (const companion of edge.companions) {
    const companionContent = await readSkill(worktree, companion)
    if (companionContent) {
      sections.push(`<skill name="${companion}" role="companion">\n${companionContent}\n</skill>`)
    }
  }

  return sections.length > 0 ? sections.join("\n\n") : null
}

// ── 推进 DAG：穿透虚拟节点 ──────────────────────────────────────
function advanceDag(): DagNode {
  let current = dagState
  while (true) {
    const edge = DAG[current]
    if (!edge) return "done"
    const next = edge.next(dagContext)
    if (next === "done") return "done"

    const nextEdge = DAG[next]
    if (!nextEdge) return "done"

    if (nextEdge.inject === null) {
      current = next
      continue
    }

    return next
  }
}

// ── Plugin ──────────────────────────────────────────────────────
export const SuperpowerHarnessPlugin: Plugin = async ({
  project,
  client,
  $,
  directory,
  worktree,
}) => {
  return {
    // ── 拦截 /superpower，子 session 分类，注入第一个 skill ──
    "command.execute.before": async (
      input: { command: string; sessionID: string; arguments: string },
      output: { parts: Array<{ type: string; text?: string; [key: string]: unknown }> },
    ) => {
      if (input.command !== "superpower") return

      activeSessionID = input.sessionID
      currentPrompt = input.arguments.trim()

      if (!currentPrompt) {
        output.parts.push({
          type: "text",
          text: "Usage: /superpower <task description>",
        })
        activeSessionID = null
        return
      }

      // 子 session 分类（含 Ralph Loop 修复）
      const entryPath = await classifyPrompt(client, currentPrompt)
      dagContext = { prompt: currentPrompt, entryPath, executionMode: null }

      // 从 entry-router 出发，穿透到第一个实际节点
      dagState = "entry-router"
      const firstNode = advanceDag()
      dagState = firstNode

      // 注入 prompt + 第一个 skill
      const sections: string[] = [currentPrompt]
      const injection = await buildNodeInjection(worktree, firstNode)
      if (injection) {
        sections.push(injection)
      }

      output.parts.push({
        type: "text",
        text: sections.join("\n\n"),
      })
    },

    // ── DAG 流转：session idle 时推进到下一节点 ─────────────
    event: async ({ event }: { event: { type: string; properties?: Record<string, unknown> } }) => {
      if (event.type !== "session.idle" || !activeSessionID) return
      if (dagState === "idle" || dagState === "done") {
        if (dagState === "done") reset()
        return
      }

      const nextNode = advanceDag()

      if (nextNode === "done") {
        dagState = "done"
        reset()
        return
      }

      dagState = nextNode

      const injection = await buildNodeInjection(worktree, nextNode)
      if (!injection) return

      await client.session.prompt({
        path: { id: activeSessionID },
        body: {
          parts: [{ type: "text", text: injection }],
        },
      })
    },
  }
}
