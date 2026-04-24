# Skill Installation Harness 设计文档 (v3)

> 修订自 v2，新增 tool 生命周期门控层。
> v2→v3 核心变化：tool 不再常驻，通过 `tool.definition` + `tool.execute.before` 实现按需激活/隐藏。

## 设计原则

来自参考文献的核心洞察：

1. **前馈优先于反馈**（Fowler）：在行动前注入约束，比事后检测更便宜
2. **linter 错误信息 = 修复指令**（OpenAI）：检测到问题的同时告诉智能体怎么修，正向 prompt injection
3. **Keep quality left**（Fowler/Stripe）：越早拦截成本越低
4. **Ralph Loop > 状态机**（LangChain/Anthropic）：循环直到完成，状态隐含在返回值中
5. **计算性 > 推断性**（Fowler）：确定性检查优先，LLM 审查兜底
6. **按需可见**（v3 新增）：tool 只在工作流激活时对 LLM 可见，避免污染其他场景的工具列表

## 架构总览

```
AI 加载 find-skills skill → 看到指令 → 调用 skill_search
    │
    ▼
tool.execute.before 检测到 skill_* tool 被调用
    │
    ▼ 自动激活（设置 activeSessionID）
    │
    ├─ tool.definition: skill_* tools 恢复正常描述
    ├─ tool.execute.before: skill_* tools 允许执行
    │
    ▼
┌─────────────────────────────┐
│        skill_search         │  搜索（确定性工具调用）
└──────────────┬──────────────┘
               │
┌──────────────▼──────────────┐
│        skill_install        │  安装 + 计算性前馈拦截
│  ┌────────────────────────┐ │
│  │ name 合法性校验         │ │  ← 拒绝写入
│  │ frontmatter 必填校验    │ │  ← 拒绝写入
│  │ .sh 文件检测 + 警告     │ │  ← 写入但注入转译指令
│  │ bash 模式扫描 + 警告    │ │  ← 写入但注入修复指令
│  └────────────────────────┘ │
└──────────────┬──────────────┘
               │ 返回值包含 warnings
               │ AI 看到 warnings 后修复
┌──────────────▼──────────────┐
│     skill_mark_complete     │  触发反馈 sensors
│  ┌────────────────────────┐ │
│  │ 计算性: 文件扫描       │ │  ← 仍有 .sh? bash 模式?
│  │ 行为性: skill 加载测试 │ │  ← frontmatter 完整?
│  │ 推断性: LLM 审查       │ │  ← 风格/项目适配
│  └────────────────────────┘ │
└──────────────┬──────────────┘
         ┌─────┴─────┐
    有问题│           │无问题
         ▼            ▼
  返回修复指令    返回 "done"
  AI 修复后再次   → 清除 activeSessionID
  调用 mark_complete   → tool.definition: 描述变为 [DISABLED]
  (Ralph Loop)         → tool.execute.before: 拒绝执行
```

## Tool 生命周期门控（v3 新增）

### 问题

opencode 的 `Hooks.tool` 在 plugin 初始化时一次性注册，无法运行时增删。
但 skill 安装 tool 只在安装 skill 时需要，常驻会污染 LLM 工具列表。

### 方案

利用两个钩子实现「软门控」：

| 钩子 | 作用 | 限制 |
|---|---|---|
| `tool.definition` | 每次 LLM prompt 构建时触发，可修改 description | 无 sessionID，全局生效 |
| `tool.execute.before` | 每次 tool 执行前触发，可 throw 阻止 | 有 sessionID，可精确控制 |

### 激活/去激活

```typescript
// 闭包状态
let activeSessionID: string | null = null
const SKILL_TOOL_IDS = ["skill_search", "skill_install", "skill_mark_complete", "skill_status"]

// 激活触发：tool.execute.before 检测到任意 skill_* tool 被调用
// 去激活触发：skill_mark_complete 返回 "done" / session.idle 安全网
```

**非活跃时**：
- `tool.definition` → `output.description = "[DISABLED] Only available during skill installation workflow."`
- `tool.execute.before` → `throw new Error("Run /find-skills or load find-skills skill first.")`

**活跃时**：
- `tool.definition` → 不修改（保持原始描述）
- `tool.execute.before` → 放行，同时设置 `activeSessionID`（首次调用时）

### 作用域

- **可见性**（`tool.definition`）：全局——活跃时所有 session/sub-agent 都能看到 tool
- **执行权**（`tool.execute.before`）：可按 sessionID 精确控制（但目前不做，因为活跃期间 sub-agent 也需要用）
- **进程隔离**：不同 opencode 实例各自独立，闭包变量不共享

### 安全网

```typescript
// session.idle 事件清理
event: async ({ event }) => {
  if (event.type === "session.idle" && activeSessionID) {
    activeSessionID = null
  }
}
```

## 质量左移分层

