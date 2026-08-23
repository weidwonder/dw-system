---
lifecycle: active
superseded_by: ''
archived: ''
last_confirmed: '2026-08-23'
authority_refs:
  - '本 plan 的 Interfaces 节冻结了：加载点清单的列结构、FR-###/AC-### 编号格式、忠实轴返回格式的增列方式'
---

# 渐进式披露与需求追溯 Coding Plan

> 把 spec 拆成"执行者对代码库零上下文"也能做的任务。DRY / YAGNI / 勤 commit。
> 上游 spec：`docs/spec/2026-08-23-渐进式披露与需求追溯-eng-spec.md`（FR-001…FR-013 / AC-001…AC-022）。
> **本次交付物主体是 markdown**，因此"写失败测试→实现→转绿"只对有机器检查的任务（T3/T4、T8/T9、T12）适用；纯文档任务用"改→验证命令→commit"。
> 任务间信息只通过本 plan 的 Interfaces 传递，不依赖会话记忆。

**Goal:** 让 `ai-dev-workflow` 从"每次先背七篇"改成"用到才取"，并给 spec 需求装上贯通到测试的编号。
**Architecture:** 三步走——先做互不依赖的契约改动（编号、偏离类型、计数词），再做加载模型重构（移出、入口、自足册），最后统一措辞精简并验收体积。
**Tech Stack:** Markdown + Node 内置 test runner（零第三方依赖，需 Node ≥20）。
**Worktree:** `/Users/weidwonder/projects/ai_dev_system/.worktrees/progressive-disclosure`
**Task Branch:** `feat/progressive-disclosure`
**目标主分支:** `main`

---

### Task 1：需求编号进 spec 模板

**Slice:** 写 eng-spec 的人能看到"需求要编号"并照做 ｜ **依赖：** 无

**Files:**
- Modify: `ai-dev-system/skills/ai-dev-workflow/assets/templates/eng-spec.md`
- Modify: `ai-dev-system/skills/ai-dev-workflow/assets/templates/lean-change-spec.md`

**Interfaces:**（供后续任务对齐）
- Produces: 编号格式 `FR-` / `AC-` + 三位零填充（`FR-001`）；规则文案「永不复用、永不重排；删除的保留编号并标"已撤销 + 原因"；与既有 `Invariant N:` 各自独立」

- [ ] Step 1: `eng-spec.md` §1 新增子节「1.1 功能需求」，含编号表（列：编号 / 需求）与上述规则文案（MUST 措辞）
- [ ] Step 2: `eng-spec.md` §11 完成定义改为编号表（列：编号 / 验收项 / 满足），末尾加一行覆盖自查说明
- [ ] Step 3: `lean-change-spec.md` 的需求与验收节同样加编号要求（Lean 不豁免，判据见 spec §3）
- [ ] Step 4: 验证 — Run: `grep -c 'FR-###' ai-dev-system/skills/ai-dev-workflow/assets/templates/*.md` Expected: 两个模板各 ≥1
- [ ] Step 5: commit — `git commit -m "feat(template): spec 模板增加 FR/AC 需求编号要求 (FR-009)"`

---

### Task 2：coding-plan 模板增加需求引用

**Slice:** 写 plan 的人能标出每个任务满足哪几条需求 ｜ **依赖：** Task 1 的编号格式

**Files:**
- Modify: `ai-dev-system/skills/ai-dev-workflow/assets/templates/coding-plan.md`

**Interfaces:**
- Consumes: Task 1 的 `FR-###` 格式
- Produces: 任务头字段 `**满足:** FR-003, FR-007`；完成清单新增「需求覆盖核销」项

- [ ] Step 1: 任务结构的 `**Slice:**` 行后增加 `**满足:**` 字段（与 `依赖` 同级）
- [ ] Step 2: 「完成与自动合并」清单增加一行需求覆盖核销
- [ ] Step 3: 验证 — Run: `grep -c '满足:' ai-dev-system/skills/ai-dev-workflow/assets/templates/coding-plan.md` Expected: ≥1
- [ ] Step 4: commit — `git commit -m "feat(template): coding-plan 任务增加需求引用与覆盖核销 (FR-010)"`

---

### Task 3：忠实轴偏离类型 + 降级契约

**Slice:** 评审子代理报出的每条问题都带"怎么错的" ｜ **依赖：** 无

