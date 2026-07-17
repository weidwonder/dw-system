# ctx — Engineering Context CLI

查代码事实的 CLI，**替代 MCP**：Claude Code 与 Codex 都能通过 shell 调用。Node.js ≥20，**零运行时依赖**，跨平台。读本地 `engineering-context/`（markdown card + capability-registry），每条事实附 cite。

## 安装 / 运行

```bash
# 直接运行（无需安装依赖）
node <skill>/scripts/ctx/src/cli.js <命令>

# 或全局链接为 ctx 命令
cd <skill>/scripts/ctx && npm link      # 之后可直接 `ctx <命令>`
```

## 命令

| 命令 | 作用 | 状态 |
|---|---|---|
| `ctx init [--dir <目标>]` | 生成 `engineering-context/` 骨架（registry + cards/ + probe-set + glossary） | ✅ |
| `ctx discover "<意图>"` | 意图 → 应加载的 card 清单（按命中分排序）+ out-of-scope 提示 | ✅ |
| `ctx get-card <repo> [域]` | 取某仓 card；域为 `## 段落标题` | ✅ |
| `ctx find-scenes <关键词...>` | 匹配 `scenes/*.md` 业务场景 | ✅ |
| `ctx list-services` | 列出已登记服务及其能力 | ✅ |
| `ctx search-semantic "<q>"` | discover 未命中时的语义兜底（本地向量相似） | ✅ 见下 |
| `ctx probe` | 跑 Frozen Probe Set 防腐门禁（自检 + 棘轮 + 衰减） | ✅ 见下 |

公共选项：`--dir <ctx目录>`（默认 `<cwd>/engineering-context`）；`--json` 输出 JSON。

## 跨平台说明

- 全程用 `node:path`（`path.join` / `path.resolve`），不硬编码 `/`。
- 无 bash-only 语法；所有逻辑在 Node 内完成。
- Windows：`npm link` / 安装时 npm 会依据 `package.json` 的 `bin` 生成 `ctx.cmd` shim，可直接调用。
- 读写统一 UTF-8。测试用 `os.tmpdir()`，不假设 `/tmp`。
- `--test` 用 Node 内置 `node:test`，无需第三方测试库。

## 测试

```bash
cd <skill>/scripts/ctx && node --test        # 21 项，覆盖 cards 解析与全部命令（含 semantic / probe）
```

## CI / 脚本用法（`--json`）

所有查询命令加 `--json` 输出结构化 JSON，可直接喂 `jq` 或 CI：

```bash
# 取某接口段落的权威事实 + cite
node src/cli.js get-card sample-service 对外接口 --dir <ctx目录> --json | jq -r '.cite'

# discover 命中的权威服务名（供流水线做影响面校验）
node src/cli.js discover "作业辅导 对话" --dir <ctx目录> --json | jq -r '.cards[0].service'

# 断言某能力已登记（未登记则 CI 失败）
node src/cli.js list-services --dir <ctx目录> --json \
  | jq -e '[.[].capabilities[]] | index("背单词记录")' >/dev/null \
  || { echo "能力未登记，请补 capability-registry"; exit 1; }
```

`ctx probe --json` 输出衰减报告（verdict / passRate / passRateDelta），退出码 RED/GATE-BROKEN=1，供 CI 门禁读取：

```bash
# 发布前防腐门禁：门禁自己失效或出现新增失败 → 流水线红
node src/cli.js probe --dir <ctx目录> --json | jq -e '.verdict=="GREEN" or .verdict=="AMBER"' >/dev/null \
  || { echo "context 层防腐门禁未通过"; exit 1; }
```

## card 格式约定（供解析）

- card 放 `engineering-context/cards/<repo>.md`，文件名即 service 名。
- 段落用 `## 标题`（`get-card <repo> <域>` 按此定位）。
- `capability-registry.md` 用 markdown 表格，表头首列含 `Capability`；正文单元格避免裸 `|`。
- `Freshness / Provenance` 段落里的 `YYYY-MM-DD` 用作 cite 的确认时间。

---

## `ctx search-semantic "<query>"` — 语义兜底检索

**定位**：`discover` 用精确子串命中；本命令是 **discover 未命中时的兜底**，抓近义/形近说法。

**实现**（零依赖、离线）：对每张 card 的 `## 段落` 分块，用**字符 bigram 余弦相似度**给 query 排序；可选 `engineering-context/synonyms.md`（每行 `- 词: 近义1, 近义2`）做查询扩展。**非神经 embedding**——这是零依赖后端；未来可把打分器换成 embedding 索引，只要保持"结果带 freshness + 权威标记"的契约不变。

```bash
node src/cli.js search-semantic "背单词 进度" --top 3
node src/cli.js search-semantic "背单词" --as-of 2026-07-20 --stale-days 90   # 启用 freshness 降权
```

**防腐红线（已落地）**：
- 每个结果带 `freshness` 与 `cite`；给 `--as-of` 时，超过 `--stale-days`（默认 90）未确认的块标 `stale` 并把 score ×0.5。
- 每个结果带**权威指针** `authority`（`canonical` / `deprecated`）——命中"废弃/中间产物"段落会标 `deprecated`，避免把废弃项当权威。
- 输出固定附提醒：**语义检索不是第一入口**，权威 registry + `discover` 优先。

**局限**：字符 n-gram 对完全换词（无 synonyms 登记）的同义仍弱；需要更强召回时接 embedding 后端。

## `ctx probe` — Frozen Probe Set 防腐门禁

**定位**：真实项目每次都变，不能当回归基线；用冻结、可打分、每发布周期重跑的题集检测 context 层**衰减**。题集见 `engineering-context/probe-set.md`（`ctx init` 生成模板）。

**题型（机器可判）**：
- `capability-mapping`：输入=能力名，期望=`权威仓库 :: 权威接口`；门禁按 registry 求解比对。
- `deprecated-trap`：输入=接口/实体，期望=`deprecated`；门禁须从 cards/registry 判其废弃，被当 canonical 即失败。

```bash
node src/cli.js probe --dir <ctx目录>          # 人读报告
node src/cli.js probe --dir <ctx目录> --json    # CI 读；退出码 RED/GATE-BROKEN=1
```

**已落地的三条铁律**：
1. **门禁自检**（防"永远全绿"的假门禁）：真跑前植入必错样本（谎报权威映射 / 把 canonical 接口谎称 deprecated），断言门禁判它们 FAIL；抓不到 → `GATE-BROKEN`，退出 1。context 层为空也判 `GATE-BROKEN`。
2. **棘轮**：`## 基线（棘轮）` 段登记容忍的失败 #；新增（非基线内）失败 → `RED`（退出 1）；失败全落基线内 → `AMBER`（退出 0，告警）；当前失败少于基线时提示可收紧。
3. **衰减报告**：读/写 `.index/probe-history.json`，`--json` 给出 `passRate` 与 `passRateDelta`（较上周期）。

**运行节奏**：只在 CI 发布 / 里程碑节点，**不进 coding agent 每轮 loop**。

> 完整理念见 `../../references/company/context-engineering.md`。
