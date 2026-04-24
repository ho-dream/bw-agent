# Minions: Stripe's One-Shot, End-to-End Coding Agents

> **Source (Part 1):** <https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents>
> **Source (Part 2):** <https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents-part-2>
> **Author:** Alistair Gray (Stripe, Leverage team)
> **Date:** Part 1: 9 February 2026, Part 2: 19 February 2026
> **Tags:** coding agents, developer productivity, one-shot agents

---

## Note on Source

The full article body was not available due to JS-rendered content. The information below is assembled from the fetched metadata plus references to Minions in Birgitta Böckeler's Fowler article on Harness Engineering.

---

## Overview

**Minions** are Stripe's homegrown coding agents, responsible for **more than 1,000 pull requests merged each week**. Though humans review the code, minions write it from start to finish — a **one-shot, end-to-end** approach.

The Leverage team (which builds internal productivity tools at Stripe) developed Minions.

---

## Key Characteristics

- **One-shot execution** — Minions write code from start to finish in a single run, not iteratively with human in the loop during generation
- **Human review** — Humans review the output code (PRs), but minions do the writing
- **Scale** — 1,000+ PRs merged per week by minions across Stripe

---

## Harness Engineering Practices (Referenced in Fowler Article)

Birgitta Böckeler's harness engineering article specifically references Stripe's Minions for several notable practices:

### Pre-Push Hooks Running Relevant Linters
Minions use pre-push hooks that run relevant linters based on a heuristic. This is a **computational feedback sensor** that runs before integration, catching style violations, type errors, and structural issues automatically.

### "Shift Feedback Left"
Stripe highlights the importance of shifting feedback left — running checks as early as possible in the development lifecycle rather than waiting for post-integration pipeline runs. This aligns with the broader harness engineering principle of keeping quality left.

### Blueprints Integrating Feedback Sensors
Stripe's "blueprints" show how they integrate feedback sensors into the agent workflows. Blueprints appear to be structured templates that wire together the guide (feedforward) and sensor (feedback) components for specific types of work, making the harness a first-class part of the agent execution path.

---

## Significance

Minions represent one of the most visible, production-scale deployments of coding agents in industry. Their approach demonstrates:

1. **One-shot viability** — Complex code changes can be handled end-to-end without interactive human guidance during generation
2. **Harness as enabler** — The quality comes not from the model alone but from the surrounding system of hooks, linters, and blueprints
3. **Human review remains essential** — Even at Stripe's scale and maturity, humans review the code before merging
4. **Shift-left is critical** — The earlier feedback reaches the agent, the better the output quality and the less wasted work

---

## Further Reading

- Part 2 goes deeper into implementation details: <https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents-part-2>
- Referenced in: [Harness Engineering for Coding Agent Users](01-fowler-harness-engineering.md) (Fowler / Böckeler)
