# 权威位（curated）

> 加载条件：探测到已填写的 `engineering-context/capability-registry.md` 时加载。
> 本文按 RFC 2119 解释 MUST / MUST NOT / SHOULD / MAY。
> 权威位回答的是「**信哪个**」——同一能力有多处实现时，哪一处是权威。完整设计见 `context-engineering.md`。

## 0. 这一位解决什么、不解决什么

| | 权威位（本文） | 图谱位（`graph.md`） |
|---|---|---|
| 回答的问题 | 信哪个（消歧） | 找得到吗（检索） |
| 承载物 | `capability-registry.md`，按需递进到 card / scene / probe | codegraph 索引 |
| 事实性质 | **人工确认过的权威口径**，带 cite 与确认时间 | **现状代码事实**，随文件变更同步 |

两位**正交**，任一位启用都不蕴含另一位。权威位启用而图谱位未启用是常见且合法的状态：一个 3 千行、但有 v1/v2 并存的项目只需要 registry 的三行条目，不需要索引。

**registry 的最小合法形态**是三列：`Capability` / `权威实现` / `陷阱项（废弃或中间产物）`，其余列 MAY 留空。**MUST NOT** 因为 card / scene / probe 尚未建齐就认为权威位不可用——递进是按需的，不是准入门槛。`freshness` 列留空时 `ctx` 会标注"未声明新鲜度"，此时 **MUST NOT** 假定该条新鲜，按 §5 回查后再当事实用。

## 1. 分流默认假设

含权威位的项目，**跨仓 / 影响面说不清时 MUST 倾向升级**到 Step 2 出 Overview，而不是默认走 Lean。理由：registry 里存在权威条目，本身就是"这个项目已经出现过实现歧义"的证据，此时"我觉得改动很小"的自我判断不可信。

> 这条默认假设由**能力位**决定，与协作面（`collab/`）无关：一个人维护的十万行遗留系统同样适用。Triage 四问照常逐题过，本条只改变四问都不触发时的倾向。

## 2. 调用方式

安装器会把 `ctx` 链接成全局命令，正常情况下直接 `ctx <命令>` 即可。

**"`ctx` 命令找不到"绝不等于权威位不可用**——CLI 本体随本 skill 一起落盘。命令不可用时 MUST 改用：

```bash
node <本skill根目录>/scripts/ctx/src/cli.js <命令>
```

**`<本skill根目录>` 怎么得到**：就是当前这份 `ai-dev-workflow` 的 `SKILL.md` 所在的目录。安装后它在目标项目下有两份逐字节相同的副本，任选一份都行——Claude Code 读 `.claude/skills/ai-dev-workflow/`，Codex 读 `.agents/skills/ai-dev-workflow/`。**MUST NOT 写死其中一份**：同一份指导文件会被注入两个入口，写死 `.claude/` 那份在 Codex 侧就是错路径。拿不准就先试你自己加载 skill 的那一侧。

功能完全相同（想恢复全局命令则一次性 `cd <本skill根目录>/scripts/ctx && npm link`）。**任何情况下都 MUST NOT 因为找不到 `ctx` 命令就退回 grep 源码。** 命令清单与输出格式见 `scripts/ctx/README.md`。下文简写为 `ctx`。

凡涉及"这个能力对应哪个仓库/接口""跨服务影响面""哪个是权威实现"的问题，MUST 先用 `ctx`，MUST NOT 直接 grep 旧代码。

术语说法不一致时查 `engineering-context/glossary.md`（领域词汇表）：glossary 管说法一致，card 管事实权威，registry 管能力落点；发现"同一实体多种叫法"造成误会时提示 owner 补词条（见 `context-engineering.md` §2.4）。

## 3. ★ 业务全景门限（排序铁律）

**除非用户明确把任务限定到某一个具体 repo / 服务 / 代码路径**，否则**第一步 MUST 先 `ctx find-scenes <关键词>`** 取端到端业务全景，再据此收窄到具体 card / 源码。跨服务需求跳过全景直接钻单个 card，最常见的失败就是漏掉链路上的其它服务。提取 2–5 个高置信关键词（需求名、业务入口、核心动作）喂给 find-scenes。

```bash
ctx find-scenes 作业辅导 错题 重练          # ← 未限定单仓时先跑这个，取端到端全景
ctx discover "给作业辅导加错题重练入口"      # 意图 → 应加载的 card 清单 + out-of-scope 警告
ctx get-card <repo> [域]                     # 收窄后取某仓 Codebase Card
ctx list-services                            # 已登记仓库/能力
ctx search-semantic "<自然语言>"             # discover 未命中时的兜底
```

**`find-scenes` 无命中时（MUST NOT 卡在门限上）**：权威位的最小合法形态只有一份三列 registry（§0），`ctx init --minimal` 起步的项目 `engineering-context/scenes/` 本来就是空的，此时 `find-scenes` **必然**返回空——这是正常状态，不是资产损坏。处置：

