---
name: dw-workflow
description: "AI 辅助开发主流程：从已有 PRD 起步做需求落地、分流（Triage）、Overview、技术 spec、coding plan、测试方案、测试资产，或提到'开发流程 / 用 AI 把需求做成代码 / 走一下流程'时用；兼容取舍拍板、spec 过稿、改 skill / 技能文档、首次初始化项目、扫描 rules/skills/agents 冲突时同样用。它定两条总纲与步骤顺序，每道门的判据在各自的 skill：评审用 dw-review-gate，建 worktree 与合并用 dw-worktree，查代码事实用 dw-code-facts，修 bug 用 dw-bug-diagnosis，文档去留用 dw-doc-governance，文字怎么写用 dw-prose。从零产 PRD 用 dw-prd。"
---

# dw-workflow：总纲、路由与步骤顺序

本 skill 管**两条总纲、路由与初始化、Triage 分流、两条路径的步骤顺序、两道确认门、用户沟通、spec 写作、上下文卫生、测试阶段、AI 运行期契约**。每道门的判据住在它自己的 skill（见〈到哪一步用哪个 skill〉），本 skill 只定顺序。按 RFC 2119 解释规范词。

## 两条总纲

dw 体系的每个 skill、注入目标项目的标记块、以及按本体系产出的文档与卡片，都受这两条约束。**这两条的展开只在本节**；别处只点名并指到这里。

**一、一个事实只有一个家，别处只放链接。** 写任何规则、数字、清单之前，先按〈归属表〉找到它的家。家以外的地方写「名字 + 指针」；读者在那个位置非知道不可的关键一句 MAY 就地重复，但展开、例子、例外只在家里。同一事实两处展开必然写岔，读者无从判断信哪份。

**二、规范文本有体积上限，超限按固定顺序处置。** ① **搬走**：不属于这里的内容搬回它的家，留一行指针；② **压缩**：属于这里但能更短的，按 `dw-prose` 的完整命题规则压缩——每条命题（谁、做什么、什么条件、模态、反向保证、失败后果）都 MUST 留住；③ **抬上限**：内容确实需要这么多空间，才抬，MUST 经拍板人同意并写一句理由。MUST NOT 跳过 ① ② 直接抬上限，MUST NOT 为了过上限丢命题。上限是护栏，不是削减指标。

**理由留下，来历搬走**：省略后会导致误用的理由留在规则旁，用现在时写；哪一版改的、出过什么事、试过哪些方案，进决策记录（`dw-doc-governance` 的 `文档治理.md` §决策记录）。

## 归属表

| 事实类别 | 它的家 | 这里不该放什么 |
|---|---|---|
| 两条总纲、步骤顺序、Triage 与默认倾向、不裁剪护栏 | 本入口、`references/00-流程总纲.md` | 任何一道门的判据 |
| 兼容取舍确认门、spec 过稿门 | `references/确认门.md` | — |
| 大架构判据、与用户说话的口径 | `references/用户沟通纪律.md` | — |
| 入口文件的标记块与顶部提示块：字段、取值、缺省与落点 | `references/init-初始化.md` | — |
| 工作区隔离门、完成与自动合并门、`merge-gate` 的推导 | `dw-worktree` | 评审范围与积压 |
| 对象面、评审轴、档位、积压通路、子代理模板、替换清单 | `dw-review-gate` | 文档去留的判据 |
| 输出目录、三层真相源、生命周期、**权威面清单**、归档、TODO 出口、决策记录、命名 | `dw-doc-governance` | 散文怎么写 |
| 卡片形态、cite、`ctx` 调用、补卡与刷卡、变更日志、依赖声明、代码图谱 | `dw-code-facts` | — |
| 查重、红回路、可证伪假设、防回归 | `dw-bug-diagnosis` | — |
| 一段文字该写什么、该删什么 | `dw-prose` | 文档放哪、何时归档 |
| 从零产 PRD、UI 原型与批注 | `dw-prd` | 已有 PRD 之后的事 |
| 体积上限的数值 | 本体系仓库的 `test/doc-budgets.json` | — |

目标项目自己的产物（需求真相源、索引、spec、卡片）各放什么、不放什么，见 `dw-doc-governance` 的 `文档治理.md` §归属表。

## 路由（每次唤起先做；只读、只对话，MUST NOT 落盘）

