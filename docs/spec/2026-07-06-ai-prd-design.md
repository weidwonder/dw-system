---
date: '2026-07-06'
status: '设计定稿，待实现'
documentRole: 'design-spec'
sourceOfTruth: '../../REQUIREMENTS.md 不适用（本仓库为方法论分发包）'
---

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
| 4 | mode 感知 | mode-aware（personal/team）；团队版写"现状"用 `ctx` 拉真实代码事实 | 与仓库整体哲学一致；demo 的"现状/不改的线上逻辑"正需要可信代码事实 |

## 3. 目录结构（沿用 ai-dev-workflow 约定）

```
ai-dev-system/skills/ai-prd/
  SKILL.md                     入口：读 mode → PRD 类型分流 → 批量 elicitation 驱动
  references/
    00-prd生成流程.md           核心：4 批提问 + 组稿的阶段流程
    prd写作纪律.md              非目标要硬 / 边界要显式 / 验收可判定 / 真相方向 / 无占位符
    prd质量清单.md              成稿自检 gate（对照 demo 骨架查完备性）
    mode-personal.md           个人薄外壳（可裁剪到最短）
    mode-team.md               团队外壳（现状接 ctx、评审门、doc 治理落位）
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
| B 现状&边界 | 现状/当前逻辑、改动范围、**不改的线上逻辑** | 团队版先 `ctx discover`/`get-card` 预填现状带 cite，再让用户确认/纠偏；个人版口述+AI 追问。 |
| C 细节 | 详细行为/字段/规则、**边界 case & 冲突** | 逐条 elicit，鼓励表格化；主动穷举冲突场景。 |
| D 准出 | 验收标准、埋点&看板、风险&兜底 | 验收三分（字段/行为/场景）可判定；团队版埋点带公式；每条风险配兜底。 |
| 组稿 | 最终 PRD | 按模板拼装 → 跑质量清单 → 写 `docs/` → 团队版更新 `index.md` → 提示可接 ai-dev-workflow。 |

轻量 Issue 走批 A + 精简验收即可；整品 PRD 在批 A 增加 User Journeys/Success Criteria 提问。

## 5. PRD 写作纪律（与"普通 AI 写 PRD"拉开差距）

1. **非目标必须硬**：无非目标不准成稿。每个目标尽量配一条"不做什么"。
2. **边界必须显式**：brownfield 必须有"不改的线上逻辑"章节。
3. **验收可判定**：禁止"提升体验"等不可勾验表述；用 RFC2119；验收项能被测试/评审直接勾验。
4. **真相方向（团队版）**：现状以**代码为准**（ctx cite），意图/愿景归意图，**不得把意图写成现状**。直接呼应 `references/company/context-engineering.md §3`。
5. **无占位符成稿**：交付前 `【】` 清零（复用 `spec写作纪律` 精神）。

## 6. mode 路由（与 ai-dev-workflow 一致、不打架）

读同一个 `<!-- ai-dev-workflow:start --> … mode="personal|team" … -->` 标记块判 mode。**没有标记则本会话临时问一次**，不写文件（不抢 ai-dev-workflow 的 init 写入权），避免两个 skill 争夺初始化。

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
