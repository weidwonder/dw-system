---
lifecycle: merged
archived: '2026-08-10'
---

> **已归档（2026-08-10）｜lifecycle: merged**：计划任务已全部执行，体系口径以 `CLAUDE.md` 与 `ai-dev-system/skills/` 下的 skill markdown 为准。与现行文档冲突时**以现行为准**，MUST NOT 据本文实施。

# 自有 AI 辅助开发体系 Implementation Plan

> 按任务逐项执行；每项完成后运行对应验证命令并记录结果。

**Goal:** 生成一个 mode-aware 的 `ai-dev-workflow` skill（内含 core/personal/company 三层）+ 一个跨平台 Node.js `ctx` CLI 骨架，作为我们自己的 AI 辅助开发体系。

**Architecture:** 单 skill，首次调用初始化写入 CLAUDE.md/AGENTS.md 的 mode 标记；core 层技术栈无关，personal/company 为两种外壳；团队版 Engineering Context 以本地 markdown card + `ctx` CLI 供给，替代 origin 的 MCP。

**Tech Stack:** Markdown（skill 内容）；Node.js ≥20 标准库（`ctx` CLI，零运行时依赖，`node:test` 测试，跨平台 `path`）。

## Global Constraints

- 全部内容中文为主，技术术语/标识符保留原文。
- skill 内 core/personal/company 三层结构不可改（D6）。
- CLI 零运行时依赖，仅 Node 标准库；跨平台：用 `path` 不硬编码分隔符，不用 bash-only 语法，输出 UTF-8（D9）。
- card 真相方向：事实以源码为准，PRD 仅作 scope；禁止从 PRD 生成 card 事实。
- 每条 context 事实输出附 cite（path + anchor + 最近确认时间）。
- 构建根目录：`ai-dev-system/`（当前项目内），最终全局安装（O1）。
- 不实现 embedding 语义检索与 Probe 门禁自动化，仅留接口 + 文档（§8 范围）。

---

## 文件结构总览

```
ai-dev-system/
├── README.md
└── skills/ai-dev-workflow/
    ├── SKILL.md
    ├── references/
    │   ├── core/{00-流程总纲.md, spec写作纪律.md, AI-LLM-overlay.md}
    │   ├── personal/mode-personal.md
    │   ├── company/{mode-team.md, context-engineering.md}
    │   └── init-初始化.md
    ├── assets/
    │   ├── templates/{lean-change-spec.md, overview.md, eng-spec.md, coding-plan.md, test-spec.md}
    │   ├── config-snippets/{personal.md, team.md}
    │   └── context-layer/{capability-registry.md, card.md, probe-set.md}
    └── scripts/ctx/
        ├── README.md, package.json
        ├── src/{cli.js, cards.js, commands.js}
        └── test/{cards.test.js, cli.test.js}
        └── fixtures/engineering-context/{capability-registry.md, cards/sample-service.md}
```

---

### Task 1: 骨架 + README + SKILL.md 路由

**Files:**
- Create: `ai-dev-system/README.md`
- Create: `ai-dev-system/skills/ai-dev-workflow/SKILL.md`

**Produces:** skill 入口与 mode 路由逻辑，供后续 references 被其引用。

- [ ] Step 1: 建目录 `ai-dev-system/skills/ai-dev-workflow/{references/core,references/personal,references/company,assets/templates,assets/config-snippets,assets/context-layer,scripts/ctx/src,scripts/ctx/test,scripts/ctx/fixtures}`
- [ ] Step 2: 写 `README.md`：体系定位（源自 origin 的裁剪）、两种 mode 怎么选、skill 全局安装（`~/.claude/skills/`）与项目内初始化两种用法、`ctx` CLI 一句话简介、指向设计文档。
- [ ] Step 3: 写 `SKILL.md`：frontmatter（name: ai-dev-workflow，description 含触发词：AI 辅助开发/开发流程/spec/coding plan/需求澄清）；正文含 §4 路由逻辑（读 mode 标记 → 无则初始化 → 有则加载 core + 对应外壳 → 按流程总纲驱动 Triage）；显式列出 references 各文件的加载时机。
- [ ] Step 4: 人工核对 SKILL.md 的 description 触发词覆盖 Claude Code 与 Codex 两种入口场景。

