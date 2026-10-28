# dw-system/skills/ — 改 skill 文档的细则

改本目录下任何文件前读本文；动笔前 MUST 已加载 `skill-principle`（结构与触发）与 `dw-prose`（文字）。两条总纲与归属表在 `dw-workflow/SKILL.md`。本文不随 skill 分发：安装器只复制含 `SKILL.md` 的子目录。按 RFC 2119 解释规范词。

## 新增或拆分 skill

- 放进 `dw-system/skills/<name>/` 且含 `SKILL.md`，安装器自动发现并复制，不用改安装器。
- `dw-workflow/SKILL.md` 的〈到哪一步用哪个 skill〉MUST 点名它，〈归属表〉MUST 写明它管哪类事实。
- 入口开头一句话写"我管什么、相邻的事找谁"；每份 `references/` 文件 MUST 在入口的〈读取条件〉里出现，写明什么时候读。
- 发布前用 `./install.mjs <临时目录> --source-dir=.` 真装一次。

## 引用与锚点

- 小节标题是锚点。指针写成反引号包住的文件名加 `§` 加小节名，只有这个主形态受 `test/cross-reference.test.mjs` 核对小节（不带 `§` 的跨 skill 文件指针写成 `<skills 根>/<skill 名>/…​.md`，闸核对文件存在）；表格跨列、中间夹了散文、同文件内的裸 `§x` 都不受检——要让闸看得见就写主形态。
- 小节名以数字开头时闸只比序号；其余按"引用名与标题互为子串"判，标题自带的括号补充与冒号说明不必抄进引用。
- 改标题 MUST 同步全部引用方与测试里的切段锚点；删除、合并或搬走含规范词的小节 MUST 登记去向清单（`CLAUDE.md` §两条总纲）。
- 代码围栏里的标题（子代理 prompt 模板里的段落标题）不算小节，MUST NOT 被别的文件当锚点；要可引用就把它提成真小节。
- 为讲判据虚构的文件名登记进 `cross-reference.test.mjs` 的 `EXEMPT_TARGETS` 并写理由；MUST NOT 把真实断链塞进去。

## 数字只在它的家

- 门的总数、Triage 的问题数、不裁剪护栏的条数，只许出现在 `dw-workflow/references/00-流程总纲.md`；别处 MUST 指名引用具体那道门或那一节，MUST NOT 引用带数字的总表标题。评审轴的总数没有家，全树禁写：加一条轴改的是轴表与映射表。受检词表与豁免清单在 `test/counter-word.test.mjs` 与 `test/counter-word-exempt.mjs`。
- 新增受检计数词 MUST 同时补它的权威文件映射：映射漂了，检查会退化成"全树禁用"，看着更严，判据其实丢了。
- 阈值同理：需求真相源的拆分阈值与 TODO 陈旧阈值只在 `文档治理.md`，积压阈值只在 `积压通路.md`，体积上限只在 `test/doc-budgets.json` 与 `ctx` 的 `lint.js`。例外是落进目标项目的模板实例（如 `todo.md` 头部的陈旧阈值）MUST 就地写具体数字——读它的人手边不一定有 skill。

## 注入块（`dw-workflow/assets/config-snippets/`）

- 只留每个会话都要知道的关键一句加指针，判据 MUST NOT 在块里展开。
- 散文里 MUST NOT 写 `字段名="值"` 形态：安装器按这个形态全局替换字段值，测试按它抽字段，写了会被当成字段声明并被改写。散文写成「合并方式为 `pr` 时」。
- 标记块字段的准入判据：探测得出来的不设字段，探测不出来的才设。代码图谱靠每次运行探测；代码事实层是必备资产，既不探测也不设字段。
- 协作面与合并方式互不蕴含，与有没有代码图谱也互不蕴含；MUST NOT 由一个推出另一个。
- `agentic-principle` 的条目只在 `base.md`，MUST NOT 复制进 `collab-*.md`。

## 模板与解析器

