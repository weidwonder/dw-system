# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 这个仓库是什么

**这是一个 AI 辅助开发方法论的分发包**，不是一个应用。它交付两个 Claude Code / Codex 通用的 **skill** 加一个零依赖的 **CLI**（`ctx`），把需求逐层降解成"零上下文 AI agent 也能可靠执行"的任务：

- `ai-prd` —— 从零**产出 PRD**（批量提问 + 阶段化 elicitation），补 workflow 的前置空缺。
- `ai-dev-workflow` —— 从**已有 PRD** 起步，走 Triage → Overview → Spec → Coding Plan → 测试。

`ai-prd` 的产物正是 `ai-dev-workflow` Step 1 的输入，两者松耦合。

核心信念（贯穿全部设计）：AI coding 能否落地，秘密不在流程本身，而在**能不能给 AI 一层可信、新鲜、权威的代码事实**——团队版的 Engineering Context 层正是为此而生。

> `orgin/` 与 `orgin.bak/` 是朋友公司的原始体系，被 `.gitignore` 忽略，**勿推送、勿作为交付的一部分**。它们只是本体系的裁剪来源参考。

## 常用命令

```bash
# ctx CLI 的单元测试（Node 内置 test runner，21 项，零第三方依赖，需 Node ≥20）
cd ai-dev-system/skills/ai-dev-workflow/scripts/ctx && node --test

# 跑单个测试文件
cd ai-dev-system/skills/ai-dev-workflow/scripts/ctx && node --test test/cli.test.js

# 直接运行 ctx CLI（无需 install）
node ai-dev-system/skills/ai-dev-workflow/scripts/ctx/src/cli.js <命令>

# 把 skill 安装进某个目标项目（跨平台，install.mjs 带 shebang 可直接运行）
./install.mjs <目标项目目录>            # 默认 --dry-run 前先预演
./install.mjs <目标项目目录> --dry-run  # 预演，不落盘
```

没有 build 步骤、没有 lint 配置、没有运行时依赖——整个包是纯 Node.js ESM + markdown。

## 架构：三层 + 一条铁律

**交付单元是 `ai-dev-system/skills/` 下的两个 skill（`ai-prd` + `ai-dev-workflow`）。** 二者共享同一套约定（mode-aware、references+assets 结构、复用 `ai-dev-workflow` 的 mode 标记块）。`ai-prd` 是 workflow 的前置产 PRD 阶段，结构见 `ai-dev-system/skills/ai-prd/`（纯 markdown，无代码）。下文以 `ai-dev-workflow` 为主展开，抓三点：

### 1. skill 是 mode-aware 的（`SKILL.md` 是入口）

同一套内核（`references/core/`），根据项目是「个人版」还是「团队版」加载不同外壳。每次调用先走**路由逻辑**（见 `SKILL.md` §路由逻辑）：

- 读目标项目根的 `CLAUDE.md`/`AGENTS.md`，找 `<!-- ai-dev-workflow:start --> … mode="personal|team" … <!-- ai-dev-workflow:end -->` 标记块。
- **无标记块** → 初始化（`references/init-初始化.md`）：只问一次 mode，把 `assets/config-snippets/{personal|team}.md` **幂等**注入目标项目的 `CLAUDE.md` **和** `AGENTS.md`（两个都写，兼容 Claude Code + Codex）。
- **有标记块** → 读出 mode 直接路由，不再询问。

初始化的幂等规则很关键：**只替换标记块内内容，绝不重复追加**；标记用 HTML 注释，机器可精确定位、对 markdown 渲染无影响。

### 2. 流程内核（`references/core/00-流程总纲.md`）

技术栈无关的 10 步流程 + Step 0 Triage 分流：

- **Triage 的 4 个判定问题**（AI/LLM 行为？鉴权安全设备？跨服务/迁移/不可逆？指标/业务规则/对外承诺？）——4 项全否走一页 **Lean Change Spec** 直接实现；任一为是升级回完整流程。
- 个人版默认假设走 Lean，只有 hold 不住才升级；团队版跨仓必升级、出 Overview。
- 含 AI/LLM 功能时，在基础 spec 上**叠加** `references/core/AI-LLM-overlay.md` 的 AI 契约（判定边界见该文件）。
- 所有文档遵循 `references/core/spec写作纪律.md`：零上下文可动手、RFC2119、无占位符。

### 3. 团队版的 Engineering Context 层 + `ctx` CLI（本仓库的技术核心）

团队版禁止 grep 旧代码找权威实体，必须先 `ctx discover "<意图>"` 再按结果读 card，**每条来自 card 的事实必须附 cite（path#anchor @确认时间），无 cite 视为幻觉**。

`ctx` CLI（`scripts/ctx/`）读本地 `engineering-context/` 目录（团队用 `ctx init` 在自己项目里生成），三层清晰分离：

