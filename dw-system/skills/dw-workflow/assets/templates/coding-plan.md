---
lifecycle: active          # active | merged | superseded | obsolete，见 dw-doc-governance 的 references/文档生命周期.md §1；plan 的常态是任务全部执行完并合入后、准出时转 merged（口径已落进代码）
superseded_by: ''
archived: ''
last_confirmed: ''       # 最近一次被权威面触发复核、判定仍准确的日期；新建时填当天
authority_refs:            # 本 plan 的 Interfaces 节冻结了哪些权威面
  - '【如：OrderService.create 签名】'
---

# 【功能名】Coding Plan

> 把 spec 拆成"执行者对代码库零上下文"也能做的 bite-sized 任务。每步一个动作（2–5 分钟）。DRY / YAGNI / TDD / 勤 commit。
> 输出：`docs/plan/YYYY-MM-DD-<feature>-coding-plan.md`。按 `步骤-1-7-设计与实现.md` Step 7 逐任务"加载→批判性 review→实现→跑验证→commit"，每 2–3 个任务过一次 checkpoint。
> **垂直切片**：每个任务是一条端到端细流（最小场景从入口到出口、可独立验证），不做水平分层（先全部模型再全部逻辑）；确需宽幅重构用"先扩后收"显式例外。任务间信息只通过本 plan 的 Interfaces 传递，不依赖会话记忆——上下文变重时在 checkpoint 处交给新会话/子 agent 从下一任务继续（见 `上下文卫生.md`）。
> **测试只挂稳定缝（seam）**：任务内的测试断言挂在 spec/接口契约上，不挂在预期会重构的内部实现上；禁止"用实现的算法重算一遍当预期值"的同义反复断言。

**Goal:** 【一句话，这个 plan 建成什么】
**Architecture:** 【2-3 句方法】
**Tech Stack:** 【关键技术/库】
**Worktree:** 【本次任务独立 worktree 的绝对路径】
**Task Branch:** 【任务分支】
**目标主分支:** 【从仓库配置识别的默认主分支】

---

### Task N：【组件名】

**Slice:** 【本任务打通的端到端细流一句话】 ｜ **依赖：**【Task M 的【产物】 / 无】

**满足:** 【本任务实现的 spec 需求编号，如 `FR-003, FR-007`；纯脚手架等确实不直接满足任何需求的任务写"无 —— 【理由】"】

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
- [ ] （合并方式为 `pr` 时）checkpoint 处按 PR 粒度切分，人审通过后再继续

## Risks and Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| 【】 | 【H/M/L】 | 【】 |

## 替换清单核销（来自 spec §8.2 / lean spec 替换清单）

> 删除动作要在上面的 Task 里成为**具体任务**（改哪个文件、删哪个符号），不写"最后统一清理"。本表在代码评审门的残留轴逐条核对。

| 被取代物 | 删除任务 | 实测引用数 | 核销 |
|---|---|---|---|
| 【`calcPriceV1()`】 | 【Task 4】 | 【0】 | 【✅ / ⏳ 保留至 YYYY-MM-DD】 |

## 完成与自动合并

- [ ] **代码评审门通过**：按 `dw-review-gate` 的 `评审门禁.md` §门禁 先判对象面算出轴集合，再按 `评审轴.md` §评审轴 逐轴跑；算出的那组轴的子代理报告齐全，P0/P1 已清零。本文件只在有可执行代码改动（命中程序代码面）时才产出，故轴集合至少含规范/忠实/残留/文档四条；改动同时含 skill 判据文档时另加 skill 原则轴。MUST NOT 按固定几条轴核对
- [ ] **需求覆盖核销**：spec 的每条 `FR-###` 都至少被一个 Task 的 `满足:` 引用（零引用 = 漏做），每个 Task 的 `满足:` 都指向 spec 里真实存在的编号（指不到 = 镀金，MUST 补进 spec 或删掉该任务）
- [ ] 替换清单逐条核销：该删的引用数为 0 且已删，保留项带理由与到期日
- [ ] 需求范围、文档、代码和测试全部完成
- [ ] 任务分支已吸收最新目标主分支并重新验证
- [ ] worktree 状态干净，全部改动已提交
- [ ] （`merge-gate="pr"` 时）PR 已创建或更新，仓库要求的评审、持续集成、owner 或发布门禁全部通过
- [ ] 无需再次询问用户，自动把任务分支合并到目标主分支并运行合并后验证
- [ ] 合并成功后移除 worktree；失败则保留 worktree 和任务分支
