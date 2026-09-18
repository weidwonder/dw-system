---
lifecycle: active
superseded_by: ''
archived: ''
last_confirmed: '2026-09-18'
authority_refs:
  - '安装器命令行：新增 --global 及它与项目级选项的互斥规则'
  - '全局安装的落点：~/.claude/skills/ 与 ~/.codex/skills/，版本戳与迁移指南照项目级同一套'
  - '全局安装下冲突插件的处置：Claude Code 与 Codex 两侧直接卸载'
  - '全局安装下 ctx 全局链接指向用户级副本、codegraph 全局接线且不建索引'
  - '注入标记块与 skill 文档里 skill 所在位置的说法覆盖全局安装'
---

# dw-system_技术 Spec — 全局安装（装到本机用户目录）

## 0. 阅读导引

- **一句话目的**：用同一条 npx 安装命令加 `--global`，把全部 skill 装到本机的 `~/.claude/skills/` 与 `~/.codex/skills/`，本机所有项目共用一份，不必逐个项目安装。
- **端到端场景**：
  1. 开发者在任意目录执行 `npx --yes git+https://github.com/weidwonder/dw-system.git --global` → 安装器打印计划、确认后把八个 skill 复制到两个用户级目录并写版本戳 → 卸载本机已装的冲突插件 → 伴生 skill 保持最新 → `ctx` 链接到用户级副本 → codegraph 保持最新并全局接线 → 打印"到项目里唤起 skill 即可初始化"。
  2. 已全局装过旧版本，再跑一次 → 按用户级版本戳打印区间内迁移指南，覆盖升级。
  3. `--global` 又带了目标目录或项目级选项 → 报错退出，任何东西都不改。
  4. 冲突插件的 CLI 存在但读清单失败 → 在复制任何 skill 之前中止，本机零改动。
- **核心流程图**：
  ```mermaid
  flowchart TD
    A[npx ... --global] --> B{参数互斥校验}
    B -->|带目标目录或项目级选项| X[报错退出 零改动]
    B -->|通过| C[取源并校验]
    C --> D[读用户级版本戳 算迁移区间 列旧名字残留]
    D --> E[只读列出本机已装的冲突插件]
    E -->|CLI 在但读失败| X
    E --> F[打印计划 + 迁移指南]
    F -->|--dry-run| Z[外部三段只读预告后结束]
    F -->|确认| G[卸载冲突插件]
    G -->|卸载失败| X2[中止 skill 未复制]
    G --> H[删旧名字残留 → 复制 skill 到两个用户级目录 → 写版本戳]
    H --> I[伴生 skill] --> J[ctx 链接到 ~/.claude/skills 副本] --> K[codegraph 升级 + 全局接线 不建索引]
  ```
- **决策表**：

  | 输入 / 状态 | 条件 | 处置 | 结果 |
  |---|---|---|---|
  | `--global` + 位置参数（目标目录） | — | 报错，退出码非零 | 零改动 |
  | `--global` + `--shared` / `--docs-in-git=` / `--codex-conflicts=` / `--codegraph-location=local` | — | 报错并说明该选项只对项目级安装有意义 | 零改动 |
  | `--global` + `--codegraph-location=global` | — | 接受（与默认一致） | 正常安装 |
  | 冲突插件 CLI（`claude` / `codex`）不在 PATH | — | 该侧跳过卸载，打印手动卸载命令 | 其余照常 |
  | CLI 在，但读已装清单失败或输出无法解析 | — | 中止 | 零改动 |
  | 清单里有冲突插件 | 未被 `--keep` 点名、未 `--no-plugins` | 确认后卸载 | 插件从本机移除 |
  | 卸载某个插件失败 | — | 中止 | skill 未复制，已卸载的保持卸载 |
  | 项目级安装时用户级目录已有本体系版本戳 | — | 计划末尾提示两份并存 | 照常安装 |

## 1. 范围

- **做什么**：安装器新增 `--global` 模式；全局模式下的冲突插件卸载；`ctx` 链接与 codegraph 接线按全局模式取落点；项目级安装在检测到已有全局安装时提示；注入标记块与 skill 文档里"skill 装在哪"的说法覆盖全局安装；README、仓库 `CLAUDE.md` 常用命令、卡片、CHANGELOG 同步。
- **不做什么**：
  - 不改项目级安装（不带 `--global`）的任何既有行为，只追加一条并存提示。
  - 全局模式不碰任何项目：不写标记块、不写 `.gitignore`、不问 docs 入库、不建 codegraph 索引。标记块仍由 skill 首次在项目里唤起时写。
  - 不提供卸载全局安装的命令。
  - 不替 Claude Code / Codex 决定两份同名 skill 并存时谁生效，只提示。
  - 不改 Windows 入口 `install.cmd` 的形态（它把参数原样传给 `install.mjs`）。
