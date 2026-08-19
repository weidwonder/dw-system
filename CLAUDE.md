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

**交付单元是 `ai-dev-system/skills/` 下的两个 skill（`ai-prd` + `ai-dev-workflow`）。** 二者共享同一套约定（同一份路由三步、references+assets 结构、复用 `ai-dev-workflow` 的标记块）。`ai-prd` 是 workflow 的前置产 PRD 阶段，结构见 `ai-dev-system/skills/ai-prd/`（纯 markdown，无代码）。下文以 `ai-dev-workflow` 为主展开，抓三点：

### 1. 一层必备地基 + 两个可变维度（`SKILL.md` 是入口）

内核（`references/core/`）**无条件常驻**。其中 `代码事实纪律.md` 立的是**地基**：**装了本体系的项目一律维护 `engineering-context/` 代码事实层**（registry + cards），不分项目大小、不分协作面、没有开关——初始化建骨架，之后"要用某个模块的事实就先查卡片；没有卡片就读源码，读完当场把卡片补上"。它**不参与路由判断**：registry 里有没有条目、卡片建了几张，都不改变本次加载什么、走哪条分流。

在地基之上只有两件事**可变**。每次调用先走**路由逻辑**（见 `SKILL.md` §路由逻辑），三步：

1. **探测代码图谱**——**项目根**下 `.codegraph/codegraph.db` 存在 → 加载 `references/capability/graph.md`（回答「找得到吗」：符号、调用链、影响面）。它只是**检索加速面**，不改变任何流程判据；探测不到（或探测本身失败）就按没有算，把重探索外包给子代理，MUST NOT 阻断流程。**本步 MUST NOT 探测 `engineering-context`**——它是必备资产，不是可选开关。
2. **读协作面**——目标项目根 `CLAUDE.md`（优先）或 `AGENTS.md` 里的 `<!-- ai-dev-workflow:start --> … collaboration="solo|team" merge-gate="direct|pr" worktree-dir="./.worktrees/" … <!-- ai-dev-workflow:end -->` 标记块。**无标记块** → 初始化（`references/init-初始化.md`）：只问一个问题（除你之外还有没有人一起开发）+ 一条待拍板的 merge-gate 建议；**代码图谱不问**（探测得出），**代码事实层也不问**（必备资产，第 5b 步在 worktree 内跑 `ctx init` 直接建骨架）。
3. **加载**——core 常驻七篇（含 `代码事实纪律.md`）+ `references/collab/{solo,team}.md` 必选一份 + 探测到代码图谱时加 `references/capability/graph.md`（可零篇）。要动 `engineering-context` 的**结构**（设计 registry 字段 / 画场景蓝图 / 维护探针集）时才另读 `references/core/engineering-context设计.md`；日常补一张卡片不用读它。

**为什么一个探测、一个设字段**：判据是"**探测得出来的不设字段，探测不出来的才设字段**"。索引是文件系统里的客观事实，写成配置就会漂移——项目长大、索引被删，配置都不会自己变，于是要再造升档/降档/一致性校验三套装置去对抗自己造出来的漂移；探测的结论永远与项目当下状态一致。而"除你之外有没有人一起开发"文件系统里没有，只能问一次并固化。**代码事实层既不探测也不设字段**——它是必备的，压根没有"启不启用"这个问题需要判定。

**为什么取消分档**（这是 2.1.0 重构的由来）：2.0.0 用一个探测开关决定要不要维护卡片——registry 里没有真数据行就判定"这个项目还没有资产"，于是允许直读源码、分流默认走 Lean，卡片靠"攒够返工信号才建议补建"。**分档的判据永远滞后于项目实际风险**：一个人维护的十万行遗留系统正因为一张卡片都没有，被判成"没有资产 → 默认走 Lean → 直接 grep 旧代码"——那恰恰是本体系最初要消灭的失败模式，而它出问题时才会显形，显形时已经改错了。2.1.0 取消这个选择：**卡片是地基，不是升级项**——"什么时候该建资产"这个判断题不复存在，为它服务的那套信号累计与补建建议机制也随之整体删除。剩下的两个维度仍**互不蕴含**：协作面只管人怎么协作，代码图谱只管检索快不快，谁也 MUST NOT 推出谁。

