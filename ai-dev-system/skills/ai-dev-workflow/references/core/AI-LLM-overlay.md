# AI / LLM 工作流 Overlay（core）

> 当需求包含 **AI/LLM 功能**（模型推理参与到功能行为），在基础 eng-spec 骨架之上**叠加**本 overlay 定义的 AI 契约。先按基础规范产出完整骨架，再补 AI 契约部分。

## 何时叠加：判定边界

**需要叠加**（模型推理参与功能行为）：生成、总结、分类、检索增强问答、排序/推荐、OCR、语音/手写识别、内容审核，或固定 prompt 工作流。

**判定层级**：

1. **模型只在确定性软件主导下辅助受限步骤** → 用本 overlay 即可。
2. **模型具备自主规划或直接产生状态变更**，命中下列任一即属 **AI Agent 主导场景**：
   - 模型做**开放式多步规划**；
   - 模型**直接调用工具 / 接口 / 数据库 / 脚本 / MCP server**；
   - 模型**未经确定性闸门**即创建 / 修改 / 删除 / 发送 / 审批 / **排程 / 购买 / 变更权限**；
   - **模型记忆跨会话影响未来决策**。

   → 本 overlay 之外还要补 agent 循环、工具契约、自主级别与审批闸门、记忆、轨迹可观测与 eval。Agent 主导再分两子档：
   - **给已有稳定 agent 加能力**（约 80% 的日常：新增 skill / tool / 配套服务，agent loop 不动）→ 采用"**继承 + 只写增量**"的写法：先写一份 **Inheritance Declaration**（声明从现有平台基线 as-built 继承什么，不重复），spec 只写新增的 Skill + Tools + Service，其余继承；并维护一份 **平台缺口清单（Gap Watchlist）**（如：无审批闸门、无 turn 上限、工具结果未筛查），在能力层顺手补齐已知缺口。工具类要写清 side-effect 分级与写操作保护、不可信工具输出的处理、预算/loop 交互。
   - **改 agent 平台核心**（改 loop、预算、可观测/eval 平台，或补基线缺口）→ 需要完整的 agent loop 状态机、Autonomy Levels & HITL 审批闸门、工具契约登记、轨迹级可观测与 trajectory eval。

   > **范围声明**：本 skill **不随包分发**完整的 agent 平台重型骨架（agent loop 状态机、Autonomy Levels 全表、trajectory eval 平台那套）——它高度贴具体平台，超出本体系"技术栈无关内核"的定位。真要做 agent 平台核心改造时，去团队的《Agent 能力扩展 eng-spec 指南》与《Agent 平台核心 eng-spec 指南》（在 doc-principles/eng-principles 下）取重型骨架，别在这份 overlay 里硬塞。但下面这份**平台无关**的最小 agent 契约（判定 + 继承声明 + 缺口清单 + 自主级别/审批闸门要点）本 skill 会给，足以覆盖"给已有 agent 加能力"的 80% 日常场景；"**声明继承、只 spec 增量、维护平台缺口清单**"这个思路对任何在既有 agent 上加能力的迭代都通用。

## 硬规则（不可协商，MUST）

以下四条是 AI 契约的地基，任何含 AI 的 spec 都 MUST 显式满足，不能只在表格里含糊带过：

1. **fail-closed（安全失败）**：安全检查失败时 MUST 抑制输出并走兜底，**绝不 fail-open**（不能因为拦截逻辑出错就把未审的模型输出放出去）。
2. **never-lose-work（不毁用户工作，编号安全不变量）**：一次失败 / 低置信 / 不安全的推理 MUST NOT 破坏或阻断用户正在进行的工作——任何推理失败都要保留用户输入与当前状态，给出可恢复的错误或兜底，不让工作流崩掉。
3. **变更必过 eval 才能上线**：prompt 或模型版本的任何改动都是行为变更，MUST NOT 未过 eval 质量门（AI.10/见下表）就发布。禁用 floating "latest" 模型别名，模型 ID/版本 MUST pin。
4. **预算是准入控制而非事后指标**：token/成本/限流 MUST 作为请求准入的第一道闸（超预算/功能关就早拒），而不是只在事后看报表。

## AI.1 确定性边界（Software-First，写进问题陈述）

每份 AI/LLM spec MUST 在**确定性控制面**与**模型建议面**之间画一条明确的线：

- **控制面拥有真相**：权限、工作流状态、校验、持久化、提交、审批、计入记录的评分、回滚——这些 MUST 由确定性代码决定。
- **模型只产出"输入"，永不产出最终契约**：任何模型输出 MUST 先过确定性校验（见下表"输出契约与校验"）才能影响状态。
- spec MUST 用一个**编号列表**写清"哪些决策 MUST NOT 依赖模型输出"。例：`计入记录的评分 MUST NOT 直接取自模型输出；模型只提议，由确定性规则或人来确认。`
- 在问题陈述里加一个 **AI Trust Boundary** 块：① 模型是建议方，确定性代码决定；② 调用成功也要先过输出校验才能改状态；③ 模型不可用/低置信时降级到已定兜底，而不是让用户的工作失败。

## AI.2 AI Capability Contract（每个 PRD Capability Card 一份）

PRD 里每个 material 的 AI 行为（AI Capability Card），spec MUST 定义一份对应的 **AI 能力契约**，并按名字/ID 可追溯回 PRD 卡。每份契约 MUST 写清：

