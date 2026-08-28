---
lifecycle: active
superseded_by: ''
archived: ''
last_confirmed: '2026-08-27'
authority_refs:
  - 'test/contract-numbers.mjs 的 ENTRY_MAX_BYTES 取值与引用方式'
  - '00-流程总纲.md §五道门 的表格行集合与 §spec 过稿门 小节名'
  - '路径-lean.md §6.3 小节名'
  - 'eng-spec.md §13 / lean-change-spec.md 过稿记录 的节名'
---

# spec 过稿门 Coding Plan

> 依据 `docs/spec/2026-08-27-ai-dev-workflow-spec过稿门-eng-spec.md`。每任务"加载→批判性 review→实现→跑验证→commit"。

**Goal:** 给 `ai-dev-workflow` 落地第五道贯穿门「spec 过稿门」，并把入口字节上限从 8000 上调到 12000。
**Architecture:** 先改字节上限（后续任务要往入口加行，这是前置解锁），再由内向外接线：总纲立判据 → 完整流程分册与 Lean 自足册各自接点 → 模板留痕 → 协作面与注入片段 → 入口加载点 → 机器闸 → 收尾。
**Tech Stack:** markdown 判据文本 + Node 内置 test runner（零第三方依赖）。
**Worktree:** `/Users/weidwonder/projects/ai_dev_system/.worktrees/spec-review-gate`
**Task Branch:** `worktree-spec-review-gate`
**目标主分支:** `main`

---

### Task 1：字节上限上调与两个既有漏洞

**Slice:** 把 `ENTRY_MAX_BYTES` 改成 12000，并让"改错这个数字"这件事第一次能被闸抓到。 ｜ **依赖：** 无

**满足:** `FR-018, FR-019`

**Files:**
- Modify: `test/contract-numbers.mjs`（`ENTRY_MAX_BYTES` 与其注释）
- Modify: `test/cards-mandatory.test.mjs:148-149`（硬编码改 import）
- Modify: `test/contract-sync.test.mjs`（`CONTRACTS` 增条目）
- Modify: `CLAUDE.md`（§架构第 1 节的三个量化契约句、目录树 `SKILL.md` 行、§改动时注意的加载模型条）

**Interfaces:**
- Produces: `ENTRY_MAX_BYTES = 12000`，供 `cards-mandatory.test.mjs` 与 `contract-sync.test.mjs` 引用。
- Produces: `contract-sync.test.mjs` 的 `CONTRACTS` 新条目 `{ name: '入口 SKILL.md 字节上限', value: ENTRY_MAX_BYTES, refs: [...] }`，锚点串取 `CLAUDE.md` 里稳定的措辞片段。

- [x] **Step 1: 改单点定义** — `test/contract-numbers.mjs` 的 `ENTRY_MAX_BYTES` 改 12000；注释里「MUST NOT 上调」改写为记录判据与新纪律：UTF-8 下汉字 3 字节，8000 仅约 2600 汉字；上调 MUST 由用户拍板并同步全部活引用点，MUST NOT 为了让某次改动过闸而顺手上调。
- [x] **Step 2: 消除硬编码** — `test/cards-mandatory.test.mjs` 顶部 import `ENTRY_MAX_BYTES`，第 148-149 行两处字面量 `8000` 全改为该常量（断言消息用模板串拼出当前值）。
- [x] **Step 3: 补引用点清单** — `test/contract-sync.test.mjs` import `ENTRY_MAX_BYTES` 并在 `CONTRACTS` 增条目，refs 指向 `CLAUDE.md` 的两处锚点：`入口 \`SKILL.md\` ≤` 与 `入口 ≤`。
- [x] **Step 4: 同步 CLAUDE.md** — 三处 8,000 改 12,000（三个量化契约句 / 目录树 `SKILL.md` 行 / 加载模型契约条里的"入口 ≤8,000 字节"）。`docs/spec/`、`docs/plan/` 下的历史 8,000 **一字不动**。
- [x] **Step 5: 正向验证** — Run: `node --test test/contract-sync.test.mjs test/cards-mandatory.test.mjs test/number-drift.test.mjs` Expected: PASS
- [x] **Step 6: 反向自检（AC-018/AC-019）** — 临时把 `ENTRY_MAX_BYTES` 改成 `7000` 跑 `node --test test/cards-mandatory.test.mjs` Expected: FAIL；临时把 `CLAUDE.md` 一处数字改成 `9000` 跑 `node --test test/contract-sync.test.mjs` Expected: FAIL；两处都改回。
- [x] **Step 7: commit** — `git commit -m "feat: 入口字节上限 8000 → 12000，并让该常量被引用点闸盯住"`

