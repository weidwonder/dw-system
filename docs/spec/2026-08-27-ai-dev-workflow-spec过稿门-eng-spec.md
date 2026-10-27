---
lifecycle: active
superseded_by: ''
archived: ''
last_confirmed: '2026-10-26'
authority_refs:
  - '贯穿门清单与各门插入位置（dw-system/skills/dw-workflow/references/00-流程总纲.md §五道门）；spec 过稿门的判据（dw-system/skills/dw-workflow/references/确认门.md §spec 过稿门）'
  - '三层确认边界（dw-system/skills/dw-workflow/references/用户沟通纪律.md §3 与 §发送前检查）'
  - 'eng-spec 模板章节集合（新增 §13 过稿记录）'
  - 'lean-change-spec 模板节集合（新增过稿记录行）'
  - 'dw-workflow 入口指向本门的那一行（3.0.0 起在 SKILL.md〈读取条件〉表；入口字节上限在 test/doc-budgets.json 的 classes）'
  - '计数词受检词表（test/counter-word.test.mjs 的 CHECKED_WORDS）'
  - '注入目标项目的标记块里本门那一条（dw-system/skills/dw-workflow/assets/config-snippets/base.md、collab-solo.md）'
---

# ai-dev-system_技术 Spec — spec 过稿门

## 0. 阅读导引（MUST，前置）

- **一句话目的**：这份 spec 让 `ai-dev-workflow` 在技术 spec 定稿之后、生成 Coding Plan 之前，多一道让用户通读并表态的**贯穿门**，使"零上下文 agent 照着做"的那份输入在开工前被需求方本人认可过。
- **端到端场景**：
  1. 走完整流程的开发者在 Step 5 内部技术自检后过兼容取舍确认门，逐条拍完兼容取舍 → AI 紧接着把 spec 的业务可判定部分摆给他 → 他提了三条意见 → AI 逐条落稿并回到本门 → 他说"可以开工" → AI 记一行过稿记录，进 Step 6。
  2. 同一个人对一个小改动说"这次不用看，直接往下" → AI 记一行"用户显式跳过本次"，进 Step 6；**下一次流程仍然默认过这道门**。
  3. 用户对本门的问询没有任何回复 → AI 停在这里等，一句话告知，MUST NOT 自行判定为定稿。
  4. Lean 路径的小改动：整页 Lean Change Spec 与兼容取舍、大架构摘要**同一批**抛出，用户一次表态覆盖三件事。
- **核心流程图**：

  ```mermaid
  flowchart TD
    S5[Step 5 内部技术自检] --> G1[兼容取舍确认门]
    G1 --> G2{spec 过稿门}
    G2 -->|用户提了意见| R[逐条落稿]
    R --> C{改的是 §1.1 / §11 / §8.1 吗}
    C -->|是| G1
    C -->|否| G2
    G2 -->|用户定稿| S6[Step 6 Coding Plan]
    G2 -->|用户显式说本次不用看| S6
    G2 -->|用户没有回复| W[停在这里等]
  ```

- **决策表**：

  | 输入 / 状态 | 条件 | 走向 / 处置 | 结果 |
  |---|---|---|---|
  | 用户逐点回复，或整体认可（"就按这个走 / 没问题 / 可以开工"）| — | 记一行过稿记录 | 进 Step 6 |
  | 用户只回了一部分 | — | 只就未回的那几项再问一次，已回的不重复问 | 回本门 |
  | 用户没有回复 | — | 一句话告知后停等，MUST NOT 反复追问 | 流程挂起 |
  | 用户显式说"这次不用看 / 直接往下 / 跳过" | 表态由用户主动给出 | 记一行"用户显式跳过本次" | 进 Step 6，**仅本次有效** |
  | AI 觉得改动很小 | 用户未表态 | **不成立的分支**：MUST NOT 主动提议跳过、MUST NOT 自行跳过 | 照常过门 |
  | 用户意见改到 §1.1 功能需求 / §11 完成定义 / §8.1 兼容取舍结论 | — | 先回兼容取舍确认门重过清单，再回本门 | 回本门 |
  | 用户意见只改到 §2 / §3 / §4 / §7 等技术章节 | — | 落稿后直接回本门 | 回本门 |

