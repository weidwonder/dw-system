# 团队版外壳（team mode）

> 加载条件：项目 mode = team。在 `core/` 之上，本文件定义"多人多项目（5~20 人、10~30 仓）"的协作约定与 Engineering Context 日常用法。Engineering Context 的完整设计见 `context-engineering.md`。

## 1. 协作约定

### 角色与澄清分工
- **业务目标、规则、边界 → 找业务负责人确认**；**详细程序设计 → 工程侧内部决策与评审**。不得要求业务用户理解技术方案后拍板。
- 每个仓库有明确 **owner**；改动别人仓库前先对齐 owner。

### 评审会
- 跨 ≥3 仓的需求，**Step 2 出 Overview 后开评审会**。先用“用户确认摘要（业务语言）”确认大架构，再由工程侧内部评审详细设计。
- 评审结论回写进 Overview 的"已定决策"表，避免每份 spec 重新吵。

### 按仓拆 spec / 按 feature 拆 Issue
- 一个需求涉及多仓时，**按代码仓库划分 spec**，每个仓库一份，明确该仓做什么、不做什么、上下游契约。
- 每份 spec 写入对应仓库的 `docs/spec/`，coding plan 写入 `docs/plan/`，报告写入 `docs/report/`。
- **大 PRD 先做垂直切片再拆仓**：当一份 PRD 含多个可独立交付的能力时，先按**垂直切片（INVEST：独立/可协商/有价值/可估/小/可测）**拆成一组 feature Issue，每个 Issue 带 Scope 锚点 + 参照的现有实现指针 + 约束护栏 + 测试信号，并标出 Issue 间依赖顺序与显式 out-of-scope；再对每个切片走 Overview→按仓 spec。切片尺寸控制在可 review 的粒度（约 3–8 文件/PR）。团队若有自己的 PRD 拆解规范，完整拆解方法以其为准。

### PR 流程
- 每个仓库从主分支建立独立任务 worktree；一个 coding plan 的任务对应小而可 review 的 PR。
- **开 PR 前先过代码评审门**（3 个并行子代理：规范/忠实/残留，见 `core/代码评审纪律.md`）。它是**地板不是天花板**：把 AI 能自查出来的问题挡在 PR 之前，让人审的注意力留给业务正确性与架构取舍，**不替代人审**。评审报告结论 SHOULD 附进 PR 描述。
- 团队 SHOULD 把死代码检查（`knip` / `vulture` / `staticcheck -checks U1000` 等）挂进 PR gate，作为替换清单核销的自动补充；工具链不具备时清单核销照做。
- PR 描述引用对应 spec / plan 任务号，附影响范围说明（为什么没扩大）。
- 保护分支仓库在审批与 CI 全部通过后启用平台自动合并；不得绕过保护分支直接写主分支。多仓需求全部就绪后再按依赖顺序合并。

### 文档治理
- 在 `core/文档治理.md` 之上，团队版额外维护：`docs/REQUIREMENTS.md`（PRD 唯一真相源，放 `docs/` 根）、`docs/ARCHITECTURE.md`（从属 PRD）、`docs/index.md`（现行口径发现层）、`docs/index-archive.md`（归档索引）。
- 影响产品范围的变更**先改 PRD**，再同步架构与 index。
- Overview / spec 写入 `docs/spec/`，plan 写入 `docs/plan/`，report 写入 `docs/report/`；创建时带 `lifecycle: active` 与 `authority_refs`，并同步更新 `index.md`。
- **索引分层是团队版硬要求**：`index.md` 只放 `lifecycle: active` 的文档，非 active 一律进 `index-archive.md`。团队仓库文档基数大、交接频繁，单层索引几年就长到没人读、AI 也读不完——分层是 `core/文档治理.md` §文档生命周期与索引门控的规定动作，不是可选优化。
- **需求准出时归并 PRD**（Step 10 之后）：本次需求若有变更 PRD、或改变了用户旅程 / 成功指标 / 能力状态，把口径变化归并回 `REQUIREMENTS.md`——含旅程叙事回填，不能只翻 Scope 状态位；变更 PRD 标 `lifecycle: merged`、加归档头注并移入归档索引（详见 ai-prd skill §PRD 生命周期）。
- **准出同时结算文档生命周期**：按 `core/worktree开发纪律.md` §完成与自动合并门，拿本次替换清单比对各文档 `authority_refs`，命中的逐篇判定去留。

## 2. Engineering Context 日常用法（关键）

团队仓库"历史包袱重、文档差"，AI 直接 grep 会读到旧代码/中间产物。所以：

