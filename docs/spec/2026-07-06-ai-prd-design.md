---
date: '2026-07-06'
status: '设计定稿，待实现'
documentRole: 'design-spec'
sourceOfTruth: '../../REQUIREMENTS.md 不适用（本仓库为方法论分发包）'
lifecycle: active
last_confirmed: '2026-08-17'
authority_refs:
  - 'ai-prd 与 ai-dev-workflow 的职责边界：PRD 产出在前，其产物即 workflow Step 1 的输入'
  - 'ai-prd 的目录结构与分册加载方式'
  - '三类 PRD 模板的划分与选用判据：change-prd（主）/ lite-issue-prd / product-prd'
  - '批量提问 elicitation 的批次划分（分流 / A 立项 / B 现状边界 / C 细节 / D 准出 / 组稿）'
  - 'PRD 写作纪律五条（非目标要硬 / 边界显式 / 验收可判定 / 真相方向 / 无占位符）'
  - 'ai-prd 只读项目配置、不写配置这一职责边界'
  - '§7 demo 骨架 → change-prd 模板 的覆盖度映射（改模板前的对照表）'
---

> **现行性说明（2026-08-18）**：设计仍现行。其中「mode 感知（personal/team）」这一维度已在 2.0.0 被拆开；2.1.0 起只剩**协作面**（显式字段，本 skill 只读不写）一项与本 skill 有关，代码事实层改为无条件必备、不再分档（`2026-08-18-代码事实层强制化-eng-spec.md`）。相关小节已按新模型更新。

# ai-prd skill 设计文档

> 目标：新增一个 skill `ai-prd`，用**批量提问 + 阶段化 elicitation** 协助产出结构完备、非目标够硬、验收可判定的 PRD，形状对齐 `orgin/prd.demo/` 下的 brownfield 变更 PRD 范例（本地参考，不入库）。补齐 `ai-dev-workflow` 从"已有 PRD"起步、缺"产 PRD"前置的空缺。

## 1. 动机与定位

`ai-dev-workflow` 的 Step 1「PRD 粗澄清」的 prompt 是 `参考 PRD @【PRD 文件】`——它**假设 PRD 已存在**，全流程没有一步负责从零产出 PRD。`ai-prd` 补这个前置：产物作为 `ai-dev-workflow` Step 1 的输入，两者松耦合。

north-star 参考物是 `orgin/prd.demo/` 下的变更 PRD 范例（本地参考，不入库）——一份 brownfield **变更/功能 PRD**（非整品 PRD），它的价值在一套可复用的骨架 + 纪律。

## 2. 已定决策

| # | 决策 | 取值 | 理由 |
|---|---|---|---|
| 1 | PRD 类型 | 变更/功能 PRD 为主，可裁剪到轻量 Issue、可放大到整品 | demo 是北极星；覆盖谱系而不强制单选 |
| 2 | 交互模型 | **批量提问**：一次抛一批，有疑问再批量追问，否则直进下一步 | 用户明确纠正：少轮次，非一问一答（见 memory: batch-questioning-preference） |
| 3 | 衔接 | 独立 skill，产物衔接 `ai-dev-workflow` Step 1 | 用户要"新建 skill"；松耦合 |
| 4 | 项目形态感知 | 读同一个标记块的**协作面**字段选分册；写"现状"时 `ctx` 可用就用它拉真实代码事实并附 cite | 与仓库整体哲学一致；demo 的"现状/不改的线上逻辑"正需要可信代码事实。（2.0.0 起：不再有 personal/team 二分；现状取证**不看协作面**，只看 `ctx` 是否可用）|

## 3. 目录结构（沿用 ai-dev-workflow 约定）

```
ai-dev-system/skills/ai-prd/
  SKILL.md                     入口：读协作面 → PRD 类型分流 → 批量 elicitation 驱动
  references/
    00-prd生成流程.md           核心：4 批提问 + 组稿的阶段流程
    prd写作纪律.md              非目标要硬 / 边界要显式 / 验收可判定 / 真相方向 / 无占位符
    业务语言纪律.md             对话、提问与成稿只用业务语言
    UI原型纪律.md               UI 变更时参考现有样式并产出独立 HTML 高保真交互原型
    prd质量清单.md              成稿自检 gate（对照 demo 骨架查完备性）
    collab/solo.md             无其他人类协作方：你自己拍板，开放问题成稿前自己逐条闭环
    collab/team.md             有其他人类协作方：业务方拍业务口径与非目标，评审结论回写 PRD
  assets/
    templates/
      change-prd.md            ★变更/功能 PRD（demo 骨架抽象化，主模板）
      lite-issue-prd.md        轻量 Issue PRD（裁剪版）
      product-prd.md           整品 PRD（对齐 doc-governance REQUIREMENTS.md）
    question-bank.md           分章节提问库（供 elicitation 组批）
```

## 4. 核心流程：批量提问 + 4 批 elicitation

每批一次性抛出该批全部问题；用户答完后 AI 起草对应章节；**只有对回复有疑问或有缺口时才再批量追问**，否则直接进下一批。

