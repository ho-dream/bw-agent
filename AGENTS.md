# AGENTS.md - Project Context & Long-term Memory

## 目标 (Goals)

用 harness 的方式复现 `~/Documents/experiment_area/bw-agent` 的成果——构建一个能让 AI 自迭代完成需求的黑灯工厂基础设施。

## 原则 (Principles)

- **黑灯工厂**: 全自主 AI 开发管线，最小化人工干预
- **模型自迭代**: AI 在 harness 框架内自行迭代完成需求，而非靠人指导每一步
- **开发者关注点**: 只关心 harness 基础设施本身是否足够支撑 AI 自主完成任务，不关注 AI 具体的任务产出
- **Harness 优先**: 所有能力的构建都围绕 harness 展开，而非围绕具体业务逻辑

## 技术选型

- **Runtime**: [opencode](https://opencode.ai) + opencode plugins

## OpenCode 记忆机制

本项目使用 opencode 的多级长期记忆体系，理解以下结构以正确扩展项目能力：

### Skills（技能）

技能放置在 `.opencode/skills/<name>/SKILL.md`，每个技能是一个独立的 `SKILL.md` 文件，包含 YAML frontmatter（`name`、`description` 必填）和 Markdown 正文指令。代理通过 `skill` 工具按需加载。

当本项目需要新增 skill 时，必须读取 `.opencode/skills/` 目录下已有的 skill 作为参考，遵循相同的 frontmatter 格式和编写风格。

### 记忆层级（优先级从高到低）

1. **项目级** — 项目根目录 `AGENTS.md`，随 Git 提交，团队共享
2. **项目级 Skills** — `.opencode/skills/<name>/SKILL.md`
3. **全局级** — `~/.config/opencode/AGENTS.md`，跨所有项目生效
4. **全局级 Skills** — `~/.config/opencode/skills/<name>/SKILL.md`

详见：https://opencode.ai/docs/zh-cn/skills/

## 参考项目

- **bw-agent**: `~/Documents/experiment_area/bw-agent` — 原始项目，harness 方式的复现目标
