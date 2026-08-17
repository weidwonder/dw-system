---
lifecycle: active
superseded_by: ''
archived: ''
last_confirmed: '2026-08-16'
authority_refs:
  - 'CLAUDE.md / AGENTS.md 标记块字段：collaboration / merge-gate / worktree-dir / mode 墓碑'
  - 'install.mjs 标记块解析与校验契约（getWorkflowMode / 迁移改写 / snippet 选择）'
  - 'skill 目录约定：references/collab/ 与 references/capability/'
  - 'config-snippets 文件名契约：base.md / collab-solo.md / collab-team.md'
  - '代码事实供给的判定方式：运行时资产探测'
  - 'ctx CLI 命令契约：init --minimal、probe 新题型'
---

# 项目真相源与 context-tier 重构 Coding Plan

> 依据 `docs/spec/2026-08-16-项目真相源与context-tier重构-eng-spec.md`（第三稿，兼容门已通过）。
> **本 plan 的交付物是方法论包本身**：多数任务改的是 skill markdown，没有传统单测，验收靠**可复现 grep + 内容契约逐条核对**；只有 `install.mjs` 与 `ctx` 有真测试，那两块严格走 TDD。
> 任务间信息只通过本 plan 的 **Interfaces** 传递，不依赖会话记忆。

**Goal:** 删除 `personal|team` 二分，改为「协作面显式声明 + 代码事实供给运行时探测」，并让任意项目可零上下文交接。
**Architecture:** 先落**新分册的内容契约**（T1，关键路径），其余任务按**文件独占**并行；`install.mjs` 与 `ctx` 两条链路与 markdown 完全解耦，可全程并行。
**Tech Stack:** 纯 Node.js ESM + markdown；零第三方依赖；`node --test`。
**Worktree:** `/Users/weidwonder/projects/ai_dev_system/.worktrees/context-tier`
**Task Branch:** `spec/context-tier`
**目标主分支:** `main`

---

## 文件独占矩阵（并行前必读）

**没有任何两个任务改同一个文件。** 派发并行子代理时，各代理 MUST 只碰自己 Files 节列出的路径；发现需要改别人的文件 → 记进"跨任务发现"回报，MUST NOT 直接改。

| 任务 | 独占文件 | 波次 | 依赖 |
|---|---|---|---|
| T1 | `references/collab/*`、`references/capability/*`、删 `personal/`+`company/` | A | — |
| T2 | `core/00-流程总纲.md` | B | T1 措辞 |
| T3 | `core/文档治理.md`、`core/worktree开发纪律.md` | B | T1 措辞 |
| T4 | `core/代码评审纪律.md`、`core/步骤-1-7-设计与实现.md` | B | T1 措辞 |
| T5 | `core/上下文卫生.md`、`core/路径-lean.md`、`core/spec写作纪律.md`、`core/bug诊断纪律.md`、`core/测试资产纪律.md`、`core/步骤-8-10-测试.md`、`references/环境冲突扫描.md` | B | T1 措辞 |
| T6 | 两个 `SKILL.md`、`ai-dev-workflow/references/init-初始化.md` | C | T1、T2、T7 |
| T7 | `assets/config-snippets/*` | C | T1 |
| T8 | `install.mjs`、`test/install-and-doc-governance.test.mjs`、新增安装器测试 | B | — |
| T9 | `scripts/ctx/src/{commands,cli,cards,semantic}.js`、`scripts/ctx/README.md`、`scripts/ctx/test/*`、`assets/context-layer/capability-registry.md` | B | — |
| T10 | `scripts/ctx/src/probe.js`、`scripts/ctx/test/probe.test.js`、`assets/context-layer/probe-set.md` | C | T9 的 `--minimal` 落地 |
| T11 | `ai-prd/references/*`（除 SKILL.md） | D | T1、T2 |
| T12 | `ai-dev-workflow/assets/templates/*`、`ai-prd/assets/templates/*` | D | T2、T3 |
| T13 | `CLAUDE.md`、`README*.md`、`docs/spec/2026-07-{06,14,16}-*`、`docs/spec/2026-08-{10,14}-*`、`docs/spec/2026-08-16-ctx*`、`docs/index*.md` | E | 全部 |
| T14 | `ai-dev-system/VERSION` | E | 全部 |
| **T15**（新增） | `core/资产补建信号.md`（新建）+ 回改 `core/{worktree开发纪律,00-流程总纲,bug诊断纪律,文档治理}.md` | D | T2–T5 完成后文件释放 |

