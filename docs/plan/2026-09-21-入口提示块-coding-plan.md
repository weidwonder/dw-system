---
lifecycle: active
superseded_by: ''
archived: ''
last_confirmed: '2026-09-21'
authority_refs:
  - 'install.mjs：WORKFLOW_HINT_START / WORKFLOW_HINT_END 与提示块写入点'
  - 'dw-workflow/assets/config-snippets/hint.md：提示块正文'
---

# 入口提示块 Coding Plan

**Goal:** 让目标项目的入口文件顶部带一段"起步先加载 `dw-workflow`"的幂等提示块，由 skill 初始化与安装器两条路径维护。
**Architecture:** 新增一份正文片段 `hint.md` + 一对标记常量 + 一个顶部幂等合块函数；安装器在已经要写 `dw-workflow` 标记块的那次文件改写里，对"写入前就已存在"的入口一并写提示块。
**Tech Stack:** Node.js ESM（≥20），零依赖；`node --test`。
**Worktree:** `/Users/weidwonder/projects/dw-system/.worktrees/entry-hint`
**Task Branch:** `feat/entry-hint`
**目标主分支:** `main`
**Spec:** `docs/spec/2026-09-21-dw-system-入口提示块-eng-spec.md`

---

### Task 1：提示块正文片段与组装

**Slice:** 从片段文件读出正文，组装成带起止标记的块。｜**依赖：** 无
**满足:** FR-001

**Files:**
- Create: `dw-system/skills/dw-workflow/assets/config-snippets/hint.md`
- Modify: `install.mjs`（常量区与 `buildWorkflowBlock` 之后）
- Modify: `test/doc-budgets.json`（给 `hint.md` 登记上限 600）

**Interfaces:**
- Produces: `WORKFLOW_HINT_START` / `WORKFLOW_HINT_END`；`buildWorkflowHintBlock(skillsRoot)` → string | null（片段缺失返回 null）

- [ ] Step 1: 写 `hint.md`，用 `<!-- dw-workflow:hint:start/end -->` 包住一段引用文字，点名 `dw-workflow`，指向文末标记块。正文 MUST NOT 出现 `字段名="值"` 形态（安装器会把它当字段改写）。
- [ ] Step 2: 在 `install.mjs` 常量区（`WORKFLOW_MODE_END` 之后）加两个常量。
- [ ] Step 3: 加 `buildWorkflowHintBlock(skillsRoot)`：读 `hint.md` → `getMarkedBlock` 取内层 → 缺失返回 null。
- [ ] Step 4: `node --test test/doc-budgets.test.mjs` 预期通过。

---

### Task 2：顶部幂等写入 + 安装器落点

**Slice:** 已有标记块的项目跑一次安装 → 已存在的入口文件顶部出现提示块，重跑不重复。｜**依赖：** Task 1
**满足:** FR-002, FR-003, FR-005, FR-006, FR-007, FR-008

**Files:**
- Modify: `install.mjs`（`mergeMarkedBlock` 旁加 `mergeTopBlock`；`main` 的入口解析段与 2c 写入段；计划输出）
- Test: `test/workflow-block.test.mjs`

**Interfaces:**
- Consumes: `buildWorkflowHintBlock`、`getMarkedBlock`、`mergeMarkedBlock`、`assertMarkedBlock`
- Produces: `mergeTopBlock(raw, block, startMarker, endMarker)`；`main` 内的 `hintEntries`（Set of 实体路径）

- [ ] Step 1: 写失败测试（`test/workflow-block.test.mjs` 追加）：
  - 两入口都有标记块 → 安装后两个文件首行是 `<!-- dw-workflow:hint:start -->`；
  - 只有 `CLAUDE.md` 存在 → 提示块只进 `CLAUDE.md`，被创建出来的 `AGENTS.md` 有标记块无提示块；
  - 两入口都无标记块 → 两个文件都不被创建、也无提示块；
  - 重跑安装 → 提示块只有一份，且位置仍在最前；
  - 提示块正文被手改 → 恢复成片段正文；
  - 软链接共用一份实体 → 只写一次；
  - `--dry-run` → 文件字节不变。
- [ ] Step 2: 跑 `node --test test/workflow-block.test.mjs`，预期 FAIL。
- [ ] Step 3: 加 `mergeTopBlock`：块已在 → 走 `mergeMarkedBlock` 就地替换；不在 → 插到文本最前面。
- [ ] Step 4: `main` 里在 `initialClaudeRaw` / `initialAgentsRaw` 旁记下两个入口在写入前是否存在（对解析软链接后的实体路径 `fs.existsSync`），算出 `hintEntries`。
- [ ] Step 5: 2c 段循环内：`hintEntries` 命中的入口，在同一次改写里 `mergeTopBlock` 写入提示块，写后 `assertMarkedBlock` 校验，并断言块内正文与预期逐字相等。
- [ ] Step 6: 计划输出里加一行，说明提示块会写进哪些入口。
- [ ] Step 7: `node --test test/workflow-block.test.mjs` 预期 PASS；每条新断言做反向自检（撤掉实现确认判红）。

---

### Task 3：skill 初始化侧的同一套规则

**Slice:** 全新项目首次唤起 skill → 初始化在 worktree 内写标记块时一并写提示块。｜**依赖：** Task 1
**满足:** FR-003, FR-004

**Files:**
- Modify: `dw-system/skills/dw-workflow/references/init-初始化.md`（§流程 第 5 步与 §幂等规则）

- [ ] Step 1: 动笔前加载 `skill-principle` 与 `dw-prose`，读 `dw-system/skills/AGENTS.md`。
- [ ] Step 2: 第 5 步补写提示块的落点规则与"两个入口都不存在时只写 `AGENTS.md`"，指针指向 `hint.md`。
- [ ] Step 3: §幂等规则 补一句：提示块与标记块同一套幂等口径，就地替换不追加。
- [ ] Step 4: `node --test test/cross-reference.test.mjs test/cards-mandatory.test.mjs test/doc-budgets.test.mjs` 预期通过。

---

### Task 4：吃自己的狗粮与账本

**Slice:** 本仓库自身与各账本同步。｜**依赖：** Task 1–3
**满足:** FR-009

**Files:**
- Modify: `CLAUDE.md`（顶部加提示块）
- Modify: `engineering-context/cards/dw-system/标记块与旧版迁移.md`（权威实现与对外接口 + 陷阱项 + 确认）
- Modify: `CHANGELOG.md`（`## 未发布` 下一条 `新增`）
- Modify: `docs/index.md`（收录本次 spec 与 plan）

- [ ] Step 1: `CLAUDE.md` 顶部插入与 `hint.md` 逐字相同的提示块。
- [ ] Step 2: 卡片补三行：提示块标记、落点规则、两条写入路径；陷阱项补"为写提示块而凭空创建入口文件"与"把提示块追加到文件末尾"。`确认` 节日期改 2026-09-21。
- [ ] Step 3: CHANGELOG 写条目。
- [ ] Step 4: `docs/index.md` 收录两篇新文档。
- [ ] Step 5: `node --test test/*.test.mjs` 全绿。

---

## 核销表

| 需求 | 由哪个 Task 交付 |
|---|---|
| FR-001 | Task 1 |
| FR-002 | Task 2 |
| FR-003 | Task 2（安装器）+ Task 3（初始化） |
| FR-004 | Task 3 |
| FR-005 | Task 2 |
| FR-006 | Task 2 |
| FR-007 | Task 2 |
| FR-008 | Task 2 |
| FR-009 | Task 4 |
