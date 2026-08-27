# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 这个仓库是什么

**这是一个 AI 辅助开发方法论的分发包**，不是一个应用。它交付两个 Claude Code / Codex 通用的 **skill** 加一个零依赖的 **CLI**（`ctx`），把需求逐层降解成"零上下文 AI agent 也能可靠执行"的任务：

- `ai-prd` —— 从零**产出 PRD**（批量提问 + 阶段化 elicitation），补 workflow 的前置空缺。
- `ai-dev-workflow` —— 从**已有 PRD** 起步，走 Triage → Overview → Spec → Coding Plan → 测试。

`ai-prd` 的产物正是 `ai-dev-workflow` Step 1 的输入，两者松耦合。

核心信念（贯穿全部设计）：AI coding 能否落地，秘密不在流程本身，而在**能不能给 AI 一层可信、新鲜、权威的代码事实**——`engineering-context/` 代码事实层正是为此而生，**装了本体系的项目一律必备**。

> `orgin/` 与 `orgin.bak/` 是朋友公司的原始体系，被 `.gitignore` 忽略，**勿推送、勿作为交付的一部分**。它们只是本体系的裁剪来源参考。

## 常用命令

```bash
# ctx CLI 的单元测试（Node 内置 test runner，零第三方依赖，需 Node ≥20）
# 测试与 fixtures 住在仓库根 test/，不随 skill 分发进目标项目
node --test test/ctx-*.test.mjs

# 跑单个测试文件
node --test test/ctx-cli.test.mjs

# 直接运行 ctx CLI（无需 install）
node ai-dev-system/skills/ai-dev-workflow/scripts/ctx/src/cli.js <命令>

# 把 GitHub 发布源的 skill 安装进某个目标项目（需要 Node.js 与 Git）
npx --yes github:weidwonder/ai-dev-system <目标项目目录>
./install.mjs <目标项目目录>
./install.mjs <目标项目目录> --dry-run  # 预演，不落盘
./install.mjs <目标项目目录> --ref=<分支或标签>

# 仅测试当前工作区尚未发布的 skill
./install.mjs <目标项目目录> --source-dir=.

# 验证 npm 命令入口（会打包到临时目录并真实执行 --help）
node --test test/npm-entrypoint.test.mjs

# 全部测试（安装器 + ctx，一条命令跑完）
# 必须写通配符：Node ≥22 下 `node --test test/` 会把目录当模块解析，报 MODULE_NOT_FOUND
node --test test/*.test.mjs
```

没有 build 步骤、没有 lint 配置、没有 npm 运行时依赖——整个包是纯 Node.js ESM + markdown；安装器额外调用 Git 获取发布源。

## 架构：三层 + 一条铁律

**交付单元是 `ai-dev-system/skills/` 下的两个 skill（`ai-prd` + `ai-dev-workflow`）。** 二者共享同一套约定（同一份路由三步、references+assets 结构、复用 `ai-dev-workflow` 的标记块），也各带一个零第三方依赖的 Node CLI（`ai-dev-workflow` 带 `ctx`，`ai-prd` 带原型工具 `preview.mjs`）。`ai-prd` 是 workflow 的前置产 PRD 阶段，结构见 `ai-dev-system/skills/ai-prd/`（`SKILL.md` + `references/` + `assets/` + `scripts/preview.mjs`）。下文以 `ai-dev-workflow` 为主展开，抓三点：

### 1. 一层必备地基 + 两个可变维度 + 渐进式披露的加载模型（`SKILL.md` 是入口）

**常驻只有六份**：入口 `SKILL.md` + `references/core/` 的 `00-流程总纲.md`、`代码事实纪律.md`、`用户沟通纪律.md`、`上下文卫生.md` + `references/collab/{solo,team}.md` 二选一——但**这六份分两批取**，不是唤起时一次读完：**分流前只取三份**（入口 + `用户沟通纪律.md` + `00-流程总纲.md` §Step 0），余下三份与总纲其余各节 MUST 等 Triage 定了分支之后**只补该支要的**。判据是"路由到 Triage 之间用不用得上"：路由第 2 步要问协作面、隔离门过不了要中止，都要用业务语言，所以 `用户沟通纪律.md` 在分流前；取代码事实、上下文交接都发生在分流之后，且 **Lean 分支走自足册的投影、这两篇一份都不取**。**其余判据一份都不预先加载**，按住在入口的〈加载点清单〉在各自触发点到来时才取、且只取那一节（见下文「渐进式披露」）。常驻六份里的 `代码事实纪律.md` 立的是**地基**：**装了本体系的项目一律维护 `engineering-context/` 代码事实层**（registry + cards），不分项目大小、不分协作面、没有开关——初始化建骨架，之后"要用某个模块的事实就先查卡片；没有卡片就读源码，读完当场把卡片补上"。它**不参与路由判断**：registry 里有没有条目、卡片建了几张，都不改变本次加载什么、走哪条分流。

在地基之上只有两件事**可变**。每次调用先走**路由逻辑**（见 `SKILL.md` §路由逻辑），三步：

1. **探测代码图谱**——**项目根**下 `.codegraph/codegraph.db` 存在 → 加载 `references/capability/graph.md`（回答「找得到吗」：符号、调用链、影响面）。它只是**检索加速面**，不改变任何流程判据；探测不到（或探测本身失败）就按没有算，把重探索外包给子代理，MUST NOT 阻断流程。**本步 MUST NOT 探测 `engineering-context`**——它是必备资产，不是可选开关。
2. **读协作面**——目标项目根 `CLAUDE.md`（优先）或 `AGENTS.md` 里的 `<!-- ai-dev-workflow:start --> … collaboration="solo|team" merge-gate="direct|pr" worktree-dir="./.worktrees/" … <!-- ai-dev-workflow:end -->` 标记块。**无标记块** → 初始化（`references/init-初始化.md`）：只问一个问题（除你之外还有没有人一起开发）+ 一条待拍板的 merge-gate 建议；**代码图谱不问**（探测得出），**代码事实层也不问**（必备资产，第 5b 步在 worktree 内跑 `ctx init` 直接建骨架）。
3. **加载**——**分流前只取三份**（入口 + `用户沟通纪律.md` + `00-流程总纲.md` §Step 0）+ 探测到代码图谱时加 `references/capability/graph.md`（可零篇）；过隔离门、按 §Step 0 过 Triage 之后再按分支补：**Lean 分支**取 §默认倾向 → `路径-lean.md` 前置节 + `collab/` 一份 + lean spec 模板，**MUST NOT 再补余下三份常驻**（自足册就是它们在 Lean 场景的投影，补了等于同一批判据加载两遍）；**完整分支**才补齐 `代码事实纪律.md`、`上下文卫生.md`、`collab/` 一份与总纲其余前置节。**每一份也不整篇读**：`00-流程总纲.md` 与 `代码事实纪律.md` 每个小节标题下都有一行 `> **何时读本节**`，取值只有两类——**前置**（该份被取到时立即读完）与**触发式**（触发点到了才读，条件写在该节自己那一行）；MUST NOT 因为"反正在同一个文件里"就整篇预读。其余判据一律按加载点清单取；要动 `engineering-context` 的**结构**（设计 registry 字段 / 画场景蓝图 / 维护探针集）时才另读 `references/core/engineering-context设计.md`；日常补一张卡片不用读它。

**渐进式披露：判据在它真正要用的那一刻才取**（2.5.0 的核心）。载体是 `SKILL.md` 里的〈**加载点清单**〉——**18 行**，每行四个 REQUIRED 字段：`触发条件` / `加载对象` / `为什么此刻需要` / `适用路径`（`Lean` / `完整` / `两条`）。行的**稳定标识是触发条件文本本身**，MUST NOT 拿行序号当稳定标识引用（增行会让序号漂，且会造出与 `FR-###` 混淆的第三套编号）。每行 MUST 同时满足三条判据：**①触发条件说得出"什么时候"**（MUST NOT 写"可能会用到"）；**②加载单元最小**（能按小节取的 MUST NOT 写整篇）；**③说得出为什么此刻需要**——写不出理由的行说明那次加载压根不该发生，MUST 删掉那次加载，MUST NOT 补一个理由把它塞进清单。18 行是**下限不是上限**：每新判出一个触发式小节，清单 MUST 增一行或并进已有行的「加载对象」列。

判某一节归哪儿有一套固定顺序（**判据分配算法**，权威定义在 `docs/spec/2026-08-23-渐进式披露与需求追溯-eng-spec.md` §4.1）：**路由到 Triage 之间就要用 → 归入口**（此刻手里没有别的文件）；**每一步都要用、与走哪条路径哪道门无关 → 整篇归常驻**；**适用于 Lean → 要点进 Lean 自足册**（Lean 不读常驻篇也不读总纲）；**有明确触发点 → 进加载点清单**；四步都不成立的小节没有存在理由，MUST 报为设计缺陷、MUST NOT 塞进常驻兜底。据此 `文档治理.md`、`spec写作纪律.md`、`worktree开发纪律.md` 三篇**已移出常驻**：文件仍在，**移出 ≠ 删除**，结论行（落文档的目录与 frontmatter 两字段 / 写字的三条硬规则 / 两道 worktree 门最易漏的两项）留在 `00-流程总纲.md` §移出常驻的三篇，整篇按加载点触发时才取。`worktree开发纪律.md` 的 §工作区隔离门**要点另有一份在入口**——那道门在 Triage 之前，那一刻手里只有 `SKILL.md`。