## 1. 范围

- 本仓库做什么：给 `ai-dev-workflow` skill 新增一道名为 **spec 过稿门** 的贯穿门，并把它接进总纲、完整流程分册、Lean 自足册、两份协作面分册、两份模板、两份注入片段、入口加载点清单与机器闸。
- **不做什么**：
  - 不改 Step 1 / Step 3 的澄清方式，不改大架构确认门、代码评审门、完成与自动合并门的任何判据。
  - 不动 `ai-prd` skill 的流程（只改它 `references/collab/team.md` 里一处引用了贯穿门数量的表述）。
  - **不拆分入口 `SKILL.md`**：本次靠上调字节上限（FR-018）腾出余量，不动入口的分层结构。
  - 不把"跳过本门"做成配置项、标记块字段或项目级默认。
  - 不给本门设条件触发判据（它默认每次都过）。
- 依赖的上游 / 被依赖的下游：
  - 上游：兼容取舍确认门 — `ai-dev-system/skills/ai-dev-workflow/references/core/00-流程总纲.md:115`
  - 下游：Step 6 生成 Coding Plan — `ai-dev-system/skills/ai-dev-workflow/references/core/步骤-1-7-设计与实现.md:161`
  - 参照实现（不改它，只对齐概念）：`ai-prd` 的用户过稿门 — `ai-dev-system/skills/ai-prd/references/00-prd生成流程.md:207`

- **既有系统清单**：

| 既有模块 / 机制 | 从哪知道它的 | 本次可能怎么碰到 | 卡片补了吗 |
|---|---|---|---|
| 贯穿门总表（计数词 `四道门` 的权威定义处）| `engineering-context/cards/ai-dev-system.md#流程门禁契约（ai-dev-workflow）` @2026-08-27 | 表格加一行、小节标题改数字 | 本次新补 `cards/ai-dev-system.md#流程门禁契约（ai-dev-workflow）` |
| 兼容取舍确认门 | 同上 cite | 末尾接一句指向本门 | 同上 |
| 大架构确认门（判据在 `用户沟通纪律.md:11-45`，落地在 `步骤-1-7-设计与实现.md:101`）| 同上 cite | 本门 MUST 与它划清参照物 | 同上 |
| 三层确认边界 §3「详细程序设计：无需用户确认」与 §发送前检查 | `ai-dev-system/skills/ai-dev-workflow/references/core/用户沟通纪律.md:60-72` | 本门与之语义相邻，MUST 加边界说明 | 同上 |
| Lean 自足册的门全景与第 4 步 | `ai-dev-system/skills/ai-dev-workflow/references/core/路径-lean.md:88,335,367` | 加一节，不新增 Lean 步骤号 | 同上 |
| 入口加载点清单与 `ENTRY_MAX_BYTES` | `ai-dev-system/skills/ai-dev-workflow/SKILL.md`（7980 字节）、`test/contract-numbers.mjs:25` | 增一行 + 无损精简腾字节 | 同上 |
| 计数词机器闸的受检词表 | `test/counter-word.test.mjs:39-77` | `四道门` → `五道门` | 同上 |
| solo / team 协作面分册的门相关条目 | `ai-dev-system/skills/ai-dev-workflow/references/collab/solo.md:21,33-35,49`、`.../team.md:13-21,29` | 各增本门条目 | 同上 |

### 1.1 功能需求（MUST 编号）

