# Frozen Probe Set — 上下文层防腐检测题集

> 精简骨架；完整题型示例与 authority_refs 自防腐机制见 dw-code-facts skill 的 assets/context-layer/probe-set.md。
> 冻结、可打分、每发布周期重跑（`ctx probe`）。种子题取自真实歧义案例，有已知正确答案。
> 机器可判题型分两类：
> **A. context 层题型**（读 cards/registry）
>   capability-mapping —— 输入=能力名，期望=`权威仓库 :: 权威实现`（门禁按 registry 求解并比对）。
>     registry 是**三列最小 schema**（没有"权威仓库"列）时，期望串**只写权威实现**即可：
>     仓库维度不存在、无从比对，门禁只判权威实现；此时写成 `repo :: api` 反而恒失败，污染棘轮基线。
>   deprecated-trap    —— 输入=接口/实体，期望=`deprecated`（门禁须从 cards/registry 判其为废弃；被当 canonical 即失败）。
> **B. 零上下文交接题型**（读项目自身文件；项目根取 `ctx probe` 的运行目录，`--dir` 只改 engineering-context 的位置）
>   requirement-reachable  —— 输入=需求真相源 `路径` 或 `路径#小节`，期望=`≤2 跳`（写数字即改上限）。
>                             入口文档=仓库根 README*.md 与 docs/index.md，从入口沿链接 BFS。
>   architecture-reachable —— 同上，指向架构真相源。
>   implementation-usable  —— 输入=架构节 `路径#小节`，期望=`usable`。判定是**叠加**不是择一：
>                             架构节里列出的模块路径（反引号代码片段或相对链接）**无条件**均需存在；
>                             探测到代码图谱再叠加一项 `.codegraph/codegraph.db` 非空可查询。
>                             registry 有已登记条目时只追加一条说明性 note，**不参与 pass/fail**。
>   rationale-traceable    —— 输入=索引路径（默认 docs/index.md），期望=`全部非空`：
>                             索引**现行区**（非"归档"标题下）链到的各 spec，frontmatter `authority_refs` 均非空。
>   类型名可写中文题名：需求真相源可达 / 架构真相源可达 / 实现真相源可用 / 设计理由可追。
>   常见失败串：`NO-ENTRY-DOC` / `MISSING:<路径>` / `ANCHOR-MISSING:<路径>#<锚点>` / `UNREACHABLE(>N 跳)` / `NO-SPEC-LINK`。
>   零条目不算通过：架构节抽不到模块路径、索引现行区一篇 spec 都没链到，一律判 FAIL——那是假门禁。

## 探针
> 列 severity（blocking=零容忍 / scored=计入加权通过率）、weight（scored 权重，默认 1）、status（正常留空；权威面变更待重认填 needs-reconfirm、退役填 quarantined，均暂不计分）可选。
| # | 类型 | 输入 | 期望 | severity | weight | status |
|---|---|---|---|---|---|---|
| 1 | capability-mapping | 【能力名，如 背单词记录】 | 【repo :: POST /v2/xxx；最小 schema 只写 POST /v2/xxx】 | scored | 1 | |
| 2 | deprecated-trap | 【废弃接口，如 POST /v1/xxx】 | deprecated | blocking | 1 | |
| 3 | requirement-reachable | 【需求真相源，如 docs/index.md 或 README.md#需求】 | ≤2 跳 | blocking | 1 | |
| 4 | architecture-reachable | 【架构真相源，如 README.md#架构与边界】 | ≤2 跳 | blocking | 1 | |
| 5 | implementation-usable | 【架构节，如 README.md#架构与边界】 | usable | scored | 2 | |
| 6 | rationale-traceable | 【索引路径，默认 docs/index.md】 | 全部非空 | scored | 2 | |

## 基线（棘轮）
> 已知、暂时容忍的失败项（按 # 列）。规则：**只许变短**——基线外新增失败即 RED；基线内已修复也 RED（强制删除该条）。
> 编号 MUST **独立成行**：`- 12` / `* #12` / `1. 12` / `- [ ] 12` / 表格首列 `| 12 |` 都认。
> 夹在句子里的编号（`- 探针 3：容忍到 2026-09`）不认，会被单独警告——漏读一条基线就是假 RED。
> 复核记录照常写，行内的日期与 issue 号不会被误当编号。
（空）
