---
lifecycle: active
superseded_by: ''
archived: ''
last_confirmed: '2026-08-27'
authority_refs:
  - 'ui-prototype.html ANNO-FRAMEWORK:CSS 区 [data-anno-host] 与 .anno-pin 的定位与层级规则'
  - 'ANNO-FRAMEWORK:JS 区 attach() 施加 data-anno-host 的条件'
  - 'UI原型纪律.md §8.4 自定义样式对 z-index 的取值上限约定'
---

# Lean Change Spec（一页）— 批注框架不再改写绝对定位元素，图钉不再被裁切或遮挡

> 用于 Triage 4 问全否的小改动。这一页就是唯一交付物，写完直接实现。

- **Issue / 链接**：`docs/report/2026-08-27-ai-prd-批注框架缺陷报告.md`
- **Owner**：weidwonder（协作面 solo）
- **写作进度**：Done
- **Triage 复核**：AI/LLM 行为？否 鉴权/安全/设备？否 跨服务/迁移/不可逆？否 指标/规则/对外承诺？否
  - borderline 说明：第 4 问拿不准过一轮——批注框架是「原型批注框架是跨文件的契约」的一部分，但本次只修被判定为缺陷的行为（定位改写、图钉不可见），**不改契约语义**（分三层的注解归属、`data-anno` / `data-anno-user` 的表达方式、`prd-annotations@1` schema 一律不动），故倾向"否"。

## 改什么（现状 → 期望）

现状：批注框架无条件给被批注元素加 `data-anno-host`，其 CSS `position: relative` 与作者的 `position: absolute` 同权重且排在后面，把绝对定位元素打回文档流；图钉又定位在元素**外侧**且 `z-index: 60`，会被 `overflow` 祖先裁掉、被兄弟元素盖住。期望：批注框架 MUST NOT 改变被批注元素本来的定位，图钉在任何容器里都可见。

**本次功能需求**：

- FR-001 —— 被批注元素本来不是 `static` 定位时，批注框架 MUST NOT 改变它的定位方式；批注前后该元素的渲染位置逐像素相同。
- FR-002 —— 被批注元素处在 `overflow: auto | hidden` 的祖先容器内时，图钉 MUST 完整可见、MUST NOT 被该容器裁切。
- FR-003 —— 图钉的层级 MUST 高于原型自定义内容，同时 MUST 低于批注框架自身的工具栏、设计说明面板、弹窗与拾取光标，MUST NOT 遮挡它们。
- FR-004 —— 上述三条 MUST NOT 改变批注的数据表达：`data-anno` / `data-anno-kind` / `data-anno-user` / `data-anno-id` 的语义与 `prd-annotations@1` schema 一律不变，存量原型里已写下的批注仍能被 `annotations` 命令原样读回。

## 为什么

含**绝对定位画布**（拓扑图 / 流程图 / 座位图）的原型一打批注就错位，作者会误判成自己布局写错、反复调坐标（缺陷报告记录本次真实发生过一轮）；图钉被裁掉时用户以为批注没保存成功，可能重复提交或干脆放弃使用批注功能。两者都不报错、都得靠踩一遍才知道，属于框架侧必须消化掉的知识。

## 具体改动点

- `ai-dev-system/skills/ai-prd/assets/templates/ui-prototype.html:1423-1440`（`attach()`，行号为改后坐标）—— 只有 `getComputedStyle(host).position === "static"` 时才加 `data-anno-host`；图钉的水平偏移改为贴内侧。
- `ai-dev-system/skills/ai-prd/assets/templates/ui-prototype.html:710`（`[data-anno-host="rel"]`）—— 规则本身保留，注释写明它只作用于本来是 `static` 的元素。
- `ai-dev-system/skills/ai-prd/assets/templates/ui-prototype.html:712-735`（`.anno-pin`）—— `top: -6px` → `top: 2px`（贴内侧，`overflow` 裁不掉）；`z-index: 60` → `880`。
- `ai-dev-system/skills/ai-prd/references/UI原型纪律.md` §8.4 —— 补两条：自定义样式的 `z-index` MUST NOT ≥ 880（880 起是批注框架自留层）；绝对定位控件可以直接写进 `custom` 插槽，框架不会改写它的定位。
- `engineering-context/cards/ai-dev-system.md#原型容器（ui-prototype.html）` —— 对外接口补批注图钉的定位与层级契约，陷阱项补 z-index 上限。
- `test/prototype-annotations.test.mjs` —— 新增本次三条不变式的机器闸。

## 影响范围 / 不做什么

