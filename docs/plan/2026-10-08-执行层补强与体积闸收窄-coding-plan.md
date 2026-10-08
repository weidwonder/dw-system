---
lifecycle: active
superseded_by: ''
archived: ''
last_confirmed: '2026-10-08'
authority_refs:
  - 'test/doc-budgets-lib.mjs#checkBudgets 的未知键判定'
---

# 执行层补强与体积闸收窄 Coding Plan

**Goal:** 落地 `docs/spec/2026-10-08-dw-system-执行层补强与体积闸收窄-eng-spec.md` 的 FR-001 至 FR-010。
**Architecture:** 体积闸删 `totals` 分支、加未知顶层键判红；其余九条各在它的家里补一两句，别处不复述。
**Tech Stack:** Node.js ESM（`node --test`），markdown。
**Worktree:** `<仓库根>/.worktrees/absorb-agentkit`
**Task Branch:** `feat/absorb-agentkit`
**目标主分支:** `main`

---

### Task 1：体积闸只管单篇

**Slice:** 清单去掉 `totals` 后闸照常判；清单出现未知键时判红。 ｜ **依赖：** 无
**满足:** FR-001

**Files:**
- Modify: `test/doc-budgets-lib.mjs`（删 `totals` 循环与注释里的"合计例外"；加未知键判红）
- Modify: `test/doc-budgets.test.mjs`（删 `totalRule` 两条断言，加未知键的反向自检）
- Modify: `test/doc-budgets.json`（删 `totals`）
- Modify: `test/AGENTS.md`（`doc-budgets.test.mjs` 一行删"按 skill 合计"，补"未知键判红"）

- [ ] Step 1: 测试里加自检：清单含 `totals` → `failures` 有一条匹配 `/未知键：totals/`；只含合法键 → 不出现该条。
- [ ] Step 2: 跑 `node --test test/doc-budgets.test.mjs`，Expected: 新自检 FAIL（lib 还认 `totals`）。
- [ ] Step 3: 改 lib：顶层键闭集 `files / classes / lines / blockExcluded`，其余键各记一条失败；删 `totals` 循环。删清单里的 `totals`。
- [ ] Step 4: 跑同一命令，Expected: PASS，输出无"合计"行。
- [ ] Step 5: commit。

### Task 2：评审门两处

**满足:** FR-002、FR-007
**Files:** `dw-system/skills/dw-review-gate/references/评审轴.md`（B 行）、`子代理模板.md`（忠实轴职责）、`评审处置.md`（处置节）

- [ ] B 行"只看什么"补实现逻辑与被波及调用方；"典型命中"补一例。
- [ ] 子代理模板忠实轴补同一要求，写明偏离类型的归类：逻辑错归 `做一半` / `做反了`，未登记进兼容取舍表的既有行为变化归 `越界`；闭集不变。
- [ ] 评审处置加一条：意见要改已拍板事项时回对应确认门。
- [ ] commit。

### Task 3：dw-workflow 四处

**满足:** FR-003、FR-004、FR-008、FR-009、FR-010
**Files:** `references/实现纪律.md`、`references/上下文卫生.md`、`references/环境冲突扫描.md`、`references/测试资产纪律.md`、`assets/templates/eng-spec.md`

- [ ] 实现纪律：通用列表加"不得削弱测试"；新增 §委派执行。
- [ ] 上下文卫生 §2 规则 2：补两项内容、新触发、新会话核对。
- [ ] 环境冲突扫描 §扫描范围：补用户级位置与"不随分支提交"。
- [ ] 测试资产纪律 §敏感信息：补凭证值不外露。
- [ ] eng-spec 模板 §4：补备选方案一条。
- [ ] commit。

### Task 4：诊断与合并收尾

**满足:** FR-005、FR-006
**Files:** `dw-system/skills/dw-bug-diagnosis/references/bug诊断纪律.md`（Phase 2）、`dw-system/skills/dw-worktree/references/worktree开发纪律.md`（完成门收尾段）

- [ ] Phase 2 加第 6 条 bisect。
- [ ] 移除 worktree 之前停后台进程。
- [ ] commit。

### Checkpoint：Task 1–4 之后

- [ ] `node --test test/*.test.mjs` 全绿（含 single-home、cross-reference、counter-word、doc-budgets）。
- [ ] CHANGELOG `## 未发布` 写好；决策记录 0009；`docs/TODO.md` 删两条合计条目的对应部分；卡片刷确认日期。
- [ ] 进代码评审门。
