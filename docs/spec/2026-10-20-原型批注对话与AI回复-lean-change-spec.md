---
lifecycle: active
superseded_by: ''
archived: ''
last_confirmed: '2026-10-20'
authority_refs:
  - 'prd-annotations@1 数据块里 items[] 与 global[] 的 thread 字段、replies[] 的 by 字段、items[] 的 released 字段'
  - 'preview.mjs reply 子命令的参数与写入规则'
  - 'preview.mjs slot --agreed 的 done / void 处置语义'
  - 'preview.mjs annotations 输出里每条用户意见的处理状态'
  - 'UI原型纪律.md §7.3 批注块的写入方清单'
---

# Lean Change Spec（一页）— 原型批注变成对话：AI 回复用户批注

> 本文按 RFC 2119 解释规范词。

- **Issue / 链接**：N/A（拍板人在会话里提出，2026-10-20）
- **Owner**：weidwonder（协作面 solo）
- **写作进度**：Ready
- **Triage 复核**：AI/LLM 行为？否 鉴权/安全/设备？否 跨服务/迁移/不可逆？否 指标/规则/对外承诺？否
  - borderline 说明：`ctx discover` 打印了 out-of-scope 段，但列的是「原型工具」两项能力的既有陷阱项，本次的权威实现命中 `preview.mjs` 与 `ui-prototype-framework/` 本体（cite：`capability-registry.md#原型产出与改稿工具 @2026-09-17`），没有落在废弃或中间产物上，§默认倾向 判据 2 不命中；单仓单域，判据 1 不命中。

## 改什么（现状 → 期望）

现状：用户在原型上写的批注（元素批注、全局反馈、对 AI 说明的回复）是单向的。AI 处理后只能在对话里回话，原型上看不出哪条处理过、怎么处理的；改稿时约定为「已落实 / 作废」的批注被工具直接删掉。期望：每条用户意见下面挂一串对话，AI 用工具在原型里**追加回复**，用户在页面上**继续追加评论**；谁最后说话决定状态——AI 最后说话 = 已回复，用户最后说话 = 待处理。批注不再因处理而被删除。

**本次功能需求**：

- FR-001 —— AI MUST 能用 `preview.mjs` 的一条子命令，对一条用户元素批注、一条全局反馈、或一条用户对 AI 说明的回复所在的那串对话追加一条 AI 回复，写进原型文件；页面工具栏之外 AI 不经手工编辑就能写入。
- FR-002 —— 用户 MUST 能在页面上对任何一条自己的元素批注与全局反馈继续追加评论，并能修改、删除自己追加的评论；对 AI 说明的回复沿用现有入口。
- FR-003 —— 每串对话的状态由最后一条的说话方决定：最后是用户 → 待处理；最后是 AI → 已回复。只有用户原话、没有任何回复的批注算待处理。
- FR-004 —— `annotations` 命令 MUST 为每条用户意见给出状态与完整对话，并在开头给出待处理总数；`--json` 输出带同样的信息。
- FR-005 —— 页面上被 AI 回复过的元素批注图钉 MUST 与待处理的一眼可分；点开图钉看到原话 + 全部回复（标明是 AI 还是自己）+ 追加框。全局反馈面板里每条全局反馈同样能点开看对话、追加评论。
- FR-006 —— 改稿放行（`slot --agreed`）里约定为「已落实 / 作废」的批注 MUST NOT 再被删除：保留在文件里并记下处置；放行前该批注的最后一条 MUST 是 AI 回复（说明落实了什么 / 为什么作废），否则拒绝写入。这类批注界面元素已被改掉，`check` MUST NOT 再把它们报成失联 P0；页面把它们与真正失联的批注分开显示。
- FR-007 —— 页面写回撞上版本冲突时，AI 刚写进文件的回复 MUST NOT 被页面上的旧数据覆盖掉。
- FR-008 —— 落盘确认门之前，`annotations` 报出的待处理数 MUST 为 0：每条用户意见都已有 AI 回复（落实了什么，或"不改 + 一句话理由"）。

## 为什么

用户在原型上写完意见后，看不到 AI 对每一条做了什么，只能在对话记录里翻；改稿后批注还会被删掉，事后无从核对。把回复写在批注旁边，用户刷新页面就能逐条核对，不满意直接在原地接着说。

## 具体改动点

