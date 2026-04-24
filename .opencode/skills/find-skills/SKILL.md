---
name: find-skills
description: 'Helps users discover and install agent skills when they ask questions like "how do I do X", "find a skill for X", "is there a skill that can...", or express interest in extending capabilities. This skill should be used when the user is looking for functionality that might exist as an installable skill.'
---

# Find Skills

使用以下 custom tools 完成 skill 的发现和安装：

1. `skill_search({ query: "关键词" })` -- 搜索可用的 skills
2. `skill_install({ name, skill_md_content, auxiliary_files? })` -- 安装到项目
3. `skill_mark_complete({ name })` -- 触发审查，确认安装完成
4. `skill_status()` -- 查看所有 skill 的安装状态

## 安装流程（Ralph Loop）

**重要：一旦调用了 `skill_install`，你必须自动循环到 `skill_mark_complete` 返回 "Installation complete" 为止。不要中途停下等待用户指令。**

完整循环：

1. 用 `skill_search` 搜索，或在 https://skills.sh/ / https://www.skillhub.club/skills 浏览
2. 获取 SKILL.md 内容和辅助文件
3. 调用 `skill_install` 安装
4. 如果 `skill_install` 返回了 warnings：
   - 读取每条 WARNING 后面的 FIX 指令
   - 按指令修复文件（用 edit/write 工具）
5. 调用 `skill_mark_complete({ name })` 触发审查
6. 如果 `skill_mark_complete` 返回了 issues：
   - 读取每条 ERROR/WARNING 后面的 FIX 指令
   - 按指令修复文件
   - **再次调用 `skill_mark_complete`**
7. 重复步骤 6，直到 `skill_mark_complete` 返回 "Installation complete"

**禁止行为：**
- 不要在安装后不调用 `skill_mark_complete` 就停下
- 不要在 `skill_mark_complete` 返回 issues 后不修复就停下
- 不要跳过 FIX 指令中的任何步骤

## 未找到 Skill 时

1. 告知用户未找到匹配的 skill
2. 直接用通用能力帮助用户完成任务
3. 建议用户创建自定义 skill
