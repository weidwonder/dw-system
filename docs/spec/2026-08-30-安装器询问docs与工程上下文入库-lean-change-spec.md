---
lifecycle: active
superseded_by: ''
archived: ''
last_confirmed: '2026-08-30'
authority_refs:
  - '安装器在交互安装时问一次 docs/ 与 engineering-context/ 是否提交进 git'
  - '决定以 # ai-dev-system:project-docs-in-git=yes|no 记在 .gitignore 标记块内，重装沿用不再问'
  - '交互默认（回车）与非交互（--yes、--dry-run、非 TTY）取同一个默认值 no'
  - '不发问路径：已有记号 / 非交互 / 显式 --docs-in-git；块外已有使用者自己的忽略规则时既不问也不接管'
---

# Lean Change Spec（一页）— 安装器询问 docs/ 与 engineering-context/ 是否入库

- **Issue / 链接**：N/A（用户在本次对话直接提出）
- **Owner**：weidwonder
- **写作进度**：Done
- **Triage 复核**：AI/LLM 行为？否 鉴权/安全/设备？否 跨服务/迁移/不可逆？否 指标/规则/对外承诺？borderline
  - borderline 说明：安装器交互流程多一问、`.gitignore` 标记块多一行记号，属对外行为契约的增量。影响面只有 `install.mjs` 一段与两个 README 的职责清单，判据清晰，故按 Lean 一页落地。

## 改什么（现状 → 期望）

现状：安装器只把已安装的 skill 目录、版本 stamp 与 `.codegraph/` 写进 `.gitignore` 标记块。`docs/`（流程产出的 spec / plan / report）与 `engineering-context/`（代码事实层）一律随目标仓库提交，使用者不想入库时得自己动手，且每次重装都要自己重新确认那几行还在不在。

期望：交互安装时问一次这两个目录要不要提交进 git，选"不提交"就把它们一并写进同一个标记块；答案记在块内，重装直接沿用、不再发问。

**本次功能需求**：

- FR-001 — 交互安装（TTY、未传 `--yes` / `--dry-run`）时，安装器在打印改动计划**之前**问一次 `docs/` 与 `engineering-context/` 要不要提交进 git，**默认取值（直接回车）为"不提交"**。
- FR-002 — 答"不提交"时，`/docs/` 与 `/engineering-context/` MUST 写进既有的 `# ai-dev-system:gitignore:start/end` 标记块【内】；答"提交"时 MUST NOT 写入任何忽略规则。
- FR-003 — 两种答案都 MUST 以 `# ai-dev-system:project-docs-in-git=yes|no` 记在块内；下次安装读到该记号即沿用，MUST NOT 再问。
- FR-004 — `--yes` / `--dry-run` / 非 TTY MUST 取与回车相同的默认值 `no` 一次落定并记进块内：交互与自动化 MUST NOT 各用一个默认值。
- FR-006 — `.gitignore` 标记块**外**已有使用者自己写的这两个目录的忽略规则时，MUST NOT 发问，也 MUST NOT 把这些规则接管进标记块（否则同一条规则在文件里出现两份）；此时块内不写记号。
- FR-005 — `--docs-in-git` 只接受 `yes` / `no`，其余取值硬失败（非零退出码），MUST NOT 静默按默认值继续。

## 为什么

这两个目录是**目标项目自己的产物**，不像 skill 目录那样有唯一答案：多人协作时代码事实层入库才能共享，个人仓库或不希望流程文档进版本库时又必须能一键忽略。安装器已经在维护那个标记块，顺手承接这个决定的成本几乎为零；而没有它，使用者每次重装都要手工核对自己加的那两行有没有被幂等改写吃掉。

记号行 `project-docs-in-git=` 是必需的：只看"块里有没有忽略规则"分不开"上次选了提交"与"从来没问过"，于是每次重装都会再问一遍——那正是本次要消除的噪音。

## 具体改动点

- `install.mjs` — 新增常量 `PROJECT_DOCS_DIRS` / `PROJECT_DOCS_MARK`；`gitignoreBlock(skills, projectDocsInGit)` 按决定追加记号与忽略行；新增 `readProjectDocsDecision`（只认块内记号）、`projectDocsIgnoredOutsideBlock`（块外已有规则的识别）、`chooseProjectDocsInGit`（四条不发问路径 + 交互提问）。
- `install.mjs` `parseArgs` / `helpText` / 文件头注释 — 新增 `--docs-in-git=<yes|no>` 与对应说明。
- `install.mjs` `main` — 在打印计划前读 `.gitignore` 并求出决定，计划第 4) 行按四种情形分别说明，落盘处复用同一份决定。
- `test/install-and-doc-governance.test.mjs` — 新增 2 个用例，覆盖 FR-001..FR-005 与 `git check-ignore` 实证。
- `CLAUDE.md` §安装器的关键设计、`README.md` / `README_zh.md` 的安装器职责清单（新增第 4 条，其后编号顺延）与常用参数行。
- `ai-dev-system/VERSION` → 2.13.0，并新增 `ai-dev-system/migrations/2.13.0.md`——**本次升级需要用户动作**：这两个目录原本随仓库提交，升级后重装一次就会被忽略，想继续入库的项目必须显式选 `y` 或传 `--docs-in-git=yes`。