- **能力 ID 与名称**（对齐 PRD）、**触发**（什么请求/事件调用它）。
- **输入（逻辑字段）**：每个送往模型的字段+类型+来源，标出哪些是 PII 及在边界如何最小化/脱敏。
- **输出契约**：系统要求返回的结构化 schema（不是散文）。
- **自主级别**：`suggestion-only`（仅建议）/ `assisted-action`（辅助动作）/ `controlled-automation`（受控自动）/ `high-impact-automation`（高影响自动）四选一。面向学习者/用户的行为默认 `suggestion-only` 或 `assisted-action`；`high-impact-automation` **MUST 命名人工监督闸门**。
- **人工控制**：人（用户/老师/运营）能覆盖、关闭、复核什么。
- **允许/禁止行为**：从 PRD 重述成尽量机器可校验的约束（如 `MUST NOT 含最终答案`，由安全管线强制）。
- **兜底**：指向降级路径。
- **风险级别**：`low`/`medium`/`high`，对齐 PRD。`high` MUST 把 eval 质量门作为**上线阻断项**。

> **给已有 agent 加能力时的最小契约**（不做平台核心改造，只新增 skill/tool）：至少写清每个新工具的**自主级别**与**审批闸门**（哪些写操作/高影响动作必须过人工或确定性确认）、不可信工具输出的处理、预算/turn 上限交互；再加一份 **Inheritance Declaration**（继承平台基线什么）+ **Gap Watchlist**（无审批闸门/无 turn 上限/工具结果未筛查等已知缺口）。这就是本 skill 对 agent 场景给到的平台无关下限。

## AI 契约清单（叠加到 spec）

在基础 spec 的相应章节补充以下内容，每项都要写到可执行、可验证（呼应上面四条硬规则）：

| 契约项 | 要写清什么 |
|---|---|
| **模型 / prompt 版本化** | 用哪个模型（含 ID，MUST pin、禁 latest）、推理参数（temperature/top_p/max_tokens/stop/JSON-mode）、prompt 存哪+如何版本化（版本串/哈希，随每次推理记录）、如何回滚、哪些变更必须重跑 eval |
| **推理请求生命周期** | 有序序列：① 准入（authn/authz + 功能开关 + **预算预检**，超预算/关则早拒）→ ② 入参组装+**PII 最小化/脱敏**+输入安全过滤 → ③ 渲染 pinned prompt → ④ 带命名超时调模型 → ⑤ 输出校验 → ⑥ 置信度路由 → ⑦ 安全过滤 → ⑧ 落审计+返回。**区分可重试（timeout/429/5xx）与不可重试（校验失败→兜底、鉴权失败→fail）**；给并发/限流公式与退避闭式+最大重试上限；枚举边界（超时、429/5xx、输出畸形、安全不过、低置信、部分流、飞行中超预算、模型下线）|
| **输出契约与校验** | 期望输出结构（JSON schema / 字段/枚举/范围/跨字段不变量），优先结构化输出；schema 违规处理写清**有上限的 re-ask（写明上限）vs 立即兜底**；自由文本仍要过确定性内容检查（如 `MUST NOT 含最终答案`、阅读级别、长度）；**校验失败的输出 MUST NOT 以有效面目触达用户，一律走兜底** |
| **置信度路由** | 置信度→动作的表（Above/Below/Failure 三档）；**置信度来源**（模型分/校准代理/`不可用`）；阈值做成可调 config；needs-review 由谁在哪审；**无置信度信号时默认走更保守分支** |
| **安全管线** | 输入注入/越狱防护（不可信文本 MUST NOT 覆盖系统指令）；输出逐条命名检查（违禁内容/最终答案泄漏/PII 索取…）；升级路径（含未成年→"找可信成人/转人工"）；**安全失败 MUST fail-closed**；每个 verdict 给机器可读码（如 `safety_answer_leak`/`safety_injection_detected`）供日志/指标/测试 |
| **降级回退** | 已审核兜底内容 + 手动/无 AI 路径；**never-lose-work 不变量**（推理失败不毁用户在途工作）；显式列降级触发器（provider down/超时/超预算/输出无效/低置信/安全拦截/开关关/离线）|
| **成本 / token 预算** | 单请求限额（max 输入 token+截断规则、max 输出 token、超时）+ 用户/租户/全局预算；**预算耗尽是确定性准入规则（拒/排队/降级）而非事后指标**；429→退避→兜底映射；token/成本记账与去重公式 |
| **eval 质量门** | 区分**确定性一致性**（准入/校验/路由/兜底/安全接线/预算，须精确测）与**统计性一致性**（模型质量，跑 eval 集）；eval 集切片枚举（年龄段/课纲/误解案例/注入越狱/有害/隐私泄漏/偏见/多语言）；每指标数值上线线；**prompt/模型变更必过 eval 才能上线**；skipped 必须报 skipped，不算 passed；`high` 风险 launch-blocking |
| **可观测性** | 每次推理必记：`capability_id`、`prompt_version`、`model_id`+参数、`request_id/trace_id`、输入/输出 token 数、`latency_ms`、`confidence`（或 `not_available`）、`safety_verdict`、`outcome`（served/served_fallback/needs_review/suppressed/error）+原因；日志体 PII 脱敏、MUST NOT 记密钥/完整凭证 |
| **数据 / 训练边界** | 哪些数据能进 prompt、能否用于训练（**未成年数据默认 MUST NOT**）、脱敏要求、留存期（无限期留存不可接受）、区域/合规路由 |
| **可审计性** | 关键决策可复现（保留 prompt 版本+输出+快照的审计元组）；写明存储与留存期；assisted-action 及以上需操作者可见的审计轨（非比特级复现，但足以解释"为什么这样做"）|

## 与基础 spec 的关系

- 不要另起一份"AI spec"；**叠加**进同一份 eng-spec 的对应章节（如"接口契约"里补输出校验，"降级"里补模型不可用兜底）。
- 用 `references/core/spec写作纪律.md` 的纪律：AI 契约同样不许占位符，阈值、上限、指标都写具体数值。
