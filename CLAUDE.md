# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 这个仓库是什么

**这是一个 AI 辅助开发方法论的分发包**，不是一个应用。它交付两个 Claude Code / Codex 通用的 **skill** 加一个零依赖的 **CLI**（`ctx`），把需求逐层降解成"零上下文 AI agent 也能可靠执行"的任务：

- `ai-prd` —— 从零**产出 PRD**（批量提问 + 阶段化 elicitation），补 workflow 的前置空缺。
- `ai-dev-workflow` —— 从**已有 PRD** 起步，走 Triage → Overview → Spec → Coding Plan → 测试。

`ai-prd` 的产物正是 `ai-dev-workflow` Step 1 的输入，两者松耦合。

核心信念（贯穿全部设计）：AI coding 能否落地，秘密不在流程本身，而在**能不能给 AI 一层可信、新鲜、权威的代码事实**——团队版的 Engineering Context 层正是为此而生。

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
```

没有 build 步骤、没有 lint 配置、没有 npm 运行时依赖——整个包是纯 Node.js ESM + markdown；安装器额外调用 Git 获取发布源。

## 架构：三层 + 一条铁律

**交付单元是 `ai-dev-system/skills/` 下的两个 skill（`ai-prd` + `ai-dev-workflow`）。** 二者共享同一套约定（mode-aware、references+assets 结构、复用 `ai-dev-workflow` 的 mode 标记块）。`ai-prd` 是 workflow 的前置产 PRD 阶段，结构见 `ai-dev-system/skills/ai-prd/`（纯 markdown，无代码）。下文以 `ai-dev-workflow` 为主展开，抓三点：

### 1. skill 是 mode-aware 的（`SKILL.md` 是入口）

同一套内核（`references/core/`），根据项目是「个人版」还是「团队版」加载不同外壳。每次调用先走**路由逻辑**（见 `SKILL.md` §路由逻辑）：

- 读目标项目根的 `CLAUDE.md`/`AGENTS.md`，找 `<!-- ai-dev-workflow:start --> … mode="personal|team" … <!-- ai-dev-workflow:end -->` 标记块。
- **无标记块** → 初始化（`references/init-初始化.md`）：只问一次 mode，把 `assets/config-snippets/{personal|team}.md` **幂等**注入目标项目的 `CLAUDE.md` **和** `AGENTS.md`（两个都写，兼容 Claude Code + Codex）。
- **有标记块** → 读出 mode 直接路由，不再询问。

初始化的幂等规则很关键：**只替换标记块内内容，绝不重复追加**；标记用 HTML 注释，机器可精确定位、对 markdown 渲染无影响。

### 2. 流程内核（`references/core/00-流程总纲.md`）

技术栈无关的 10 步流程 + Step 0 Triage 分流：

- **Triage 的 4 个判定问题**（AI/LLM 行为？鉴权安全设备？跨服务/迁移/不可逆？指标/业务规则/对外承诺？）——4 项全否走一页 **Lean Change Spec** 直接实现；任一为是升级回完整流程。
- 个人版默认假设走 Lean，只有 hold 不住才升级；团队版跨仓必升级、出 Overview。
- 含 AI/LLM 功能时，在基础 spec 上**叠加** `references/core/AI-LLM-overlay.md` 的 AI 契约（判定边界见该文件）。判定为 **Agentic 应用**时另需加载**独立技能 `agentic-principle`**（见下）。
- 所有文档遵循 `references/core/spec写作纪律.md`：零上下文可动手、RFC2119、无占位符。
- 10 步之外还有**四道贯穿两条路径的门**（Lean 也不豁免）：worktree 隔离门 → 兼容取舍确认门（spec 定稿前，用户逐条拍板是否向后兼容）→ 代码评审门（编码后，子代理跑规范/忠实/残留三轴）→ 完成与自动合并门。门的位置见总纲流程总览图。

### 3. 团队版的 Engineering Context 层 + `ctx` CLI（本仓库的技术核心）

团队版禁止 grep 旧代码找权威实体，必须先 `ctx discover "<意图>"` 再按结果读 card，**每条来自 card 的事实必须附 cite（path#anchor @确认时间），无 cite 视为幻觉**。

`ctx` CLI（`scripts/ctx/`）读本地 `engineering-context/` 目录（团队用 `ctx init` 在自己项目里生成），三层清晰分离：

- `src/cards.js` — 纯读取/解析层：`splitSections`（按 `## 标题` 切段）、`loadCards`（`cards/<repo>.md`，文件名即 service 名）、`loadRegistry`（解析 `capability-registry.md` 的 markdown 表格，表头首列含 `Capability`）、`makeCite`。
- `src/commands.js` — 命令/匹配层：`discover`（关键词 tokenize + 命中打分，registry 命中的能力给 card 加权）、`getCard`、`findScenes`、`listServices`、`initScaffold`。
- `src/cli.js` — argv 解析 + 路由 + 人类/`--json` 双输出。
- `src/semantic.js` — `search-semantic`：零依赖本地向量相似（字符 bigram 余弦 + 可选 synonyms）；结果带 freshness/cite + 权威指针，`--as-of` 启用过期降权。是 discover 未命中时的兜底。
- `src/probe.js` — `probe`：Frozen Probe Set 防腐门禁，机器可判题型 + 门禁自检（植入必错样本）+ 棘轮（新增失败 RED / 基线内 AMBER）+ 衰减报告；`--json` 退出码供 CI（RED/GATE-BROKEN=1）。