- `src/cards.js` — 纯读取/解析层：`splitSections`（按 `## 标题` 切段）、`loadCards`（`cards/<repo>.md`，文件名即 service 名）、`loadRegistry`（解析 `capability-registry.md` 的 markdown 表格，表头首列含 `Capability`）、`makeCite`。
- `src/commands.js` — 命令/匹配层：`discover`（关键词 tokenize + 命中打分，registry 命中的能力给 card 加权）、`getCard`、`findScenes`、`listServices`、`initScaffold`。
- `src/cli.js` — argv 解析 + 路由 + 人类/`--json` 双输出。
- `src/semantic.js` — `search-semantic`：零依赖本地向量相似（字符 bigram 余弦 + 可选 synonyms）；结果带 freshness/cite + 权威指针，`--as-of` 启用过期降权。是 discover 未命中时的兜底。
- `src/probe.js` — `probe`：Frozen Probe Set 防腐门禁，机器可判题型 + 门禁自检（植入必错样本）+ 棘轮（新增失败 RED / 基线内 AMBER）+ 衰减报告；`--json` 退出码供 CI（RED/GATE-BROKEN=1）。

**跨平台是硬约束**：全程用 `node:path`、UTF-8、`os.tmpdir()`，无 bash-only 语法，零第三方依赖。改 `ctx` 时必须保持这些。

**Engineering Context 的真相方向铁律**（改任何 context 层相关内容前必读 `references/company/context-engineering.md` §3）：**card 事实以合入后的源码为准，绝不能从 PRD 生成 card 事实**（PRD 描述意图，意图常与已落地事实背离）。新鲜度**按是否触碰 Authority Surface 触发，而非变更行数**（3 行的路由 V1→V2 必须刷，2000 行内部功能不碰接口可不刷）。

## 目录速查

```
install.mjs / install.cmd          安装器：复制 skills/ 下所有 skill + 项目级禁用冲突插件
docs/superpowers/{specs,plans}/    本体系自身的设计与实施文档
ai-dev-system/skills/ai-prd/        产 PRD skill：批量提问 elicitation + 三类模板
  SKILL.md                         入口：读 mode → PRD 类型分流 → 4 批提问驱动
  references/                      00-prd生成流程 / prd写作纪律 / prd质量清单 / mode-*
  assets/templates/                change-prd（主）/ lite-issue-prd / product-prd
ai-dev-system/skills/ai-dev-workflow/
  SKILL.md                         skill 入口：路由 + 初始化
  references/core/                 共享内核（流程总纲 / spec写作纪律 / AI-LLM-overlay）
  references/personal/             个人薄外壳
  references/company/              团队外壳 + Engineering Context 完整设计
  references/init-初始化.md         幂等写入 CLAUDE.md/AGENTS.md 的规则
  assets/templates/                spec/plan/test/overview/lean-change-spec 模板
  assets/config-snippets/          注入 CLAUDE.md/AGENTS.md 的 personal/team 片段
  assets/context-layer/            capability-registry/card/scene-blueprint/probe-set 模板
  scripts/ctx/                     ctx CLI（src/ + test/ + fixtures/）
```

## 安装器的关键设计（`install.mjs`）

装 skill 时会在**目标项目级** settings 里把 4 个 Claude Code 冲突插件（`superpowers`、`everything-claude-code`、`oh-my-claudecode`、`general-task`）设为 `false`——它们的 brainstorming HARD-GATE、强制前置 skill、端到端引擎、SessionStart 注入会截胡本流程。原理：Claude Code settings 优先级 `Managed > Local > Project > User`，项目级 `false` 覆盖用户级 `true`，于是**只在本项目禁用，不影响全局**。默认写 `.claude/settings.local.json`（gitignored），`--shared` 才写 `.claude/settings.json`。合并时**不覆盖** `enabledPlugins` 里的其他键。

Codex 目前不能用同样方式做项目级插件 `enabled=false`：Codex 0.142.5 的插件配置只从用户级 `~/.codex/config.toml` 顶层 `[plugins]` 读取，`[projects."<path>"]` 当前只支持 `trust_level`。因此安装器**不生成**项目根 `.codex/config.toml`，而是在目标项目 `AGENTS.md` 写入 `ai-dev-system:codex-conflicts` 标记块，约束 `superpowers:` 不要自动加载或主动触发，除非用户在当前对话明确要求。`--keep=superpowers` 会同时保留 Claude Code superpowers 插件并跳过 Codex 约束块。

## 改动时注意

- 改 skill 行为 → 改对应 skill `references/` 下 markdown；改模板 → `assets/templates/`；两者是 skill 的"源码"。新增 skill 只要放进 `ai-dev-system/skills/<name>/` 并含 `SKILL.md`，`install.mjs` 会自动发现并复制，无需改安装器。
- `ai-prd` 的北极星参考物是 `orgin/prd.demo/GK1接入板书总控PRD`（brownfield 变更 PRD 骨架）；改 `change-prd.md` 模板前对照设计文档 `docs/superpowers/specs/2026-07-06-ai-prd-design.md §7` 的覆盖度映射，别丢节。
- 改 `ctx` 逻辑 → 同步更新 `scripts/ctx/test/` 下的测试，跑 `node --test` 保持全绿。card/registry 的格式约定见 `scripts/ctx/README.md` §card 格式约定，解析器依赖它。
- 本仓库自身文档遵循用户全局的文档治理标准（`docs/` 为准）。
