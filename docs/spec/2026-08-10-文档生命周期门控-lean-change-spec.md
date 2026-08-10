---
date: '2026-08-10'
lifecycle: 'merged'
archived: '2026-08-10'
authority_refs:
  - 'ai-dev-system/skills/ai-dev-workflow/references/core/文档治理.md'
  - 'ai-dev-system/skills/ai-dev-workflow/references/core/worktree开发纪律.md#完成与自动合并门'
  - 'ai-dev-system/skills/ai-dev-workflow/references/core/bug诊断纪律.md#phase-3'
  - 'ai-dev-system/skills/ai-dev-workflow/references/core/测试资产纪律.md#3'
---

> **已归档（2026-08-10）｜lifecycle: merged**：本文口径已落进 `references/core/文档治理.md` §文档生命周期与索引门控（权威定义）及其配套的准出门与模板。与现行文档冲突时**以现行为准**，MUST NOT 据本文实施。本文保留的是设计取舍与用户拍板记录。

# 文档生命周期门控（index 分层 + 生命周期位 + 账本收敛）

## 问题

本体系已有三条"新替旧"机制——代码侧的替换清单核销、Engineering Context 的 freshness/权威面触发、PRD 的归并转归档——但 `docs/` 文档层与持续追加账本是治理空白：

1. `文档治理.md` 与 `mode-team.md` 只规定"创建后必须更新 `docs/index.md`"，**零退出侧规则**，索引随项目年龄单调增长。
2. `docs/spec/`、`docs/plan/` 是**过程产物**（记录当时的意图），会随代码演进与现实背离，但没有任何机制把它降权；AI 读到旧 spec 会当成现行事实。
3. `docs/report/bug修复历史.md` 与 `docs/report/测试场景覆盖度.md` 明文"持续追加"，无收敛规则。

后果是两条：**误导**（旧口径被当权威）与**浪费**（索引与账本吃满上下文、分散注意力）。

## 目标

给 `docs/` 层补上与代码侧同构的退出机制：文档有状态、状态在准出时结算、索引只呈现现行口径、账本可收敛。

## 范围

四条规则，均为 markdown 纪律改动，不涉及 `ctx` CLI 与安装器代码。

### A. index 分层

- `docs/index.md` 只索引**现行口径**：真相源（`REQUIREMENTS.md` / `ARCHITECTURE.md`）、`lifecycle: active` 的 spec/plan/report、现行 ADR 与 UI 原型、持续账本入口，外加一行指向归档索引的指针。
- 非 active 文档进 `docs/index-archive.md`，按年份分区。
- **文件原地不动**，只有索引分层——避免移动文件破坏既有相对链接。

### B. 生命周期位与权威面声明

`docs/` 下的 spec / plan / report / PRD 文档头部 frontmatter 声明：

- `lifecycle`: `active` | `merged` | `superseded` | `obsolete`
- `superseded_by`: 取代它的文档相对路径（仅 `superseded` 需要）
- `archived`: 转归档日期（仅非 active 需要）
- `authority_refs`: 本文描述的权威面清单（接口签名 / 路由或配置版本 / DB schema / 命令与目录约定 / 对外契约）

**字段名用 `lifecycle` 而非 `status`**：`lean-change-spec.md` 正文的 `Status: Draft/Ready/Done` 表示**写作进度**，`product-prd.md` frontmatter 的 `status` 是自由文本状态描述——两者都已存在，复用 `status` 会造成术语漂移。

`authority_refs` 与 `assets/context-layer/probe-set.md` 的同名字段同构，是"按权威面触发复核"这条判据可执行的前提。

### C. 归档降权而非删除

转归档时在正文首行插入固定格式头注，声明冲突时以现行为准。HTML 原型用页面顶部可见横幅（沿用 `ai-prd` 现有做法）。

### D. 账本收敛

- **读取纪律**：账本是检索索引，MUST 关键词检索定位条目，MUST NOT 全文加载。
- **分卷**：主文件超阈值时按时间切出历史卷，主文件保留卷索引。
- **覆盖度台账是状态表**：淘汰场景移入文末"已淘汰"区，不留在主表。

## 触发判据（用户已拍板：按权威面触发）

归档不按日期老化触发，按**文档描述的权威面是否还成立**触发。挂载点是已有的**完成与自动合并门**：准出时把本次替换清单中每条被删除或被替换的权威面，与 `docs/` 各文档的 `authority_refs` 比对，命中的文档必须判定"仍 active"或"转归档"，不得放着不管。

不额外新增门，只在既有准出门加一条结算项。

## 兼容取舍（用户已逐条拍板 2026-08-10）

| # | 改变的既有行为 | 用户结论 | 到期日与到期动作 |
|---|---|---|---|
| 1 | 已安装项目的单层 `docs/index.md` 结构 | **不兼容**：升级后立即要求分层 | 无到期日；迁移指南给一次性拆分动作 |
| 2 | 存量 spec/plan/report 无 frontmatter 生命周期位 | **不兼容（按存量豁免）**：只对新建文档强制；存量默认视为 `active`，被权威面触发复核时才补齐 | 无到期日；豁免是永久的，与"按权威面触发"判据自洽 |

第 2 条不产生保留例外条目——它不是"两套逻辑并存"，而是**同一套规则的触发时机差异**：存量文档一旦被触发就走完全相同的结算流程。

## 替换清单

| 被取代物 | 位置 | 处置 | 核销判据 |
|---|---|---|---|
| `文档治理.md` 硬规则中"`docs/index.md` 可以作为发现入口"一句 | `references/core/文档治理.md` | 改写为指向新增 §文档生命周期与索引门控 | 原句在仓库内引用数为 0 |
| `ai-prd` 的"已归并"头注表述（自然语言，无机器可判状态） | `ai-prd/references/00-prd生成流程.md`、`ai-prd/references/mode-team.md` | 保留头注，同时要求写 `lifecycle: merged` | 两处均含 `lifecycle:` 字样 |

无保留例外。

## 验收

- `文档治理.md` 含完整的生命周期与索引门控定义，且与 `worktree开发纪律.md` 准出项、`00-流程总纲.md` 门表互指一致。
- 五个 spec/plan 模板与三类 PRD 模板含 frontmatter 生命周期位与 `authority_refs`。
- `bug诊断纪律.md` 与 `测试资产纪律.md` 含账本收敛规则，`test-coverage.md` 模板含"已淘汰场景"区。
- `ai-prd` 的归并纪律术语与新生命周期位对齐（"已归并"= `lifecycle: merged`）。
- `ai-dev-system/VERSION` bump 且 `migrations/<新版本>.md` 给出存量项目迁移动作。
- 本仓库自身建立 `docs/index.md` 与 `docs/index-archive.md`，作为规则可用性验证。
- `node --test test/installer-migration.test.mjs` 与 `ctx` 单测全绿。