---

### Task 2: core 三篇（流程总纲 / 写作纪律 / AI overlay）

**Files:**
- Create: `.../references/core/00-流程总纲.md`
- Create: `.../references/core/spec写作纪律.md`
- Create: `.../references/core/AI-LLM-overlay.md`

- [ ] Step 1: `00-流程总纲.md`：Triage 4 问（AI/LLM 行为？鉴权安全设备？跨服务/迁移/不可逆？指标/规则/对外承诺？）；4 否走一页 Lean Spec，任一是走完整流程。10 步（Triage→PRD粗澄清→Overview→PRD细澄清→Spec→Spec澄清→Coding Plan→执行→测试Spec→测试代码→链路测试），每步标注：输入/产出/参考 prompt/对应模板；标明个人版可跳哪些步。技术栈无关措辞。
- [ ] Step 2: `spec写作纪律.md`：零上下文也能动手、RFC2119（MUST/SHOULD/MAY）、无占位符（禁 TBD/TODO/"类似上文"）、精确文件路径、每条事实带来源。
- [ ] Step 3: `AI-LLM-overlay.md`：AI 契约清单——模型/prompt 版本化、推理请求生命周期、输出契约与校验、置信度路由、安全管线、降级回退、成本/token 预算、eval 质量门、可观测性、数据/训练边界；判定边界（辅助受限步骤 vs Agent 主导）。
- [ ] Step 4: 核对三篇之间交叉引用用相对路径且指向真实文件名。

---

### Task 3: personal + company + init 四篇 references

**Files:**
- Create: `.../references/personal/mode-personal.md`
- Create: `.../references/company/mode-team.md`
- Create: `.../references/company/context-engineering.md`
- Create: `.../references/init-初始化.md`

- [ ] Step 1: `mode-personal.md`：单人默认——默认走一页 Lean Spec，大需求才升级；可跳步规则；砍掉评审会/多仓协作；个人 memory 沉淀约定；何时仍建议出 Overview（自己都记不住的复杂改动）。
- [ ] Step 2: `mode-team.md`：团队协作约定——评审会、owner 归属、PR 流程、谁澄清什么（需求→产品，落地→技术负责人）、按仓库划分 spec、文档治理（对齐用户 doc-governance：REQUIREMENTS/ARCHITECTURE/index）、context 层日常用法（先 `ctx discover` 不 grep 旧码、事实带 cite）。
- [ ] Step 3: `context-engineering.md`：方案 B 完整设计——四层栈（Foundations/Sources of Truth/Skills/Validation）+ 横向防腐；capability-registry 与 card 机制；真相方向铁律（代码→card，PRD 仅 scope）；新鲜度按"权威面"触发（非变更大小）、绑 PR/发布、hotfix 人工研判；Frozen Probe Set（40-50 题、门禁自检 plant 坏样本）；棘轮清单只许变短；明确标注哪些本轮只给文档（embedding/CI 门禁）。
- [ ] Step 4: `init-初始化.md`：初始化流程——检测 CLAUDE.md/AGENTS.md 是否已有 `<!-- ai-dev-workflow:start -->…:end -->` 块；无则询问 mode 并注入对应 config-snippet；幂等规则（只更新块内，不重复追加）；团队版额外引导 `ctx init`。

---

### Task 4: assets 模板（templates + config-snippets + context-layer）

**Files:**
- Create: `.../assets/templates/{lean-change-spec.md, overview.md, eng-spec.md, coding-plan.md, test-spec.md}`
- Create: `.../assets/config-snippets/{personal.md, team.md}`
- Create: `.../assets/context-layer/{capability-registry.md, card.md, probe-set.md}`

