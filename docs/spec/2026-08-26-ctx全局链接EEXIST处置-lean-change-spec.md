---
lifecycle: active
superseded_by: ''
archived: ''
last_confirmed: '2026-08-26'
authority_refs:
  - 'install.mjs 中 npm link 失败后的分支判定：EEXIST 与其余失败分开处置'
  - 'EEXIST 之后的归属判定方式：PATH 上的 ctx 签名匹配，或 npm root -g 下 ctx 包的符号链接目标含 ai-dev-workflow / 入口脚本含签名串'
  - '确认归属后才执行 npm link --force；判不出归属时一个字节都不动'
  - 'npm link 的输出由安装器捕获，失败时回显末尾若干行'
---

# Lean Change Spec（一页）— 安装器在 Windows 上撞到已存在的全局 ctx 时的处置

- **Issue / 链接**：N/A（用户在 Windows 上重装时报告）
- **Owner**：weidwonder
- **写作进度**：Done
- **Triage 复核**：AI/LLM 行为？否 鉴权/安全/设备？否 跨服务/迁移/不可逆？borderline 指标/规则/对外承诺？borderline
  - borderline 说明：本改动会**覆盖用户全局命令目录里的一个文件**（不可逆），且修订了 [ctx 全局命令安装](./2026-08-16-ctx全局命令安装-lean-change-spec.md) 里"不覆盖同名命令"这条对外承诺。两点都已在本次对话由用户逐条拍板（见〈兼容取舍〉），决策点收敛，故按 Lean 一页落地。

## 改什么（现状 → 期望）

现状：Windows 上换项目重装时，`npm link` 因全局命令目录里已有上次留下的 `ctx` 文件而报 `EEXIST` 退出，安装器把它归入"npm 全局目录没有写权限"，用户按提示重试同一条命令必然再失败，全局 `ctx` 命令从此不可用。
期望：安装器分辨出这是 `EEXIST`，确认那个残留确实是本体系上次留下的之后覆盖成本次这份；判不出归属就一个字节都不动，改为打印文件路径与处置指引。

**本次功能需求**：

- FR-001 — `npm link` 的输出由安装器捕获并据此分辨失败类型：`EEXIST`（全局目录已有同名文件）与其余失败（写权限等）走不同分支，失败时 npm 自己的原文 MUST 回显给用户。
- FR-002 — 撞到 `EEXIST` 时先判定那个已存在文件的归属：PATH 上跑得通且签名匹配，或 `npm root -g` 下的 `ctx` 包认得出是本体系的（符号链接目标含 `ai-dev-workflow`，或入口脚本含签名串），二者任一成立即为"本体系上次留下的"。
- FR-003 — 归属确认后用 `npm link --force` 覆盖成本次安装的这份，随后仍走既有的实跑 `ctx --help` 验证才报成功。
- FR-004 — 归属判不出时 MUST NOT 覆盖，改为打印该文件的完整路径、可自行删除或 `npm rm -g ctx` 后重跑、以及 `--no-ctx-link` 跳过这一段，并给出 `node <skill>/scripts/ctx/src/cli.js <命令>` 兜底调用方式；安装器退出码仍为 0。

## 为什么

`ctx` 是本体系"任何项目都禁止 grep 旧代码找权威实体"这条铁律的唯一入口。命令不可用时，使用者（尤其是零上下文的 AI agent）极易把"命令找不到"误读成"Engineering Context 不可用"而退化成裸 grep。而这条失败路径在 unix 上撞不出来——那边 `npm` 直接替换自己的符号链接，所以它只在 Windows 上必现，且**每一台换过项目、或删过旧项目的 Windows 机器都会撞上**，不是边角情形。

原提示语"常见原因：npm 全局目录没有写权限"在这个场景是误导：目录可写，冲突的是那一个文件；照提示手动重试 `npm link` 只会得到同一个 `EEXIST`。

## 具体改动点

- `install.mjs` `linkCtxCli` — 改为捕获输出（`quiet: true`）并返回 `{ ok, out }`，新增 `force` 选项走 `npm link --force`。
- `install.mjs` — 新增 `printNpmOutput`（失败时回显 npm 原文末尾若干行）、`parseEexistPath`（认 `EEXIST` 并取出 `npm error path` 的路径，兼容旧 npm 的 `npm ERR!`）、`globalCtxIsOurs`（`npm root -g` → 读符号链接目标或入口脚本签名）。
- `install.mjs` `syncCtx` — link 失败后先走 EEXIST 分支：归属确认则 `--force` 重试，判不出则打印处置指引后返回；其余失败沿用原文案并追加 npm 原文回显。
- `test/ctx-link.test.mjs` — 假 npm 增加 `root -g` 与 `EEXIST` 模拟（含 `--force` 才成功），sandbox 增加 `ownCtx` / `globalCtx`（`ours-symlink` / `ours-file` / `foreign`）三种夹具；新增 4 个用例。
- `CLAUDE.md` §安装器的关键设计、`README.md` / `README_zh.md` 的安装器职责第 6 条、`scripts/ctx/README.md` §安装/运行 — 同步失败分类与 Windows 重装的处置。
- `docs/spec/2026-08-16-ctx全局命令安装-lean-change-spec.md` — 兼容取舍那条"不覆盖同名命令"加指针，指向本文的修订。

## 影响范围 / 不做什么