### T15 的来由（plan 的真实缺口，T4 发现）

spec §4 是一套完整机制——**项目长大到出实际问题时主动建议补建资产**，正是用户对本次重构的明确要求（「规模涨到一定程度后 Agent 会主动提示」），且 §8.1 第 5 条拍板**直接启用**。但本 plan 把它拆散进了 T2/T3/T4/T5/T12，结果只有 T4 的残留轴记账真正落地，其余无人认领：**判定时机、bug 历史信号源、账本字段与状态机（阈值 2、拒绝抑制、指向分离）全部悬空，尤其状态机没有任何文件承载权威定义**。

T15 把权威定义集中到一个新的条件加载 core 文件，其余四处只留指针——分散定义必然漂移。这是拆任务时的判断失误，不是执行偏差。

> `ai-dev-system/migrations/2.0.0.md` 已在 spec 阶段落盘，T14 只做一致性复核，不重写。
> `ai-dev-system/migrations/*.md`（含 `1.10.0.md:5` 提到 `mode-team.md` 与旧术语）与 `docs/plan/` 历史计划**属历史记录，全任务 MUST NOT 改写**（spec §7.1）。

**并行纪律（矩阵的盲区，同样是硬要求，已两次实际踩中）**：多个代理共用这一个 worktree 与**同一个 git index**。

- `git add <具体路径>` **不够**。它只保证你不误加别人的**工作区**改动，但 `git commit` 提交的是**整个 index**——别人已经 `git add` 进暂存区的文件会被你的 commit 一起卷走。
- **MUST 用 only 模式**：`git commit -o <本任务的文件路径列表> -m "..."`（等价写法 `git commit <路径...> -m "..."`）。它只提交指定路径，绕开共享 index。
- **MUST NOT** `git add -A` / `git add .`。
- 已发生的两起（内容无丢失，仅 commit 边界混）：`71a5ebd` 卷入 T8 的三个文件；`9ae2316` 卷入 T5 的七个文件。**MUST NOT 事后 `git reset` 重写历史**——其他代理正在同一 worktree 工作，重写会让它们的 HEAD 失配。

**T1 执行结论（已完成，`434ca05`）**：§3.5 去向表 16 行中 7 行落地在新分册，9 行移交 core 侧任务（T2 收 3 行、T3 收 4 行、T5 收 1 行、T6/T7 收 1 行）。`collab/{solo,team}.md` §6 的边界表已建反向指针**指向 `core/00-流程总纲.md`**，T2 若把六条护栏落进其它 core 文件 MUST 回报以便同改。

---

### Task 1：新分册的内容契约（关键路径）

**Slice:** 两个旧外壳的每一条都在新结构里有确切落点，后续任务才有可引用的措辞。｜**依赖：** 无

**Files:**
- Create: `ai-dev-system/skills/ai-dev-workflow/references/collab/solo.md`
- Create: `ai-dev-system/skills/ai-dev-workflow/references/collab/team.md`
- Create: `ai-dev-system/skills/ai-dev-workflow/references/capability/graph.md`
- Create: `ai-dev-system/skills/ai-dev-workflow/references/capability/curated.md`
- Move: `references/company/context-engineering.md` → `references/capability/context-engineering.md`（`git mv`，保留历史）
- Delete: `references/personal/mode-personal.md`、`references/company/mode-team.md`，两个空目录

**Interfaces:**（后续任务 MUST 按此引用，不得自造）
- Produces — 加载条件措辞：`collab/solo.md`「无其他人类协作方时加载」；`collab/team.md`「存在其他人类协作方时加载」；`capability/graph.md`「探测到 `.codegraph/codegraph.db` 时加载」；`capability/curated.md`「探测到已填写的 `engineering-context/capability-registry.md` 时加载」
- Produces — 三个标准术语：**协作面**（solo / team）、**图谱位**、**权威位**。全仓统一，MUST NOT 出现"档位""等级""版本"等同义替换
- Produces — 各文件的一句话定位（供 SKILL.md 路由表引用）

