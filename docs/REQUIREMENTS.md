---
lifecycle: active
last_confirmed: '2026-09-03'
authority_refs:
  - '交付单元：两个 skill（ai-prd / ai-dev-workflow）+ ctx CLI + 安装器，装进目标项目的是 .claude/skills/ 与 .agents/skills/ 两份'
  - '安装器默认 --ref 取自安装器自带的 ai-dev-system/VERSION 对应的 tag；显式传的 --ref 取不到时硬失败，默认推出的 tag 取不到时告警回退 main'
  - '安装器只在目标项目级禁用冲突插件，不改用户级全局配置'
  - '标记块 <!-- ai-dev-workflow:start/end --> 的字段集：collaboration / merge-gate / worktree-dir，幂等只替换块内内容'
  - '初始化只问一个问题（除你之外还有没有人一起开发）+ 一条待拍板的 merge-gate 建议；代码图谱与代码事实层都不问'
  - 'engineering-context/ 代码事实层是必备资产，没有开关；ctx init 生成整套骨架'
  - 'ctx 的命令集与人类/--json 双输出，probe 的 RED/GATE-BROKEN 以退出码 1 结束'
  - '项目级输出目录：spec → docs/spec/、plan → docs/plan/、report → docs/report/；docs/ 根只放两层真相源与 TODO.md'
  - '任何文档或代码落盘前必须建独立 git worktree，全部门禁通过后按 merge-gate 自动合并'
  - 'ai-prd 组稿的三门顺序：用户过稿门 → 复核门 → 落盘确认门'
  - '原型注解分层：元素级说明用 data-anno 气泡、屏级说明用屏注解区、整份说明用设计说明；用户可回复 AI 说明'
  - '按次产出的 docs/spec、docs/plan、docs/report 文档文件名以 YYYY-MM-DD- 开头，常青档与索引除外'
documentRole: 'primary-prd'
sourceOfTruth: true
  - '代码评审门的轴集合按对象面推导（P/K/G 三类闭集，取并集；三面皆不命中时为文档轴）'
  - '不含可执行代码的纯 skill 改动 PRD 即 spec，跳过 Overview / 技术 spec / coding plan'
---

# ai-dev-system — 产品需求文档

> **本文是需求真相源主文档，只写现在。** 内容是 main 分支上**已经实现**的现状。
> **尚未实现的一切在 [`docs/TODO.md`](./TODO.md)**——想做的功能、待澄清的问题、已知风险、技术欠账都在那里。
> 想知道某条口径当初为什么这么定，去[归档索引](./index-archive.md)翻当时那份 spec。
> 判据在 `ai-dev-system/skills/ai-dev-workflow/references/core/文档治理.md` §需求真相源写什么、怎么分层。

## 这是什么

ai-dev-system 是一个**AI 辅助开发方法论的分发包**，不是一个可运行的应用。它把一份原始需求逐层降解成"零上下文 AI agent 也能可靠执行"的任务，交付物是四件东西：

- **`ai-prd`** —— 从零产出 PRD 的 skill：批量提问澄清，按三类模板成稿，涉及界面时一并产出可离线打开的 HTML 高保真交互原型。
- **`ai-dev-workflow`** —— 从已有 PRD 起步的主流程 skill：Triage 分流 → Overview → 技术 spec → coding plan → 编码 → 测试，全程贯穿贯通两条路径的那组门禁（清单见 `00-流程总纲.md` 的流程总览图）。
- **`ctx`** —— 零第三方依赖的 Node.js CLI，读项目本地的 `engineering-context/` 代码事实层，回答"这件事的权威实现在哪、我该信哪一个"。
- **`install.mjs`** —— 一条命令把上面三件装进任意项目，同时给 Claude Code 与 Codex 两套目录。

两个 skill 松耦合：`ai-prd` 的产物正是 `ai-dev-workflow` Step 1 的输入。使用者是**装了这套体系的开发者与在其中干活的 AI agent**，他们感知到的就是"唤起 skill 之后会发生什么、安装器会动我项目里的什么、`ctx` 各命令给我什么"。

## 为什么做

AI coding 落不了地，通常不是因为流程不够精细，而是因为 AI 手上没有一层**可信、新鲜、权威的代码事实**：它去 grep 旧代码，命中一个早已废弃的实现，然后在错的地方改对的逻辑；或者它把 PRD 里的意图当成了系统现状。流程谁都能抄，这一层抄不来。

