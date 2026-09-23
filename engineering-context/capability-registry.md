# Capability Registry — 产品能力到权威代码实体的映射

> 精简骨架；完整字段说明与填写指南见 dw-code-facts skill 的 assets/context-layer/capability-registry.md。
> 代码事实层（"信哪个"）的核心资产，**每个装了本体系的项目都维护它**。人工确认。
> 事实以源码为准，PRD 仅作 scope + 业务语境。每条带 freshness 与理由链。
> 只剩【】占位行是**正常起步态**：内容按任务渐进补齐（见 references/代码事实纪律.md §4），
> MUST NOT 因为表是空的就告警、或退回裸 grep 找权威实现。
> 下面两张表**填哪张都算，解析器会合并**（表头首列命中 Capability/能力的表全部解析）：
> 三列是 MUST，十列表里的其余列是 MAY——缺列跳过不报错，没有 freshness 列的条目输出标注「未声明新鲜度」。

## 最小合法 schema（起步用这个）

| Capability | 权威实现 | 陷阱项（废弃或中间产物） |
|---|---|---|
| 【能力，如 背单词记录】 | 【现在该改/该调的那一个，如 POST /v2/word/record 或 src/word/record.ts】 | 【相似但不该用的旧实现，如 POST /v1/word/record；确实没有就写 无】 |

## 能力表（完整形态）

| Capability | 业务含义 | 权威仓库 | 权威接口(含版本) | 废弃/中间产物替代 | 兼容窗口 | owner | 测试入口 | freshness(最近确认) | 理由链 |
|---|---|---|---|---|---|---|---|---|---|
| 【能力】 | 【含义】 | 【repo】 | 【POST /v2/xxx】 | 【旧接口不可用】 | 【切点】 | 【owner】 | 【测试入口】 | 【YYYY-MM-DD / PR】 | 【诞生压力】 |
| 安装 skill 到目标项目 | 取源、复制与版本戳、迁移指南、`.gitignore` 块与 docs 入库决定、冲突插件处置、入口软链接 | dw-system | `install.mjs`（`acquireSource` → `copySkills`）；展开见 `cards/dw-system/安装主干.md` | 显式 --ref 取不到时回退到 main（不可用：点名的版本被悄悄换掉）；其余见 cards/dw-system/安装主干.md | — | 本人 | `test/install-and-doc-governance.test.mjs` | 2026-09-17 | 下载或校验失败不得留下半装的目标项目 |
| 标记块字段与旧版迁移 | 入口文件里 `dw-workflow` 标记块的字段模型、组装、两入口收敛；更名前旧安装的残留清理 | dw-system | `install.mjs`（`buildWorkflowBlock`、`LEGACY`）；展开见 `cards/dw-system/标记块与旧版迁移.md` | 旧字段 `mode`、旧 skill 名 `ai-dev-workflow` / `ai-prd`（已废弃，旧名字只许留在安装器的旧名字登记表里）；其余见 cards/dw-system/标记块与旧版迁移.md | — | 本人 | `test/workflow-block.test.mjs` | 2026-09-17 | 配置入库而 skill 不入库，两者会各走各的 |
| 伴生 skill、ctx 链接与 codegraph 接线 | 主安装之后的三段外部工具接线，任何失败只降级为警告 | dw-system | `install.mjs`（`syncCompanions` / `syncCtx` / `syncCodegraph`）；展开见 `cards/dw-system/外部工具接线.md` | `--agentic-repo`（已移除、不留别名）；其余见 cards/dw-system/外部工具接线.md | — | 本人 | `test/companion-skill.test.mjs` | 2026-09-17 | 命令找不到会被 agent 读成这一层不可用 |
| 代码事实查询与卡片体检 | `ctx` 命令族：discover / get-card / find-scenes / list-services / search-semantic / lint-cards / probe | dw-system | `dw-system/skills/dw-code-facts/scripts/ctx/src/cli.js`；查询命令展开见 `cards/dw-system/ctx命令行.md`，体检与门禁见 `cards/dw-system/ctx体检与门禁.md` | 重写已有的 lint 基线文件让体检转绿（不可用：基线只许变短）；其余见 cards/dw-system/ctx体检与门禁.md | — | 本人 | `test/ctx-cli.test.mjs` | 2026-09-17 | 同一能力多处实现时要有一处说清信哪个 |
| 原型容器与批注框架 | 原型的唯一容器：分区标记 + 六个固定实现区的框架源码，`init` 时装配回单文件 | dw-system | `dw-system/skills/dw-prd/assets/templates/ui-prototype-framework/`（装配表在 `preview.mjs` 的 `FRAMEWORK`）；展开见 `cards/dw-system/原型工具.md` | 往容器 ui-prototype.html 的固定区里写正文（不可用：装配后同一段内容出现两次）；其余见 cards/dw-system/原型工具.md | — | 本人 | `test/prototype-framework.test.mjs` | 2026-09-17 | 容器里放示例会锚定产出 |
| 原型产出与改稿工具 | init / screen / slot / extract / annotations / check / serve 七条子命令 | dw-system | `dw-system/skills/dw-prd/scripts/preview.mjs`；展开见 `cards/dw-system/原型工具.md` | 手工编辑原型文件（不可用：会抹掉批注锚点）；`--drop-anchors`、`--anno-right`（已废弃）；其余见 cards/dw-system/原型工具.md | — | 本人 | `test/prototype-preview.test.mjs` | 2026-09-17 | 手工改稿会让用户批注失联 |
| 文档命名与生命周期 | 产出文档的目录、命名、lifecycle / authority_refs 与索引门控 | dw-system | `dw-system/skills/dw-doc-governance/references/文档治理.md` §默认命名、`文档生命周期.md`；指针见 `cards/dw-system/skill文档.md` | 字段名 `status`（不可用：已被写作进度占用）；旧目录 `dw-workflow/references/core/`（已移除） | — | 本人 | `test/doc-index.test.mjs` | 2026-09-17 | 索引与真相源要可机检 |
| 原型纪律（结构/自检/批注/写回） | 原型的产出、结构、自检、批注框架、写回路径与风格归属的权威判据 | dw-system | `dw-system/skills/dw-prd/references/UI原型纪律.md`；指针见 `cards/dw-system/skill文档.md` | 无 | — | 本人 | `test/prototype-annotations.test.mjs` | 2026-09-17 | 结构知识靠记必漏，收进 check |
| 流程门禁契约 | 完整流程与 Lean 共用的贯穿门与条件门：每道门插在哪、判据在哪一份文件 | dw-system | `dw-system/skills/dw-workflow/references/00-流程总纲.md` §五道门；各门判据的家见 `cards/dw-system/skill文档.md` | 计数词 `四道门`、`四轴`（已废弃；迁移历史指南里的旧表述是记账） | — | 本人 | `test/gate-sync.test.mjs` | 2026-09-17 | 门的复述散在多份文件，漏改一处不报错 |