---

### Task 2：总纲立判据 —— 第五道贯穿门

**Slice:** 走完整流程的 agent 读总纲时，能读到"spec 定稿后还有一道门"以及它的全部判据。 ｜ **依赖：** Task 1（本任务不改入口，但计数词改动与它同批合入更稳）

**满足:** `FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-009, FR-010, FR-014`

**Files:**
- Modify: `ai-dev-system/skills/ai-dev-workflow/references/core/00-流程总纲.md`（§流程总览图、§四道门 标题与表格、§Step 0 的"四道门一道不少"、§兼容取舍确认门 末尾接续句、**新增 §spec 过稿门**、:39 的 Lean 步骤号）
- Modify: `ai-dev-system/skills/ai-dev-workflow/references/core/用户沟通纪律.md`（§3 与 §发送前检查 各加一条边界说明；:45 的 Lean 步骤号）
- Modify: `test/counter-word.test.mjs`（受检词表 `四道门` → `五道门`，注释同步）

**Interfaces:**
- Produces: 小节名逐字 `## spec 过稿门：spec 定稿后、Coding Plan 之前`，锚点为 `§spec 过稿门`；后续 Task 3/4/7 与 `gate-sync.test.mjs` 都按它引用。
- Produces: 贯穿门总表新增一行，「门」列文本为 `**spec 过稿门**`。

- [x] **Step 1: 改总表与标题** — `## 四道门（贯穿两条路径，Lean 一道也不豁免）` → `## 五道门（…）`；表格在「兼容取舍确认门」之后插入 spec 过稿门一行，触发时机写 `spec 定稿后、Step 6 生成 Coding Plan 之前（Lean 并进第 4 步那一批）`，判据列指向 `↓ §spec 过稿门`。
- [x] **Step 2: 改流程总览图** — 两条分支各加一个节点：完整流程 `Step 1–5 → 兼容门 → spec 过稿门 → Step 6–7`；Lean 的兼容门节点改成 `兼容门 + spec 过稿门`。
- [x] **Step 3: 写 §spec 过稿门 小节** — 按 spec §0 决策表、§4 核心逻辑、§5 失败模型落判据：定位与参照物（FR-002 的两个 MUST NOT 清单）、逐条落稿义务（FR-003）、三条定稿判据（FR-004）、跳过口径三条 MUST NOT（FR-005）、留痕落点（FR-006）、回上一道门的条件（FR-007）、与相邻两道门的参照物划分表（MUST NOT 互相顶替）。小节头加 `> **何时读本节**：` 触发式标注，措辞 MUST 非规范（不用 MUST/SHOULD，避免给它新增一条 Lean 覆盖义务）。
- [x] **Step 4: 接续句与残留计数词** — §兼容取舍确认门 末尾加一句指向下一道门；`:52` 的「四道门一道不少」改「五道门一道不少」；`:39` 与 `用户沟通纪律.md:45` 的「`路径-lean.md` 第 5 步」改「第 4 步」。
- [x] **Step 5: 用户沟通纪律边界说明** — §3 末尾加一段：spec 过稿门问的是"要做的事对不对"（范围、功能需求、验收口径、兼容结论），不是本节说的详细程序设计，因此**不构成本节的例外**；MUST NOT 借它把文件、接口、数据结构、存储或框架选型做成待选项让用户挑。§发送前检查 加一行勾验项。
- [x] **Step 6: 改计数词词表** — `test/counter-word.test.mjs` 的 `CHECKED_WORDS` 里 `四道门` 条目的 `word` 与 `variants` 改 `五道门`，注释里的举例同步。
- [x] **Step 7: 验证** — Run: `node --test test/counter-word.test.mjs test/lean-selfcontained.test.mjs test/wording-redline.test.mjs test/resident-budget.test.mjs` Expected: PASS（`lean-selfcontained` 此刻可能因新 MUST 未进自足册而判红，红了 MUST 记下来交 Task 4 收；MUST NOT 靠改 `EXCLUDED` 让它绿）
- [x] **Step 8: 反向自检** — `grep -rn "四道门" ai-dev-system/skills/` Expected: 仅 `ai-prd/references/collab/team.md` 一处（留给 Task 6）。**范围 MUST 限定在 skill 判据文件**——`migrations/` 的历史指南、`test/` 与 `CLAUDE.md` 里说明新旧两值的病史注释 MUST NOT 改写，算进来会得到一个判不过的期望值（同 spec AC-008）
- [x] **Step 9: commit** — `git commit -m "feat(总纲): 新增 spec 过稿门，贯穿门四道改五道"`