- `dw-system/skills/dw-prd/scripts/preview.mjs`
  - 新增 `cmdReply` 与子命令 `reply <文件> --to <id> (--text <文本> | --from <文件>)`：`u<n>` 落到 `items[]` 那条的 `thread`，`g<n>` 落到 `global[]` 那条的 `thread`，`a<n>`（AI 说明的 `data-anno-id`）落到 `replies[]`。`thread` 每条形如 `{id, by: 'ai' | 'user', text, at}`；AI 侧 id 前缀 `ai`，页面侧 id 前缀 `me`，`replies[]` 里 AI 侧 id 前缀 `ar`——两侧前缀不同，冲突合并按 id 取并集时不会互相顶掉（解决 FR-007）。目标不存在、文本为空、`a<n>` 上还没有任何用户回复，一律拒绝并退出 1 / 2。写入复用 `replaceAnnoBlock` 与 `writeAtomic`；写前重读一次文件比对，不一致则按新内容重算一次再写。写完打印"预览页开着的话请用户刷新"。原型的 `ANNO-FRAMEWORK:JS` 区不认识 `thread` 时（早于本版生成的原型），照写并打印一句"这份原型的页面看不到 AI 回复，只能用 annotations 看"。
  - `cmdAnnotations`：每条 `items[]` / `global[]` 输出状态与 `thread`；`replies[]` 按说明分组输出说话方；开头一行"待处理 N 条"。JSON 里 `items[]` / `global[]` 每条加 `status: 'pending' | 'answered'`，`ai[]` 里有用户回复的说明加同名 `status`，`replies[]` 每条补 `by`（缺省 `'user'`）。
  - `cmdSlot` 放行段：`done` / `void` 不再从 `items[]` 删条目，改为写 `released: 'done' | 'void'`；放行前校验这些条目的最后一条是 AI 回复，否则拒绝并列出缺回复的条目。等值不变式的期望值同步改为"这些条目加上 `released` 字段"。
  - `cmdCheck` 失联判定：带 `released` 的条目不报 P0。
  - `HELP` 与 `main` 的子命令表加 `reply`。
- `dw-system/skills/dw-prd/assets/templates/ui-prototype-framework/anno.js`：用户图钉点开改为对话浮层（原话可改可删、回复列表、追加框，追加 / 编辑走与 `setEditing` 同形的单一进出函数）；全局反馈面板每条可点开同一个对话浮层；图钉按状态区分；`adoptLatest` 合并时 `items[]` / `global[]` 的 `thread` 按 id 取并集再按时间排序；失联列表把带 `released` 的条目单独标"已落实 / 已作废"；工具栏计数加"待处理 N"。
- `dw-system/skills/dw-prd/assets/templates/ui-prototype-framework/anno.css`：对话浮层里 AI / 用户两种消息的样式、已回复图钉的样式。
- `dw-system/skills/dw-prd/references/UI原型纪律.md` §7.1 / §7.3 / §7.7 / §8.1 / §8.5、`references/00-prd生成流程.md` §组稿 第 4 / 6 步、`references/prd质量清单.md`、`SKILL.md` 目录树：写入方从两个变三个（加 `reply`）；处理一条批注 MUST 用 `reply` 留下回复；落盘确认门前待处理数 MUST 为 0；放行的 `done` / `void` 保留不删。三份文件在 `test/doc-budgets.json` 冻结在实测值，新增文字靠同文件内按 `dw-prose` 压缩抵消，不抬上限。
- `test/prototype-preview.test.mjs`、`test/prototype-annotations.test.mjs`：新增与改写的用例见验收标准。
- `docs/REQUIREMENTS.md` 原型一节、`engineering-context/cards/dw-system/原型工具.md`、`engineering-context/capability-registry.md` 的子命令数、`CHANGELOG.md`。

## 影响范围 / 不做什么

- 影响：`dw-prd` 的原型工具、批注框架、与之对应的纪律文本。
- **不做**：不给 AI 说明（`data-anno` 气泡）本身加对话——它的回复入口已有；不做"未读 / 已读"、通知、@ 提及；不让用户手动把批注标成已处理（用户不满意就追加，满意就不动）；不给已生成的原型换框架（`docs/TODO.md` 的技术欠账，另案）；不改 `dw-workflow` 下游读原型的方式。
- 既有系统清单：
  - 批注数据块 `prd-annotations@1` 与 `replies[]` —— `cards/dw-system/原型工具.md#权威实现与对外接口`（取批注行）@2026-09-17
  - 放行契约 `--agreed --agreed-plan`，`done` / `void` 删除条目 —— `dw-system/skills/dw-prd/scripts/preview.mjs:497`（`changedData` 过滤）
  - 失联批注 P0 —— `dw-system/skills/dw-prd/scripts/preview.mjs:798`
  - 页面冲突合并 `mergeById` 以页面侧整条覆盖 —— `dw-system/skills/dw-prd/assets/templates/ui-prototype-framework/anno.js:185`
  - 用户图钉点开是"编辑原话"浮层 —— `dw-system/skills/dw-prd/assets/templates/ui-prototype-framework/anno.js:555`
  - 已生成原型不随框架升级 —— `cards/dw-system/原型工具.md#陷阱项` @2026-09-17
  - 批注块写入方只有页面工具栏与放行路径 —— `dw-system/skills/dw-prd/references/UI原型纪律.md` §7.3
- 本次补的卡片：`engineering-context/cards/dw-system/原型工具.md`（子命令、取批注、放行契约、写回方式四行与陷阱项随实现刷新）。

## 兼容取舍（用户拍板，定稿前必填）

