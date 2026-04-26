# The Role of Developer Skills in Agentic Coding

> **Source:** <https://martinfowler.com/articles/exploring-gen-ai/13-role-of-developer-skills.html>
> **Author:** Birgitta Böckeler (Thoughtworks)
> **Date:** 25 March 2025
> **Tags:** agentic coding, failure modes, developer skills, code quality

---

## Overview

As agentic coding assistants become more capable, what role do human developer skills play? Based on extensive use of Cursor, Windsurf, and Cline for changing existing codebases, this article catalogues concrete examples of where human intervention, correction, and steering were necessary — even in successful sessions.

> These examples show that while advancements have been impressive, we're still far from AI writing code autonomously for non-trivial tasks.

---

## Three Impact Radiuses

AI missteps are categorised by their impact radius — the bigger the radius, the longer the feedback loop to catch the issues.

1. **Time to commit** — Slowed development speed vs unassisted coding
2. **Team flow in iteration** — Created friction for the team during delivery
3. **Long-term maintainability** — Negatively impacted future changeability of the code

---

## Failure Modes

### Impact Radius: Time to Commit

The least problematic radius — the most obvious failure mode, changes probably won't even make it into a commit.

#### No Working Code
Intervention necessary to make code work. Developer experience helps either quickly correct issues or know early when to give up and start a new session.

#### Misdiagnosis of Problems
AI goes down rabbit holes from misdiagnosis. Developer experience can pull the tool back.

> *Example: AI assumed a Docker build issue was due to architecture settings when the real issue was copying `node_modules` built for the wrong architecture.*

---

### Impact Radius: Team Flow in the Iteration

Lack of review and intervention leads to friction on the team during the delivery iteration.

#### Too Much Up-Front Work
AI goes broad instead of incrementally implementing working slices. Risks wasting large upfront work before realising a technology choice isn't viable or a requirement was misunderstood.

> *Example: During a frontend tech stack migration, it tried converting all UI components at once rather than starting with one component and a vertical slice.*

#### Brute-Force Fixes Instead of Root Cause Analysis
AI takes brute-force approaches rather than diagnosing root causes. Delays the underlying problem to later stages and other team members.

> *Example: When encountering a Docker memory error, it increased memory settings rather than questioning why so much memory was used.*

#### Complicating the Developer Workflow
AI generates build workflows that create bad developer experience.

> *Examples: Introducing two commands instead of one; failing to ensure hot reload; complicated build setups; handling errors in Docker builds without considering earlier detection.*

#### Misunderstood or Incomplete Requirements
Without detailed description, AI jumps to wrong conclusions. This is an example of how fully autonomous agents fail without a developer watching and intervening early.

---

### Impact Radius: Long-Term Maintainability

The most insidious radius — longest feedback loop, issues caught weeks/months later. Code works now but will be harder to change in the future. **This is where 20+ years of experience mattered most.**

#### Verbose and Redundant Tests
AI creates new test functions instead of adding assertions to existing ones, or adds too many assertions already covered elsewhere. More tests are not necessarily better — duplicated tests are harder to maintain and more brittle. Custom instructions help but don't fully prevent this.

#### Lack of Reuse
AI-generated code sometimes lacks modularity.

> *Examples: Not realising a UI component already exists elsewhere, creating duplicate code. Using inline CSS instead of CSS classes and variables.*

#### Overly Complex or Verbose Code
AI generates too much code: technically unnecessary complexity or more functionality than needed.

> *Examples: Redundant CSS styles (sometimes massive amounts). Elaborate web component far beyond what was needed. During refactoring, failing to recognise existing dependency injection chain and introducing unnecessary parameters.*

---

## Safeguards

### Individual Coder

- **Always carefully review AI-generated code** — it's very rare to find nothing to fix or improve
- **Stop when overwhelmed** — revise prompt, start new session, or fall back to manual ("artisanal") coding
- **Stay cautious of "good enough" solutions** that introduce long-term maintenance costs
- **Practice pair programming** — four eyes catch more than two, two brains are less complacent

### Team and Organisation

- **Code quality monitoring** — Tools like SonarQube or CodeScene to alert about code smells. Some smells become more prominent with AI (e.g. code duplication)
- **Pre-commit hooks and IDE-integrated review** — Shift-left: lint, security-check, and review during development, not just in PRs or pipeline
- **Revisit good code quality practices** — Create rituals that reiterate practices to mitigate failures. Keep a "Go-wrong" log of events where AI-generated code caused friction
- **Custom rules** — Use coding assistant rule sets/instructions, iterating as a team to codify good practices. Caveat: AI may not follow them, especially as context grows
- **Culture of trust and open communication** — Teams under high pressure to deliver faster "because you have AI" are more exposed to quality risks. Psychological safety helps teams share challenges and learn faster
