---
lifecycle: active
superseded_by: ''
archived: ''
last_confirmed: '2026-08-16'
authority_refs:
  - 'install.mjs 的命令行选项：--no-ctx-link'
  - 'install.mjs 中 ctx 全局链接的来源目录：<项目>/.claude/skills/ai-dev-workflow/scripts/ctx'
  - 'ctx 可用性的判定方式：实跑 ctx --help 并匹配签名串 "Engineering Context CLI"'
  - 'assets/config-snippets/team.md 注入目标项目 CLAUDE.md/AGENTS.md 的内容'
---

# Lean Change Spec（一页）— 安装器把 ctx CLI 链接成全局命令

- **Issue / 链接**：N/A（对话内提出，起因是真实误判事故）
- **Owner**：weidwonder
- **写作进度**：Done
- **Triage 复核**：AI/LLM 行为？否 鉴权/安全/设备？否 跨服务/迁移/不可逆？borderline 指标/规则/对外承诺？否
  - borderline 说明：本改动会写用户的 npm 全局目录（新增一个全局 `ctx` 命令），并改动注入目标项目 `CLAUDE.md` 的团队版片段（因此 bump VERSION + 出迁移指南）。装法（`npm link`）、失败必须降级、以及"不得顶掉同名命令"三条边界在对话里已收敛，故按 Lean 一页落地。

## 改什么（现状 → 期望）

现状：`ctx` 随 `ai-dev-workflow` skill 复制进目标项目，但安装器对它**完全没有处理**——从不进 PATH。装完 `which ctx` 是空的。

期望：安装器在 skill 复制完成后，在 `<项目>/.claude/skills/ai-dev-workflow/scripts/ctx` 下 `npm link`，把 `ctx` 变成全局命令，并**实跑 `ctx --help` 验证**后才报成功；失败一律降级为警告 + 打印 `node <skill>/scripts/ctx/src/cli.js <命令>` 兜底方式。

## 为什么

skill 文档（`references/company/mode-team.md`、`scripts/ctx/README.md`、`SKILL.md`、注入到目标项目 `CLAUDE.md` 的团队版片段）通篇指导用户和 AI 用 `ctx <命令>`。命令不在 PATH 上时，使用者——**尤其是 AI agent**——极易把"`which ctx` 为空"读成"Engineering Context 不可用"，从而退化成裸 grep 旧代码。这正是团队版**明令禁止**的行为，也是本体系核心信念（给 AI 一层可信、新鲜、权威的代码事实）的直接失效。该误判已在真实使用中发生过。

同一段路径上 codegraph 有完整的安装 / 版本检查 / 升级 / PATH 缺失报错处理，而本体系**自己的** CLI 一点都没有，属明显的对称性缺口。

## 具体改动点

- `install.mjs` — 新增 `CTX` 常量与 `CTX_CMD_TIMEOUT_MS`；新增 `ctxPackageDir` / `ctxFallbackHint` / `detectCtx` / `linkCtxCli` / `printCtxPlan` / `syncCtx`；`main()` 的计划输出插入第 6 项（codegraph 顺延为第 7 项），在 dry-run 分支与伴生 skill 之后各调用一次 `syncCtx`（排在 `syncCodegraph` 之前，避免被小时级的建索引拖住）。
- `install.mjs` `parseArgs` / `helpText` / 文件头注释 — 新增 `--no-ctx-link`。
- `scripts/ctx/src/cli.js` — 补可执行位（`bin` 入口本就该可执行；`fs.cpSync` 保留 mode，Codex 侧 `.agents/` 副本与直接 `./src/cli.js` 调用同样受益）。
- `references/company/mode-team.md` §2 调用方式 — 改写：安装器会做全局链接；**"ctx 命令找不到"不等于 Engineering Context 不可用**；任何情况下不得因此退回 grep。
- `assets/config-snippets/team.md` — 注入片段第 1 条补一句兜底调用方式与"不是退回 grep"。
- `scripts/ctx/README.md` §安装/运行 — 说明安装器已自动 link，失败时直接运行方式照常可用。
- `README.md` / `README_zh.md` — 安装器职责清单新增第 6 条；团队版快速开始的 `ctx init` 示例改为"全局命令优先 + 兜底"两行。
- `test/ctx-link.test.mjs` — 新增：假 npm + 假 ctx 放进收窄的 PATH，覆盖全部分支。
- `test/{codegraph,install-and-doc-governance,installer-migration,companion-skill,npm-entrypoint}.test.mjs` — 既有用例统一加 `--no-ctx-link`，不让测试碰跑测试这台机器的全局安装。
- `ai-dev-system/VERSION` → `1.10.0`；新增 `ai-dev-system/migrations/1.10.0.md`。