## 影响范围 / 不做什么

- 影响：`install.mjs` 的 `.gitignore` 一段与交互流程；目标项目 `.gitignore` 标记块的内容（仅在用户拍板后）。
- **不做**：不改标记块的起止标记与既有各行，不动 `.claude/skills` / `.agents/skills` / 版本 stamp / `.codegraph/` 那几条。
- **不做**：不把决定写进 `CLAUDE.md` / `AGENTS.md` 的 workflow 标记块——那块是 skill 的路由字段，`.gitignore` 的事归 `.gitignore`。
- **不做**：不接管使用者自己写的忽略规则，也不清理、不去重。
- 关键 NFR：跨平台——只用 `node:path` 与既有的 `readTextIfExists` / `mergeMarkedBlock`，无 shell 依赖；`.gitignore` 逐行比较兼容 CRLF。
- 既有系统清单：`install.mjs` 的 `GITIGNORE_START/END`、`gitignoreBlock`、`mergeMarkedBlock`、`getMarkedBlock`、`ask`、`chooseCodexConflictMode`（同类交互的既有范式）。
- 本次补的卡片：无需新补——本仓库是 skill 分发包，`install.mjs` 的口径由 `CLAUDE.md` §安装器的关键设计承载。

## 兼容取舍（用户拍板，定稿前必填）

- 交互安装多一问、`.gitignore` 标记块多一行记号 —— 谁在依赖：所有跑本安装器的人 —— 用户决定：**加这一问**（本次需求本身） —— 确认于 2026-08-30。
- 提问的默认取值（直接回车）—— 用户决定：**不提交**（回车即把两个目录写进标记块） —— 确认于 2026-08-30。
- `--yes` / `--dry-run` / 非 TTY 的取值 —— 谁在依赖：所有 CI 与 npx 自动安装 —— 用户决定：**取与回车相同的默认值 `no` 一次落定**，不做"非交互就什么都不改"的特例 —— 确认于 2026-08-30。副作用已知并接受：升级后跑过一次自动安装的项目，`docs/` 与 `engineering-context/` 的**新增**文件不再被 git 加入（已跟踪的文件不受 `.gitignore` 影响），要恢复入库传 `--docs-in-git=yes` 重跑一次。

## 替换清单（本次淘汰了什么）

| 被取代物 | 类型 | 取代者 | 处置 | 保留理由 + 到期日 |
|---|---|---|---|---|
| `gitignoreBlock(skills)` 单参数形态 | 函数签名 | `gitignoreBlock(skills, projectDocsInGit)` | 删除 | — |
| main 中在落盘处才读 `.gitignore` 的写法 | 局部变量位置 | 提前到计划打印前读一次，两处复用 | 删除 | — |
| 「非交互就什么都不改」的中间方案 | 行为分支 | 非交互取与回车相同的默认值 `no` | 删除 | — |

## 验收标准（可判定，含边界/失败用例）

- [x] AC-001 交互安装（TTY）答 `n` → 块内出现 `project-docs-in-git=no` 与 `/docs/`、`/engineering-context/`，`git check-ignore` 对两个目录下的文件命中 —— 满足：FR-001 FR-002 FR-003
- [x] AC-002 同一目标第二次交互安装 → 完全不出现该提问，忽略规则原样保留 —— 满足：FR-003
- [x] AC-003 `--docs-in-git=yes` → 块内只有记号行，无任何忽略规则 —— 满足：FR-002 FR-003
- [x] AC-004 `--yes` 且未传 `--docs-in-git` → 块内出现 `project-docs-in-git=no` 与两条忽略规则（与回车同值） —— 满足：FR-004
- [x] AC-005 `.gitignore` 块外已有 `docs/` / `engineering-context/` → 打印"不发问，也不接管这些规则"，块内不出现记号，也不搬运那些规则 —— 满足：FR-006
- [x] AC-006 `--docs-in-git=maybe` → 非零退出码并报 `--docs-in-git 只能是 yes 或 no` —— 满足：FR-005

## 如何验证

- [x] `node --test test/install-and-doc-governance.test.mjs` 全绿（23 项，其中本次新增 2 项）。
- [x] `node --test test/*.test.mjs` 全绿（390 项）。
- [x] 变异验证（三次，各判红一项、还原后复绿）：①`gitignoreBlock` 里去掉 `no` 分支的忽略行；②`readProjectDocsDecision` 恒返回 null（不沿用旧决定）；③非交互路径改成 `'yes'`（与回车默认值不一致）。证明新用例真的在测新逻辑。
- [x] 真跑（伪终端 `script -q`，真安装到临时目录）：首次发问、答 `n` 后规则落盘、第二次安装该提问出现 0 次；`git check-ignore -v` 逐条指向标记块内的行号。
- [x] **代码评审门**：见下节。

## 回滚方式

`git revert` 本次提交即可：改动集中在 `install.mjs` 的 `.gitignore` 一段与其测试、两个 README 与 CLAUDE.md 的说明，以及 `ai-dev-system/VERSION`。已安装项目侧的产物是 `.gitignore` 里的一行注释与最多两行忽略规则，手工删除即可复原。
