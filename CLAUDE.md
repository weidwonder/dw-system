# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 这个仓库是什么

**这是一个 AI 辅助开发方法论的分发包**，不是一个应用。它交付两个 Claude Code / Codex 通用的 **skill** 加一个零依赖的 **CLI**（`ctx`），把需求逐层降解成"零上下文 AI agent 也能可靠执行"的任务：

- `ai-prd` —— 从零**产出 PRD**（批量提问 + 阶段化 elicitation），补 workflow 的前置空缺。
- `ai-dev-workflow` —— 从**已有 PRD** 起步，走 Triage → Overview → Spec → Coding Plan → 测试。

`ai-prd` 的产物正是 `ai-dev-workflow` Step 1 的输入，两者松耦合。

核心信念（贯穿全部设计）：AI coding 能否落地，秘密不在流程本身，而在**能不能给 AI 一层可信、新鲜、权威的代码事实**——Engineering Context 层（**权威位**）正是为此而生。

> `orgin/` 与 `orgin.bak/` 是朋友公司的原始体系，被 `.gitignore` 忽略，**勿推送、勿作为交付的一部分**。它们只是本体系的裁剪来源参考。

## 常用命令

```bash
# ctx CLI 的单元测试（Node 内置 test runner，零第三方依赖，需 Node ≥20）
cd ai-dev-system/skills/ai-dev-workflow/scripts/ctx && node --test

# 跑单个测试文件
cd ai-dev-system/skills/ai-dev-workflow/scripts/ctx && node --test test/cli.test.js

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

# 安装器全部测试（含 codegraph 那段，用假 CLI 跑，不碰本机全局安装）
# 必须写通配符：Node ≥22 下 `node --test test/` 会把目录当模块解析，报 MODULE_NOT_FOUND
node --test test/*.test.mjs
```

没有 build 步骤、没有 lint 配置、没有 npm 运行时依赖——整个包是纯 Node.js ESM + markdown；安装器额外调用 Git 获取发布源。

## 架构：三层 + 一条铁律

**交付单元是 `ai-dev-system/skills/` 下的两个 skill（`ai-prd` + `ai-dev-workflow`）。** 二者共享同一套约定（同一份路由三步、references+assets 结构、复用 `ai-dev-workflow` 的标记块）。`ai-prd` 是 workflow 的前置产 PRD 阶段，结构见 `ai-dev-system/skills/ai-prd/`（纯 markdown，无代码）。下文以 `ai-dev-workflow` 为主展开，抓三点：

### 1. skill 按两个正交维度加壳（`SKILL.md` 是入口）

内核（`references/core/`）**无条件常驻**，在它之上按两个**互不蕴含**的维度追加分册。每次调用先走**路由逻辑**（见 `SKILL.md` §路由逻辑），三步：

1. **探测能力位**——看项目自己现在有哪些代码事实资产。`.codegraph/codegraph.db` 存在 → **图谱位**（回答「找得到吗」：符号、调用链、影响面）；`engineering-context/capability-registry.md` 存在且除模板占位外至少有一行真数据 → **权威位**（回答「信哪个」：同一能力多处实现时哪处权威）。两位正交，四种组合（无 / 仅图谱 / 仅权威 / 两者）都合法。
2. **读协作面**——目标项目根 `CLAUDE.md`（优先）或 `AGENTS.md` 里的 `<!-- ai-dev-workflow:start --> … collaboration="solo|team" merge-gate="direct|pr" worktree-dir="./.worktrees/" … <!-- ai-dev-workflow:end -->` 标记块。**无标记块** → 初始化（`references/init-初始化.md`）：只问一个问题（除你之外还有没有人一起开发）+ 一条待拍板的 merge-gate 建议，**能力位不问**。
3. **加载**——core 常驻六篇 + `references/collab/{solo,team}.md` 必选一份 + `references/capability/{graph,curated}.md` 命中几篇加几篇（可零篇）。

**为什么一个探测、一个设字段**：判据是"**探测得出来的不设字段，探测不出来的才设字段**"。资产是文件系统里的客观事实，写成配置就会漂移——项目长大、card 烂尾、索引被删，配置都不会自己变，于是要再造升档/降档/一致性校验三套装置去对抗自己造出来的漂移；探测的结论永远与项目当下状态一致。而"除你之外有没有人一起开发"文件系统里没有，只能问一次并固化。