三个量化契约：**常驻前置量 ≤ 50,000 字节**；**入口 `SKILL.md` ≤ 8,000 字节**；加载点清单 ≥ 18 行。前置量**由 `node --test test/resident-budget.test.mjs` 计算并断言 ≤ 50,000**，切段算法写在该文件顶部注释，**当前值以该命令的输出为准**（它无论绿红都打印逐文件明细）——本文、spec、报告一律 **MUST NOT 再抄一个数**：同一个量此前被四处各自手算，得出四个互不相同的值，差异全部来自切段粒度而不是文件本身。口径限定：这个量是**按各小节 `> **何时读本节**` 标注取出的「前置」节字节合计**，与六份文件 `wc -c` 的**整篇合计**（量级 6 万余字节，同由该测试打印）**不是一回事**，MUST NOT 拿整篇合计去比门槛——常驻六份没有任何一次真实加载会读完整篇。改造前九篇整篇常驻是 108,003 字节，可直接与本门槛比：那时还没有按节加载，前置量与整篇量同值。压不下去时 MUST 扩大拆分范围（下一顺位是把 `代码事实纪律.md` 拆成常驻要点 + 延后细则），**MUST NOT 下调目标值**。

**为什么一个探测、一个设字段**：判据是"**探测得出来的不设字段，探测不出来的才设字段**"。索引是文件系统里的客观事实，写成配置就会漂移——项目长大、索引被删，配置都不会自己变，于是要再造升档/降档/一致性校验三套装置去对抗自己造出来的漂移；探测的结论永远与项目当下状态一致。而"除你之外有没有人一起开发"文件系统里没有，只能问一次并固化。**代码事实层既不探测也不设字段**——它是必备的，压根没有"启不启用"这个问题需要判定。

**为什么取消分档**（这是 2.1.0 重构的由来）：2.0.0 用一个探测开关决定要不要维护卡片——registry 里没有真数据行就判定"这个项目还没有资产"，于是允许直读源码、分流默认走 Lean，卡片靠"攒够返工信号才建议补建"。**分档的判据永远滞后于项目实际风险**：一个人维护的十万行遗留系统正因为一张卡片都没有，被判成"没有资产 → 默认走 Lean → 直接 grep 旧代码"——那恰恰是本体系最初要消灭的失败模式，而它出问题时才会显形，显形时已经改错了。2.1.0 取消这个选择：**卡片是地基，不是升级项**——"什么时候该建资产"这个判断题不复存在，为它服务的那套信号累计与补建建议机制也随之整体删除。剩下的两个维度仍**互不蕴含**：协作面只管人怎么协作，代码图谱只管检索快不快，谁也 MUST NOT 推出谁。

初始化的幂等规则很关键：**只替换标记块内内容，绝不重复追加**；标记用 HTML 注释，机器可精确定位、对 markdown 渲染无影响。注入片段由 `assets/config-snippets/base.md`（无条件）+ `collab-{solo,team}.md`（二选一）拼装，`CLAUDE.md` **和** `AGENTS.md` 两个都写（兼容 Claude Code + Codex）。块里还留着 `mode="team"` 是**墓碑**：新 skill 完全忽略它，留着只为让尚未升级的旧 skill 不硬失败，`3.0.0` 移除；只有块内没有 `collaboration` 时才用旧值推协作面（team → team+pr，其余 → solo+direct），**MUST NOT 由旧值推出别的任何东西**——代码图谱只认运行时探测，分流默认倾向由总纲无条件定义。

### 2. 流程内核（`references/core/00-流程总纲.md`）

技术栈无关的 10 步流程 + Step 0 Triage 分流：

- **Triage 的 4 个判定问题**（AI/LLM 行为？鉴权安全设备？跨服务/迁移/不可逆？指标/业务规则/对外承诺？）——4 项全否走一页 **Lean Change Spec** 直接实现；任一为是升级回完整流程。
- **Lean 路径读的是自足册**：`references/core/路径-lean.md` 是一册**自足**的判据书（Triage 复核 → 四道门 → 取代码事实 → 写 spec → 实现 → 评审 → 文档落位 → 护栏 → 顺序速查），Lean 全程**只读它 + 协作面分册一份 + `lean-change-spec.md` 模板**，不读任何常驻篇、也不读总纲。它本身也按节加载（§0.3 列出前置节，其余触发式）。因此它 MUST 自带每一条适用于 Lean 的 MUST，漏抄一条 Lean 就会在没有判据的情况下把改动做完且零报错——机器闸见 §改动时注意 的自足册契约。
- 四问都不触发时还有个**默认倾向**，它**无条件适用于所有项目**，MUST NOT 由协作面、项目大小或有没有代码图谱来改变：**影响面说不清时 MUST 升级到完整流程出 Overview，说得清才走 Lean**。"说不清"的四条判据在 `references/core/00-流程总纲.md` §默认倾向：①本次要改的能力在 registry 里跨 ≥2 个权威仓库、②`ctx discover` 给出 out-of-scope 警告（这两条 Triage 当场逐条过）、③关键事实里有任何一条**给不出出处**（卡片 cite 或 `文件:行`）、④卡片与 `discover`、`search-semantic` 都收不窄且**读完源码仍说不清模块边界**（这两条回溯触发，Step 1 进行中命中即当场升级）。后两条 MUST NOT 被读成"卡片里查不到就算说不清"——查不到的正确处置是读源码 + 当场补卡，补完就有出处。跨仓需求一律升级。
- 含 AI/LLM 功能时，在基础 spec 上**叠加** `references/core/AI-LLM-overlay.md` 的 AI 契约（判定边界见该文件）。判定为 **Agentic 应用**时另需加载**独立技能 `agentic-principle`**（见下）。
- 所有文档遵循 `references/core/spec写作纪律.md`：零上下文可动手、RFC2119、无占位符。该篇**不常驻**——这三条结论行在总纲 §移出常驻的三篇，整篇在"动笔写 spec"与"要交接"这两个加载点才取。
- spec 的每条需求编 `FR-###`、每条验收项编 `AC-###`，贯通 spec → coding plan → 评审门 → test-spec 四个落点（判据见 §改动时注意 的需求编号契约）。
- 10 步之外还有**四道贯穿两条路径的门**（Lean 也不豁免）：worktree 隔离门 → 兼容取舍确认门（spec 定稿前，用户逐条拍板是否向后兼容）→ 代码评审门（编码后，子代理按 `代码评审纪律.md` §四条轴 分轴跑规范/忠实/残留/文档）→ 完成与自动合并门。门的位置见总纲流程总览图；**总纲只留"照着做就不会错"的判据，每条判据当初为什么这么定在 `docs/spec/2026-08-23-流程总纲历史沿革.md`**——改总纲某条判据前先看它当初要挡的是什么，改小节名时同步改沿革文档的交叉引用。

### 3. 必备的 Engineering Context 代码事实层 + `ctx` CLI（本仓库的技术核心）

**任何项目**都禁止 grep 旧代码找权威实体：未限定单仓时先 `ctx find-scenes <关键词>` 取端到端全景，再 `ctx discover "<意图>"` 按结果读 card，**每条来自 card 的事实必须附 cite（path#anchor @确认时间），无 cite 视为幻觉**。查不到**不等于**"这个项目不用卡片"，只意味着这个模块的卡片还没建：读源码（有代码图谱走图谱，没有就把重探索外包给子代理）+ **读完当场补卡**，随本次任务分支提交，MUST NOT 顺延。判据在常驻的 `references/core/代码事实纪律.md`（常驻但**按节**：§0/§1/§3/§4 含 §4.1/§4.2、§5/§6/§9 与结尾〈一句话〉是前置，§2 调用方式、§7 clone 决策树、§8 新鲜度 是触发式，各自的触发点在加载点清单里）。这一层与协作面、与有没有代码图谱都无关。

`ctx` CLI（`scripts/ctx/`）读本地 `engineering-context/` 目录（初始化时在 worktree 内跑 `ctx init` 生成**整套骨架**；`--minimal` 只落一份 `capability-registry.md`，命令仍在、但**不是推荐路径**——卡片目录要从第一天就在，否则第一次补卡的 agent 还得先决定目录放哪），三层清晰分离：

- `src/cards.js` — 纯读取/解析层：`splitSections`（按 `## 标题` 切段）、`loadCards`（`cards/<repo>.md`，文件名即 service 名）、`loadRegistry`（解析 `capability-registry.md` 的 markdown 表格，取表头首列含 `Capability` 的那张表；**列按表头名映射，不按列序**——registry 的最小合法形态只有三列，缺列跳过不报错，模板占位行 `【…】` 不算已登记）、`makeCite`。
- `src/commands.js` — 命令/匹配层：`discover`（关键词 tokenize + 命中打分，**结果分两路**：registry 直接命中的能力条目 + card 命中，registry 中指向某 card 的能力命中时给该 card 加权）、`getCard`、`findScenes`、`listServices`、`initScaffold`（`--minimal` 只生成 registry，其余生成整套骨架）。
- `src/cli.js` — argv 解析 + 路由 + 人类/`--json` 双输出。
- `src/semantic.js` — `search-semantic`：零依赖本地向量相似（字符 bigram 余弦 + 可选 synonyms）；结果带 freshness/cite + 权威指针，`--as-of` 启用过期降权。是 discover 未命中时的兜底。
- `src/probe.js` — `probe`：Frozen Probe Set 防腐门禁，机器可判题型 + 门禁自检（植入必错样本）+ 棘轮（新增失败 RED / 基线内 AMBER）+ 衰减报告；`--json` 退出码供 CI（RED/GATE-BROKEN=1）。题型分两类：**A 类**读 cards/registry（`capability-mapping` / `deprecated-trap`）；**B 类**读项目自身文件，是"零上下文交接"目标的可验证形式（`requirement-reachable` / `architecture-reachable` / `implementation-usable` / `rationale-traceable`——真相源从入口文档 ≤2 跳可达、架构节列出的模块路径都存在、索引现行区各 spec 的 `authority_refs` 非空）。B 类不依赖 context 层，所以直读项目也能有真门禁；自检会额外植入一道指向不存在真相源的必错交接题。