1. **探测代码图谱**：项目根下 `.codegraph/codegraph.db` 存在（路径按项目根解释，MUST NOT 按 cwd）→ 记下，要做结构检索时读 `dw-code-facts` 的 `graph.md`。探测不到或失败按没有算，MUST NOT 阻断流程、MUST NOT 反复重试、MUST NOT 改问用户。本步 MUST NOT 探测 `engineering-context/`：缺骨架在隔离门内补建，缺条目按 `dw-code-facts` 补齐。
2. **读标记块**：项目根 `CLAUDE.md` 与 `AGENTS.md` **两个入口都读**（以 `CLAUDE.md` 为准），取 `<!-- dw-workflow:start/end -->` 内的 `collaboration` / `merge-gate` / `worktree-dir`。

   | 读到什么 | 怎么办 |
   |---|---|
   | 有 `collaboration` | 直接用；另一入口缺块或不一致 → 按 `references/init-初始化.md` §幂等规则 补齐，MUST 说一句被覆盖的是什么 |
   | 只有旧名字的块 `<!-- ai-dev-workflow:start -->` | 项目装的是 3.0 之前的版本。MUST 停下，请用户在项目根重跑安装命令（安装器自动迁移字段并清理旧残留），MUST NOT 手工改写标记块，MUST NOT 按旧块继续 |
   | 两个入口都无块 | 初始化：读 `references/init-初始化.md`，先跑 `references/环境冲突扫描.md`。MUST NOT 问"要不要建 engineering-context" |
   | 有块但读不到 `collaboration`（被截断、误删） | 按 `references/init-初始化.md` §幂等规则 当块损坏重建，字段按初始化的提问重新确认 |
   | `collaboration` 不是 `solo` / `team` | 报错中止并列出合法值，MUST NOT 猜 |
   | 用户要"扫描 / 体检 dw 体系" | 跑 `references/环境冲突扫描.md`，冲突逐项交用户决断 |

3. **过工作区隔离门**（`dw-worktree`）→ 读 `references/00-流程总纲.md` §Step 0 过 Triage → 按下表取该分支要的文件。

## 读取条件（到点才读、只读那一节；MUST NOT 预读，MUST NOT 凭记忆代替）

触发条件到了 MUST 读；MUST NOT 自行判定某一行"这次用不上"而整篇跳过——那是裁剪（`references/00-流程总纲.md` §"不裁剪"护栏）。

| 什么时候 | 读什么 |
|---|---|
| 每次唤起，分流前 | 本入口 + `references/用户沟通纪律.md` + `references/00-流程总纲.md` §Step 0（含其下的 §默认倾向）|
| Triage 的判定问题全否 | `references/路径-lean.md` + `references/collab/` 里协作面那一份 + `references/00-流程总纲.md` §"不裁剪"护栏 + `references/上下文卫生.md`（后两份是前置读：裁剪与过载都是发生了才想起来读就晚了）|
| Triage 任一为是，或 §默认倾向 判升级 | `references/00-流程总纲.md` 其余各节 + `references/上下文卫生.md` + `references/collab/` 那一份 + `references/步骤-1-7-设计与实现.md` |
| 本次改动不含可执行代码文件 | `references/纯skill改动.md` |
| 动笔写 spec；出现过载信号要写交接文档 | `references/spec写作纪律.md` |
| spec 定稿前后（兼容取舍确认门、spec 过稿门）| `references/确认门.md` |
| 开始实现 | `references/实现纪律.md` |
| 需求跨 ≥2 个边界、大 PRD 要拆切片、要定 PR 粒度 | `references/00-流程总纲.md` §按边界拆 |
| 进入测试阶段 | `references/步骤-8-10-测试.md` |
| 有真实数据或凭证、要挂覆盖度台账 | `references/测试资产纪律.md` |
| 项目含 AI / LLM 调用 | `references/AI-LLM-overlay.md`；判为 Agentic 应用 MUST 另加载 `agentic-principle` |
| 长会话出现过载信号 | `references/上下文卫生.md` |

## 到哪一步用哪个 skill

| 到了这一步 | 加载 |
|---|---|
| 任何文件落盘前（工作区隔离门）；全部门禁通过要合并（完成与自动合并门）| `dw-worktree` |
| 要知道某能力的权威实现、跨服务影响面；要补卡、刷卡；要写变更日志条目；要升级上游 | `dw-code-facts` |
| 需求是 bug、回归或异常行为（红回路门）| `dw-bug-diagnosis` |
| 写 spec 要登记被取代物；改动落盘后要过代码评审门 | `dw-review-gate` |
| 要给文档定目录与命名、判去留、归档、往需求真相源或 TODO 写东西、立决策记录 | `dw-doc-governance` |
| 要写或精简规范文本、注释、卡片、提示词 | `dw-prose` |
| 需求还没有 PRD，要从零产出 | `dw-prd` |
| 要新建或改动 skill | `skill-principle`（伴生 skill） |

被加载的 skill 未能按名字唤起时，直接读它的文件：与本 skill 同级的 `<skill 名>/SKILL.md`。

`engineering-context/` 必备、没有开关。`ctx` 命令敲不到 MUST NOT 读成"这一层不可用"：按 `dw-code-facts` 入口的兜底调用执行，MUST NOT 裸 grep 找权威实现。