- [ ] **Step 1: 按 spec §3.5 逐条去向表建表自查** — 把表里 16 行逐条列成清单，标注"本任务落地 / 移交 core（T2–T5）"。移交项写进任务回报，MUST NOT 自行改 core 文件
- [ ] **Step 2: 写 `capability/curated.md`** — 吸收 `mode-team.md:39-58`（ctx 调用方式含兜底、业务全景门限、cite 纪律、检索纪律、clone 决策树）+ `:60-65`（新鲜度、会话开始看增量）。**MUST 保留 `ctx` 找不到时的兜底调用方式与"绝不退回 grep"**（跨文件契约，见 CLAUDE.md §改动时注意）
- [ ] **Step 3: 写 `capability/graph.md`** — codegraph 的定位（现状代码事实：符号、调用链、影响面）+ **与权威位的分工**（graph 给现状、curated 给权威口径，不互相替代）+ **非硬依赖回退**：命令不可用时回退子 agent 重探索外包（`上下文卫生.md` 规则 4），MUST NOT 阻断、MUST NOT 退回无策略裸 grep（spec §6.4）
- [ ] **Step 4: 写 `collab/team.md`** — 吸收 `mode-team.md:8-13`（owner 对齐、评审会、业务方拍板）+ PR 平台动作 + 多仓合并协商 + 「兼容由业务方拍板」
- [ ] **Step 5: 写 `collab/solo.md`** — 吸收 `mode-personal.md:8`（可省 Step 2/3）+「兼容由你拍板」+ **`mode-personal.md:14` 的"没有同事帮你看，子代理是你唯一的第二双眼睛"MUST 保留**（否则 solo 项目容易把评审门读成可省）
- [ ] **Step 6: `git mv` context-engineering.md 并清理其中的旧术语** — 内容不动，只改术语与内部路径引用
- [ ] **Step 7: 删两个旧外壳与空目录**
- [ ] **Step 8: 验收** — Run: `grep -rn '个人版\|团队版\|mode="personal"' ai-dev-system/skills/ai-dev-workflow/references/{collab,capability}/` Expected: 零命中
- [ ] **Step 9: commit** — `refactor(skill): 新建 collab/ 与 capability/ 分册，删除 mode 外壳`

---

### Task 2：`00-流程总纲.md`

**Slice:** 分流与门表不再按 mode 说话。｜**依赖：** T1 的三个标准术语

**Files:** Modify: `references/core/00-流程总纲.md`（`:53-54` 默认假设、`:120-134` 整张裁剪对照表、门表、输入声明）

**Interfaces:**
- Consumes: T1 的术语与加载条件
- Produces: **分流默认假设的最终措辞**（T5 的 `路径-lean.md`、T11 的 ai-prd 流程 MUST 引用同一句）

- [ ] **Step 1: 改默认假设方向（`:53-54`）** — 由 mode 决定改为由能力位决定：**无能力位 → 默认 Lean；含权威位 → 影响面不清时宁可升级**（spec §8.1 第 2 条拍板：MUST NOT 读旧 `mode` 值）
- [ ] **Step 2: 拆解裁剪对照表（`:120-134`）** — 逐行判定归属：属协作的移入 `collab/`、属供给的移入 `capability/`、两者皆非的留 core 并去掉 mode 措辞。**整张表删除**，不保留"新旧对照"版本（§8.1 第 1 条：无过渡期）
- [ ] **Step 3: 吸收 `mode-personal.md:11-16` 六条"不裁剪"护栏** — 落进 core 常驻，**MUST 保留否定式措辞**（"轻量不等于可省"是它们的全部价值）
- [ ] **Step 4: 吸收"按仓拆 spec / 垂直切片"** — 泛化为"按边界拆"（仓 / 模块 / 限界上下文），与人数解耦
- [ ] **Step 5: 门表与输入声明去 mode 化**；兼容取舍门的"谁拍板"改为指向 `collab/`
- [ ] **Step 6: 验收** — 该文件 grep 旧术语零命中；四道门与十步结构未被破坏
- [ ] **Step 7: commit**