| 编号 | 需求 |
|---|---|
| FR-001 | 完整流程在**兼容取舍确认门之后、Step 6 生成 Coding Plan 之前**新增一道贯穿门「spec 过稿门」，默认每次都过；贯穿门总数由四道变为五道。 |
| FR-002 | 本门请用户表态的**参照物限定为 spec 里业务可判定的部分**（§1 范围与不做什么、§1.1 功能需求、§8.1 兼容取舍结论、§11 完成定义）；MUST NOT 请用户确认 §2 数据模型 / §3 接口契约 / §4 核心逻辑 / §7 可观测性等详细程序设计。 |
| FR-003 | 用户提的每条意见 MUST 逐条落进 spec，或明确回"不改 + 一句话理由"；MUST NOT 默默忽略。 |
| FR-004 | "怎样算定稿"由三条判据判定：①逐点回复或整体认可 → 定稿；②只回一部分 → 只就未回项再问一次；③没有回复 → 一句话告知后停等，MUST NOT 反复追问、MUST NOT 自行判定为定稿。 |
| FR-005 | 跳过本门只有一条通路：**用户在本次对话里显式表态**（"这次不用看 / 直接往下 / 跳过"）。AI MUST NOT 主动提议跳过，MUST NOT 因"改动小""是我自己一个人"自行跳过。跳过**只对本次流程有效**，MUST NOT 记成项目级默认、MUST NOT 写进标记块。 |
| FR-006 | 本门的结果 MUST 留痕：完整流程写进 eng-spec 新增的 §13 过稿记录；Lean 写进 lean-change-spec 新增的过稿记录行。留痕内容为日期 + 三选一结论（定稿 / 用户显式跳过本次 / 提了哪些意见及落稿情况）。 |
| FR-007 | 用户意见改动了 §1.1 功能需求、§11 完成定义或 §8.1 兼容取舍结论时，MUST 先回兼容取舍确认门重过一遍清单，再回本门；只改技术章节时直接回本门。 |
| FR-008 | Lean 路径本门**并进 `路径-lean.md` 第 4 步**（§6）那一批，与兼容取舍、大架构确认摘要同一批抛出；MUST NOT 新增 Lean 步骤号，MUST NOT 让 Lean 豁免本门。（3.0.0 起 Lean 自足册取消，`路径-lean.md` 改为一页步骤顺序，本门在 §顺序 表第 6 步，仍与兼容取舍、大架构摘要同一批抛出。） |
| FR-009 | 计数词 `四道门` 改为 `五道门`，权威定义处仍只有 `00-流程总纲.md`；`test/counter-word.test.mjs` 的受检词表同步，其余复述处按既有豁免规则处置。 |
| FR-010 | `用户沟通纪律.md` §3 与 §发送前检查 MUST 增加边界说明：本门问的是"要做的事对不对"而非"怎么做对不对"，因此**不构成 §3 的例外**；MUST NOT 借本门把技术选型摆给用户。 |
| FR-011 | `collab/solo.md` 的"允许因等用户而挂起的例外"清单 MUST 增加本门；`collab/team.md` MUST 写明本门的拍板人是业务方、且只摆业务可判定项。两份注入片段（`base.md`、`collab-solo.md`）同步。 |
| FR-012 | 入口 `SKILL.md` 的加载点清单 MUST 增一行指向本门。增行 MUST NOT 减少入口内任何 MUST / MUST NOT / SHOULD / MAY 条数与判据正反例条数。（3.0.0 起〈加载点清单〉取消，入口改用〈读取条件〉表，本门那一行是「spec 定稿前后 → `确认门.md`」；规范条数棘轮已退役，改由规范去向清单闸把守。） |
| FR-013 | 新增机器闸 `test/gate-sync.test.mjs`：断言每道贯穿门在其**必须被复述的文件集合**里都在场，并断言总表行数与计数词一致。 |
| FR-014 | 修正既有交叉引用漂移：`00-流程总纲.md` 与 `用户沟通纪律.md` 里的「见 `路径-lean.md` 第 5 步」MUST 改为「第 4 步」（自足册里兼容取舍门是第 4 步 §6，第 5 步不存在）。 |
| FR-015 | `ai-prd/references/collab/team.md` 里引用贯穿门数量的表述 MUST 同步（该文件不在计数词机器闸的遍历范围内，漏改不报错）。 |
| FR-016 | `ai-dev-system/VERSION` bump 到 `2.11.0`；本次升级零手动动作（重装即可、不改标记块字段、不要求回填存量文档），MUST NOT 新建迁移指南。 |
| FR-017 | `docs/TODO.md` 中本条待办 MUST 删除；本仓库根 `CLAUDE.md` 的门相关表述与 `docs/index.md` 同步。 |
| FR-018 | 入口字节上限 `ENTRY_MAX_BYTES` 由 8000 上调到 **12000**。判据：UTF-8 下一个汉字占 3 字节，8000 字节仅约 2600 汉字，装不下「路由三步 + 工作区隔离门要点 + 只增不减的加载点清单」这三样必载内容。上调 MUST 同步全部**活引用点**（`test/` 下的断言与 `CLAUDE.md` 的契约条目）；`docs/spec/` 与 `docs/plan/` 下已完成文档里的 8,000 是**历史记账**，MUST NOT 改写。（3.0.0 起 `ENTRY_MAX_BYTES` 与 `test/contract-numbers.mjs` 退役，入口字节上限的唯一定义处是 `test/doc-budgets.json`。） |
| FR-019 | 修掉上调时暴露的既有漏洞：①`test/cards-mandatory.test.mjs` 的入口上限断言 MUST 改为引用 `test/contract-numbers.mjs` 的 `ENTRY_MAX_BYTES`，MUST NOT 继续硬编码；②`test/contract-sync.test.mjs` 的 `CONTRACTS` MUST 为 `ENTRY_MAX_BYTES` 补上引用点清单，使文档侧的引用被盯住。（3.0.0 起 `test/contract-numbers.mjs` 与 `test/contract-sync.test.mjs` 退役，由 `test/doc-budgets.test.mjs` 接替。） |
| FR-020 | §8.1 第 4 条拍板的**存量豁免** MUST 有落点：`references/core/代码评审纪律.md` 的 §评审轴 D 轴职责段与 §子代理 prompt 模板 文档轴职责段 MUST 各写一条——遇到缺「过稿记录」节的存量 spec MUST 跳过、MUST NOT 报成缺陷，带到期日 2027-02-28；**豁免只针对「这一节压根不存在」**，有该节却为空或与实际过门情况不符的照常报。 |

