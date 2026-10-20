# 仓库地图卡 — dw-system

## 职责
本仓库是 AI 辅助开发方法论的分发包：一组 skill 文档、随 skill 分发的两个零依赖 CLI（`ctx` 与 `preview.mjs`）、以及把它们装进目标项目的安装器 `install.mjs`；它不是应用，没有运行时服务。

## 业务域地图

划分维度：按交付物切，与 `docs/REQUIREMENTS.md`〈现在有哪些功能〉的小节一一对应。安装器一个小节对应三个域——它的事实量最大，按"装 skill 本身 / 维护入口文件里的标记块 / 接外部工具"三段职责再分。

| 业务域 | 一句话 | 对应的需求小节 | 域卡 |
|---|---|---|---|
| 安装主干 | 取源、复制与版本戳、迁移指南、`.gitignore` 块与 docs 入库决定、冲突插件处置、入口软链接 | 安装器：`install.mjs` | `cards/dw-system/安装主干.md` |
| 标记块与旧版迁移 | 入口文件里标记块的字段模型、组装与两入口收敛；更名前旧安装的残留清理 | 安装器：`install.mjs` | `cards/dw-system/标记块与旧版迁移.md` |
| 外部工具接线 | 主安装之后的三段：伴生 skill、`ctx` 全局链接、codegraph | 安装器：`install.mjs` | `cards/dw-system/外部工具接线.md` |
| ctx命令行 | 代码事实层的查询 CLI：三类卡与 registry 的解析、discover / get-card、语义兜底 | 必备的代码事实层、`ctx` 命令族 | `cards/dw-system/ctx命令行.md` |
| ctx体检与门禁 | `lint-cards` 的体检规则与基线、`probe` 的题型与判级 | 必备的代码事实层、`ctx` 命令族 | `cards/dw-system/ctx体检与门禁.md` |
| 原型工具 | `preview.mjs` 八条子命令与 `ui-prototype-framework/` 框架源码 | 产 PRD：`dw-prd` | `cards/dw-system/原型工具.md` |
| skill文档 | 各份 skill 文档里哪一处是某条判据的家、哪些机器闸守着复述处 | 从 PRD 到代码、文档治理与三层真相源 | `cards/dw-system/skill文档.md` |

> skill 文档的判据本身不进卡片：它们的家就是 skill 文档。`skill文档` 域卡只记"哪份文件权威、别处只许指过去"。

## 跨域陷阱

> 只放跨两个域以上的；每行先写会出事的做法，再写后果与正确做法。

- 只改 `dw-system/skills/` 下的文件、不改 `dw-system/VERSION` 也不推同名 tag 就当作已发布 — 使用者默认装到的仍是旧内容：安装器按 `install.mjs#DEFAULT_REF` 取 `v<VERSION>` 这个 tag。随 skill 分发的 `ctx` 与 `preview.mjs` 同受这条约束。
- 单独改 `ctx --help` 的首行 — 安装器会把自己的 `ctx` 判成"别人的同名命令"：`install.mjs#detectCtx` 靠 `CTX.signature`（`Engineering Context CLI`）匹配 `dw-system/skills/dw-code-facts/scripts/ctx/src/cli.js#HELP` 的首行，两处 MUST 同改。
- 改动 `ctx` 的 `package.json` 里的 `name` 或 `bin` 字段 — `npm link` 只靠这两个字段生成全局命令（`dw-system/skills/dw-code-facts/scripts/ctx/package.json#bin`），改了安装器的链接段就失效。同一文件的 `version` 不是 `ctx` 的版本号，`ctx` 的版本就是分发包版本。
- 只在容器里改图钉的 `z-index`、不同改别处 — 原型自定义样式的 z-index 上限是 880，取自 `dw-system/skills/dw-prd/assets/templates/ui-prototype-framework/anno.css#.anno-pin`；这个数同时写在 `UI原型纪律.md` §8.4、`docs/REQUIREMENTS.md` 与本卡，`test/prototype-annotations.test.mjs#zIndexOf` 按容器实际取值逐处比对，本卡漏写或写岔都判红。
- 指望装进目标项目的副本里有测试可跑 — 机器闸与 fixtures 只住在仓库根 `test/`，不随 skill 分发；改了 `ctx`、`preview.mjs`、框架源码或 skill 文档，MUST 在本仓库根跑 `node --test test/*.test.mjs`。

## 确认
2026-10-20｜原型工具行：`dw-system/skills/dw-prd/scripts/preview.mjs#HELP` 子命令表
2026-09-22｜来源：`install.mjs` 全文的顶层常量与函数表、`dw-system/skills/dw-code-facts/scripts/ctx/`（`src/*.js`、`package.json`、`README.md`）、`dw-system/skills/dw-prd/scripts/preview.mjs` 与 `ui-prototype-framework/`、`docs/REQUIREMENTS.md`〈现在有哪些功能〉
