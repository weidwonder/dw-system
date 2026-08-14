# 文档索引（现行口径）

> **本索引只列 `lifecycle: active` 的文档。** 已归并 / 被取代 / 已废弃的进 [归档索引](./index-archive.md)，文件仍在原路径，只是不再代表现行口径。
> 规则见 `ai-dev-system/skills/ai-dev-workflow/references/core/文档治理.md` §文档生命周期与索引门控。创建、归档或重命名文档后**必须**同步本索引与归档索引。
> 本仓库是方法论分发包，没有 `REQUIREMENTS.md` / `ARCHITECTURE.md`——真相源是根目录 `CLAUDE.md` 与 `ai-dev-system/skills/` 下的 skill markdown 本身。

## 现行设计与规范（`docs/spec/`）

- **[ai-dev-system 体系设计](./spec/2026-07-06-ai-dev-system-design.md)** — 三层架构、mode-aware 路由、Engineering Context 层的总设计。
- **[ai-prd 设计](./spec/2026-07-06-ai-prd-design.md)** — 产 PRD skill 的设计；§7 是变更 PRD 模板的覆盖度映射，改模板前对照。
- **[Skill 写作自检清单](./spec/2026-07-16-skill写作自检清单.md)** — 信息层级 / 六大失败模式 / 交叉引用同步；改任何 skill markdown 前后各过一遍。
- **[Skill 版本管理与迁移机制](./spec/2026-07-16-skill版本管理与迁移机制.md)** — VERSION、migrations、tag 与安装器 stamp 的现行约定。
- **[源头对齐基线与回灌机制](./spec/2026-07-14-源头对齐基线与回灌机制.md)** — 与上游来源保持对齐、变更回灌的治理规则。
- **[codegraph 自动安装与索引](./spec/2026-08-14-codegraph自动安装与索引-lean-change-spec.md)** — 安装器保持 codegraph 最新、接线到 agent、给目标项目建索引的现行口径与选项。

## 进行中的报告（`docs/report/`）

- **[agentic-principle 缺口报告](./report/agentic-principle-gap-report.md)** — 待 `agentic_principle` 维护者评估，未结案。

## 归档

历史文档（已归并的实施计划、被取代的设计）见 **[归档索引](./index-archive.md)**。**归档文档不代表现行口径**，与本索引所列文档冲突时以本索引为准。