**编号规则（MUST）**：格式为 `FR-###` / `AC-###`，三位零填充；**永不复用、永不重排**；删除的需求原地保留编号并改写成"**已撤销** —— 原因"。`FR-###` / `AC-###` 与 §6 的 `Invariant N:` 是两套各自独立的编号。

## 2. 数据模型 / 数据结构

不适用：本次改动的产物全是 markdown 判据与模板文本，没有运行期数据结构。唯一近似"结构"的是 eng-spec 与 lean-change-spec 的章节集合，其变更在 §3 声明。

## 3. 接口契约

本次的"接口"是**被别的文件引用的锚点**，逐条如下。改这些锚点等于改契约，引用方 MUST 同步。

| 锚点 | 位置 | 谁引用它 |
|---|---|---|
| `00-流程总纲.md` §五道门 | 贯穿门总表（计数词权威定义处）| `路径-lean.md` §1.3、`SKILL.md`、`collab/*.md`、`test/counter-word.test.mjs`、`test/gate-sync.test.mjs` |
| `00-流程总纲.md` §spec 过稿门 | 本门判据的唯一权威定义处 | `步骤-1-7-设计与实现.md` Step 5 末、`SKILL.md` 加载点清单、`路径-lean.md` §6.3 |
| `路径-lean.md` §6.3 | Lean 侧本门要点（自足册投影）| `SKILL.md` 加载点清单的 `(L§6.3)` 标注 |
| eng-spec 模板 §13 过稿记录 | 完整流程的留痕落点 | `00-流程总纲.md` §spec 过稿门、代码评审门文档轴 |
| lean-change-spec 模板「过稿记录」行 | Lean 的留痕落点 | `路径-lean.md` §6.3 |

