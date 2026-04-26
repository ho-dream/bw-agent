# Effective Harnesses for Long-Running Agents

> **Source:** <https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents>
> **Author:** Anthropic Engineering (written by Justin Young)
> **Date:** 26 November 2025
> **Tags:** long-running agents, harness engineering, multi-context-window, Claude Agent SDK

---

## Overview

As AI agents take on complex tasks spanning hours or days, they must work in discrete sessions where each new session begins with no memory of what came before. The core challenge: bridging the gap between coding sessions when context windows are limited.

Anthropic developed a two-fold solution for the Claude Agent SDK: an **initializer agent** that sets up the environment on the first run, and a **coding agent** that makes incremental progress in every session while leaving clear artifacts for the next.

---

## The Long-Running Agent Problem

Even a frontier model like Opus 4.5 running on the Claude Agent SDK in a loop across multiple context windows falls short of building a production-quality web app from a high-level prompt alone.

### Failure Pattern 1: One-Shotting

The agent tries to do too much at once — essentially attempting to one-shot the app. This leads to running out of context mid-implementation, leaving the next session with a half-implemented, undocumented feature. The next agent must guess at what happened and spend time getting the basic app working again. This happens even with compaction, which doesn't always pass perfectly clear instructions to the next agent.

### Failure Pattern 2: Premature Completion

After some features are built, a later agent instance looks around, sees progress, and declares the job done.

---

## Two-Part Solution

### 1. Initializer Agent

The very first agent session uses a specialised prompt to set up the initial environment:
- An `init.sh` script
- A `claude-progress.txt` file to keep a log of what agents have done
- An initial git commit showing what files were added

### 2. Coding Agent

Every subsequent session:
- Makes incremental progress
- Leaves structured updates
- Commits to git with descriptive messages
- Writes summaries in the progress file

The key insight: agents need a way to **quickly understand the state of work when starting with a fresh context window**, accomplished via `claude-progress.txt` alongside git history.

---

## Environment Management

### Feature List (JSON)

To address one-shotting and premature completion, the initializer agent writes a comprehensive file of feature requirements expanding on the user's prompt.

Example (for a claude.ai clone — over 200 features):

```json
{
  "category": "functional",
  "description": "New chat button creates a fresh conversation",
  "steps": [
    "Navigate to main interface",
    "Click the 'New Chat' button",
    "Verify a new conversation is created",
    "Check that chat area shows welcome state",
    "Verify conversation appears in sidebar"
  ],
  "passes": false
}
```

Coding agents are prompted to edit this file **only by changing the status of the `passes` field**. Strongly-worded instructions prevent removal or editing of tests. JSON was chosen because the model is less likely to inappropriately change or overwrite JSON files compared to Markdown.

### Incremental Progress

The coding agent works on **only one feature at a time**. This incremental approach was critical to addressing the tendency to do too much at once.

After each code change, the model:
- Commits progress to git with descriptive commit messages
- Writes summaries in the progress file
- Leaves the environment in a "clean state" — appropriate for merging to a main branch: no major bugs, orderly and well-documented code

### Testing with Browser Automation

A major failure mode: Claude marking a feature as complete without proper end-to-end testing. Without explicit prompting, Claude would make code changes and test with unit tests or `curl` but fail to recognise end-to-end failures.

Solution: Provide browser automation tools (Puppeteer MCP) and explicitly prompt Claude to test as a human user would. This dramatically improved performance, as the agent could identify and fix bugs not obvious from code alone.

Limitations remain: Claude's vision limitations and browser automation tool constraints make it difficult to identify every bug (e.g. browser-native alert modals invisible to Puppeteer MCP).

---

## Getting Up to Speed Workflow

Every coding agent is prompted to run through these steps:

1. Run `pwd` to see the working directory
2. Read git logs and progress files to get up to speed on recent work
3. Read the features list file and choose the highest-priority incomplete feature
4. Run `init.sh` to start the development server
5. Run a basic end-to-end test before implementing a new feature

This saves tokens every session and ensures the agent quickly identifies if the app was left in a broken state before making it worse.

### Typical Session Start

```
[Assistant] I'll start by getting my bearings and understanding the current state.
[Tool Use] <bash - pwd>
[Tool Use] <read - claude-progress.txt>
[Tool Use] <read - feature_list.json>
[Assistant] Let me check the git log to see recent work.
[Tool Use] <bash - git log --oneline -20>
[Assistant] Now let me check if there's an init.sh script to restart the servers.
<Starts the development server>
[Assistant] Let me navigate to the application and verify fundamental features.
<Tests basic functionality>
[Assistant] Fundamental functionality is working. Let me review tests.json to find what needs implementation next.
<Starts work on a new feature>
```

---

## Failure Modes Table

| Problem | Initializer Agent Behavior | Coding Agent Behavior |
|---------|---------------------------|----------------------|
| Claude declares victory too early | Set up a feature list file: structured JSON with end-to-end feature descriptions | Read the feature list at session start; choose a single feature to work on |
| Claude leaves environment with bugs or undocumented progress | Create initial git repo and progress notes file | Start by reading progress notes + git logs + run basic test; end by writing git commit and progress update |
| Claude marks features as done prematurely | Set up a feature list file | Self-verify all features; only mark as "passing" after careful testing |
| Claude spends time figuring out how to run the app | Write an `init.sh` script for the dev server | Start session by reading `init.sh` |

---

## Future Work

Open questions:
- **Single vs multi-agent:** Is a general-purpose coding agent best across contexts, or can specialised agents (testing, QA, code cleanup) do better at sub-tasks?
- **Generalisation:** This demo is optimised for full-stack web app development. Findings likely apply to other long-running agentic tasks (scientific research, financial modelling) but this needs validation.
