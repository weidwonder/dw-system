---
lifecycle: merged
superseded_by: ''
archived: '2026-10-28'
last_confirmed: '2026-10-28'
authority_refs:
  - '仓库根 README.md / README_zh.md：对外介绍、上手路径与安装命令'
  - '仓库根 INSTALL.md / INSTALL_zh.md：安装器对目标项目做了什么、冲突插件、撤销方式'
  - '仓库根 LICENSE 与 package.json 的 license 字段：本仓库的使用许可'
---

> **已归档（2026-10-28）｜lifecycle: merged**：本文口径已归并至 `docs/REQUIREMENTS.md`（许可证与面向使用者文档的位置）以及仓库根 `README.md` / `INSTALL.md` 本身。与现行文档冲突时**以现行为准**，MUST NOT 据本文实施。

# 变更 PRD — README 重排、安装细则独立成篇、以 MIT 许可证发布

- **Owner**：weidwonder
- **写作进度**：Done
- **Triage 复核**：AI/LLM 行为？否。鉴权/安全/设备？否。跨服务/迁移/不可逆？**是**——以 MIT 许可证发布后，已被别人取得的副本不能收回授权。指标/规则/对外承诺？**是**——许可证是对外的法律承诺。两问为是，走完整流程。
- **流程形态**：改动范围是 markdown、一份许可证文本与 `package.json` 的一个元数据字段，不含可执行代码，按 `dw-workflow` 的 `纯skill改动.md` §纯 skill 改动的流程形态，PRD 即 spec，跳过 Overview、技术 spec 与 coding plan。本页同时充当改动清单，记录兼容取舍与过稿结论。

## 背景：现在的 README 有什么问题

仓库根 `README.md`（英文）与 `README_zh.md`（中文）各 194 行，内容一致。对照源码审计后有三类问题：

1. **有几处说法与源码不符**：
   - README 说首次唤起时"只问一个问题（是否有人一起开发）"，没提合并方式。实际上初始化除了问这一个问题，还在同一批里给出改动怎么合并回主分支的建议（本地直接合并，还是推 PR 由平台合并）请用户拍板。依据是 `dw-system/skills/dw-workflow/references/init-初始化.md` 第 3、4 步，以及安装器结束时打印的下一步提示。
   - "独自开发"一节说"全部验证通过后自动合并进 main"。这只在合并方式选了本地直接合并时成立。
   - 安装器第 8 步写的是 `--location=local`。使用者能传的选项是 `--codegraph-location=local`；`--location` 是安装器转给 codegraph 的内部参数（`install.mjs` 的参数解析与 `syncCodegraph`）。
   - 说明冲突插件禁用方式时写"项目级 `.claude/settings.json` 首次打开会弹信任对话框"。安装器默认写的是 `.claude/settings.local.json`，只有加 `--shared` 才写 `.claude/settings.json`。
   - README 说协作面决定"要不要走 PR"。合并方式是标记块里独立的 `merge-gate` 字段，与协作面无关（`CLAUDE.md` 标记块〈合并方式只读本块 `merge-gate`，与协作面无关〉）。
   - 锁定版本的示例用的是 `v3.0.0`，当前版本是 `v3.5.0`。
   - 没有提到安装器每次都会检查并安装两个用户级伴生 skill（`agentic-principle`、`skill-principle`），也没有提到对应选项 `--no-companions` 与 `--companion-repo`。
2. **读者要翻很久才能上手**：前 30 行全是理念阐述，安装在第 69 行，快速上手在第 152 行，而且快速上手里没有一条能直接复制的命令，也没有示例说明装完后该对 AI 说什么。安装器内部的八个步骤、冲突插件表、配置优先级说明一共约 70 行，压住了主线。
3. **没有许可证**：仓库已公开，但根目录没有 `LICENSE`，`package.json` 写的是 `"license": "UNLICENSED"`。别人在法律上无法使用这套东西。README 结尾停在 `ctx` 命令表上，没有文档索引与许可证小节。

## 范围

### 做什么