**Files:**
- Modify: `ai-dev-system/skills/ai-dev-workflow/references/core/代码评审纪律.md`（§返回格式 在 :114-117，位于 §子代理 prompt 模板 的代码块内）

**Interfaces:**
- Produces: 忠实轴表头 `| # | 偏离类型 | 严重度 | 位置 | 问题 | 建议修改 |`；五类取值闭集 `漏做/做一半/做反了/越界/镀金`；降级报告首行文案 `本次未跑覆盖矩阵：spec 无编号`

- [ ] Step 1: §返回格式 改为**按轴条件增列**——忠实轴多一列偏离类型，其余三轴表头不变（MUST NOT 四轴统一加列）
- [ ] Step 2: 在 §本轴职责 的忠实轴段落写入五类取值与闭集声明，并说明 `越界` 为何与 `镀金` 分列（现行 `:27` 与 `:116` 已分开点名）
- [ ] Step 3: 同段写入降级契约：遇无 `FR-###` 的 spec 时退回自然语言逐条对照，报告首行输出规定文案，不报缺陷不阻断
- [ ] Step 4: 写入覆盖矩阵产出要求（有编号时）：哪条需求零任务 = 漏做，哪个任务无需求 = 镀金
- [ ] Step 5: 验证 — Run: `grep -c '偏离类型\|本次未跑覆盖矩阵' ai-dev-system/skills/ai-dev-workflow/references/core/代码评审纪律.md` Expected: ≥3
- [ ] Step 6: commit — `git commit -m "feat(review): 忠实轴增加偏离类型维度与无编号降级契约 (FR-011)"`

---

### Task 4：计数词防腐检查（先写测试，此时应为红）

**Slice:** 有一条机器闸能拦住计数词重新扩散 ｜ **依赖：** 无

**Files:**
- Create: `test/counter-word.test.mjs`
- Test: 同上

**Interfaces:**
- Produces: 受检词表常量 `['四轴','四道门','四问','七条"不裁剪"护栏']`；权威定义文件映射；豁免清单 `[SKILL.md, 路径-lean.md, assets/config-snippets/**]`

- [ ] Step 1: 写测试 — 对受检词表每个词，`grep -rl` 于 `ai-dev-system/skills/ai-dev-workflow/`，断言命中文件集合 ⊆ {该词的权威定义文件} ∪ 豁免清单。**字面匹配**，MUST NOT 用分词或正则模糊匹配
- [ ] Step 2: 跑测试确认失败 — Run: `node --test test/counter-word.test.mjs` Expected: FAIL（内容还没改，`四轴` 现命中 13 个文件）
- [ ] Step 3: commit — `git commit -m "test: 新增计数词防腐检查（当前应红）(FR-007)"`

---

### Task 5：计数词改写（让 Task 4 转绿）

**Slice:** 引用处不再复写数字，改指名引用 ｜ **依赖：** Task 4 的受检词表与豁免清单

**Files:**
- Modify: `references/core/` 下含受检词的各文件（实测命中：`四轴` 13 个文件、`四道门` 4、`四问` 7、`七条"不裁剪"护栏` 4；权威文件与豁免清单内的不改）
- Modify: `test/doc-axis.test.mjs`（:80 对 `worktree开发纪律.md` 含「四轴」的断言，与新规则互斥）
- Modify: `test/cards-mandatory.test.mjs`（:267 护栏词取值闸改写成新策略）
- **MUST NOT modify**: `test/cards-mandatory.test.mjs:285`（守的「N 个固定文件名」不在受检词表内，改了会失去唯一防线——spec §8.2 已定为永久保留）

- [ ] Step 1: 逐文件把非权威处的受检计数词改成指名引用（"按 `代码评审纪律.md` §四条轴 执行"）
- [ ] Step 2: 改 `doc-axis.test.mjs:80` 与 `cards-mandatory.test.mjs:267` 两条断言
- [ ] Step 3: 跑测试确认通过 — Run: `node --test test/counter-word.test.mjs test/doc-axis.test.mjs test/cards-mandatory.test.mjs` Expected: PASS
- [ ] Step 4: 人为破坏验证 — 在任一非豁免文件里写回「四轴」，Run 同上 Expected: FAIL；改回后 PASS（验 AC-010）
- [ ] Step 5: commit — `git commit -m "refactor(docs): 计数词改指名引用，既有两条断言同改 (FR-007, FR-012)"`

---