---

### Task 3：`文档治理.md` + `worktree开发纪律.md`

**Slice:** 索引分层与合并方式两条判据换轴。｜**依赖：** T1

**Files:** Modify: `references/core/文档治理.md`（`:66,73`）、`references/core/worktree开发纪律.md`（`:40-41`）

**Interfaces:**
- Produces: 索引分层触发阈值的最终措辞（T12 模板 frontmatter 说明引用）
- Produces: `merge-gate` 两个取值在纪律文里的措辞（T7 snippet 引用）

- [ ] **Step 1: 索引分层判据改为文档数量** — 由「团队版 MUST / 个人版 SHOULD」改为**现行区文档 >20 篇时 MUST，否则 SHOULD**（spec §3.4 第 2 条）
- [ ] **Step 2: 保留 `:73` 的"没有 index.md 时 MUST NOT 临时造一个"** — 与新判据不冲突，且 spec §3.4 明确"谁来创建"：初始化只**报告缺口不阻断**
- [ ] **Step 3: 三层真相源的 MUST 项写进文档治理** — 需求/架构/实现真相源可从 README 或 `docs/index.md` **≤2 跳到达**；缺口报告不阻断（spec §3.6）
- [ ] **Step 4: 合并方式改由 `merge-gate` 承载** — `direct` → 本地非快进合并；`pr` → 推送 + PR + 平台自动合并。**`:38` 的"无需再次询问用户，自动合并"MUST 原样保留**（完成门是非交互门，spec §4.2 的落点设计依赖它）
- [ ] **Step 5: 验收** — 两文件 grep 旧术语零命中；`node --test test/install-and-doc-governance.test.mjs` 若断言了旧措辞，记入跨任务发现交 T8
- [ ] **Step 6: commit**

---

### Task 4：`代码评审纪律.md` + `步骤-1-7-设计与实现.md`

**Slice:** 子代理 prompt 与 Overview 判据改用新字段。｜**依赖：** T1

**Files:** Modify: `references/core/代码评审纪律.md`（`:37` prompt 模板）、`references/core/步骤-1-7-设计与实现.md`

**Interfaces:** Consumes: T1 术语；Produces: 子代理 prompt 模板中的项目形态描述格式

- [ ] **Step 1: 改 `:37` 的 prompt 模板** — 硬编码的 `本项目 mode =【personal / team】` 改为 `本项目协作面 =【solo / team】，已启用能力位 =【图谱位 / 权威位 / 无】`。**这是数据模型引用不是文案**，子代理据此决定是否核对 cite
- [ ] **Step 2: 残留轴补一条** — 命中"改了非权威副本"时 MUST 记入 §4 的结果性信号账本（spec §4.1）
- [ ] **Step 3: Overview 必做/跳过判据换轴** — 由 mode 改为：跨边界数量 + 协作面。**纯协作语义，MUST NOT 与能力位挂钩**
- [ ] **Step 4: 验收 + commit**

---

### Task 5：core 其余 6 篇 + `环境冲突扫描.md`（机械改写）

**Slice:** core 剩余文件不再提 mode。｜**依赖：** T1、T2 的措辞

**Files:** Modify: `core/上下文卫生.md`(2)、`core/路径-lean.md`(1)、`core/spec写作纪律.md`(1)、`core/bug诊断纪律.md`(2)、`core/测试资产纪律.md`(1)、`core/步骤-8-10-测试.md`(2)、`references/环境冲突扫描.md`(3)

- [ ] **Step 1: 逐处替换** — 涉及协作的换 `collab` 措辞，涉及供给的换能力位措辞；**吃不准归属的不猜，记进跨任务发现**
- [ ] **Step 2: `上下文卫生.md` 额外吸收 memory 约定** — `mode-personal.md:28-34`（对团队同样成立）
- [ ] **Step 3: `路径-lean.md` 的默认假设引用 T2 Step 1 的同一句**，MUST NOT 自造
- [ ] **Step 4: 验收 + commit**

---

### Task 6：两个 `SKILL.md` + `init-初始化.md`

**Slice:** 路由逻辑真正按"探测 + 字段"走。｜**依赖：** T1（路径）、T2（门表）、T7（snippet 文件名）

