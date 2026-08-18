---
name: ai-dev-workflow
description: "AI 辅助开发主流程。当用户要做需求落地、AI 辅助开发、澄清已有 PRD、顶层架构 Overview、技术 spec、coding plan、拆任务、测试方案，或提到'开发流程/怎么用 AI 把需求做成代码/技术设计'时使用。编码完成后的代码评审（规范/忠实/残留三轴子代理评审）、清理被取代的旧逻辑、决定是否向后兼容、把真实数据固化成测试用例、补端到端用例或维护测试覆盖度台账时同样使用。从零产出一份新 PRD 时不要用本 skill，用 ai-prd（本 skill 从已有 PRD 起步，其产物即本 skill Step 1 的输入）。首次在某项目调用只问一次协作面（除你之外是否还有人一起开发），把配置写入 CLAUDE.md 与 AGENTS.md 并建起 engineering-context 骨架，之后按块内字段路由。取代码事实一律先查 engineering-context 卡片，没有卡片就读源码、读完当场把卡片补上，绝不裸 grep 找权威实现；探测到 codegraph 索引时结构检索走代码图谱。用户要求扫描/体检项目的 ai-dev 体系、检查项目里的 rules/skills/agents 是否与本流程冲突时也使用。"
---

# ai-dev-workflow

把一个需求，逐层降解成"零上下文的 AI agent 也能可靠执行"的任务。内核（`references/core/`）**无条件常驻**，在它之上按需追加分册。

**装了本 skill 的项目一律维护 `engineering-context/` 代码事实层**（registry + cards）。它不分项目大小、不分协作面、没有开关：初始化时建骨架，之后**要用某个模块的事实就先查卡片；没有卡片就读源码，读完把卡片补上**。判据与写法在无条件常驻的 `references/core/代码事实纪律.md`。

在这之上，只有两件事是**可变的**：

- **协作面**——这个项目除你之外还有没有别人一起开发。读标记块的 `collaboration` 字段，问一次即固化。
- **代码图谱**——项目有没有建本地代码知识图谱索引。**每次运行探测得出**，不问用户、不写进配置。它只是**检索加速面**（回答"找得到吗"），不改变任何流程判据；没有它就把重探索外包给子代理。

分册只**追加**约定，MUST NOT 削减 core 的任何一条。

> **触发提示**：自动触发不总是稳定。若发现某一步没走本流程，直接在 prompt 里**点名 skill / 步骤**（如"用 ai-dev-workflow 的 Step 2 出 Overview""按 eng-spec 模板写"），比依赖关键词更可靠。

## 目录结构（本 skill 自身）

```
references/
  core/
    00-流程总纲.md       【常驻·骨架】Triage 分流 + 四道门 + 步骤索引
    路径-lean.md         【分流后】Lean 一页走完（Triage 四问全否时读这份）
    步骤-1-7-设计与实现.md 【分流后】完整流程 Step 1–7 细节
    步骤-8-10-测试.md     【阶段切换】完整流程 Step 8–10 细节，过完评审门再读
    代码事实纪律.md      【常驻】先查卡片 / 没卡就读源码并当场补卡 / cite / 新鲜度
    worktree开发纪律.md  独立 worktree 全程开发 + 完成后自动合并主分支
    spec写作纪律.md      零上下文可动手 / RFC2119 / 无占位符
    AI-LLM-overlay.md    含 AI/LLM 时叠加的 AI 契约清单
    文档治理.md          spec / plan / report 的唯一输出目录与命名 + 文档生命周期与索引门控
    文档归档与账本收敛.md 【条件】归档头注模板 + 结算示例 + 两个账本各自的收敛方式
    engineering-context设计.md 【条件】资产层完整设计：registry 字段 / 场景蓝图 / 探针集 / 新鲜度机制
    用户沟通纪律.md      业务语言 + 大架构确认 + 详细设计自主决策
    bug诊断纪律.md       【条件】红回路优先：先造能变红的复现命令，再谈假设
    代码评审纪律.md      【条件】编码后强制子代理三轴评审 + 替换清单（旧逻辑登记与核销）
    测试资产纪律.md      【条件】长链路端到端 + 真实输入固化 + 覆盖度台账
    上下文卫生.md        聪明区决策 / 交接不硬撑 / 编码任务零上下文起步
  collab/                【按 collaboration 字段二选一，必加载一份】
    solo.md              无其他人类协作方：可跳步、你自己拍板兼容、子代理是唯一第二双眼睛
    team.md              有其他人类协作方：owner 对齐、评审会、业务方拍板、PR 平台动作
  capability/            【按运行时探测结果加载，可零篇】
    graph.md             探测到 .codegraph/codegraph.db 时：代码图谱查现状（符号/调用链/影响面）
  init-初始化.md         如何幂等写入 CLAUDE.md/AGENTS.md + 建 engineering-context 骨架
  环境冲突扫描.md        初始化/体系扫描时检查项目自带指令（CLAUDE.md 正文 / skills / agents / commands）的工作方式冲突
assets/
  templates/           lean-change-spec / overview / eng-spec / coding-plan / test-spec / test-coverage
  config-snippets/     注入 CLAUDE.md 与 AGENTS.md 的片段（base.md 无条件 + collab-solo/collab-team 二选一）
  context-layer/       capability-registry / card / scene-blueprint / probe-set / glossary 模板
scripts/ctx/           ctx CLI（Node.js，跨平台）：查代码事实
```