初始化的幂等规则很关键：**只替换标记块内内容，绝不重复追加**；标记用 HTML 注释，机器可精确定位、对 markdown 渲染无影响。注入片段由 `assets/config-snippets/base.md`（无条件）+ `collab-{solo,team}.md`（二选一）拼装，`CLAUDE.md` **和** `AGENTS.md` 两个都写（兼容 Claude Code + Codex）。块里还留着 `mode="team"` 是**墓碑**：新 skill 完全忽略它，留着只为让尚未升级的旧 skill 不硬失败，`3.0.0` 移除；只有块内没有 `collaboration` 时才用旧值推协作面（team → team+pr，其余 → solo+direct），**MUST NOT 由旧值推出别的任何东西**——代码图谱只认运行时探测，分流默认倾向由总纲无条件定义。

### 2. 流程内核（`references/core/00-流程总纲.md`）

技术栈无关的 10 步流程 + Step 0 Triage 分流：

- **Triage 的 4 个判定问题**（AI/LLM 行为？鉴权安全设备？跨服务/迁移/不可逆？指标/业务规则/对外承诺？）——4 项全否走一页 **Lean Change Spec** 直接实现；任一为是升级回完整流程。
- 四问都不触发时还有个**默认倾向**，它**无条件适用于所有项目**，MUST NOT 由协作面、项目大小或有没有代码图谱来改变：**影响面说不清时 MUST 升级到完整流程出 Overview，说得清才走 Lean**。"说不清"的四条判据在 `references/core/00-流程总纲.md` §默认倾向：①本次要改的能力在 registry 里跨 ≥2 个权威仓库、②`ctx discover` 给出 out-of-scope 警告（这两条 Triage 当场逐条过）、③关键事实里有任何一条**给不出出处**（卡片 cite 或 `文件:行`）、④卡片与 `discover`、`search-semantic` 都收不窄且**读完源码仍说不清模块边界**（这两条回溯触发，Step 1 进行中命中即当场升级）。后两条 MUST NOT 被读成"卡片里查不到就算说不清"——查不到的正确处置是读源码 + 当场补卡，补完就有出处。跨仓需求一律升级。
- 含 AI/LLM 功能时，在基础 spec 上**叠加** `references/core/AI-LLM-overlay.md` 的 AI 契约（判定边界见该文件）。判定为 **Agentic 应用**时另需加载**独立技能 `agentic-principle`**（见下）。
- 所有文档遵循 `references/core/spec写作纪律.md`：零上下文可动手、RFC2119、无占位符。
- 10 步之外还有**四道贯穿两条路径的门**（Lean 也不豁免）：worktree 隔离门 → 兼容取舍确认门（spec 定稿前，用户逐条拍板是否向后兼容）→ 代码评审门（编码后，子代理跑规范/忠实/残留/文档四轴）→ 完成与自动合并门。门的位置见总纲流程总览图。

### 3. 必备的 Engineering Context 代码事实层 + `ctx` CLI（本仓库的技术核心）

**任何项目**都禁止 grep 旧代码找权威实体：未限定单仓时先 `ctx find-scenes <关键词>` 取端到端全景，再 `ctx discover "<意图>"` 按结果读 card，**每条来自 card 的事实必须附 cite（path#anchor @确认时间），无 cite 视为幻觉**。查不到**不等于**"这个项目不用卡片"，只意味着这个模块的卡片还没建：读源码（有代码图谱走图谱，没有就把重探索外包给子代理）+ **读完当场补卡**，随本次任务分支提交，MUST NOT 顺延。判据在无条件常驻的 `references/core/代码事实纪律.md`。这一层与协作面、与有没有代码图谱都无关。

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
  assets/templates/                change-prd（主）/ lite-issue-prd / product-prd / ui-prototype