- **既有系统清单**：

| 既有模块 / 机制 | 出处 | 本次怎么碰到 | 卡片 |
|---|---|---|---|
| 取源与目标零改动保证 | `install.mjs#acquireSource`、`install.mjs#discoverSkills` [cite: cards/dw-system/安装主干.md @2026-09-17] | 全局模式复用 | 已有，补全局一行 |
| 复制与版本戳 | `install.mjs#copySkills`、`install.mjs#VERSION_STAMP` | 目标换成用户级目录 | 同上 |
| 已装版本判定、迁移指南 | `install.mjs#readInstalledVersion`、`install.mjs#collectMigrations` | 读用户级版本戳；迁移打印抽成两模式共用 | 同上 |
| 旧名字残留 | `install.mjs#legacyResidue`、`install.mjs#removeLegacyInstall` | 全局模式只查两个用户级 skill 目录 | `标记块与旧版迁移.md` 已有 |
| 冲突插件清单 | `install.mjs#CLAUDE_CONFLICTS`、`install.mjs#CODEX_CONFLICTS` | 全局模式按清单卸载 | `安装主干.md` 已有，补全局一行 |
| Codex 全局卸载 | `install.mjs#findInstalledCodexConflicts`、`install.mjs#uninstallCodexConflicts`、`install.mjs#runCodex` | 全局模式复用；CLI 缺失改为可区分 | 同上 |
| 伴生 skill 用户级目录 | `install.mjs#companionDestDirs` [cite: cards/dw-system/外部工具接线.md @2026-09-17] | 与全局安装同一对目录，改名共用 | `外部工具接线.md` 已有 |
| ctx 全局链接 | `install.mjs#syncCtx`、`install.mjs#ctxPackageDir`、`install.mjs#ctxFallbackHint` | 落点由"目标项目"改为"skill 所在目录" | 同上，补一行 |
| codegraph | `install.mjs#syncCodegraph`、`install.mjs#wireCodegraphAgents`、`install.mjs#buildCodegraphIndex` | 全局模式强制 global 接线、跳过建索引 | 同上，补一行 |
| 注入标记块正文 | `dw-system/skills/dw-workflow/assets/config-snippets/base.md#dw-workflow:start` | 改"skill 在哪"一句 | `skill文档.md` 不涉及 |
| `<skills 根>` 的说法 | `dw-code-facts/SKILL.md`、`代码事实纪律.md`、`ctx/README.md`、`00-流程总纲.md`、`00-prd生成流程.md`、`prd复核纪律.md` | 补全局路径 | — |

### 1.1 功能需求

| 编号 | 需求 |
|---|---|
| FR-001 | `--global` 把源里的全部 skill 复制到 `~/.claude/skills/` 与 `~/.codex/skills/`，两处各写版本戳；目录不存在时创建 |
| FR-002 | `--global` 与位置参数、`--shared`、`--docs-in-git=`、`--codex-conflicts=`、`--codegraph-location=local` 互斥：命中即报错、退出码非零、零改动 |
| FR-003 | 全局模式按用户级版本戳判定升级 / 降级，打印迁移指南，口径与项目级相同；`--dry-run` 同样打印 |
| FR-004 | 全局模式清理两个用户级 skill 目录里旧名字的 skill 目录与旧版本戳，规则与项目级相同（只删逐字等于登记项的条目） |
| FR-005 | 全局模式卸载本机已装的冲突插件：Claude Code 侧为 `CLAUDE_CONFLICTS` 全部条目中以用户级范围安装的，Codex 侧为 `CODEX_CONFLICTS`；`--keep=` 点名保留、`--no-plugins` 整段跳过；先只读列出，确认后、复制 skill 前卸载 |
| FR-006 | FR-005 的失败语义：CLI 不在 PATH → 该侧跳过并打印手动命令；读清单失败或卸载失败 → 中止，skill 不复制 |
| FR-007 | 全局模式不写任何项目文件：当前目录的 `CLAUDE.md` / `AGENTS.md` / `.gitignore` / `.claude/settings*.json` 字节不变 |
| FR-008 | 全局模式把 `~/.claude/skills/dw-code-facts/scripts/ctx` 链接成全局 `ctx`，判据、失败降级与 EEXIST 处置与项目级相同；兜底调用提示指向该副本 |
| FR-009 | 全局模式保持 codegraph 最新，用 `--location=global` 接线，不建索引，并打印"到项目里建索引"的命令 |
| FR-010 | 项目级安装时，用户级目录已有本体系版本戳 → 计划里提示"本机另有全局安装 vX，两份同名 skill 并存时哪份生效由 Claude Code / Codex 决定"；全局安装的计划里固定提示"已装进项目的副本仍在" |
| FR-011 | `--help`、README、仓库 `CLAUDE.md` 常用命令写出全局安装的用法 |
| FR-012 | 注入标记块与 skill 文档中说明 skill 位置的句子同时覆盖项目级与全局两种落点 |

