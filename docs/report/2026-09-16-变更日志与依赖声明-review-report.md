---
lifecycle: active
superseded_by: ''
archived: ''
last_confirmed: '2026-09-16'
authority_refs:
  - '无'
---

# 变更日志与依赖声明 · 代码评审门报告

**对象面：P + K（改动含 `docs/`）| 轴集合：{A, B, C, D, S} | 档位：普通档（三组子代理，按参照物分组：A/B/C 一组、D 一组、S 一组）| 各轴 P0 计数：A=0, B=0, C=0, D=0, S=0 | 结算积压：无**

评审范围：`git diff dd5b1c6...HEAD`（`reviewed-through` tag = 目标主分支 HEAD，等价于整条任务分支）。本次改的是门禁判据（完成门准出项、忠实轴职责），命中〈禁止积压清单〉第②类，当场跑。spec：`docs/spec/2026-09-16-变更日志与依赖声明-eng-spec.md`。

## 规范轴（A）

P0=0 / P1=0 / P2=1。

| # | 严重度 | 位置 | 问题 | 处置 |
|---|---|---|---|---|
| 1 | P2 | `文档治理.md` / `00-流程总纲.md` / `路径-lean.md` 根目录例外句 | "例外只有三类"后追加 `CHANGELOG.md` 未改计数，读感像漏改 | 保留现状：三处都写明它"不是 spec 也不是 plan"，不在那三类的计数范围内 |

核实通过项：`initScaffold` 全程 `fs`/`path`、`--minimal` 分支提前 return 不受影响；`test/change-awareness.test.mjs` 12 个 `cut()` 锚点唯一、断言逐条对照原文无过宽匹配；`ctx init` 真生成 / `--minimal` 真不生成均实测。

## 忠实轴（B）

P0=0 / P1=0 / P2=2。覆盖矩阵：FR-001～FR-020 逐条对应到落点文件（见子代理报告原文，全部齐全），未发现漏做 / 做一半 / 做反了 / 越界 / 镀金。spec §1「不做什么」六条逐条核实未越界（`gate-sync` 门总表未变、`cli.js` 未动、`install.mjs` 未动、无声明式豁免）。§8.1 五行 ↔ `CHANGELOG.md` `不兼容` 五条一一对应、三项齐全——这是按本次新增的忠实轴判据对自己跑的第一次。

| # | 偏离类型 | 严重度 | 位置 | 问题 | 处置 |
|---|---|---|---|---|---|
| 1 | 镀金（轻微） | P2 | `CHANGELOG.md` 五条 `不兼容` 开头名 | 用的是门名 / 轴名 / 命令名，与 FR-003 "对外接口名"字面有张力 | 已修：`代码事实纪律.md` §10.1 与 `路径-lean.md` §3.11 补"纯文档 / 流程类仓库用被改变的判据实体名代替" |
| 2 | — | P2 | spec §4.5 vs AC-009 | "三件事同一次做"与本次只 bump VERSION 不改名矛盾 | 已修：spec §4.5 补"首次落地本次是例外" |

## 残留轴（C）

P0=0 / P1=0 / P2=0。§8.2 替换清单六项逐条核销：卡片下游行旧形态、ctx README 与 init 第 5b 步生成物清单三处全仓零残留；根目录例外三处已加 `CHANGELOG.md`（措辞见 A#1）。无新死代码（`DEPENDENCIES_README_STUB` 被 `initScaffold` 引用）；权威定义只在 `代码事实纪律.md` §10，其余五处为复述 / 指针。本仓库不建卡片，无卡片核销项。

## 文档轴（D）

P0=0 / P1=2 / P2=2。盘点权威面：①`ctx init` 生成物集合 ⑥根目录约定 ⑦五类闭集与声明五项 ⑧忠实轴职责与完成门准出项。扫了 37 篇现行文档（关键词命中打开核对 6 篇），**3 篇部分失准**，断链零发现，真相源已跟上，`docs/TODO.md` 无重叠条目。`ctx probe` 报 `NO-PROBE`（本仓无探针题，正常）。

| # | 严重度 | 位置 | 问题 | 处置 |
|---|---|---|---|---|
| 1 | P1 | `docs/spec/2026-08-16-ctx全局命令安装-lean-change-spec.md:88` | `ctx init` 生成物清单缺 `dependencies/README.md` | 已就地更正 + `last_confirmed` 2026-09-16，`lifecycle` 保持 active |
| 2 | P1 | `docs/spec/2026-08-18-代码事实层强制化-eng-spec.md:152` | 第 5b 步骨架清单缺 `dependencies/` | 同上 |
| 3 | P2 | `docs/spec/2026-07-06-ai-dev-system-design.md:13` | `authority_refs` 的 Engineering Context 构成未纳入依赖声明 | 已就地补注 + `last_confirmed` |
| 4 | P2 | `CLAUDE.md` §3 引用文字 | 与 §改动时注意 实际标题不逐字一致 | 已对齐 |

## skill 原则轴（S）

P0=0 / P1=3 / P2=4。加载 `skill-principle` 审查路径。

| # | 严重度 | 位置 | 问题 | 处置 |
|---|---|---|---|---|
| 1 | P1 | `base.md` 升级步骤② | 三处复述中唯独漏"或缺该版本区间"分支 | 已补 |
| 2 | P2 | `base.md` 升级步骤③ | 漏"上游改了名的按旧名匹配" | 已补 |
| 3 | P1 | `assets/templates/overview.md` §5.5 | 既有系统清单三个落点只同步了两个 | 已补同一句指引 |
| 4 | P2 | `worktree开发纪律.md` first-parent 脚本 | 代码块内含全角占位符，原样执行报错 | 已加首行注释提示替换 |
| 5 | P1 | `<上游名>` 命名规则（四处 + stub） | npm scoped 包名含 `/` 会造出子目录、多份声明并存 | 已补转义规则"`/` → `__`"，五处同步 |
| 6 | P2 | §10.1 / §3.11 | 不兼容条目缺可照抄示例 | 已各补一条 |
| 7 | P2 | 常驻前置量余量仅三百余字节 | 下次追加常驻内容可能压穿门槛 | 已登记 `docs/TODO.md` 技术欠账 |

## 机器闸反向自检

`test/change-awareness.test.mjs` 写完后三次故意弄坏均判红：①删 `base.md` 的"MUST NOT 自造第六类" → 测试 1 红；②删 `commands.js` 里 `dependencies/README.md` 的写入 → 测试 10 红；③删 `路径-lean.md` §3.12 的"MUST NOT 全量看" → 测试 5 红。恢复后 12/12 绿。首轮跑闸时另抓出两处措辞不一致（权威处的加粗标记、Lean 侧的 "§11 " 插入）被断言正则漏匹配，已把正则改宽到只容忍这两类格式差异。

## 结论

P0/P1 全部清零，`node --test test/*.test.mjs` 全绿，`node --test test/resident-budget.test.mjs` 绿（余量以该命令现读为准，本文不抄数）。过门。