**两个维度 MUST NOT 互推**（这是本次重构的由来）：2.0.0 之前只有一个「项目类型」开关，同时决定"要不要对齐 owner、走 PR"和"代码事实怎么取"。这两件事经常错配——单人维护的十万行遗留系统被判为轻量档，于是 AI 直接 grep 旧代码；三个人的新项目被判为重档，于是被要求维护一整套自己用不上的资产。现在协作面只管人怎么协作，能力位只管代码事实怎么取，各自独立成立。

初始化的幂等规则很关键：**只替换标记块内内容，绝不重复追加**；标记用 HTML 注释，机器可精确定位、对 markdown 渲染无影响。注入片段由 `assets/config-snippets/base.md`（无条件）+ `collab-{solo,team}.md`（二选一）拼装，`CLAUDE.md` **和** `AGENTS.md` 两个都写（兼容 Claude Code + Codex）。块里还留着 `mode="team"` 是**墓碑**：新 skill 完全忽略它，留着只为让尚未升级的旧 skill 不硬失败，`3.0.0` 移除；只有块内没有 `collaboration` 时才用旧值推协作面（team → team+pr，其余 → solo+direct），**MUST NOT 由旧值推出任何能力位**。

### 2. 流程内核（`references/core/00-流程总纲.md`）

技术栈无关的 10 步流程 + Step 0 Triage 分流：

- **Triage 的 4 个判定问题**（AI/LLM 行为？鉴权安全设备？跨服务/迁移/不可逆？指标/业务规则/对外承诺？）——4 项全否走一页 **Lean Change Spec** 直接实现；任一为是升级回完整流程。
- 四问都不触发时还有个**默认倾向**，它由**能力位**决定、MUST NOT 由协作面决定：无能力位 → 默认走 Lean，只有确实 hold 不住才升级；含权威位 → 影响面说不清时宁可升级、出 Overview（registry 里存在条目，本身就是"这个项目出现过实现歧义"的证据，此时"我觉得改动很小"不可信）。跨仓需求一律升级。
- 含 AI/LLM 功能时，在基础 spec 上**叠加** `references/core/AI-LLM-overlay.md` 的 AI 契约（判定边界见该文件）。判定为 **Agentic 应用**时另需加载**独立技能 `agentic-principle`**（见下）。
- 所有文档遵循 `references/core/spec写作纪律.md`：零上下文可动手、RFC2119、无占位符。
- 10 步之外还有**四道贯穿两条路径的门**（Lean 也不豁免）：worktree 隔离门 → 兼容取舍确认门（spec 定稿前，用户逐条拍板是否向后兼容）→ 代码评审门（编码后，子代理跑规范/忠实/残留三轴）→ 完成与自动合并门。门的位置见总纲流程总览图。

### 3. 权威位的 Engineering Context 层 + `ctx` CLI（本仓库的技术核心）

探测到权威位的项目禁止 grep 旧代码找权威实体，必须先 `ctx discover "<意图>"` 再按结果读 card，**每条来自 card 的事实必须附 cite（path#anchor @确认时间），无 cite 视为幻觉**。这一层与协作面无关：一个人的项目照样可以有权威位，多人项目也可以一位都没有。

`ctx` CLI（`scripts/ctx/`）读本地 `engineering-context/` 目录（项目里 `ctx init` 生成；只想起步就 `ctx init --minimal`，只落一份 `capability-registry.md`，先把出过问题的能力写成三行），三层清晰分离：

