---
lifecycle: active
superseded_by: ''
archived: ''
last_confirmed: '2026-09-18'
authority_refs:
  - 'install.mjs 的 --global 选项与互斥规则'
  - 'userSkillDirs / ctxPackageDir / syncCtx / syncCodegraph 的签名'
---

# 全局安装 Coding Plan

**Goal:** 安装器支持 `--global`，把 skill 装到 `~/.claude/skills/` 与 `~/.codex/skills/`。
**Architecture:** `main` 解析参数后按 `opt.global` 分流到新函数 `installGlobal`；项目级流程不变。可共用的段（迁移提示打印、ctx 链接、codegraph）改成按"skills 目录 / 可选目标项目"取参，两条流程都调。
**Spec:** `docs/spec/2026-09-18-dw-system-全局安装-eng-spec.md`（唯一需求来源；本 plan 与它冲突时以 spec 为准并回报）
**Worktree:** `/Users/weidwonder/projects/dw-system/.worktrees/global-install` ｜ **Task Branch:** `feat/global-install` ｜ **目标主分支:** `main`

通用约束（每个任务都适用）：
- 零依赖、纯 Node ESM；跨平台（路径比较统一正斜杠，不依赖 shell 特性；外部命令一律经 `runTool` 或 `runCodex` 启动）。
- 新测试放 `test/install-global.test.mjs`，按 `test/AGENTS.md`：临时 HOME（同时设 `HOME` 与 `USERPROFILE`）、假 CLI 放进收窄的 PATH、假 CLI 的 shebang 钉 `process.execPath`、Windows 另写 `.cmd` shim（照抄 `test/ctx-link.test.mjs` / `test/codegraph.test.mjs` 的做法）。不测三段外部工具的用例 MUST 带 `--no-companions --no-codegraph --no-ctx-link`。任何测试 MUST NOT 碰真实 HOME 与真实全局安装。
- 断言"文件真的变了 / 没变"，不以退出码代替。
- 不写 spec 没要求的开关与抽象。

---

### Task 1：`--global` 主干（参数、复制、版本戳、迁移、残留、零碰项目）

**满足:** FR-001、FR-002、FR-003、FR-004、FR-007

**Files:** Modify `install.mjs`；Test `test/install-global.test.mjs`

**要点：**
1. `parseArgs` 加 `--global`（`opt.global`）。解析完后若 `opt.global`，以下任一出现即 `throw new Error(...)`（`main().catch` 打印并退出 1）：位置参数（`opt.target`）、`--shared`、`--docs-in-git=`、`--codex-conflicts=`、`--codegraph-location=local`。为此记录这几个选项是否被显式传入（`--codegraph-location=global` 允许）。报错文案写明"该选项只对项目级安装有意义"或"--global 不接受目标目录"。
2. `companionDestDirs` 改名 `userSkillDirs`，全部调用处同步；注释改为"用户级 skill 目录：伴生 skill 与全局安装共用"。
3. 把 `main` 里"迁移指南 / 版本升级无指南 / 降级告警"三段打印抽成 `printVersionNotes({ installedVersion, sourceVersion, migrations, isUpgrade, isDowngrade })`，`main` 改调它，输出逐字不变；安装后那句"别忘了执行迁移指南"同理可抽可不抽，但两条流程文案一致。
4. `legacyResidue(target, skillDestDirs, entries, gitignoreRaw)` 的 `target` 只用来算相对路径标签；全局模式传 `homedir()`、`entries=[]`、`gitignoreRaw=''`。
5. 新函数 `async function installGlobal(opt, source)`，`main` 在取源之后、解析任何项目文件之前分流：`if (opt.global) return installGlobal(opt, source);`（放进现有 `try/finally`，保证 `source.cleanup()`；并且 MUST 在 `target` 存在性检查之前分流——全局模式不看当前目录）。流程按 spec §4 伪码：
   - `dirs = userSkillDirs(homedir())`；`readInstalledVersion(dirs, skills)`；迁移区间同项目级。
   - 计划打印：两个用户级目录、每个 skill 是否已存在、冲突插件段（Task 2 填）、伴生 / ctx / codegraph 三段一句话、残留、`printVersionNotes`、固定一句"已装进项目里的副本不受影响，仍在原处"。
   - `--dry-run`：跑三段外部工具的只读预告（`syncCompanions` / `syncCtx` / `syncCodegraph` 的 dry-run 分支）后打印 `[--dry-run] 未做任何改动。` 返回。
   - 非 `--yes` 时问 `继续？[y/N]`。
   - 确认后：（Task 2 的卸载）→ `removeLegacyInstall(residue)` → 对每个 dir `copySkills` → 各写 `VERSION_STAMP` → 伴生 → ctx → codegraph → 结尾"下一步"：重启 Claude Code / Codex；到任一项目里唤起 skill 即会初始化该项目。