因此这套体系的重心不在"多几个评审环节"，而在三件事上：把代码事实固化成带出处的卡片并强制先查后改；把每一次改动关进独立 worktree，门禁没过就不进主分支；把判据写成零上下文可执行的 markdown，让下一个 agent 不必先听人介绍一遍项目。

## 现在有哪些功能

### 产 PRD：`ai-prd`

把一段零散描述、一个 Issue 或脑子里的想法，降解成非目标够硬、验收可判定的 PRD。

- 每次唤起先只读项目根 `CLAUDE.md`（优先）或 `AGENTS.md` 的标记块取协作面，**MUST NOT 写配置、MUST NOT 问用户配置怎么写**；没有标记块按 solo 走。
- 按需求形态分流选模板：小改动或单点 Issue → `lite-issue-prd.md`；brownfield 变更或新功能 → `change-prd.md`（默认）；整品或从 0 定义产品 → `product-prd.md`（配套 `requirements-module.md` 子模块模板与 `todo.md`）。
- 以**批量提问**推进，不做一问一答：分批澄清立项 / 现状与边界 / 细节 / 准出，每批有明确退出条件，逐项勾验全过才进下一批。需求高度模糊时先走盘问模式收敛方向。
- 三条提问纪律恒生效：**事实自己查，只把决策抛给用户**；每问尽量附推荐答案与一句业务语言的理由；问题间有依赖时拆层推进。
- 现状事实只有一条取证路径，与协作面和项目大小无关：先查 `engineering-context/` 卡片（事实带 cite），卡片没覆盖的模块才读源码（结论带 `文件:行`），并在 PRD 里标出这些模块交给下游补卡。**MUST NOT 从 PRD 生成卡片事实**。
- 涉及用户可见界面时产出单文件 HTML 原型（零外链、零 CDN、可离线打开），由 `scripts/preview.mjs` 的 `init` / `screen` / `slot` 建出与改稿，`extract` 取回界面内容（结构与文案，不含批注框架等固定实现，供下游读原型时不必通读整份 HTML），`check` 交付前自检，`annotations` 取回批注，`serve` 起本机预览服务让用户直接在原型上批注并自动写回文件。原型容器的固定实现区（视觉基线 / 设计系统 / 图标库 / 批注框架 / 屏状态脚本）的正文住在独立源文件目录里，`init` 时装配回单文件——**产出的原型仍是单文件、零外链、可离线打开**。
- 原型说明按三层归属：元素级说明写在 `data-anno` 气泡，整屏说明写在屏注解区，整份原型说明写在工具栏设计说明面板；用户可在 AI 说明气泡上直接追加回复，`annotations` 会同时取回用户逐元素批注、全局反馈、AI 说明与用户对说明的回复。
- 改稿动到带用户批注的元素时，先逐条约定已落实、作废或挪到新元素，再用 `--agreed --agreed-plan` 放行；预览服务以内容版本校验拒绝旧页面覆盖新稿。
- 批注气泡贴在被批注元素**内侧**右上角，且不改写该元素本来的定位——绝对定位的画布类原型（拓扑图 / 流程图 / 座位图）打了批注也不会错位，气泡也不会被滚动容器裁掉；原型自定义样式的 `z-index` 上限为 880。
- 成稿后依次过三道门，顺序固定：**用户过稿门**（用户读稿提意见、逐条落稿或明确回"不改 + 理由"，直到用户定稿；此时原型以项目外的预览副本交付，MUST NOT 提前写进 `docs/`）→ **复核门**（派子代理跑自洽轴与冲突轴复核，判据在 `prd复核纪律.md`）→ **落盘确认门**（把关键取舍、非目标、验收口径连同复核门交上来的待拍板冲突回述给用户，未确认 MUST NOT 落盘；复核门既无待拍板条目也无实质性改稿时退化为一句话告知直接落盘）。
- 落盘写入 `docs/spec/`；项目已有 `docs/index.md` 时同步更新索引。
- 全程只用业务语言：对话、提问与成稿都不要求用户理解程序实现。
- 按次产出的 spec、plan、report 文档文件名统一以 `YYYY-MM-DD-` 开头；需求真相源、TODO、索引与固定账本等常青档保持固定名称。