**跨平台是硬约束**：全程用 `node:path`、UTF-8、`os.tmpdir()`，无 bash-only 语法，零第三方依赖。改 `ctx` 时必须保持这些。

**Engineering Context 的真相方向铁律**（改任何 context 层相关内容前必读 `references/company/context-engineering.md` §3）：**card 事实以合入后的源码为准，绝不能从 PRD 生成 card 事实**（PRD 描述意图，意图常与已落地事实背离）。新鲜度**按是否触碰 Authority Surface 触发，而非变更行数**（3 行的路由 V1→V2 必须刷，2000 行内部功能不碰接口可不刷）。

## 目录速查

```
install.mjs / install.cmd          安装器：拉取 GitHub 发布源 + 安装 skills + 项目级冲突约束
docs/{spec,plan,report}/           本体系自身的规范 / 计划 / 报告
ai-dev-system/skills/ai-prd/        产 PRD skill：批量提问 elicitation + 三类模板
  SKILL.md                         入口：读 mode → PRD 类型分流 → 4 批提问驱动
  references/                      PRD 流程 / 业务语言纪律 / 写作纪律 / UI 原型纪律 / 质量清单 / mode-*
  assets/templates/                change-prd（主）/ lite-issue-prd / product-prd / ui-prototype
ai-dev-system/skills/ai-dev-workflow/
  SKILL.md                         skill 入口：路由 + 初始化
  references/core/                 共享内核，分三层加载：
    00-流程总纲.md                 骨架（常驻）：Triage + 四道门 + 步骤索引
    路径-lean.md / 步骤-1-7-*.md / 步骤-8-10-*.md   分册，按分流与阶段加载
    其余                           常驻纪律（worktree / 写作 / 文档治理 / 用户沟通 / 上下文卫生）
                                   + 条件加载纪律（AI overlay / bug 诊断 / 代码评审 / 测试资产）
  references/personal/             个人薄外壳
  references/company/              团队外壳 + Engineering Context 完整设计
  references/init-初始化.md         幂等写入 CLAUDE.md/AGENTS.md 的规则
  assets/templates/                spec/plan/test/overview/lean-change-spec/test-coverage 模板
  assets/config-snippets/          注入 CLAUDE.md/AGENTS.md 的 personal/team 片段
  assets/context-layer/            capability-registry/card/scene-blueprint/probe-set/glossary 模板
  scripts/ctx/                     ctx CLI（src/ + test/ + fixtures/）
```

## 安装器的关键设计（`install.mjs`）

默认安装源是 `https://github.com/weidwonder/ai-dev-system.git` 的 `main` 分支。安装后会在目标项目 `.gitignore` 幂等追加标记块（`# ai-dev-system:gitignore:start/end`），按 skill 名逐条忽略 `.claude/skills/<name>/`、`.agents/skills/<name>/` 与版本 stamp，避免本体系随目标仓库提交，且不误伤用户自己的 skill。安装器先把 `--repo` / `--ref` 指定的版本拉到系统临时目录，确认其中存在有效 skill 后，才读取并修改目标项目；下载或源校验失败时目标项目保持不变，临时目录在成功、取消、预演和异常场景都会清理。`--source-dir` 仅用于验证当前工作区未发布内容，不是正式安装路径。