ai-dev-system/skills/ai-dev-workflow/
  SKILL.md                         skill 入口：路由三步（探测代码图谱 / 读协作面 / 加载）+ 初始化
  references/core/                 共享内核，分三层加载：
    00-流程总纲.md                 骨架（常驻）：Triage + 四道门 + 步骤索引
    路径-lean.md / 步骤-1-7-*.md / 步骤-8-10-*.md   分册，按分流与阶段加载
    代码事实纪律.md                常驻：先查卡片 / 没卡就读源码并当场补卡 / cite / 新鲜度
    其余                           常驻纪律（worktree / 写作 / 文档治理 / 用户沟通 / 上下文卫生）
                                   + 条件加载纪律（AI overlay / bug 诊断 / 代码评审 / 测试资产 /
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
- 流程内核与骨架：`ai-dev-system/skills/ai-dev-workflow/references/core/`、`ai-dev-system/skills/ai-dev-workflow/references/core/00-流程总纲.md`
- 必备的代码事实层纪律：`ai-dev-system/skills/ai-dev-workflow/references/core/代码事实纪律.md`、`ai-dev-system/skills/ai-dev-workflow/references/core/engineering-context设计.md`
- 两个可变维度的分册：`ai-dev-system/skills/ai-dev-workflow/references/collab/`（协作面，必选一份）、`ai-dev-system/skills/ai-dev-workflow/references/capability/`（代码图谱，探测到才加载）
- 模板与注入片段：`ai-dev-system/skills/ai-dev-workflow/assets/templates/`、`ai-dev-system/skills/ai-dev-workflow/assets/config-snippets/`、`ai-dev-system/skills/ai-dev-workflow/assets/context-layer/`
- `ctx` CLI 本体：`ai-dev-system/skills/ai-dev-workflow/scripts/ctx/src/cli.js`

## 安装器的关键设计（`install.mjs`）

默认安装源是 `https://github.com/weidwonder/ai-dev-system.git` 的 `main` 分支。安装后会在目标项目 `.gitignore` 幂等追加标记块（`# ai-dev-system:gitignore:start/end`），按 skill 名逐条忽略 `.claude/skills/<name>/`、`.agents/skills/<name>/` 与版本 stamp，避免本体系随目标仓库提交，且不误伤用户自己的 skill。安装器先把 `--repo` / `--ref` 指定的版本拉到系统临时目录，确认其中存在有效 skill 后，才读取并修改目标项目；下载或源校验失败时目标项目保持不变，临时目录在成功、取消、预演和异常场景都会清理。`--source-dir` 仅用于验证当前工作区未发布内容，不是正式安装路径。

装 skill 时会在**目标项目级** settings 里把 4 个 Claude Code 冲突插件（`superpowers`、`everything-claude-code`、`oh-my-claudecode`、`general-task`）设为 `false`——它们的 brainstorming HARD-GATE、强制前置 skill、端到端引擎、SessionStart 注入会截胡本流程。原理：Claude Code settings 优先级 `Managed > Local > Project > User`，项目级 `false` 覆盖用户级 `true`，于是**只在本项目禁用，不影响全局**。默认写 `.claude/settings.local.json`（gitignored），`--shared` 才写 `.claude/settings.json`。合并时**不覆盖** `enabledPlugins` 里的其他键。

`CLAUDE.md` / `AGENTS.md` 允许是软链接（两个工具共用一份指导文件的常见做法）：安装器逐层解析到实体文件再按标记块写入，链接本身保留；两个入口解析到同一实体时只写一次；断链在复制任何 skill 之前就报错退出，目标项目零改动；全局卸载分支也不删作为入口的链接。skill 侧的同一套规则在 `ai-dev-workflow/references/init-初始化.md` §入口是软链接时，改一处要两处同改。