- `src/cards.js` — 纯读取/解析层：`splitSections`（按 `## 标题` 切段）、`loadCards`（`cards/<repo>.md`，文件名即 service 名）、`loadRegistry`（解析 `capability-registry.md` 的 markdown 表格，取表头首列含 `Capability` 的那张表；**列按表头名映射，不按列序**——registry 的最小合法形态只有三列，缺列跳过不报错，模板占位行 `【…】` 不算已登记）、`makeCite`。
- `src/commands.js` — 命令/匹配层：`discover`（关键词 tokenize + 命中打分，**结果分两路**：registry 直接命中的能力条目 + card 命中，registry 中指向某 card 的能力命中时给该 card 加权）、`getCard`、`findScenes`、`listServices`、`initScaffold`（`--minimal` 只生成 registry，其余生成整套骨架）。
- `src/cli.js` — argv 解析 + 路由 + 人类/`--json` 双输出。
- `src/semantic.js` — `search-semantic`：零依赖本地向量相似（字符 bigram 余弦 + 可选 synonyms）；结果带 freshness/cite + 权威指针，`--as-of` 启用过期降权。是 discover 未命中时的兜底。
- `src/probe.js` — `probe`：Frozen Probe Set 防腐门禁，机器可判题型 + 门禁自检（植入必错样本）+ 棘轮（新增失败 RED / 基线内 AMBER）+ 衰减报告；`--json` 退出码供 CI（RED/GATE-BROKEN=1）。题型分两类：**A 类**读 cards/registry（`capability-mapping` / `deprecated-trap`）；**B 类**读项目自身文件，是"零上下文交接"目标的可验证形式（`requirement-reachable` / `architecture-reachable` / `implementation-usable` / `rationale-traceable`——真相源从入口文档 ≤2 跳可达、架构节列出的模块路径都存在、索引现行区各 spec 的 `authority_refs` 非空）。B 类不依赖 context 层，所以直读项目也能有真门禁；自检会额外植入一道指向不存在真相源的必错交接题。

**跨平台是硬约束**：全程用 `node:path`、UTF-8、`os.tmpdir()`，无 bash-only 语法，零第三方依赖。改 `ctx` 时必须保持这些。

**Engineering Context 的真相方向铁律**（改任何 context 层相关内容前必读 `references/capability/context-engineering.md` §3）：**card 事实以合入后的源码为准，绝不能从 PRD 生成 card 事实**（PRD 描述意图，意图常与已落地事实背离）。新鲜度**按是否触碰 Authority Surface 触发，而非变更行数**（3 行的路由 V1→V2 必须刷，2000 行内部功能不碰接口可不刷）。

## 目录速查

```
install.mjs / install.cmd          安装器：拉取 GitHub 发布源 + 安装 skills + 项目级冲突约束 + ctx 全局链接 + codegraph 保新/接线/建索引
docs/{spec,plan,report}/           本体系自身的规范 / 计划 / 报告
ai-dev-system/skills/ai-prd/        产 PRD skill：批量提问 elicitation + 三类模板
  SKILL.md                         入口：探测能力位 → 读协作面 → PRD 类型分流 → 4 批提问驱动
  references/                      PRD 流程 / 业务语言纪律 / 写作纪律 / UI 原型纪律 / 质量清单
  references/collab/               solo.md / team.md（按协作面二选一）
  assets/templates/                change-prd（主）/ lite-issue-prd / product-prd / ui-prototype
ai-dev-system/skills/ai-dev-workflow/
  SKILL.md                         skill 入口：路由三步（探测能力位 / 读协作面 / 加载）+ 初始化
  references/core/                 共享内核，分三层加载：
    00-流程总纲.md                 骨架（常驻）：Triage + 四道门 + 步骤索引
    路径-lean.md / 步骤-1-7-*.md / 步骤-8-10-*.md   分册，按分流与阶段加载
    其余                           常驻纪律（worktree / 写作 / 文档治理 / 用户沟通 / 上下文卫生）
                                   + 条件加载纪律（AI overlay / bug 诊断 / 代码评审 / 测试资产 /
                                     文档归档与账本收敛 / 资产补建信号）
  references/collab/               solo.md / team.md（按 collaboration 字段二选一，必加载一份）
  references/capability/           graph.md / curated.md（按探测结果加载，可零篇）
                                   + context-engineering.md（权威位资产层完整设计）
  references/init-初始化.md         幂等写入 CLAUDE.md/AGENTS.md 的规则
  assets/templates/                spec/plan/test/overview/lean-change-spec/test-coverage 模板
  assets/config-snippets/          注入 CLAUDE.md/AGENTS.md 的片段：base（无条件）+ collab-solo/collab-team
  assets/context-layer/            capability-registry/card/scene-blueprint/probe-set/glossary 模板
  scripts/ctx/                     ctx CLI（src/ + test/ + fixtures/）
```

同一批路径的可点形式（上面的树给人看，下面这份给机器抽——`ctx probe` 的 `implementation-usable` 只认反引号代码片段与相对链接，抽不到路径直接判失败）：

