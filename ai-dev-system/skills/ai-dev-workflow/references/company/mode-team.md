# 团队版外壳（team mode）

> 加载条件：项目 mode = team。在 `core/` 之上，本文件定义"多人多项目（5~20 人、10~30 仓）"的协作约定与 Engineering Context 日常用法。Engineering Context 的完整设计见 `context-engineering.md`。

## 1. 协作约定

### 角色与澄清分工
- **需求细节 → 找产品**；**落地方案 → 找技术负责人**。别在 spec 里替对方拍板。
- 每个仓库有明确 **owner**；改动别人仓库前先对齐 owner。

### 评审会
- 跨 ≥3 仓的需求，**Step 2 出 Overview 后开评审会**，用 Overview 的"开放问题"一节驱动讨论，逐条冻结。
- 评审结论回写进 Overview 的"已定决策"表，避免每份 spec 重新吵。

### 按仓拆 spec
- 一个需求涉及多仓时，**按代码仓库划分 spec**，每个仓库一份，明确该仓做什么、不做什么、上下游契约。
- 每份 spec 写入对应仓库的 `docs/spec/`，coding plan 写入 `docs/plan/`，报告写入 `docs/report/`。

### PR 流程
- 一个 coding plan 的任务对应小而可 review 的 PR。
- PR 描述引用对应 spec / plan 任务号，附影响范围说明（为什么没扩大）。

### 文档治理
- 遵循团队 doc-governance：`docs/spec/REQUIREMENTS.md`（PRD 唯一真相源）、`docs/spec/ARCHITECTURE.md`（从属 PRD）、`docs/index.md`（发现层入口）。
- 影响产品范围的变更**先改 PRD**，再同步架构与 index。
- Overview / spec 写入 `docs/spec/`，plan 写入 `docs/plan/`，report 写入 `docs/report/`；创建后同步更新 index。
- **需求准出时归并 PRD**（Step 10 之后）：本次需求若有变更 PRD、或改变了用户旅程 / 成功指标 / 能力状态，把口径变化归并回 `REQUIREMENTS.md`——含旅程叙事回填，不能只翻 Scope 状态位；变更 PRD 加"已归并"头注转归档（详见 ai-prd skill §PRD 生命周期）。

## 2. Engineering Context 日常用法（关键）

团队仓库"历史包袱重、文档差"，AI 直接 grep 会读到旧代码/中间产物。所以：

- **凡涉及"这个能力对应哪个仓库/接口""跨服务影响面""哪个是权威实现"的问题，先用 `ctx`**，不要 grep。

- **★ 业务全景门限（排序铁律）**：**除非用户明确把任务限定到某一个具体 repo / 服务 / 代码路径**，否则**第一步必须先 `ctx find-scenes <关键词>` 取端到端业务全景，再据此收窄到具体 card / 源码**。跨服务需求跳过全景直接钻单个 card，最常见的失败就是漏掉链路上的其它服务。提取 2–5 个高置信关键词（需求名、业务入口、核心动作）喂给 find-scenes。
  ```bash
  ctx find-scenes 作业辅导 错题 重练          # ← 未限定单仓时先跑这个，取端到端全景
  ctx discover "给作业辅导加错题重练入口"      # 意图 → 应加载的 card 清单 + out-of-scope 警告
  ctx get-card <repo> [域]                     # 收窄后取某仓 Codebase Card
  ctx list-services                            # 已登记仓库/能力
  ```
  > 注意：find-scenes 若返回"推断涉及服务"，那是**推断**不是权威，仍需用 card 核实。
- **每条来自 card 的事实（接口名、字段、topic、Dubbo 签名）必须附 cite**（path + anchor + 最近确认时间）。无 cite 的接口/字段一律视为幻觉，回查。
- **card 不够用、必须读真实源码时**：明确告诉用户要 clone 哪个仓、找什么类/方法，`git clone --depth=1`，读完把发现回写，别全仓 grep。发现 card 有缺漏，提示补卡，但**不要直接改 card**（改卡走刷新流程）。

## 3. 新鲜度纪律（每个开发者）

- 你的改动若**触碰权威面**（canonical 接口签名、废弃标记、路由/配置版本、DB schema、兼容窗口）——哪怕只有 3 行——都要触发对应 card 刷新（见 `context-engineering.md` §新鲜度）。
- 纯内部实现改动（不碰接口/权威）可不刷卡。
- 判断标准是**是否碰权威面**，不是改了多少行。

## 一句话

团队版 = `core` + 协作机制 + 一层"让 AI 读到正确代码"的 Engineering Context，用 `ctx` 而非 grep 供给权威事实。