**跨平台是硬约束**：全程用 `node:path`、UTF-8、`os.tmpdir()`，无 bash-only 语法，零第三方依赖。改 `ctx` 时必须保持这些。

**Engineering Context 的真相方向铁律**（改任何 context 层相关内容前必读 `references/core/engineering-context设计.md` §3）：**card 事实以合入后的源码为准，绝不能从 PRD 生成 card 事实**（PRD 描述意图，意图常与已落地事实背离）。新鲜度**按是否触碰 Authority Surface 触发，而非变更行数**（3 行的路由 V1→V2 必须刷，2000 行内部功能不碰接口可不刷）。

## 目录速查

```
install.mjs / install.cmd          安装器：拉取 GitHub 发布源 + 安装 skills + 项目级冲突约束 + ctx 全局链接 + codegraph 保新/接线/建索引
docs/{spec,plan,report}/           本体系自身的规范 / 计划 / 报告
ai-dev-system/skills/ai-prd/        产 PRD skill：批量提问 elicitation + 三类模板
  SKILL.md                         入口：探测代码图谱 → 读协作面 → PRD 类型分流 → 4 批提问驱动
  references/                      PRD 流程 / 业务语言纪律 / 写作纪律 / UI 原型纪律 / 质量清单 / 复核纪律
  references/collab/               solo.md / team.md（按协作面二选一）
  assets/templates/                change-prd（主）/ lite-issue-prd / product-prd（需求真相源主文档）/
                                   requirements-module（一级子模块）/ todo / ui-prototype
  scripts/preview.mjs              原型工具（零依赖）：init / screen / slot 建原型与改稿、
                                   check 交付前结构自检、annotations 取批注、serve 起预览服务
ai-dev-system/skills/ai-dev-workflow/
  SKILL.md                         skill 入口（常驻，≤8,000 字节）：工作区隔离门要点 + 路由三步
                                   （探测代码图谱 / 读协作面 / 加载）+ 初始化 + 〈加载点清单〉18 行
  references/core/                 判据分册，按加载点取用：
    00-流程总纲.md                 骨架（常驻，按节）：流程总览 + 门表 + Triage + 步骤索引 +
                                   护栏 + 移出常驻三篇的结论行（前置）；默认倾向 / 三道门的细节节 /
                                   按边界拆四节（触发式）
    代码事实纪律.md                常驻，按节：先查卡片 / 没卡就读源码并当场补卡 / cite（前置）；
                                   §2 调用方式 / §7 clone / §8 新鲜度（触发式）
    用户沟通纪律.md / 上下文卫生.md  常驻（整篇）
    路径-lean.md                   Lean 自足册：Lean 路径只读它 + 协作面分册 + lean spec 模板
    步骤-1-7-*.md / 步骤-8-10-*.md  完整流程分册，按阶段加载
    文档治理.md / spec写作纪律.md / worktree开发纪律.md   已移出常驻，结论行在总纲，按加载点取整篇
    其余                           条件加载纪律（AI overlay / bug 诊断 / 代码评审 / 测试资产 /
                                   文档归档与账本收敛 / engineering-context设计）
  references/collab/               solo.md / team.md（按 collaboration 字段二选一，必加载一份）
  references/capability/           graph.md（探测到 .codegraph/codegraph.db 时加载，可零篇）
  references/init-初始化.md         幂等写入 CLAUDE.md/AGENTS.md + 建 engineering-context 骨架的规则
  assets/templates/                spec/plan/test/overview/lean-change-spec/test-coverage 模板
  assets/config-snippets/          注入 CLAUDE.md/AGENTS.md 的片段：base（无条件）+ collab-solo/collab-team
  assets/context-layer/            capability-registry/card/scene-blueprint/probe-set/glossary 模板
  scripts/ctx/                     ctx CLI（只有 src/：测试与 fixtures 在仓库根 test/，不随 skill 分发）
```

同一批路径的可点形式（上面的树给人看，下面这份给机器抽——`ctx probe` 的 `implementation-usable` 只认反引号代码片段与相对链接，抽不到路径直接判失败）：

- 安装器与其测试：`install.mjs`、`install.cmd`、`test/`
- 本体系自身文档：`docs/spec/`、`docs/plan/`、`docs/report/`，索引 `docs/index.md` 与 `docs/index-archive.md`
- 版本与迁移：`ai-dev-system/VERSION`、`ai-dev-system/migrations/`
- 两个 skill 的入口：`ai-dev-system/skills/ai-prd/SKILL.md`、`ai-dev-system/skills/ai-dev-workflow/SKILL.md`
- 流程内核与骨架：`ai-dev-system/skills/ai-dev-workflow/references/core/`、`ai-dev-system/skills/ai-dev-workflow/references/core/00-流程总纲.md`，其立论依据在 `docs/spec/2026-08-23-流程总纲历史沿革.md`
- Lean 自足册：`ai-dev-system/skills/ai-dev-workflow/references/core/路径-lean.md`
- 必备的代码事实层纪律：`ai-dev-system/skills/ai-dev-workflow/references/core/代码事实纪律.md`、`ai-dev-system/skills/ai-dev-workflow/references/core/engineering-context设计.md`
- 两个可变维度的分册：`ai-dev-system/skills/ai-dev-workflow/references/collab/`（协作面，必选一份）、`ai-dev-system/skills/ai-dev-workflow/references/capability/`（代码图谱，探测到才加载）
- 模板与注入片段：`ai-dev-system/skills/ai-dev-workflow/assets/templates/`、`ai-dev-system/skills/ai-dev-workflow/assets/config-snippets/`、`ai-dev-system/skills/ai-dev-workflow/assets/context-layer/`
- `ctx` CLI 本体：`ai-dev-system/skills/ai-dev-workflow/scripts/ctx/src/cli.js`
- `ai-prd` 的原型工具：`ai-dev-system/skills/ai-prd/scripts/preview.mjs`

## 安装器的关键设计（`install.mjs`）

默认安装源是 `https://github.com/weidwonder/ai-dev-system.git`，默认 `--ref` **不是 `main`，而是安装器自带的 `ai-dev-system/VERSION` 对应的 tag**（`v<版本>`）——npx 拉到哪个版本的 `install.mjs`，就默认装哪个版本的 skill，包版本与技能源版本因此绑定。为此 `package.json` 的 `files` 必须带上 `ai-dev-system/VERSION`（`install.mjs` 按自身所在目录的相对路径读它，npm 包与 git 检出下同一条路径都成立）；读不到就退回 `main`。两条不对称的失败语义：**默认推出的 tag 取不到时告警并回退 `main`**（覆盖 VERSION 已 bump 而 tag 未推的窗口期，MUST NOT 静默），**用户显式传的 `--ref` 取不到时硬失败**（非零退出码，MUST NOT 回退成别的版本）。README 推荐命令用 `git+https://…` 而非 `github:owner/repo` 简写——后者走 codeload tarball，已知 Windows + npm 12 下 404。改这条链路要同改 `install.mjs`（`SELF_VERSION` / `DEFAULT_REF` / `FALLBACK_REF` / `acquireSource`）、`package.json` 的 `files`、两个 README 的安装节，并跑 `node --test test/npm-entrypoint.test.mjs`。安装后会在目标项目 `.gitignore` 幂等追加标记块（`# ai-dev-system:gitignore:start/end`），按 skill 名逐条忽略 `.claude/skills/<name>/`、`.agents/skills/<name>/` 与版本 stamp，避免本体系随目标仓库提交，且不误伤用户自己的 skill。安装器先把 `--repo` / `--ref` 指定的版本拉到系统临时目录，确认其中存在有效 skill 后，才读取并修改目标项目；下载或源校验失败时目标项目保持不变，临时目录在成功、取消、预演和异常场景都会清理。`--source-dir` 仅用于验证当前工作区未发布内容，不是正式安装路径。

装 skill 时会在**目标项目级** settings 里把 4 个 Claude Code 冲突插件（`superpowers`、`everything-claude-code`、`oh-my-claudecode`、`general-task`）设为 `false`——它们的 brainstorming HARD-GATE、强制前置 skill、端到端引擎、SessionStart 注入会截胡本流程。原理：Claude Code settings 优先级 `Managed > Local > Project > User`，项目级 `false` 覆盖用户级 `true`，于是**只在本项目禁用，不影响全局**。默认写 `.claude/settings.local.json`（gitignored），`--shared` 才写 `.claude/settings.json`。合并时**不覆盖** `enabledPlugins` 里的其他键。

`CLAUDE.md` / `AGENTS.md` 允许是软链接（两个工具共用一份指导文件的常见做法）：安装器逐层解析到实体文件再按标记块写入，链接本身保留；两个入口解析到同一实体时只写一次；断链在复制任何 skill 之前就报错退出，目标项目零改动；全局卸载分支也不删作为入口的链接。skill 侧的同一套规则在 `ai-dev-workflow/references/init-初始化.md` §入口是软链接时，改一处要两处同改。