### Checkpoint：Task 1–5 之后
- [ ] `node --test test/*.test.mjs` 全绿
- [ ] 三个模板与评审纪律的契约改动已生效，与加载模型重构互不影响

---

### Task 6：总纲抽沿革，三篇移出

**Slice:** 常驻集合从九篇变六篇，移出内容各有着落 ｜ **依赖：** 无（但 Task 7 依赖它）

**Files:**
- Modify: `references/core/00-流程总纲.md`（抽沿革 + 补三篇结论行 + 补 `文档治理.md` 两节要点）
- Create: `docs/spec/2026-08-23-流程总纲历史沿革.md`（沿革归位处）
- Modify: `docs/index.md`（沿革文档进索引）

**Interfaces:**
- Produces: 总纲内保留的三条结论行——`文档治理.md` → §硬规则 + §5 账本读取要点 + 三个输出目录 + `lifecycle`/`authority_refs`；`spec写作纪律.md` → 零上下文可动手 + RFC2119 + 无占位符；`worktree开发纪律.md` → 两道门各一条何时过、过不了怎么办

- [ ] Step 1: 把总纲内"为什么这么定"的沿革论证整段移入新建的 `docs/spec/2026-08-23-流程总纲历史沿革.md`，总纲在对应结论处留一个指向它的引用
- [ ] Step 2: 总纲补入三篇的结论行（内容见 Interfaces）
- [ ] Step 3: `docs/index.md` 新增沿革文档条目
- [ ] Step 4: 验证 — Run: `wc -c ai-dev-system/skills/ai-dev-workflow/references/core/00-流程总纲.md` Expected: 显著小于 23,794 且含三条结论行
- [ ] Step 5: commit — `git commit -m "refactor(core): 总纲抽历史沿革，三篇移出常驻并留结论行 (FR-004, FR-005)"`

---

### Task 7：入口重写——瘦身 + 加载点清单 + 工作区隔离门要点

**Slice:** 唤起时只读入口，就能过第一道门并完成分流 ｜ **依赖：** Task 6 的移出结果

**Files:**
- Modify: `ai-dev-system/skills/ai-dev-workflow/SKILL.md`
- Modify: `test/cards-mandatory.test.mjs`（:92-110 的「常驻 core 七篇」断言与三篇常驻清单，按新常驻集合改写）

**Interfaces:**
- Consumes: Task 6 的三条结论行位置
- Produces: 加载点清单表（列：触发条件 / 加载对象 / 为什么此刻需要 / 适用路径），十四行；入口内的工作区隔离门要点

- [ ] Step 1: 把 spec §7 的十四个加载点原样落进 `SKILL.md` 路由节（`#` 列可省，它只是阅读序号）
- [ ] Step 2: 写入工作区隔离门要点——MUST 够判断"必须建 worktree、目录取自哪个字段、主工作树不干净时中止"（AC-004）
- [ ] Step 3: 精简路由逻辑的 2a/2b/2c/2d/2e 分支详解与目录树，目标 ≤8,000 字节
- [ ] Step 4: 改 `cards-mandatory.test.mjs:92-110` 的断言为新常驻集合（6 篇）
- [ ] Step 5: 验证 — Run: `wc -c ai-dev-system/skills/ai-dev-workflow/SKILL.md && node --test test/cards-mandatory.test.mjs test/install-and-doc-governance.test.mjs` Expected: ≤8000 且 PASS（`install-and-doc-governance.test.mjs:487-488` 的两条入口断言须仍成立）
- [ ] Step 6: commit — `git commit -m "refactor(skill): 入口瘦身并内置加载点清单与工作区隔离门要点 (FR-001, FR-003, FR-012)"`

---

### Task 8：Lean 自足册覆盖率检查（先写测试，此时应为红）

**Slice:** 有一条机器闸能拦住自足册漏抄纪律 ｜ **依赖：** Task 7 的入口内容（要点可能落在入口）

**Interfaces:**
- Produces: 来源清单常量（十个文件：`00-流程总纲.md`、`代码事实纪律.md`、`用户沟通纪律.md`、`上下文卫生.md`、`worktree开发纪律.md`、`代码评审纪律.md`、`文档治理.md`、`spec写作纪律.md`、`collab/solo.md`、`collab/team.md`——**solo 与 team 取并集**）；被检查方 = 自足册 + 入口；`路径-lean.md` **只作被检查方，MUST NOT 进来源清单**（否则自指）

