# 【功能名】Coding Plan

> 把 spec 拆成"执行者对代码库零上下文"也能做的 bite-sized 任务。每步一个动作（2–5 分钟）。DRY / YAGNI / TDD / 勤 commit。
> 执行：按流程总纲 Step 7，逐任务"加载→批判性 review→实现→跑验证→commit"，每 2–3 个任务过一次 checkpoint。（若环境装了 superpowers，也可用其 executing-plans / subagent-driven-development，但本流程不依赖它。）

**Goal:** 【一句话，这个 plan 建成什么】
**Architecture:** 【2-3 句方法】
**Tech Stack:** 【关键技术/库】

---

### Task N：【组件名】

**Files:**
- Create: `【精确路径】`
- Modify: `【精确路径:行】`
- Test: `【测试路径】`

**Interfaces:**（供后续任务对齐命名/类型）
- Consumes: 【用到前面任务的什么，精确签名】
- Produces: 【后面任务依赖的函数名、参数与返回类型】

- [ ] **Step 1: 写失败测试**
  ```【lang】
  【真实测试代码】
  ```
- [ ] **Step 2: 跑测试确认失败** — Run: `【命令】` Expected: FAIL（原因）
- [ ] **Step 3: 写最小实现**
  ```【lang】
  【真实实现代码】
  ```
- [ ] **Step 4: 跑测试确认通过** — Run: `【命令】` Expected: PASS
- [ ] **Step 5: commit** — `git commit -m "【feat: ...】"`

---

### Checkpoint：Task X–Y 之后
- [ ] 全部测试通过
- [ ] 构建无误
- [ ] 核心链路端到端可用
- [ ] （团队版）需要人 review 后再继续

## Risks and Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| 【】 | 【H/M/L】 | 【】 |
