---
name: ai-dev-workflow
description: "AI 辅助开发主流程：从已有 PRD 起步做需求落地、顶层架构 Overview、技术 spec、coding plan、拆任务、测试方案，或提到'开发流程/怎么用 AI 把需求做成代码/技术设计'时使用；编码后的四轴子代理代码评审、清旧逻辑、兼容取舍、测试资产与覆盖度台账、扫描项目 rules/skills/agents 与本流程的冲突时同样使用。从零产出新 PRD 用 ai-prd。"
---

# ai-dev-workflow

**常驻只有六份**：本入口 + `core/`（= `references/core/`）的 `00-流程总纲.md`、`代码事实纪律.md`、`用户沟通纪律.md`、`上下文卫生.md` + `references/collab/` 二选一。其余判据 MUST 按〈加载点清单〉在触发时才取、只取那一节；分册只**追加**约定，MUST NOT 削减常驻的任何一条。

**装了本 skill 的项目一律维护 `engineering-context/` 代码事实层**：不分项目大小与协作面、没有开关（`core/代码事实纪律.md`）。只有两件事可变：**协作面**（标记块 `collaboration`，问一次即固化）、**代码图谱**（每次运行探测得出，不写配置）。

## 工作区隔离门要点（在 Triage 之前，手里只有本文件）

- **必须建 worktree**：路由与初始化的**对话**做完后、**任何**文档或代码落盘前（含初始化要写的标记块），MUST 已在从最新主分支创建的独立 Git worktree 内，并**全程使用独立 worktree**；Lean 不豁免，MUST NOT 中途切回主工作树落盘；多仓每仓一个，MUST NOT 共用。
- **目录取自哪个字段**：标记块的 `worktree-dir`，未声明时默认仓库根 `./.worktrees/`（首次唤起用初始化定下的值）。每次创建前重新读，MUST NOT 沿用上次会话记住的路径。
- **过不了就中止**：主工作树有未提交改动、目标不是 Git 仓库、或建不出 worktree 时，MUST 中止并用业务语言说明；不干净的只会是用户自己的改动：MUST NOT 替用户 stash / reset / 提交 / checkout 覆盖 / 删除未知文件，MUST NOT 降级为直接改当前目录。
- **进门之后**：先结清初始化挂账（注入标记块、执行已决断的冲突处置、缺 `capability-registry.md` 时跑 `ctx init` 建骨架），再开始任务；门禁全过后按 `merge-gate` **完成后自动合并主分支**。

  来源：`worktree开发纪律.md` §工作区隔离门

## 路由逻辑（每次调用先做）

**1. 【探测】** **项目根**（放 CLAUDE.md 的那层）下 `.codegraph/codegraph.db` 存在 → 加载 `references/capability/graph.md`。MUST 在路由阶段做完，MUST NOT 塞进任何流程门内部，路径 MUST NOT 按当前工作目录解释。探测不到或失败一律按没有算，结构检索外包子代理：MUST NOT 阻断流程、MUST NOT 反复重试、MUST NOT 改问用户"有没有代码图谱"。**本步 MUST NOT 探测 engineering-context**——必备资产不是开关，有没有条目都不改变加载什么、走哪条分流；缺骨架在工作区隔离门内补建，缺条目按 `core/代码事实纪律.md` §4 补齐。MUST NOT 因为"registry 是空的"就判定可以直读代码，也 MUST NOT 因此告警。

**2. 【读标记块】** 只读、只对话，**MUST NOT 落盘**——写盘排在进 worktree 之后。MUST 把项目根的 CLAUDE.md 与 AGENTS.md **两个入口都读**（以 CLAUDE.md 为准，MUST NOT 读到一个就停），取 `<!-- ai-dev-workflow:start -->`…`<!-- ai-dev-workflow:end -->` 内的 `collaboration="solo|team" merge-gate="direct|pr" worktree-dir="./.worktrees/"`：