### 从 PRD 到代码：`ai-dev-workflow`

技术栈无关的主流程，从一份已有 PRD 走到测试完成、分支合并。

- 每次唤起先走路由：探测项目根 `.codegraph/codegraph.db` 决定要不要加载代码图谱分册 → 读两个入口的标记块取协作面 → 按渐进式披露只加载此刻用得上的判据。**代码图谱只探测不发问**，探测不到就把重探索外包给子代理，MUST NOT 阻断流程、MUST NOT 退回裸 grep。
- 首次调用触发**初始化**：只问一个问题（除你之外还有没有人一起开发）+ 一条待拍板的 merge-gate 建议，答案写进项目根 `CLAUDE.md` 与 `AGENTS.md` 的标记块，此后不再问。**要不要维护代码事实层不问**（必备），**有没有代码图谱也不问**（探测得出）。
- **Step 0 Triage 分流**：按 `00-流程总纲.md` §Step 0 的判定问题过一遍，全否走一页 Lean Change Spec 直接实现，任一为是升级回完整流程。全否时还有一条无条件的默认倾向：影响面说不清时仍 MUST 升级出 Overview，跨仓需求一律升级（判据在 `00-流程总纲.md` §默认倾向）。
- **Lean 路径读的是自足册** `路径-lean.md`：Lean 全程只读它 + 协作面分册一份 + lean spec 模板，不读常驻篇也不读总纲，因此适用于 Lean 的每一条 MUST 都在册内各有一份。
- **完整路径**走 Overview → 技术 spec → coding plan → 编码 → 测试；含 AI/LLM 功能时叠加 `AI-LLM-overlay.md` 的运行期 AI 契约，判定为 Agentic 应用时另加载外部伴生 skill `agentic-principle`。
- 门禁贯穿两条路径，**Lean 不豁免**，位置见 `00-流程总纲.md` 的流程总览图：
  - **工作区隔离门**（`SKILL.md` §工作区隔离门要点）——路由与初始化对话做完后、任何文件落盘前，MUST 已从最新主分支建出并全程使用独立 worktree；目录取标记块的 `worktree-dir`，未声明默认 `./.worktrees/`；主工作树有未提交改动、不是 Git 仓库或建不出 worktree 时 MUST 中止并用业务语言说明，MUST NOT 替用户 stash / reset / checkout。
  - **兼容取舍确认门**（`00-流程总纲.md` §兼容取舍确认门）——spec 定稿前由用户逐条拍板是否向后兼容。
  - **spec 过稿门**（`00-流程总纲.md` §spec 过稿门）——spec 定稿后、生成 coding plan 之前，把 spec 里业务可判定的部分（范围与不做什么 / 功能需求 / 兼容取舍结论 / 完成定义）交拍板人过目并表态；**MUST NOT 请他确认数据模型、接口契约、核心逻辑或可观测性方案**。默认每次都过，**跳过只认拍板人自己说出口**这一条通路且只对本次有效。他没回复 MUST NOT 推进；本门与兼容取舍确认门是仅有的两个允许因等拍板人而挂起的流程内点。结论当场写进 spec 的过稿记录节。Lean 与兼容取舍、大架构摘要**同一批抛出**，不分轮问。
  - **代码评审门**（`00-流程总纲.md` §代码评审门）——编码后派子代理分轴复核，**轴集合按本次改动触碰的对象面推导**（`代码评审纪律.md` §门禁）：程序代码面 → 规范 / 忠实 / 残留 / 文档，skill 文档面 → skill 原则轴（加载伴生 skill `skill-principle`），agent 架构面 → agent 架构轴（加载 `agentic-principle`），多面命中取并集。命中程序代码面时文档轴恒跑、不由主会话先判要不要派；忠实轴的返回表比其余各轴多一列「偏离类型」，取值是闭集。评审子代理默认派普通档模型，MUST NOT 派最低档。
  - **完成与自动合并门**（`00-流程总纲.md` §完成与自动合并门）——全部门禁通过后按 `merge-gate` 自动合并主分支；失败保留 worktree，MUST NOT 处理主工作树的用户改动、MUST NOT 绕过保护分支。
