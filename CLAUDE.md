# CLAUDE.md

本文件是在本仓库干活的常驻规则。改 skill 文档的细则在 [dw-system/skills/AGENTS.md](dw-system/skills/AGENTS.md)，每条机器闸守什么在 [test/AGENTS.md](test/AGENTS.md)，实现事实在 `engineering-context/` 的卡片里，来历在 [docs/decisions/](docs/decisions/)。按 RFC 2119 解释规范词。

## 这个仓库是什么

一套 AI 辅助开发方法的**分发包**，不是应用。交付四样东西：

- **八个 skill**（`dw-system/skills/`，Claude Code 与 Codex 通用）：`dw-workflow`（总纲、路由、分流、步骤顺序、确认门）、`dw-prd`（从零产 PRD 与 UI 原型）、`dw-review-gate`（代码评审门）、`dw-doc-governance`（文档放哪、活多久）、`dw-code-facts`（代码事实层与 `ctx`）、`dw-bug-diagnosis`（红回路）、`dw-worktree`（隔离门与合并门）、`dw-prose`（文字怎么写）。
- **`ctx`**：零依赖 Node CLI，查目标项目的 `engineering-context/`。源码在 `dw-system/skills/dw-code-facts/scripts/ctx/`。
- **`preview.mjs`**：`dw-prd` 的原型工具，源码在 `dw-system/skills/dw-prd/scripts/`。
- **`install.mjs`**：把上面几样装进目标项目的 `.claude/skills/` 与 `.agents/skills/`，写标记块，迁移旧版残留。

没有 build 步骤、没有 lint 配置、没有 npm 运行时依赖：纯 Node.js ESM（≥20）加 markdown。

`orgin/` 与 `orgin.bak/` 是本地参考资料，已被 `.gitignore` 忽略，MUST NOT 推送，MUST NOT 当成交付的一部分。

## 两条总纲

展开在 `dw-system/skills/dw-workflow/SKILL.md` §两条总纲，本仓库自身同样受它约束：

1. **一个事实只有一个家，别处只放链接。** 归属表在同一份入口里。
2. **规范文本有体积上限，超限先搬走、再压缩、最后才抬上限。** 上限数值在 `test/doc-budgets.json`；抬上限 MUST 经拍板人同意并在该清单的 `note` 里写一句理由。

落到日常：

- 写一条规则前先找它的家。家以外只写名字加指针，指针写成「反引号包住的文件名 + § + 小节名」（例：`确认门.md` §spec 过稿门）——`test/cross-reference.test.mjs` 核对目标真实存在。
- 删除、合并或搬走一个含 MUST / SHOULD 的小节，MUST 在 `docs/report/*规范去向清单.md` 里交代去向，`test/rule-destinations.test.mjs` 逐节核对。
- 压缩文字按 `dw-prose` 的完整命题规则：每条命题留住，来历搬进 `docs/decisions/`。字数变少本身不算改进。

## 常用命令

```bash
# 全部测试。MUST 写通配符：Node ≥22 下 `node --test test/` 会把目录当模块解析
node --test test/*.test.mjs

# 单个测试文件
node --test test/ctx-cli.test.mjs

# 直接运行 ctx（无需安装）
node dw-system/skills/dw-code-facts/scripts/ctx/src/cli.js <命令>

# 用当前工作区的 skill 装进某个目标项目（开发与测试用）
./install.mjs <目标项目目录> --source-dir=. --dry-run   # 预演，不落盘
./install.mjs <目标项目目录> --source-dir=.

# 从发布源安装。MUST 写 git+https：`github:` 简写走 tarball，Windows 上新版 npm 会 404
npx --yes git+https://github.com/weidwonder/dw-system.git <目标项目目录>
```

## 目录

```
install.mjs / install.cmd   安装器与 Windows 入口
dw-system/
  VERSION                   当前版本；安装器默认按它取同名 tag
  migrations/<版本>.md      升级到该版本的迁移指南，安装器升级时打印
  skills/<skill>/           SKILL.md + references/ + assets/ + scripts/
test/                       机器闸与安装器、ctx、preview 的测试；不随 skill 分发
docs/                       本仓库自己的需求真相源、TODO、spec / plan / report、决策记录
engineering-context/        本仓库自己的代码事实层
```

## 改动规则