**Files:** Modify: `ai-dev-workflow/SKILL.md`（`:49,70-71` + frontmatter `description`）、`ai-prd/SKILL.md`（`:32-34,38-39` + `description`）、`ai-dev-workflow/references/init-初始化.md`（8 处）

**Interfaces:** Consumes: T1 加载条件、T7 的 snippet 文件名

- [ ] **Step 1: 改 `ai-dev-workflow/SKILL.md` 路由为三步** — ①探测资产得能力位 ②读标记块得协作字段 ③加载 core + 命中的 `capability/` + 对应 `collab/`
- [ ] **Step 2: 两个 `description` 同步改写** — **`description` 决定 skill 触发，属行为契约变更**，改完 MUST 过 `docs/spec/2026-07-16-skill写作自检清单.md`
- [ ] **Step 3: 删除 `ai-prd/SKILL.md:33-34` 的临时询问分支** — 无标记块时改为"探测 + 协作面缺省 solo"，不再问（spec §6.2）
- [ ] **Step 4: `init-初始化.md` 重写提问** — 只问协作面；`merge-gate` 按 `git remote` + CI 配置给**建议**再由用户拍板；能力位**不问**（探测）；三层真相源缺口**报告不阻断**
- [ ] **Step 5: 首次唤起告知逻辑** — 从旧 `mode` 推断出协作字段时，MUST 一句话告知并允许当场改、幂等回写两个入口、**只告知一次**；文案 MUST NOT 出现旧术语（spec §8.3 三条边界）
- [ ] **Step 6: 软链接规则 MUST 原样保留**（`init-初始化.md` §入口是软链接时，与 `install.mjs` 两处同改）
- [ ] **Step 7: 验收 + commit**

---

### Task 7：config-snippets 重构

**Slice:** 注入目标项目的配置片段改为 base + collab 二段式。｜**依赖：** T1

**Files:** Create `base.md`、`collab-solo.md`、`collab-team.md`；Delete `personal.md`、`team.md`（均在 `assets/config-snippets/`）

**Interfaces:** Produces: **标记块的确切文本形态**（T6 注入、T8 解析、T13 文档描述三方 MUST 一致）

- [ ] **Step 1: 写 `base.md`** — 含标记块属性行 `(mode="team" collaboration="…" merge-gate="…" worktree-dir="./.worktrees/")` + 无条件条目（文档目录、生命周期、worktree、评审门、兼容门、测试资产、agentic-principle、业务语言）
- [ ] **Step 2: 能力位相关条目按探测结果动态写入还是不写？** — **不写进 snippet**（spec §3.5：探测结果写进静态配置必然漂移）。`ctx` 用法指引留在 `capability/curated.md`，由 skill 按探测加载
- [ ] **Step 3: 写两个 collab 片段** — 差异仅在：谁拍板兼容、是否 owner 对齐/评审会、合并动作
- [ ] **Step 4: 墓碑字段** — `mode="team"` 只在属性行，**正文 MUST NOT 出现"团队版"字样**（spec §8.3）
- [ ] **Step 5: 验收** — `grep -n 'mode="team"' assets/config-snippets/base.md` 命中 1 处且在属性行；`grep '个人版\|团队版' assets/config-snippets/` 零命中
- [ ] **Step 6: commit**

---

### Task 8：`install.mjs`（TDD）

**Slice:** 安装器能解析新块、改写旧块、处理四种混合状态。｜**依赖：** 无（与 markdown 解耦）

**Files:** Modify: `install.mjs`（`:382-385`、`:1032-1034`、`:1036-1038`、`:1216`）；Modify: `test/install-and-doc-governance.test.mjs`；Create: 新增迁移与探测测试

**Interfaces:** Consumes: T7 的标记块文本形态（未就绪时先按 spec §5 表实现，T7 完成后核对）

