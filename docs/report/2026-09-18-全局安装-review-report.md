---
lifecycle: active
superseded_by: ''
archived: ''
last_confirmed: '2026-09-18'
authority_refs:
  - '无'
---

# 全局安装 · 代码评审门报告

**对象面：P + K（改动含 `docs/`）| 轴集合：{A, B, C, D, S} | 档位：普通档（三组子代理，按参照物分组：A/B/C 一组、D 一组、S 一组）| 各轴 P0 计数：A=0, B=0, C=0, D=0, S=1 | 结算积压：无（范围另含此前未经评审合入的 a5965bd、3683a53，无 `Review-Deferred:` trailer）**

评审范围：`git diff 0f98b25...HEAD`（`reviewed-through` tag）。本次新增 CLI 参数 `--global`，命中〈禁止积压清单〉第③类，当场跑。spec：`docs/spec/2026-09-18-dw-system-全局安装-eng-spec.md`。修完后重跑了 B、D、S 三轴。

另做了 Windows 实机验证（10.14.0.60）：`test/install-global.test.mjs` 15/15；全量 492 条中失败 4 条，与 `docs/TODO.md` 登记的四条 npm 既有失败逐条相同。

## 规范轴（A）

P0=0 / P1=0 / P2=1。

| # | 严重度 | 位置 | 问题 | 处置 |
|---|---|---|---|---|
| 1 | P2 | `test/install-global.test.mjs` 并存提示用例 | 断言写死版本号 `3.0.0` | 已修：按 `dw-system/VERSION` 现场取 |

## 忠实轴（B）

覆盖矩阵：FR-001～FR-012 均有任务覆盖，无不对应需求的任务。

| # | 偏离类型 | 严重度 | 位置 | 问题 | 处置 |
|---|---|---|---|---|---|
| 1 | 漏做 | P1 | `CHANGELOG.md` `## 未发布` | §8.1 拍板"不兼容"的标记块改写被写进 `变更`，`不兼容` 为空 | 已修：移入 `不兼容`，旧 / 新 / 迁移三项齐全 |
| 2 | 做一半 | P1 | 同上（复核） | "新"一栏未跟上 S 轴修复后的标记块实文 | 已修 |

## 残留轴（C）

替换清单三条（`companionDestDirs` 改名、内联迁移打印、ctx 函数签名）逐条核销，引用数为 0；无新死代码；卡片 `安装主干.md`、`外部工具接线.md` 已补。本轴无发现。

## 文档轴（D）

| # | 严重度 | 位置 | 问题 | 处置 |
|---|---|---|---|---|
| 1 | P1 | `docs/spec/2026-08-16-ctx全局命令安装-lean-change-spec.md` 影响范围 / 不做什么 | "不做用户级独立副本"与 `--global` 冲突 | 部分失准，就地更正并括注当时口径，`authority_refs` 与 `last_confirmed` 同步 |
| 2 | P2 | `docs/TODO.md` 全局 `ctx` 失效风险条目 | 未提 `--global` 的情形 | 已补一句 |

`REQUIREMENTS.md` §安装器 已随本分支归并。

## skill 原则轴（S）

| # | 严重度 | 位置 | 问题 | 处置 |
|---|---|---|---|---|
| 1 | P0 | `dw-workflow/assets/config-snippets/base.md` | 为压体积删了具体路径后，`<skills 目录>` 无处定义，ctx 兜底命令不可执行 | 已修：改用全树统一的 `<skills 根>`，指向 `dw-code-facts`；复核发现该入口只定义深一层的 `<本 skill 根目录>`，再补"即 `<skills 根>/dw-code-facts/`"挂钩 |
| 2 | P1 | `代码事实纪律.md`、`00-prd生成流程.md` 的"写死一侧"反例 | 只覆盖 Claude / Codex 维度 | 已修：覆盖项目级 / 全局 |
| 3 | P2 | `dw-code-facts` 各处列具体路径，`dw-workflow` / `dw-prd` 各处只写"各有一份" | 详略不一 | 不改：`dw-workflow` / `dw-prd` 受体积上限约束，两种写法都能按"`SKILL.md` 所在目录的父目录"还原路径 |

体积：`base.md` 压回 5499 / 5500 字节，未抬上限。
