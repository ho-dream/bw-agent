# OpenCode Tools Documentation

> Source: https://opencode.ai/docs/tools/

Tools allow the LLM to perform actions in your codebase. OpenCode comes with built-in tools, and you can extend with custom tools or MCP servers.

## Configure

```json
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    "edit": "deny",
    "bash": "ask",
    "webfetch": "allow"
  }
}
```

## Built-in Tools

| Tool          | Description                                      |
| ------------- | ------------------------------------------------ |
| `bash`        | Execute shell commands                           |
| `edit`        | Modify existing files using exact string replacements |
| `write`       | Create new files or overwrite existing ones      |
| `read`        | Read file contents                               |
| `grep`        | Search file contents using regular expressions   |
| `glob`        | Find files by pattern matching                   |
| `lsp`         | Interact with LSP servers (experimental)         |
| `apply_patch` | Apply patches to files                           |
| `skill`       | Load a SKILL.md file into conversation           |
| `todowrite`   | Manage todo lists during sessions                |
| `webfetch`    | Fetch web content                                |
| `websearch`   | Search the web using Exa AI                      |
| `question`    | Ask the user questions during execution          |

## Permissions

- `"ask"` — Prompt for approval before running
- `"allow"` — Allow without approval
- `"deny"` — Disable the tool

## Ignore Patterns

Tools like `grep` and `glob` use ripgrep which respects `.gitignore`. Create a `.ignore` file to override:

```
!node_modules/
!dist/
!build/
```