- **本仓库用自己的流程**：任何落盘前先建 worktree；改动范围不含可执行代码文件时 PRD 即 spec，含可执行代码的部分照常写 spec；编码完成过代码评审门。字段见文末标记块。
- **改 skill 文档前 MUST 加载 `skill-principle` 与 `dw-prose`**，并读 `dw-system/skills/AGENTS.md`。
- **新增或改动机器闸前读 `test/AGENTS.md`**。每条新闸 MUST 做反向自检：植入一个它该拦的样本确认判红，撤掉确认转绿。
- **伴生 skill（`agentic-principle`、`skill-principle`）与 `codegraph` 是外部资产**，MUST NOT 把它们的内容搬进本仓库；本仓库只负责安装、接线与点名加载。
- **旧名字**（`ai-dev-system`、`ai-dev-workflow`、`ai-prd`）只许出现在 `install.mjs` 的 `LEGACY` 表、迁移指南、CHANGELOG 既有条目与历史文档里；skills 树里只许一处——`dw-workflow/SKILL.md` 路由表里识别 3.0 之前安装的那一行（`test/installer-legacy-upgrade.test.mjs` 守）。移除这项兼容时删那一行与 `LEGACY` 表即可。
- **历史文档不回改**：`docs/spec`、`docs/plan`、`docs/report` 的存量文档、`dw-system/migrations/` 既有指南、`CHANGELOG.md` 既有条目，记录的是当时的事实。口径失准的按 `dw-doc-governance` 归档，MUST NOT 改写成现在的说法。
- **兼容取舍每次由拍板人定**，AI MUST NOT 默认向后兼容，也 MUST NOT 默认不兼容。
- **跨平台**：安装器与两个 CLI 在 macOS、Linux、Windows 上都要能跑。路径比较前统一成正斜杠；MUST NOT 依赖 shell 特性；符号链接只读链接字符串、不解引用后再删除。
- **零依赖**：`ctx`、`preview.mjs`、`install.mjs` MUST NOT 引入第三方 npm 依赖。
- **写方案与写代码守 YAGNI / KISS / DRY / LoD**（`dw-system/skills/dw-workflow/references/实现纪律.md` §设计原则）：没有需求对应的抽象、开关、配置项不写；两个 CLI 与安装器尤其如此。
- **`ctx --help` 的首行是安装器的归属判据**：安装器靠签名串 `Engineering Context CLI` 认 PATH 上那个 `ctx` 是不是本体系的。改首行 MUST 同改 `install.mjs` 的 `CTX.signature`。
- **本仓库的改动大多落在〈禁止积压清单〉里**（流程与门禁判据、标记块字段、CLI 参数）：这类改动 MUST 当场跑完整评审门，MUST NOT 走积压通路。

## 版本与发布

- 版本号在 `dw-system/VERSION`。有 `不兼容` 条目升主版本，否则有 `新增` / `变更` 升次版本，否则升修订号。
- 每次合并在 `CHANGELOG.md` 的 `## 未发布` 下至少写一条，分类取 `不兼容` / `新增` / `变更` / `修复` / `内部`。
- 需要用户手动动作的版本 MUST 带 `dw-system/migrations/<版本>.md`，≤45 行——安装器会整篇打印。不需要手动动作的版本不建指南。
- `VERSION` MUST NOT 低于 `migrations/` 里最高的那份指南，否则那份指南永远不会被打印。安装器默认按 `v<VERSION>` 取 tag，tag 没推时告警并回退 `main`；`package.json` 的 `files` MUST 带 `dw-system/VERSION`。
- 发版是拍板人的动作：改 `## 未发布` 的标题、打 tag `v<版本>`。AI MUST NOT 自行定版本号或打 tag，除非拍板人在本次任务里明确要求。

