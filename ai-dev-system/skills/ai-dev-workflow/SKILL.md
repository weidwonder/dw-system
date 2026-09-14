---
name: ai-dev-workflow
description: "AI 辅助开发主流程：从已有 PRD 起步做需求落地、Overview、技术 spec、coding plan、测试方案，或提到'开发流程/用 AI 把需求做成代码'时用；编码后的分轴子代理评审、清旧逻辑、兼容取舍、测试资产与覆盖度台账、改 skill/技能文档、扫描 rules/skills/agents 冲突时同样用。从零产 PRD 用 ai-prd。"
---

## 工作区隔离门要点

- **必须建 worktree**：路由与初始化**对话**做完后、**任何**文件落盘前（含标记块），MUST 已从最新主分支建出并**全程使用独立 worktree**；Lean 不豁免，MUST NOT 中途切回主工作树落盘；多仓每仓一个，MUST NOT 共用。
- **目录取自 `worktree-dir`**：未声明默认仓库根 `./.worktrees/`。每次创建前重新读，MUST NOT 沿用上次会话记住的路径。
- **过不了就中止**：主工作树有未提交改动、不是 Git 仓库、或建不出 worktree，MUST 中止并用业务语言说明；MUST NOT 替用户 stash / reset / checkout / 删未知文件，MUST NOT 降级为直接改当前目录。
- **进门之后**：先结清初始化挂账（标记块、冲突处置、缺 registry 跑 `ctx init`）；门禁全过后按 `merge-gate` **完成后自动合并主分支**。

  来源：`worktree开发纪律.md` §工作区隔离门

## 路由逻辑（每次调用先做）

**1. 【探测】** **项目根**下 `.codegraph/codegraph.db` 存在 → 加载 `references/capability/graph.md`。MUST 在路由阶段做完，MUST NOT 塞进流程门内部，路径 MUST NOT 按 cwd 解释。探测不到或失败按没有算，结构检索外包子代理：MUST NOT 阻断流程、MUST NOT 反复重试、MUST NOT 改问用户"有没有代码图谱"。**本步 MUST NOT 探测 engineering-context**——缺骨架隔离门内补建，缺条目按 `代码事实纪律.md` §4 补齐；MUST NOT 因"registry 是空的"判定可以直读代码，也 MUST NOT 因此告警。

**2. 【读标记块】** 只读、只对话，**MUST NOT 落盘**。MUST 把项目根 CLAUDE.md 与 AGENTS.md **两个入口都读**（以 CLAUDE.md 为准，MUST NOT 读到一个就停），取标记块 `<!-- ai-dev-workflow:start/end -->` 内的 `collaboration` / `merge-gate` / `worktree-dir`：

- **2a 有 `collaboration`** → 直接用；另一入口缺失、无块或不一致时按 `references/init-初始化.md` §幂等规则 以 CLAUDE.md 为准补齐，MUST 多说一句被覆盖的是什么。
- **2b 只有旧版 `mode`** → team → team + pr，其余 → solo + direct；MUST 一句话告知用户、允许当场改，再幂等回写两入口。MUST NOT 由旧值推出别的东西，MUST NOT 因旧值改变分流默认倾向。
- **2c 都无块** → 初始化（`references/init-初始化.md`）：先跑 `references/环境冲突扫描.md`，只问协作面 + 一条待拍板的 merge-gate 建议，按 `assets/config-snippets/` 注入两入口。**MUST NOT 问"要不要建 engineering-context"**。
- **2d 缺省/非法值**：`merge-gate` 缺失 → 判据见下表同名行；`worktree-dir` 缺失 → `./.worktrees/`；`collaboration` 不是 solo/team → 报错中止并列出合法值域，MUST NOT 猜测。
- **2e 用户要"扫描/体检 ai-dev 体系"** → 跑 ↑ 2c 那份扫描，冲突逐项交用户决断。

**3. 【分流前只取三份】** **常驻只有六份**：本入口 + `core/`（=`references/core/`）的 `00-流程总纲.md`、`代码事实纪律.md`、`用户沟通纪律.md`、`上下文卫生.md` + `references/collab/` 二选一，**分两批取**：此刻 MUST 只取下表〈每次唤起（分流前）〉行那三份 + 探测到的 `graph.md`；余下三份与总纲其余各节 **MUST NOT 在此刻取**。常驻**也不整篇读**：按每节的〈何时读本节〉到点再取；分册只**追加**、MUST NOT 削减常驻。

**4.** 过隔离门 → 按 §Step 0 过 Triage → 按下表两个 Triage 行定分支、**只补该支要的**。

## 加载点清单（MUST 在触发时才取、只取那节；MUST NOT 提前预读，MUST NOT 凭记忆代替取用）