**新增小节的命名（MUST）**：本门在总纲与自足册里的小节名 MUST 逐字为 `spec 过稿门`（`§spec 过稿门` / `§6.3 spec 过稿门`）。它是 `test/gate-sync.test.mjs` 与加载点清单的匹配锚点，改名要同改两处。

## 4. 核心逻辑 / 流程

本门在一次完整流程里的执行顺序（MUST 照此序，MUST NOT 与兼容取舍确认门合并成一次问询）：

1. 兼容取舍确认门走完、结论已落进 spec §8.1。
2. 按 FR-002 圈定业务可判定部分，用业务语言把它摆给拍板人（solo → 用户本人；team → 业务方），明确请他提修改意见。
3. 收到意见 → 逐条落稿或明确回"不改 + 一句话理由"（FR-003）→ 按 §0 决策表判是否需要回兼容取舍确认门（FR-007）→ 回本门再请一次。
4. 按 FR-004 三条判据判定是否定稿。
5. 定稿或用户显式跳过 → 按 FR-006 写过稿记录 → 进 Step 6。

**与相邻两道门的参照物划分（MUST NOT 互相顶替）**：

| 门 | 参照物 | 时点 |
|---|---|---|
| 大架构确认门 | 本次改动有没有改变主干路**形状** | Step 4 之前（spec 还没写）|
| 兼容取舍确认门 | 被改变的**既有可观察行为**要不要兼容 | spec 定稿前 |
| **spec 过稿门** | **整份 spec 描述的事是不是用户要的** | spec 定稿后、Step 6 前 |

三者时点不同、参照物不同：大架构门确认过 MUST NOT 被读成"用户读过 spec 了"（那时 spec 还不存在）；兼容取舍逐条拍过 MUST NOT 被读成"整份 spec 已被认可"（那道门只覆盖被改变的既有行为，全新能力一条都不在清单里）。

## 5. 错误处理 / 降级 / 失败模型

| 失败情形 | 处置（MUST）|
|---|---|
| 用户没有回复 | 一句话告知后停等，MUST NOT 反复追问、MUST NOT 自行判定为定稿（FR-004 判据③）|
| 用户回复含糊（"差不多吧"）| 按判据②处理：就含糊的那几项再问一次，MUST NOT 读成整体认可 |
| 用户提的意见互相矛盾 | 把矛盾用业务语言摆回去请他选，MUST NOT 自行择一落稿 |
| 用户要求的改动会推翻已拍板的兼容取舍 | 按 FR-007 回兼容取舍确认门重过，MUST NOT 直接改 §8.1 结论 |
| 用户在本门要求确认技术选型 | MAY 解释，但结论仍由 AI 自主决定（`用户沟通纪律.md` §3），MUST NOT 把技术选项做成待选项让他挑 |

**没有降级路径**：本门不因 harness 能力、协作面、项目大小而跳过。唯一出口是 FR-005 的用户显式表态。

## 6. 安全 / 鉴权 / 配置 / 不变量

安全与鉴权不适用（无运行期系统）。配置面：本门**不引入任何配置项**（FR-005）。

- `Invariant 1:` 贯穿门总表的行数、小节标题里的计数词、`test/counter-word.test.mjs` 受检词表中 `四道门`/`五道门` 的取值，三者永远一致。
- `Invariant 2:` 每道贯穿门在总纲总表、`路径-lean.md` §1.3、入口 `SKILL.md` 三处都在场。
- `Invariant 3:` 入口 `SKILL.md` 的字节数 ≤ `ENTRY_MAX_BYTES`，且其中 MUST / MUST NOT / SHOULD / MAY 条数不低于改动前。该上限的取值只在 `test/contract-numbers.mjs` 定义一次，断言与文档一律引用它。
- `Invariant 4:` 允许因等用户而挂起的点，在 `collab/solo.md` 与注入片段 `collab-solo.md` 里列出的集合完全一致。
- `Invariant 5:` eng-spec 模板的章节集合与 `00-流程总纲.md` §spec 过稿门 声明的留痕落点一致（§13 存在且名为「过稿记录」）。

