# Context Engineering for Coding Agents

> **Source:** <https://martinfowler.com/articles/exploring-gen-ai/context-engineering-coding-agents.html>
> **Author:** Birgitta Böckeler (Thoughtworks)
> **Date:** 5 February 2026
> **Tags:** context engineering, coding agents, Claude Code

---

## Overview

The number of options to configure and enrich a coding agent's context has exploded. Powerful context engineering is becoming a huge part of the developer experience.

> *"Context engineering is curating what the model sees so that you get a better result."* — Bharani Subramaniam

This article is a primer on context configuration features, using Claude Code as a detailed example.

---

## What is Context?

### Reusable Prompts

Almost all forms of AI coding context engineering ultimately involve markdown files with prompts. Two main categories:

- **Instructions** — Tell the agent to do something. *"Write an E2E test in the following way: ..."*
- **Guidance** (aka rules, guardrails) — General conventions the agent should follow. *"Always write tests that are independent of each other."*

These categories often blend but the distinction is useful.

### Context Interfaces

Descriptions for the LLM of how it can get even more context, should it decide to:

- **Tools** — Built-in capabilities like calling bash commands, searching files
- **MCP Servers** — Custom programs/scripts giving the agent access to data sources and actions
- **Skills** — Descriptions of additional resources, instructions, documentation, scripts that the LLM can load on demand when relevant

The more interfaces configured, the more space they take in context — think strategically about what's necessary for a particular task.

**Files in your workspace** — The most basic and powerful context interfaces are file reading and searching. Worth reflecting on how well existing code serves as context (AI-friendly codebase design).

---

## Who Decides to Load Context?

- **LLM** — Prerequisite for unsupervised agents. Uncertainty remains *if* the LLM will load context when we'd expect. Example: Skills
- **Human** — Gives control but reduces automation. Example: Slash commands
- **Agent software** — Triggered at deterministic points in time. Example: Claude Code hooks

---

## How Much: Keeping Context Small

Balance is key — not too little, not too much. Even with technically large context windows, indiscriminate information dumping hurts agent effectiveness and costs more.

Recommendations:
- Build context (like rules files) up gradually
- Don't front-load too much — models have gotten quite powerful
- Demand transparency about context fullness from your tools

Agent tools also optimise context under the hood: periodic conversation history compaction, optimised tool representations (e.g. Claude Code's Tool Search Tool).

---

## Example: Claude Code (January 2026)

### CLAUDE.md

- **What:** Guidance
- **Who decides to load:** Claude Code — always used at session start
- **When to use:** Most frequently repeated general conventions for the whole project
- **Examples:** "we use yarn, not npm", "activate the virtual environment before running anything"
- **Other assistants:** Basically all have a main rules file; standardisation attempts as `AGENTS.md`

### Rules

- **What:** Guidance
- **Who decides to load:** Claude Code, when files at configured paths are loaded
- **When to use:** Organise and modularise guidance; scope to file patterns (e.g. `*.ts`)
- **Examples:** "When writing bash scripts, variables should be `${var}` not `$var`" — paths: `**/*.sh`
- **Other assistants:** GH Copilot, Cursor support path-based rules

### Slash Commands *(deprecated, superseded by Skills)*

- **What:** Instructions
- **Who decides to load:** Human
- **When to use:** Common tasks with specific longer prompts, triggered manually
- **Examples:** `/code-review`, `/e2e-test`, `/prep-commit`

### Skills

- **What:** Guidance, instructions, documentation, scripts, ...
- **Who decides to load:** LLM (based on skill description) or Human
- **When to use:** Lazy-load guidance/instructions relevant to the task; can include additional resources and scripts in a skill's folder
- **Examples:** JIRA access via CLI, "Conventions for React components", "How to integrate the XYZ API"
- **Other assistants:** Cursor switching to Claude Code-style Skills

### Subagents

- **What:** Instructions + configuration of model and available tools; runs in its own context window, can be parallelised
- **Who decides to load:** LLM or Human
- **When to use:**
  - Larger tasks worth their own context (efficiency, improved results, cost reduction)
  - Tasks needing a different model than default
  - Tasks needing specific tools/MCP servers not always available
  - Orchestratable workflows
- **Examples:** E2E test creation, code review with a different model for "second opinion", swarm experiments (claude-flow, Gas Town)
- **Other assistants:** Roo Code modes, Cursor subagents, GH Copilot agent configuration (human-triggered only)

### MCP Servers

- **What:** Program giving the agent access to data sources and actions via Model Context Protocol
- **Who decides to load:** LLM
- **When to use:** Give agent access to an API or local tool. Trend: superceding some MCP functionality with skills that describe CLI/script usage.
- **Examples:** JIRA API access, Playwright MCP for browser navigation, local knowledge base access
- **Other assistants:** All common coding assistants support MCP

### Hooks

- **What:** Scripts
- **Who decides to load:** Claude Code lifecycle events
- **When to use:** Deterministic action on every file edit, command execution, MCP call, etc.
- **Examples:** Custom notifications, run prettier after JS file edits, observability logging
- **Other assistants:** Rare; Cursor starting to support

### Plugins

- **What:** A way to distribute all or any of these things
- **Examples:** Distribute common commands, skills and hooks to teams in an organisation

---

## Sharing Context Configurations

Challenges:
- Context of sharer and receiver must be as similar as possible (works within teams, not between strangers)
- Tendency to overengineer context with copied & pasted instructions — best built iteratively
- Different experience levels may need different rules/instructions
- Low awareness of copied context can lead to repeated or contradictory instructions, or blaming the agent for following *your* instructions

---

## Beware: Illusion of Control

> In spite of the name, ultimately this is not *really* engineering... Once the agent gets instructions and guidance, execution still depends on how well the LLM interprets them!

Context engineering can make agents more effective and increase probability of useful results. But phrases like "ensure it does X" or "prevent hallucinations" overstate the certainty. **We still need to think in probabilities** and choose the right level of human oversight.
