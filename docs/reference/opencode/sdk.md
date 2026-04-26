# OpenCode SDK Documentation

> Source: https://opencode.ai/docs/sdk/

The opencode JS/TS SDK provides a type-safe client for interacting with the server. Use it to build integrations and control opencode programmatically.

## Install

```bash
npm install @opencode-ai/sdk
```

## Create Client

```typescript
import { createOpencode } from "@opencode-ai/sdk"
const { client } = await createOpencode()
```

### Options

| Option     | Type          | Description            | Default     |
| ---------- | ------------- | ---------------------- | ----------- |
| `hostname` | `string`      | Server hostname        | `127.0.0.1` |
| `port`     | `number`      | Server port            | `4096`      |
| `signal`   | `AbortSignal` | Abort signal           | `undefined` |
| `timeout`  | `number`      | Timeout in ms          | `5000`      |
| `config`   | `Config`      | Configuration object   | `{}`        |

## Client Only

```typescript
import { createOpencodeClient } from "@opencode-ai/sdk"
const client = createOpencodeClient({
  baseUrl: "http://localhost:4096",
})
```

### Options

| Option          | Type       | Default              |
| --------------- | ---------- | -------------------- |
| `baseUrl`       | `string`   | `http://localhost:4096` |
| `fetch`         | `function` | `globalThis.fetch`   |
| `parseAs`       | `string`   | `auto`               |
| `responseStyle` | `string`   | `fields`             |
| `throwOnError`  | `boolean`  | `false`              |

## Types

```typescript
import type { Session, Message, Part } from "@opencode-ai/sdk"
```

## Structured Output

```typescript
const result = await client.session.prompt({
  path: { id: sessionId },
  body: {
    parts: [{ type: "text", text: "Research Anthropic and provide company info" }],
    format: {
      type: "json_schema",
      schema: {
        type: "object",
        properties: {
          company: { type: "string", description: "Company name" },
          founded: { type: "number", description: "Year founded" },
        },
        required: ["company", "founded"],
      },
    },
  },
})
console.log(result.data.info.structured_output)
```

## APIs

### Global

| Method            | Description                    |
| ----------------- | ------------------------------ |
| `global.health()` | Check server health and version |

### App

| Method          | Description              |
| --------------- | ------------------------ |
| `app.log()`     | Write a log entry        |
| `app.agents()`  | List all available agents |

### Project

| Method              | Description        |
| ------------------- | ------------------ |
| `project.list()`    | List all projects  |
| `project.current()` | Get current project |

### Sessions

| Method                                                          | Description              |
| --------------------------------------------------------------- | ------------------------ |
| `session.list()`                                                | List sessions            |
| `session.get({ path })`                                         | Get session              |
| `session.children({ path })`                                    | List child sessions      |
| `session.create({ body })`                                      | Create session           |
| `session.delete({ path })`                                      | Delete session           |
| `session.update({ path, body })`                                | Update session           |
| `session.init({ path, body })`                                  | Analyze & create AGENTS  |
| `session.abort({ path })`                                       | Abort session            |
| `session.share({ path })`                                       | Share session            |
| `session.summarize({ path, body })`                             | Summarize session        |
| `session.messages({ path })`                                    | List messages            |
| `session.message({ path })`                                     | Get message details      |
| `session.prompt({ path, body })`                                | Send prompt message      |
| `session.command({ path, body })`                               | Send command             |
| `session.shell({ path, body })`                                 | Run shell command        |
| `session.revert({ path, body })`                                | Revert a message         |

#### Key: session.prompt

```typescript
// Send a prompt and get AI response
const result = await client.session.prompt({
  path: { id: session.id },
  body: {
    model: { providerID: "anthropic", modelID: "claude-3-5-sonnet-20241022" },
    parts: [{ type: "text", text: "Hello!" }],
  },
})

// Inject context without triggering AI response
await client.session.prompt({
  path: { id: session.id },
  body: {
    noReply: true,
    parts: [{ type: "text", text: "You are a helpful assistant." }],
  },
})
```

### Files

| Method                     | Description          |
| -------------------------- | -------------------- |
| `find.text({ query })`     | Search text in files |
| `find.files({ query })`    | Find files by name   |
| `find.symbols({ query })`  | Find symbols         |
| `file.read({ query })`     | Read a file          |
| `file.status({ query? })`  | Get file status      |

### TUI

| Method                          | Description          |
| ------------------------------- | -------------------- |
| `tui.appendPrompt({ body })`    | Append to prompt     |
| `tui.submitPrompt()`            | Submit prompt        |
| `tui.clearPrompt()`             | Clear prompt         |
| `tui.executeCommand({ body })`  | Execute command      |
| `tui.showToast({ body })`       | Show toast           |

### Events

```typescript
const events = await client.event.subscribe()
for await (const event of events.stream) {
  console.log("Event:", event.type, event.properties)
}
```