**Files:**
- Create: `test/lean-selfcontained.test.mjs`

- [ ] Step 1: 写测试 — 从来源清单各文件抽取「适用于 Lean 的 MUST 条目」，断言每条都能在被检查方里找到标注了该来源的要点
- [ ] Step 2: 跑测试确认失败 — Run: `node --test test/lean-selfcontained.test.mjs` Expected: FAIL（自足册还没写）
- [ ] Step 3: commit — `git commit -m "test: 新增 Lean 自足册覆盖率检查（当前应红）(FR-008)"`

---

### Task 9：Lean 自足册（让 Task 8 转绿）

**Slice:** 四问全否后只凭自足册就能走完 Lean ｜ **依赖：** Task 8 的来源清单、Task 7 的入口内容

**Files:**
- Modify: `references/core/路径-lean.md`（原地扩写，保留路径——spec §8.2 定为"原地扩写"而非新建）

- [ ] Step 1: 扩写自足册，装入 spec §Lean 自足册要装什么 列出的全部内容，**每条要点显式标注来源**（`来源：<文件> §<小节>`）
- [ ] Step 2: 写入升级路径（Lean 中途命中升级条件 → 声明自足册失效并丢弃）与从属规则（冲突以细则为准）
- [ ] Step 3: 跑测试确认通过 — Run: `node --test test/lean-selfcontained.test.mjs` Expected: PASS
- [ ] Step 4: 人为破坏验证 — 删掉自足册里任一条要点，Expected: FAIL 且指出缺的是哪一条（验 AC-010）
- [ ] Step 5: commit — `git commit -m "feat(lean): 路径-lean 扩写为自足册并标注来源 (FR-008)"`

---

### Checkpoint：Task 6–9 之后
- [ ] `node --test test/*.test.mjs` 全绿
- [ ] 加载模型重构闭环：常驻 6 篇、入口含清单、自足册覆盖达标

---

### Task 10：红线比对检查（先写测试）

**Slice:** 有一条机器闸能拦住措辞精简误删判据 ｜ **依赖：** 无

**Files:**
- Create: `test/wording-redline.test.mjs`

**Interfaces:**
- Produces: 比对方式——对每个被本分支改动过的 markdown，取该文件在分支起点（`git merge-base HEAD main`）的版本作基线，比对 MUST/MUST NOT/SHOULD/MAY 条数与判据正反例（"算/不算"类对照表）行数，均不得减少

- [ ] Step 1: 写测试（Invariant 1/2）
- [ ] Step 2: 跑测试 — Run: `node --test test/wording-redline.test.mjs` Expected: PASS（此刻尚未精简，条数未减）
- [ ] Step 3: commit — `git commit -m "test: 新增措辞精简红线比对检查 (FR-006)"`

---

### Task 11：措辞精简（分批，每批一次 commit）

**Slice:** 逐文件压体积而不伤判据 ｜ **依赖：** Task 10 的红线检查、Task 6/7/9（内容定型后才精简）

按 spec §4.2 的五步顺序处理，**每个文件一次 commit**，每次 commit 前跑红线检查：

| 批次 | 文件 | 现体积 |
|---|---|---|
| 11a | `00-流程总纲.md` | 抽沿革后待测 |
| 11b | `代码事实纪律.md` | 14,550 |
| 11c | `collab/solo.md` + `collab/team.md` | 5,874 + 4,875 |
| 11d | `用户沟通纪律.md` + `上下文卫生.md` | 5,487 + 5,081 |
| 11e | `SKILL.md`（在 Task 7 瘦身基础上再精简） | ≤8,000 |
| 11f | 移出的三篇 + `代码评审纪律.md` + 模板 + `路径-lean.md` | 各自 |

- [ ] 每批 Step: 精简 → Run: `node --test test/wording-redline.test.mjs` Expected: PASS → commit
- [ ] 全部完成后验证体积 — Run: `wc -c` 常驻 6 篇求和 Expected: ≤50,000（AC-003）
- [ ] 超标时按 spec §5 处置：扩大范围（下一顺位拆 `代码事实纪律.md`），**MUST NOT 下调目标值**

---

### Task 12：VERSION bump 与口径归并

**Slice:** 版本与真相源跟上本次改动 ｜ **依赖：** Task 1–11 全部完成

