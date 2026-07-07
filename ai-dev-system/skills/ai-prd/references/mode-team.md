# 团队版外壳（mode-team）

> 多人多项目。PRD 要能被评审、被后续按仓拆 spec。核心增量：**现状接 ctx 供给可信代码事实** + **文档治理落位** + **评审门**。

## 现状接 Engineering Context（批 B 的关键）

写"现状/当前逻辑"和"不改的线上逻辑"时，**不靠口述、不 grep 旧代码**：

1. `ctx find-scenes <关键词>` —— 除非任务已限定到单一 repo，先取端到端业务全景，避免漏跨服务链路。
2. `ctx discover "<意图>"` —— 收窄到应加载的 card 清单（带 out-of-scope 提示）。
3. `ctx get-card <repo> [域]` —— 取该仓权威事实（职责/对外接口/上下游/废弃标记）。
4. 用取到的事实**预填现状草稿**，每条附 cite（`path#anchor @确认时间`），再请用户确认/纠偏。

> 若某能力未登记（discover 无命中）→ 提示可能需补 card / capability-registry，别凭空写现状。

## 真相方向铁律

- 现状 = **代码事实**（带 cite）；目标/愿景 = **意图**。二者分区，**不得把意图写成现状**。
- PRD 意图与代码事实冲突（典型："PRD 说可复用，代码发现不可复用"）→ 标为**待人工复核**，进开放问题清单，不替产品拍板。

## 文档治理落位

- PRD 写入 `docs/`；影响产品范围的以 PRD 为唯一真相源。
- 变更 PRD → `docs/<name>-PRD-YYYYMMDD.md`；整品 → `docs/REQUIREMENTS.md`。
- **创建后必须同步更新 `docs/index.md`**（doc-governance 强制规则）。

## 评审与衔接

- 跨 ≥3 仓 / 影响面不清的需求，PRD 的"开放问题"要足够详细，供评审会逐条对齐。
- 定稿后作为 `ai-dev-workflow` Step 1 输入；跨仓需求接着出 Overview（Step 2）。