## 2. 数据模型

无新数据。版本戳文件名沿用 `dw-system.version`，全局安装写在两个用户级 skill 目录下。

## 3. 接口契约

| 接口 | 形态 | 调用方 |
|---|---|---|
| `install.mjs --global [选项]` | 可与 `--yes`、`--dry-run`、`--keep=`、`--no-plugins`、`--repo=`、`--ref=`、`--source-dir=`、`--no-companions`、`--companion-repo=`、`--no-ctx-link`、`--no-codegraph`、`--codegraph-location=global` 组合 | 使用者、npx |
| 外部：`claude plugin list --json` | 读 JSON 数组，每项取 `id`、`scope` | 全局模式列冲突插件 |
| 外部：`claude plugin uninstall <id> --scope user` | 退出码 0 为成功 | 全局模式卸载 |
| 外部：`codex plugin list --json` / `codex plugin remove <id>` | 沿用现有解析 | 全局模式卸载 |
| 外部：`codegraph install --target=auto --location=global --yes` | 沿用 | 全局模式接线 |

本集成对 Claude Code / Codex 只做"列出"与"卸载"两种操作，不启用、不安装任何插件。

## 4. 核心逻辑

`main` 解析参数后按 `opt.global` 分流到全局流程；项目级流程不变。两条流程共用：取源、已装版本判定、迁移指南打印（从 `main` 抽出为共用函数）、残留清理、复制与写戳、伴生 skill、`ctx` 链接、codegraph。

```
installGlobal(opt, source):
  dirs = userSkillDirs(home)                       # [~/.claude/skills, ~/.codex/skills]
  installed = readInstalledVersion(dirs, skills)
  migrations = 同项目级
  residue = legacyResidue(只看 dirs 下的旧 skill 目录与旧戳)
  conflicts = opt.noPlugins ? 空 : listInstalledConflicts(keep)   # 只读；CLI 在但失败 → 抛错
  打印计划（含迁移指南、残留、要卸载的插件、并存提示）
  if dryRun: 外部三段只读预告; return
  if !yes: 确认
  uninstallConflicts(conflicts)                    # 失败 → 抛错，skill 未复制
  removeLegacyInstall(residue)
  for d in dirs: mkdir -p d; copySkills(d); 写戳
  syncCompanions; syncCtx(dirs[0]); syncCodegraph(global, 无目标项目)
```

- `companionDestDirs` 改名为 `userSkillDirs`，伴生 skill 与全局安装共用这一对目录。
- `ctxPackageDir` / `ctxFallbackHint` / `syncCtx` 的入参由"目标项目目录"改为"Claude Code 侧 skills 目录"；项目级传 `<目标>/.claude/skills`，全局传 `~/.claude/skills`。
- `syncCodegraph` 在全局模式下跳过建索引，接线范围取 `global`。
- Claude Code 侧冲突判定只认 `CLAUDE_CONFLICTS` 的完整 `key` 与 `claude plugin list --json` 的 `id` 逐字相等，且 `scope === 'user'`；其它范围的安装不属于"本机全局"，打印出来不卸载。
- `runCodex` 找不到 CLI 时的失败要能与"CLI 在但执行失败"区分开，供 FR-006 分支使用。

## 5. 错误处理

| 失败 | 处置 | 结果 |
|---|---|---|
| 参数互斥 | 抛错，退出码 1 | 零改动 |
| 取源失败 | 沿用项目级语义 | 零改动 |
| 冲突插件 CLI 缺失 | 警告 + 手动命令 | 其余照常 |
| 列清单失败 | 抛错 | 零改动 |
| 卸载失败 | 抛错 | skill 未复制；已卸载的不回装 |
| 伴生 / ctx / codegraph 失败 | 沿用：只降级为警告 | skill 已装好 |

## 6. 不变量

