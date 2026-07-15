# Frozen Probe Set — 上下文层防腐检测题集

> 冻结、可自动打分、每个发布周期重跑的小评测集，专门检测 Engineering Context 是否**衰减**。与 Dogfooding（产品验证）互补——真实项目每次都变，不能当回归基线。
> 起步 40~50 题即可，随人工纠正不断补充（人工纠正 → 新 Probe 题 + card/registry 更新，闭环）。
> 种子题取自真实歧义案例，**有已知正确答案**。

## 题型与示例

| # | 题型 | 示例 | 期望答案 |
|---|---|---|---|
| 1 | Capability Mapping | 概念【背单词记录】→ 哪个 canonical service + 接口？ | 【权威服务/接口，并标出废弃替代】 |
| 2 | Deprecated / Intermediate Trap | 路由指向 V2，V1 是上次重构中间产物——V1 状态是？ | 【标为"中间产物，不可用"，既非旧亦非新】 |
| 3 | Version / Compatibility | 接口 X：05/29 发布前兼容、06/10 后不兼容——切点是？ | 【返回正确兼容窗口】 |
| 4 | Bugfix Context | 给 bug 描述与日志，定位调用链 | 【命中正确链路】 |
| 5 | Impact Radius | 给 diff，判断影响范围 | 【单模块/跨服务/跨仓】 |
| 6 | PRD-Spec Conflict | PRD 说"可复用" + 代码事实 | 【发现"假复用"冲突】 |

## 探针字段 schema（每题除"输入/期望"外，登记以下元字段）

`ctx probe` 已按下列元字段分级打分（不填按默认 `scored`/1/空）；在探针表加同名列即可生效：

| 字段 | 取值 | 用途 |
|---|---|---|
| `severity` | `blocking` / `scored`（默认）| `blocking`=零容忍（如废弃陷阱被当 canonical），一错即门禁 RED、基线不可豁免；`scored`=计入加权通过率 |
| `weight` | 数值（默认 1）| `scored` 题的权重；加权通过率不得低于地板（CLI 默认 0.9，低于即 RED），且相对上期的衰减会被报告 |
| `status` | 空（默认）/ `needs-reconfirm` / `quarantined` | 非空即**暂不计分**：`needs-reconfirm`=权威面已变、待重认；`quarantined`=已退役。门禁报告会列出待重认题数 |
| `authority_refs` | 指向依赖的权威面（card/registry 的 path#anchor）| 这题的"已知正确答案"是从哪条权威事实来的——自防腐的锚（见下）。当前仅登记用，自动联动见下 |

## 探针自防腐（authority_refs 与 needs-reconfirm）★ 别拿过期真相打分

探针的"已知正确答案"本身也是一种权威事实，会随代码演进过期。**拿过期真相打分，比没有评测更糟**——它会绿着脸掩盖上下文已经腐化的事实。所以探针集必须和 `context-engineering.md §5` 的**权威面触发**共用同一套刷新机制：

- 每题用 `authority_refs` 挂到它依赖的权威面（某接口签名 / 废弃标记 / 路由版本）。
- 当被挂的权威面发生变更（card/registry 刷新），把对应探针的 `status` 置为 **`needs-reconfirm`**：**暂不计入通过率**，等人重新确认它的"已知正确答案"是否还成立。（置位目前由刷新流程/人工执行；按 `authority_refs` 自动置位需接 CI hook，属后续工作。）
- 确认后恢复计分；确认发现该题已不再有意义则 **`quarantined`** 退役，并连同 card 一起更新。
- 门禁报告要显式列出 `needs-reconfirm` 的题数——一堆待重认的探针 = 评测可信度在下降，和衰减同等重要。

## 门禁自检（防"永远全绿"的假门禁）

每次跑全量探针**之前**，先注入一个已知必然失败的合成样本，断言门禁能抓到；抓不到 → 门禁失效，流水线红。

```
runProbeGate():
  plantKnownStaleEntity()        # 构造一个必然该被判错的样本（如把废弃接口标成 canonical）
  assert gate(sample) == FAIL    # 抓不到 → 门禁自身报废，先修门禁
  return gate(realProbeSet)      # 自检通过才跑真实探针
```

## 运行节奏
- 只在 **CI 发布 / 里程碑节点**运行，**不进 coding agent 的每轮 loop**。
- `ctx probe` 已可运行：机器可判题型（capability-mapping / deprecated-trap）+ 门禁自检 + 棘轮 + 衰减报告，`--json` 退出码供 CI 门禁（见 `scripts/ctx/README.md`）。"按权威面自动触发重扫"的 CI hook 仍待接。