- **2a 有 `collaboration`** → 直接用；另一入口缺失、无块或不一致时按 `references/init-初始化.md` §幂等规则 以 CLAUDE.md 为准补齐，MUST 多说一句被覆盖掉的是什么。
- **2b 只有旧版 `mode`** → team → team + pr，其余 → solo + direct；MUST 一句话告知用户、允许当场改，再幂等回写两个入口。MUST NOT 由旧值推出别的东西，MUST NOT 因旧值改变分流默认倾向。
- **2c 都无块** → 初始化（`references/init-初始化.md`）：先跑 `references/环境冲突扫描.md`，只问一个问题（协作面）+ 一条待拍板的 merge-gate 建议，按 `assets/config-snippets/` 注入两个入口。**MUST NOT 问"要不要建 engineering-context"**。
- **2d 缺省/非法值**：`merge-gate` 缺失 → 判据只在 `core/worktree开发纪律.md` §完成与自动合并门 定义一次；`worktree-dir` 缺失 → `./.worktrees/`；`collaboration` 不是 solo/team → 报错中止并列出合法值域，MUST NOT 猜测。
- **2e 用户要"扫描/体检 ai-dev 体系"** → 跑 `references/环境冲突扫描.md`，冲突逐项交用户决断。

**3. 【加载】** 常驻六份 + 探测到代码图谱时加 `graph.md`（**此时不要读流程分册**）。**4.** 过工作区隔离门，按 `core/00-流程总纲.md` 做 Triage 分流，按下表取用。

## 加载点清单（MUST NOT 提前预读，MUST NOT 凭记忆代替取用）

| 触发条件 | 加载对象 | 为什么此刻需要 | 适用路径 |
|---|---|---|---|
| 每次唤起 | 本入口全文 | 路由要用；隔离门在 Triage 之前，手里没有别的文件 | 两条 |
| 路由第 2d 步 `merge-gate` 缺省 | `core/worktree开发纪律.md` §完成与自动合并门 | 该判据只在那节定义一次 | 两条 |
| 要建 worktree | `core/worktree开发纪律.md` §工作区隔离门（Lean 加自足册 §2）| 入口要点只够判"要不要过"，动作要细则 | 两条 |
| Triage 四问全否 | `core/路径-lean.md` 的**前置节**（§0–1、§3–7、§10、§12–16）+ `collab/` 一份 + `templates/lean-change-spec.md` | 自足册是判据载体，含直管 Lean 的 MUST；前置节读完即可开工，触发式节各占下面一行，MUST NOT 整篇预读 | Lean |
| Triage 任一为是 | 常驻六份 + `core/步骤-1-7-设计与实现.md` | 完整流程的步骤细节 | 完整 |
| 红回路门命中（bug / 回归 / 异常行为）| `core/bug诊断纪律.md`（Lean 加自足册 §3bis）| 改代码前 MUST 先造复现回路 | 两条 |
| 动笔写 spec | `core/spec写作纪律.md`（Lean 要点已在自足册）| 零上下文可动手、RFC2119、无占位符 | 两条 |
| 登记替换清单 | `core/代码评审纪律.md` §替换清单 | spec 要登记被取代物 | 两条 |
| 过代码评审门 | `core/代码评审纪律.md` §门禁 + §四条轴 + §子代理 prompt 模板 + §处置（Lean 加自足册 §9）| 主会话职责：派几个子代理、文档轴恒跑、派发方 MUST 替换 prompt 占位符、P0/P1 口径、结算落盘 | 两条 |
| 进入测试阶段 | `core/步骤-8-10-测试.md` | 测试阶段步骤细节 | 完整 |
| 有真实数据／凭证／要挂覆盖度台账 | `core/测试资产纪律.md`（Lean 加自足册 §8）| 真实输入固化与台账判据 | 两条 |
| 要判文档去留、归档、索引分层 | `core/文档治理.md`（Lean 加自足册 §10bis）| 生命周期与索引门控判据 | 两条 |
| 过完成与自动合并门 | `core/worktree开发纪律.md` §完成与自动合并门（Lean 加自足册 §11）| 判据在此；第一道门那次加载可能已随交接失效 | 两条 |
| 出现过载信号要交接 | `core/spec写作纪律.md` | 交接文档遵循它，读者零上下文 | 两条 |

含 AI/LLM 按 `core/AI-LLM-overlay.md` 叠加契约；判定为 Agentic 应用 MUST 加载独立 skill `agentic-principle`。写不出"为什么此刻需要"的加载不该发生：MUST 删掉那次加载，MUST NOT 补个理由塞进清单。

## 关键纪律

取代码事实先 `ctx find-scenes`、再 `ctx discover` / `get-card` 收窄，事实必须附 cite；查不到就读源码并当场补卡、随本次分支提交，**MUST NOT 裸 grep 找权威实体**、MUST NOT 顺延（`ctx` 敲不到就用 `node <skill>/scripts/ctx/src/cli.js`）。
