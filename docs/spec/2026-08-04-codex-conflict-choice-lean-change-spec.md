---
lifecycle: merged
archived: '2026-08-10'
---

> **已归档（2026-08-10）｜lifecycle: merged**：口径已落进 `install.mjs` 与 `CLAUDE.md` §安装器的关键设计。与现行文档冲突时**以现行为准**，MUST NOT 据本文实施。

# Codex 冲突技能处理方式选择

## 目标

安装 ai-dev-workflow 时，让用户选择 Codex 冲突插件的处理范围：

- 项目级约束：在目标项目 `AGENTS.md` 写入自动触发约束，不影响其他项目。
- 全局卸载：调用 Codex CLI 卸载已安装的冲突插件，影响当前用户的所有项目。

## 范围

- 交互安装新增一次选择，默认选择项目级约束。
- `--yes` 不得隐式执行全局卸载；可用 `--codex-conflicts=uninstall` 显式选择全局卸载。
- 全局卸载必须通过 `codex plugin list --json` 发现已安装插件，再调用 `codex plugin remove`；Codex 不可用或卸载失败时安装失败并保留目标项目不变。
- 选择全局卸载成功后移除本次安装器写入的 Codex AGENTS 约束块；选择项目级约束时保持现有行为。
- `--keep=superpowers` 和 `--no-plugins` 保持既有语义。

## 兼容取舍

- 默认行为保持项目级约束，非交互安装不会产生全局副作用。
- 用户明确选择全局卸载后，卸载对所有项目生效；安装器必须在计划阶段和结果中明确提示该影响。
- Codex 插件标识以当前市场的 `superpowers@openai-api-curated` 为主，同时识别旧的 `superpowers@openai-curated`。

## 验收

- 帮助文本说明新选项及全局影响。
- 非交互默认路径写入 AGENTS 约束，不调用 Codex 卸载。
- 交互选择项目级路径写入约束。
- 交互/显式选择全局卸载时发现并移除已安装的 superpowers，成功后移除约束块。
- Codex CLI 缺失、输出无效或卸载失败时返回非零并说明原因。