- [ ] Step 1: 5 份填空式 templates：`lean-change-spec`（一页：改什么/影响/验证）；`overview`（精简自 brownfield 14 节：定位/术语/问题/目标非目标/边界/Project Map 改造点/模块边界表/已定决策/契约/时序/降级/不变量/子文档路线/开放问题/引用）；`eng-spec`（基础骨架章节）；`coding-plan`（bite-sized 任务：Files/Steps/测试/commit）；`test-spec`（接口集成测试方案）。均含占位符 `【】` 与填写说明。
- [ ] Step 2: 2 份 config-snippet（§5 示意文案）：`personal.md`、`team.md`，被 init 注入 CLAUDE.md/AGENTS.md，用注释块包裹。
- [ ] Step 3: 3 份 context-layer 模板：`capability-registry.md`（字段：Capability/业务含义/权威仓库/权威接口含版本/废弃中间产物/兼容窗口/owner/测试入口/freshness/理由链）；`card.md`（仓库 card：职责/对外接口/上下游/废弃标记/测试入口/机器派生事实区）；`probe-set.md`（题型：Capability Mapping/Deprecated Trap/Version/Bugfix/Impact/PRD-Spec Conflict + 门禁自检说明）。
- [ ] Step 4: 核对模板与 core/00-流程总纲 各步"对应模板"引用一致。

---

### Task 5: ctx CLI — card 解析层（TDD）

**Files:**
- Create: `.../scripts/ctx/package.json`
- Create: `.../scripts/ctx/src/cards.js`
- Create: `.../scripts/ctx/test/cards.test.js`
- Create: `.../scripts/ctx/fixtures/engineering-context/capability-registry.md`
- Create: `.../scripts/ctx/fixtures/engineering-context/cards/sample-service.md`

**Produces:** `loadCards(dir) -> [{service, path, sections, raw}]`、`loadRegistry(dir) -> [{capability, canonicalRepo, canonicalApi, owner, ...}]`、`makeCite(path, anchorText, confirmedAt) -> string`。

- [ ] Step 1: 写 `package.json`：`{"name":"ctx","version":"0.1.0","type":"module","bin":{"ctx":"src/cli.js"},"engines":{"node":">=20"},"scripts":{"test":"node --test"}}`，无 dependencies。
- [ ] Step 2: 写 fixture `cards/sample-service.md`（含标题、`## 对外接口`、`## 上下游` 等段落）与 `capability-registry.md`（一行示例能力，markdown 表格）。
- [ ] Step 3: 写失败测试 `test/cards.test.js`：

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCards, loadRegistry, makeCite } from '../src/cards.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ctxDir = path.join(here, '..', 'fixtures', 'engineering-context');

test('loadCards 读出 sample-service 及其段落', () => {
  const cards = loadCards(ctxDir);
  const c = cards.find(x => x.service === 'sample-service');
  assert.ok(c, '应找到 sample-service');
  assert.ok(c.sections['对外接口'], '应解析出 对外接口 段落');
});

test('loadRegistry 解析出至少一条能力', () => {
  const rows = loadRegistry(ctxDir);
  assert.ok(rows.length >= 1);
  assert.ok(rows[0].capability);
});