- [ ] **Step 1: 写失败测试** — 覆盖：①新块正常解析 ②旧 `mode="personal"` → `collaboration="solo"`/`merge-gate="direct"` ③旧 `mode="team"` → `team`/`pr` ④四种混合状态（新新/新旧/旧新/旧旧）⑤`collaboration` 值非法 → 报错中止 ⑥stamp <2.0.0 而块为新格式 → 显式报错 ⑦改写幂等
- [ ] **Step 2: 跑测试确认失败** — Run: `node --test test/` Expected: FAIL
- [ ] **Step 3: 实现** — `getWorkflowMode` 保留旧块识别 + 新增字段解析；校验放宽为"读不出**任何**已知字段才 throw"；snippet 选择改 `base.md` + `collab-${collaboration}.md`；迁移改写前打印前后对照
- [ ] **Step 4: 只映射协作维度** — 旧 `mode="team"` **MUST NOT** 推出任何能力位（spec §8.3 边界 1，本次拍板影响最大的一条，测试 MUST 断言）
- [ ] **Step 5: 跑测试确认通过** — Run: `node --test test/` Expected: PASS（新增测试 MUST 带 `--no-ctx-link --no-codegraph`）
- [ ] **Step 6: commit**

---

### Task 9：`ctx` 主体（TDD）

**Slice:** `ctx init --minimal` 让"三行 registry 起步"真的成立。｜**依赖：** 无

**Files:** Modify: `scripts/ctx/src/{commands,cli}.js`、`scripts/ctx/README.md`(`:119`)、`scripts/ctx/src/semantic.js`(`:6`)、`scripts/ctx/test/*`、`assets/context-layer/capability-registry.md`

- [ ] **Step 1: 写失败测试** — `init --minimal` 只生成 `capability-registry.md`；registry 只有 3 列时 `discover` 不报错；`freshness` 空列时输出标注"未声明新鲜度"
- [ ] **Step 2: 跑测试确认失败**
- [ ] **Step 3: 实现 `--minimal`** — 最小合法 schema MUST 保留 `Capability` / `权威实现` / `陷阱项` 三列，其余 MAY 空；空列跳过而非报错；**MUST NOT 假定新鲜**
- [ ] **Step 4: `commands.js:226` init stub 去旧术语** — 并同步 `assets/context-layer/capability-registry.md` 模板（两处漂移会让 `ctx init` 生成物与文档不一致）
- [ ] **Step 5: 改两处旧路径引用**（`README.md:119`、`semantic.js:6`）；**`cli.js` HELP 首行签名串 `Engineering Context CLI` MUST 原样保留**（`install.mjs` 靠它判定 ctx 归属）
- [ ] **Step 6: 跑测试** — Run: `cd ai-dev-system/skills/ai-dev-workflow/scripts/ctx && node --test` Expected: PASS
- [ ] **Step 7: commit**

---

### Task 10：`ctx probe` 零上下文交接题型（TDD）

**Slice:** 本重构的核心目标变成可机器验证。｜**依赖：** T9

**Files:** Modify: `scripts/ctx/src/probe.js`、`scripts/ctx/test/probe.test.js`、`assets/context-layer/probe-set.md`

- [ ] **Step 1: 写失败测试** — 四项可达性检查（需求真相源 ≤2 跳、架构真相源 ≤2 跳、实现真相源可用、`authority_refs` 非空）各自的通过/失败样本
- [ ] **Step 2: 跑测试确认失败**
- [ ] **Step 3: 实现四题型** — 全部机器可判定；**MUST 与现有探针共用 `authority_refs` 自防腐机制**；"实现真相源可用"按能力位分支（无能力位查路径存在 / 图谱位查索引 / 权威位查 `ctx list-services` 非空）
- [ ] **Step 4: 门禁自检不得被削弱** — 植入必错样本仍 MUST 被判错（`context-engineering.md` 防腐要求）
- [ ] **Step 5: 跑测试 + commit**

---

### Task 11：`ai-prd` references

**Slice:** PRD 侧同构改造。｜**依赖：** T1、T2

**Files:** Delete `ai-prd/references/mode-{personal,team}.md`；Create `ai-prd/references/collab/{solo,team}.md`；Modify `00-prd生成流程.md`(7)、`prd质量清单.md`(3)、`prd写作纪律.md`(2)、`业务语言纪律.md`(1)、`UI原型纪律.md`(1)