- 放行里 `done` / `void` 的批注被删除 → 改为保留并要求先有 AI 回复 —— 谁在依赖：用 `slot --agreed` 改稿的 AI —— 用户决定：不兼容（"如前所述"）—— 确认于 2026-10-20
- `annotations` 的文字输出版式改变（加状态、对话、待处理总数）；`--json` 只增字段不删字段 —— 谁在依赖：读批注的 AI（`dw-prd` 各步、`dw-workflow` 下游读原型），子命令名与参数不变 —— 用户决定：不兼容 —— 确认于 2026-10-20
- 用户点自己的批注图钉，弹出的从"改原话"框变成"对话"框（原话仍可改可删）—— 谁在依赖：已习惯在原型上批注的用户 —— 用户决定：不兼容 —— 确认于 2026-10-20
- 本版之前生成的原型：页面框架是当时烤进文件的，不认识 AI 回复 —— 谁在依赖：手里已有原型且还在过稿的用户 —— 用户决定：工具照写，页面上看不到、`annotations` 看得到，写入时提示一句 —— 确认于 2026-10-20

## 过稿记录（拍板人表态，开始实现前必填）

- 2026-10-20｜已定稿｜改什么 / 不做什么、FR-001～008、兼容取舍四条与本页同一批摆出，拍板人逐条选定并整体认可

## 替换清单（本次淘汰了什么）

| 被取代物 | 类型 | 取代者 | 处置 | 保留理由 + 到期日 |
|---|---|---|---|---|
| `cmdSlot` 放行段里 `done` / `void` 从 `items[]` 过滤删除的分支 | 函数逻辑 | 写 `released` 字段 | 删除 | — |
| 用户图钉的"编辑原话"浮层 `openEditor` | 函数 | 对话浮层 | 删除（改原话并入对话浮层）| — |
| `adoptLatest` 里对 `items[]` / `global[]` 的整条覆盖合并 | 函数逻辑 | 带 `thread` 并集的合并 | 删除 | — |
| 纪律里"批注块写入方只有两个"的表述 | 规范文本 | 三个写入方 | 删除 | — |

## 验收标准

- [ ] AC-001 对 `u1` 跑 `reply --to u1 --text X` → 文件里 `items[u1].thread` 末尾多一条 `by: 'ai'`；`annotations` 显示该条为已回复，原话不变 —— 满足：FR-001、FR-003、FR-004
- [ ] AC-002 对 `g1` 同上，落到 `global[g1].thread` —— 满足：FR-001
- [ ] AC-003 对已有用户回复的说明 `a1` 跑 `reply --to a1` → `replies[]` 多一条 `by: 'ai'`、id 以 `ar` 开头，带说明快照字段；`ai[]` 里 `a1` 的 `status` 为 answered —— 满足：FR-001、FR-004
- [ ] AC-004 失败路径：`--to` 指向不存在的 id、文本为空、`a<n>` 没有任何用户回复、文件不是原型 → 退出非 0，文件字节不变 —— 满足：FR-001
- [ ] AC-005 用户在 `thread` 末尾追加一条 `by: 'user'` 后，`annotations` 把该条报为待处理，开头的待处理总数随之加 1；无任何回复的批注也计入待处理 —— 满足：FR-003、FR-004
- [ ] AC-006 页面框架：用户图钉点开出现原话、回复列表（AI 与自己可区分）、追加框；追加、修改、删除自己的追加评论都写进 `thread`；已回复的图钉与待处理的样式不同；全局反馈面板每条可点开对话 —— 满足：FR-002、FR-005
- [ ] AC-007 冲突合并：磁盘上 `u1.thread` 有一条 AI 回复，页面内存里同一条只有用户追加的另一条，`adoptLatest` 合并后两条都在、按时间排序 —— 满足：FR-007
- [ ] AC-008 `slot --agreed --agreed-plan=u1=done`：`u1` 最后一条是 AI 回复 → 写入成功，`u1` 仍在 `items[]` 且 `released: 'done'`；`u1` 没有 AI 回复 → 拒绝写入、列出 `u1`、文件不变 —— 满足：FR-006
- [ ] AC-009 放行后 `check` 不把 `released` 的条目报 P0；同一文件里一条未放行就丢了锚点的条目仍报 P0 —— 满足：FR-006
- [ ] AC-010 对旧框架的原型跑 `reply` → 照写成功并打印"页面看不到"的提示—— 满足：FR-001
- [ ] AC-011 `00-prd生成流程.md` 落盘确认门一步与 `prd质量清单.md` 写明待处理数 MUST 为 0，`UI原型纪律.md` §7.3 列出三个写入方 —— 满足：FR-008

## 如何验证

- [ ] `node --test test/*.test.mjs` 全绿（含新用例与 `doc-budgets`、`cross-reference` 两道闸）。
- [ ] 手工：`init` + `screen` + 一条带 `data-anno-user` 的片段建临时原型，往批注块放一条用户批注，跑 `reply` / `annotations` / `slot --agreed` / `check` 走一遍；`serve` 起来用浏览器点开图钉看对话、追加一条再跑 `annotations`。
- [ ] **代码评审门**：对象面 = 程序代码面 + skill 文档面 + `docs/`，轴集合按 `dw-review-gate` 的 `评审门禁.md` §门禁 推导，派子代理，P0/P1 修完。

## 回滚方式

整个分支 revert；数据层只增字段，回滚后旧工具读新文件时多出的字段被忽略，已写下的 AI 回复留在文件里不影响打开。