- **调用方式**：`ctx` 未全局安装时，用 `node <本skill路径>/scripts/ctx/src/cli.js <命令>` 运行；或一次性 `cd <本skill路径>/scripts/ctx && npm link` 后直接 `ctx <命令>`。命令清单与输出格式见 `scripts/ctx/README.md`。下文简写为 `ctx`。
- **凡涉及"这个能力对应哪个仓库/接口""跨服务影响面""哪个是权威实现"的问题，先用 `ctx`**，不要 grep。
- **术语说法不一致时查 `engineering-context/glossary.md`**（领域词汇表）：glossary 管说法一致，card 管事实权威，registry 管能力落点；发现"同一实体多种叫法"造成误会时提示 owner 补词条（见 `context-engineering.md` §2.4）。

- **★ 业务全景门限（排序铁律）**：**除非用户明确把任务限定到某一个具体 repo / 服务 / 代码路径**，否则**第一步必须先 `ctx find-scenes <关键词>` 取端到端业务全景，再据此收窄到具体 card / 源码**。跨服务需求跳过全景直接钻单个 card，最常见的失败就是漏掉链路上的其它服务。提取 2–5 个高置信关键词（需求名、业务入口、核心动作）喂给 find-scenes。
  ```bash
  ctx find-scenes 作业辅导 错题 重练          # ← 未限定单仓时先跑这个，取端到端全景
  ctx discover "给作业辅导加错题重练入口"      # 意图 → 应加载的 card 清单 + out-of-scope 警告
  ctx get-card <repo> [域]                     # 收窄后取某仓 Codebase Card
  ctx list-services                            # 已登记仓库/能力
  ```
  > 注意：`ctx find-scenes` 返回的是**场景蓝图指针**（scene 名 + 命中分 + 路径），本身不直接给"涉及哪些服务"。你从蓝图正文里读到 / 推断出的涉及服务，都是**推断**，必须逐个用 `ctx get-card` 核实到权威 card 才能当事实用。
  > discover 会随命中结果给出 **out-of-scope 警告**（哪些是废弃/中间产物、别当权威用），这些警告要抄进 Step 1 的〈既有系统清单〉，并在 Step 2 的 A 核查里逐条确认。
- **每条来自 card 的事实（接口名、字段、topic、RPC 签名）必须附 cite**（path + anchor + 最近确认时间）。无 cite 的接口/字段一律视为幻觉，回查。
- **检索纪律**：查**精确 token**（字段名/接口名/表名）时优先用精确匹配（`ctx get-card <repo> <域>`、grep card 正文），不要只靠 `ctx search-semantic`；**语义检索结果只作"去哪找"的索引，不能当最终事实直接引用**——命中后仍要落到权威 card 段并附 cite。card 没有独立的 README 段，服务级 README 信息（部署/排障/路径）已并入 card 的对应节。
- **card 不够用、必须读真实源码时（clone 决策树）**：以下属工程侧内部取证；向用户只说明正在核对哪项业务事实及其影响，不报告仓库、类、方法等程序细节，除非用户明确要求。
  1. **先穷尽文档路径**——接口签名/字段去 card 的"对外接口"段；部署/配置/排障去 card 对应段；跨服务流程去 `ctx find-scenes`。以上都不够，才真正 clone。
  2. **clone 前**：工程侧先明确要看哪个仓、为什么要看源码、要核对的具体事实；**若没有 repo 地址，向工程 owner / 用户索取，不要凭服务名猜 git URL**；用 `git clone --depth=1 <url>` 浅克隆到一次性临时目录，别污染工作区。
  3. **clone 后**：**不要全仓 grep**——按 card 的"业务域 Card Index（哪个文件做什么）"按图索骥；读完把关键发现回写（哪个模块做了什么、哪条规则在哪落地），让后续 agent 不用重新 clone；对用户仍保持业务语言。
  4. 发现 card 有缺漏（如新增接口没记进去），**提示工程 owner 补卡**，但**不要直接改 card**（改卡走刷新流程）。

## 3. 新鲜度纪律（每个开发者）

- 你的改动若**触碰权威面**（canonical 接口签名、废弃标记、路由/配置版本、DB schema、兼容窗口）——哪怕只有 3 行——都要触发对应 card 刷新（见 `context-engineering.md` §新鲜度）。
- 纯内部实现改动（不碰接口/权威）可不刷卡。
- 判断标准是**是否碰权威面**，不是改了多少行。
- **会话开始时先看增量**：`ctx` 读的是本地活文件，没有跨会话的变更推送。开一个新任务前，先 `git -C engineering-context log --oneline -20` / `git -C engineering-context diff <上次>..HEAD -- cards/ capability-registry.md`，看清"上次到现在 card/registry 变了什么"，避免拿脑子里的旧上下文干活（等价于在线 MCP 的 list_changes 变更感知）。

## 一句话

团队版 = `core` + 协作机制 + 一层"让 AI 读到正确代码"的 Engineering Context，用 `ctx` 而非 grep 供给权威事实。
