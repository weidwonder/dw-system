# ai-dev-system — 我们自己的 AI 辅助开发体系

把一个需求，逐层降解成"零上下文的 AI agent 也能可靠执行"的任务——从 Triage 分流、顶层设计、技术 spec、coding plan，到编码与测试。

本体系裁剪自一套在真实生产环境（50~60 个 brownfield 仓库、双周高速迭代）验证过的 AI 辅助开发体系，收敛为**一个 mode-aware 的 skill**，同时服务两种场景：

- **个人版**：一个人的轻量项目。默认走一页 Lean Spec、流程可跳步、决策沉淀进 memory。
- **团队版**：多人多项目（5~20 人、10~30 仓）。加上团队协作约定 + 一层轻量 **Engineering Context**（给 AI 供给"可信、新鲜、权威"的代码事实，避免它读错旧代码）。

> 核心信念：AI coding 能不能落地，秘密不在流程本身（谁都能抄），而在**能不能给 AI 一层可信赖的代码事实**。团队版正是为此而生。

---

## 组成

```
ai-dev-system/
└── skills/ai-dev-workflow/     # 唯一的 skill（Claude Code + Codex 通用）
    ├── SKILL.md                # 入口：读 mode → 路由；首次调用 → 初始化
    ├── references/
    │   ├── core/               # 共享内核（技术栈无关）：流程总纲 / 写作纪律 / AI overlay
    │   ├── personal/           # 个人薄外壳
    │   └── company/            # 团队外壳 + Engineering Context 设计
    ├── assets/                 # 模板：spec / plan / test / config 注入片段 / card
    └── scripts/ctx/            # ctx CLI（Node.js，跨平台）：查代码事实，替代 MCP
```

设计与实施文档见 `../docs/superpowers/specs/2026-07-06-ai-dev-system-design.md` 与 `../docs/superpowers/plans/2026-07-06-ai-dev-system.md`。

---

## 安装

**方式 A：全局安装一次（推荐）** — 所有项目共用。

```bash
# Claude Code：拷进用户级 skills 目录
cp -r ai-dev-system/skills/ai-dev-workflow ~/.claude/skills/
```

之后在任意项目里唤起 skill（提到"AI 辅助开发 / 开发流程 / 生成 spec / coding plan / 需求澄清"即可触发），首次会做一次**初始化**：询问该项目用个人版还是团队版，把结论写进项目根的 `CLAUDE.md` 和 `AGENTS.md`，之后不再询问。

**方式 B：随项目安装** — 把 `skills/ai-dev-workflow/` 放进项目的 `.claude/skills/`，随仓库走。多项目会重复，适合强隔离场景。

> **Codex 用户**：Codex 读 `AGENTS.md`。初始化会同时写入 `AGENTS.md`，其中指明 mode、Engineering Context 位置与 `ctx` 用法；`ctx` CLI 可直接通过 shell 调用，跨工具通用。

---

## 快速开始

### 个人项目
1. 在项目里唤起 skill → 选"个人版"。
2. 直接描述你的需求。小改动会走一页 Lean Spec 直接实现；大需求才升级到完整流程。

### 团队项目
1. 在项目里唤起 skill → 选"团队版"。
2. 首次建议初始化 Engineering Context：
   ```bash
   node <skill>/scripts/ctx/src/cli.js init
   ```
   生成 `engineering-context/` 骨架（capability-registry + cards + probe-set 模板），团队按指南逐步填充。
3. 之后开发时，AI 会先用 `ctx discover "<意图>"` 找权威代码实体，而不是 grep 旧代码；每条事实带 cite 溯源。

---

## ctx CLI 速览

| 命令 | 作用 | 状态 |
|---|---|---|
| `ctx init` | 生成 engineering-context 目录骨架 | ✅ |
| `ctx discover "<意图>"` | 意图 → 应加载的 card 清单 + out-of-scope 警告 | ✅ |
| `ctx get-card <repo> [域]` | 取某仓 Codebase Card | ✅ |
| `ctx find-scenes <关键词>` | 端到端业务场景蓝图 | ✅ |
| `ctx list-services` | 列出已登记仓库/能力 | ✅ |
| `ctx search-semantic "<q>"` | 语义检索 | ⏳ 预留，见 scripts/ctx/README.md |
| `ctx probe` | 跑 Frozen Probe Set 防腐门禁 | ⏳ 预留，见 scripts/ctx/README.md |