---

### Task 3：完整流程分册接点

**Slice:** 走到 Step 5 末尾的 agent 被明确告知下面有两道门、顺序如何。 ｜ **依赖：** Task 2 的 §spec 过稿门 小节名

**满足:** `FR-001`

**Files:**
- Modify: `ai-dev-system/skills/ai-dev-workflow/references/core/步骤-1-7-设计与实现.md`（Step 5 末尾的 ⛔ 提示、Step 6 开头的前置声明）

- [x] **Step 1: 改 Step 5 末尾提示** — 现有「本步之后、Step 6 之前插入「兼容取舍确认门」」扩成两道门与其先后：先兼容取舍确认门，再 spec 过稿门，各自判据指名引用 `00-流程总纲.md` 的对应小节。
- [x] **Step 2: Step 6 前置声明** — Step 6 开头加一句：进入本步前两道门都 MUST 已过，spec 过稿门的结论已写进 spec §13。
- [x] **Step 3: 验证** — Run: `node --test test/wording-redline.test.mjs` Expected: PASS
- [x] **Step 4: commit** — `git commit -m "feat(步骤分册): Step 5→6 之间接上 spec 过稿门"`

---

### Task 4：Lean 自足册

**Slice:** 走 Lean 的 agent 只读自足册也能完整执行这道门。 ｜ **依赖：** Task 2

**满足:** `FR-008`

**Files:**
- Modify: `ai-dev-system/skills/ai-dev-workflow/references/core/路径-lean.md`（`:7` 与 §1.3 的门全景、§6 标题与新增 §6.3、§14 顺序速查表、§0.3 的按节加载清单）

**Interfaces:**
- Produces: 小节名逐字 `### 6.3 spec 过稿门`，供入口加载点清单的 `(L§6.3)` 标注引用。

- [x] **Step 1: 门全景** — `### 1.3 门的全景：四道贯穿门 + 三道条件门` → `五道贯穿门`；清单加一行；`:7` 与 `:90,:106` 的「四道门」表述同步。
- [x] **Step 2: 写 §6.3** — 每条要点 MUST 带来源锚点（`来源：00-流程总纲.md §spec 过稿门`）。内容覆盖 Lean 侧全部适用 MUST：与兼容取舍、大架构**同一批**抛出（整页 spec 直接摆出来）；参照物限定；逐条落稿；三条定稿判据；跳过口径；留痕写进 lean-change-spec 的过稿记录行；改到需求或兼容结论时回同批重问。
- [x] **Step 3: §6 标题与 §0.3** — §6 标题从「第 4 步：兼容取舍确认门（含大架构 / 不可逆确认门）」扩成含 spec 过稿门；§0.3 的按节加载清单把 §6.3 归为前置（它与 §6.1 同批触发）。
- [x] **Step 4: §14 顺序速查表** — 第 4 步那行补上本门。
- [x] **Step 5: 验证** — Run: `node --test test/lean-selfcontained.test.mjs test/counter-word.test.mjs test/wording-redline.test.mjs` Expected: PASS（Task 2 Step 7 记下的红此刻 MUST 转绿）
- [x] **Step 6: commit** — `git commit -m "feat(lean): 自足册补齐 spec 过稿门要点"`

---

### Task 5：两份模板的留痕落点

**Slice:** 过完门的人有地方写下结论，且该结论能被评审门文档轴查到。 ｜ **依赖：** Task 2

**满足:** `FR-006`

**Files:**
- Modify: `ai-dev-system/skills/ai-dev-workflow/assets/templates/eng-spec.md`（末尾新增 `## 13. 过稿记录（MUST）`）
- Modify: `ai-dev-system/skills/ai-dev-workflow/assets/templates/lean-change-spec.md`（新增过稿记录行）

