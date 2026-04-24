# The Anatomy of an Agent Harness

> **Source:** <https://blog.langchain.com/the-anatomy-of-an-agent-harness/>
> **Author:** Vivek Trivedy (LangChain)
> **Date:** 10 March 2026
> **Tags:** agent architecture, harness engineering

---

## Core Definition

**Agent = Model + Harness.**

If you're not the model, you're the harness.

A harness is every piece of code, configuration, and execution logic that isn't the model itself. A raw model is not an agent — it becomes one when a harness gives it state, tool execution, feedback loops, and enforceable constraints.

Concretely, a harness includes:
- System Prompts
- Tools, Skills, MCPs + their descriptions
- Bundled Infrastructure (filesystem, sandbox, browser)
- Orchestration Logic (subagent spawning, handoffs, model routing)
- Hooks/Middleware for deterministic execution (compaction, continuation, lint checks)

---

## Why Harnesses Exist — From a Model's Perspective

Models take in data (text, images, audio, video) and output text. Out of the box they **cannot**:
- Maintain durable state across interactions
- Execute code
- Access realtime knowledge
- Set up environments and install packages

These are all **harness-level features**. The structure of LLMs requires machinery that wraps them to do useful work.

The key idea: **convert a desired agent behavior into an actual feature in the harness.**

---

## Core Harness Components

### 1. Filesystems for Durable Storage and Context Management

> *We want agents to have durable storage to interface with real data, offload information that doesn't fit in context, and persist work across sessions.*

The filesystem is arguably the most foundational harness primitive because of what it unlocks:
- Agents get a workspace to read data, code, and documentation
- Work can be incrementally added and offloaded instead of holding everything in context
- **The filesystem is a natural collaboration surface** — multiple agents and humans can coordinate through shared files

Git adds versioning so agents can track work, rollback errors, and branch experiments.

### 2. Bash + Code as a General Purpose Tool

> *We want agents to autonomously solve problems without humans needing to pre-design every tool.*

Instead of forcing users to build tools for every possible action, give agents a general-purpose tool like bash.

Bash + code execution is a big step towards **giving models a computer** and letting them figure out the rest. The model can design its own tools on the fly via code instead of being constrained to a fixed set.

Harnesses still ship with other tools, but code execution has become the default general-purpose strategy.

### 3. Sandboxes for Safe Execution

> *Agents need an environment with the right defaults so they can safely act, observe results, and make progress.*

- **Sandboxes** give agents safe operating environments — secure, isolated execution of code
- Harnesses can allow-list commands and enforce network isolation
- Environments can be created on demand, fanned out across many tasks, and torn down when done

Good environments come with good default tooling: language runtimes, CLIs for git and testing, browsers for web interaction and verification.

Tools like browsers, logs, screenshots, and test runners enable **self-verification loops**: write code → run tests → inspect logs → fix errors.

### 4. Memory & Search for Continual Learning

> *Agents should remember what they've seen and access information that didn't exist when they were trained.*

Without access to edit model weights, the only way to "add knowledge" is via **context injection**.

- **Memory files** (e.g. AGENTS.md): injected into context on agent start, updated by agents, loaded into future sessions — a form of continual learning
- **Web Search and MCP tools** (e.g. Context7): access information beyond the knowledge cutoff — new library versions, current data

### 5. Battling Context Rot

> *Agent performance shouldn't degrade over the course of work.*

[Context Rot](https://research.trychroma.com/context-rot) describes how models become worse at reasoning as their context window fills up. Harnesses need strategies to manage this.

**Harnesses today are largely delivery mechanisms for good context engineering.**

Three key strategies:

- **Compaction** — Intelligently offload and summarize existing context when near the limit, so the agent can continue working
- **Tool call offloading** — Keep head and tail tokens of large tool outputs, offload full output to filesystem for on-demand access
- **Skills (progressive disclosure)** — Instead of loading all tools/MCP servers into context at start (which degrades performance), use skill front-matter for lazy loading of resources when the LLM thinks they're relevant

### 6. Long Horizon Autonomous Execution

> *We want agents to complete complex work, autonomously, correctly, over long time horizons.*

This is where earlier primitives compound. Long-horizon work requires durable state, planning, observation, and verification across multiple context windows.

Key patterns:

- **Filesystems and git for tracking work across sessions** — Agents produce millions of tokens; the filesystem durably captures work. Git lets new agents quickly get up to speed on history.
- **Ralph Loops for continuing work** — A harness pattern that intercepts the model's exit attempt via a hook and reinjects the original prompt in a clean context window, forcing continued work against a completion goal. Each iteration starts fresh but reads state from the previous one.
- **Planning and self-verification** — Planning decomposes a goal into steps (supported via prompting + plan files in the filesystem). After each step, self-verification (running test suites, self-evaluation) grounds solutions in tests and creates feedback for self-improvement.

---

## The Future of Harnesses

### Coupling of Model Training and Harness Design

Today's agent products (Claude Code, Codex) are post-trained with models and harnesses in the loop. Useful primitives are discovered, added to the harness, and used when training the next generation. Models become more capable within the harness they were trained in.

Side effects for generalization:
- Changing tool logic leads to worse performance (e.g. Codex apply_patch overfitting)
- **The best harness for your task is not necessarily the one a model was post-trained with** — Terminal Bench 2.0 shows Opus 4.6 scoring far below in Claude Code vs other harnesses. Optimizing the harness for your task has enormous impact.

### Where Harness Engineering is Going

As models improve, some harness features will get absorbed into the model. But harnesses also engineer systems *around* model intelligence: well-configured environments, right tools, durable state, and verification loops make any model more efficient regardless of base intelligence.

Open problems:
- Orchestrating hundreds of agents working in parallel on a shared codebase
- Agents that analyze their own traces to identify and fix harness-level failure modes
- Harnesses that dynamically assemble tools and context just-in-time instead of being pre-configured

> **The model contains the intelligence and the harness is the system that makes that intelligence useful.**