## 路由逻辑（每次调用先做这个）

**三步：①探测代码图谱 ②读标记块得协作字段 ③加载 core + 命中的分册。**

```
1. 【探测】只探测一件事：**项目根**（含 CLAUDE.md / AGENTS.md 的那一层）下的
   .codegraph/codegraph.db 是否存在 → 存在则启用【代码图谱】，加载 capability/graph.md。
   一次文件存在性检查，秒级；MUST 在路由阶段做完，MUST NOT 塞进任何流程门内部。
   路径 MUST NOT 按当前工作目录解释。
   探测不到就按没有算，结构检索改为外包子代理（core/上下文卫生.md 规则 4）。
   探测本身失败（权限不足、IO 错误）时同样按没有算，用一句话告知原因即可：
   MUST NOT 阻断流程、MUST NOT 反复重试、MUST NOT 改问用户"这个项目有没有代码图谱"。

   【本步 MUST NOT 探测 engineering-context】——它是**必备资产**，不是可选开关，
   因此不参与路由判断：registry 里有没有条目、卡片建了几张，都不改变本次加载什么、
   走哪条分流。缺失时由初始化补建骨架（第 2c 步 → init-初始化.md 第 5b 步），
   缺条目时由 core/代码事实纪律.md §4 在干活过程中当场补齐。
   MUST NOT 因为"registry 是空的"就判定可以直读代码，也 MUST NOT 因此告警或提示用户。

2. 【读标记块】**本步只读、只对话，MUST NOT 落盘。** 下面 2a/2b/2c 说的"补齐/回写/注入"
   都是**决定要写什么**，真正写文件排在**过完工作区隔离门、进入 worktree 之后**
   （core/worktree开发纪律.md §工作区隔离门 第 4 步）：在门前写会把主工作树弄脏，
   于是每个项目第一次唤起本 skill 都被自己的门拦下；而且写在主工作树的块不会出现在
   随后新建的 worktree 里，配置悬空，下次唤起又要重来。
   MUST 把当前项目根的 CLAUDE.md 与 AGENTS.md **两个入口都读**
   （字段以 CLAUDE.md 为准，AGENTS.md 用于比对与补齐，MUST NOT 读到一个就停）：
   <!-- ai-dev-workflow:start -->
   … collaboration="solo|team" merge-gate="direct|pr" worktree-dir="./.worktrees/" …
   <!-- ai-dev-workflow:end -->
   下面 2a/2b 说的"块"= CLAUDE.md 里的那一块；CLAUDE.md 没有块而 AGENTS.md 有，
   就先读 AGENTS.md 的块走 2a/2b，并按 2a 把它幂等补进 CLAUDE.md。

2a. 块内【有】collaboration → 直接用，不再询问。另一文件缺失、无块、或块内**字段与本文件
     不一致**时，按 references/init-初始化.md §幂等规则 处置：以 CLAUDE.md 的值为准幂等
     补齐/覆盖另一入口，且 MUST 多说一句被覆盖掉的是什么
     （软链接规则见 references/init-初始化.md §入口是软链接时）。

2b. 块内【只有】旧版安装留下的 mode 字段、没有 collaboration → 按旧值推协作字段：
     旧值为 team → collaboration="team" + merge-gate="pr"；其余旧值 → solo + direct。
     推断结果 MUST 一句话告知用户、允许当场改，然后幂等回写两个入口——只告知一次
     （回写后块已含显式字段，下次走 2a）。文案与规则见 init-初始化.md §从旧标记块推断协作面。
     MUST NOT 由旧值推出任何别的东西，MUST NOT 因旧值改变分流默认倾向——那由 00-流程总纲
     §默认倾向 无条件定义，与协作面无关。

2c. 两个入口都【没有】标记块 → 进入【初始化】（references/init-初始化.md）：先自动跑
     references/环境冲突扫描.md，再只问一个问题（协作面）+ 一条待拍板的 merge-gate 建议，
     按 assets/config-snippets/base.md + collab-<collaboration>.md 幂等注入
     CLAUDE.md 和 AGENTS.md（都要写，兼容 Claude Code + Codex），并建起 engineering-context
     骨架。**MUST NOT 问用户"要不要建 engineering-context"**——它是必备资产，不是选项。

2d. 字段缺省与非法值：merge-gate 缺失 → 判据（现状 > 协作面推断）**只在
     core/worktree开发纪律.md §完成与自动合并门 定义一次**，按它执行，本处不复述。
     worktree-dir 缺失 → ./.worktrees/；collaboration 取值不是 solo/team →
     报错中止并列出合法值域，MUST NOT 猜测。

2e. 用户显式要求"扫描/体检项目的 ai-dev 体系" → 单独执行 references/环境冲突扫描.md
    （已有协作面时不重问协作面），冲突逐项交用户决断后按其选择处置。

3. 【加载】常驻 core 七篇：00-流程总纲 / 代码事实纪律 / worktree开发纪律 / spec写作纪律 /
   文档治理 / 用户沟通纪律 / 上下文卫生。再追加：
     - 协作面（必加载一份）：solo → references/collab/solo.md
                             team → references/collab/team.md
     - 探测到代码图谱时（可零篇）：references/capability/graph.md
     - core/engineering-context设计.md：只在要动 engineering-context 的**结构**时读
       （设计 registry 字段 / 画场景蓝图 / 维护探针集 / 判新鲜度机制）。
       **日常补一张卡片不用读它**——最小形态在 代码事实纪律.md §4.1。
   【此时不要读流程分册】——分流之后才知道该读哪一份。

4. 按 00-流程总纲.md 驱动：先过 worktree 工作区隔离门，再做 Triage 分流，
   然后【按分流结果】只加载对应分册：
     - 四问全否 → references/core/路径-lean.md（一页走完，不读另两册）
     - 任一为是 → references/core/步骤-1-7-设计与实现.md
                  过完代码评审门后，再加载 references/core/步骤-8-10-测试.md

5. 另五篇 core 按需分阶段读，各读所需小节即可：
     - AI-LLM-overlay.md：需求含 AI/LLM 功能、Step 4 要叠加 AI 契约时。
       其中判定为 **Agentic 应用**（模型自主规划 / 直接调工具 / 未过闸门就改状态 /
       记忆跨会话影响决策）时，MUST 另行加载**独立 skill `agentic-principle`**
       做架构选型与提示词设计——两者内容互不搬运，见该 overlay §Agentic 应用。
     - bug诊断纪律.md：任务是修 bug / 查回归 / 解释异常行为时（动手改代码前）。
     - 代码评审纪律.md：**改产品代码的任务基本都要读，分两次**——写 spec 时读
       §替换清单（登记），编码完成派评审子代理时读 §三轴与 §子代理 prompt 模板。
     - 测试资产纪律.md：进入 Step 8–10、用户提供了真实数据或凭证、bug 修复归档时。
     - 文档归档与账本收敛.md：准出结算判定出某篇文档需转归档时、或要写
       bug修复历史.md / 测试场景覆盖度.md 时。判据本身在 文档治理.md §3，无需为读判据而读它。
```