## 7. 可观测性

不适用：无运行期系统。可核对性由 §6 的机器闸（FR-013）与代码评审门的文档轴承担。

## 8. 兼容性 / 迁移

### 8.1 兼容取舍决策（用户拍板，MUST）

本次改动会改变的既有可观察行为，逐条如下。**拍板人：开发者本人（协作面 solo）**，已于 2026-08-27 逐条拍板。

| # | 被改变的既有行为 | 谁受影响 | 拍板结论 | 到期日 / 到期动作 |
|---|---|---|---|---|
| 1 | 完整流程从"spec 定稿后直接进 Step 6"变为"多一次用户表态" | 所有装了本体系、走完整流程的项目 | **不兼容**（直接切到新行为，不保留旧路径）| — |
| 2 | Lean 第 4 步的问询批次从"兼容取舍 + 大架构"变为再加一项整页 spec 过目 | 同上，走 Lean 的每次改动 | **不兼容** | — |
| 3 | 贯穿门数量的对外表述由"四道"变为"五道" | 读到这些文档的人与 agent；已装旧版本的项目在重装前仍读到"四道" | **不兼容**（旧表述当场全量改写，不并存）| — |
| 4 | eng-spec / lean-change-spec 模板新增留痕节 | 按旧模板产出的存量 spec 没有该节 | **兼容一段时间**：存量文档不回填，评审门文档轴遇到缺该节的存量 spec 时 MUST 跳过而不报缺陷 | 到期日 2027-02-28；到期动作：删除该跳过规则，届时存量 spec 应已随各自迭代自然带上该节 |
| 5 | 入口字节上限由 8000 变为 12000 | 无人受影响：约束是**放宽**，此前合法的入口仍然合法 | **不适用兼容取舍**（不改变任何既有可观察行为，只放宽一个上界）| — |
| 6 | 版本号由 2.10.0 让给并行合入的原型取段特性，本次取 2.11.0 | 无人受影响：本分支尚未合并，2.10.0 未曾以本特性的名义发布过 | **不适用兼容取舍** | — |

拍板依据：本体系的分发方式是"重装即可"，旧版本 skill 与新版本文档不共存于同一个目标项目，因此除模板存量文档外**没有需要并存的旧行为**。

### 8.2 替换清单（Replacement Ledger，MUST）

