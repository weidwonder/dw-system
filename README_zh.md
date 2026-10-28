# dw-system — 让 AI 交付变得可靠

[English](./README.md) | **中文**

![Node ≥20](https://img.shields.io/badge/Node-%E2%89%A520-brightgreen) ![零运行时依赖](https://img.shields.io/badge/dependencies-zero-blue) ![Claude Code · Codex](https://img.shields.io/badge/works%20with-Claude%20Code%20%C2%B7%20Codex-8A2BE2) ![跨平台](https://img.shields.io/badge/platform-macOS%20%C2%B7%20Linux%20%C2%B7%20Windows-lightgrey) ![许可证：MIT](https://img.shields.io/badge/license-MIT-yellow)

**给 Claude Code 与 Codex 用的八个 skill，把一个原始需求逐层降解成"零上下文的 AI agent 也能可靠执行"的任务**——从 Triage 分流、顶层设计、技术 spec、coding plan，到编码、评审与测试。让 AI coding 可靠的不是更用力的 prompt，而是工程化。

它裁剪自一套在真实生产环境（**50~60 个 brownfield 仓库、双周高速迭代**）验证过的 AI 辅助开发体系。每个 skill 只管一件事，流程走到哪一步才加载哪一个。

```bash
# 在你的项目根目录运行——macOS、Linux、Windows 通用。需要 Node.js 20+、npm 与 Git。
npx --yes git+https://github.com/weidwonder/dw-system.git .
```

[快速上手](#快速上手) · [为什么选它](#为什么选它) · [工作方式](#工作方式) · [仓库里有什么](#仓库里有什么) · [ctx CLI](#ctx-cli-速览) · [安装选项](#安装选项) · [文档](#文档) · [许可证](#许可证)

---

## 快速上手

1. **安装**：运行上面那条命令。交互安装时，安装器可能先问一两个问题（[问什么](./INSTALL_zh.md#项目级安装)），然后打印计划，请你确认后才改动项目。装完重启 Claude Code / Codex——项目配置与指令在下一个会话才生效。
2. **在 Claude Code 或 Codex 里描述一个改动**，例如：

   > 用 dw-workflow：订单导出的 CSV 里加一列"下单来源"。

   提到"AI 辅助开发""开发流程""生成 spec""coding plan"同样会触发。还没有 PRD？说"帮我把这个需求写成 PRD"，`dw-prd` 会产出一份，作为流程的输入。
3. **回答一次性的初始化提问**。首次唤起时只问一个问题——这个项目除你之外还有没有人一起开发——并在同一批里给出做完的改动怎么回到主分支的建议请你拍板：本地直接合并，还是推 PR 由平台合并。扫描到与本流程冲突的规则、skill 或 agent 时，也在同一批里请你逐项决定怎么处理。结论写进 `CLAUDE.md` 与 `AGENTS.md`，之后不再询问。

以上面的 CSV 需求为例，接下来会发生：

| 阶段 | AI 做什么 | 你在哪里参与 |
|---|---|---|
| 隔离 | 建一个独立的 git worktree，你的主工作树一个字节都不动 | — |
| 取事实 | 首次运行时建好 `engineering-context/` 骨架；用 `ctx` 查导出列定义在哪，没有卡片覆盖就读源码并当场补卡 | — |
| 分流 | 四个判定问题把这次改动分到一页 Lean Change Spec | — |
| 确认 | 列出这次改动会改变的每一条既有行为，以及 spec 的范围与验收标准 | 你拍板兼容取舍、确认 spec |
| 实现 | 编码、当场删掉被取代的旧逻辑、写 CHANGELOG 条目、跑 spec 里的验证命令 | — |
| 评审 | 子代理逐轴评审本次改动，P0 / P1 问题修完 | — |
| 合并 | 按你初始化时的选择：本地合并并清理 worktree，或开 PR。门禁或合并失败时保留 worktree，不绕过 PR、CI 与保护分支 | 走 PR 时由你放行 |

更大或风险更高的改动改走完整流程：PRD 澄清 → Overview（改动跨多个仓库或模块时）→ 技术 spec → coding plan → 编码 → 评审 → 测试 spec → 测试代码 → 端到端测试，门禁一道不少。

---

## 为什么选它

- 🎯 **一条命令装进任意项目**，Claude Code 与 Codex 同时安装。初始化只问一个问题、拍板一条建议，只此一次；代码事实层由体系自己建骨架，没有"档次"要你选。
- 🧠 **Engineering Context 是真正的护城河**——能力登记表、按业务域分的事实卡、端到端场景蓝图、卡片体检（`ctx lint-cards`）、Frozen Probe Set 防腐门禁。每条事实带 cite（`path#anchor @确认时间`）；**无 cite 视为幻觉**。
- 🪶 **零运行时依赖**——纯 Node.js 标准库 + markdown。没有 build、没有 lockfile 漂移、没有需要伺候的东西。
- 🔒 **纪律是内建的，不是贴上去的**——每次改动都在独立 worktree 里做、全部门禁通过才合并、RFC 2119 spec 写作零占位符、方案与代码都守 YAGNI / KISS / DRY / LoD。
- 🗣️ **你只回答业务问题**——大架构由你确认；模块内设计通过业务问题取约束；详细程序设计由 AI 完成。没有任何一步要求你懂实现细节。
- ⚖️ **流程重量刚刚好**——4 问 Triage 把小改动分到一页 Lean Change Spec，把真风险（AI 行为、安全、跨服务、不可逆、对外承诺）升级进完整流程。

---

## 工作方式

### 两条总纲

整套体系受两条总纲约束，它们同时是体系教给你的项目的写法：

1. **一个事实只有一个家，别处只放链接。**
2. **规范文本有体积上限，超限先搬走、再压缩，最后才抬上限。**

### 一层必备地基：代码事实层

装了 dw-system 的项目一律维护 `engineering-context/`：能力登记表 + 每仓一张地图卡 + 每个业务域一张域卡。不分项目大小、不分人数、没有开关。

首次唤起时它在任务 worktree 里建好骨架（`ctx init`），骨架里只有模板占位是正常的起步状态。之后的规矩只有一句：**要用某个模块的事实就先查卡片；没有卡片就读源码，读完当场把卡片补上**，随本次任务分支一起提交，不顺延。AI 用 `ctx discover "<意图>"` 找权威实现，而不是 grep 旧代码。

代价说在明处：在既有代码库上，前几次任务会慢一点（读源码 + 写卡片是实打实的工作量），之后越来越快，而且这件事不再需要你惦记。

> **为什么是必备项**：任何"这个项目该用哪一档"的判据都滞后于项目的实际风险。一个人维护的十万行遗留系统恰恰一张卡片都没有——分档判据会把它放行成"直接 grep 旧代码"，而那正是这套体系要消灭的失败模式。AI coding 能不能落地，关键不在流程本身（谁都能抄），而在**能不能给 AI 一层可信赖的代码事实**。

### 随项目变化的三件事

| 设置 | 怎么定 | 决定什么 |
|---|---|---|
| **协作面**——除你之外还有没有人一起开发 | 初始化时问一次，写进 `CLAUDE.md` / `AGENTS.md` | 改别人的仓库前要不要先对齐 owner、跨 ≥3 仓的改动要不要开评审会、兼容取舍由谁拍板 |
| **合并方式**——本地合并还是走 PR | 初始化时给出建议由你拍板，写进同一个标记块 | 本地合并：全部门禁通过后合并，发版由你自己打 tag。走 PR：PR 带版本号升位与 CHANGELOG 版本节，**合并即发布**，合并提交打 tag |
| **代码图谱**——项目有没有建本地 [codegraph](https://github.com/colbymchenry/codegraph) 索引 | 每次运行探测，不问也不写配置 | 只影响找东西的速度（符号、调用链、影响面），不改变任何流程判据，也回答不了"该信哪一个实现"——那是卡片的职责。没有它时，重的代码探索交给子代理 |

---

## 仓库里有什么

```
.
├── install.mjs / install.cmd   # 安装器与 Windows 入口
├── package.json                # npx 入口
├── INSTALL_zh.md               # 安装器会对你的项目做什么
├── CHANGELOG.md
├── dw-system/
│   ├── VERSION                 # 当前版本；安装器按它取同名 tag
│   ├── migrations/             # 各版本迁移指南，升级时由安装器打印
│   └── skills/                 # 八个 skill（Claude Code 与 Codex 共用）；每个 = SKILL.md + references/ + assets/ + scripts/
│       ├── dw-workflow/        # 两条总纲、路由与初始化、Triage、两条路径的步骤顺序、确认门、spec 写作、测试阶段
│       ├── dw-prd/             # 从零产 PRD：批量提问 + 三类模板 + HTML 原型（scripts/preview.mjs）
│       ├── dw-worktree/        # 工作区隔离门与完成合并门
│       ├── dw-code-facts/      # 代码事实层、ctx CLI（scripts/ctx/）、变更日志与依赖声明、代码图谱
│       ├── dw-bug-diagnosis/   # 查重、红回路、可证伪假设、防回归
│       ├── dw-review-gate/     # 代码评审门：范围与积压、对象面、评审轴、子代理模板、替换清单
│       ├── dw-doc-governance/  # 文档放哪、活多久、怎么退场；决策记录
│       └── dw-prose/           # 规范文本、注释、卡片与提示词怎么写
├── docs/                       # 本仓库自己的需求真相源、TODO、spec / plan / report、决策记录
└── test/                       # 机器闸与安装器、ctx、preview 的测试（不随 skill 分发）
```

**skill 之间的分工**：`dw-prd` 从零把需求做成 PRD；这份 PRD 是 `dw-workflow` Step 1 的输入；workflow 定顺序，走到每道门时加载那道门的 skill。每个 skill 的入口写明它管什么、相邻的事找谁。

---

## ctx CLI 速览

`ctx` 随 `dw-code-facts` 一起分发，安装时链接成全局命令。全局命令不可用时改用 `node <skill>/scripts/ctx/src/cli.js <命令>`——CLI 本体始终在磁盘上。

| 命令 | 作用 |
|---|---|
| `ctx init` | 生成 `engineering-context/` 目录骨架 |
| `ctx discover "<意图>"` | 意图 → 应加载的 card 清单 + out-of-scope 警告 |
| `ctx get-card <repo> [域]` | 取某仓地图卡；给了域先读域卡 `cards/<repo>/<域>.md` |
| `ctx find-scenes <关键词>` | 端到端业务场景蓝图 |
| `ctx list-services` | 列出已登记仓库（带名下的域）/ 能力 |
| `ctx lint-cards` | 卡片体检：固定小节、体积、cite 能否解析等七条规则；存量违规记入只减不增的基线 |
| `ctx search-semantic "<q>"` | discover 未命中时的语义兜底（本地向量相似） |
| `ctx probe` | 跑 Frozen Probe Set 防腐门禁（自检 + 棘轮 + 衰减） |

完整说明：[`dw-system/skills/dw-code-facts/scripts/ctx/README.md`](dw-system/skills/dw-code-facts/scripts/ctx/README.md)。

---

## 安装选项

```bash
# 项目级（推荐）：装进 .claude/skills/（Claude Code）与 .agents/skills/（Codex）
npx --yes git+https://github.com/weidwonder/dw-system.git .

# 预演：只打印计划，不落盘
npx --yes git+https://github.com/weidwonder/dw-system.git . --dry-run

# 无人值守：开头的 --yes 只跳过 npm 的下载提示，目标目录后面那个才跳过安装器自己的确认
npx --yes git+https://github.com/weidwonder/dw-system.git . --yes

# 端到端锁定一个版本：安装器入口与 skill 源取同一个 tag（版本号见 dw-system/VERSION 与 CHANGELOG.md）
npx --yes git+https://github.com/weidwonder/dw-system.git#v<版本> . --ref=v<版本>

# 改为跟随开发分支
npx --yes git+https://github.com/weidwonder/dw-system.git . --ref=main

# 全机共用：装进 ~/.claude/skills/ 与 ~/.codex/skills/，所有项目共用，不碰任何项目文件
npx --yes git+https://github.com/weidwonder/dw-system.git --global

# 全部选项
npx --yes git+https://github.com/weidwonder/dw-system.git --help
```

请用 `git+https://` 形式，不要用 `github:weidwonder/dw-system` 简写：简写会让 npm 下载 tarball，在部分环境返回 404（已知 Windows + npm 12）；`git+https://` 走 `git clone`，绕开了这条路。

安装器默认取与自身 `dw-system/VERSION` 同名的 tag，所以安装器与它装出的 skill 是同一个版本；该 tag 还没发布时告警并回退到 `main`，要严格锁定版本请显式传 `--ref`。显式传的 `--ref` 取不到时以非零退出码失败，不会悄悄装成别的版本。**升级**就是再跑一次安装命令；需要手动动作的版本，安装器会打印它的迁移指南。

| 选项 | 作用 |
|---|---|
| `--dry-run` | 只打印计划，不落盘 |
| `--yes` | 跳过安装器的确认 |
| `--global` | 装进用户级 skill 目录，而不是某个项目 |
| `--ref=<tag 或分支>` | 安装指定版本（默认：安装器自己的版本） |
| `--shared` | 插件设置写进 `.claude/settings.json`（提交进 git，全队生效），而不是 `.claude/settings.local.json`（gitignored，只影响你） |
| `--keep=<插件>` / `--no-plugins` | 保留某个冲突插件 / 完全不动插件设置 |
| `--docs-in-git=yes\|no` | `docs/` 与 `engineering-context/` 是否提交进 git（不传则问一次，默认 `no`） |
| `--no-companions` | 跳过伴生 skill `agentic-principle` 与 `skill-principle` 的安装 |
| `--no-ctx-link` | 不把 `ctx` 链接成全局命令 |
| `--no-codegraph` / `--codegraph-location=global` | 整段跳过 codegraph / 接线到所有项目而不只是本项目 |

**安装器会对你的项目做什么**——每一步动作、只在本项目禁用的冲突插件（四个 Claude Code 插件与 Codex 的 `superpowers@openai-api-curated`）、全局安装的行为、Codex 用户须知、如何撤销——见 [INSTALL_zh.md](./INSTALL_zh.md)。

---

## 文档

- [`docs/index.md`](docs/index.md)——现行设计文档索引；[`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)——本仓库现在是什么、有哪些功能
- [`docs/decisions/`](docs/decisions/)——来历与被否决的方案
- [`CHANGELOG.md`](CHANGELOG.md)——各版本的变化；[`dw-system/migrations/`](dw-system/migrations/)——需要手动动作的版本的迁移步骤

---

## 许可证

[MIT](./LICENSE) © 2026 weidwonder
