# 文档索引（现行口径）

> **本索引只列 `lifecycle: active` 的文档。** 已归并 / 被取代 / 已废弃的进 [归档索引](./index-archive.md)，文件仍在原路径，只是不再代表现行口径。
> 规则见 `ai-dev-system/skills/ai-dev-workflow/references/core/文档治理.md` §文档生命周期与索引门控。创建、归档或重命名文档后**必须**同步本索引与归档索引。
> 本仓库是方法论分发包，没有 `REQUIREMENTS.md` / `ARCHITECTURE.md`——真相源是根目录 `CLAUDE.md` 与 `ai-dev-system/skills/` 下的 skill markdown 本身。

## 现行设计与规范（`docs/spec/`）

- **[ai-dev-system 体系设计](./spec/2026-07-06-ai-dev-system-design.md)** — 三层架构、skill 加壳与路由、Engineering Context 层的总设计。
- **[ai-prd 设计](./spec/2026-07-06-ai-prd-design.md)** — 产 PRD skill 的设计；§7 是变更 PRD 模板的覆盖度映射，改模板前对照。
- **[Skill 写作自检清单](./spec/2026-07-16-skill写作自检清单.md)** — 信息层级 / 六大失败模式 / 交叉引用同步；改任何 skill markdown 前后各过一遍。
- **[Skill 版本管理与迁移机制](./spec/2026-07-16-skill版本管理与迁移机制.md)** — VERSION、migrations、tag 与安装器 stamp 的现行约定。
- **[源头对齐基线与回灌机制](./spec/2026-07-14-源头对齐基线与回灌机制.md)** — 与上游来源保持对齐、变更回灌的治理规则。
- **[codegraph 自动安装与索引](./spec/2026-08-14-codegraph自动安装与索引-lean-change-spec.md)** — 安装器保持 codegraph 最新、接线到 agent、给目标项目建索引的现行口径与选项。
- **[ctx 全局命令安装](./spec/2026-08-16-ctx全局命令安装-lean-change-spec.md)** — 安装器把 skill 自带的 ctx CLI 链接成全局命令、验证可用性与失败降级的现行口径与选项。
- **[代码事实层强制化](./spec/2026-08-18-代码事实层强制化-eng-spec.md)** — 2.1.0 的设计依据：`engineering-context/` 卡片层改为**无条件必备**（初始化建骨架、干活过程中渐进补齐），取消按项目资产分档；分流默认倾向改为无条件。`authority_refs`：SKILL.md §路由逻辑、总纲 §默认倾向、core/代码事实纪律.md、references/ 目录分层。

## 进行中的计划（`docs/plan/`）

- **[项目真相源与 context-tier 重构 Coding Plan](./plan/2026-08-16-项目真相源与context-tier重构-coding-plan.md)** — 2.0.0 重构的任务拆分（15 个任务 + 文件独占矩阵）；其 spec 已于 2026-08-18 转 `superseded`，见[归档索引](./index-archive.md)。实现完成并合入后转 `lifecycle: merged` 并移入归档索引。

## 进行中的报告（`docs/report/`）

- **[agentic-principle 缺口报告](./report/agentic-principle-gap-report.md)** — 待 `agentic_principle` 维护者评估，未结案。

## 归档

历史文档（已归并的实施计划、被取代的设计）见 **[归档索引](./index-archive.md)**。**归档文档不代表现行口径**，与本索引所列文档冲突时以本索引为准。