- 影响：只影响 `ui-prototype.html` 容器的 `ANNO-FRAMEWORK` 固定实现区，以及此后由 `preview.mjs init` 新建的原型。
- **不做**：不给存量已产出的原型做框架区迁移（模板改动只对新 `init` 生效）；不动注解分三层的归属规则、`setScreenState` 契约、`serve` 的版本校验与写回链路；不实现缺陷报告里的修法 C（body 覆盖层）——它要处理滚动、resize 与 `serialize()` 剥离，改动量与退化风险都超出 Lean 的边界，且 A+B 已覆盖除"祖先建立了层叠上下文"外的全部场景。
- 关键 NFR：零外部资源不变（本次只改 CSS 取值与一处 JS 条件判断，不引入任何资源）。
- 既有系统清单：
  - `ui-prototype.html` 的 `ANNO-FRAMEWORK:CSS` / `ANNO-FRAMEWORK:JS` 固定实现区 —— 出处：`cards/ai-dev-system.md#原型容器（ui-prototype.html）` @2026-08-27
  - `serialize()` 剥运行时状态时移除 `data-anno-host` —— 出处：`ui-prototype.html:1079`
  - 框架自身的层级序列 bar 900 / notes-panel 890 / pop 1000 / cursor 1100 —— 出处：`ui-prototype.html:654,676,741,805`
  - `preview.mjs` 的 `check` 固定区校验 —— 出处：`cards/ai-dev-system.md#原型工具（preview.mjs）` @2026-08-27
- 本次补的卡片：`engineering-context/cards/ai-dev-system.md#原型容器（ui-prototype.html）`（补图钉定位与层级契约；该域已存在，本次是补充而非新建）

## 兼容取舍（用户拍板，定稿前必填）

- **图钉从元素外侧移到内侧** —— 谁在依赖：所有已产出原型的视觉观感（图钉会压住被批注元素右上角一小块内容，而不是浮在其外）—— 用户决定：不兼容（直接改，不留开关）—— 确认于 2026-08-27
- **图钉 z-index 由 60 提到 880** —— 谁在依赖：作者在 `custom` 插槽里写了 `z-index` 介于 60 与 880 之间、原本能盖住图钉的自定义元素 —— 用户决定：不兼容（这正是缺陷 2 要修的行为），配套在 §8.4 写明自定义样式的取值上限 —— 确认于 2026-08-27
- **存量已产出的原型不做框架区迁移** —— 谁在依赖：已经在用的原型文件 —— 用户决定：不迁移，存量沿用缺陷报告里的作者侧临时规避；需要修好的重新 `init` 一份 —— 确认于 2026-08-27

## 替换清单（本次淘汰了什么）

| 被取代物 | 类型 | 取代者 | 处置 | 保留理由 + 到期日 |
|---|---|---|---|---|
| `attach()` 里无条件 `setAttribute("data-anno-host")` | 代码分支 | 按 computed position 判定后再加 | 删除 | — |
| `.anno-pin { top: -6px }` 外侧定位 | CSS 取值 | `top: 2px` 内侧定位 | 删除 | — |
| `.anno-pin { z-index: 60 }` | CSS 取值 | `z-index: 880` | 删除 | — |

## 验收标准（可判定，含边界/失败用例）

- [x] AC-001 用 `preview.mjs` 建一份含 `.canvas{position:relative} .dot{position:absolute;left:250px;top:120px}` 的原型，给 `.dot` 打一条批注并保存，重新载入后 `.dot` 的 `getBoundingClientRect()` 与打批注前逐像素相同 —— 满足：FR-001 —— **已跑**：headless Chrome 实证，修复前落在 `250,213`（错位 93px），修复后 `250,120`
- [x] AC-002 被批注元素本来是 `static` 时，仍被提升为 `relative`，图钉相对该元素定位（旧行为不回退）—— 满足：FR-001 —— **已跑**：`test/prototype-annotations.test.mjs` 锁取值与首枚判定守卫
- [x] AC-003 被批注元素处在 `overflow: auto` 的祖先内时，图钉的边界盒完整落在该祖先的裁切区内 —— 满足：FR-002 —— **已跑**：同一页面对比新旧偏移，旧偏移 `clipped: true`（超出 5px），新偏移 `clipped: false`
- [x] AC-004 `.anno-pin` 的 `z-index` 严格大于原型内容常用层级、且严格小于 `.anno-notes-panel`(890) / `.anno-bar`(900) / `.anno-pop`(1000) / `.anno-cursor`(1100) 四者 —— 满足：FR-003 —— **已跑**：机器闸按容器实际取值动态比对，两头都锁
- [x] AC-005 改动后 `annotations` 命令对一份带三类批注 + 回复的原型的输出与改动前逐字相同；`check` 全绿 —— 满足：FR-004 —— **已跑**：diff 未触碰 `ANNOTATIONS` 块与 `data-anno*` 语义，`check` 实跑 P0 0 条

## 如何验证

- [x] `node --test test/prototype-annotations.test.mjs test/prototype-preview.test.mjs` 全绿
- [x] `node --test test/*.test.mjs` 全量回归全绿（365 项）
- [x] 按缺陷报告 §最小复现 实跑两处复现，确认现象消失（复现用例加强过：原用例里被批注元素恰是画布首个子元素，两种定位下坐标巧合相同，掩盖了缺陷 1；补一个占位兄弟后才暴露 93px 错位）
- [x] **代码评审门**：派 1 个子代理跑 `references/core/代码评审纪律.md` §四条轴 的精简版（规范 / 忠实 / 残留 / 文档），P0/P1 修完才算过门。**结果**：P0 0 / P1 0，5 条 P2 已当场收掉。

## 回滚方式

`git revert` 本次提交即可——改动全部集中在模板的固定实现区与一篇纪律，无数据结构变更、无迁移动作。