<!-- dw-workflow:start -->
> **本项目采用 dw-workflow**
> (collaboration="solo" merge-gate="direct" worktree-dir="./.worktrees/")
>
> 本块只放每个会话都要知道的规则与指针；每条规则的判据在它后面点名的 skill 里，到那一步 MUST 加载该 skill，MUST NOT 凭本块的一句话推断判据。skill 在 `.claude/skills/<名>/`（Codex 在 `.agents/skills/<名>/`）。按 RFC 2119 解释规范词。
>
> - **路由**：唤起 `dw-workflow` / `dw-prd` 时按本块字段路由，MUST NOT 再问一次。有没有代码图谱索引由 skill 每次运行时探测，MUST NOT 写死在本块。
> - **两条总纲**（展开在 `dw-workflow` 入口）：一个事实只有一个家，别处只放链接；规范文本有体积上限，超限先搬走、再压缩、最后才抬上限。
> - **落盘前 MUST 先建独立 worktree**（`dw-worktree`）：任何文档或代码落盘前，Lean 也不例外；多仓每仓一个。目录取本块 `worktree-dir`，每次从这里读；换位置 MUST 改本字段，MUST NOT 临时另建目录。MUST NOT 在主工作树直接改，MUST NOT stash / reset 用户既有改动。
> - **查代码事实 MUST 先用 `ctx`**（`dw-code-facts`）：`ctx find-scenes <关键词>` → `ctx discover "<意图>"` → `ctx get-card <repo> [域]`，每条事实 MUST 附 cite（`路径#符号` + 确认时间），无 cite 视为幻觉。查不到卡片 → 读源码核实并当场补卡（最小四节：职责 / 权威实现与对外接口 / 陷阱项 / 确认）、随本次分支提交，MUST NOT 顺延。`ctx` 命令找不到时用 `node <skills 目录>/dw-code-facts/scripts/ctx/src/cli.js <命令>`。两种情况都 MUST NOT 退回 grep 找权威实现。`engineering-context/` 没有开关，起步时只有模板占位是正常状态。
> - **bug、回归、异常行为**：改代码前 MUST 先造出能变红的复现回路（`dw-bug-diagnosis`）。
> - **AI MUST NOT 默认向后兼容**：spec 定稿前把被改变的既有行为逐条列出送拍板；被取代的旧函数 / 文件 / 配置 / 开关当场删除，保留项 MUST 带理由与到期日并登记进替换清单（`dw-workflow` 的 `确认门.md`、`dw-review-gate` 的 `替换清单.md`）。
> - **spec 定稿后、动手实现前 MUST 过 spec 过稿门**（`dw-workflow` 的 `确认门.md`）：只请拍板人看业务可判定的部分；他没回复 MUST NOT 推进；跳过只认他自己说"这次不用看"，且只对本次有效。
> - **改动落盘后（含只改 `docs/`）MUST 过代码评审门**（`dw-review-gate`）：判对象面 → 推评审轴 → 派子代理 → P0 / P1 修完；三个对象面都不命中时轴集合只有文档轴，MUST NOT 跳过本门。够小的改动 MAY 按该 skill 的规则登记积压；未过门也未登记积压时 MUST NOT 合并。
> - **写方案与写代码 MUST 守 YAGNI / KISS / DRY / LoD**（`dw-workflow` 的 `实现纪律.md` §设计原则）：没有需求对应的抽象、开关、配置项不写。
> - **纯 skill 改动**（范围不含可执行代码文件）：PRD 即 spec，动手前 MUST 加载 `skill-principle`；跳过的是产物，不是门（`dw-workflow` 的 `纯skill改动.md`）。
> - **文档**（`dw-doc-governance`）：spec → `docs/spec/`，plan → `docs/plan/`，report → `docs/report/`，决策记录 → `docs/decisions/`；新建文档 frontmatter MUST 带 `lifecycle: active` 与 `authority_refs`；`docs/index.md` 只放现行口径。需求真相源只写已实现的现状，还没做的去 `docs/TODO.md`。
> - **写或精简规范文本、注释、卡片、提示词**：按 `dw-prose`——删改前保住每条命题，只写现状，来历进决策记录。
> - **每次合并 MUST 在仓库根 `CHANGELOG.md` 的 `## 未发布` 下至少写一条**，在评审门之前写好；分类是闭集 `不兼容` / `新增` / `变更` / `修复` / `内部`，MUST NOT 自造，对外不可见的写 `内部`，MUST NOT 以"本次无对外变化"为由不写；升级上游版本前 MUST 先读 `engineering-context/dependencies/` 下它的依赖声明（`dw-code-facts`）。AI MUST NOT 替拍板人定版本号或打 tag。
> - **合并方式只读本块 `merge-gate`，与协作面无关**（`dw-worktree`）：`direct` 为全部门禁通过后本地非快进合并并清理 worktree；`pr` 为过评审门后开 PR，平台放行后才合并——本门是 PR 前的地板，MUST NOT 替代人审，平台未放行 MUST NOT 改用本地直合。合并失败 MUST 保留 worktree，MUST NOT 强推，MUST NOT 绕过保护分支。
> - **真实数据**固化进项目既有测试目录，没有则 `tests/fixtures/<场景名>/`，凭证进同级 `secrets/` 并 gitignore、脱敏副本入库；未覆盖的重要场景挂账到 `docs/report/测试场景覆盖度.md`；长链路 MUST 有断言中间结果的端到端用例（`dw-workflow` 的 `测试资产纪律.md`）。
> - **Agentic 应用**（命中任一即是：模型自主规划、直接调工具、未过确定性闸门就改状态、记忆跨会话影响决策）MUST 加载 `agentic-principle`；**新建或改动 skill** MUST 加载 `skill-principle`。两者是伴生 skill，判据以它们当前版本为准。
> - **与用户只用业务语言**：大架构 MUST 交用户确认，模块内设计只问业务问题，详细程序设计不要求用户确认（`dw-workflow` 的 `用户沟通纪律.md`）。
> - 本项目没有其他人类协作方：MUST NOT 向不存在的 owner 求证，MUST NOT 开评审会，MUST NOT 因等**第三方**（owner / 业务方 / 评审人）确认而挂起任务；**用户本人的兼容取舍拍板、用户本人在 spec 过稿门的表态、以及合并方式为 `pr` 时的平台审批与 CI 除外**（这些例外是门，不是对齐开销；前两者是仅有的两个允许因等用户而挂起的流程内点，MUST NOT 因为"只有我一个人用"就跳过）。需要第二意见时派子代理，不等人。
> - **兼容取舍每次由你（开发者本人）拍板**，AI MUST NOT 代拍，也 MUST NOT 因为"只有我一个人用"就跳过这次拍板。
> - 合并方式为 `pr` 时，PR 的审批人就是你本人：MUST 把 PR 链接与各轴报告结论交给你过目并请你放行，MUST NOT 静默等待外部审批；CI 失败按常规修复后重推，MUST NOT 改用本地直合。
<!-- dw-workflow:end -->
