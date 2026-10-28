# 归档索引

> **这里的文档不代表现行口径。** 与 [现行索引](./index.md) 所列文档冲突时，一律以现行为准，不得据本页文档实施。
> 文件仍在原路径（归档只降权、不移动、不删除），保留的是"当初为什么这么定"的证据。
> 归档判据是**权威面是否还成立**，不是文档有多老——规则见 `dw-system/skills/dw-doc-governance/references/文档生命周期.md` §文档生命周期与索引门控。

## 2026

| 文档 | 生命周期 | 口径去了哪 |
|---|---|---|
| [原型注解分层与文档日期前缀](./spec/2026-08-26-原型注解分层与文档日期前缀-PRD.md) | merged | 已归并进 `docs/REQUIREMENTS.md`；现行口径以需求真相源与实现为准 |
| [ai-prd 批注框架缺陷报告](./report/2026-08-27-ai-prd-批注框架缺陷报告.md) | merged | 两处缺陷已修，口径进 [同名 lean spec](./spec/2026-08-27-原型批注框架绝对定位与图钉可见性-lean-change-spec.md) 与域卡 `cards/dw-system/原型工具.md`；层叠上下文遮挡那半在 `docs/TODO.md` |
| [自有 AI 辅助开发体系实施计划](./plan/2026-07-06-ai-dev-system.md) | merged | 体系已建成，现行架构见 `CLAUDE.md` 与 `REQUIREMENTS.md` §这是什么 |
| [文档治理与 Codex 保护设计](./spec/2026-07-13-document-governance-and-codex-guard-design.md) | merged | 规则已落进 `references/core/文档治理.md` 与安装器 |
| [文档治理与 Codex 保护实施计划](./plan/2026-07-13-document-governance-and-codex-guard-plan.md) | merged | 同上，任务已全部执行 |
| [mattpocock/skills 融合计划](./plan/2026-07-16-mattpocock-skills-fusion-plan.md) | merged | 融合结论已落进各 skill 的 references/ 与模板 |
| [Codex 冲突技能处理方式选择（Lean Spec）](./spec/2026-08-04-codex-conflict-choice-lean-change-spec.md) | merged | 已落进 `install.mjs` 与 `CLAUDE.md` §安装器的关键设计 |
| [Codex 冲突技能处理方式计划](./plan/2026-08-04-codex-conflict-choice.md) | merged | 同上，任务已全部执行 |
| [文档生命周期门控（Lean Spec）](./spec/2026-08-10-文档生命周期门控-lean-change-spec.md) | merged | 规则已落进 `references/core/文档治理.md` §文档生命周期与索引门控；本文保留设计取舍与用户拍板记录 |
| [项目真相源与 context-tier 重构](./spec/2026-08-16-项目真相源与context-tier重构-eng-spec.md) | superseded | 卡片层改为无条件必备、取消按资产分档，现行口径见 `docs/decisions/` 0005；协作面字段模型见域卡 `cards/dw-system/标记块与旧版迁移.md` 与 `init-初始化.md` |
| [项目真相源与 context-tier 重构 Coding Plan](./plan/2026-08-16-项目真相源与context-tier重构-coding-plan.md) | merged | 任务已随 2.0.0 全部执行并合入；其 spec 已于 2026-08-18 转 superseded |

