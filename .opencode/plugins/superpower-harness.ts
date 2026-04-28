import type { Plugin } from "@opencode-ai/plugin"

// ── 闭包状态 ────────────────────────────────────────────────────
let activeSessionID: string | null = null
let currentPrompt: string | null = null

// ── Plugin ──────────────────────────────────────────────────────
export const SuperpowerHarnessPlugin: Plugin = async ({
  project,
  client,
  $,
  directory,
  worktree,
}) => {
  return {
    // ── 拦截 /superpower 命令 ───────────────────────────────
    "command.execute.before": async (
      input: {
        command: string
        sessionID: string
        arguments: string
      },
      output: {
        parts: Array<{ type: string; [key: string]: any }>
      },
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

      // TODO: 在这里填充具体的 superpower 逻辑
      // 例如：加载 spec/plan、注入 harness 指令、触发自迭代流程等
      //
      // 当前行为：把 prompt 原样传递，附加 superpower 上下文标记
      output.parts.push({
        type: "text",
        text: [
          `[superpower] Task received.`,
          ``,
          currentPrompt,
        ].join("\n"),
      })
    },

    // ── 事件监听（预留扩展点）────────────────────────────────
    event: async ({ event }: { event: { type: string; properties?: any } }) => {
      // 命令执行完成后的回调
      if (
        event.type === "command.executed" &&
        event.properties?.name === "superpower"
      ) {
        // TODO: post-execution logic
      }

      // session idle 时的清理/续推
      if (event.type === "session.idle" && activeSessionID) {
        // TODO: 决定是否继续推动任务、清理状态等
      }
    },
  }
}
