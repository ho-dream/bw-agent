# OpenCode Plugins Documentation

> Source: https://opencode.ai/docs/plugins/

Plugins allow you to extend OpenCode by hooking into various events and customizing behavior. You can create plugins to add new features, integrate with external services, or modify OpenCode's default behavior.

## Use a Plugin

### From Local Files

Place JavaScript or TypeScript files in the plugin directory.

- `.opencode/plugins/` - Project-level plugins
- `~/.config/opencode/plugins/` - Global plugins

Files in these directories are automatically loaded at startup.

### From npm

Specify npm packages in your config file.

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-helicone-session", "opencode-wakatime", "@my-org/custom-plugin"]
}
```

### How Plugins Are Installed

**npm plugins** are installed automatically using Bun at startup. Packages and their dependencies are cached in `~/.cache/opencode/node_modules/`.

**Local plugins** are loaded directly from the plugin directory. To use external packages, you must create a `package.json` within your config directory, or publish the plugin to npm and add it to your config.

### Load Order

1. Global config (`~/.config/opencode/opencode.json`)
2. Project config (`opencode.json`)
3. Global plugin directory (`~/.config/opencode/plugins/`)
4. Project plugin directory (`.opencode/plugins/`)

Duplicate npm packages with the same name and version are loaded once.

## Create a Plugin

### Dependencies

Add a `package.json` to your config directory with the dependencies you need.

```json
{
  "dependencies": {
    "shescape": "^2.1.0"
  }
}
```

OpenCode runs `bun install` at startup to install these.

### Basic Structure

```typescript
export const MyPlugin = async ({ project, client, $, directory, worktree }) => {
  console.log("Plugin initialized!")
  return {
    // Hook implementations go here
  }
}
```

The plugin function receives:

- `project`: The current project information.
- `directory`: The current working directory.
- `worktree`: The git worktree path.
- `client`: An opencode SDK client for interacting with the AI.
- `$`: Bun's shell API for executing commands.

### TypeScript Support

```typescript
import type { Plugin } from "@opencode-ai/plugin"
export const MyPlugin: Plugin = async ({ project, client, $, directory, worktree }) => {
  return {
    // Type-safe hook implementations
  }
}
```

## Events

- **Command Events**: `command.executed`
- **File Events**: `file.edited`, `file.watcher.updated`
- **Installation Events**: `installation.updated`
- **LSP Events**: `lsp.client.diagnostics`, `lsp.updated`
- **Message Events**: `message.part.removed`, `message.part.updated`, `message.removed`, `message.updated`
- **Permission Events**: `permission.asked`, `permission.replied`
- **Server Events**: `server.connected`
- **Session Events**: `session.created`, `session.compacted`, `session.deleted`, `session.diff`, `session.error`, `session.idle`, `session.status`, `session.updated`
- **Todo Events**: `todo.updated`
- **Shell Events**: `shell.env`
- **Tool Events**: `tool.execute.after`, `tool.execute.before`
- **TUI Events**: `tui.prompt.append`, `tui.command.execute`, `tui.toast.show`

## Examples

### Send Notifications

```typescript
export const NotificationPlugin = async ({ project, client, $, directory, worktree }) => {
  return {
    event: async ({ event }) => {
      if (event.type === "session.idle") {
        await $`osascript -e 'display notification "Session completed!" with title "opencode"'`
      }
    },
  }
}
```

### .env Protection

```typescript
export const EnvProtection = async ({ project, client, $, directory, worktree }) => {
  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool === "read" && output.args.filePath.includes(".env")) {
        throw new Error("Do not read .env files")
      }
    },
  }
}
```

### Inject Environment Variables

```typescript
export const InjectEnvPlugin = async () => {
  return {
    "shell.env": async (input, output) => {
      output.env.MY_API_KEY = "secret"
      output.env.PROJECT_ROOT = input.cwd
    },
  }
}
```

### Custom Tools (via Plugin)

```typescript
import { type Plugin, tool } from "@opencode-ai/plugin"
export const CustomToolsPlugin: Plugin = async (ctx) => {
  return {
    tool: {
      mytool: tool({
        description: "This is a custom tool",
        args: {
          foo: tool.schema.string(),
        },
        async execute(args, context) {
          const { directory, worktree } = context
          return `Hello ${args.foo} from ${directory} (worktree: ${worktree})`
        },
      }),
    },
  }
}
```

### Logging

```typescript
export const MyPlugin = async ({ client }) => {
  await client.app.log({
    body: {
      service: "my-plugin",
      level: "info",
      message: "Plugin initialized",
      extra: { foo: "bar" },
    },
  })
}
```

### Compaction Hooks

```typescript
import type { Plugin } from "@opencode-ai/plugin"
export const CompactionPlugin: Plugin = async (ctx) => {
  return {
    "experimental.session.compacting": async (input, output) => {
      output.context.push(`## Custom Context
Include any state that should persist across compaction:
- Current task status
- Important decisions made
- Files being actively worked on`)
    },
  }
}
```
