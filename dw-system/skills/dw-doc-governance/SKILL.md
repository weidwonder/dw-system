---
name: dw-doc-governance
description: "项目文档放哪、活多久、怎么退场：输出目录与命名、三层真相源（需求 / 架构 / 实现）、需求真相源只写现状、TODO 出口、决策记录、文档生命周期与 authority_refs、索引分层、按权威面归档、bug 修复历史与测试覆盖度两个账本。要新建文档定目录和文件名、往 REQUIREMENTS 或 TODO 写东西、判一篇 spec 该不该归档、整理 docs/index.md、立决策记录（ADR）、评审门文档轴结算时用。文字本身怎么写用 dw-prose；卡片与 CHANGELOG 用 dw-code-facts；从零写 PRD 用 dw-prd。"
---

# dw-doc-governance：文档放哪、活多久、怎么退场

本 skill 管**目标项目 `docs/` 下每类文档的家、生命周期与索引**，以及**权威面清单**——评审门文档轴与刷卡判据共用的那一份，只在 `references/文档生命周期.md` §3 第 1 步。一段文字该写什么、该删什么归 `dw-prose`；`engineering-context/` 的卡片与仓库根 `CHANGELOG.md` 归 `dw-code-facts`；流程里什么时候产出哪份文档归 `dw-workflow`。按 RFC 2119 解释规范词。

## 四条恒定规则

- **目录固定**：spec → `docs/spec/`，plan → `docs/plan/`，report → `docs/report/`，决策记录 → `docs/decisions/`；需求与架构真相源、`docs/TODO.md` 在 `docs/` 根。MUST NOT 建工具专属目录，MUST NOT 把交付物散在项目根。
- **真相源只写已实现的现状**：还没做的去 `docs/TODO.md`，来历与被否决的方案去决策记录。需求真相源在**准出时**归并，MUST NOT 在实现验收之前写入。
- **新建文档 MUST 带 `lifecycle: active` 与 `authority_refs`**；`docs/index.md` 只索引现行口径、每条一行，非现行的进 `docs/index-archive.md`。
- **归档按权威面触发，不按日期**；归档是降权，MUST NOT 删文件、MUST NOT 移动文件。

## 读取条件

| 什么时候 | 读什么 |
|---|---|
| 要给新建文档定目录、命名、frontmatter | `references/文档治理.md` 开头的目录表 + §默认命名；frontmatter 字段见 `references/文档生命周期.md` §1 |
| 拿不准一条事实该写进哪份文档 | `references/文档治理.md` §归属表 |
| 要往需求真相源写东西，或它长到要拆 | `references/文档治理.md` §需求真相源写什么、怎么分层 |
| 冒出"这个以后再说" | `references/文档治理.md` §TODO 出口 |
| 要搬走一段来历，或否掉一个方案 | `references/文档治理.md` §决策记录 |
| 唤起或初始化时检查零上下文交接缺口 | `references/文档治理.md` §三层真相源 |
| 评审门文档轴；本次改动碰了权威面，要判哪些文档失准 | `references/文档生命周期.md` §3 |
| 现行文档超过 20 篇，或要整理索引 | `references/文档生命周期.md` §2 |
| 准出，要把本次口径归并进需求真相源 | `references/文档生命周期.md` §6 |
| 判定出某篇要转归档；要写 bug 修复历史或测试场景覆盖度 | `references/文档归档与账本收敛.md` |

## 案例

**一次改动如何结算文档**：订单退款规则从"7 天内可退"改成"签收后 7 天内可退"。文档轴按 `文档生命周期.md` §3 第 1 步的权威面清单判定本次碰了"用户可感知的行为规则"这一面 → 全仓检索声明了该面的 `lifecycle: active` 文档，命中去年的退款 spec → 它描述的口径已失准，按 `文档归档与账本收敛.md` 插归档头注，同一次提交内从 `docs/index.md` 移到 `docs/index-archive.md`；准出时把新口径写进 `docs/requirements/退款.md`，只写现在的规则，不写"原来是 7 天"。
