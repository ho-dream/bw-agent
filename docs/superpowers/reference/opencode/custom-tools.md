# OpenCode Custom Tools Documentation

> Source: https://opencode.ai/docs/custom-tools/

Custom tools are functions you create that the LLM can call during conversations. They work alongside opencode's built-in tools like `read`, `write`, and `bash`.

## Creating a Tool

Tools are defined as TypeScript or JavaScript files. However, the tool definition can invoke scripts written in any language.

### Location

- `.opencode/tools/` - Project-level
- `~/.config/opencode/tools/` - Global

### Structure

The easiest way is using the `tool()` helper:

```typescript
import { tool } from "@opencode-ai/plugin"
export default tool({
  description: "Query the project database",
  args: {
    query: tool.schema.string().describe("SQL query to execute"),
  },
  async execute(args) {
    return `Executed query: ${args.query}`
  },
})
```

The **filename** becomes the **tool name**.

### Multiple Tools Per File

Each export becomes a separate tool with the name `<filename>_<exportname>`:

```typescript
import { tool } from "@opencode-ai/plugin"
export const add = tool({
  description: "Add two numbers",
  args: {
    a: tool.schema.number().describe("First number"),
    b: tool.schema.number().describe("Second number"),
  },
  async execute(args) {
    return args.a + args.b
  },
})
export const multiply = tool({
  description: "Multiply two numbers",
  args: {
    a: tool.schema.number().describe("First number"),
    b: tool.schema.number().describe("Second number"),
  },
  async execute(args) {
    return args.a * args.b
  },
})
```

Creates tools `math_add` and `math_multiply`.

### Name Collisions

Custom tools override built-in tools with the same name. Use [permissions](/docs/permissions) to disable without overriding.

### Arguments

Use `tool.schema` (which is just Zod) to define argument types:

```typescript
args: {
  query: tool.schema.string().describe("SQL query to execute")
}
```

Or import Zod directly:

```typescript
import { z } from "zod"
export default {
  description: "Tool description",
  args: {
    param: z.string().describe("Parameter description"),
  },
  async execute(args, context) {
    return "result"
  },
}
```

### Context

Tools receive context about the current session:

```typescript
import { tool } from "@opencode-ai/plugin"
export default tool({
  description: "Get project information",
  args: {},
  async execute(args, context) {
    const { agent, sessionID, messageID, directory, worktree } = context
    return `Agent: ${agent}, Session: ${sessionID}, Directory: ${directory}, Worktree: ${worktree}`
  },
})
```

## Examples

### Tool in Python

```typescript
import { tool } from "@opencode-ai/plugin"
import path from "path"
export default tool({
  description: "Add two numbers using Python",
  args: {
    a: tool.schema.number().describe("First number"),
    b: tool.schema.number().describe("Second number"),
  },
  async execute(args, context) {
    const script = path.join(context.worktree, ".opencode/tools/add.py")
    const result = await Bun.$`python3 ${script} ${args.a} ${args.b}`.text()
    return result.trim()
  },
})
```