| 批 | 覆盖 PRD 节 | 关键动作 |
|---|---|---|
| 0 分流（自动，尽量不打扰） | 选模板 | 判体量/类型：轻量 Issue / 变更功能 / 整品（参考 Triage）。能从已有材料判定则不问。 |
| A 立项 | 一句话结论、背景、目标、**非目标** | 逼出"这次做什么/为什么现在做/明确不做什么"。非目标是硬产出。 |
| B 现状&边界 | 现状/当前逻辑、改动范围、**不改的线上逻辑** | `ctx` 可用（项目有已填写的能力登记表）则先 `ctx discover`/`get-card` 预填现状带 cite，再让用户确认/纠偏；不可用则口述 + 读代码核实并显式标注来源。取证方式**不看协作面**。 |
| C 细节 | 详细行为/字段/规则、**边界 case & 冲突** | 逐条 elicit，鼓励表格化；主动穷举冲突场景。 |
| D 准出 | 验收标准、埋点&看板、风险&兜底 | 验收三分（字段/行为/场景）可判定；埋点带公式；每条风险配兜底。 |
| 组稿 | 最终 PRD | 按模板拼装 → 跑质量清单 → 写 `docs/spec/` → 项目已有 `docs/index.md` 就更新它（没有则不为此临时造一个）→ 提示可接 ai-dev-workflow。 |

轻量 Issue 走批 A + 精简验收即可；整品 PRD 在批 A 增加 User Journeys/Success Criteria 提问。

## 5. PRD 写作纪律（与"普通 AI 写 PRD"拉开差距）

1. **非目标必须硬**：无非目标不准成稿。每个目标尽量配一条"不做什么"。
2. **边界必须显式**：brownfield 必须有"不改的线上逻辑"章节。
3. **验收可判定**：禁止"提升体验"等不可勾验表述；用 RFC2119；验收项能被测试/评审直接勾验。
4. **真相方向**：现状以**代码为准**（`ctx` 可用时带 cite），意图/愿景归意图，**不得把意图写成现状**。直接呼应 `ai-dev-workflow/references/core/engineering-context设计.md §3`。
5. **无占位符成稿**：交付前 `【】` 清零（复用 `spec写作纪律` 精神）。

## 6. 路由（与 ai-dev-workflow 一致、不打架）

读同一个 `<!-- ai-dev-workflow:start --> … collaboration="solo|team" … <!-- ai-dev-workflow:end -->` 标记块，**只取协作面**。没有标记块、或块里只有旧版安装留下的 `mode` 字段 → 一律按 `collaboration="solo"` 走，**不问用户、不写文件、不提示迁移**：写配置与旧值迁移是 `ai-dev-workflow` 的职责，本 skill 不写文件就保证不了"只提示一次"，抢过来只会变成每次唤起都打扰。代码事实层是必备资产、不分档，本 skill 也不探测它——它只需要按 `ctx` 查得到就带 cite、查不到就现读源码并在 PRD 里标出来交下游补卡。

## 7. demo 骨架 → change-prd 模板 覆盖度映射（交付验证）

`change-prd.md` 模板必须无遗漏覆盖 demo 的每一节：

| demo 节 | change-prd 模板节 |
|---|---|
| 1 一句话结论 | ## 一句话结论 |
| 2 背景 | ## 背景 |
| 3 目标与非目标 | ## 目标 / ## 非目标 |
| 4 当前逻辑/现状 | ## 现状与当前逻辑 |
| 4.x 本次改动范围 / 不改的线上逻辑 | ## 改动范围 / ## 不改的线上逻辑（边界） |
| 5-7 动作分类/字段/规则条目 | ## 详细行为与字段要求 |
| 8/9.3 流程图 | ## 流程图（mermaid） |
| 9 词级调度规则 | ## 核心规则（表格化） |
| 11 冲突与边界 case | ## 边界 case 与冲突 |
| 12 验收标准（字段/调度/场景） | ## 验收标准（字段 / 行为 / 场景） |
| 13 埋点与效果看板 | ## 埋点与看板 |
| 14 风险与兜底 | ## 风险与兜底 |
| 15 改动说明 | ## 改动说明（changelog） |

> demo 骨架之外的增补节（v1.4.0 起）：`## UI 原型（如适用）`——demo 无对应节，是本体系自增的交付项。三类模板共用同一套五项（原型文件 / 覆盖路径 / 样式依据 / 关键状态 / 不在用户界面内展示），权威定义在 `references/UI原型纪律.md` §5；改任一模板的该节必须三处同改。

## 8. 落地范围

- 纯 markdown skill，**无代码**、无第三方依赖。
- 顺带在 `install.mjs` 复制清单里加入 `ai-prd`（与 ai-dev-workflow 一并装入目标项目）。
- 同步更新根 `README.md` 与 `CLAUDE.md`：交付单元从"唯一 skill"改为"两个 skill（ai-dev-workflow + ai-prd）"。

## 9. 非目标（本 skill 自身）

- 不做 PRD 的自动评审/打分门禁（那是 `ctx probe` 的方向）。
- 不替代产品经理决策；AI 只草拟与追问，权威判断仍归人。
- 不在本轮实现语义检索或与 CI 集成。