## 关键纪律

**底线（任何任务、任何时刻）**——判据都在对应 reference 里，这里只作提醒：

- **代码事实先查卡片，没卡就读源码并当场补卡，MUST NOT 裸 grep 找权威实体**：先 `ctx find-scenes` 取业务全景，再 `ctx discover` / `get-card` 收窄（排序铁律见 `core/代码事实纪律.md` §3），事实必须附 cite，无 cite 视为幻觉；查不到就读源码 + 补卡（§4），补卡随本次分支提交，**MUST NOT 顺延**。结构性定位在探测到代码图谱时走 `capability/graph.md`，否则外包子代理（`core/上下文卫生.md`）。
- **不问第二次协作面**：初始化后固化在 CLAUDE.md/AGENTS.md 的 `collaboration` 字段，除非用户显式要求切换。**代码图谱既不问也不写**——每次运行探测得出。
- **开发全程隔离并自动归并**：任何文档或代码落盘前进入、并**全程使用独立 worktree**（目录读 CLAUDE.md/AGENTS.md 标记块的 `worktree-dir` 字段，缺失时默认 `./.worktrees/`）；门禁全过后按 `merge-gate` 合并主分支，失败保留现场不绕过保护分支。→ `core/worktree开发纪律.md`
- **用户沟通只用业务语言**：大架构由用户确认，模块内设计只问业务问题，详细程序设计自主完成。→ `core/用户沟通纪律.md`
- **文档只写标准目录，且有退出机制**：spec→`docs/spec/`、plan→`docs/plan/`、report→`docs/report/`；新建文档带 `lifecycle` + `authority_refs`，准出时按权威面结算去留，索引只放现行口径。→ `core/文档治理.md`
- **写到零上下文也能动手**：RFC2119、无占位符、事实带来源。→ `core/spec写作纪律.md`
- **上下文卫生**：方向性决策在聪明区内完成，逼近上限就交接，重探索外包子代理。→ `core/上下文卫生.md`