| 触发条件 | 加载对象 | 为什么此刻需要 | 适用路径 |
|---|---|---|---|
| 每次唤起（分流前）| 本入口全文 + `core/用户沟通纪律.md` + `core/00-流程总纲.md` §Step 0 | 隔离门与第 2 步问答都在 Triage 之前，手里没别的文件 | 两条 |
| `merge-gate` 缺省 | `core/worktree开发纪律.md` §完成与自动合并门 | 判据只在那节定义 | 两条 |
| 要建 worktree | `core/worktree开发纪律.md` §工作区隔离门 | 入口要点只够判过不过 | 两条 |
| Triage 四问全否 | **Lean 分支**：`core/路径-lean.md` **前置节**（含 §1.2 = §默认倾向 投影，判升级用它、MUST NOT 再取原节）+ `collab/` 一份 + lean 模板 | 自足册含直管 Lean 的 MUST，MUST NOT 整篇预读、MUST NOT 再补余下三份 | Lean |
| Triage 任一为是（或 §默认倾向 判升级）| **完整分支**：补齐常驻余下三份 + `core/00-流程总纲.md` 其余前置节，再取 `core/步骤-1-7-设计与实现.md` | 只有完整流程用得上，分流前取 = Lean 白付 | 完整 |
| 红回路门命中（bug / 回归 / 异常行为）| `core/bug诊断纪律.md` (L§3bis) | 改代码前 MUST 先造复现回路 | 两条 |
| `ctx` 敲不动、返回空或术语对不上 | `core/代码事实纪律.md` §2 (L§3.2) | 兜底调用与"在哪跑"的陷阱 | 两条 |
| 要 clone 外仓取证／碰权威面要判刷不刷卡 | `core/代码事实纪律.md` §7 或 §8 (L§3.8/§3.9) | 取证顺序、补卡义务与刷卡判据 | 两条 |
| spec 定稿前要拍板兼容取舍 | `core/00-流程总纲.md` §兼容取舍确认门 (L§6.1) | 清单、三选项、落盘口径 | 两条 |
| spec 定稿后要过 spec 过稿门 | `core/00-流程总纲.md` §spec 过稿门 (L§6.3) | 摆什么、三条定稿判据、跳过只认用户显式表态、当场留痕 | 两条 |
| 登记替换清单 | `core/代码评审纪律.md` §替换清单 (L§4.3) | spec 要登记被取代物 | 两条 |
| 需求跨 ≥2 个边界／大 PRD 要拆切片／要定 PR 粒度 | `core/00-流程总纲.md` §按边界拆 四节 | 粒度判据只在那里 | 完整 |
| 要落笔写一张卡片，或要改/处置一张既有卡片 | `core/代码事实纪律.md` §4.1 + §4.2 (L§3.4/§3.5) | 最小四项形态缺一不可；卡片库只增不减、与源码不符就地修正、被删实现进陷阱项 | 两条 |
| 过代码评审门 | `core/代码评审纪律.md` §门禁 + §评审轴 + §子代理 prompt 模板 + §处置、`core/00-流程总纲.md` §代码评审门 (L§9) | 先定范围与通路（够小可登记积压）、派几个子代理、文档轴恒跑、MUST 替换占位符、P0/P1 口径 | 两条 |
| 进入测试阶段 | `core/步骤-8-10-测试.md` | 测试阶段步骤 | 完整 |
| 有真实数据／凭证／要挂覆盖度台账 | `core/测试资产纪律.md` (L§8) | 真实输入固化与台账 | 两条 |
| 要给新建文档起名落盘／要判文档去留、归档、索引分层 | `core/文档治理.md` (L§10bis) | 生命周期与索引门控 | 两条 |
| 要往需求真相源或 TODO 写东西 | `core/文档治理.md` (L§10.5–10.7) | 真相源只写现状，尚未实现的去 TODO | 两条 |
| 过完成与自动合并门 | `core/worktree开发纪律.md` 与 `core/00-流程总纲.md` 各的 §完成与自动合并门 (L§11) | 首次加载可能已随交接失效 | 两条 |
| 动笔写 spec | `core/spec写作纪律.md` (L§4.2) | 零上下文可动手、RFC2119、无占位符 | 两条 |
| 出现过载信号要交接 | `core/spec写作纪律.md` (L§4.2) | 交接文档遵循它，读者零上下文 | 两条 |

**Lean 是替代不是叠加**：〈加载对象〉带 `(L§x)` 的行，完整流程取该加载对象，Lean **改取**自足册 `core/路径-lean.md` §x、**MUST NOT 两份都读**；只有该节自己写明的"要展开/要细则"条件命中，才再取本行原篇。其余行两条路径都取本行。含 AI/LLM 按 `core/AI-LLM-overlay.md` 叠加契约，判为 Agentic 应用 MUST 加载独立 skill `agentic-principle`。

## 关键纪律

**`engineering-context/` 必备、没有开关**（`core/代码事实纪律.md`）。`ctx` 敲不到 **MUST NOT 读成"这一层不可用"**：改用 `node <skill>/scripts/ctx/src/cli.js`，MUST NOT 裸 grep 权威实体、MUST NOT 顺延补卡。