- 安装器与其测试：`install.mjs`、`install.cmd`、`test/`
- 本体系自身文档：`docs/spec/`、`docs/plan/`、`docs/report/`，索引 `docs/index.md` 与 `docs/index-archive.md`
- 版本与迁移：`ai-dev-system/VERSION`、`ai-dev-system/migrations/`
- 两个 skill 的入口：`ai-dev-system/skills/ai-prd/SKILL.md`、`ai-dev-system/skills/ai-dev-workflow/SKILL.md`
- 流程内核与骨架：`ai-dev-system/skills/ai-dev-workflow/references/core/`、`ai-dev-system/skills/ai-dev-workflow/references/core/00-流程总纲.md`
- 两个正交维度的分册：`ai-dev-system/skills/ai-dev-workflow/references/collab/`（协作面）、`ai-dev-system/skills/ai-dev-workflow/references/capability/`（能力位）
- 模板与注入片段：`ai-dev-system/skills/ai-dev-workflow/assets/templates/`、`ai-dev-system/skills/ai-dev-workflow/assets/config-snippets/`、`ai-dev-system/skills/ai-dev-workflow/assets/context-layer/`
- `ctx` CLI 本体：`ai-dev-system/skills/ai-dev-workflow/scripts/ctx/src/cli.js`

## 安装器的关键设计（`install.mjs`）

默认安装源是 `https://github.com/weidwonder/ai-dev-system.git` 的 `main` 分支。安装后会在目标项目 `.gitignore` 幂等追加标记块（`# ai-dev-system:gitignore:start/end`），按 skill 名逐条忽略 `.claude/skills/<name>/`、`.agents/skills/<name>/` 与版本 stamp，避免本体系随目标仓库提交，且不误伤用户自己的 skill。安装器先把 `--repo` / `--ref` 指定的版本拉到系统临时目录，确认其中存在有效 skill 后，才读取并修改目标项目；下载或源校验失败时目标项目保持不变，临时目录在成功、取消、预演和异常场景都会清理。`--source-dir` 仅用于验证当前工作区未发布内容，不是正式安装路径。

装 skill 时会在**目标项目级** settings 里把 4 个 Claude Code 冲突插件（`superpowers`、`everything-claude-code`、`oh-my-claudecode`、`general-task`）设为 `false`——它们的 brainstorming HARD-GATE、强制前置 skill、端到端引擎、SessionStart 注入会截胡本流程。原理：Claude Code settings 优先级 `Managed > Local > Project > User`，项目级 `false` 覆盖用户级 `true`，于是**只在本项目禁用，不影响全局**。默认写 `.claude/settings.local.json`（gitignored），`--shared` 才写 `.claude/settings.json`。合并时**不覆盖** `enabledPlugins` 里的其他键。

`CLAUDE.md` / `AGENTS.md` 允许是软链接（两个工具共用一份指导文件的常见做法）：安装器逐层解析到实体文件再按标记块写入，链接本身保留；两个入口解析到同一实体时只写一次；断链在复制任何 skill 之前就报错退出，目标项目零改动；全局卸载分支也不删作为入口的链接。skill 侧的同一套规则在 `ai-dev-workflow/references/init-初始化.md` §入口是软链接时，改一处要两处同改。

**标记块的迁移改写**（2.0.0 起）：旧安装的块里只有 `mode="personal|team"`，安装器把它就地改写成新字段（`collaboration` / `merge-gate` / `worktree-dir`），并在改写**前**打印「旧：… / 新：…」前后对照（`--dry-run` 也打印），逐条说明协作面与合并方式是**推断**出来的、不对就改这一行，以及**代码事实的供给方式不由这份声明决定**——它由项目实际资产在每次唤起时探测得出。旧 `mode` 只映射协作面（`team` → team + pr，其余 → solo + direct），**绝不由它推出任何能力位**（否则等于把已废弃的二分从数据里复活）。`mode="team"` 仍会被写回，那是给尚未升级的旧 skill 认的墓碑，`3.0.0` 移除。两个入口的四种混合状态一律**以 `CLAUDE.md` 为准**：两边都新 / 两边都旧 / `CLAUDE.md` 新而 `AGENTS.md` 旧 / `CLAUDE.md` 旧而 `AGENTS.md` 新——最后一种也按 `CLAUDE.md` 解析，随即被同一次迁移改写补成新字段，再幂等同步到另一个入口；有块却读不出任何已知字段就报错中止（宁可停，不猜）。还有一条反向的 **stamp 比对**：块已是新格式、而目标 skills 目录的版本 stamp 低于新字段起始版本（`WORKFLOW_FIELD_MIN_VERSION = 2.0.0`）时显式警告"skill 版本落后于配置"并提示每个协作者各自重跑一次（配置入库、skill 不入库，这种落后是多人项目的常态），不静默继续。