- [ ] **Step 1: 建 `collab/`，内容只保留"谁拍板 / 要不要评审会"这类协作差异**——PRD 侧**没有能力位概念**（PRD 不消费代码事实），MUST NOT 引入
- [ ] **Step 2: 逐处替换 14 处提及**
- [ ] **Step 3: UI 原型契约三处同改的另两处不属本任务**（`ai-dev-workflow/00-流程总纲.md` 属 T2、模板属 T12），有偏差记跨任务发现
- [ ] **Step 4: 验收 + commit**

---

### Task 12：模板（C 类）

**Slice:** 模板不再要求填 mode。｜**依赖：** T2、T3

**Files:** Modify `ai-dev-workflow/assets/templates/`: `eng-spec.md`(2)、`coding-plan.md`(2)、`test-spec.md`(2)、`overview.md`(1)、`lean-change-spec.md`(1)；`ai-prd/assets/templates/`: `change-prd.md`(2)、`lite-issue-prd.md`(1)、`question-bank.md`(1)

- [ ] **Step 1: 逐处替换**——模板里的"（团队版）xxx"改为"（协作面 = team 时）xxx"或直接删除条件
- [ ] **Step 2: `coding-plan.md` 完成清单第 79 行的"（团队版）PR…"改为按 `merge-gate`**
- [ ] **Step 3: frontmatter 五字段（`lifecycle`/`last_confirmed`/`authority_refs`）MUST 原样保留**——本次不动文档生命周期契约
- [ ] **Step 4: 验收 + commit**

---

### Task 13：仓库自身文档同步

**Slice:** 本仓库的说明与索引与新体系一致。｜**依赖：** T1–T12

**Files:** `CLAUDE.md`、`README_zh.md`、`README.md`、`docs/spec/2026-07-06-ai-dev-system-design.md`、`docs/spec/2026-07-06-ai-prd-design.md`、`docs/spec/2026-07-14-源头对齐基线与回灌机制.md`(`:29,40`)、`docs/spec/2026-08-14-codegraph…`、`docs/spec/2026-08-16-ctx全局命令安装…`、`docs/index.md`、`docs/index-archive.md`

- [ ] **Step 1: `CLAUDE.md` §架构 第 1、3 节重写**（mode-aware → 探测 + 协作字段）、§安装器的关键设计 补迁移改写、§改动时注意 的 codegraph 边界条按 spec §3.5 更新
- [ ] **Step 2: active spec 的旧路径与旧术语更新**——它们在 `docs/index.md` 现行区，**属本次触碰权威面**，MUST 按文档生命周期结算。已核实的命中位置：`CLAUDE.md:86,104,105,140`、`2026-07-06-ai-dev-system-design.md:52,54,126,168`、`2026-07-06-ai-prd-design.md:36,37,66`、`2026-07-14-源头对齐基线与回灌机制.md:29,40`、`2026-08-16-ctx全局命令安装…:29,38`
- [ ] **Step 2b（T1 发现的 plan 缺口，本 Files 节原先漏列）**: `docs/spec/2026-08-10-文档生命周期门控-lean-change-spec.md:20,83` 含 `mode-team.md` 路径引用。先判定它在 `docs/index.md` 现行区还是归档区：**现行 → 一并改写；已归档 → 按 §7.1 视为历史记录 MUST NOT 改写**。判定结果写进回报
- [ ] **Step 3: `docs/index.md` 加本 spec 与本 plan；确认 `docs/plan/` 两份历史计划已在 `index-archive.md` 标注归档**
- [ ] **Step 4: `docs/plan/` 与 `migrations/*.md` 的历史记录 MUST NOT 改写**（§7.1）
- [ ] **Step 5: 验收 + commit**

---

### Task 14：版本、验收与准出

**Slice:** 打包成 2.0.0。｜**依赖：** 全部

**Files:** `ai-dev-system/VERSION`