**标记块的迁移改写**（2.0.0 起）：旧安装的块里只有 `mode="personal|team"`，安装器把它就地改写成新字段（`collaboration` / `merge-gate` / `worktree-dir`），并在改写**前**打印「旧：… / 新：…」前后对照（`--dry-run` 也打印），逐条说明协作面与合并方式是**推断**出来的、不对就改这一行，以及**代码事实的供给方式不由这份声明决定**——代码事实层是必备资产、与这份声明无关，代码图谱则在每次唤起时探测得出。旧 `mode` 只映射协作面（`team` → team + pr，其余 → solo + direct），**绝不由它推出别的任何东西**（否则等于把已废弃的二分从数据里复活）。`mode="team"` 仍会被写回，那是给尚未升级的旧 skill 认的墓碑，`3.0.0` 移除。两个入口的四种混合状态一律**以 `CLAUDE.md` 为准**：两边都新 / 两边都旧 / `CLAUDE.md` 新而 `AGENTS.md` 旧 / `CLAUDE.md` 旧而 `AGENTS.md` 新——最后一种也按 `CLAUDE.md` 解析，随即被同一次迁移改写补成新字段，再幂等同步到另一个入口；有块却读不出任何已知字段就报错中止（宁可停，不猜）。还有一条反向的 **stamp 比对**：块已是新格式、而目标 skills 目录的版本 stamp 低于新字段起始版本（`WORKFLOW_FIELD_MIN_VERSION = 2.0.0`）时显式警告"skill 版本落后于配置"并提示每个协作者各自重跑一次（配置入库、skill 不入库，这种落后是多人项目的常态），不静默继续。

skill 复制完成后，安装器把 skill 自带的 **`ctx` CLI 链接成全局命令**：在 `<目标>/.claude/skills/ai-dev-workflow/scripts/ctx` 下 `npm link`（只用 `.claude/` 这一份，`.agents/` 是逐字节相同的副本，两份都 link 只会互相覆盖同一个全局命令），随后**实跑 `ctx --help` 并匹配签名串**才报成功——`npm link` 退出码为 0 只说明 shim 写出去了，不代表它落在 PATH 上、也不代表跑起来是我们这一个。做这件事的原因是：skill 文档通篇写 `ctx <命令>`，而此前安装器对 ctx 毫无处理，`which ctx` 为空会让使用者（尤其是 AI agent）把"命令找不到"误读成"Engineering Context 不可用"，退化成裸 grep——那正是任何项目里都明令禁止的行为。失败一律只降级为警告，并打印 `node <skill>/scripts/ctx/src/cli.js <命令>` 兜底方式：link 失败 / 链完仍不在 PATH / PATH 上已有**别人的**同名 `ctx`（此时跳过链接，**绝不覆盖**别人的命令）。还有一类只在 **Windows** 上必现——全局命令目录里已有上次安装留下的 `ctx` 文件时 `npm link` 报 **EEXIST** 拒绝覆盖（unix 侧 npm 直接替换自己的符号链接，撞不出这条），换项目重装或删过旧项目的机器每次都会撞上。因此 `npm link` 的输出 MUST 捕获（失败时回显 npm 原文）：读出 EEXIST 才分得开"目录没有写权限"与"就冲突这一个文件"，后者照原文案让用户重试同一条命令必然再失败。撞到 EEXIST 时先判**归属**——PATH 上那个跑得通且签名匹配，或 `npm root -g` 下的 `ctx` 包认得出是本体系的（符号链接目标含 `ai-dev-workflow`，**只读链接字符串不解引用**，因为目标目录已不在正是 EEXIST 的成因之一；或入口脚本含签名串）——确认是本体系上次留下的才 `npm link --force` 覆盖，**判不出归属就一个字节都不动**，改为打印该文件路径 + `npm rm -g ctx` 后重跑 + `--no-ctx-link` 跳过。承诺因此收窄为**不覆盖别人的同名命令**，自己上次留下的照旧替换（与 unix 侧行为一致；判据与用户拍板见 `docs/spec/2026-08-26-ctx全局链接EEXIST处置-lean-change-spec.md`）。`--no-ctx-link` 跳过整段。全局命令指向最后一次安装的那个项目里的副本，靠"ctx 按 cwd 找 `engineering-context/`"做到一份命令服务所有项目。

安装的最后一段是 **codegraph**（`github.com/colbymchenry/codegraph`，本地代码知识图谱 CLI）：本机没有就 `npm install -g @colbymchenry/codegraph`（npm 是唯一跨平台可依赖的装法，Node 本就是安装器前提），已有则用它自己的 `codegraph upgrade` 升级——它认得 bundle/npm/npx 三种装法并原地更新，盲目 npm 装会在独立包安装的机器上留下抢 PATH 的第二份副本；`upgrade --check` 报告"已是最新"就跳过，太旧而没有 `upgrade` 子命令时退回 `npm install -g <pkg>@latest`；检测本身失败（真机上升级刚完成时偶发）就盲升，**升级结果以升级前后的版本号为准报告**——`upgrade` 退出码为 0 只说明命令跑通了，不代表真换了版本。随后 `codegraph install --target=auto --location=local --yes` 接线（默认项目级；**Codex CLI 没有项目级 MCP 配置，必然被跳过**，所以安装器显式打印手动全局接线命令，`--codegraph-location=global` 可改范围），最后 `.codegraph/` 不存在时 `codegraph init` 建索引，并以 `.codegraph/codegraph.db` 是否存在判定索引真的建成（旧版 `init` 只初始化不索引，缺了就补跑 `codegraph index`）。所有子进程 stdin 一律 `ignore`：codegraph 按 `process.stdin.isTTY` 决定要不要发问，关掉就锁定非交互分支，安装器不会被子命令提问挂住。整段任何失败只降级为警告，不影响已完成的 skill 安装；`--no-codegraph` 整段跳过。

Codex 安装默认不修改用户级全局插件配置，而是在目标项目 `AGENTS.md` 写入并校验 `ai-dev-system:codex-conflicts` 标记块，约束 `superpowers:` 不要自动加载或主动触发，除非用户在当前对话明确要求。交互安装可明确选择全局卸载，自动化安装使用 `--codex-conflicts=uninstall`；该选择影响当前用户的所有项目。若 `CLAUDE.md` 或 `AGENTS.md` 已有 workflow 标记块，安装器会幂等补齐另一入口。`--keep=superpowers` 会保留 Claude Code 插件，并移除安装器此前写入的 Claude 禁用项与 Codex 约束块。

## 改动时注意