- spec 的每条功能需求编 `FR-###`、每条验收项编 `AC-###`，同一套编号贯通 spec → coding plan 的核销表 → 评审门忠实轴的覆盖矩阵 → test-spec 的追溯矩阵；编号永不复用、永不重排，删除的原地保留并改写成"已撤销"。
- **不含可执行代码的纯 skill 改动不出 spec 与 coding plan**：PRD 即 spec，动手前加载 `skill-principle` 的建设路径定结构。跳过的是产物不是门——工作区隔离门、兼容取舍确认门、spec 过稿门照旧，结论落在 PRD 或改动清单里。改动范围一旦含可执行代码文件，代码那部分照常写 spec。
- 判据按**渐进式披露**加载：入口 `SKILL.md` 带一张〈加载点清单〉，每行写清触发条件 / 加载对象 / 为什么此刻需要 / 适用路径；常驻的那几份也不整篇读，每个小节自带一行 `> **何时读本节**` 标注前置还是触发式。
- 用户沟通只用业务语言：大架构交给用户确认，模块内设计只问业务问题，详细程序设计不要求用户确认。

### 必备的代码事实层：`engineering-context/`

装了本体系的项目**一律维护**这一层，不分项目大小、不分协作面、没有开关。

- 目录由初始化时在 worktree 内跑 `ctx init` 建出整套骨架：能力 registry + 逐仓 cards + 端到端 scenes + 冻结探针集 + 术语表 + README。骨架里只有模板占位行是**正常的起步状态**，不告警、不因此改变分流。
- 取事实的顺序固定：未限定单仓时先 `ctx find-scenes <关键词>` 取端到端全景，再 `ctx discover "<意图>"` 按结果读 card。**每条来自 card 的事实必须附 cite（`path#anchor @确认时间`），无 cite 视为幻觉。**
- 查不到不等于"这个项目不用卡片"，只意味着该模块的卡片还没建：读源码（有代码图谱走图谱，没有就外包子代理）+ **读完当场补卡**，随本次任务分支提交，MUST NOT 顺延。评审门的残留轴把"读过源码却没补卡"判为残留。
- 卡片事实**以合入后的源码为准**，MUST NOT 从 PRD 生成。新鲜度按是否触碰 Authority Surface 触发，不按变更行数。
- 代码图谱与这一层不同级也不互相替代：图谱答"找得到吗"，是可选的检索加速面；卡片答"信哪个"，是无条件必备的地基，两者冲突时以卡片为准。

### `ctx` 命令族

零第三方依赖、跨平台，人类可读输出与 `--json` 双形态，按 cwd 向上找 `engineering-context/`，因此一份全局命令服务所有项目。

| 命令 | 给什么 |
|---|---|
| `ctx init` | 生成整套 engineering-context 骨架；`--minimal` 只落一份 registry |
| `ctx discover "<意图>"` | 意图 → 该读哪几张 card + out-of-scope 警告 |
| `ctx get-card <repo> [section]` | 取某个仓库的 Codebase Card（按小节切段） |
| `ctx find-scenes <关键词>` | 端到端业务场景蓝图 |
| `ctx list-services` | 列出已登记的仓库与能力 |
| `ctx search-semantic "<q>"` | discover 未命中时的语义兜底（本地向量相似，结果带 freshness 与 cite） |
| `ctx probe` | 跑冻结探针集防腐门禁：机器可判题型 + 门禁自检 + 棘轮 + 衰减报告 |

`ctx probe` 的题型分两类：**读 cards/registry 的**（`capability-mapping` / `deprecated-trap`）与**读项目自身文件的**（`requirement-reachable` / `architecture-reachable` / `implementation-usable` / `rationale-traceable`）。后者不依赖代码事实层，所以卡片还空着的起步态项目同样跑得起来；`--json` 的退出码供 CI 使用，RED 与 GATE-BROKEN 以 1 结束。

### 安装器：`install.mjs`

一条命令完成安装，需要 Node.js ≥20 与 Git。