**标记块的迁移改写**（2.0.0 起）：旧安装的块里只有 `mode="personal|team"`，安装器把它就地改写成新字段（`collaboration` / `merge-gate` / `worktree-dir`），并在改写**前**打印「旧：… / 新：…」前后对照（`--dry-run` 也打印），逐条说明协作面与合并方式是**推断**出来的、不对就改这一行，以及**代码事实的供给方式不由这份声明决定**——代码事实层是必备资产、与这份声明无关，代码图谱则在每次唤起时探测得出。旧 `mode` 只映射协作面（`team` → team + pr，其余 → solo + direct），**绝不由它推出别的任何东西**（否则等于把已废弃的二分从数据里复活）。`mode="team"` 仍会被写回，那是给尚未升级的旧 skill 认的墓碑，`3.0.0` 移除。两个入口的四种混合状态一律**以 `CLAUDE.md` 为准**：两边都新 / 两边都旧 / `CLAUDE.md` 新而 `AGENTS.md` 旧 / `CLAUDE.md` 旧而 `AGENTS.md` 新——最后一种也按 `CLAUDE.md` 解析，随即被同一次迁移改写补成新字段，再幂等同步到另一个入口；有块却读不出任何已知字段就报错中止（宁可停，不猜）。还有一条反向的 **stamp 比对**：块已是新格式、而目标 skills 目录的版本 stamp 低于新字段起始版本（`WORKFLOW_FIELD_MIN_VERSION = 2.0.0`）时显式警告"skill 版本落后于配置"并提示每个协作者各自重跑一次（配置入库、skill 不入库，这种落后是多人项目的常态），不静默继续。

skill 复制完成后，安装器把 skill 自带的 **`ctx` CLI 链接成全局命令**：在 `<目标>/.claude/skills/ai-dev-workflow/scripts/ctx` 下 `npm link`（只用 `.claude/` 这一份，`.agents/` 是逐字节相同的副本，两份都 link 只会互相覆盖同一个全局命令），随后**实跑 `ctx --help` 并匹配签名串**才报成功——`npm link` 退出码为 0 只说明 shim 写出去了，不代表它落在 PATH 上、也不代表跑起来是我们这一个。做这件事的原因是：skill 文档通篇写 `ctx <命令>`，而此前安装器对 ctx 毫无处理，`which ctx` 为空会让使用者（尤其是 AI agent）把"命令找不到"误读成"Engineering Context 不可用"，退化成裸 grep——那正是任何项目里都明令禁止的行为。三类失败（link 失败 / 链完仍不在 PATH / PATH 上已有**别人的**同名 `ctx`）一律只降级为警告，并打印 `node <skill>/scripts/ctx/src/cli.js <命令>` 兜底方式；同名命令**绝不覆盖**。`--no-ctx-link` 跳过整段。全局命令指向最后一次安装的那个项目里的副本，靠"ctx 按 cwd 找 `engineering-context/`"做到一份命令服务所有项目。

安装的最后一段是 **codegraph**（`github.com/colbymchenry/codegraph`，本地代码知识图谱 CLI）：本机没有就 `npm install -g @colbymchenry/codegraph`（npm 是唯一跨平台可依赖的装法，Node 本就是安装器前提），已有则用它自己的 `codegraph upgrade` 升级——它认得 bundle/npm/npx 三种装法并原地更新，盲目 npm 装会在独立包安装的机器上留下抢 PATH 的第二份副本；`upgrade --check` 报告"已是最新"就跳过，太旧而没有 `upgrade` 子命令时退回 `npm install -g <pkg>@latest`；检测本身失败（真机上升级刚完成时偶发）就盲升，**升级结果以升级前后的版本号为准报告**——`upgrade` 退出码为 0 只说明命令跑通了，不代表真换了版本。随后 `codegraph install --target=auto --location=local --yes` 接线（默认项目级；**Codex CLI 没有项目级 MCP 配置，必然被跳过**，所以安装器显式打印手动全局接线命令，`--codegraph-location=global` 可改范围），最后 `.codegraph/` 不存在时 `codegraph init` 建索引，并以 `.codegraph/codegraph.db` 是否存在判定索引真的建成（旧版 `init` 只初始化不索引，缺了就补跑 `codegraph index`）。所有子进程 stdin 一律 `ignore`：codegraph 按 `process.stdin.isTTY` 决定要不要发问，关掉就锁定非交互分支，安装器不会被子命令提问挂住。整段任何失败只降级为警告，不影响已完成的 skill 安装；`--no-codegraph` 整段跳过。