- [x] **Step 1: eng-spec 加 §13** — 节名逐字 `## 13. 过稿记录（MUST）`，含一行引导语（三选一：定稿 / 用户显式跳过本次 / 提了意见及落稿情况）与一行示例格式 `- YYYY-MM-DD ｜ 结论 ｜ 过程一句话`。**数字就地写全，MUST NOT 改成指向 skill 的指名引用**（模板会被复制进目标项目，读它的 AI 打不开本 skill）。
- [x] **Step 2: lean-change-spec 加行** — 在兼容取舍那一行之后加「过稿记录」一行，同样三选一。
- [x] **Step 3: 验证** — Run: `node --test test/counter-word.test.mjs test/doc-index.test.mjs` Expected: PASS
- [x] **Step 4: commit** — `git commit -m "feat(模板): eng-spec 与 lean-change-spec 增过稿记录落点"`

---

### Task 6：协作面分册与注入片段

**Slice:** 目标项目的 `CLAUDE.md` 标记块里也声明了这道门，且 solo/team 各自知道拍板人是谁。 ｜ **依赖：** Task 2

**满足:** `FR-011, FR-015`

**Files:**
- Modify: `ai-dev-system/skills/ai-dev-workflow/references/collab/solo.md`（`:21` 挂起例外清单、`:49` 护栏映射表）
- Modify: `ai-dev-system/skills/ai-dev-workflow/references/collab/team.md`（§3 拍板人段）
- Modify: `ai-dev-system/skills/ai-dev-workflow/assets/config-snippets/base.md`（增一条门声明）
- Modify: `ai-dev-system/skills/ai-dev-workflow/assets/config-snippets/collab-solo.md`（挂起例外同步）
- Modify: `ai-dev-system/skills/ai-prd/references/collab/team.md:23`（「四道门之二」改指名引用）

- [x] **Step 1: solo 侧** — `:21` 的例外清单从「用户本人的兼容取舍拍板、`merge-gate="pr"` 时的平台审批与 CI」扩到含 spec 过稿门；同一句里补明本门与兼容取舍门是**仅有的两个**允许因等用户而挂起的流程内点。
- [x] **Step 2: team 侧** — §3 写明本门拍板人是业务方，且只摆业务可判定项（范围与不做什么、功能需求、验收口径、兼容结论），MUST NOT 把数据模型 / 接口契约 / 核心逻辑摆给业务方。
- [x] **Step 3: 注入片段** — `base.md` 在「编码完成后 MUST 过代码评审门」那条之前插入一条 spec 过稿门声明（**数字与判据就地写全**）；`collab-solo.md` 的挂起例外同步。
- [x] **Step 4: ai-prd 那处** — `ai-prd/references/collab/team.md:23` 的「`ai-dev-workflow` 的四道门之二」改成指名引用兼容取舍确认门。
- [x] **Step 5: 验证** — Run: `node --test test/counter-word.test.mjs test/install-and-doc-governance.test.mjs test/cards-mandatory.test.mjs` Expected: PASS；再 `grep -rn "四道门" ai-dev-system/skills/` Expected: 零命中（范围理由同 Task 2 Step 8）
- [x] **Step 6: commit** — `git commit -m "feat(协作面): solo/team 与注入片段接上 spec 过稿门"`

---

### Task 7：入口加载点清单

**Slice:** 走到 spec 定稿那一刻的 agent，能按入口清单取到这道门的判据。 ｜ **依赖：** Task 1（字节余量）、Task 2（小节名）、Task 4（`L§6.3` 标注）

**满足:** `FR-012`

**Files:**
- Modify: `ai-dev-system/skills/ai-dev-workflow/SKILL.md`（〈加载点清单〉增一行；§路由逻辑第 4 步与 frontmatter 不动）

**Interfaces:**
- Consumes: `00-流程总纲.md §spec 过稿门`（Task 2）、`路径-lean.md §6.3`（Task 4）。
- Produces: 清单新行，触发条件文本逐字为 `spec 定稿后要过 spec 过稿门`。

- [x] **Step 1: 增行** — 在「spec 定稿前要拍板兼容取舍」那一行之后插入：触发条件 `spec 定稿后要过 spec 过稿门`；加载对象 `` `core/00-流程总纲.md` §spec 过稿门 (L§6.3) ``；为什么此刻需要 `定稿判据、跳过留痕、与兼容门的先后`；适用路径 `两条`。**MUST NOT 改动任何既有行的触发条件文本**（`cards-mandatory.test.mjs` 逐字断言十四个设计阶段触发条件在场）。
- [x] **Step 2: 验证字节与行数** — Run: `wc -c ai-dev-system/skills/ai-dev-workflow/SKILL.md && node --test test/cards-mandatory.test.mjs` Expected: ≤12000 且 PASS
- [x] **Step 3: 红线验证** — Run: `node --test test/wording-redline.test.mjs` Expected: PASS（入口的规范词条数只增不减）
- [x] **Step 4: commit** — `git commit -m "feat(入口): 加载点清单增 spec 过稿门一行"`

