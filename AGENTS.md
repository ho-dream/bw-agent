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

## 参考项目

- **bw-agent**: `~/Documents/experiment_area/bw-agent` — 原始项目，harness 方式的复现目标