- 「已覆盖」的认定住在 `dw-workflow/references/测试资产纪律.md` §3，`test-spec.md` §6 与 `test-coverage.md` 的状态口径各就地写一句同一条件（模板会被照抄进目标项目，读者手边不一定有纪律）：改一处 MUST 三处同改，模板里只写条件，不写理由与例外。
- `dw-code-facts/assets/context-layer/` 的模板与 `scripts/ctx/src/commands.js` 里的 init stub 是同一内容的两份，改一处 MUST 同步另一处。
- 模板是使用者照抄的东西，`ctx` 会解析抄出来的结果：示例日期、说明行、注释里的引号都可能被解析成真数据（可信的 cite、废弃项、非空的 `authority_refs`）。改模板后 MUST 跑 `test/template-contract.test.mjs`——它把模板真喂给解析器。
- 卡片的固定小节名与体积上限同时住在两份卡片模板、`代码事实纪律.md` 与 `lint.js`；改一处三处同改，`test/ctx-domain-cards.test.mjs` 守。
- card 与 registry 的格式约定在 `dw-code-facts/scripts/ctx/README.md`；README 教的失败串、判级表与 `--minimal` 产物说明 MUST 与实现一致。
- `FR-###` / `AC-###` 编号没有机器闸，落点全在模板文案里：两个 spec 模板 → `coding-plan.md` 的 `满足:` 与核销表 → 忠实轴覆盖矩阵 → `test-spec.md` 追溯矩阵。改这几份模板 MUST 手工把四处过一遍。

## 压缩时 MUST 留住的句子

测试断言这些句子在场，是因为它们一旦被精简掉，行为会悄悄变：

- 「积压」与「豁免」的区别：tag 不移动、trailer 必写、结算时连同积压一起评、轴一条不裁。任一句丢了，那批积压再也不会被评到，且没有任何报错。
- 带理由的"不做"连理由一起留：「纯 skill 文档面不跑忠实轴与残留轴——没有参照物」。没有理由，下一个人会顺手加回来。
- 模型档位只写能力描述（普通档、高档、MUST NOT 派最低档），MUST NOT 写厂商型号——本体系同时跑在多种 harness 上。
- `dw-prd` 三道门的顺序（用户过稿门 → 复核门 → 落盘确认门）与"用户定稿前 MUST NOT 派复核子代理"。

## `dw-prd` 与原型

- 组稿步骤号散在多个文件：改编号时全树检索 `§组稿 第` 同步；`test/prd-review-gate.test.mjs` 按门名动态取号，MUST NOT 往断言里回填数字。`[组稿·复核后]` 标签枚举在 `question-bank.md`、`00-prd生成流程.md`、`dw-prd/SKILL.md` 三处同步。
- `dw-prd/SKILL.md` 的上限单列在 `test/doc-budgets.json`：它的路由无条件加载三份 references、入口自带完整纪律。超了先把新增内容写进 references，MUST NOT 顺手上调。
- 改原型框架改 `assets/templates/ui-prototype-framework/` 下的源文件，MUST NOT 往 `ui-prototype.html` 的固定区里写内容：写了就有两份副本，装配后同一段出现两次而页面照常打开。改分区标记或装配表时容器与 `preview.mjs` 的 `FRAMEWORK` 两处同改。
- `UI原型纪律.md` §8 的插槽名、结构 class、外观 class 表与图标 id MUST 与容器和工具逐字一致。外观 class 表只在 `--with-baseline` 装配下成立，校验它 MUST 用基线装配——用默认装配会红，而"修红"的做法正好是删掉闸要保护的 class。
- 写错了页面照常打开的结构知识（`.kv-row` 配 `<dt>`、状态层必须是 `.screen` 的直接子元素、tab 要 `aria-selected`）MUST 收进 `preview.mjs check`，不写进纪律正文靠 agent 记。
- 注解分三层且是闭集：单个元素 → 悬浮气泡；一整屏 → 该屏设备壳外的屏注解区；整份原型 → 工具栏里的设计说明面板。
- 取批注的命令 MUST 写在每个真正打开原型的执行点上（设计、实现、测试步骤与 Lean 一页）；只写在总纲里等于写给一个当时不在场的读者。
- 原型视觉风格由项目真实样式来源决定：棕地项目继承现有设计且 MUST NOT 开基线；绿地项目与用户确认后再画；确无来源才 `--with-baseline` 并在 PRD 写明"视觉为临时假设"。
- 要禁一种写法，先给它一个标准载体：只给禁令不给表达出口，禁令会被反复违反。

## 外部资产

- `agentic-principle`、`skill-principle` 与 `codegraph` 的内容 MUST NOT 搬进本目录。agent 怎么设计归 `agentic-principle`，`AI-LLM-overlay.md` 只管运行期 AI 契约；`graph.md` 只写"何时用、它给什么、不可用怎么办"，MUST NOT 扩写成 codegraph 使用手册。
- 要找全某个伴生 skill 的引用方用检索，MUST NOT 按记忆列清单。