| # | 被取代物 | 位置 | 本次动作 | 核销标记 |
|---|---|---|---|---|
| 1 | 小节标题 `## 四道门（贯穿两条路径，Lean 一道也不豁免）` | `references/core/00-流程总纲.md:22` | 改写为五道门 | ✅ 实测引用数 0 |
| 2 | 小节标题 `### 1.3 门的全景：四道贯穿门 + 三道条件门` | `references/core/路径-lean.md:88` | 改写为五道 | ✅ 实测引用数 0 |
| 3 | 表述「四道门一道不少」「四道门一道也不豁免」 | `references/core/00-流程总纲.md:52`、`references/core/路径-lean.md:7,90,106` | 逐处改写 | ✅ 实测引用数 0 |
| 4 | 计数词受检词表条目 `四道门` | `test/counter-word.test.mjs:51-53` | `word` / `variants` 改为 `五道门`，注释同步 | ✅ 实测引用数 0 |
| 5 | 表述「`ai-dev-workflow` 的四道门之二」 | `ai-prd/references/collab/team.md:23` | 改写为指名引用兼容取舍确认门 | ✅ 实测引用数 0 |
| 6 | 交叉引用「见 `路径-lean.md` 第 5 步」 | `references/core/00-流程总纲.md:39`、`references/core/用户沟通纪律.md:45` | 改为「第 4 步」（FR-014）| ✅ 实测引用数 0 |
| 7 | `docs/TODO.md` 中「spec 定稿后缺一道一般性 review 环节」一条 | `docs/TODO.md` §想做的功能 | 删除（本次做掉）| ✅ 实测引用数 0 |
| 8 | `export const ENTRY_MAX_BYTES = 8000` 及其「MUST NOT 上调」注释 | `test/contract-numbers.mjs:23` | 改为 12000，注释改写为「上调 MUST 由用户拍板并同步全部活引用点，MUST NOT 为了让某次改动过闸而顺手上调」| ✅ 实测引用数 0 |
| 9 | `cards-mandatory.test.mjs` 里硬编码的两处 `8000` | `test/cards-mandatory.test.mjs:148-149` | 改为引用 `ENTRY_MAX_BYTES` | ✅ 实测引用数 0 |
| 10 | `docs/TODO.md` 中「入口 SKILL.md 已到 7980 字节、逼近 8000 字节上限」一条 | `docs/TODO.md` §技术欠账 | 删除（上限上调后该紧迫状态不复存在）| ✅ 实测引用数 0 |

**保留例外**：§8.1 第 4 条的"存量 spec 缺 §13 时文档轴跳过"，到期日 2027-02-28，与 §8.1 同一个日期。

### 8.3 数据迁移 / 灰度

不适用：无数据、无灰度通道。分发靠重装，`VERSION` bump 到 2.11.0（FR-016）。

## 9. 【含 AI 时】AI 契约补充

不适用：本次改动不引入模型推理参与的功能行为。（本体系的产物由 AI 执行，但那是本体系的**读者**，不是本次要落地的运行期 AI 能力。）

## 10.（有状态时）状态机

不适用：本门只有"未过 / 已过（定稿）/ 已过（用户显式跳过）/ 挂起等待"四个瞬时态，已由 §0 决策表穷举，无需独立状态机。

## 11. 完成定义（Definition of Done）

