---
lifecycle: merged
archived: '2026-08-10'
---

> **已归档（2026-08-10）｜lifecycle: merged**：融合结论已落进各 skill 的 `references/` 与模板。与现行文档冲突时**以现行为准**，MUST NOT 据本文实施。

# mattpocock/skills（含 grill-me）融合计划

> 日期：2026-07-16 ｜ 分支：`feat/fusion-mattpocock-skills`
> 来源调研：GitHub mattpocock/skills（~174k star，grilling/grill-me、tdd、diagnosing-bugs、code-review、to-tickets、ask-matt、writing-great-skills 等）。
> 决策（用户拍板）：需求澄清/产出吸收其最强项，但**保持"可并行就批量"**——不照搬一次一问；其余按调研报告建议融合。**不动摇本体系护城河**：Engineering Context/cite、Triage 分流、brownfield 变更 PRD、worktree 门禁、业务语言纪律。

## 融合项与落点

### A. ai-prd 提问机制（P0）
| 吸收点 | 改造方式 | 落点 |
|---|---|---|
| 每问附推荐答案（skim & confirm） | 由 question-bank 的弱约定升格为硬纪律，贯穿 4 批提问 | `references/00-prd生成流程.md`、`SKILL.md`、`assets/question-bank.md` |
| 事实/决策分离（事实自己查，只把决策抛给用户） | 与既有"能查的先查（ctx+cite）"合并成显式第一纪律 | 同上 |
| 深度盘问（grilling） | 改造为**依赖分层批量**：同层无依赖问题一批抛全；有依赖的决策链按层推进；仅需求高度模糊时进入小步盘问模式，收敛即回批量 | `references/00-prd生成流程.md` 新增「盘问模式」 |

### B. ai-dev-workflow 新增 core 纪律（P1/P2）
| 吸收点 | 改造方式 | 落点 |
|---|---|---|
| diagnosing-bugs 红回路优先 | 新纪律：无"能变红的复现命令"禁止提假设；3–5 条可证伪假设排序 | 新 `references/core/bug诊断纪律.md`，总纲 Step 0 挂入口 |
| smart zone / handoff / 干净上下文 | 新纪律：澄清→spec→plan 单一连续上下文；逼近上限交接而非硬撑；每个编码任务零上下文起步；重探索交子 agent | 新 `references/core/上下文卫生.md`，总纲 Step 6/7 挂钩 |
| code-review 双轴 | Step 7 收尾自查：规范轴 + spec 忠实度轴，分开跑分开报 | `references/core/00-流程总纲.md` Step 7 |

### C. 模板强化（P1/P2/P3）
| 吸收点 | 落点 |
|---|---|
| TDD 三反模式（实现耦合 / 同义反复 / 水平切片）+ 只在约定 seam 测 | `assets/templates/test-spec.md` 纪律区、`coding-plan.md` 头注 |
| tracer-bullet 垂直切片 + 任务间 blocking 边 | `assets/templates/coding-plan.md` |
| spec/plan 路径分工（spec 引路径只作事实锚定，实现落点归 plan） | `assets/templates/eng-spec.md` 头注 |

### D. 团队版 glossary（P3）
- 新 `assets/context-layer/glossary.md` 模板（纯业务词汇表，禁实现细节；与 card 分工：card 管代码事实，glossary 管领域语言一致性）。
- `ctx init` 骨架增加 `glossary.md`（`src/commands.js` + 测试 + `scripts/ctx/README.md`）。
- `references/company/context-engineering.md` §2 增补说明。

### E. 本仓库自身治理（P3）
- 新 `docs/spec/2026-07-16-skill写作自检清单.md`：吸收 writing-great-skills 元方法论（可预测性、信息层级、渐进披露、leading words、六大失败模式），用于维护本仓库两个 skill 的 markdown"源码"。
- `CLAUDE.md` 「改动时注意」加指针。

## 明确不吸收
- **一次一问的强制串行**：与批量提问哲学冲突，仅保留为盘问模式中"依赖链逐层"的受限形态。
- **spec 禁写文件路径**：与 `spec写作纪律.md` 零上下文原则冲突，改造为"路径分工"而非禁令。
- **skills.sh / plugin 分发**：install.mjs 已覆盖本体系需求（含冲突插件禁用），不重做分发层。
- **CONTEXT.md 替代 card**：glossary 仅作补充位，权威事实仍以 card+cite 为唯一来源。

## 验收
- `scripts/ctx` 下 `node --test` 全绿（含新增 glossary 断言）。
- 各 markdown 交叉引用一致（SKILL.md 目录/篇数、总纲、模板、README）。
- 无占位符遗留；新增纪律遵循 spec 写作纪律。
