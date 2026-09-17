---
name: dw-worktree
description: "开发任务的工作区隔离与合并收尾：任何文档或代码落盘前建立独立 git worktree，开发期间的分支纪律，全部门禁通过后按项目的合并方式自动合并回主分支并清理。要建 worktree、问'改动该落在哪'、任务做完要合并、合并失败要处置、合并方式字段缺失要取值时用。不管评审怎么做（用 dw-review-gate），也不管流程走哪条路径（用 dw-workflow）。"
---

# dw-worktree：工作区隔离门与完成合并门

本 skill 管两道门与它们之间的分支纪律：**工作区隔离门**（落盘前）与**完成与自动合并门**（合并前）。流程顺序与 Triage 归 `dw-workflow`；评审门归 `dw-review-gate`；文档结算的判据归 `dw-doc-governance`。本纪律对所有项目强制执行，不因协作面、Lean 流程、单人项目、小改动或紧急修复而裁剪。按 RFC 2119 解释规范词。

## 工作区隔离门要点

- **必须建 worktree**：路由与初始化**对话**做完后、**任何**文件落盘前（含初始化要写的标记块），MUST 已从最新主分支建出并**全程使用独立 worktree**；Lean 不豁免，MUST NOT 中途切回主工作树落盘；多仓每仓一个，MUST NOT 共用。
- **目录取自标记块 `worktree-dir`**：未声明默认仓库根 `./.worktrees/`。每次创建前重新读，MUST NOT 沿用上次会话记住的路径。
- **过不了就中止**：主工作树有未提交改动、不是 Git 仓库、或建不出 worktree，MUST 中止并用业务语言说明；MUST NOT 替用户 stash / reset / checkout / 删未知文件，MUST NOT 降级为直接改当前目录。
- **进门之后**先结清初始化挂账（标记块、冲突处置、缺 registry 跑 `ctx init`），再开始本次任务。

## 读取条件

| 什么时候 | 读什么 |
|---|---|
| 要动手建 worktree | `references/worktree开发纪律.md` §工作区隔离门（六步动作细则与多仓规则）|
| 任务进行中：分段提交、主分支有新提交 | 同篇 §开发期间 |
| 评审门 P0/P1 清零或已登记积压、要合并回主分支 | 同篇 §完成与自动合并门（准出项、`direct` / `pr` 各做什么、多仓顺序）|
| 标记块缺 `merge-gate` | 同篇 §完成与自动合并门 的"字段缺失时的判据"——唯一权威定义，现状优先于协作面推断 |
| 测试失败、合并冲突、权限不足、门禁未过 | 同篇 §失败与阻塞 |

## 案例

主工作树干净，标记块写着 `worktree-dir="./.worktrees/"`、`merge-gate="direct"`。任务"导出多一列"：`git worktree add ./.worktrees/csv-source -b feat/csv-source main` → 之后 spec、代码、测试、提交全在这个目录里 → 评审门过完、CHANGELOG 已写、文档结算已落盘 → 在主工作树 `git merge --no-ff feat/csv-source` → 跑一次最小验证 → `git worktree remove` 并删分支。若合并时冲突：停下，保留 worktree 与分支，用业务语言说明哪项能力尚未交付。