- **FR-001**：重写 `README.md` 与 `README_zh.md`，两份结构与内容一一对应。顺序为：一句话定位与徽章 → 快速上手（一条安装命令、首次唤起会问什么、请你拍板什么、一段示例说明对 AI 说什么以及会发生什么）→ 为什么选它 → 工作方式（两条总纲、必备的代码事实层、随项目变化的三项设置：协作面、合并方式、代码图谱）→ 仓库里有什么 → `ctx` 命令速查 → 安装选项（项目级、全局、预演、锁定版本、无人值守、常用选项）→ 文档索引 → 许可证。
- **FR-002**：修正〈背景〉第 1 条列出的全部失准说法，修正后的写法以源码与 `node install.mjs --help` 的实际输出为准。
- **FR-003**：新建 `INSTALL.md` 与 `INSTALL_zh.md`，放在仓库根、与两份 README 并列，承接从 README 搬出的内容：安装器对目标项目做的每一步（含伴生 skill 一步）、冲突插件表与为什么只在本项目禁用、全局安装的行为、Codex 用户须知、生效时机与撤销方式。两份 README 的安装小节链接到它。
- **FR-004**：新增仓库根 `LICENSE`，内容为 MIT 许可证标准全文，版权行为 `Copyright (c) 2026 weidwonder`；`package.json` 的 `license` 字段改为 `MIT`；README 加许可证徽章与许可证小节。
- **FR-005**：保留现有对外说法"在 50–60 个 brownfield 仓库、双周高速迭代的真实生产环境中验证过"（拍板人确认属实）。
- **FR-006**：保留两条既有机器闸要求 README 必须带的内容：三条 `npx --yes git+https://github.com/weidwonder/dw-system.git` 写法（`.`、`--help`、`. --yes`），以及插件名 `superpowers@openai-api-curated`。

### 不做什么

- 不补 `CONTRIBUTING.md`、`CODE_OF_CONDUCT.md`、issue 与 PR 模板。
- 不加截图或录屏；快速上手用文字示例代替。
- 不改安装器、`ctx`、任何 skill 的行为，也不改 `docs/REQUIREMENTS.md` 已描述的功能。
- 不改历史文档、既有迁移指南与 CHANGELOG 既有条目。

## 兼容取舍

本次改变的既有可观察行为只有一条：

| # | 被改变的行为 | 谁受影响 | 结论 |
|---|---|---|---|
| 1 | 安装器内部步骤、冲突插件表、配置优先级说明、Codex 用户须知从 README 移到 INSTALL；别人收藏或引用的 README 内这几段的位置会失效 | 收藏过 README 小节链接的读者 | 不兼容（2026-10-28 拍板人选定）：直接移走，README 的安装小节明确链接到 INSTALL |

许可证从"保留所有权利"变为 MIT 是新增的对外授权，不是旧行为的兼容问题；它的不可逆性在下面的过稿记录里交拍板人确认。

## 验收标准

- **AC-001**：`node --test test/*.test.mjs` 全绿。
- **AC-002**：README 中出现的每个命令、选项、路径，都能在 `node install.mjs --help`、`ctx --help` 的输出或仓库文件里找到；〈背景〉第 1 条的七处失准一处不剩。
- **AC-003**：`README.md` 与 `README_zh.md` 的二级标题数量与顺序一致；`INSTALL.md` 与 `INSTALL_zh.md` 同样一致。
- **AC-004**：README 第一屏（前 25 行内）出现可复制的安装命令。
- **AC-005**：README 中所有相对链接指向的文件都存在。
- **AC-006**：仓库根有 `LICENSE`，内容为 MIT 全文；`package.json` 的 `license` 为 `MIT`。
- **AC-007**：需求真相源仍能从 README 一跳到达（README 链接 `docs/index.md` 与 `docs/REQUIREMENTS.md`）。

## 过稿记录

- 2026-10-28 定稿：拍板人对范围、FR-001 至 FR-006、AC-001 至 AC-007 整体认可，兼容取舍第 1 条选不兼容，并确认知悉以 MIT 发布后已发出的副本不能收回授权。