skill 复制完成后，安装器把 skill 自带的 **`ctx` CLI 链接成全局命令**：在 `<目标>/.claude/skills/ai-dev-workflow/scripts/ctx` 下 `npm link`（只用 `.claude/` 这一份，`.agents/` 是逐字节相同的副本，两份都 link 只会互相覆盖同一个全局命令），随后**实跑 `ctx --help` 并匹配签名串**才报成功——`npm link` 退出码为 0 只说明 shim 写出去了，不代表它落在 PATH 上、也不代表跑起来是我们这一个。做这件事的原因是：skill 文档通篇写 `ctx <命令>`，而此前安装器对 ctx 毫无处理，`which ctx` 为空会让使用者（尤其是 AI agent）把"命令找不到"误读成"Engineering Context 不可用"，退化成裸 grep——正是探测到权威位时明令禁止的行为。三类失败（link 失败 / 链完仍不在 PATH / PATH 上已有**别人的**同名 `ctx`）一律只降级为警告，并打印 `node <skill>/scripts/ctx/src/cli.js <命令>` 兜底方式；同名命令**绝不覆盖**。`--no-ctx-link` 跳过整段。全局命令指向最后一次安装的那个项目里的副本，靠"ctx 按 cwd 找 `engineering-context/`"做到一份命令服务所有项目。

安装的最后一段是 **codegraph**（`github.com/colbymchenry/codegraph`，本地代码知识图谱 CLI）：本机没有就 `npm install -g @colbymchenry/codegraph`（npm 是唯一跨平台可依赖的装法，Node 本就是安装器前提），已有则用它自己的 `codegraph upgrade` 升级——它认得 bundle/npm/npx 三种装法并原地更新，盲目 npm 装会在独立包安装的机器上留下抢 PATH 的第二份副本；`upgrade --check` 报告"已是最新"就跳过，太旧而没有 `upgrade` 子命令时退回 `npm install -g <pkg>@latest`；检测本身失败（真机上升级刚完成时偶发）就盲升，**升级结果以升级前后的版本号为准报告**——`upgrade` 退出码为 0 只说明命令跑通了，不代表真换了版本。随后 `codegraph install --target=auto --location=local --yes` 接线（默认项目级；**Codex CLI 没有项目级 MCP 配置，必然被跳过**，所以安装器显式打印手动全局接线命令，`--codegraph-location=global` 可改范围），最后 `.codegraph/` 不存在时 `codegraph init` 建索引，并以 `.codegraph/codegraph.db` 是否存在判定索引真的建成（旧版 `init` 只初始化不索引，缺了就补跑 `codegraph index`）。所有子进程 stdin 一律 `ignore`：codegraph 按 `process.stdin.isTTY` 决定要不要发问，关掉就锁定非交互分支，安装器不会被子命令提问挂住。整段任何失败只降级为警告，不影响已完成的 skill 安装；`--no-codegraph` 整段跳过。

Codex 安装默认不修改用户级全局插件配置，而是在目标项目 `AGENTS.md` 写入并校验 `ai-dev-system:codex-conflicts` 标记块，约束 `superpowers:` 不要自动加载或主动触发，除非用户在当前对话明确要求。交互安装可明确选择全局卸载，自动化安装使用 `--codex-conflicts=uninstall`；该选择影响当前用户的所有项目。若 `CLAUDE.md` 或 `AGENTS.md` 已有 workflow 标记块，安装器会幂等补齐另一入口。`--keep=superpowers` 会保留 Claude Code 插件，并移除安装器此前写入的 Claude 禁用项与 Codex 约束块。

## 改动时注意