6. 全局流程 MUST NOT 读写当前目录下任何文件。

**测试（先写，确认红，再实现）：**
- 全新全局安装：临时 HOME + 临时 cwd（放一个 `CLAUDE.md` 与 `.gitignore` 记下字节）→ 两个用户级目录各有源里全部 skill 目录与 `dw-system.version`（内容 = 源 `dw-system/VERSION`）；cwd 字节不变、没多出文件。
- 用户级目录里预放他人 skill `foo/` 与旧名字 `ai-dev-workflow/`、`ai-dev-system.version` → `foo/` 原样，旧名字条目被删。（旧名字从 `install.mjs` 的 `LEGACY` 读，或按 `installer-legacy-upgrade.test.mjs` 的现有取法，MUST NOT 让旧名字出现在 LEGACY 表之外的新位置——先读该测试确认它的核对范围是否含 `test/`，含则按它的方式取。）
- 已有旧版本戳（如 `0.0.1`）→ 输出含迁移指南标题；`--dry-run` 同样打印且 HOME 字节不变。
- 互斥：五种组合各跑一次 → 退出码非零、stderr 含说明、HOME 下不存在 `.claude/skills`。
- `--help` 输出含 `--global`。

### Task 2：全局模式卸载冲突插件

**满足:** FR-005、FR-006 ｜ **依赖：** Task 1 的 `installGlobal`

**要点：**
1. Claude Code 侧只读列表：`runTool('claude', ['plugin', 'list', '--json'], { quiet: true })`。
   - `toolFailed` 且原因是找不到命令（`r.error?.code === 'ENOENT'`；Windows 经 shell 时找不到命令表现为非零退出且 stderr 为 shell 的"不是内部或外部命令"——不要猜文案，改为先用与 `runCodex` 相同的方式探测：win32 下 `where.exe claude`，其它平台直接 spawn 看 `ENOENT`）→ 返回 `{ available: false }`。
   - CLI 在但退出非零 / JSON 解析失败 / 不是数组 → `throw`（中止，零改动）。
   - 否则取 `id` 逐字等于 `CLAUDE_CONFLICTS[].key`（排除 `isKept`）且 `scope === 'user'` 的条目为待卸载；同 id 但 scope 不是 user 的收集为"只提示不卸载"。
2. Codex 侧复用 `findInstalledCodexConflicts` / `uninstallCodexConflicts`；把 `runCodex` 的"找不到 CLI"做成可区分（如抛出带 `code: 'ENOENT'` 的错误，或拆出 `codexAvailable()`），全局模式下找不到 → `{ available: false }`，其余失败照旧抛。`CODEX_CONFLICTS` 被 `--keep` 点名时不列。
3. `--no-plugins` → 两侧都不调用 CLI。
4. 列表在打印计划之前完成（只读）；计划里列出每侧要卸载的完整 id、CLI 缺失的一侧打印手动命令（`claude plugin uninstall <id> --scope user` / `codex plugin remove <id>`，id 取清单里的完整 key）。
5. 确认后、`removeLegacyInstall` 与复制之前卸载：Claude 侧 `claude plugin uninstall <id> --scope user`，非零退出即 `throw`（带 CLI 原文）；Codex 侧 `uninstallCodexConflicts`。
6. `--dry-run` 只列不卸。