---

### Task 8：门同步机器闸

**Slice:** 以后任何人加减一道贯穿门、或漏改某个必须复述它的文件，测试当场判红。 ｜ **依赖：** Task 2, 4, 7

**满足:** `FR-013`

**Files:**
- Create: `test/gate-sync.test.mjs`

**Interfaces:**
- Consumes: `00-流程总纲.md` §五道门 的表格（每行「门」列的粗体名）。
- Produces: 常量 `MUST_RESTATE`（必须复述贯穿门的文件相对路径清单）。

- [x] **Step 1: 写测试** — 从 `00-流程总纲.md` 的贯穿门总表解析出门名集合（表格行首列的 `**…**`），断言：①集合非空且每个门名在 `路径-lean.md` §1.3 与入口 `SKILL.md` 里都字面在场；②总表行数与该节标题里的计数词一致（`五道门` → 5 行）。文件顶部注释写清病史与判据（同 `counter-word.test.mjs` 的写法）。
- [x] **Step 2: 反向自检（AC-012）** — 临时从 `路径-lean.md` §1.3 删掉「spec 过稿门」一行 Run: `node --test test/gate-sync.test.mjs` Expected: FAIL 且点名该文件；改回。再临时把总表标题改成 `六道门` Expected: FAIL；改回。
- [x] **Step 3: 验证** — Run: `node --test test/gate-sync.test.mjs` Expected: PASS
- [x] **Step 4: commit** — `git commit -m "test: 新增贯穿门同步闸 gate-sync"`

---

### Checkpoint：Task 1–8 之后
- [x] `node --test test/*.test.mjs` 全绿
- [x] `grep -rn "四道门" ai-dev-system/skills/` 零命中
- [x] 走查一遍：假装自己是零上下文 agent，从入口清单出发能否取到本门判据并执行

---

### Task 9：版本、索引与账本收尾

**Slice:** 这次改动对外可分发、可追溯，且 TODO 里两条已做掉的账被销掉。 ｜ **依赖：** Checkpoint 通过

**满足:** `FR-016, FR-017`

**Files:**
- Modify: `ai-dev-system/VERSION`（→ `2.11.0`）
- Modify: `docs/TODO.md`（删两条）
- Modify: `docs/index.md`（收录本 spec 与本 plan）
- Modify: `CLAUDE.md`（§架构 第 2 节的门表述、§改动时注意 增一条本门的跨文件契约）

- [x] **Step 1: bump VERSION** — 写 `2.11.0`。**MUST NOT 新建** `ai-dev-system/migrations/2.11.0.md`：本次零手动动作（重装即可、不改标记块字段、不要求回填存量文档）。
- [x] **Step 2: 销账** — `docs/TODO.md` 删掉「spec 定稿后缺一道一般性 review 环节」与「入口 SKILL.md 已到 7980 字节、逼近 8000 字节上限」两条。
- [x] **Step 3: 索引** — `docs/index.md` 按现有格式收录本 spec 与本 plan。
- [x] **Step 4: CLAUDE.md** — §架构 第 2 节的门表述改成五道并点名新门；§改动时注意 增一条「spec 过稿门是跨文件的契约」，列出全部落点与要跑的测试。
- [x] **Step 5: 验证** — Run: `node --test test/*.test.mjs` Expected: PASS（含 `installer-migration.test.mjs` —— 它对当前 VERSION 的迁移指南是条件式断言，不建指南不判红）
- [x] **Step 6: commit** — `git commit -m "chore: 2.11.0 —— spec 过稿门与入口字节上限上调"`

---

### Task 10：存量豁免的落点（评审门回填）

**Slice:** §8.1 第 4 条拍板的兼容取舍真正生效——文档轴碰到 2.11.0 之前的存量 spec 不会误报。 ｜ **依赖：** Task 5（模板新增了过稿记录节，才有"存量没有这一节"这回事）

**满足:** `FR-020`

**来历**：本任务是代码评审门忠实轴回填的。原 plan 的 9 个任务里**没有任何一个承载 §8.1 第 4 条**——用户拍了"存量 spec 缺该节时文档轴 MUST 跳过"，spec §8.2 也把它登记成保留例外，但 `代码评审纪律.md` 一个字没改，这条豁免没有落点。拍板结论与需求清单之间的缺口，机器闸看不出来（它不知道有过这次拍板），只有把 §8.1 逐条对回实现才会显形。

