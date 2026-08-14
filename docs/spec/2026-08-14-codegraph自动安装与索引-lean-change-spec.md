---
lifecycle: active
superseded_by: ''
archived: ''
last_confirmed: '2026-08-14'
authority_refs:
  - 'install.mjs 的命令行选项：--no-codegraph / --codegraph-location=<local|global>'
  - '安装器写入目标项目 .gitignore 标记块的条目清单'
  - '安装器调用的 codegraph 子命令：--version / upgrade --check / upgrade / install / init / index'
---

# Lean Change Spec（一页）— 安装器自动保持 codegraph 最新并给目标项目建索引

- **Issue / 链接**：N/A（对话内提出）
- **Owner**：weidwonder
- **写作进度**：Done
- **Triage 复核**：AI/LLM 行为？否 鉴权/安全/设备？borderline 跨服务/迁移/不可逆？borderline 指标/规则/对外承诺？否
  - borderline 说明：本改动会从公网向**用户全局环境**装第三方包（`npm install -g @colbymchenry/codegraph`），并改变已安装项目的行为契约（因此 bump VERSION + 出迁移指南）。两点都在本次对话里由用户逐条拍板：装法用 npm 全局、接线范围用项目级、外部工具的任何失败只降级为警告。决策点已收敛，故按 Lean 一页落地，不升级为完整 spec。

## 改什么（现状 → 期望）

现状：安装器只管两个 skill 与伴生 skill，AI 在目标项目里找代码事实仍靠 grep。
期望：安装器多做一段——保持 [codegraph](https://github.com/colbymchenry/codegraph)（本地代码知识图谱 CLI）为最新、接线到 agent、并对目标项目建立索引。

## 为什么

本体系的核心信念是"给 AI 一层可信、新鲜、权威的代码事实"。团队版有 Engineering Context（card + cite）解决**权威口径**，但"当前代码到底长什么样"仍是盲区。codegraph 用本地图谱补这一层：`explore` / `impact` / `callers` 一次给出符号源码、调用链与影响面，且随文件变更 auto-sync。装了不用等于没装，所以安装器一并完成接线与建索引。

## 具体改动点

- `install.mjs` — 新增 `CODEGRAPH` 常量、`runTool` 跨平台调用器，以及 `detectCodegraph` / `checkCodegraphUpdate` / `installCodegraphViaNpm` / `ensureCodegraphCli` / `wireCodegraphAgents` / `buildCodegraphIndex` / `syncCodegraph`；在 `main()` 的计划输出加第 6 项，在 dry-run 分支与伴生 skill 之后各调用一次 `syncCodegraph`。
- `install.mjs` `parseArgs` / `helpText` — 新增 `--no-codegraph` 与 `--codegraph-location=<local|global>`（默认 `local`）。
- `install.mjs` `gitignoreBlock` — 标记块追加 `/.codegraph/`。
- `test/codegraph.test.mjs` — 新增：用假 `codegraph` + 假 `npm`（写进临时目录并收窄 PATH）覆盖全部分支。
- `test/{install-and-doc-governance,installer-migration,companion-skill,npm-entrypoint}.test.mjs` — 既有用例统一加 `--no-codegraph`，不让测试碰跑测试这台机器的全局安装。
- `ai-dev-system/VERSION` → `1.9.0`；新增 `ai-dev-system/migrations/1.9.0.md`。

## 影响范围 / 不做什么

- 影响：安装器执行链的末段；目标项目的 `.gitignore`、`.codegraph/`、`.mcp.json` 与 `.claude/CLAUDE.md`（后两个由 codegraph 自己写）；用户全局 npm 前缀目录（新增/更新 codegraph）。
- **不做**：不改任何 skill 的方法论 markdown。团队版找权威事实仍以 card + cite 为准，codegraph 只是找现状代码的通道，本次不写进 `references/`，也不进 config-snippet。
- **不做**：不把 codegraph 的内容搬进本仓库（与 `agentic-principle` 同样的外部工具边界）。
- 关键 NFR：跨平台（`node:path` + `shell` 仅 win32 + 无 bash-only 语法）；子进程 stdin 一律 `ignore`，锁死子命令的非交互分支，安装器不可能被子进程提问挂住；装包/接线超时 15 分钟，建索引超时 60 分钟。

## 兼容取舍（用户拍板，定稿前必填）

- 安装器新增"向用户全局环境安装第三方 CLI"这一行为 —— 谁在依赖：所有跑安装器的人 —— 用户决定：接受，默认开启，用 `--no-codegraph` 可整段跳过 —— 确认于 2026-08-14。
- agent 接线范围默认项目级 —— 谁在依赖：Claude Code 与 Codex 用户 —— 用户决定：项目级；**Codex CLI 没有项目级 MCP 配置**，项目级模式下它必然被跳过，安装器必须显式提示手动全局接线命令 —— 确认于 2026-08-14。
- 目标项目 `.gitignore` 标记块新增 `/.codegraph/` —— 谁在依赖：目标仓库 —— 用户决定：无条件写入（`--no-codegraph` 也写），保证两种跑法产出同一个标记块，不来回改写 —— 确认于 2026-08-14。

## 替换清单（本次淘汰了什么）

无。本次只新增执行段与选项，未取代任何既有逻辑。

## 验收标准（可判定，含边界/失败用例）

- [x] 本机未装 codegraph → 走 `npm install -g @colbymchenry/codegraph`，随后接线并建索引。
- [x] 已装且远端更新 → 走 `codegraph upgrade`（它自己认得 bundle/npm/npx 装法），不用 npm 装第二份。
- [x] 已装且已是最新 → 跳过升级，仍接线并建索引。
- [x] 太旧、没有 `upgrade` 子命令 → 退回 `npm install -g @colbymchenry/codegraph@latest`。
- [x] 版本检测偶发失败（真机上升级刚完成时遇到过）→ 打印"远端未知（版本检测失败，下面直接尝试升级）"并盲升；`upgrade` 跑通但版本没变时报"已是最新，版本未变"，**不得**说成"已升级"。
- [x] 目标项目已有 `.codegraph/` → 不重复建索引。
- [x] `init` 只初始化没产出 `.codegraph/codegraph.db` → 补跑一次 `codegraph index`。
- [x] `--codegraph-location=global` → 接线参数透传，且不打印 Codex 项目级缺口提示。
- [x] 项目级接线成功 → 提示 Claude Code 需重启、Codex 未接线及其手动命令。
- [x] `--no-codegraph` → 不调用 codegraph/npm，`.gitignore` 仍含 `/.codegraph/`。
- [x] `--dry-run` → 只做只读检测（`--version`、`upgrade --check`），不装不接线不建索引。
- [x] 装不上（npm 失败）→ 安装器退出码仍为 0，打印手动安装命令，skill 安装产物完好。
- [x] 接线失败 → 只警告，建索引照常进行。

## 如何验证

- [x] `node --test test/` 全绿（50 项）。
- [x] `node install.mjs <临时目录> --source-dir=. --dry-run --no-agentic --no-plugins`：真机（codegraph v0.7.9，无 `upgrade` 子命令）输出"本机 v0.7.9｜远端 未知 → 将执行 codegraph upgrade"，未落盘。
- [x] **代码评审门**：三轴（规范 / 忠实 / 残留）。

## 回滚方式

`--no-codegraph` 单次跳过；彻底回退则 revert 本次提交并把 `ai-dev-system/VERSION` 退回 1.8.0。已装到用户全局的 codegraph 由用户自行 `codegraph uninstall`，安装器不代劳卸载。