```
Invariant 1: 全局模式不写当前目录下的任何文件。
- 强制机制：全局流程不持有目标项目路径；测试断言当前目录字节不变。
- 违反时：测试判红。
Invariant 2: 所有可能中止的步骤（参数校验、取源、列清单、卸载）发生在复制任何 skill 之前。
- 强制机制：流程顺序；测试注入列清单失败与卸载失败，断言用户级目录无 skill。
- 违反时：测试判红。
Invariant 3: 只删两个用户级 skill 目录里名字逐字等于本体系 skill 或 LEGACY 登记项的条目。
- 强制机制：复用 copySkills / removeLegacyInstall；测试放一个同目录的他人 skill 断言原样保留。
- 违反时：测试判红。
```

## 7. 可观测性

安装器输出即全部可观测面：计划段列出两个用户级目录、要卸载的插件、迁移指南；结果段逐项 `✓` / `⚠`。

## 8. 兼容性 / 迁移

### 8.1 兼容取舍决策

| 被改变的既有行为 | 谁在依赖它 | 用户决定 | 到期日 | 到期动作 | 确认时间 |
|---|---|---|---|---|---|
| 注入标记块里"skill 在 `.claude/skills/<名>/`（Codex 在 `.agents/skills/<名>/`）"一句改为同时说明全局落点；已装项目重跑安装器时这一句随之改写 | 读标记块的 agent | 不兼容 | — | — | 2026-09-18 |

除上表外，项目级安装的既有可观察行为不变（新增的并存提示是纯追加输出）。

### 8.2 替换清单

| 被取代物 | 类型 | 取代者 | 处置 | 保留理由 + 到期日 |
|---|---|---|---|---|
| `install.mjs#companionDestDirs` | 函数 | `userSkillDirs` | 改名，调用处全换 | — |
| `main` 内联的迁移指南 / 升降级提示打印 | 代码段 | 两模式共用的打印函数 | 删除内联段 | — |
| `ctxPackageDir(target)` / `ctxFallbackHint(target)` / `syncCtx(opt, target)` 以目标项目为入参 | 函数签名 | 以 Claude Code 侧 skills 目录为入参 | 改签名，调用处全换 | — |

### 8.3 数据迁移

无。不需要迁移指南：项目级使用者无需任何动作。

## 11. 完成定义

| 编号 | 验收项 | 满足 |
|---|---|---|
| AC-001 | 临时 HOME 下 `--global --source-dir=.`：两个用户级目录各有全部 skill 与版本戳；当前目录字节不变 | FR-001、FR-007 |
| AC-002 | 五种互斥组合各自报错、退出码非零、HOME 与当前目录零改动 | FR-002 |
| AC-003 | 用户级已有旧版本戳 → 打印区间内迁移指南；`--dry-run` 同样打印且零改动 | FR-003 |
| AC-004 | 用户级目录里放旧名字 skill 与他人 skill → 前者被删、后者原样 | FR-004 |
| AC-005 | 假 `claude` / `codex` 列出冲突插件 → 按完整 id 卸载；`--keep=superpowers` 不卸载该插件；非 user 范围的不卸载；`--no-plugins` 不调用 CLI；`--dry-run` 只列不卸 | FR-005 |
| AC-006 | CLI 缺失 → 警告并照常装完；列清单失败 / 卸载失败 → 退出码非零且用户级目录无 skill | FR-006 |
| AC-007 | 假 npm 记录 `link` 的运行目录 = `~/.claude/skills/dw-code-facts/scripts/ctx` | FR-008 |
| AC-008 | 假 codegraph 收到 `--location=global`，未收到 `init` / `index` | FR-009 |
| AC-009 | 项目级安装、HOME 下已有全局版本戳 → 输出含并存提示；没有则不含 | FR-010 |
| AC-010 | `--help` 含 `--global`；README 与 `CLAUDE.md` 有全局安装命令 | FR-011 |
| AC-011 | 标记块片段与六处 skill 文档写出两种落点；`node --test test/*.test.mjs` 全绿 | FR-012 |
| AC-012 | §8.1 已拍板；§8.2 逐条核销 | — |
| AC-013 | 代码评审门逐轴通过，P0/P1 清零 | — |
| AC-014 | 卡片 `安装主干.md`、`外部工具接线.md` 已补全局模式；CHANGELOG `新增` 已写 | — |

覆盖：FR-001→AC-001；FR-002→AC-002；FR-003→AC-003；FR-004→AC-004；FR-005→AC-005；FR-006→AC-006；FR-007→AC-001；FR-008→AC-007；FR-009→AC-008；FR-010→AC-009；FR-011→AC-010；FR-012→AC-011。

## 12. 待澄清点

无。Claude Code 侧四个冲突插件全部纳入全局卸载，已在过稿时确认。

## 13. 过稿记录

- 2026-09-18｜已定稿｜兼容取舍拍"不兼容"；过稿时一并确认 Claude Code 侧四个冲突插件全局模式下都卸载，无其他意见
