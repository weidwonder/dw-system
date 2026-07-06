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
| `ctx init [--dir <目标>]` | 生成 `engineering-context/` 骨架（registry + cards/ + probe-set） | ✅ |
| `ctx discover "<意图>"` | 意图 → 应加载的 card 清单（按命中分排序）+ out-of-scope 提示 | ✅ |
| `ctx get-card <repo> [域]` | 取某仓 card；域为 `## 段落标题` | ✅ |
| `ctx find-scenes <关键词...>` | 匹配 `scenes/*.md` 业务场景 | ✅ |
| `ctx list-services` | 列出已登记服务及其能力 | ✅ |
| `ctx search-semantic "<q>"` | 语义检索 | ⏳ 见下 |
| `ctx probe` | 跑 Frozen Probe Set 防腐门禁 | ⏳ 见下 |

公共选项：`--dir <ctx目录>`（默认 `<cwd>/engineering-context`）；`--json` 输出 JSON。

## 跨平台说明

- 全程用 `node:path`（`path.join` / `path.resolve`），不硬编码 `/`。
- 无 bash-only 语法；所有逻辑在 Node 内完成。
- Windows：`npm link` / 安装时 npm 会依据 `package.json` 的 `bin` 生成 `ctx.cmd` shim，可直接调用。
- 读写统一 UTF-8。测试用 `os.tmpdir()`，不假设 `/tmp`。
- `--test` 用 Node 内置 `node:test`，无需第三方测试库。

## 测试

```bash
cd <skill>/scripts/ctx && node --test        # 9 项，覆盖 cards 解析与全部已实现命令
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

> 未来 `ctx probe`（见下）也会以 `--json` 输出衰减报告，供 CI 门禁读取。

## card 格式约定（供解析）

- card 放 `engineering-context/cards/<repo>.md`，文件名即 service 名。
- 段落用 `## 标题`（`get-card <repo> <域>` 按此定位）。
- `capability-registry.md` 用 markdown 表格，表头首列含 `Capability`；正文单元格避免裸 `|`。
- `Freshness / Provenance` 段落里的 `YYYY-MM-DD` 用作 cite 的确认时间。

---

## ⏳ 未实现部分的设计（本轮以文档交付）

### `ctx search-semantic "<query>"` — 语义检索

**动机**：关键词匹配（当前 `discover` 用）对同义/近义词无能为力。语义检索作为 `discover` 未命中时的兜底。

**设计**：
1. **建索引**（离线，绑发布周期）：对每张 card 的段落分块，调 embedding API 生成向量，存入本地 `engineering-context/.index/`（如 sqlite 或 jsonl）。
2. **查询**：对 query 生成 embedding，做 top-k 余弦相似，返回 card 段落 + cite。
3. **防腐红线**（关键）：`search_semantic` 本身是一种索引，**可能重蹈 RAG 过期覆辙**。所以：
   - 索引必须记录每块的 `freshness`，返回时一并给出；过期块降权或告警。
   - 索引的立身之本是**权威 + 指针**（canonical / 废弃 / 陷阱），而非单纯相似度——否则只是重建了会过期的 RAG。
   - 语义检索**不作为第一入口**：权威 registry + `discover` 路由才是入口，语义检索是补充。

**为什么本轮不实现**：需要 embedding API Key 与索引构建/刷新流水线；先用零依赖的关键词版跑通闭环，成熟后再加。

### `ctx probe` — Frozen Probe Set 防腐门禁

**动机**：真实项目每次都变，不能当回归基线；需要一个冻结、可重复、每发布周期重跑的评测集检测 context 层衰减。题集见 `engineering-context/probe-set.md`（`ctx init` 会生成模板）。

**设计**：
1. 读 `probe-set.md` 的题（含已知正确答案）。
2. 对每题，用当前 context 层（registry + cards + discover）作答，与期望答案比对，打分。
3. **门禁自检**（防"永远全绿"的假门禁）——跑真实探针前先植入一个已知必然失败的样本：
   ```
   runProbeGate():
     plantKnownStaleEntity()        # 如把废弃接口标成 canonical
     assert gate(sample) == FAIL    # 抓不到 → 门禁失效，流水线红
     return gate(realProbeSet)      # 自检通过才跑真实探针
   ```
4. 输出衰减报告：本周期 vs 上周期的通过率变化。
5. **棘轮**：容忍的腐化债登记成基线清单，机器规则"只许变短"。

**运行节奏**：只在 CI 发布 / 里程碑节点，**不进 coding agent 每轮 loop**。

**为什么本轮不实现**：需要与 CI 集成 + 打分器；先交付题集模板与门禁自检伪码，方法成熟后接 CI。

> 完整理念见 `../../references/company/context-engineering.md`。