test('makeCite 拼出 path + anchor + 时间', () => {
  const cite = makeCite('cards/x.md', '对外接口', '2026-07-06');
  assert.match(cite, /cards\/x\.md/);
  assert.match(cite, /对外接口/);
  assert.match(cite, /2026-07-06/);
});
```

- [ ] Step 4: 运行 `cd ai-dev-system/skills/ai-dev-workflow/scripts/ctx && node --test`，预期 FAIL（模块不存在）。
- [ ] Step 5: 写 `src/cards.js` 最小实现：用 `fs.readdirSync`/`readFileSync` 读 `cards/*.md`，按 `## ` 切段返回 `sections` 映射；`loadRegistry` 解析 markdown 表格行；`makeCite` 拼字符串。全程用 `path.join`。
- [ ] Step 6: 运行 `node --test`，预期 PASS。
- [ ] Step 7: 若在 git 仓库则 commit（当前非 git，跳过或按用户指示）。

---

### Task 6: ctx CLI — 命令层 + 入口（TDD）

**Files:**
- Create: `.../scripts/ctx/src/commands.js`
- Create: `.../scripts/ctx/src/cli.js`
- Create: `.../scripts/ctx/test/cli.test.js`
- Create: `.../scripts/ctx/README.md`

**Consumes:** `loadCards`、`loadRegistry`、`makeCite`（Task 5）。
**Produces:** 命令 `discover(ctxDir, intent)`、`getCard(ctxDir, service, domain?)`、`findScenes(ctxDir, keywords)`、`listServices(ctxDir)`、`initScaffold(targetDir)`；CLI 分发 `discover|get-card|find-scenes|list-services|init`，未实现命令 `search-semantic|probe` 返回明确"未实现，见 README 设计"提示。

- [ ] Step 1: 写失败测试 `test/cli.test.js`：

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { discover, listServices, initScaffold } from '../src/commands.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ctxDir = path.join(here, '..', 'fixtures', 'engineering-context');

test('discover 命中关键词返回相关 card 与 cite', () => {
  const r = discover(ctxDir, 'sample service 接口');
  assert.ok(r.cards.length >= 1);
  assert.ok(r.cards[0].cite, '每条结果需带 cite');
});

test('listServices 返回已登记服务', () => {
  const names = listServices(ctxDir).map(s => s.service);
  assert.ok(names.includes('sample-service'));
});

test('initScaffold 生成 engineering-context 骨架', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-'));
  initScaffold(tmp);
  assert.ok(fs.existsSync(path.join(tmp, 'engineering-context', 'capability-registry.md')));
  assert.ok(fs.existsSync(path.join(tmp, 'engineering-context', 'cards')));
  fs.rmSync(tmp, { recursive: true, force: true });
});
```

- [ ] Step 2: 运行 `node --test`，预期新测试 FAIL。
- [ ] Step 3: 写 `src/commands.js`：`discover` 用关键词分词与 card 段落/registry 做包含匹配打分，返回 `{cards:[{service, why, cite}], outOfScope:[]}`；`getCard`/`findScenes`/`listServices` 基于 Task 5；`initScaffold` 写出 `engineering-context/{capability-registry.md,cards/.gitkeep,probe-set/.gitkeep}`（内容从 assets/context-layer 模板复制精简版内联字符串）。
- [ ] Step 4: 写 `src/cli.js`：`#!/usr/bin/env node`；`process.argv` 解析子命令；默认 ctxDir 为 `process.cwd()/engineering-context`（`--dir` 可覆盖）；`search-semantic`/`probe` 打印"⏳ 未实现：见 scripts/ctx/README.md 设计章节"；JSON 或人读格式输出，含 cite。
- [ ] Step 5: 运行 `node --test`，预期 PASS。
- [ ] Step 6: 冒烟：`node src/cli.js list-services --dir fixtures/engineering-context` 应列出 sample-service；`node src/cli.js discover "接口" --dir fixtures/engineering-context` 应返回带 cite 的结果。
- [ ] Step 7: 写 `README.md`：命令表（已实现 ✅ / 预留 ⏳）、跨平台说明（Windows 经 npm bin shim、`path` 处理）、`search-semantic` 与 `probe` 的**设计章节**（embedding 方案、Probe Set 门禁自检伪码），指回 context-engineering.md。

---

### Checkpoint: 完成后

- [ ] 全部 `node --test` 通过（Task 5+6）。
- [ ] `ctx list-services` / `discover` / `init` 三条命令冒烟通过。
- [ ] skill references 与 assets 交叉引用路径无死链。
- [ ] 对照设计文档 §8 范围：已实现项齐全，未实现项都有文档兜底。
- [ ] 向用户汇报并演示 `ctx` 冒烟输出。

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Windows 下 bin/路径问题 | Med | 全程 `path.join`，`bin` 走 npm shim，测试用 `os.tmpdir()` |
| 内容过多 skill 臃肿 | Low | core 精简、细节放 references，SKILL.md 只做路由 |
| card 解析对格式敏感 | Med | fixture 固定格式 + 段落按 `## ` 宽松切分 |

## Open Questions

无（设计文档开放问题已定案）。
