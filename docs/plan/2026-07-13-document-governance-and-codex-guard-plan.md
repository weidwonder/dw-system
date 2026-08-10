---
lifecycle: merged
archived: '2026-08-10'
---

> **已归档（2026-08-10）｜lifecycle: merged**：计划任务已全部执行，规则以 `references/core/文档治理.md` 与 `install.mjs` 为准。与现行文档冲突时**以现行为准**，MUST NOT 据本文实施。

# 文档治理与 Codex 保护实施计划

## 目标

统一 ai-dev-system 的文档输出目录，并让 Codex 安装后的项目级冲突保护可验证、可补齐。

## 任务

1. 为安装器增加临时项目回归测试，覆盖 conflict guard、mode 同步与实际插件 ID。
2. 为 skill 增加文档治理契约测试，覆盖 `docs/spec/`、`docs/plan/`、`docs/report/` 和禁止工具目录。
3. 修改安装器并运行安装器测试。
4. 新增共享文档治理 reference，修改 ai-dev-workflow 与 ai-prd 的流程、模板和 mode 外壳。
5. 运行 skill 契约测试与 skill validator。
6. 重新安装到 `D:/projects/docs_audit`，迁移现有文档并修复引用。
7. 运行路径扫描、类型检查和受影响测试。

## 回滚

- 分发包修改通过 git revert 回滚。
- 当前项目文档迁移通过反向移动恢复；迁移不改文档正文语义。