- 影响：`install.mjs` 的 `syncCtx` 一段；Windows 用户全局命令目录里那一个名为 `ctx` 的文件（仅在归属确认后）。
- **不做**：不改 ctx CLI 本身的任何逻辑与命令语义，不改 `--no-ctx-link` 之外的选项，不碰 codegraph 那一段。
- **不做**：不因为"反正判得出"就顺手清理全局目录里别的残留；判定只回答"这一个文件是不是我们的"。
- 关键 NFR：跨平台——新增判定全程用 `node:path` 与 `fs.lstat/readlink`，不解引用可能已断链的符号链接（断链正是 EEXIST 的成因之一），不假设 unix 可执行位。
- 既有系统清单：`install.mjs` 的 `runTool` / `toolFailed` / `detectCtx` / `syncCtx` / `CTX` 常量（`install.mjs:845-950`）；`ctx` 的 `package.json` 的 `name` + `bin` 两字段（`scripts/ctx/package.json:2,7`）；`cli.js` 的 HELP 首行签名（`scripts/ctx/src/cli.js:117`）。
- 本次补的卡片：无需新补——本仓库是 skill 分发包，`install.mjs` 的口径由 `CLAUDE.md` §安装器的关键设计承载，不另建 `engineering-context/` 卡片。

## 兼容取舍（用户拍板，定稿前必填）

- 安装器新增"在确认归属后覆盖用户全局命令目录里的 `ctx` 文件"这一行为，修订了 2026-08-16 那条"不覆盖同名命令"的承诺 —— 谁在依赖：所有跑过本安装器的人 —— 用户决定：**确认归属后自动覆盖**（判不出归属仍绝不覆盖，只给指引） —— 确认于 2026-08-26。
- 承诺的边界随之收窄为：**不覆盖别人的同名命令**，本体系自己上次留下的旧链接照旧替换（与 unix 侧 `npm link` 的既有行为一致）。

## 替换清单（本次淘汰了什么）

| 被取代物 | 类型 | 取代者 | 处置 | 保留理由 + 到期日 |
|---|---|---|---|---|
| `linkCtxCli(dir)` 返回布尔、输出直接 inherit 的形态 | 函数签名 | `linkCtxCli(dir, { force })` 返回 `{ ok, out }` | 删除 | — |
| "npm link 失败 = 没有写权限"的单一归因文案 | 提示语 | 按 EEXIST / 其余失败分类的两套文案 | 删除 | — |

## 验收标准（可判定，含边界/失败用例）

- [x] AC-001 EEXIST + PATH 上的 `ctx` 就是本体系的 → 自动 `npm link --force` 重试并报成功 —— 满足：FR-002 FR-003
- [x] AC-002 EEXIST + 命令不在 PATH 上、但 `npm root -g` 下的 `ctx` 认得出是本体系的（符号链接目标含 `ai-dev-workflow`，目标目录已不存在也算；或入口脚本含签名串）→ 同样 `--force` 覆盖并报成功 —— 满足：FR-002 FR-003
- [x] AC-003 EEXIST + 全局包目录里没有 `ctx`，或那个 `ctx` 不是本体系的 → 不出现 `npm link --force`，打印文件路径与 `npm rm -g ctx` 指引 + 兜底调用方式，不报"已全局可用"，安装器退出码 0 且 skill 产物完好 —— 满足：FR-004
- [x] AC-004 非 EEXIST 的 link 失败（如 EACCES）→ 沿用原文案，并逐行回显 npm 自己的输出 —— 满足：FR-001
- [x] AC-005 既有四条路径（本机没有 ctx / link 失败 / 链完不在 PATH / PATH 上是别人的 ctx）与 `--no-ctx-link`、`--dry-run` 行为不变 —— 满足：FR-001

## 如何验证

- [x] `node --test test/ctx-link.test.mjs` 全绿（11 项，其中本次新增 4 项）。
- [x] `node --test test/*.test.mjs` 全绿（333 项）。
- [x] 变异验证：把 `syncCtx` 里 EEXIST 的归属分支短路成 `false`，AC-001 / AC-002 两条用例转红；恢复后复绿——证明新用例真的在测新逻辑，而不是被既有路径接住。
- [x] 真机复现（macOS，真 npm，隔离 `npm_config_prefix`）：把全局 bin 里的 `ctx` 换成普通文件后跑 `npm link` → 得到与报告者完全一致的 `npm error code EEXIST` / `npm error path <文件>` 三行；`npm link --force` 则成功覆盖回符号链接——`parseEexistPath` 的正则与 force 策略据此对齐真实输出。
- [x] 真机端到端（同上隔离环境）：对同一目标项目二次安装并预先破坏全局 `ctx` → 安装器打印「全局命令目录里已有本体系上次留下的 ctx（…），覆盖成本次安装的这份」→ `npm link --force` → 实跑验证报「✓ ctx 已全局可用」，`ctx --help` 首行签名正确。
- [ ] Windows 真机复验：在报告者机器上换项目重跑安装器，确认同一段输出与 `ctx --help` 可用。**待报告者复跑确认**——EEXIST 只在 Windows 必现，macOS 侧是人工制造出来的等价条件。
- [x] **代码评审门**：见下节。

## 回滚方式

`git revert` 本次提交即可：改动全在 `install.mjs` 的 `syncCtx` 一段与其测试，不涉及目标项目已落盘的任何内容，也不改 `ai-dev-system/VERSION`（本次不改变已安装项目的行为契约，故不 bump、不出迁移指南）。