- 改 skill 行为 → 改对应 skill `references/` 下 markdown；改模板 → `assets/templates/`；两者是 skill 的"源码"。改前后过一遍 `docs/spec/2026-07-16-skill写作自检清单.md`（信息层级 / 六大失败模式 / 交叉引用同步）。**新增 `ai-dev-workflow/references/` 下任何一篇纪律，MUST 同时在 `SKILL.md` 的〈加载点清单〉里加一行**——没有加载点的分册永远不会被读到，只是死文件；写不出触发条件就说明它不该独立成篇。新增 skill 只要放进 `ai-dev-system/skills/<name>/` 并含 `SKILL.md`，发布到安装源后 `install.mjs` 会自动发现并复制，无需改安装器；发布前用 `--source-dir=.` 验证。
- 用户沟通必须使用业务语言：大架构交给用户确认，模块内设计只问业务问题，详细程序设计不要求用户确认；`ai-prd` 的对话与成稿不得包含程序实现。
- 进入 workflow 后，任何文档或代码落盘前必须建立独立 worktree；Lean 也不例外。判断"要不要建、目录取哪个字段、过不了怎么办"只凭入口 `SKILL.md` §工作区隔离门要点（那道门在 Triage 之前），建的**动作细则**在 `references/core/worktree开发纪律.md` §工作区隔离门。全部门禁通过后自动合并主分支，失败保留 worktree，禁止处理主工作树的用户改动或绕过保护分支。
- **`agentic-principle` 是外部伴生技能，严禁把它的内容搬进本仓库**：它管 Agent 系统**怎么设计**（场景选型/提示词/工具边界/注意力与并发预算/长产物分区/步骤级测试与评测），本体系的 `AI-LLM-overlay.md` 只管**运行期 AI 契约**（确定性边界/版本 pin/输出校验/置信度路由/安全管线/降级/预算准入/eval 门/可观测/数据边界/可审计）。两边只用指针互引，各自独立演进。安装器把它装到**用户级** `~/.claude/skills/` 与 `~/.codex/skills/`（`install.mjs` 的 `COMPANION_SKILLS`；注意两侧目录不对称——`.agents/` 只是 Codex 的**项目级**目录，用户级是 `~/.codex/`），每次运行检查远端版本、更旧才更新，symlink 或 git 工作区只报告不覆盖，拉取失败降级为警告；改这条链路要同改 `install.mjs`、`AI-LLM-overlay.md` §Agentic 应用、`代码评审纪律.md` 的 E 轴（2.3.0 前叫 D 轴，编号让给了新增的文档轴）、`assets/config-snippets/base.md`（agentic 条目只在 base 一处，与协作面无关，MUST NOT 复制进 `collab-*.md`），并跑 `node --test test/companion-skill.test.mjs`。
- **`codegraph` 是外部工具，同样严禁把它的内容搬进本仓库**：它给的是**现状代码事实**（符号源码、调用链、影响面，随文件变更 auto-sync），Engineering Context 给的是**权威口径**（card + cite）；两者不互相替代也不同级——代码图谱管"找得到吗"，是**可选的检索加速面**（探测到索引才启用，装不上或索引建不成就降级为外包子代理）；代码事实层管"信哪个"，是**无条件必备的地基**（缺卡片就当场补，MUST NOT 因为有图谱就不补卡）。2.0.0 起 codegraph 的索引 `.codegraph/codegraph.db` 是**代码图谱的探测依据**，因此它出现在 `references/capability/graph.md` 里，但只以"何时用它 / 它给什么 / 不可用怎么办"三句声明的形式出现：它是**非硬依赖**（命令跑不起来就回退到子 agent 外包重探索，MUST NOT 阻断流程、MUST NOT 退回裸 grep），`graph.md` MUST NOT 扩写成 codegraph 使用手册，其安装与命令细节仍不进本仓库，也不进任何 config-snippet（代码图谱是探测结果，写进静态配置就会漂移）。改这条链路（`install.mjs` 的 `CODEGRAPH` 常量与 `syncCodegraph` 一族函数）要同改 CLAUDE.md §安装器的关键设计、`references/capability/graph.md` 与 `docs/spec/2026-08-14-codegraph自动安装与索引-lean-change-spec.md`，并跑 `node --test test/codegraph.test.mjs`。测试用**假 codegraph + 假 npm 放进收窄的 PATH**，绝不能让任何测试去动跑测试这台机器的全局安装——新增会调用安装器的测试记得带 `--no-codegraph`。
- **加载模型是跨文件的契约**（2.5.0 的核心）：常驻 = 六份（入口 + core 四篇 + `collab/` 一份），**但分两批取——分流前三份、分流后按分支补**（判据见 §架构 第 1 节；Lean 分支 MUST NOT 补余下三份）；其余全部按〈加载点清单〉在触发时取；清单本体住在 `ai-dev-system/skills/ai-dev-workflow/SKILL.md`，每行四个 REQUIRED 字段、每行须过三条判据（判据与判据分配算法见 §架构 第 1 节，权威定义在 `docs/spec/2026-08-23-渐进式披露与需求追溯-eng-spec.md` §4.1/§7）。改这条链路要同改：`SKILL.md`（清单 + 常驻声明 + 工作区隔离门要点）、`00-流程总纲.md` 与 `代码事实纪律.md` 逐节的 `> **何时读本节**` 行、`00-流程总纲.md` §移出常驻的三篇（三篇的结论行）、`路径-lean.md`（Lean 侧的同一批要点）、被移出常驻那三篇自己的开篇定位，并跑 `node --test test/cards-mandatory.test.mjs`（常驻六份 / 移出三篇文件仍在且出现在清单里 / 入口 ≤8,000 字节且自带隔离门四要点 / 清单 ≥18 行且十四个设计阶段触发条件逐字在场；该下限由 `test/contract-numbers.mjs` 单点定义，本文与 spec 的引用由 `test/contract-sync.test.mjs` 盯着，MUST NOT 各写一个数）。五个易错点：**⓪"常驻"MUST NOT 被读成"每次唤起都读"**——常驻说的是"哪几份构成完整流程的基本盘"，不是"什么时候读"。真跑验收（Task 13）撞出的正是这个：入口曾在 Triage 之前就把六份灌进来，而 `路径-lean.md` 写着 MUST NOT 读常驻篇，Lean 因此把同一批判据加载了两遍（实测多付 24,777 字节）。三份文件各自自洽、260 项测试全绿，**没有任何机器闸能发现它**——只有真按它们说的顺序走一遍才显形；**①"移出常驻"MUST NOT 被做成"删掉文件"**——三篇仍是权威定义处，总纲里的只是结论行地板，要改判据 MUST 取原篇；**②给一个原本无 MUST 的小节加规范词 = 给它新增一条 Lean 覆盖义务**（自足册覆盖率检查按"小节含 MUST"动态算必覆盖集），标注加载时机时 MUST 用非规范措辞；**③小节标题是机器闸的锚点**（`test/lean-selfcontained.test.mjs` 的 `EXCLUDED` 逐字匹配标题），改标题要同改测试映射；**④清单的稳定标识是触发条件文本**，MUST NOT 用行序号，也 MUST NOT 给它另编一套号。
- **Lean 自足册是跨文件的契约**：`references/core/路径-lean.md` 是 Lean 路径的**唯一判据载体**——Lean 不读常驻篇、不读总纲，因此十个来源文件（总纲 / 代码事实纪律 / 用户沟通 / 上下文卫生 / worktree / 代码评审 / 文档治理 / spec写作 / `collab/solo.md` + `collab/team.md` **取并集**）里每一条适用于 Lean 的 MUST，MUST 在自足册或入口里有一条**标注了来源锚点**（`来源：<文件> §<小节>`）的要点。改这条链路要同改：动了上述任一来源文件的 MUST，就要同步补进自足册；"不适用于 Lean"MUST 在 `test/lean-selfcontained.test.mjs` 的 `EXCLUDED` 里**显式枚举 + 逐条写理由**，MUST NOT 用启发式猜。跑 `node --test test/lean-selfcontained.test.mjs`。三个易错点：**①自足册 MUST NOT 进来源清单**——自己抄自己会让这条闸恒真；**②匹配靠来源锚点不靠文本相似度**，要点是浓缩改写的，逐字比对必然假阴性，所以**新写的要点忘了标来源 = 判红**；**③入口也是被检查方**（工作区隔离门在 Triage 之前，落在入口的要点同样算覆盖）。
- **计数词一律改指名引用**：`四轴` / `四道门` / `四问` / `七条"不裁剪"护栏` 这类把同一个数字复制到十几个文件的表述，**只允许出现在它的权威定义文件里**（前者在 `代码评审纪律.md`，后三者在 `00-流程总纲.md`），别处 MUST 改成指名引用——"按 `代码评审纪律.md` §四条轴 执行"。豁免只有三类：`SKILL.md` 与 `路径-lean.md`（按设计必须复述，且不可能是权威定义文件）、**落进目标项目的两个 assets 目录**——`assets/config-snippets/`（内容注入目标项目，2026-08-23 兼容取舍门已拍板保留原表述）与 `assets/templates/`（模板本身会被复制成目标项目的文档，2.8.0 起同理豁免）——以及小节名本身（`§四条轴` 不含子串 `四轴`）。**这两个 assets 目录的豁免判据是同一条**：读它的 AI 手边只有目标项目的文件，没有本 skill 可跳转，指名引用一个它打不开的路径等于没写，所以数字 MUST 就地写全（如 `todo.md` 模板里的陈旧阈值）。**由模板生成的目标项目实例同理**：MUST 写具体数字，MUST NOT 改成指向 skill 的指名引用。两条机器闸分管两半：`node --test test/counter-word.test.mjs` 管"别处还有没有残留数字"（受检词表是闭集，含豁免清单与权威文件映射的反向护栏），`test/cards-mandatory.test.mjs` 的护栏取值闸管"权威文件里写的那个数字与实际条目数是否一致"——**缺一不可**：只查取值数字会被复制到别处，只查出现位置权威处写错照样全绿。三个易错点：**①匹配 MUST 是字面子串**，MUST NOT 分词或模糊正则，否则改写后的正确形态（指名引用小节名）反而判红；**②`四道门` 的权威小节名字面就含受检子串**，引用方 MUST 指名引用**具体那一道门**的小节（如 `00-流程总纲.md` §兼容取舍确认门），MUST NOT 引用那张总表；**③新增受检词要同时补权威文件映射**，映射漂了那条检查会静默退化成"全仓禁用"，看着更严实则判据已丢。
- **措辞精简有不可压红线**：改 skill 文档压体积时，**每个被改文件的 MUST / MUST NOT / SHOULD / MAY 条数与判据正反例条数只准增不准减**——压体积和删判据在 diff 上长得一模一样。红线四条 MUST NOT 触碰：①任何规范结论本身；②判据消歧的正反例；③`MUST NOT 被读成……` 的结论部分（其后的论证展开可压）；④交叉引用的目标文件名与小节名。机器闸 `node --test test/wording-redline.test.mjs`：**地板取真棘轮 = 该文件在本分支上出现过的历史最大值**（`max(merge-base 处的计数, 本分支每个 commit 处的计数)`），跌破分支起点红、跌破分支内峰值也红。三个易错点：**①只跟父提交比会漏"慢性失血"**（精简是分批多次 commit 的，删一条补一条永远绿），**只跟分支起点比会漏"新增条款被回收"**（本分支先净增大量条款、最后才精简，删干净仍高于起点）；**②本分支新建的文件照样受管**（移出常驻的三篇、Lean 自足册正是新增条款最密集处，峰值一旦出现地板即成立）；**③它只管同一文件内部的措辞**，移出/改名/未提交的文件跳过，那部分由加载点清单契约与自足册覆盖率检查保护。
- **卡片必备与渐进补齐是跨文件的契约**（2.1.0 的核心）：权威定义在常驻的 `references/core/代码事实纪律.md`（一句话规矩 = 要用某个模块的事实就先查卡片，没有卡片就读源码、读完当场补上；最小形态四项在 §4.1）。触发点分布在七处：`00-流程总纲.md` §默认倾向（判据 3/4 MUST NOT 读成"卡片里查不到就算说不清"）与 §七条"不裁剪"护栏第 7 条（补卡不裁剪）、`init-初始化.md` 第 5b 步（在 worktree 内跑 `ctx init` 建整套骨架，MUST NOT 跑 `--minimal`、MUST NOT 问用户要不要建）、`步骤-1-7-设计与实现.md` Step 1〈既有系统清单〉、`路径-lean.md`（Lean 也不豁免）、`代码评审纪律.md` 的残留轴（读过源码却没补卡即为残留）、`上下文卫生.md` 规则 4（没有代码图谱时把重探索外包子代理，MUST NOT 主会话裸 grep）、`assets/config-snippets/base.md`（注入目标项目的那条无条件声明）。改判据要沿这条链同改，并跑 `node --test test/cards-mandatory.test.mjs`。两个易错点：**①"没有卡片"MUST NOT 被处置成"可以直读源码交差"**——读源码只是第一步，补卡与提交是同一次任务的一部分，顺延即等于没执行；**②代码图谱 MUST NOT 被当成卡片的替代品**——它答"找得到吗"，不答"信哪个"，两者冲突时以卡片为准。
- **替换清单是跨文件的契约**：登记在 spec（`eng-spec.md` §8.2 / `lean-change-spec.md` 替换清单节）、拆成任务在 `coding-plan.md` 核销表、核销在 `代码评审纪律.md` 的残留轴。改判据（该删什么、保留例外认哪几类理由）要四处同改，且与 `eng-spec.md` §8.1 兼容取舍的到期日保持一致——两处日期不一致就是漏洞。
- **需求编号 `FR-###` / `AC-###` 是跨文件的契约**（2.5.0 新增）：spec 的每条功能需求编 `FR-###`、每条验收项编 `AC-###`，格式是前缀 + 三位零填充十进制（超过 999 条位数自然扩展），**永不复用、永不重排**——新增一律接着当前最大号往后取，删除的 MUST 原地保留编号并改写成"**已撤销** —— 【原因】"，MUST NOT 腾位置。四个落点必须用同一套号：`assets/templates/eng-spec.md` §1.1 与 §完成定义 / `assets/templates/lean-change-spec.md`（Lean 不豁免）→ `assets/templates/coding-plan.md` 任务头的 `满足:` 字段与完成清单的「需求覆盖核销」→ `references/core/代码评审纪律.md` 忠实轴的覆盖矩阵 → `assets/templates/test-spec.md` §6 追溯矩阵。改判据要五处同改。三个易错点：**①它与 `eng-spec.md` §6 的 `Invariant N:` 是两套各自独立的编号**，互不换算、互不影响，改一套 MUST NOT 牵动另一套；**②覆盖是双向的**——每条 `FR-###` 至少被一个 Task 的 `满足:` 引用（零引用 = 漏做）且至少被一条 `AC-###` 覆盖，每个 Task 的 `满足:` 都要指向 spec 里真实存在的编号（指不到 = 镀金）；有需求一条 AC 都没有 MUST 补验收项，**MUST NOT 靠删需求消掉缺口**；**③这条契约没有机器闸**——落点全在模板文案里，唯一防线是 spec 的覆盖自查与评审门忠实轴的覆盖矩阵，改模板时 MUST 手工过一遍这五处。
- **评审门的派发成本有两条纪律**（2.5.0 新增，权威定义在 `references/core/代码评审纪律.md` §门禁）：**①机械轴 SHOULD 用更便宜的模型**——规范轴与残留轴绝大部分是模式匹配与逐条计数，忠实轴与文档轴 MUST 保持与主会话同级（它们是判断题，降档会把发现降级成复述）；这条只改执行成本，**MUST NOT 借它削减轴数或跳过任何一轴**。**②同一类问题被报到第二次，就该有一条机器闸接手**——交叉引用失效、索引漏收、同一个量在多处漂移、清单停在未核销标记，都属机械可判类，MUST 固化成 `test/` 下的闸而不是每轮靠子代理重查：闸每次查全量，子代理只看它这次读到的那部分，既贵又不如闸可靠。易错点：**MUST NOT 把"已经有闸了"读成"这一轴可以不派"**——闸覆盖的是已知类型，子代理要找的是没人想到过的那类。
- **代码评审门的返回格式按轴条件增列**（2.5.0 新增）：`references/core/代码评审纪律.md` §返回格式的表头**只有忠实轴多一列**——忠实轴为 `| # | 偏离类型 | 严重度 | 位置 | 问题 | 建议修改 |`，其余各轴一律保持不含「偏离类型」的四列。「偏离类型」取值是五个的**闭集**，MUST NOT 自造第六类：`漏做` / `做一半` / `做反了` / `越界` / `镀金`。改这条链路要同改 `代码评审纪律.md` §四条轴的忠实轴职责段、§子代理 prompt 模板的 §本轴职责 与 §返回格式、`路径-lean.md` §9.2/§9.3（Lean 侧同一份）。三个易错点：**①`越界` 与 `镀金` MUST 分列**——越界是碰了明令禁止的面（P0），镀金是在允许的面上做多了（通常 P1/P2），合并会丢掉现有区分度；**②MUST NOT 把「偏离类型」加到忠实轴之外的任何一轴**，它们不做需求逐条对照，硬填只会得到一列编造的标签；**③无编号 spec 走降级不走报错**——spec 没有 `FR-###`（存量文档）时忠实轴 MUST 退回自然语言逐条对照，并在报告**首行**原样输出 `本次未跑覆盖矩阵：spec 无编号`，MUST NOT 因此报缺陷或阻断门禁。
- **文档轴是跨文件的契约**（2.3.0 新增）：代码评审门的 **D 文档轴**恒跑，参照物是 `docs/` 的现行文档与真相源，权威定义在 `references/core/代码评审纪律.md` §四条轴 + §子代理 prompt 模板的文档轴职责段；**判据本身不在那里**——什么算触碰权威面、失准了怎么归档、仍准确怎么留痕，权威定义仍在 `文档治理.md` §3，D 轴只是**执行者**。改这条链路要同改这些落点（**范围以 `grep -rln "§四条轴\|文档轴" ai-dev-system/skills/` 的实际结果为准，MUST NOT 按记忆中的清单收工**——这条 grep 命中的是**全部引用方**、当前十余个文件，**MUST NOT 指望它只命中权威定义文件**：上面的「计数词一律改指名引用」收敛的是**轴数数字**，指名引用本身理应遍布各处。另有一条作用域边界：查数字的机器闸 `test/counter-word.test.mjs` 只遍历 `ai-dev-workflow/`，因此 `ai-prd/references/prd复核纪律.md` 里那两处 `四轴` 是**未被机器闸检查**、不是已豁免，改轴数时 MUST 手工过一遍那一篇）：`代码评审纪律.md`（轴表 + 门禁的子代理数 + prompt 模板 + §返回格式的按轴增列）、`文档治理.md` §3（触发点归属）、`worktree开发纪律.md` §完成与自动合并门（核对形态那两条）、`00-流程总纲.md`（门表 + §代码评审门 + §"不裁剪"护栏第 4 条）、`路径-lean.md`、三个模板与 `config-snippets/base.md` 的轴数，外加 `SKILL.md`（〈加载点清单〉「过代码评审门」那一行 + frontmatter description）、`collab/{solo,team}.md`、`上下文卫生.md`、`config-snippets/collab-solo.md`、姊妹 skill 的 `ai-prd/references/prd复核纪律.md`，并跑 `node --test test/doc-axis.test.mjs`。四个易错点：**①轴的引用散在十几个文件**，改一处漏一处不会报错——`grep -rln "§四条轴\|文档轴" ai-dev-system/skills/` 全仓扫，**MUST NOT 靠往这些文件里写回轴数来找齐**（`test/counter-word.test.mjs` 会判红），加一条轴时改的是权威文件里的数字 + 各处指名引用的小节名；**②D 轴 MUST NOT 设触发条件**，让主会话先判"本次有没有碰文档"等于把最容易漏的判断交给最容易漏的人（改语义不删东西同样让文档失准，而这类改动替换清单往往为空）；**③`ctx probe` 是 SHOULD 辅助不是门禁**，它的 B 类题型只验可达性与 `authority_refs` 非空、不读正文，**probe 全绿 MUST NOT 读成文档还准**；**④agent 架构轴 2.3.0 起叫 E 轴**，判据没变只让了编号。
- **文档生命周期是跨文件的契约**：判据与字段的权威定义在 `references/core/文档治理.md` §文档生命周期与索引门控（`lifecycle` / `last_confirmed` / `authority_refs`、索引分层、按权威面触发）——该篇**已移出常驻**，在"要判文档去留、归档、索引分层"这个加载点才取整篇，只有「新建文档 frontmatter 必带 `lifecycle` 与 `authority_refs`」这条地板作为结论行常驻在总纲 §移出常驻的三篇（Lean 侧在自足册 §10.2）；落地写法（归档头注、结算示例、账本收敛）在条件加载的 `references/core/文档归档与账本收敛.md`，结算的**判定**在代码评审门的 D 文档轴、**落盘**由主会话当场做（见上一条），`worktree开发纪律.md` §完成与自动合并门与 `00-流程总纲.md` 只**核对**结论，字段落在五个 spec/plan 模板与三类 PRD 模板的 frontmatter，账本入口在 `bug诊断纪律.md` Phase 0/3 与 `测试资产纪律.md` §3，PRD 侧对应 `ai-prd` 的 §PRD 生命周期与 `UI原型纪律.md` §4.5。改判据要沿这条链同改。两个易错点：**①触发面是"本次触碰的权威面"，与刷 card 同源但更宽**（多出的几类是文档层专有、不触发刷卡，其中「流程与门禁契约」专管门/轴/步骤/准出项的语义；**权威清单只有一份，在 `文档治理.md` §3 第 1 步，以表内「也触发刷卡？」列为准，MUST NOT 在别处另记数字**），**MUST NOT 退化成"照抄替换清单"**——只改语义不删东西（枚举加值、可选改必填）的改动替换清单为空，却同样让文档失准；**②字段名是 `lifecycle` 不是 `status`**——`lean-change-spec` 的 `写作进度` 已占用后者语义（`product-prd` 的 `status` 字段随 2.8.0 一并删除：它是「当前状态描述」的自由文本，属进度记载，与需求真相源只写现状的定位冲突）。
- **需求真相源分层与 TODO 出口是跨文件的契约**（2.8.0 新增）：权威定义在 `references/core/文档治理.md` 的三节——§需求真相源写什么、怎么分层（**只写 main 分支已实现的现状**，MUST NOT 含历史/前后对比/技术选型；两层承载 `docs/REQUIREMENTS.md` + `docs/requirements/<模块>.md` 一级子模块，MUST NOT 二级目录；细节边界判据是**用户能不能感知**；拆分阈值 <500 不拆 / >800 拆；划分方式 MUST 写在主文档里）、§6（**归并落点按口径类型分派的映射表**）、§TODO 出口（四类闭集章节 / 每条带提出日期 / 准入门槛 / 3 个月陈旧提醒，**AI MUST NOT 自行删条目**）。落点分布在九处：`00-流程总纲.md` §移出常驻的三篇 的结论行、`路径-lean.md` §10.5／§10.6／§10.7（Lean 侧同一批要点，逐条带来源锚点）、`ai-prd/references/00-prd生成流程.md` §PRD 生命周期 与 §膨胀分层、`代码评审纪律.md` 的 D 文档轴参照物、`prd复核纪律.md` 冲突轴参照物、`init-初始化.md`（MUST NOT 代建 `TODO.md`）、`prd质量清单.md` 落盘位置、`probe-set.md` 与 `ctx/README.md` 的 `requirement-reachable` 说明（**判定逻辑不变，仍只验可达性**）、三份模板（`product-prd` / `requirements-module` / `todo`）。改判据要沿这条链同改，并跑 `node --test test/requirements-layering.test.mjs`。四个易错点：**①「功能清单没变化」MUST NOT 被读成「无需归并」**——改已交付功能的行为规则而清单一动不动是最常见的迭代形态，漏了它那条规则会跟着变更 PRD 一起进归档区，**且没有任何机器闸能发现**（`ctx probe` 只验可达性，D 轴要比对的正文压根不存在）；**②归并时机只有一个**——真相源在**准出门**才更新，`文档治理.md` §三层真相源 那条旧的「最后才是 spec」已删，MUST NOT 复活（它与 §6 互斥，也与 D 轴「尚未归并只标待归并」互斥）；**③尚未实现的一切只有 `docs/TODO.md` 一个出口**，MUST NOT 在真相源里留「计划中」小节——留了读者就无法再信任「这里写的都是现状」，整份文档价值归零；**④阈值数字（500 / 800 / 3 个月）只出现在 `文档治理.md`**，引用方 MUST 指名引用，MUST NOT 各记一个数。
- **测试资产目录约定**：探测项目既有测试目录优先，兜底 `tests/fixtures/<场景名>/`；凭证进同级 `secrets/`（gitignore）+ `secrets.example/`（入库）。权威定义在 `references/core/测试资产纪律.md` §2，`test-spec.md` §4 Fixture 表与 `文档治理.md` 的表格引用它，改约定要三处同改。
- **UI 原型是跨 skill 的契约**：`ai-prd` 涉及用户可见界面时产出 `docs/spec/<name>-prototype-YYYYMMDD.html`（单文件、零外链、可离线打开），`ai-dev-workflow` 的 Step 1/2/4/8 把它与 PRD 一并作为输入。改这条链路要三处同改：`ai-prd/references/UI原型纪律.md`（权威定义）、三类 PRD 模板的「UI 原型」五项表、`ai-dev-workflow/references/core/00-流程总纲.md` 的输入声明与参考 prompt。
- **原型批注框架是跨文件的契约**（2.7.0 新增，权威定义在 `ai-prd/references/UI原型纪律.md` §7）：`assets/templates/ui-prototype.html` 内置一层固定实现的批注层，把两类内容各给一个标准载体——**AI 侧**在元素上写 `data-anno="说明"`（待用户拍板的加 `data-anno-kind="question"`），框架在该元素右上角挂一枚悬浮才展开的小气泡；**用户侧**用画布顶端工具栏点选元素写意见、写全局反馈，随时改随时写回文件。模板因此分三区，**产出原型只动第 2 区**：框架区（`ANNO-FRAMEWORK:CSS` / `ANNO-FRAMEWORK:JS`）/ 界面内容区（`SCREENS:BEGIN…END`）/ 批注数据区（`ANNOTATIONS:BEGIN…END`）。**为什么给出口而不是加禁令**：「说明不许画进界面」这条禁令从 1.x 就在、agent 仍反复违反，因为说明栏是一整段自由文本、指不到具体控件——缺的是表达方式，不是严厉程度。改这条链路要同改：模板本体、`UI原型纪律.md` §2/§5（PRD「UI 原型」五项表的权威定义）/§6/§7/§8、`00-prd生成流程.md` §组稿 第 2 步与第 4 步、`prd质量清单.md`、`prd复核纪律.md`（原型结构摘要的口径）、`assets/question-bank.md`、`ai-prd/SKILL.md`（路由第 5 步 + §关键纪律）、三类 PRD 模板的「不在用户界面内展示」项、`ai-dev-workflow` 的 `00-流程总纲.md` 步骤表注、`路径-lean.md` §4.1、`步骤-1-7-设计与实现.md` 的 Step 1 与 Step 4、`步骤-8-10-测试.md` 的 Step 8，并跑 `node --test test/prototype-annotations.test.mjs`。**产出与改稿一律走工具**：`ai-prd/scripts/preview.mjs` 是本 skill 唯一的脚本（**不是 ctx**——那个随 `ai-dev-workflow` 分发），六条子命令覆盖全流程：`init` 建原型、`screen` 加一屏（设备壳与状态层结构由它保证）、`slot` 只换某个具名插槽（**批注块与 `data-anno-user` 锚点原样保留**）、`check` 交付前结构自检、`annotations` 取回批注、`serve` 起预览服务。**改稿 MUST 走 `slot`**：手工改稿要么先把整份原型读进上下文（几万 token），要么重新生成而抹掉用户已写的批注——2.7.0 的零上下文实测正是死在这里。**结构知识 MUST 收进 `check` 而不是纪律正文**：`.kv-row` 要配 `<dt>`、状态层必须是 `.screen` 的直接子元素、tab 要 `aria-selected`——这类写错了页面照常打开、只是版式塌掉的知识，靠 agent 记住必然漏。**取批注只有一个入口 `annotations`**：一次给出用户逐元素批注（带所在屏与元素）、全局反馈、AI 侧 `data-anno` 说明与 `question` 待拍板项；**真正打开原型的每个执行点都要就地给出这条命令**（`ai-dev-workflow` 的 Step 1 / Step 4 / Step 8、Lean 自足册 §4.1），只写在总纲里等于写给一个当时不在场的读者。**批注怎么落回文件**：默认走 `serve`——它把一份原型用回环 http 提供出去并自动开浏览器，页面把批注 POST 回来原子写回原文件，**用户零操作**；只绑 `127.0.0.1`、校验 Host 挡 DNS rebinding、payload 不像原型文档就拒绝。`file://` 直接打开时才降级到 File System Access 手动授权（Chrome/Edge）或下载副本覆盖（Safari/Firefox）。**服务的生命周期由 AI 持有**：AI 后台起、AI 在派复核子代理之前停（用户已定稿，服务再开着，用户之后写的批注会落进一份正在被复核的稿子），MUST NOT 要求用户自己起服务或按 Ctrl+C。**批注随原型入库**：用户批注与元素锚点是需求的一部分，落盘时 MUST 以预览副本为准整份写进 `docs/spec/`，MUST NOT 重新生成一份干净原型顶替；`question` 项 MUST 在落盘确认门逐条摆给用户。改这条链路要同改 `preview.mjs`、容器里的 `SERVED` 分支、`UI原型纪律.md` §7.4、`00-prd生成流程.md` §组稿 第 4 步、`ai-prd/SKILL.md`（目录树 + 路由第 5 步），并跑 `node --test test/prototype-preview.test.mjs`（起真进程真端口，不 mock）。九个易错点：**①MUST NOT 手工复制容器再逐行替换、更 MUST NOT 逐字重写框架**——正确用法是 `init` / `screen` / `slot` 三条命令，手工改写白花上万 token 且会让用户已写的批注失联；**②取用户反馈 MUST 用 `annotations` 命令**，MUST NOT 为此通读整份 HTML，工具整体跑不起来时才降级为直读 `ANNOTATIONS` 块加 `grep -n "data-anno="`；**③框架 MUST NOT 引入任何外部资源**——包括看似无害的 SVG data URI，`xmlns` 会带进 `http://` 串、直接挂掉零外链自检，所以拾取光标用跟随鼠标的 DOM 元素而不是 `cursor: url(...)`；**④默认路径 MUST 是零操作的**——用 `preview.mjs` 打开就自动写回，**MUST NOT 因为降级路径存在就默认让用户手动授权**；只有在服务起不来、用户直接双击 html 时才走手动，那时用户说批注完了而批注块是空的，MUST 先问状态灯颜色，MUST NOT 判定"用户没提意见"；**⑤改界面时 MUST 把现有的 `data-anno-user` 锚点抄进新片段**——「用 `slot` 就不会丢批注」只对**批注数据块**成立，锚点挂在界面元素上、而界面元素全住在 `screens` 插槽里，改界面必然连它一起换掉；丢锚点时 `slot` 拒绝写入并列出会失联的每条批注，`check` 把孤儿批注报成 P0，MUST NOT 用 `--drop-anchors` 绕过去（那是在丢弃用户写下的意见）。**⑥插槽片段 MUST 只写外壳内部的内容**——外壳由容器提供，片段再包一层会得到 `<style><style>` 或双层 `.devices`，页面照常打开、`check` 也看不出；同理，替换区间由容器的 `BEGIN`/`END` 标记判定，**MUST NOT 改成按缩进或标签形状匹配**（内容天生会长得像容器，实测撞出过静默重复插入）。**⑦组件表覆盖不到的样式 MUST 有 `custom` 插槽承接**——框架 MUST NOT 成为某类原型风格的阻碍，该插槽排在 `DESIGN-SYSTEM` 之后才覆盖得掉（hover / 动画 / 媒体查询都靠它）；**⑧删掉插槽的某个字段时 MUST 全文搜它的引用**——区间判定从正则改成标记那次只改了一处，`cmdScreen` 与 `cmdCheck` 继续引用已删掉的 `SLOTS.*.re`，而 JS 对 `undefined` 正则的容忍（`match` 给空匹配、`replace` 当字面串）把三处静默失效全接住了：`screen` 命令零改动却打印「已加屏」、退出 0。同理，断言「命令跑成功了」**MUST NOT 用退出码代替「文件真的变了」**。**⑨按标记取段的区域内不得出现该区结束标记的字样**——连"教人怎么读"的注释也不行，否则那条读法在此提前截断（真跑撞出过，见 spec §真跑发现 第 2 条）。
- **PRD 复核门是跨文件的契约**（2.2.0 新增，2.6.0 前移到用户定稿之后）：权威定义在 `ai-prd/references/prd复核纪律.md`（为什么派子代理 / 门禁与分流 / 两轴表 / prompt 模板 / 三个出口），触发点在 `00-prd生成流程.md` §组稿 **第 5 步**——**前面还有第 4 步的「用户过稿门」**：组稿完、跑完质量清单后 MUST 先把 PRD 与 UI 原型交给用户读、提意见、定稿，**用户定稿之前 MUST NOT 派复核子代理**（复核报告只对某一版稿子有效，用户随后的意见会让它整份作废；更糟的是主会话会带着"这稿已复核过"的印象接受大改，改出来的部分从没被第三方视角看过）。三门顺序 **用户过稿门 → 复核门 → 落盘确认门，两边都不能挪**。接线分布在六处：`ai-prd/SKILL.md`（目录树 + 路由第 5 步 + §关键纪律的用户过稿门 / 复核门 / 落盘确认门三条）、`prd质量清单.md` 顶部的分工说明、`collab/solo.md` §3 第 4 条与 §6 表、`collab/team.md` §3 与 §5 表、`assets/question-bank.md` §追问触发 的两条 `[组稿·复核后]` 条目与那条"用户还没定稿 MUST NOT 派子代理"的 `[组稿]` 条目、`UI原型纪律.md` §2 的**预览副本**条（过稿门要用户真的打开原型，因此原型 MUST 以预览副本落在项目外位置，**MUST NOT 因为"用户要看"就提前写进 `docs/`**）。六个易错点：**①三门顺序两边都不能挪**——挪到用户定稿之前，复核的是一版随时会被推翻的稿子；挪到落盘确认门之后，文件已进 `docs/spec/` 与索引、下游可能已开跑，而冲突轴查出的东西几乎全要用户拍板；**②用户过稿门与落盘确认门 MUST NOT 互相顶替**——前者参照物是**用户自己的意图**，后者是**复核门交上来的待拍板冲突与关键取舍**；两道门共用同一套"怎样算确认了"的三条判据（权威定义在落盘确认门那一步），也是**仅有的两个**允许因等用户而挂起的点；**③落盘确认门有一条退化规则**：复核门既无「需用户拍板」条目、也无**实质性改稿**（改动了目标 / 非目标 / 现状结论 / 详细业务行为 / 验收项；纯补出处标注不算）时 MUST 收成一句话告知直接落盘，MUST NOT 要用户点第二次头；反之只要稿子变过，MUST 逐条列出"你定稿之后改了什么"；**④三个出口的分流判据是"事实错了回去补，取舍待定才给用户"**，MUST NOT 把"现状节失实"摆进落盘门当取舍——用户此刻手里没有卡片也没有源码，只能点头；**⑤它与 `prd质量清单.md` 参照物不同**（清单查模板骨架，复核查 PRD 自身与现有系统），两者 MUST NOT 互相顶替；**⑥`[组稿·复核后]` 是 `[组稿]` 的子类、勾验时机在门后**（第 3 步跑质量清单时 MUST NOT 勾验，那时门还没跑），标签枚举散在三处——`question-bank.md` §追问触发 的说明 + `00-prd生成流程.md` §4 批提问 的标签清单 + `SKILL.md` 路由第 4 步，改一处要三处同改。改组稿步骤编号时全仓 `grep -rn "§组稿 第 [0-9]"` 同步，编号散在四个文件里；`test/prd-review-gate.test.mjs` 的步骤号断言**按门名动态取号**，MUST NOT 往里回填数字。改这条链路后跑 `node --test test/prd-review-gate.test.mjs`。
- `ai-prd` 的北极星参考物是 `orgin/prd.demo/` 下的变更 PRD 范例（brownfield 变更 PRD 骨架，本地参考、不入库）；改 `change-prd.md` 模板前对照设计文档 `docs/spec/2026-07-06-ai-prd-design.md §7` 的覆盖度映射，别丢节。
- 改 `ctx` 逻辑 → 同步更新仓库根 `test/ctx-*.test.mjs`（fixtures 在 `test/fixtures/ctx-engineering-context/`），跑 `node --test test/*.test.mjs` 保持全绿。**测试与 fixtures 刻意放在 skill 目录之外**：`install.mjs` 整目录复制 skill，放在里面会把 1.4k 行对使用方无用的测试装进每个目标项目。card/registry 的格式约定见 `scripts/ctx/README.md` §card 格式约定，解析器依赖它。
- **`ctx` 的"能不能直接敲"是跨文件的契约**：安装器负责 `npm link`（`install.mjs` 的 `CTX` 常量与 `syncCtx` 一族函数），文档负责在链接失败时把人和 AI 引到兜底调用方式而不是 grep。改这条链路要同改 `install.mjs`、CLAUDE.md §安装器的关键设计、`references/core/代码事实纪律.md` §2 调用方式、`assets/config-snippets/base.md` 末尾那四条无条件条目（维护 engineering-context / 取事实的固定顺序 / 查不到就当场补卡 / `ctx` 找不到时的兜底调用）、`scripts/ctx/README.md` §安装/运行 与 §测试、两个 README 的安装器职责清单与 `ctx init` 示例，并跑 `node --test test/ctx-link.test.mjs`。判定 ctx 是否为"我们这一个"依赖 `ctx --help` 首行的签名串 `Engineering Context CLI`——改 `cli.js` 的 HELP 首行会静默打断这个判定，两处同改。测试同样用**假 npm + 假 ctx 放进收窄的 PATH**，新增会调用安装器的测试记得带 `--no-ctx-link`。
- 改 `assets/context-layer/` 模板 → 同步 `scripts/ctx/src/commands.js` 内对应的 init stub（脚手架用的精简副本），反之亦然；两处漂移会让 `ctx init` 生成物与文档教的模板不一致。
- 本仓库自身与安装目标的文档目录固定为：spec → `docs/spec/`，plan → `docs/plan/`，report → `docs/report/`。
- **版本管理**：分发版本在 `ai-dev-system/VERSION`（旧无 stamp 安装追认为 1.0.0）。凡改变已安装项目的行为契约或目录约定就 bump；**只有需要用户动作的升级**才新增 `ai-dev-system/migrations/<新版本>.md`（安装器会在升级时高亮全文打印，指南保持一屏内）。零手动动作的升级（重装即可、不改标记块字段、不要求回填存量文档）**MUST NOT 建迁移文件**，更 MUST NOT 为了过闸补一份「需要的动作：无」的空指南——那正是这条判据要挡的噪音。**四条相关断言早年确实无条件要求当前 VERSION 有同名指南，但 2.5.0 起已各自改成条件式，零手动动作的 bump 不再判红**——`test/installer-migration.test.mjs`「VERSION 与迁移指南文件契约」用 `if (existsSync(guide))` 包住那条，`test/cards-mandatory.test.mjs`、`test/prd-review-gate.test.mjs`、`test/doc-axis.test.mjs` 三条各自盯的是**本特性落地的那个版本**的指南（`2.1.0.md` / `2.2.0.md` / `2.3.0.md`），不是当前 VERSION。**MUST NOT 因为要 bump 就去改这四份测试**（2.8.0 实测 44 项全绿），更 MUST NOT 反过来补一份「需要的动作：无」的指南去迎合它们；放宽后仍拦得住「写了指南但写坏了」——目录里每一份指南都要合法命名、含「需要的动作」节、≤45 行。安装器把版本 stamp 写入目标两个 skills 目录的 `ai-dev-system.version`。**每次版本变更合入 main 后必须打 annotated tag `v<版本>`**（如 `v1.1.0`），tag 与 VERSION 始终一致，供 `--ref=v<版本>` 锁版本安装与回溯。机制详见 `docs/spec/2026-07-16-skill版本管理与迁移机制.md`；改动后跑 `node --test test/installer-migration.test.mjs`。