Codex 安装默认不修改用户级全局插件配置，而是在目标项目 `AGENTS.md` 写入并校验 `ai-dev-system:codex-conflicts` 标记块，约束 `superpowers:` 不要自动加载或主动触发，除非用户在当前对话明确要求。交互安装可明确选择全局卸载，自动化安装使用 `--codex-conflicts=uninstall`；该选择影响当前用户的所有项目。若 `CLAUDE.md` 或 `AGENTS.md` 已有 workflow 标记块，安装器会幂等补齐另一入口。`--keep=superpowers` 会保留 Claude Code 插件，并移除安装器此前写入的 Claude 禁用项与 Codex 约束块。

## 改动时注意

- 改 skill 行为 → 改对应 skill `references/` 下 markdown；改模板 → `assets/templates/`；两者是 skill 的"源码"。改前后过一遍 `docs/spec/2026-07-16-skill写作自检清单.md`（信息层级 / 六大失败模式 / 交叉引用同步）。新增 skill 只要放进 `ai-dev-system/skills/<name>/` 并含 `SKILL.md`，发布到安装源后 `install.mjs` 会自动发现并复制，无需改安装器；发布前用 `--source-dir=.` 验证。
- 用户沟通必须使用业务语言：大架构交给用户确认，模块内设计只问业务问题，详细程序设计不要求用户确认；`ai-prd` 的对话与成稿不得包含程序实现。
- 进入 workflow 后，任何文档或代码落盘前必须按 `references/core/worktree开发纪律.md` 建立独立 worktree；Lean 也不例外。全部门禁通过后自动合并主分支，失败保留 worktree，禁止处理主工作树的用户改动或绕过保护分支。
- **`agentic-principle` 是外部伴生技能，严禁把它的内容搬进本仓库**：它管 Agent 系统**怎么设计**（场景选型/提示词/工具边界/注意力与并发预算/长产物分区/步骤级测试与评测），本体系的 `AI-LLM-overlay.md` 只管**运行期 AI 契约**（确定性边界/版本 pin/输出校验/置信度路由/安全管线/降级/预算准入/eval 门/可观测/数据边界/可审计）。两边只用指针互引，各自独立演进。安装器把它装到**用户级** `~/.claude/skills/` 与 `~/.codex/skills/`（`install.mjs` 的 `COMPANION_SKILLS`；注意两侧目录不对称——`.agents/` 只是 Codex 的**项目级**目录，用户级是 `~/.codex/`），每次运行检查远端版本、更旧才更新，symlink 或 git 工作区只报告不覆盖，拉取失败降级为警告；改这条链路要同改 `install.mjs`、`AI-LLM-overlay.md` §Agentic 应用、`代码评审纪律.md` 的 E 轴（2.3.0 前叫 D 轴，编号让给了新增的文档轴）、`assets/config-snippets/base.md`（agentic 条目只在 base 一处，与协作面无关，MUST NOT 复制进 `collab-*.md`），并跑 `node --test test/companion-skill.test.mjs`。
- **`codegraph` 是外部工具，同样严禁把它的内容搬进本仓库**：它给的是**现状代码事实**（符号源码、调用链、影响面，随文件变更 auto-sync），Engineering Context 给的是**权威口径**（card + cite）；两者不互相替代也不同级——代码图谱管"找得到吗"，是**可选的检索加速面**（探测到索引才启用，装不上或索引建不成就降级为外包子代理）；代码事实层管"信哪个"，是**无条件必备的地基**（缺卡片就当场补，MUST NOT 因为有图谱就不补卡）。2.0.0 起 codegraph 的索引 `.codegraph/codegraph.db` 是**代码图谱的探测依据**，因此它出现在 `references/capability/graph.md` 里，但只以"何时用它 / 它给什么 / 不可用怎么办"三句声明的形式出现：它是**非硬依赖**（命令跑不起来就回退到子 agent 外包重探索，MUST NOT 阻断流程、MUST NOT 退回裸 grep），`graph.md` MUST NOT 扩写成 codegraph 使用手册，其安装与命令细节仍不进本仓库，也不进任何 config-snippet（代码图谱是探测结果，写进静态配置就会漂移）。改这条链路（`install.mjs` 的 `CODEGRAPH` 常量与 `syncCodegraph` 一族函数）要同改 CLAUDE.md §安装器的关键设计、`references/capability/graph.md` 与 `docs/spec/2026-08-14-codegraph自动安装与索引-lean-change-spec.md`，并跑 `node --test test/codegraph.test.mjs`。测试用**假 codegraph + 假 npm 放进收窄的 PATH**，绝不能让任何测试去动跑测试这台机器的全局安装——新增会调用安装器的测试记得带 `--no-codegraph`。
- **卡片必备与渐进补齐是跨文件的契约**（2.1.0 的核心）：权威定义在无条件常驻的 `references/core/代码事实纪律.md`（一句话规矩 = 要用某个模块的事实就先查卡片，没有卡片就读源码、读完当场补上；最小形态四项在 §4.1）。触发点分布在七处：`00-流程总纲.md` §默认倾向（判据 3/4 MUST NOT 读成"卡片里查不到就算说不清"）与 §七条"不裁剪"护栏第 7 条（补卡不裁剪）、`init-初始化.md` 第 5b 步（在 worktree 内跑 `ctx init` 建整套骨架，MUST NOT 跑 `--minimal`、MUST NOT 问用户要不要建）、`步骤-1-7-设计与实现.md` Step 1〈既有系统清单〉、`路径-lean.md`（Lean 也不豁免）、`代码评审纪律.md` 的残留轴（读过源码却没补卡即为残留）、`上下文卫生.md` 规则 4（没有代码图谱时把重探索外包子代理，MUST NOT 主会话裸 grep）、`assets/config-snippets/base.md`（注入目标项目的那条无条件声明）。改判据要沿这条链同改，并跑 `node --test test/cards-mandatory.test.mjs`。两个易错点：**①"没有卡片"MUST NOT 被处置成"可以直读源码交差"**——读源码只是第一步，补卡与提交是同一次任务的一部分，顺延即等于没执行；**②代码图谱 MUST NOT 被当成卡片的替代品**——它答"找得到吗"，不答"信哪个"，两者冲突时以卡片为准。
- **替换清单是跨文件的契约**：登记在 spec（`eng-spec.md` §8.2 / `lean-change-spec.md` 替换清单节）、拆成任务在 `coding-plan.md` 核销表、核销在 `代码评审纪律.md` 的残留轴。改判据（该删什么、保留例外认哪几类理由）要四处同改，且与 `eng-spec.md` §8.1 兼容取舍的到期日保持一致——两处日期不一致就是漏洞。
- **文档轴是跨文件的契约**（2.3.0 新增）：代码评审门的 **D 文档轴**恒跑，参照物是 `docs/` 的现行文档与真相源，权威定义在 `references/core/代码评审纪律.md` §四条轴 + §子代理 prompt 模板的文档轴职责段；**判据本身不在那里**——什么算触碰权威面、失准了怎么归档、仍准确怎么留痕，权威定义仍在 `文档治理.md` §3，D 轴只是**执行者**。改这条链路要同改这些落点（**数量以 `grep -rn "三轴\|四轴" ai-dev-system/skills/` 的实际结果为准，MUST NOT 按记忆中的数字收工**）：`代码评审纪律.md`（轴表 + 门禁的子代理数 + prompt 模板）、`文档治理.md` §3（触发点归属）、`worktree开发纪律.md` §完成与自动合并门（核对形态那两条）、`00-流程总纲.md`（门表 + §代码评审门 + §"不裁剪"护栏第 4 条）、`路径-lean.md`、三个模板与 `config-snippets/base.md` 的轴数，外加 `SKILL.md`（目录树 + 常见场景表 + frontmatter description）、`collab/{solo,team}.md`、`上下文卫生.md`、`config-snippets/collab-solo.md`、姊妹 skill 的 `ai-prd/references/prd复核纪律.md`，并跑 `node --test test/doc-axis.test.mjs`。四个易错点：**①轴数计数词散在十几个文件**，改一处漏一处不会报错——`grep -rn "三轴\|四轴" ai-dev-system/skills/` 全仓扫；**②D 轴 MUST NOT 设触发条件**，让主会话先判"本次有没有碰文档"等于把最容易漏的判断交给最容易漏的人（改语义不删东西同样让文档失准，而这类改动替换清单往往为空）；**③`ctx probe` 是 SHOULD 辅助不是门禁**，它的 B 类题型只验可达性与 `authority_refs` 非空、不读正文，**probe 全绿 MUST NOT 读成文档还准**；**④agent 架构轴 2.3.0 起叫 E 轴**，判据没变只让了编号。
- **文档生命周期是跨文件的契约**：判据与字段的权威定义在 `references/core/文档治理.md` §文档生命周期与索引门控（`lifecycle` / `last_confirmed` / `authority_refs`、索引分层、按权威面触发），落地写法（归档头注、结算示例、账本收敛）在条件加载的 `references/core/文档归档与账本收敛.md`，结算的**判定**在代码评审门的 D 文档轴、**落盘**由主会话当场做（见上一条），`worktree开发纪律.md` §完成与自动合并门与 `00-流程总纲.md` 只**核对**结论，字段落在五个 spec/plan 模板与三类 PRD 模板的 frontmatter，账本入口在 `bug诊断纪律.md` Phase 0/3 与 `测试资产纪律.md` §3，PRD 侧对应 `ai-prd` 的 §PRD 生命周期与 `UI原型纪律.md` §4.5。改判据要沿这条链同改。两个易错点：**①触发面是"本次触碰的权威面"，与刷 card 同源但更宽**（多出的几类是文档层专有、不触发刷卡，其中「流程与门禁契约」专管门/轴/步骤/准出项的语义；**权威清单只有一份，在 `文档治理.md` §3 第 1 步，以表内「也触发刷卡？」列为准，MUST NOT 在别处另记数字**），**MUST NOT 退化成"照抄替换清单"**——只改语义不删东西（枚举加值、可选改必填）的改动替换清单为空，却同样让文档失准；**②字段名是 `lifecycle` 不是 `status`**——`lean-change-spec` 的 `写作进度` 与 `product-prd` frontmatter 的 `status` 都已占用后者语义。
- **测试资产目录约定**：探测项目既有测试目录优先，兜底 `tests/fixtures/<场景名>/`；凭证进同级 `secrets/`（gitignore）+ `secrets.example/`（入库）。权威定义在 `references/core/测试资产纪律.md` §2，`test-spec.md` §4 Fixture 表与 `文档治理.md` 的表格引用它，改约定要三处同改。
- **UI 原型是跨 skill 的契约**：`ai-prd` 涉及用户可见界面时产出 `docs/spec/<name>-prototype-YYYYMMDD.html`（单文件、零外链、可离线打开），`ai-dev-workflow` 的 Step 1/2/4/8 把它与 PRD 一并作为输入。改这条链路要三处同改：`ai-prd/references/UI原型纪律.md`（权威定义）、三类 PRD 模板的「UI 原型」五项表、`ai-dev-workflow/references/core/00-流程总纲.md` 的输入声明与参考 prompt。
- **PRD 复核门是跨文件的契约**（2.2.0 新增）：权威定义在 `ai-prd/references/prd复核纪律.md`（为什么派子代理 / 门禁与分流 / 两轴表 / prompt 模板 / 三个出口），触发点在 `00-prd生成流程.md` §组稿 **第 4 步**，接线分布在五处：`ai-prd/SKILL.md`（目录树 + 路由第 5 步 + §关键纪律的复核门与落盘确认门两条）、`prd质量清单.md` 顶部的分工说明、`collab/solo.md` §3 第 4 条与 §6 表、`collab/team.md` §3 与 §5 表、`assets/question-bank.md` §追问触发 的两条 `[组稿·复核后]` 条目。四个易错点：**①复核门在落盘确认门之前，不是之后**——它查出的冲突几乎全要用户拍板，落在后面等于让用户在信息不全时确认；**②三个出口的分流判据是"事实错了回去补，取舍待定才给用户"**，MUST NOT 把"现状节失实"摆进落盘门当取舍——用户此刻手里没有卡片也没有源码，只能点头；**③它与 `prd质量清单.md` 参照物不同**（清单查模板骨架，复核查 PRD 自身与现有系统），两者 MUST NOT 互相顶替。**④`[组稿·复核后]` 是 `[组稿]` 的子类、勾验时机在门后**（第 3 步跑质量清单时 MUST NOT 勾验，那时门还没跑），标签枚举散在三处——`question-bank.md` §追问触发 的说明 + `00-prd生成流程.md` §4 批提问 的标签清单 + `SKILL.md` 路由第 4 步，改一处要三处同改。改组稿步骤编号时全仓 `grep -rn "§组稿 第 [0-9]"` 同步，编号散在四个文件里。改这条链路后跑 `node --test test/prd-review-gate.test.mjs`。
- `ai-prd` 的北极星参考物是 `orgin/prd.demo/` 下的变更 PRD 范例（brownfield 变更 PRD 骨架，本地参考、不入库）；改 `change-prd.md` 模板前对照设计文档 `docs/spec/2026-07-06-ai-prd-design.md §7` 的覆盖度映射，别丢节。
- 改 `ctx` 逻辑 → 同步更新仓库根 `test/ctx-*.test.mjs`（fixtures 在 `test/fixtures/ctx-engineering-context/`），跑 `node --test test/*.test.mjs` 保持全绿。**测试与 fixtures 刻意放在 skill 目录之外**：`install.mjs` 整目录复制 skill，放在里面会把 1.4k 行对使用方无用的测试装进每个目标项目。card/registry 的格式约定见 `scripts/ctx/README.md` §card 格式约定，解析器依赖它。
- **`ctx` 的"能不能直接敲"是跨文件的契约**：安装器负责 `npm link`（`install.mjs` 的 `CTX` 常量与 `syncCtx` 一族函数），文档负责在链接失败时把人和 AI 引到兜底调用方式而不是 grep。改这条链路要同改 `install.mjs`、CLAUDE.md §安装器的关键设计、`references/core/代码事实纪律.md` §2 调用方式、`assets/config-snippets/base.md` 末尾那四条无条件条目（维护 engineering-context / 取事实的固定顺序 / 查不到就当场补卡 / `ctx` 找不到时的兜底调用）、`scripts/ctx/README.md` §安装/运行 与 §测试、两个 README 的安装器职责清单与 `ctx init` 示例，并跑 `node --test test/ctx-link.test.mjs`。判定 ctx 是否为"我们这一个"依赖 `ctx --help` 首行的签名串 `Engineering Context CLI`——改 `cli.js` 的 HELP 首行会静默打断这个判定，两处同改。测试同样用**假 npm + 假 ctx 放进收窄的 PATH**，新增会调用安装器的测试记得带 `--no-ctx-link`。
- 改 `assets/context-layer/` 模板 → 同步 `scripts/ctx/src/commands.js` 内对应的 init stub（脚手架用的精简副本），反之亦然；两处漂移会让 `ctx init` 生成物与文档教的模板不一致。
- 本仓库自身与安装目标的文档目录固定为：spec → `docs/spec/`，plan → `docs/plan/`，report → `docs/report/`。
- **版本管理**：分发版本在 `ai-dev-system/VERSION`（旧无 stamp 安装追认为 1.0.0）。凡改变已安装项目的行为契约或目录约定就 bump；需要用户动作的升级必须同时新增 `ai-dev-system/migrations/<新版本>.md`（安装器会在升级时高亮全文打印，指南保持一屏内）。安装器把版本 stamp 写入目标两个 skills 目录的 `ai-dev-system.version`。**每次版本变更合入 main 后必须打 annotated tag `v<版本>`**（如 `v1.1.0`），tag 与 VERSION 始终一致，供 `--ref=v<版本>` 锁版本安装与回溯。机制详见 `docs/spec/2026-07-16-skill版本管理与迁移机制.md`；改动后跑 `node --test test/installer-migration.test.mjs`。