| 时机 | 检查内容 | 类型 | 方式 |
|---|---|---|---|
| `skill_install` 写入时 | name 格式合法性 | 计算性前馈 | **拒绝写入**，返回错误 + 合法格式说明 |
| `skill_install` 写入时 | frontmatter 包含 name + description | 计算性前馈 | **拒绝写入**，返回错误 + 示例 frontmatter |
| `skill_install` 写入时 | name 与目录名一致 | 计算性前馈 | **拒绝写入**，返回错误 |
| `skill_install` 写入后 | .sh 文件存在 | 计算性前馈 | **写入但警告**，返回转译指令 |
| `skill_install` 写入后 | bash heredoc / bash-only 模式 | 计算性前馈 | **写入但警告**，返回修复指令 |
| `skill_install` 写入后 | 平台特定绝对路径 | 计算性前馈 | **写入但警告**，返回修复指令 |
| `skill_mark_complete` | 残留 .sh / bash 模式 | 计算性反馈 | 发现 → 返回修复指令 |
| `skill_mark_complete` | SKILL.md 存在 + frontmatter 完整 | 行为性反馈 | 文件读取验证 |
| `skill_mark_complete` | frontmatter 多余字段、风格一致性 | 推断性反馈 | LLM 子 session 审查 |

## Ralph Loop（无显式状态机）

状态隐含在 tool 调用链的返回值中：

- `skill_install` 返回 warnings → AI 知道需要修复
- `skill_mark_complete` 返回 issues → AI 知道需要继续修复
- `skill_mark_complete` 返回 "done" → 完成，去激活 tool

唯一维护的闭包状态：

```typescript
const reviewRounds = new Map<string, number>()  // 防无限循环
const MAX_ROUNDS = 5
let activeSessionID: string | null = null         // tool 门控
```

## 文件结构

```
.opencode/
  package.json                  # 依赖：@opencode-ai/plugin, glob
  plugins/
    skill-harness.ts            # 唯一文件：plugin + tools + hooks + 门控 + 审查逻辑
  skills/
    find-skills/
      SKILL.md                  # 指引 AI 使用 skill_search/skill_install/skill_mark_complete
    github-awesome-copilot-git-commit/
      SKILL.md
      scripts/
        commit.ts
```

所有 tool 和钩子内联在 plugin 中，共享闭包状态（`activeSessionID`、`reviewRounds`、`BASH_PATTERNS`、辅助函数）。

## find-skills SKILL.md

```markdown
---
name: find-skills
description: 'Helps users discover and install agent skills. Use when user asks "find a skill for X" or wants to extend agent capabilities.'
---

# Find Skills

使用以下 custom tools 完成 skill 的发现和安装：

1. `skill_search({ query: "关键词" })` — 搜索可用的 skills
2. `skill_install({ name, skill_md_content, auxiliary_files? })` — 安装到项目
3. `skill_mark_complete({ name })` — 触发审查，确认安装完成
4. `skill_status()` — 查看所有 skill 的安装状态

## 安装流程

1. 用 `skill_search` 搜索，或在 https://skills.sh/ / https://www.skillhub.club/skills 浏览
2. 获取 SKILL.md 内容和辅助文件
3. 调用 `skill_install` 安装（工具会自动校验并返回跨平台问题的修复指令）
4. 根据返回的修复指令修改文件
5. 调用 `skill_mark_complete` 触发最终审查
6. 如有问题继续修复，再次调用 `skill_mark_complete`，循环直到通过
```

## 与 v2 的关键差异

| 维度 | v2 | v3 |
|---|---|---|
| **Tool 可见性** | 始终注册，始终可见 | 始终注册，按需可见（`tool.definition` 门控） |
| **激活方式** | 无（tool 始终可用） | AI 调用任意 `skill_*` tool 时自动激活 |
| **去激活方式** | 无 | `skill_mark_complete` 返回 "done" + `session.idle` 安全网 |
| **文件数量** | 1 个 plugin 文件 | 仍然 1 个 plugin 文件（无需 TUI 插件） |

其余（前馈验证、三层反馈、Ralph Loop、LLM 审查 prompt）与 v2 完全一致。

## 依赖

- `@opencode-ai/plugin` — plugin API（已安装）
- `zod` — tool 参数校验（已随 plugin 安装）
- `glob` — 文件扫描（需新增到 `.opencode/package.json`）

无需 `@opencode-ai/sdk`（plugin 上下文已提供 `client`）。

## 技术调研备忘

> opencode tool 注册机制（详见 `packages/opencode/src/tool/registry.ts`）：
>
> - `Hooks.tool` 在 ToolRegistry init 时通过 `Object.entries()` 一次性枚举
> - 结果存入 `ScopedCache`（TTL=∞），后续 `all()` 返回缓存
> - **无法运行时增删 tool**，只能通过 `tool.definition` 修改描述/参数
> - `tool.definition` input 无 sessionID（全局），`tool.execute.before` input 有 sessionID
> - 不同 opencode 实例是独立进程，闭包状态不共享
