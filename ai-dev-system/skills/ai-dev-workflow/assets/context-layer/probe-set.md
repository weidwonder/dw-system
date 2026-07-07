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