| 编号 | 验收项 | 覆盖 |
|---|---|---|
| AC-001 | `00-流程总纲.md` 有 §spec 过稿门 小节，且贯穿门总表含该门一行、触发时机写明"spec 定稿后、Step 6 前" | FR-001 |
| AC-002 | 该小节写明参照物限定为业务可判定部分，并逐条列出 MUST NOT 请用户确认的技术章节 | FR-002 |
| AC-003 | 该小节含"逐条落稿或明确回不改 + 一句话理由"的 MUST，以及三条定稿判据 | FR-003, FR-004 |
| AC-004 | 该小节含跳过口径三条 MUST NOT（不主动提议、不自行跳过、不固化为默认）| FR-005 |
| AC-005 | eng-spec 模板有 §13 过稿记录；lean-change-spec 模板有过稿记录行；两处都写明三选一结论 | FR-006 |
| AC-006 | 该小节含"改动触碰 §1.1 / §11 / §8.1 时回兼容取舍确认门"的 MUST | FR-007 |
| AC-007 | `路径-lean.md` 有 §6.3 spec 过稿门，且 §1.3 门全景含该门；Lean 步骤号仍是 1–10，没有新增 | FR-008 |
| AC-008 | `node --test test/counter-word.test.mjs` 全绿，且受检词表里是 `五道门`；`grep -rn "四道门" ai-dev-system/skills/` 零命中。**范围 MUST 限定在 skill 判据文件**——`ai-dev-system/migrations/` 下的历史指南、`test/` 与 `CLAUDE.md` 里说明新旧两值的病史注释都 MUST NOT 改写，把它们算进来会得到一个不可能满足的验收项 | FR-009, FR-015 |
| AC-009 | `用户沟通纪律.md` §3 与 §发送前检查 各有一条本门的边界说明，明确它不是 §3 的例外 | FR-010 |
| AC-010 | `collab/solo.md` 的挂起例外清单含本门；`collab/team.md` 写明拍板人是业务方且只摆业务可判定项；`base.md` 与 `collab-solo.md` 同步 | FR-011 |
| AC-011 | `SKILL.md` 加载点清单含指向 §spec 过稿门 的一行；`node --test test/cards-mandatory.test.mjs` 全绿（入口字节数由它按 `ENTRY_MAX_BYTES` 判，**本表 MUST NOT 再抄一个上限数字**）；`node --test test/wording-redline.test.mjs` 全绿 | FR-012 |
| AC-012 | `node --test test/gate-sync.test.mjs` 存在且全绿；把任一贯穿门从 `路径-lean.md` §1.3 删掉后它判红 | FR-013 |
| AC-013 | `grep -rn "路径-lean.md\` 第 5 步" ai-dev-system/skills/` 零命中。**范围同 AC-008 限定在 skill 判据文件**：本 spec 的 FR-014 与替换清单、coding plan 的步骤、代码事实卡片的陷阱项都要描述这次修正本身，写成"全仓零命中"是一个自相矛盾、永远判不过的验收项 | FR-014 |
| AC-014 | `ai-dev-system/VERSION` 为 `2.11.0`，且 `ai-dev-system/migrations/2.11.0.md` **不存在** | FR-016 |
| AC-015 | `docs/TODO.md` 不再含本条待办；`docs/index.md` 收录本 spec；本仓库根 `CLAUDE.md` 的门相关表述已同步 | FR-017 |
| AC-017 | `test/contract-numbers.mjs` 的 `ENTRY_MAX_BYTES` 为 12000；`CLAUDE.md` 里三处入口上限表述同步为 12,000；`docs/spec/` 与 `docs/plan/` 下的历史 8,000 一字未改 | FR-018 |
| AC-018 | `test/cards-mandatory.test.mjs` 不再出现字面量 8000，改为 import `ENTRY_MAX_BYTES`；把该常量临时改成一个小于入口实际字节数的值，该测试判红 | FR-019 |
| AC-019 | `test/contract-sync.test.mjs` 的 `CONTRACTS` 含 `ENTRY_MAX_BYTES` 条目且 refs 非空；把 `CLAUDE.md` 里任一处上限数字改错，该测试判红 | FR-019 |
| AC-020 | `代码评审纪律.md` 的 D 轴职责段与 prompt 模板文档轴段各含一条存量豁免，都写明到期日 2027-02-28 与「只针对这一节压根不存在」的边界；`node --test test/doc-axis.test.mjs` 全绿 | FR-020 |
| AC-016 | `node --test test/*.test.mjs` 全绿 | 全部 |

## 12. 待澄清点

无。三个设计决策（触发方式 / 与兼容取舍门的先后 / Lean 是否豁免）已于 2026-08-27 由开发者本人拍板，结论落在 §0 决策表与 FR-001 / FR-005 / FR-008。

## 13. 过稿记录（MUST）

> 本节由 `00-流程总纲.md` §spec 过稿门 要求，MUST 在过门后当场填写；三选一：定稿 / 用户显式跳过本次 / 提了意见及落稿情况。

- 2026-08-27 ｜ **已定稿**。过程：兼容取舍确认门逐条拍板后过本门；用户在本门提出一条意见——入口字节上限 8000 过严（UTF-8 下汉字占 3 字节，8000 仅约 2600 汉字）——已落稿为 FR-018 与 FR-019（顺带修掉 `cards-mandatory` 硬编码与 `contract-sync` 漏盯两个既有漏洞），FR-012 相应改写，§8.2 替换清单增 3 行、§11 增 3 条 AC。改动未触碰已拍板的兼容取舍结论，未回上一道门。二次呈现后用户回复"同意"，按判据①（整体认可）定稿。