**测试：** 假 `claude`：`plugin list --json` 输出可配置 JSON（含 `superpowers@claude-plugins-official` user、`oh-my-claudecode@omc` project、无关插件），把收到的每条命令追加写进日志文件；可配置 list 失败、uninstall 失败。假 `codex`：`plugin list --json` 输出 `{installed:[{pluginId:'superpowers@openai-curated'}]}`，同样记日志。
- 正常：日志含 `plugin uninstall superpowers@claude-plugins-official --scope user` 与 `plugin remove superpowers@openai-curated`；不含对 `oh-my-claudecode@omc` 的卸载；skill 已装。
- `--keep=superpowers`：两侧都不卸 superpowers。
- `--no-plugins`：日志为空。
- `--dry-run`：日志只有 list，无 uninstall / remove。
- PATH 里没有 `claude`：输出含手动命令，skill 照常装好。
- list 失败 / uninstall 失败：退出码非零，HOME 下无 skill 目录。

### Task 3：ctx、codegraph 的全局落点与并存提示

**满足:** FR-008、FR-009、FR-010 ｜ **依赖：** Task 1

**要点：**
1. `ctxPackageDir(skillsDir)`、`ctxFallbackHint(skillsDir)`、`printCtxPlan(skillsDir, before)`、`syncCtx(opt, skillsDir)`：入参改为 Claude Code 侧 skills 目录；项目级调用处传 `path.join(target, '.claude', 'skills')`，全局传 `userSkillDirs(home)[0]`。`main` 计划里那行 `npm link（在 .claude/skills/...）` 与 `helpText` 的对应描述同时覆盖全局。
2. `syncCodegraph(opt, target)`：全局模式调用 `syncCodegraph({ ...opt, codegraphLocation: 'global' }, null)`；`target` 为 null 时不探测 `.codegraph/`、不建索引，dry-run 预告与正式执行都打印一句"索引按项目建立：在项目根执行 codegraph init"；`wireCodegraphAgents` 的 `cwd` 为 null 时用 `homedir()`。
3. 项目级 `main` 计划末尾：`readInstalledVersion(userSkillDirs(homedir()), skills)` 读到 `stamped: true` 的版本 → 打印一行 `本机另有全局安装 v<X>（~/.claude/skills、~/.codex/skills）：同名 skill 两份并存时哪份生效由 Claude Code / Codex 决定，建议只保留一种`。只认版本戳，不认目录名。

**测试：**
- 全局 + 假 npm（照 `ctx-link.test.mjs`，把 `link` 的 cwd 记日志）→ cwd 等于 `<HOME>/.claude/skills/dw-code-facts/scripts/ctx`（比较前统一正斜杠）。
- 全局 + 假 codegraph（照 `codegraph.test.mjs`）→ 日志含 `install --target=auto --location=global --yes`，不含 `init` / `index`。
- 项目级安装、HOME 下预写 `.claude/skills/dw-system.version` → 输出含"本机另有全局安装"；不预写 → 不含。
- 现有 `ctx-link.test.mjs`、`codegraph.test.mjs` 全绿（签名改动不改项目级行为）。

---

### Checkpoint：Task 1–3 之后
- [ ] `node --test test/*.test.mjs` 全绿（记下与 main 基线相比的失败集合，只允许既有失败）
- [ ] 真跑一次：`HOME=<临时目录> USERPROFILE=<临时目录> ./install.mjs --global --source-dir=. --yes --no-companions --no-codegraph --no-ctx-link`，看输出与落盘
- [ ] 回报 plan 与源码不符之处

### Task 4：文档（Claude 自己做，需加载 skill-principle 与 dw-prose）

**满足:** FR-011、FR-012

- `README.md` 安装节加全局安装方式；仓库 `CLAUDE.md` 常用命令加一行全局命令；本仓库 `CLAUDE.md` 标记块随 `base.md` 同步。
- `dw-workflow/assets/config-snippets/base.md` 那一句改为两种落点。
- 六处 `<skills 根>` 说法补全局路径：`dw-code-facts/SKILL.md`、`dw-code-facts/references/代码事实纪律.md`、`dw-code-facts/scripts/ctx/README.md`、`dw-workflow/references/00-流程总纲.md`、`dw-prd/references/00-prd生成流程.md`、`dw-prd/references/prd复核纪律.md`。
- 跑 `doc-budgets` / `single-home` / `cross-reference` 等闸。

### Task 5：收尾（Claude）

- 卡片 `安装主干.md`、`外部工具接线.md` 补全局模式；`CHANGELOG.md` `## 未发布` 的 `新增` 写 `--global`；`docs/index.md` 登记 spec；`docs/REQUIREMENTS.md` 按现状补一句（查它现在怎么写安装）。
- 评审门 → 合并门。