- 改 skill 行为 → 改对应 skill `references/` 下 markdown；改模板 → `assets/templates/`；两者是 skill 的"源码"。改前后过一遍 `docs/spec/2026-07-16-skill写作自检清单.md`（信息层级 / 六大失败模式 / 交叉引用同步）。新增 skill 只要放进 `ai-dev-system/skills/<name>/` 并含 `SKILL.md`，发布到安装源后 `install.mjs` 会自动发现并复制，无需改安装器；发布前用 `--source-dir=.` 验证。
- 用户沟通必须使用业务语言：大架构交给用户确认，模块内设计只问业务问题，详细程序设计不要求用户确认；`ai-prd` 的对话与成稿不得包含程序实现。
- 进入 workflow 后，任何文档或代码落盘前必须按 `references/core/worktree开发纪律.md` 建立独立 worktree；Lean 也不例外。全部门禁通过后自动合并主分支，失败保留 worktree，禁止处理主工作树的用户改动或绕过保护分支。
- **`agentic-principle` 是外部伴生技能，严禁把它的内容搬进本仓库**：它管 Agent 系统**怎么设计**（场景选型/提示词/工具边界/注意力与并发预算/长产物分区/步骤级测试与评测），本体系的 `AI-LLM-overlay.md` 只管**运行期 AI 契约**（确定性边界/版本 pin/输出校验/置信度路由/安全管线/降级/预算准入/eval 门/可观测/数据边界/可审计）。两边只用指针互引，各自独立演进。安装器把它装到**用户级** `~/.claude/skills/` 与 `~/.codex/skills/`（`install.mjs` 的 `COMPANION_SKILLS`；注意两侧目录不对称——`.agents/` 只是 Codex 的**项目级**目录，用户级是 `~/.codex/`），每次运行检查远端版本、更旧才更新，symlink 或 git 工作区只报告不覆盖，拉取失败降级为警告；改这条链路要同改 `install.mjs`、`AI-LLM-overlay.md` §Agentic 应用、`代码评审纪律.md` 的 D 轴、`assets/config-snippets/base.md`（agentic 条目只在 base 一处，与协作面无关，MUST NOT 复制进 `collab-*.md`），并跑 `node --test test/companion-skill.test.mjs`。
- **`codegraph` 是外部工具，同样严禁把它的内容搬进本仓库**：它给的是**现状代码事实**（符号源码、调用链、影响面，随文件变更 auto-sync），Engineering Context 给的是**权威口径**（card + cite）；两者不互相替代——图谱位管"找得到吗"，权威位管"信哪个"，正交，任一可单独启用。2.0.0 起 codegraph 的索引 `.codegraph/codegraph.db` 是**图谱位的探测依据**，因此它出现在 `references/capability/graph.md` 里，但只以"何时用它 / 它给什么 / 不可用怎么办"三句声明的形式出现：它是**非硬依赖**（命令跑不起来就回退到子 agent 外包重探索，MUST NOT 阻断流程、MUST NOT 退回裸 grep），`graph.md` MUST NOT 扩写成 codegraph 使用手册，其安装与命令细节仍不进本仓库，也不进任何 config-snippet（能力位是探测结果，写进静态配置就会漂移）。改这条链路（`install.mjs` 的 `CODEGRAPH` 常量与 `syncCodegraph` 一族函数）要同改 CLAUDE.md §安装器的关键设计、`references/capability/graph.md` 与 `docs/spec/2026-08-14-codegraph自动安装与索引-lean-change-spec.md`，并跑 `node --test test/codegraph.test.mjs`。测试用**假 codegraph + 假 npm 放进收窄的 PATH**，绝不能让任何测试去动跑测试这台机器的全局安装——新增会调用安装器的测试记得带 `--no-codegraph`。
- **替换清单是跨文件的契约**：登记在 spec（`eng-spec.md` §8.2 / `lean-change-spec.md` 替换清单节）、拆成任务在 `coding-plan.md` 核销表、核销在 `代码评审纪律.md` 的残留轴。改判据（该删什么、保留例外认哪几类理由）要四处同改，且与 `eng-spec.md` §8.1 兼容取舍的到期日保持一致——两处日期不一致就是漏洞。
- **文档生命周期是跨文件的契约**：判据与字段的权威定义在 `references/core/文档治理.md` §文档生命周期与索引门控（`lifecycle` / `last_confirmed` / `authority_refs`、索引分层、按权威面触发），落地写法（归档头注、结算示例、账本收敛）在条件加载的 `references/core/文档归档与账本收敛.md`，结算动作在 `worktree开发纪律.md` §完成与自动合并门与 `00-流程总纲.md` 门表，字段落在五个 spec/plan 模板与三类 PRD 模板的 frontmatter，账本入口在 `bug诊断纪律.md` Phase 0/3 与 `测试资产纪律.md` §3，PRD 侧对应 `ai-prd` 的 §PRD 生命周期与 `UI原型纪律.md` §4.5。改判据要沿这条链同改。两个易错点：**①触发面是"本次触碰的权威面"，与刷 card 同一个面，MUST NOT 退化成"照抄替换清单"**——只改语义不删东西（枚举加值、可选改必填）的改动替换清单为空，却同样让文档失准；**②字段名是 `lifecycle` 不是 `status`**——`lean-change-spec` 的 `写作进度` 与 `product-prd` frontmatter 的 `status` 都已占用后者语义。
- **测试资产目录约定**：探测项目既有测试目录优先，兜底 `tests/fixtures/<场景名>/`；凭证进同级 `secrets/`（gitignore）+ `secrets.example/`（入库）。权威定义在 `references/core/测试资产纪律.md` §2，`test-spec.md` §4 Fixture 表与 `文档治理.md` 的表格引用它，改约定要三处同改。
- **UI 原型是跨 skill 的契约**：`ai-prd` 涉及用户可见界面时产出 `docs/spec/<name>-prototype-YYYYMMDD.html`（单文件、零外链、可离线打开），`ai-dev-workflow` 的 Step 1/2/4/8 把它与 PRD 一并作为输入。改这条链路要三处同改：`ai-prd/references/UI原型纪律.md`（权威定义）、三类 PRD 模板的「UI 原型」五项表、`ai-dev-workflow/references/core/00-流程总纲.md` 的输入声明与参考 prompt。
- `ai-prd` 的北极星参考物是 `orgin/prd.demo/` 下的变更 PRD 范例（brownfield 变更 PRD 骨架，本地参考、不入库）；改 `change-prd.md` 模板前对照设计文档 `docs/spec/2026-07-06-ai-prd-design.md §7` 的覆盖度映射，别丢节。
- 改 `ctx` 逻辑 → 同步更新 `scripts/ctx/test/` 下的测试，跑 `node --test` 保持全绿。card/registry 的格式约定见 `scripts/ctx/README.md` §card 格式约定，解析器依赖它。
- **`ctx` 的"能不能直接敲"是跨文件的契约**：安装器负责 `npm link`（`install.mjs` 的 `CTX` 常量与 `syncCtx` 一族函数），文档负责在链接失败时把人和 AI 引到兜底调用方式而不是 grep。改这条链路要同改 `install.mjs`、CLAUDE.md §安装器的关键设计、`references/capability/curated.md` §2 调用方式、`assets/config-snippets/base.md` 最后一条（条件式那条：项目里存在已填写的 registry 时才适用）、`scripts/ctx/README.md` §安装/运行、两个 README 的安装器职责清单与 `ctx init` 示例，并跑 `node --test test/ctx-link.test.mjs`。判定 ctx 是否为"我们这一个"依赖 `ctx --help` 首行的签名串 `Engineering Context CLI`——改 `cli.js` 的 HELP 首行会静默打断这个判定，两处同改。测试同样用**假 npm + 假 ctx 放进收窄的 PATH**，新增会调用安装器的测试记得带 `--no-ctx-link`。
- 改 `assets/context-layer/` 模板 → 同步 `scripts/ctx/src/commands.js` 内对应的 init stub（脚手架用的精简副本），反之亦然；两处漂移会让 `ctx init` 生成物与文档教的模板不一致。
- 本仓库自身与安装目标的文档目录固定为：spec → `docs/spec/`，plan → `docs/plan/`，report → `docs/report/`。
- **版本管理**：分发版本在 `ai-dev-system/VERSION`（旧无 stamp 安装追认为 1.0.0）。凡改变已安装项目的行为契约或目录约定就 bump；需要用户动作的升级必须同时新增 `ai-dev-system/migrations/<新版本>.md`（安装器会在升级时高亮全文打印，指南保持一屏内）。安装器把版本 stamp 写入目标两个 skills 目录的 `ai-dev-system.version`。**每次版本变更合入 main 后必须打 annotated tag `v<版本>`**（如 `v1.1.0`），tag 与 VERSION 始终一致，供 `--ref=v<版本>` 锁版本安装与回溯。机制详见 `docs/spec/2026-07-16-skill版本管理与迁移机制.md`；改动后跑 `node --test test/installer-migration.test.mjs`。