- [ ] **Step 1: 术语验收 grep ①** — Run: `grep -rn '个人版\|团队版\|mode="personal"' --include='*.md' --include='*.mjs' --include='*.js' . | grep -v '^./orgin' | grep -v '^./docs/plan/' | grep -v '^./ai-dev-system/migrations/'` Expected: **零命中**
- [ ] **Step 2: 术语验收 grep ②** — `mode="team"` 只在 `base.md` / `install.mjs` / `test/*` / `docs/spec/` 四类命中
- [ ] **Step 3: 全测试** — Run: `node --test test/` 与 `cd …/scripts/ctx && node --test` Expected: 全绿
- [ ] **Step 4: 端到端实装验证** — `./install.mjs <临时目录> --source-dir=. --no-ctx-link --no-codegraph`，再对一个含旧标记块的临时项目跑一次，确认迁移改写与前后对照打印
- [ ] **Step 5: `VERSION` → `2.0.0`**；复核 `migrations/2.0.0.md` 与最终实现一致
- [ ] **Step 6: 过 `docs/spec/2026-07-16-skill写作自检清单.md`**
- [ ] **Step 7: commit**；合入 main 后打 annotated tag `v2.0.0`

---

### Checkpoint

- **CP-1（T1 后）**：新分册措辞冻结，方可并行波次 B
- **CP-2（T2–T5、T8–T9 后）**：core 与两条 CLI 链路就绪，方可做 T6/T7/T10
- **CP-3（T13 前）**：skill 侧全部完成，术语 grep 在 `ai-dev-system/` 子树内已零命中
- **CP-4（准出）**：四道门——worktree ✅（已在 `.worktrees/context-tier`）、兼容门 ✅（2026-08-16 拍板）、代码评审门（三轴子代理）、完成与自动合并门

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| 并行代理改同一文件互相覆盖 | H | 文件独占矩阵；越界改动一律记"跨任务发现"回报 |
| 各代理自造术语，措辞漂移 | H | T1 冻结三个标准术语；T14 grep 只能查旧词、查不出新词不一致 → CP-3 人工抽查 |
| 六条"不裁剪"护栏在拆解中丢失 | H | T2 Step 3 显式吸收 + 保留否定式措辞；评审门忠实轴专项核对 |
| 旧 `mode="team"` 被顺手映射成权威位 | H | spec §8.3 边界 1；T8 Step 4 **测试断言** |
| `description` 改写影响 skill 触发 | M | T6 Step 2 过自检清单；实装验证 |
| 测试误动本机全局安装 | M | 新增安装器测试 MUST 带 `--no-ctx-link --no-codegraph`（CLAUDE.md 硬规定） |

## 替换清单核销（来自 spec §8.2）

| 被取代物 | 删除任务 | 实测引用数 | 核销 |
|---|---|---|---|
| `references/personal/mode-personal.md` | T1 | 待测 | ⏳ |
| `references/company/mode-team.md` | T1 | 待测 | ⏳ |
| `references/company/` 目录 | T1 | 待测 | ⏳ |
| `assets/config-snippets/{personal,team}.md` | T7 | 待测 | ⏳ |
| `ai-prd/references/mode-{personal,team}.md` | T11 | 待测 | ⏳ |
| `ai-prd` 无标记块时临时询问 mode 的分支 | T6 | 待测 | ⏳ |
| `00-流程总纲.md` 裁剪对照表 | T2 | 待测 | ⏳ |
| `文档治理.md` 按 mode 的索引分层判据 | T3 | 待测 | ⏳ |
| "个人版/团队版"运行时文案 | T1–T13 | 待测 | ⏳ **立即删除，无过渡期** |
| `mode` 的行为分流作用 | T6/T8 | 待测 | ⏳ 墓碑保留至 `3.0.0` |
| `install.mjs` mode 正则 | — | — | ⏳ 保留至 `3.0.0`（迁移未完成） |
| 旧 `mode` → `merge-gate` 推断映射 | — | — | ⏳ 保留至 `3.0.0`（§8.1 第 4 条拍板） |

## 完成与自动合并

- [ ] **代码评审门通过**：三轴（规范/忠实/残留）子代理报告齐全，P0/P1 清零
- [ ] 替换清单逐条核销：该删的引用数为 0 且已删，保留项带理由与到期日
- [ ] 需求范围、文档、代码和测试全部完成
- [ ] 任务分支已吸收最新 `main` 并重新验证
- [ ] worktree 状态干净，全部改动已提交
- [ ] 无需再次询问用户，自动合并 `main` 并运行合并后验证
- [ ] 合并成功后移除 worktree；失败则保留 worktree 和任务分支；**合入后打 tag `v2.0.0`**
