# Harness Engineering Reference Articles

A curated collection of key articles on harness engineering for AI coding agents.

## Articles

| # | Title | Author | Date | Source |
|---|-------|--------|------|--------|
| 01 | [Harness Engineering for Coding Agent Users](01-fowler-harness-engineering.md) | Birgitta Böckeler | 2026-04-02 | [martinfowler.com](https://martinfowler.com/articles/harness-engineering.html) |
| 02 | [The Anatomy of an Agent Harness](02-langchain-anatomy-of-agent-harness.md) | Vivek Trivedy | 2026-03-10 | [blog.langchain.com](https://blog.langchain.com/the-anatomy-of-an-agent-harness/) |
| 03 | [Effective Harnesses for Long-Running Agents](03-anthropic-effective-harnesses.md) | Anthropic Engineering | 2025-11-26 | [anthropic.com](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) |
| 04 | [Context Engineering for Coding Agents](04-fowler-context-engineering.md) | Birgitta Böckeler | 2026-02-05 | [martinfowler.com](https://martinfowler.com/articles/exploring-gen-ai/context-engineering-coding-agents.html) |
| 05 | [The Role of Developer Skills in Agentic Coding](05-fowler-developer-skills-failure-modes.md) | Birgitta Böckeler | 2025-03-25 | [martinfowler.com](https://martinfowler.com/articles/exploring-gen-ai/13-role-of-developer-skills.html) |
| 06 | [Minions: Stripe's One-Shot End-to-End Coding Agents](06-stripe-minions.md) | Alistair Gray | 2026-02-09 | [stripe.dev](https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents) |
| 07 | [Approved Fixtures Pattern](07-approved-fixtures-pattern.md) | Ivett Ördög | — | [lexler.github.io](https://lexler.github.io/augmented-coding-patterns/patterns/approved-scenarios/) |
| 08 | [Engineering: Harnessing Codex in an Agent-First World](08-openai-harness-engineering.md) | Ryan Lopopolo | 2026-02-11 | [openai.com](https://openai.com/index/harness-engineering/) |

## One-line Summaries

1. **Fowler / Harness Engineering** — A cybernetics-inspired mental model of feedforward guides and feedback sensors (computational vs inferential) for steering coding agents toward quality code.
2. **LangChain / Anatomy of an Agent Harness** — Derives core harness components (filesystem, bash, sandboxes, memory, context management, long-horizon execution) working backwards from what models cannot do alone.
3. **Anthropic / Effective Harnesses** — A two-part initializer + coding agent pattern that enables consistent incremental progress across many context windows for long-running tasks.
4. **Fowler / Context Engineering** — A primer on coding agent context configuration: reusable prompts, context interfaces, who decides to load, and a Claude Code feature-by-feature walkthrough.
5. **Fowler / Developer Skills & Failure Modes** — Catalogues real-world AI coding missteps across three impact radiuses (commit, iteration, maintainability) and safeguards against them.
6. **Stripe / Minions** — Stripe's homegrown one-shot coding agents producing 1000+ merged PRs/week, with pre-push hooks, shift-left feedback, and blueprint-driven workflows.
7. **Approved Fixtures Pattern** — A testing pattern where humans review input/output fixture files rather than AI-generated test code, reducing review burden while maintaining correctness.
8. **OpenAI / Harnessing Codex** — OpenAI 团队从空仓库开始用 Codex 构建百万行代码产品的实战经验：AGENTS.md 作为目录、渐进式披露、自定义 linter 注入修复指令、架构不变式强制执行、垃圾收集式技术债务管理。