**Files:**
- Modify: `ai-dev-system/skills/ai-dev-workflow/references/core/代码评审纪律.md`（§四条轴 D 轴职责段、§子代理 prompt 模板 文档轴职责段）

- [x] **Step 1: D 轴职责段补豁免** — 在"真相源里出现尚未实现的内容…"那条之后接一条到期豁免（至 2027-02-28）：缺「过稿记录」节的存量 spec MUST 跳过、MUST NOT 报成缺陷；**豁免只针对「这一节压根不存在」**，有该节却为空或与实际过门情况不符的照常报。
- [x] **Step 2: prompt 模板同改** — 文档轴职责段的 ① 与 ② 之间插同一条，措辞收到三行内（那是子代理 prompt，篇幅敏感）。
- [x] **Step 3: 回填 spec** — spec §1.1 增 FR-020、§11 增 AC-020，使这条保留例外可核销。
- [x] **Step 4: 验证** — Run: `node --test test/doc-axis.test.mjs test/counter-word.test.mjs test/wording-redline.test.mjs test/lean-selfcontained.test.mjs` Expected: PASS
- [x] **Step 5: commit** — 随评审门修复一并提交

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| 新门的 MUST 漏进 Lean 自足册 | H | Task 4 专门收；`lean-selfcontained.test.mjs` 按"小节含 MUST"动态算必覆盖集，漏了判红。Task 2 Step 3 的〈何时读本节〉标注 MUST 用非规范措辞，否则会凭空多出一条覆盖义务 |
| 计数词漏改一处而全绿 | H | `ai-prd/` 不在 `counter-word.test.mjs` 遍历范围内 —— Task 6 Step 4 单独收，Checkpoint 用全仓 grep 兜底 |
| 入口改动误伤既有触发条件文本 | M | `cards-mandatory.test.mjs` 逐字断言十四个触发条件在场；Task 7 Step 1 明令只插新行、不动既有行 |
| 上调上限被读成"入口可以随便长" | M | Task 1 Step 1 的注释把新纪律写死：上调 MUST 由用户拍板并同步全部活引用点，MUST NOT 为过闸顺手上调 |
| 改到历史文档里的 8,000 | M | Task 1 Step 4 明令 `docs/spec/`、`docs/plan/` 一字不动；`number-drift.test.mjs` 的历史记账条目会因篡改而判红 |

## 替换清单核销（来自 spec §8.2）

| 被取代物 | 删除任务 | 实测引用数 | 核销 |
|---|---|---|---|
| `## 四道门（贯穿两条路径，Lean 一道也不豁免）` | Task 2 Step 1 | 0 | ✅ |
| `### 1.3 门的全景：四道贯穿门 + 三道条件门` | Task 4 Step 1 | 0 | ✅ |
| 「四道门一道不少 / 一道也不豁免」表述 | Task 2 Step 4、Task 4 Step 1 | 0 | ✅ |
| 计数词受检词表条目 `四道门` | Task 2 Step 6 | 0 | ✅ |
| 「`ai-dev-workflow` 的四道门之二」 | Task 6 Step 4 | 0 | ✅ |
| 「见 `路径-lean.md` 第 5 步」 | Task 2 Step 4 | 0 | ✅ |
| `docs/TODO.md` 两条待办 | Task 9 Step 2 | 0 | ✅ |
| `ENTRY_MAX_BYTES = 8000` 及其「MUST NOT 上调」注释 | Task 1 Step 1 | 0 | ✅ |
| `cards-mandatory.test.mjs` 两处硬编码 `8000` | Task 1 Step 2 | 0 | ✅ |

## 完成与自动合并

- [ ] **代码评审门通过**：按 `references/core/代码评审纪律.md` §四条轴 逐轴的子代理报告齐全，P0/P1 已清零
- [ ] **需求覆盖核销**：spec 的每条 `FR-###` 都至少被一个 Task 的 `满足:` 引用；每个 Task 的 `满足:` 都指向真实存在的编号
- [ ] 替换清单逐条核销：实测引用数为 0 且已删
- [ ] 需求范围、文档、测试全部完成
- [ ] 任务分支已吸收最新 `main` 并重新验证
- [ ] worktree 干净、全部改动已提交
- [ ] `merge-gate="direct"`：全部门禁通过后本地对 `main` 做 `git merge --no-ff` 并清理 worktree