装 skill 时会在**目标项目级** settings 里把 4 个 Claude Code 冲突插件（`superpowers`、`everything-claude-code`、`oh-my-claudecode`、`general-task`）设为 `false`——它们的 brainstorming HARD-GATE、强制前置 skill、端到端引擎、SessionStart 注入会截胡本流程。原理：Claude Code settings 优先级 `Managed > Local > Project > User`，项目级 `false` 覆盖用户级 `true`，于是**只在本项目禁用，不影响全局**。默认写 `.claude/settings.local.json`（gitignored），`--shared` 才写 `.claude/settings.json`。合并时**不覆盖** `enabledPlugins` 里的其他键。

`CLAUDE.md` / `AGENTS.md` 允许是软链接（两个工具共用一份指导文件的常见做法）：安装器逐层解析到实体文件再按标记块写入，链接本身保留；两个入口解析到同一实体时只写一次；断链在复制任何 skill 之前就报错退出，目标项目零改动；全局卸载分支也不删作为入口的链接。skill 侧的同一套规则在 `ai-dev-workflow/references/init-初始化.md` §入口是软链接时，改一处要两处同改。

Codex 安装默认不修改用户级全局插件配置，而是在目标项目 `AGENTS.md` 写入并校验 `ai-dev-system:codex-conflicts` 标记块，约束 `superpowers:` 不要自动加载或主动触发，除非用户在当前对话明确要求。交互安装可明确选择全局卸载，自动化安装使用 `--codex-conflicts=uninstall`；该选择影响当前用户的所有项目。若 `CLAUDE.md` 或 `AGENTS.md` 已有 workflow mode，安装器会幂等补齐另一入口。`--keep=superpowers` 会保留 Claude Code 插件，并移除安装器此前写入的 Claude 禁用项与 Codex 约束块。

## 改动时注意