**Files:**
- Modify: `ai-dev-system/VERSION`
- Modify: `CLAUDE.md`（仓库根，归并本次改变的口径）
- **MUST NOT create**: `ai-dev-system/migrations/<新版本>.md`（本次升级零手动动作，判据见 spec §8.3 与 `CLAUDE.md` §版本管理）

- [ ] Step 1: bump `VERSION`（本次改变已安装项目的行为契约）
- [ ] Step 2: 更新根 `CLAUDE.md`：§架构 第 1 节的"常驻七篇"表述、§改动时注意 中受本次影响的跨文件契约条目（含文档轴那条里的 grep 命令——计数词已改指名引用）
- [ ] Step 3: 验证 — Run: `ls ai-dev-system/migrations/ && node --test test/installer-migration.test.mjs` Expected: 无新增文件且 PASS
- [ ] Step 4: commit — `git commit -m "chore: bump VERSION 并归并口径到 CLAUDE.md (FR-013)"`

---

### Task 13：真跑验收（三条路径）

**Slice:** 用改完的体系跑真需求，验证四道门与编号链路 ｜ **依赖：** Task 1–12

- [ ] Step 1: 真跑最窄 Lean（找一个三行级改动）——记录全程加载了什么，核对每次加载都能在加载点清单里找到对应行，且未加载任何常驻篇（AC-019）
- [ ] Step 2: 真跑 bug 类 Lean——核对 `bug诊断纪律.md` 只在红回路门命中时才加载（AC-020）
- [ ] Step 3: 真跑完整流程（多条需求）——核对编号在四个落点贯通、无一次人工重编（AC-021）
- [ ] Step 4: 三种典型 Lean 的实际加载量各记一个数进 `docs/report/`（观测指标，非门槛）
- [ ] Step 5: commit — `git commit -m "docs(report): 真跑验收记录与加载量观测"`

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Task 11 精简后常驻仍 > 50,000 | H | 按 spec §5 扩大范围拆 `代码事实纪律.md`；MUST NOT 下调目标 |
| 自足册装不下适用于 Lean 的全部 MUST | H | 优先砍展开篇幅；仍装不下则记入报告提请调整范围，MUST NOT 删纪律 |
| Task 5 改写计数词时误伤 `§四条轴` 这类小节名 | M | 检查用字面匹配（`四条轴` 不含子串 `四轴`）；红线④保护交叉引用小节名 |
| Task 7 入口瘦身打掉 `install-and-doc-governance.test.mjs:487-488` 断言的两句话 | M | 该两句是工作区隔离门要点的一部分，MUST 保留；Step 5 的验证命令覆盖它 |
| 两条新检查互相判红 | M | 豁免规则三条（spec §4.3）；Task 5 Step 3 同时跑两条检查 |

## 替换清单核销（来自 spec §8.2）

| 被取代物 | 删除任务 | 实测引用数 | 核销 |
|---|---|---|---|
| `SKILL.md` 中「常驻 core 七篇」表述与七篇清单 | Task 7 | 待测 | ⏳ |
| `00-流程总纲.md` 的历史沿革论证段 | Task 6（移出非删除）| — | ⏳ |
| 非权威文件中的受检计数词 | Task 5 | 待逐文件统计 | ⏳ |
| `cards-mandatory.test.mjs:92-110` 常驻清单断言 | Task 7 | 1 | ⏳ |
| `cards-mandatory.test.mjs:267` 护栏词取值闸 | Task 5 | 1 | ⏳ |
| `doc-axis.test.mjs:80` 四轴断言 | Task 5 | 1 | ⏳ |
| `cards-mandatory.test.mjs:285` | **不删** | — | ✅ 永久保留（spec §8.2）|
| `路径-lean.md` 现有 37 行形态 | Task 9（原地扩写）| — | ⏳ |

## 完成与自动合并

- [ ] **代码评审门通过**：四轴子代理报告齐全，P0/P1 已清零
- [ ] **需求覆盖核销**：FR-001…FR-013 每条都有对应任务，每个任务都标了满足哪几条
- [ ] 替换清单逐条核销
- [ ] AC-001…AC-022 逐项达成
- [ ] `node --test test/*.test.mjs` 全绿
- [ ] worktree 状态干净，全部改动已提交
- [ ] 任务分支已吸收最新 `main` 并重新验证
- [ ] 自动合并到 `main` 并做合并后验证；成功后移除 worktree，失败保留现场