**按阶段触发的门（命中就必须过，Lean 也不豁免）**：

| 何时 | 必须做什么 | 判据 |
|---|---|---|
| 改代码前（bug 类）| 先查修复历史，再造"能变红、确定性、快、可自跑"的复现命令；无回路不许提假设、不许改代码 | `core/bug诊断纪律.md` |
| 取任何模块的代码事实时 | 先查卡片；查不到就读源码，**读完当场把卡片补上**并随本次分支提交 | `core/代码事实纪律.md` §4 |
| 写 spec 时（含 AI/LLM）| 在基础 spec 上叠加 AI 契约 | `core/AI-LLM-overlay.md` |
| 需求是 **Agentic 应用** | **MUST 加载独立 skill `agentic-principle`**：spec 设计、开发参考、评审增派 agent 架构轴。它的内容不并入本 skill，缺失时告知用户并把架构选型标"待补" | `core/AI-LLM-overlay.md` §Agentic 应用 |
| spec 定稿前 | **兼容取舍交用户逐条拍板**，AI 不得默认兼容；无变更也要显式声明 | 总纲 §兼容取舍确认门 |
| 写 spec + 编码时 | 登记**替换清单**，被取代的旧逻辑当场删，保留项须带理由与到期日 | `core/代码评审纪律.md` §替换清单 |
| 编码完成后 | **派子代理跑三轴评审**（完整 3 个 / Lean 1 个），P0/P1 修完才过门 | `core/代码评审纪律.md` |
| 测试阶段 | 长链路必须端到端且断言中间产物；真实输入固化复用；未覆盖场景挂账 | `core/测试资产纪律.md` |

## 何时用哪个模板

见 `references/core/00-流程总纲.md` §完整流程步骤索引 的"对应模板"列，模板都在 `assets/templates/` 下。