- 改 skill 行为 → 改对应 skill `references/` 下 markdown；改模板 → `assets/templates/`；两者是 skill 的"源码"。改前后过一遍 `docs/spec/2026-07-16-skill写作自检清单.md`（信息层级 / 六大失败模式 / 交叉引用同步）。新增 skill 只要放进 `ai-dev-system/skills/<name>/` 并含 `SKILL.md`，发布到安装源后 `install.mjs` 会自动发现并复制，无需改安装器；发布前用 `--source-dir=.` 验证。
- 用户沟通必须使用业务语言：大架构交给用户确认，模块内设计只问业务问题，详细程序设计不要求用户确认；`ai-prd` 的对话与成稿不得包含程序实现。
- 进入 workflow 后，任何文档或代码落盘前必须按 `references/core/worktree开发纪律.md` 建立独立 worktree；Lean 也不例外。全部门禁通过后自动合并主分支，失败保留 worktree，禁止处理主工作树的用户改动或绕过保护分支。
- **`agentic-principle` 是外部伴生技能，严禁把它的内容搬进本仓库**：它管 Agent 系统**怎么设计**（场景选型/提示词/工具边界/注意力与并发预算/长产物分区/步骤级测试与评测），本体系的 `AI-LLM-overlay.md` 只管**运行期 AI 契约**（确定性边界/版本 pin/输出校验/置信度路由/安全管线/降级/预算准入/eval 门/可观测/数据边界/可审计）。两边只用指针互引，各自独立演进。安装器把它装到**用户级** `~/.claude/skills/` 与 `~/.codex/skills/`（`install.mjs` 的 `COMPANION_SKILLS`；注意两侧目录不对称——`.agents/` 只是 Codex 的**项目级**目录，用户级是 `~/.codex/`），每次运行检查远端版本、更旧才更新，symlink 或 git 工作区只报告不覆盖，拉取失败降级为警告；改这条链路要同改 `install.mjs`、`AI-LLM-overlay.md` §Agentic 应用、`代码评审纪律.md` 的 D 轴、两个 config-snippet，并跑 `node --test test/companion-skill.test.mjs`。
- **替换清单是跨文件的契约**：登记在 spec（`eng-spec.md` §8.2 / `lean-change-spec.md` 替换清单节）、拆成任务在 `coding-plan.md` 核销表、核销在 `代码评审纪律.md` 的残留轴。改判据（该删什么、保留例外认哪几类理由）要四处同改，且与 `eng-spec.md` §8.1 兼容取舍的到期日保持一致——两处日期不一致就是漏洞。
- **文档生命周期是跨文件的契约**：判据与字段的权威定义在 `references/core/文档治理.md` §文档生命周期与索引门控（`lifecycle` / `last_confirmed` / `authority_refs`、索引分层、按权威面触发），落地写法（归档头注、结算示例、账本收敛）在条件加载的 `references/core/文档归档与账本收敛.md`，结算动作在 `worktree开发纪律.md` §完成与自动合并门与 `00-流程总纲.md` 门表，字段落在五个 spec/plan 模板与三类 PRD 模板的 frontmatter，账本入口在 `bug诊断纪律.md` Phase 0/3 与 `测试资产纪律.md` §3，PRD 侧对应 `ai-prd` 的 §PRD 生命周期与 `UI原型纪律.md` §4.5。改判据要沿这条链同改。两个易错点：**①触发面是"本次触碰的权威面"，与刷 card 同一个面，MUST NOT 退化成"照抄替换清单"**——只改语义不删东西（枚举加值、可选改必填）的改动替换清单为空，却同样让文档失准；**②字段名是 `lifecycle` 不是 `status`**——`lean-change-spec` 的 `写作进度` 与 `product-prd` frontmatter 的 `status` 都已占用后者语义。
- **测试资产目录约定**：探测项目既有测试目录优先，兜底 `tests/fixtures/<场景名>/`；凭证进同级 `secrets/`（gitignore）+ `secrets.example/`（入库）。权威定义在 `references/core/测试资产纪律.md` §2，`test-spec.md` §4 Fixture 表与 `文档治理.md` 的表格引用它，改约定要三处同改。
- **UI 原型是跨 skill 的契约**：`ai-prd` 涉及用户可见界面时产出 `docs/spec/<name>-prototype-YYYYMMDD.html`（单文件、零外链、可离线打开），`ai-dev-workflow` 的 Step 1/2/4/8 把它与 PRD 一并作为输入。改这条链路要三处同改：`ai-prd/references/UI原型纪律.md`（权威定义）、三类 PRD 模板的「UI 原型」五项表、`ai-dev-workflow/references/core/00-流程总纲.md` 的输入声明与参考 prompt。
- `ai-prd` 的北极星参考物是 `orgin/prd.demo/` 下的变更 PRD 范例（brownfield 变更 PRD 骨架，本地参考、不入库）；改 `change-prd.md` 模板前对照设计文档 `docs/spec/2026-07-06-ai-prd-design.md §7` 的覆盖度映射，别丢节。
- 改 `ctx` 逻辑 → 同步更新 `scripts/ctx/test/` 下的测试，跑 `node --test` 保持全绿。card/registry 的格式约定见 `scripts/ctx/README.md` §card 格式约定，解析器依赖它。
- 改 `assets/context-layer/` 模板 → 同步 `scripts/ctx/src/commands.js` 内对应的 init stub（脚手架用的精简副本），反之亦然；两处漂移会让 `ctx init` 生成物与文档教的模板不一致。
- 本仓库自身与安装目标的文档目录固定为：spec → `docs/spec/`，plan → `docs/plan/`，report → `docs/report/`。
- **版本管理**：分发版本在 `ai-dev-system/VERSION`（旧无 stamp 安装追认为 1.0.0）。凡改变已安装项目的行为契约或目录约定就 bump；需要用户动作的升级必须同时新增 `ai-dev-system/migrations/<新版本>.md`（安装器会在升级时高亮全文打印，指南保持一屏内）。安装器把版本 stamp 写入目标两个 skills 目录的 `ai-dev-system.version`。**每次版本变更合入 main 后必须打 annotated tag `v<版本>`**（如 `v1.1.0`），tag 与 VERSION 始终一致，供 `--ref=v<版本>` 锁版本安装与回溯。机制详见 `docs/spec/2026-07-16-skill版本管理与迁移机制.md`；改动后跑 `node --test test/installer-migration.test.mjs`。