- 先把 `--repo` / `--ref` 指定的版本拉到系统临时目录并确认其中有有效 skill，**之后才读取并修改目标项目**；下载或校验失败时目标项目零改动，临时目录在成功、取消、预演与异常场景都会清理。
- 默认 `--ref` 是安装器自带的 `ai-dev-system/VERSION` 对应的 tag，npx 拉到哪个版本的安装器就装哪个版本的 skill。两条不对称的失败语义：**默认推出的 tag 取不到时告警并回退 `main`**；**用户显式传的 `--ref` 取不到时硬失败**，MUST NOT 回退成别的版本。
- 把该版本的**全部** skill 复制进 `<项目>/.claude/skills/`（Claude Code）与 `<项目>/.agents/skills/`（Codex），并在目标项目 `.gitignore` 幂等追加标记块，逐条忽略已装 skill 目录与版本 stamp。
- 在**目标项目级** settings 里把会截胡本流程的 Claude Code 插件设为 `false`（`superpowers` / `everything-claude-code` / `oh-my-claudecode` / `general-task`），只影响本项目、不动用户级全局配置；默认写 `.claude/settings.local.json`，`--shared` 才写 `.claude/settings.json`；合并时不覆盖 `enabledPlugins` 里的其他键。Codex 侧默认在项目 `AGENTS.md` 写入 `ai-dev-system:codex-conflicts` 约束块，交互安装可明确选择全局卸载。
- 幂等写入 `CLAUDE.md` 与 `AGENTS.md` 的 `<!-- ai-dev-workflow:start/end -->` 标记块：**只替换块内内容，绝不重复追加**；两个入口以 `CLAUDE.md` 为准，另一个自动补齐。两个入口允许是软链接，安装器逐层解析到实体文件再写入、保留链接本身，断链在复制任何 skill 之前就报错退出。
- 把 skill 自带的 `ctx` 链接成**全局 `ctx` 命令**（`npm link`），随后实跑 `ctx --help` 并匹配签名串才报成功。链接失败、链完仍不在 PATH、PATH 上已有别人的同名 `ctx` 一律只降级为警告并打印 `node <skill>/scripts/ctx/src/cli.js <命令>` 兜底方式，**别人的同名命令绝不覆盖**；`--no-ctx-link` 跳过。Windows 上换项目重装时 `npm link` 会因全局命令目录里还留着上次那份 `ctx` 而报 `EEXIST`（unix 侧 npm 直接替换自己的符号链接，撞不出这条）：安装器捕获 npm 输出分辨出这一类，先判那个文件的归属——PATH 上跑得通且签名匹配，或 `npm root -g` 下的 `ctx` 包认得出是本体系的——确认是自己上次留下的才 `npm link --force` 覆盖成本次这份；判不出归属就不覆盖，改为打印该文件路径与删除方式。
- 保持 [codegraph](https://github.com/colbymchenry/codegraph) 最新（缺失则 npm 全局安装，已有则用它自己的 `codegraph upgrade`），接线到 agent（默认项目级），并在 `.codegraph/` 不存在时建索引。整段任何失败只降级为警告，不影响已完成的 skill 安装；`--no-codegraph` 跳过。
- 检查并安装用户级伴生 skill（当前两个：`agentic-principle` 与 `skill-principle`，装到 `~/.claude/skills/` 与 `~/.codex/skills/`）：每次运行比对远端版本、更旧才更新；**没有 `metadata.version` 的 skill 按 `SKILL.md` 内容是否相同判**；本地是 symlink 或 git 工作区时只报告不覆盖；拉取失败降级为警告。`--no-companions`（同义 `--no-agentic`）跳过整段；`--companion-repo=<name>=<url>` 覆盖某个 skill 的来源仓库。
- 常用开关：`--dry-run` 预演不落盘、`--yes` 跳过交互确认、`--keep=<插件短名>` 保留某个插件并撤销此前写入的禁用与约束、`--no-plugins` 只装 skill、`--source-dir=<目录>` 用本地工作区源码（仅开发测试）。

### 文档治理与三层真相源

装了本体系的项目使用同一套约定，与协作面和已有资产无关。

- **输出目录固定**：spec / PRD / Overview / 契约 → `docs/spec/`，coding plan 与交接文档 → `docs/plan/`，各类报告 → `docs/report/`。`docs/` 根只放三个固定文件：需求真相源 `REQUIREMENTS.md`、架构真相源 `ARCHITECTURE.md`、`TODO.md`；需求真相源的一级子模块住 `docs/requirements/`。不得创建工具专属产物目录。
- **三层真相源**（需求 / 架构 / 实现）MUST 能从 README 或 `docs/index.md` 出发 ≤2 跳到达。承载形态随项目已有资产变化，小项目用 README 的一节就合规；发现缺口时**只报告、不阻断**，也不代用户自动创建。
- **需求真相源只写现状**：MUST NOT 包含历史演进、前后对比、技术选型、需求调整过程；尚未实现的一切去 `docs/TODO.md`，主文档里 MUST NOT 留"计划中"小节。承载分两层（主文档 + 一级子模块），MUST NOT 再往下分目录；拆不拆看 `文档治理.md` §需求真相源写什么、怎么分层 的阈值。
- **`docs/TODO.md` 是还没做的事的唯一出口**：章节按类型分且是闭集，每条带提出日期，只收会改变用户可感知行为、会新增或去掉一个功能、会动模块边界的条目；陈旧条目只提醒、AI MUST NOT 自行删除。
- **文档生命周期**：每份新建文档的 frontmatter 必带 `lifecycle` 与 `authority_refs`；`docs/index.md` 只索引现行口径，已归并 / 被取代 / 已废弃的进 `docs/index-archive.md`。真相源的**更新在准出门完成**——开发前定稿的是意图，开发后归并的才是现状。

## 子模块划分

本文档当前**未拆子模块**：篇幅未达 `ai-dev-system/skills/ai-dev-workflow/references/core/文档治理.md` §需求真相源写什么、怎么分层 的拆分阈值，所有用户可感知的行为规则直接写在上面〈现在有哪些功能〉的各小节里，`docs/requirements/` 目录尚未建立。

## 用户怎么用

**装进一个已有项目**：在目标项目根跑 `npx --yes git+https://github.com/weidwonder/ai-dev-system.git .`。安装器先问一次确认（`--yes` 可跳过），随后复制 skill、处理冲突插件、链 `ctx`、装 codegraph 与伴生 skill。装完后 Claude Code / Codex 需**下次启动**才生效。

**第一次唤起 workflow**：在项目里描述一个需求，skill 走完路由发现没有标记块，于是问唯一那个问题——除你之外还有没有人一起开发——并给出一条待拍板的 merge-gate 建议。答完即写进两个入口的标记块，此后不再问。紧接着它建出独立 worktree，在里面跑 `ctx init` 建好 `engineering-context/` 骨架。

**做一次小改动**：描述需求 → Triage 判定全否且影响面说得清 → 走 Lean 自足册，先查卡片取事实（没卡就读源码并当场补卡）→ 写一页 Lean Change Spec → **用户在同一批里表态一次**（兼容取舍 + 这一页 spec 过稿，命中大架构判据时还附一份业务语言摘要）→ 实现 → 派子代理跑代码评审 → 文档落位 → 按 `merge-gate` 自动合并、清理 worktree。全程用户只需要在那一批表态一次。

**做一次大改动**：Triage 任一为是（或影响面说不清）→ 升级完整流程，先出 Overview 交用户确认大架构 → 技术 spec（需求编号 `FR-###` / 验收项 `AC-###`）→ 拍板兼容取舍 → **拍板人过稿** → coding plan → 编码 → 评审门分轴复核 → 测试 → 合并。

**先写 PRD 再开发**：说"帮我写个 PRD"唤起 `ai-prd` → 分批回答问题 → 拿到 PRD 与（涉及界面时）HTML 原型 → 在原型上直接批注 → 定稿、过复核门与落盘确认门 → 文件落进 `docs/spec/` → 把它作为 `ai-dev-workflow` Step 1 的输入继续开发。

## 明确不做什么

1. **不做 Agent 系统的架构设计**。场景选型、系统提示词、工具边界、注意力与并发预算、步骤级评测、调试模式与切片留存、单环节回放属于外部伴生 skill `agentic-principle`；本体系的 `AI-LLM-overlay.md` 只管运行期 AI 契约。两边只用指针互引。
1bis. **不做 Skill 写法本身的原则与审查**。description 触发质量、渐进披露结构的设计、该不该拆分册、以及代码评审门 skill 原则轴的判定项，属外部伴生 skill `skill-principle`；本体系只在流程里留触发点与指针，不复述它的原则编号与项数。
2. **不做代码知识图谱**。符号检索、调用链、影响面由外部工具 codegraph 提供；本体系只声明"何时用它 / 它给什么 / 不可用怎么办"三句，不复制它的使用手册。
3. **不做运行时框架、不做 IDE 插件、不做托管服务**。交付物是 markdown 判据 + 零依赖 CLI + 安装器，没有 build 步骤、没有 lint 配置、没有 npm 运行时依赖。
4. **不替用户拍板业务口径**。`ai-prd` 只给推荐与理由，决策权在用户；兼容取舍由用户逐条拍板。
5. **不为存量项目提供自动迁移脚本**。升级靠重装 skill；需要用户动手的升级才附一份迁移指南。
6. **不动主工作树、不绕过平台门禁**。门禁失败时保留 worktree 交给用户处置，不 stash / reset / checkout 用户的改动，不绕过 PR、CI 与保护分支。
7. **不把测试与 fixtures 随 skill 分发**。它们住在本仓库根 `test/`，装进目标项目的只有判据、模板与 CLI。
8. **不为每一份判据 markdown 各建一节卡片**。"装了本体系的项目一律必备卡片层"这条判据本仓库自己也照做——`engineering-context/cards/ai-dev-system.md` 记的是**交付物自身的结构契约**：原型容器的分区标记、`preview.mjs` 与 `ctx` 的命令契约、贯穿门与文档治理的落点及其 `文件:行`。但卡片**只覆盖有结构契约、改错了会静默失效的那几个面**，不为每份判据 markdown 各开一节——那些文件的权威实现就是它们自己，逐份建卡只会多出一份必然漂移的副本。实现层的完整路径清单仍由根 `CLAUDE.md` 的〈目录速查〉与那份可点路径清单承担（`ctx probe` 的 `implementation-usable` 正是读它）。**本条 MUST NOT 被引用成"我的项目也可以不建卡片"**——它划的是"哪些面值得建卡"的边界，不是"要不要有卡片层"的开关；对代码仓库而言那个开关不存在。

## 成功标准

### 用户侧

- 一个零上下文的 AI agent 接手项目时，能从 README 或 `docs/index.md` 出发 ≤2 跳找到需求、架构、实现三层真相源，不需要任何人口头介绍。
- agent 要改某个模块时，先查到带 cite 的卡片而不是去 grep 旧代码；卡片缺失时读完源码当场补上，下一个 agent 不再走同一段路。
- 每次改动都发生在独立 worktree 里，门禁全过才进主分支；用户在主工作树里未提交的改动从不被触碰。
- 用户全程只需要用业务语言参与：确认大架构、拍板兼容取舍、给技术 spec 过稿（只看范围 / 功能需求 / 验收口径 / 兼容结论）、给 PRD 提意见，不需要读懂程序实现。

### 度量

- `ctx probe` 的冻结探针集在 CI 发布或里程碑节点跑，无新增失败（RED）。
- 仓库自身的机器闸（`node --test test/*.test.mjs`）全绿——跨文件契约的漂移由闸拦住，而不是靠每轮子代理重查。

## 服务质量要求

| 维度 | 指标 |
|---|---|
| 运行前提 | Node.js ≥20 + npm + Git；零第三方运行时依赖，无 build 步骤 |
| 跨平台 | macOS / Linux / Windows 一致：全程 `node:path`、UTF-8、`os.tmpdir()`，无 bash-only 语法 |
| 安装的原子性 | 源校验通过前不修改目标项目；失败时目标项目零改动，临时目录必清理 |
| 幂等性 | 标记块、`.gitignore` 块、settings 合并重复安装不重复追加、不覆盖用户自己的键 |
| 降级语义 | `ctx` 链接、codegraph、伴生 skill 三段的任何失败只降级为警告并给出兜底方式，不影响已完成的 skill 安装 |
| 权限边界 | 冲突插件只在目标项目级禁用；用户级全局配置只有在用户明确选择时才改动 |
| 版本可回溯 | 每次版本变更合入 main 后打 annotated tag `v<版本>`，与 `ai-dev-system/VERSION` 始终一致，供 `--ref=v<版本>` 锁版本安装 |
| 上下文预算 | 唤起 skill 只加载当次真正用得到的判据：分流前只取三份，其余按加载点在触发时才取；常驻前置量与入口体积各有字节门槛把守（门槛值与实测以 `node --test test/resident-budget.test.mjs` 的输出为准） |

## UI 原型（如适用）

| 项 | 内容 |
|---|---|
| 原型文件 | 不适用——本仓库交付的是 skill markdown、CLI 与安装器，没有用户可见的图形界面；使用者的全部交互发生在终端与 AI 对话里 |