1. **MUST NOT 阻断、MUST NOT 反复重试、MUST NOT 因此判定权威位不可用。**
2. 改走 `ctx discover` + `ctx get-card` 收窄，事实照旧带 cite。
3. 本次需求**确实跨服务**（涉及 ≥2 个 registry 登记的权威仓库）时，SHOULD 在收尾汇报里提一句"这条链路没有场景蓝图，跨服务影响面这次靠逐个 card 拼的"，并按 `context-engineering.md` §2.3 说明补蓝图的最小形态。提过一次即止。
4. 跨服务、且 `discover` 与 `search-semantic` 都收不窄时，才按 `core/上下文卫生.md` 规则 4 把重探索外包给子代理——**仍 MUST NOT 退回裸 grep 找权威实体**。

> 注意：`ctx find-scenes` 返回的是**场景蓝图指针**（scene 名 + 命中分 + 路径），本身不直接给"涉及哪些服务"。你从蓝图正文里读到 / 推断出的涉及服务，都是**推断**，MUST 逐个用 `ctx get-card` 核实到权威 card 才能当事实用。
> `discover` 会随命中结果给出 **out-of-scope 警告**（哪些是废弃/中间产物、别当权威用），这些警告 MUST 抄进 Step 1 的〈既有系统清单〉，并在 Step 2 的 A 核查里逐条确认。

## 4. cite 纪律

**每条来自 card 的事实（接口名、字段、topic、RPC 签名）MUST 附 cite**（path + anchor + 最近确认时间）。无 cite 的接口/字段一律视为幻觉，MUST 回查。

## 5. 检索纪律

- 查**精确 token**（字段名/接口名/表名）时 MUST 优先用精确匹配（`ctx get-card <repo> <域>`、grep card 正文），不要只靠 `ctx search-semantic`。
- **语义检索结果只作"去哪找"的索引，MUST NOT 当最终事实直接引用**——命中后仍要落到权威 card 段并附 cite。
- card 没有独立的 README 段，服务级 README 信息（部署/排障/路径）已并入 card 的对应节。

## 6. card 不够用、必须读真实源码时（clone 决策树）

以下属工程侧内部取证；向用户只说明正在核对哪项业务事实及其影响，不报告仓库、类、方法等程序细节，除非用户明确要求。

1. **先穷尽文档路径**——接口签名/字段去 card 的"对外接口"段；部署/配置/排障去 card 对应段；跨服务流程去 `ctx find-scenes`。以上都不够，才真正 clone。
2. **clone 前**：工程侧先明确要看哪个仓、为什么要看源码、要核对的具体事实；**若没有 repo 地址，向工程 owner / 用户索取，MUST NOT 凭服务名猜 git URL**；用 `git clone --depth=1 <url>` 浅克隆到一次性临时目录，别污染工作区。
3. **clone 后**：**MUST NOT 全仓 grep**——按 card 的"业务域 Card Index（哪个文件做什么）"按图索骥（本项目同时启用图谱位时，结构性定位改走 `graph.md`）；读完把关键发现回写（哪个模块做了什么、哪条规则在哪落地），让后续 agent 不用重新 clone；对用户仍保持业务语言。
4. 发现 card 有缺漏（如新增接口没记进去），**提示工程 owner 补卡**，但 **MUST NOT 直接改 card**（改卡走刷新流程）。

## 7. 新鲜度纪律（每个开发者）

- 你的改动若**触碰权威面**（canonical 接口签名、废弃标记、路由/配置版本、DB schema、兼容窗口）——哪怕只有 3 行——MUST 触发对应 card 刷新（见 `context-engineering.md` §5）。
- 纯内部实现改动（不碰接口/权威）MAY 不刷卡。
- 判断标准是**是否碰权威面**，不是改了多少行。
- **会话开始时先看增量**：`ctx` 读的是本地活文件，没有跨会话的变更推送。开一个新任务前，SHOULD 先看清"上次到现在 card/registry 变了什么"，避免拿脑子里的旧上下文干活（等价于在线 MCP 的 list_changes 变更感知）：

```bash
# engineering-context/ 通常就在项目仓库里（不是独立仓库），所以在项目根跑，路径当参数传
git log --oneline -20 -- engineering-context/
git diff 'HEAD@{2.weeks.ago}'..HEAD --stat -- engineering-context/cards/ engineering-context/capability-registry.md
```

用时间锚（`HEAD@{2.weeks.ago}`）而不是"上次的 commit"——**本体系不记录"上次是哪个 SHA"，没有那个落点**，写成 `<上次>..HEAD` 就是一条填不出来的命令。时间跨度按你上次碰这个项目的间隔调。
**reflog 不够长（新 clone）时这条命令 MUST NOT 被当作"没变过"**：git 会回退到最旧的 reflog 条目（= HEAD），输出**空 diff 且退出码 0**，只在 stderr 打一行 `warning: log for 'HEAD' only goes back to …`。看到这行 warning 即表示时间锚被截断、本次 diff **不可信**，MUST 改用 `git log --since='2 weeks' -- engineering-context/`。`engineering-context/` 确实是独立仓库时才用 `git -C engineering-context …`。

## 8. 真相方向铁律

card 事实 **MUST 以合入后的源码为准，MUST NOT 从 PRD 生成**——PRD 描述意图，意图常与已落地事实背离。详见 `context-engineering.md` §3。

## 一句话

权威位 = 一层"让 AI 读到正确代码"的 Engineering Context，用 `ctx` 而非 grep 供给权威事实，每条事实带 cite。
