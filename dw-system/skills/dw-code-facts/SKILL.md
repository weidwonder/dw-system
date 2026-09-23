---
name: dw-code-facts
description: "代码事实层 engineering-context 与 ctx CLI：查某个能力的权威实现在哪个仓库哪个接口、跨服务影响面、哪份是废弃的旧实现；每条事实带 cite；查不到卡片就读源码并当场补卡；碰了权威面要刷卡；每次合并写 CHANGELOG 条目；升级上游版本前读依赖声明；探测到代码图谱（codegraph）时做结构检索。写 spec 的既有系统清单、动手改一个没读过的模块、'ctx 命令找不到 / 返回空'、要 clone 外部仓库取证、要设计 registry 或场景蓝图或探针集时用。文档目录与归档用 dw-doc-governance；bug 复现与假设用 dw-bug-diagnosis。"
---

# dw-code-facts：先查卡片，没有就读源码并补上

本 skill 管**目标项目的 `engineering-context/`**（能力登记表 registry、事实卡 cards、场景蓝图 scenes、依赖声明 dependencies、探针集 probe-set）、查询它的 **`ctx` CLI**、仓库根 **`CHANGELOG.md`** 的写法，以及可选的**代码图谱**检索。它回答"同一能力有多处实现时信哪个"。`docs/` 下的文档归 `dw-doc-governance`；卡片里的文字怎么写归 `dw-prose`。按 RFC 2119 解释规范词。

## 恒定规则

- **`engineering-context/` 必备、没有开关**。起步时只有模板占位是正常状态，MUST NOT 因此告警，MUST NOT 据此判定可以直接 grep；也 MUST NOT 把"卡片没建齐"当成阻断流程的理由。
- **取事实的顺序**：未限定单仓时先 `ctx find-scenes <关键词>` → `ctx discover "<意图>"` → `ctx get-card <repo> [域]`。`find-scenes` 无命中不是错误。
- **每条据此得到的事实 MUST 附 cite**；无 cite 视为幻觉。
- **卡片按业务域分**：每仓一张地图卡 `cards/<repo>.md`，每个业务域一张域卡 `cards/<repo>/<域>.md`；只写现状、只记判断。**外部上游的事实落 `dependencies/<上游名>/<域>.md`（依赖仓事实卡），MUST NOT 摆进 `cards/`**——`ctx` 同等检索它，输出带 `[依赖]` 前缀。
- **查不到卡片 → 读源码核实 → 当场补卡，随本次分支提交**，MUST NOT 顺延，MUST NOT 退回 grep 找权威实现。
- **MUST 在项目根跑 `ctx`**（或 `--dir <项目根>/engineering-context`）；在子目录跑会静默返回空且退出码为 0。

## `ctx` 命令找不到时

这不等于这一层不可用。CLI 随本 skill 落盘：

```sh
node <本 skill 根目录>/scripts/ctx/src/cli.js <命令>
```

`<本 skill 根目录>` = 本文件所在目录，即注入块里的 `<skills 根>/dw-code-facts/`；项目级安装时 Claude Code 下是 `.claude/skills/dw-code-facts/`、Codex 下是 `.agents/skills/dw-code-facts/`，全局安装时是 `~/.claude/skills/dw-code-facts/`、`~/.codex/skills/dw-code-facts/`，两份内容一致，用你加载 skill 的那一侧。**MUST NOT 写死其中一份**：写死 `.claude/` 那份在 Codex 侧、写死项目级那份在全局安装下都是错路径。要恢复全局命令：`cd <本 skill 根目录>/scripts/ctx && npm link`。命令清单与输出格式见 `scripts/ctx/README.md`。

## 读取条件（到点才读、只读那一节；MUST NOT 预读，MUST NOT 凭记忆代替）

| 什么时候 | 读什么 |
|---|---|
| 第一次在本项目取代码事实 | `references/代码事实纪律.md` §0–§3 |
| `ctx` 返回空、术语对不上 | `references/代码事实纪律.md` §2 |
| 查不到卡片；要落笔写一张卡，或要改、处置一张既有卡 | `references/代码事实纪律.md` §4（含 §4.1、§4.2）；模板 `assets/context-layer/card-map.md` 与 `card-domain.md`；写完跑 `ctx lint-cards` |
| 卡片超过体积上限，或一张卡里堆了按任务追加的小节 | `references/代码事实纪律.md` §4.2；体检规则见 `scripts/ctx/README.md` §`ctx lint-cards` |
| 要写 cite；要在卡片之外检索源码 | `references/代码事实纪律.md` §5、§6 |
| 卡片不够、要 clone 外部仓库取证 | `references/代码事实纪律.md` §7 |
| 本次改动碰了权威面，要判刷不刷卡；开新任务，要看 `engineering-context/` 的跨会话增量 | `references/代码事实纪律.md` §8；权威面清单在 `dw-doc-governance` 的 `文档生命周期.md` §3 第 1 步 |
| 要落笔写卡而手边有 PRD（写之前读：卡片事实 MUST NOT 从 PRD 生成，等写错了再读已经晚了）；卡片与源码说法冲突 | `references/代码事实纪律.md` §9 |
| 实现阶段要写本次的 CHANGELOG 条目 | `references/代码事实纪律.md` §10.1 |
| 要升级某个上游；读到或改到对某个上游的调用；读了上游源码要落依赖仓事实卡 | `references/代码事实纪律.md` §10.2 与 §4.1；模板 `assets/context-layer/dependency.md`（〈业务域地图〉节）与 `card-domain.md`（顶部三点差异） |
| 要动资产结构：registry 字段、场景蓝图、词汇表、探针集、新鲜度机制 | `references/engineering-context设计.md` |
| 项目根存在 `.codegraph/codegraph.db`，且要做结构检索（调用边、符号定位、影响面） | `references/graph.md` |

## 案例

**补卡**：要给订单导出加一列。`ctx discover "订单导出 CSV"` 命中订单服务的〈订单导出〉域卡，取到"导出列定义在 `export/columns.py#EXPORT_COLUMNS`"。`source` 字段没有卡片覆盖 → 读源码确认它是 `orders.source` 枚举 → 当场把这条写进该域卡的〈权威实现与对外接口〉并改写〈确认〉那一行，跑 `ctx lint-cards`，随本分支提交；spec 的〈既有系统清单〉引用这两条，各带 cite。

**`ctx` 返回空**：在 `services/order/` 下跑 `ctx get-card order` 返回空、退出码 0。原因是 `ctx` 默认读 `<cwd>/engineering-context`。回到项目根重跑即可；MUST NOT 据此判定"没有卡片"而去读源码重写一张。
