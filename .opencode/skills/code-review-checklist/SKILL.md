---
name: code-review-checklist
description: 'Use when reviewing code changes before committing or creating a pull request. Provides a structured checklist covering correctness, security, performance, and style to ensure consistent review quality.'
---

# Code Review Checklist

在提交代码或创建 PR 前，按以下检查清单逐项审查变更。确保每一项都通过后再继续。

## 何时使用

当用户要求审查代码、提交前检查、或创建 PR 前的最终确认时，加载本技能并执行完整检查流程。

## 检查流程

对每个变更文件，按以下顺序检查：

### 1. 正确性

- 逻辑是否正确，是否覆盖了边界条件
- 变更是否符合需求描述
- 是否引入了新的 bug 或回归

### 2. 安全性

- 是否存在硬编码的密钥、token 或密码
- 用户输入是否经过校验和转义
- 是否有路径遍历、注入等安全风险

### 3. 性能

- 是否存在不必要的循环或重复计算
- 数据库查询是否高效（N+1 问题等）
- 是否有内存泄漏风险

### 4. 可维护性

- 命名是否清晰、一致
- 是否有足够的注释说明复杂逻辑
- 函数和文件的职责是否单一

### 5. 测试

- 新功能是否有对应的测试
- 边界条件是否被测试覆盖
- 测试命名是否描述了预期行为

## 输出格式

检查完成后，按以下格式输出审查结果：

```
## Code Review 结果

- 正确性: PASS / FAIL (说明)
- 安全性: PASS / FAIL (说明)
- 性能: PASS / FAIL (说明)
- 可维护性: PASS / FAIL (说明)
- 测试: PASS / FAIL (说明)

总结: [一句话总结是否可以提交]
```

## 注意事项

- 不要跳过任何检查项，即使变更看起来很简单
- 对 FAIL 项必须给出具体的修复建议
- 如果无法判断某项，标注为 REVIEW_NEEDED 并说明原因