| [原型取段与框架外置 · Coding Plan](./plan/2026-08-27-原型取段与框架外置-coding-plan.md) | merged | 六个任务全部执行完毕，口径已落进代码与 [原型取段与框架外置 eng-spec](./spec/2026-08-27-原型取段与框架外置-eng-spec.md)；代码评审门四轴的 6 条 P0/P1 与 7 条 P2 已在 `ce70ffc` 收掉 |
| [dw-system 体系设计](./spec/2026-07-06-ai-dev-system-design.md) | superseded | 被 [3.0 PRD](./spec/2026-09-17-dw体系重组与两条总纲-PRD.md) 取代；现行口径读 `REQUIREMENTS.md` §这是什么、`decisions/0004`–`0006` 与地图卡 `cards/dw-system.md` |
| [Skill 写作自检清单](./spec/2026-07-16-skill写作自检清单.md) | superseded | 被 `dw-system/skills/AGENTS.md` 取代；另按 `CLAUDE.md` §改动规则 加载 `skill-principle` 与 `dw-prose` |
| [Skill 版本管理与迁移机制](./spec/2026-07-16-skill版本管理与迁移机制.md) | merged | 已归并进 `CLAUDE.md` §版本与发布、`REQUIREMENTS.md` §安装器 与域卡 `cards/dw-system/安装主干.md` |
| [代码事实层强制化](./spec/2026-08-18-代码事实层强制化-eng-spec.md) | superseded | 被 [3.0 PRD](./spec/2026-09-17-dw体系重组与两条总纲-PRD.md) 取代；现行口径读 `REQUIREMENTS.md` §必备的代码事实层 与 `decisions/0005` |
| [PRD 复核门](./spec/2026-08-19-prd复核门-lean-change-spec.md) | merged | 已归并进 `REQUIREMENTS.md` §产 PRD 与 `dw-prd` 的 `prd复核纪律.md`；门序见 [用户过稿门](./spec/2026-08-25-用户过稿门-lean-change-spec.md) |
| [workflow 精简与需求追溯 PRD](./spec/2026-08-22-workflow精简与需求追溯-PRD.md) | merged | 已归并进 `REQUIREMENTS.md`；加载模型部分已被 3.0.0 取代，来历见 `decisions/0003`、`0004` |
| [渐进式披露与需求追溯](./spec/2026-08-23-渐进式披露与需求追溯-eng-spec.md) | superseded | 被 [3.0 PRD](./spec/2026-09-17-dw体系重组与两条总纲-PRD.md) 取代；现行口径读 `REQUIREMENTS.md` §从 PRD 到代码 与 `decisions/0003`、`0004` |
| [渐进式披露与需求追溯 Coding Plan](./plan/2026-08-23-渐进式披露与需求追溯-coding-plan.md) | merged | 任务已随 2.5.0 执行并合入；其 spec 已转 superseded |
| [渐进式披露真跑验收](./report/2026-08-23-渐进式披露真跑验收.md) | superseded | 被 [决策记录 0004](./decisions/0004-单体skill拆成八个并取消Lean自足册.md) §Consequences 的 3.0.0 实测取代 |
| [spec 过稿门 Coding Plan](./plan/2026-08-27-spec过稿门-coding-plan.md) | merged | 任务已随 2.11.0 执行并合入；现行口径读 `dw-workflow` 的 `确认门.md` §spec 过稿门 与 `REQUIREMENTS.md` |
| [原型注解分层与文档日期前缀 Coding Plan](./plan/2026-08-27-原型注解分层与文档日期前缀-coding-plan.md) | merged | 任务已执行并合入；口径见 [同期 eng-spec](./spec/2026-08-27-原型注解分层与文档日期前缀-eng-spec.md) 与 `REQUIREMENTS.md` |
| [Agentic 调试模式与切片回放](./spec/2026-09-02-agentic调试模式与切片回放-lean-change-spec.md) | merged | 已归并进 `REQUIREMENTS.md` §明确不做什么 第 1 条与 `AI-LLM-overlay.md`；判据本体在伴生 skill `agentic-principle` |
| [dw 体系重组与两条总纲 PRD](./spec/2026-09-17-dw体系重组与两条总纲-PRD.md) | merged | 已归并进 `REQUIREMENTS.md`；来历与被否决的方案见 `decisions/0003`–`0006` |
| [全局安装 Coding Plan](./plan/2026-09-18-全局安装-coding-plan.md) | merged | 任务已执行并合入；口径见 [同期 eng-spec](./spec/2026-09-18-dw-system-全局安装-eng-spec.md) 与 `REQUIREMENTS.md` §安装器 |
| [README 重排与 MIT 许可证 PRD](./spec/2026-10-28-README重排与MIT许可证-PRD.md) | merged | 已归并进 `REQUIREMENTS.md`（许可证与面向使用者文档的位置）；对外说明本身在仓库根 `README.md` / `INSTALL.md` |