## 影响范围 / 不做什么

- 影响：安装器执行链（skill 复制之后、codegraph 之前）；用户全局 npm 前缀目录（新增一个 `ctx` 命令）；注入目标项目 `CLAUDE.md` / `AGENTS.md` 的团队版标记块。
- **不做**：不改 ctx CLI 本身的任何逻辑与命令语义。
- **不做**：不把 ctx 发布到 npm registry，也不做用户级独立副本；全局命令指向最后一次安装的那个项目里的副本，靠"ctx 按 cwd 找 `engineering-context/`"这一既有设计做到一份命令服务所有项目。
- 关键 NFR：跨平台——经 `runTool` 调用（win32 走 shell，认得 npm 生成的 `ctx.cmd` shim），不假设 unix 可执行位，不用 `which` / `command -v`；子进程 stdin 一律 `ignore`；超时 5 分钟。

## 兼容取舍（用户拍板，定稿前必填）

- 安装器新增"向用户全局环境写一个 `ctx` 命令"这一行为 —— 谁在依赖：所有跑安装器的人 —— 决定：接受，默认开启，`--no-ctx-link` 可跳过 —— 确认于 2026-08-16。
- 全局命令的来源是**项目内**的 skill 副本（而非用户级独立副本） —— 谁在依赖：装了多个项目的用户 —— 决定：接受，重跑安装器即重新指向；删掉来源项目会失效，在迁移指南与安装输出里明说 —— 确认于 2026-08-16。
- PATH 上已有别人的同名 `ctx` —— 谁在依赖：自带 `ctx` 工具的用户 —— 决定：**不覆盖**，跳过链接并给兜底调用方式 —— 确认于 2026-08-16。

## 替换清单（本次淘汰了什么）

无。本次只新增执行段与选项，未取代任何既有逻辑。文档侧是措辞修正，不删节。

## 验收标准（可判定，含边界/失败用例）

- [x] 本机没有 `ctx` → 在安装好的 ctx 目录里 `npm link`，随后实跑 `ctx --help` 验证并报成功。
- [x] `npm link` 失败 → 只警告，打印手动重试命令与 `node <路径>/src/cli.js <命令>` 兜底方式，安装器退出码仍为 0，skill 产物完好。
- [x] `npm link` 跑通但命令不在 PATH → **不得**报"已全局可用"；如实报告并给 PATH 修复指引 + 兜底方式。
- [x] PATH 上已有非本体系的同名 `ctx` → 不执行 `npm link`，不顶掉它，只给兜底方式。
- [ ] 只装了 `ai-prd`（没有 ctx）→ 跳过该段，不报错。**代码路径已实现（`syncCtx` 里的 `package.json` 存在性判断），但无自动化用例覆盖**——发布源只装单个 skill 的场景本身没有既有测试夹具，挂账在此。
- [x] `--no-ctx-link` → 完全不调用 npm，但仍打印兜底调用方式。
- [x] `--dry-run` → 只做只读探测（`ctx --help`），不 link。
- [x] `--help` 含 `--no-ctx-link`。

## 如何验证

- [x] `node --test test/` 全绿（58 项，其中 ctx 链路 7 项）。
- [x] `cd ai-dev-system/skills/ai-dev-workflow/scripts/ctx && node --test` 全绿（31 项）。
- [x] 真机实链：`npm link` 后 `which ctx` → `/opt/homebrew/bin/ctx`；在 myclaws 项目里 `ctx list-services` 正确列出 6 个服务。
- [ ] **代码评审门**：三轴（规范 / 忠实 / 残留）——待跑。

## 回滚方式

`--no-ctx-link` 单次跳过；彻底回退则 revert 本次改动并把 `ai-dev-system/VERSION` 退回 1.9.0。已链接到全局的 `ctx` 由用户 `npm rm -g ctx` 自行移除，安装器不代劳卸载。
