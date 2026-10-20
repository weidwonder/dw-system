# UI 原型纪律（涉及用户可见界面时）

> **触发条件**：需求会新增、调整或重组用户可见的页面、组件、入口、状态、信息层级或交互路径时，MUST 产出 HTML 原型。
> **豁免**：不改变界面结构与交互路径的纯文案改动（改措辞、纠错别字、换标签文字）不必出原型，在 PRD 里写清"改动前文案 → 改动后文案"即可。
> 确认"不涉及 UI"时，PRD 的 UI 原型节写明"不适用 + 原因"，不得默默留空。
>
> **产物去向**：原型与 PRD 一起作为 `dw-workflow` Step 1 的输入，下游的 Overview / eng-spec / test-spec 会按它落用户可见行为。因此原型不是给评审看一眼的插图，是**要被工程读的行为契约**。

> **本文小节**：[1 自查样式](#1-先自查现有样式查不到再问用户) · [2 交付形态](#2-交付-html-高保真交互页) · [3 面向用户](#3-面向用户而不是面向文档) · [4 范围控制](#4-短平快范围控制) · [4.5 被取代时](#45-原型被取代时加横幅不删文件) · [5 PRD 写法](#5-prd-中的写法) · [6 交付自检](#6-交付前自检跑-check-命令) · [7 批注框架](#7-界面批注框架容器已内置-must-not-自己造)（7.1 建/改稿 · 7.2 元素说明 · 7.3 读回批注 · 7.4 写回文件 · 7.5 设计说明 · 7.6 屏注解区 · 7.7 动到带批注的元素 · 7.8 服务开着时改稿）· [8 填内容](#8-怎么往容器里填内容工具--插槽契约)（8.1 工具与插槽 · 8.2 界面结构 · 8.3 class 与 hook · 8.4 项目样式与自定义控件 · 8.5 走一遍完整链路）

## 1. 先自查现有样式，查不到再问用户

**顺序不可颠倒：能自己查到的样式事实不许问用户**（呼应 `00-prd生成流程.md` §提问三纪律 第 1 条）。

自查清单（按序做完，命中即停）：

1. **设计 token / 主题变量**：`tailwind.config.*`、`theme.*`、`variables.css|scss|less`、`*.tokens.json`、CSS 自定义属性定义处——直接取品牌色、字号阶、间距阶、圆角、阴影。
2. **组件库依赖**：`package.json` / 锁文件里的 UI 库（antd、element、shadcn/ui、MUI、Vant 等）——继承其默认体系，原型直接照该库的控件形态画。
3. **同类既有页面**：与本次需求最接近的现有页面源码，抄它的布局骨架、控件层级、空态与错误呈现方式。
4. **全局样式入口与截图资产**：全局样式文件、`docs/` 下已有的界面截图或设计稿。
5. 卡片命中时补充：Engineering Context 里能 cite 的界面事实带 cite（card 通常只记服务能力，UI 事实多在前端仓的代码里，以第 1–3 步为主）。

自查全空时才向用户要材料：优先要一个"最接近的现有页面链接或截图"，用户也给不出时，MUST 用"样式假设"显式列出品牌色、字体、间距、圆角、控件风格，不得伪装成既有样式。

样式继承优先级：现有代码里的设计 token / 组件库 > 现有真实页面 > 同类页面截图 > 用户明确偏好 > 临时视觉假设。

## 2. 交付 HTML 高保真交互页

- 涉及 UI 的 PRD MUST 配一个独立 HTML 原型文件：`docs/spec/YYYY-MM-DD-<name>-prototype.html`。PRD 只放链接、覆盖范围和关键状态清单，不把大段 HTML 嵌进 PRD。
- **产出时机只有一个**：批 C 只产出 UI Prototype Brief，HTML 原型在 `00-prd生成流程.md` §组稿 第 2 步生成，与 PRD 一起过 §组稿 第 6 步的落盘确认门后才写入 `docs/spec/`。**MUST NOT 在批 C 就把原型落盘**——那道门要回述的正是原型覆盖范围与样式依据，提前落盘等于绕门。
- **给用户过目用的是预览副本，不是正式文件**：`00-prd生成流程.md` §组稿 第 4 步的用户过稿门要用户真的打开原型点一遍，因此 MUST 把原型写成可离线打开的**预览副本**放在系统临时目录或用户明确指定的项目外位置，并把路径告诉用户；**MUST NOT 因为"用户要看"就提前写进 `docs/`**，也 MUST NOT 只贴一段 HTML 源码让用户自己存盘。正式文件在第 7 步按本节命名重新写出，预览副本的路径与文件名一概不作数。
- 原型 MUST 是可在浏览器直接打开的**单文件** HTML（含内联 CSS 与少量 JS），能点击 / 切换关键状态。
- **MUST NOT 引用任何外部资源**：不用 CDN 脚本或样式、不用网络字体、不用远程图片（图片改用内联 SVG 或纯 CSS 占位），字体只用系统字体栈。原型要能离线、内网、断网打开——依赖外链的原型等于交付了一个会白屏的文件。
- **原型文件本身 MUST NOT 用 Markdown 表格、mermaid 或静态文字块替代**。（此条只约束原型文件；PRD 正文的业务流程图仍然用 mermaid，不受影响。）
- 原型 SHOULD 覆盖 1 条核心用户路径 + 关键状态：默认、加载、空态、错误 / 无权限、成功反馈；小改动至少覆盖改动前后用户可见差异。
- 原型 MUST 由 `scripts/preview.mjs` 的 `init` 命令从容器建出，之后只用 `screen` / `slot` 往具名插槽里填（判据在 §7.1、命令表在 §8.1）；容器内置的设计系统、图标库、批注框架与批注数据块 MUST 原样保留。**MUST NOT 手工复制容器再逐行替换**——那会绕开工具对结构、锚点与区间的全部保障。
- 屏幕内只放真实用户会看到的内容、文案和控件；面向产品经理 / 评审者的解释、标注、设计理由、开放问题 MUST 放在顶部工具栏的设计说明面板（§7.5），不得绘制在用户界面里。**指向某个具体元素的说明改写成该元素上的 `data-anno` 悬浮气泡**（判据在 §7.2），不要因为说明栏说不清是哪个控件就把文字画进屏幕。

## 3. 面向用户，而不是面向文档

- 使用接近真实业务的数据、角色名称和文案；不得出现 Lorem、TODO、占位说明、给 PM 的讲解语。
- 视觉要对齐现有产品：色彩、字体、间距、圆角、阴影、按钮层级、导航结构、空态插画 / 图标风格都要有来源或假设。
- 交互要体现业务结果：按钮点击后状态变化、表单校验、toast / modal / inline error、列表刷新等关键反馈要能演示。
- 若一屏承载不下，不增加说明页；改用多个真实用户屏幕或状态切换。

## 4. 短平快范围控制

- 默认只做**轻量原型**：2–5 个关键屏幕 / 状态，证明核心体验与边界，不做完整设计系统重建。
- **多屏组织方式**：在界面插槽里横向并排多个 `.device-wrap`，每屏一个块并加真实屏幕名（屏幕名元素 `.device-name` MUST 在 `.device` 之外，写进 `.device` 里批注就分不清是哪一屏）；设计说明全篇只保留一个（入口在顶部工具栏，见 §7.5）。结构见 §8.2。
- 若需求范围很大，先画主旅程和最高风险状态；次要页面进入开放问题或后续原型任务。
- 若缺少现有 UI 样式来源且用户暂不提供，仍可交付临时原型，但 MUST 在 PRD 的 UI 原型节写明"视觉为临时假设，开发前需替换为真实样式依据"。
- **查不到样式来源时不许伪造**：`project-theme` 插槽 MUST 整段留空（判据在 §8.4），**MUST NOT 往里填臆造的品牌色冒充既有样式**；同时 MUST 在 PRD 的 UI 原型节写明"视觉为临时假设，开发前需替换为真实样式依据"。交付的原型文件全文不得残留 `【`——容器本身不含任何占位符，残留的一定是自己写进去的（见 §6）。

## 4.5 原型被取代时：加横幅，不删文件

原型是**现行界面依据**，会被后续需求接替。HTML 写不了 frontmatter，所以生命周期状态用页面顶部的可见横幅表达（姊妹 skill 的 `<skills 根>/dw-doc-governance/references/文档生命周期.md` §4 的 HTML 变体；`<skills 根>` 定义见 `00-prd生成流程.md` §批 B → 现状怎么取证）：

- 界面被后续需求改掉时，MUST 在旧原型 `<body>` 的**第一个可见元素**位置插入横幅，内容为：`已被 <新原型文件名> 取代（YYYY-MM-DD）。本页仅存档，不代表现行界面。`
- 横幅 MUST 是页面打开就能看到的可见元素，MUST NOT 只写 HTML 注释——注释挡不住任何人（包括 AI）照着旧图实现。
- 同时把旧原型从 `docs/index.md` 移入 `docs/index-archive.md`。**MUST NOT 删除旧原型文件**：它是"这个界面当初长什么样"的唯一证据。
- 横幅样式沿用 `assets/templates/ui-prototype.html` 的说明栏配色即可，无需新增外部资源——零外链约束照旧。

## 5. PRD 中的写法

涉及 UI 时，PRD 增加"UI 原型"节，五项齐全（三类模板同一套项，不得增删改名）：

| 项 | 内容 |
|---|---|
| 原型文件 | `docs/spec/YYYY-MM-DD-<name>-prototype.html` |
| 覆盖路径 | 原型覆盖的核心用户路径、页面和状态 |
| 样式依据 | 现有设计 token / 组件库 / 现有页面 / 截图 / 临时视觉假设（写清具体来源） |
| 关键状态 | 默认 / 加载 / 空态 / 错误或无权限 / 成功反馈等 |
| 不在用户界面内展示 | 面向 PM 的解释、设计理由、开放问题；**指向一整屏的写进该屏的屏注解区（§7.6），整份原型层面的留在设计说明（§7.5）**；指向单个元素的说明写成该元素的 `data-anno` 悬浮气泡（§7.2） |

「样式依据」MUST 写到可核对的具体来源（token 文件名、组件库名、现有页面路径）——这是 `业务语言纪律.md` §取证出处豁免 明列的例外，MUST NOT 因业务语言要求把它删成"沿用现有风格"。

## 6. 交付前自检：跑 check 命令

**交付前 MUST 跑一次**（无浏览器也能查，退出码非 0 即未过）：

```
node <skills 根>/dw-prd/scripts/preview.mjs check <原型文件>
```

它查下面这些，**MUST NOT 用人工逐条目测替代**——其中控件结构契约、图标引用、未定义 class 三类，人眼几乎查不出来，而写错了页面不报错、只是版式塌掉：

- 文件内 `http://` / `https://` 外链数为 0，无 `<script src>`、`<link href>`、`@import url(...)`、`xmlns`、网络字体。
- 全文无 `【`：占位符已清零（与 `prd写作纪律.md` 的无占位符成稿一致）。**容器本身不含任何占位符**，残留的 `【` 一定来自自己填进插槽的内容，MUST 逐个换成接近真实的业务文案，**MUST NOT 靠整段删掉来消 `【`**。
- 用户界面区域内不含"设计说明 / 开放问题 / 样式依据 / 待确认"等字样——这些只允许出现在设计说明面板（§7.5）、该屏的屏注解区（§7.6），或元素上的 `data-anno` 悬浮气泡（§7.2）。
- 每个声明覆盖的状态都在该屏的注解区里有对应切换按钮，且按钮的 `data-state` 值合法、指向本屏真有的状态层（行为由容器提供，不必自己绑）。
- **声明了的状态层里真的填了内容**：骨架建出来是空的，空着切过去就是一片空白——这与"压根没有这个状态层"对用户是同一个结果，MUST 逐层填完再交付。
- 容器的固定实现区标记齐全且未被改写：`THEME`、`DESIGN-SYSTEM`、`ICONS`、`ANNO-FRAMEWORK:CSS`、`ANNO-FRAMEWORK:JS`、`ANNOTATIONS` 各自的 `BEGIN`/`END` 都在（§7.1、§8.1）。
- 改稿时批注块内容与界面上的 `data-anno-user` 属性原样保留，用户已写的批注一条不少（§7.1）——`check` 会逐条比对批注块里的条目与界面上的锚点，**未经约定**失联的一条报一条 P0；按 §7.7 约定后由工具清掉的不触发它。
- 每屏的 `.device-name` 在 `.device` 之外、`.status` 各层是 `.screen` 的直接子元素（§8.2）。
- 有子元素结构要求的控件写法正确、图标 id 都存在、用到的 class 都有样式定义、行内样式没写死颜色（§8.3）。

`check` 报 P0 就 MUST 修完再交付；P1 逐条看过再决定；P2 是提示。**它查不到的仍要自己把关**：文案是不是真实业务语言、覆盖路径对不对、气泡里的说明有没有画进屏幕。

## 7. 界面批注框架（模板已内置，MUST NOT 自己造）

`assets/templates/ui-prototype.html` 内置一层批注框架，把"对某个界面元素的说明"和"用户对某个界面元素的意见"都收进标准载体：**AI 侧**用元素上的一个属性写说明，鼠标悬浮才展开；**用户侧**用页面顶部工具栏点选元素写意见，随时改随时存，AI 直接从文件里读回来。

容器按标记分区，**能动的只有 §8.1 插槽表里那几个插槽**，其余全是固定实现（下表按标记名引用，MUST NOT 用序号——序号会随容器增区而漂）。

> **固定实现区的正文不在容器文件里**：`THEME` / `DESIGN-SYSTEM` / `ANNO-FRAMEWORK:CSS` / `ICONS` / `SCREEN-SCRIPT` / `ANNO-FRAMEWORK:JS` 这六个区的内容住在 `assets/templates/ui-prototype-framework/` 下的独立 css / js / svg 源文件里，`ui-prototype.html` 本体只留分区标记与骨架；`preview.mjs init` 会按装配表把它们填回去。**产出的原型仍是单文件、零外链、可离线打开**——外置的是源码组织方式，不是运行时依赖，这条对产出方**没有任何影响**：你依旧只填插槽、依旧不读容器。**要改框架本身**（而不是产出原型）时才读 `assets/templates/ui-prototype-framework/README.md`：装配表、结构层与外观层的切分线、新增源文件该归哪一层都在那里；MUST NOT 往容器固定区写正文，理由同在那篇。



| 区 | 标记 | 谁写 |
|---|---|---|
| 内容插槽 | `TITLE`（含副标题） / `SCREENS` / `NOTES` / `PROJECT-THEME` / `CUSTOM-CSS` | 本次要画的全部内容，一律用 `slot` 命令写（插槽名与标记名不是一套，取值见 §8.1 表） |
| 批注数据 | `ANNOTATIONS:BEGIN … END` | 页面工具栏、`reply` 命令、§7.7 放行路径上的 `slot` 写。**AI 手工编辑本块仍然禁止**（§7.3） |
| 默认视觉基线 | `THEME:BEGIN … END` | 谁都不写；要覆盖走 `PROJECT-THEME`（§8.4） |
| 设计系统 | `DESIGN-SYSTEM:BEGIN … END` | 谁都不写，固定实现（§8.3） |
| 图标库 | `ICONS:BEGIN … END` | 谁都不写，固定实现（§8.3） |
| 批注框架 | `ANNO-FRAMEWORK:CSS` / `ANNO-FRAMEWORK:JS` | 谁都不写，固定实现 |

框架与自定义样式之间有两条边界，写 `custom` 插槽前 MUST 先读 §8.4 那两条：批注气泡**不改写**被批注元素本来的定位（绝对定位的画布类原型照写即可），以及自定义样式的 `z-index` 上限（上限之上是框架自留层，写进去会盖住气泡）。

### 7.1 产出与改稿都走工具

- 建原型、加屏、填改插槽 MUST 用 `scripts/preview.mjs` 的 `init` / `screen` / `slot`（命令见 §8.1）。
- **MUST NOT 逐字重写、精简、内联改写或删除**任何固定实现区——它们重写一次白花上万 token，还会让用户已写的批注读不回来。
- **MUST NOT 为了动手而通读容器**：填内容所需的全部信息都在 §8，容器里没有任何示例业务内容可抄（这是刻意的，判据在 §8 开头）。
- **改稿 MUST 用 `slot`，MUST NOT 直接编辑原型文件**：用户已经在页面上批注之后，直接编辑要么得先把整份原型读进上下文（几万 token，且与上一条冲突），要么重新生成而**抹掉界面上的 `data-anno-user` 锚点**——那是用户批注与具体元素之间唯一的绑定，断了批注就失联。`slot` 保证**批注数据块**原样不动。
- **界面锚点要你自己带过去**：用户批注挂在界面元素上，而界面元素全住在 `screens` 插槽里，所以改这一处界面时新片段 MUST 把现有的 `data-anno-user="<id>"` 属性原样写在对应元素上（先 `annotations --json` 看每条指的是哪个元素）。未经约定丢锚点 `slot` 会拒绝写入并列出会失联的每一条；动到批注所指的元素本身时按 §7.7。

### 7.2 元素级说明写成气泡，不画进界面

这是 §2 末条「面向 PM 的解释、标注、设计理由 MUST 放画布外」的**出口**：没有它，针对单个控件的说明说不清指的是哪个控件，就会被顺手写进屏幕里。

- 针对**某个具体元素**的说明 MUST 写成该元素上的 `data-anno="说明文字"`；其中要用户拍板的写 `data-anno-kind="question"`（气泡转琥珀色）。框架自动在该元素右上角挂一枚小气泡，**悬浮才展开**，不占界面版面。
- 只与整份原型有关、不指向任何单个元素、也不专属某一屏的内容（样式依据、覆盖范围、整体开放问题）留在设计说明面板（§7.5）。
- 有了这个出口，**MUST NOT 再把说明文字、设计理由、待确认项以任何形式画进屏幕内容里**——屏幕内出现这类文字一律判违规，见 §6 自检第 3 条。

### 7.3 用户批注怎么读回来

- 用户在页面顶部工具栏点「＋ 加注释」后光标变成品红气泡，点选任意界面元素即可写意见；「全局反馈」写针对整份原型的意见；两者都能随时改、随时删。
- 取反馈 MUST 用命令，**MUST NOT 为此通读整份 HTML**（原型里约七成是每份都逐字相同的固定实现，读它纯属浪费）：

  ```
  node <skills 根>/dw-prd/scripts/preview.mjs annotations <原型文件>        # 人类可读
  node <skills 根>/dw-prd/scripts/preview.mjs annotations <原型文件> --json # 结构化
  ```

  它一次给出三类 + 回复：**用户元素批注**（带屏幕名、元素标签、元素可见文字、**所在行号**）、**用户全局反馈**、**AI 侧写在 `data-anno` 里的说明**（含哪些是 `question` 待拍板项）、以及**用户对说明的回复**（带被回复说明的锚点与原文）；每条用户意见带对话与状态（每句标说话方：用户 / AI），开头一行是待处理总数。跑不起来时兜底：`sed -n '/ANNOTATIONS:BEGIN/,/ANNOTATIONS:END/p' <原型文件>` 取用户批注那半（**这条是 bash-only，Windows 上没有**，所以它是兜底不是首选）。

- `items[]` 是元素批注，每条带 `screen`（哪一屏，多屏原型据此区分）、`label`（元素上的可见文字）、`path`（结构路径，辅助线索）、`id`；`id` 与界面里的 `data-anno-user="<id>"` 一一对应，要定位元素就 grep 这个属性。`global[]` 是整体意见。
- 批注 MUST 与用户在对话里提的意见**同等对待**：逐条落稿，或明确回"不改 + 一句话理由"，MUST NOT 默默忽略（同 `00-prd生成流程.md` §组稿 第 4 步用户过稿门）。
- **处理完一条就在原型里追加 AI 回复**：`… reply <文件> --to <id> --text "<落实了什么 / 不改 + 理由>"`，`<id>` 取 `annotations` 列出的 `u<n>` / `g<n>` / `a<n>`。状态只看最后一句是谁说的：AI = 已回复，用户或无人回 = 待处理（用户在页面上追加即回到待处理）；预览服务开着时请用户刷新页面看回复；落盘确认门前待处理数 MUST 为 0。`reply` 提示"页面上看不到 AI 回复"（旧原型）时 MUST 再在对话里转告。
- **AI 侧 `data-anno` 里的说明与用户批注同等重要**：它们是屏幕上看不见、但属于用户可见行为契约的一部分（下游按它落 spec）。`annotations` 命令会一并列出，**MUST NOT 因为界面上看不到就漏掉**；其中 `data-anno-kind="question"` 的是**待用户拍板项**，MUST 在落盘确认门逐条摆给用户，MUST NOT 让它们跟着原型静默进库。
- **AI MUST NOT 手工编辑批注块**。写入方只有三个：页面工具栏、`reply`、§7.7 显式放行路径上的 `slot`。

### 7.4 批注要写回文件才读得到（交原型时 MUST 说的一句话）

浏览器不允许网页未经用户手势授权就写本地文件——这是浏览器的硬约束，页面即使知道自己的路径也拿不到写句柄。所以**默认 MUST 用预览服务打开原型**，让回写这件事对用户完全透明：

**首选：用预览服务打开（全自动，用户零操作）**

```
node <skills 根>/dw-prd/scripts/preview.mjs <原型文件>
```

它把这一个文件用本机 http 提供出去并自动打开浏览器，页面里的批注**直接写回该文件**，不需要任何授权点击。服务只绑回环地址、只认这一个文件、只接受形如原型文档的写入、拒绝跨站写入，原子写盘。

**生命周期由 AI 持有，MUST NOT 甩给用户**：

- MUST 由 AI **在后台启动**它，只把打印出来的 `http://127.0.0.1:<端口>/` 交给用户，并告诉他"这个地址在过稿期间有效，读完说一声我就关掉"。**MUST NOT 让用户自己去终端跑命令、也 MUST NOT 要求用户按 Ctrl+C**——他多半没有那个终端。
- 用户定稿、准备进复核门时 MUST 由 AI 停掉本次的预览服务（执行点在 `00-prd生成流程.md` §组稿 第 5 步）；**MUST NOT 把它当成常驻设施留着**。
- 服务在跑时工具栏右侧显示「批注自动写回文件，无需操作」，**没有任何按钮要用户点**。

**降级：用户直接双击 html（`file://`）打开时**

- 工具栏右侧按钮：Chrome / Edge 上是「保存到文件」——点一次、在弹窗里**选中这份原型文件本身**并允许保存，之后每次改动自动写回、不用再点；Safari / Firefox 上是「下载副本」——MUST 告诉用户下载后覆盖原文件；两条都走不通时用「复制 JSON」把批注粘回对话。
- 状态灯就在按钮右边：**绿 = 已在文件里**（AI 读得到）、**橙 = 有改动还没写回**、**灰 = 只在本机浏览器里**（AI 读不到）。
- 用户第一次写批注时容器会自己弹一次说明（讲清"为什么还要点一下保存"），但**MUST NOT 把这条当成已经交代过**：交原型时仍 MUST 用自己的话说一遍，那次弹窗用户可能顺手关掉。
- **MUST NOT 因为降级路径存在就默认走它**：让用户为一件他不该关心的事点两次弹窗，是把浏览器的限制转嫁给了用户。
- 用户说"我批注完了"而批注块仍是空的时，**MUST NOT 直接判定"用户没提意见"**就往下走：用预览服务打开时 MUST 先看服务端有没有打印过写回记录（没有就是用户没写，或页面根本没连上）；`file://` 打开时 MUST 问他状态灯什么颜色、有没有点过「保存到文件」。

### 7.5 注释的三层归属

| 说的是什么 | 唯一去处 | 呈现方式 |
|---|---|---|
| 指向单个元素的说明 | 元素级批注 | 元素上的 `data-anno` 悬浮气泡 |
| 指向一整屏的说明 | 屏注解区 | 该屏注解区的固定小标题、整屏注释与切换按钮 |
| 针对整份原型的说明 | 设计说明 | 顶部工具栏的设计说明面板（默认收起）|

三层是闭集，MUST NOT 发明第四个位置。三层都在用户界面之外，把说明写进屏幕内容里仍然一律违规。

### 7.6 屏注解区

屏注解区是每屏随附的画布外说明区域，**恒挂在该屏下方**（屏在画布上矩阵排列，注解区跟着走；`--anno-right` 已于 2.12.0 废除，传入即报错）。它固定包含小标题、整屏注释和状态切换按钮；**屏名恒在设备壳左上方**、留在 `.device-name` 里，MUST NOT 搬进注解区、也 MUST NOT 写进 `.device`（`check` 判 P0）。

**状态切换按钮不用自己写，也不用自己绑。** 声明了多个状态的屏，`screen` 命令直接生成按钮，行为由容器的 `[data-state]` hook 统一提供——**MUST NOT 再往 `script` 插槽里写状态切换的绑定代码**（重复绑定会让一次点击切两回）。

要手写按钮时（一般不需要），标记方式只有一种：给按钮加 `data-state="state-empty"`，值是**完整状态类名**（`state-empty`，不是 `empty`），回默认态用空串 `data-state=""`。**MUST NOT 改用别的属性名**——容器的 hook、写回与 `check` 只认 `data-state`，换了名零个监听器绑上：按钮能点、页面零报错、状态永远不切。`check` 会抓这两类错（前缀写漏、指向本屏没有的状态层）。

容器为状态表达导出 `window.setScreenState(screenEl, nextState)`——**两个参数**，第一个是那一屏的 `.screen` 元素，第二个是完整状态类名。少传一个参数、或把类名写成不带 `state-` 前缀的短名，页面照常打开、状态永远不切换且零报错。用这三种表达之外的方式改状态，还会被写回时烘进文件。屏注解区不进批注出口。

### 7.7 改稿动到带用户批注的元素时

改稿 MUST 先列出受影响批注，与用户逐条约定为已落实、作废或挪到新元素，再带 `--agreed --agreed-plan` 放行。MUST NOT 自行判断某条批注"已经不重要了"。已落实和作废项放行前 MUST 已用 `reply` 写明落实了什么 / 为什么作废（没有 `slot` 拒绝写入），放行后由工具保留并记下处置，产出方 MUST NOT 自己编辑批注数据；挪走项 MUST 把锚点写到改后的元素上。AI 说明与挂在其上的回复不走这道约定：说明被删，回复跟着删，出声但不阻断；不过改界面时 MUST 把现有的 `data-anno-id` 一并抄进新片段。

### 7.8 预览服务开着时改稿

预览服务开着时改完稿 MUST 让用户刷新页面再继续读，MUST NOT 默认"用户看到的就是最新那版"。页面写回撞版本冲突时会自动取回最新稿，用户批注不丢。


## 8. 怎么往容器里填内容（工具 + 插槽契约）

`assets/templates/ui-prototype.html` 是**容器，不是范例**：它自带设计系统、图标库、批注层与状态切换，但**不含任何示例业务内容**。这是刻意的——容器里放一屏示例，产出的原型就会照着示例的业务场景、布局和控件选择走，而不是照本次需求走。

因此：**产出原型 MUST NOT 通读容器**。容器内部的规格由工具负责，不由本篇复述、更不由你去翻源码。

### 8.1 用工具建原型，不要手工拼

`scripts/preview.mjs` 是本 skill 唯一的脚本（**不是 ctx**，那个随 `dw-code-facts` 分发）。产出、自检、取批注、起预览全部走它的子命令，MUST 优先用它们：

| 做什么 | 命令 |
|---|---|
| 建一份原型 | `node <skills 根>/dw-prd/scripts/preview.mjs init <文件> --title <需求名> --subtitle <一句话> [--with-baseline]`（默认不装外观层，判据见 §8.3）|
| 加一屏 | `… screen <文件> --name <屏名> [--desktop] [--states is-default,loading,empty,error,success]`（声明多个状态时自动生成切换按钮，行为由容器提供）|
| 填 / 改插槽 | `… slot <文件> --set <插槽名> --from <片段文件>`（或 `--text <文本>`） |
| 交付前自检 | `… check <文件>`（见 §6） |
| 取界面内容 | `… extract <文件> [--with-css]`（结构、文案、状态层；批注另用 `annotations`） |
| 取回批注 | `… annotations <文件> [--json]`（见 §7.3） |
| 回复一条批注 | `… reply <文件> --to <id> (--text <文本> \| --from <文件>)`（见 §7.3） |
| 起预览服务 | `… serve <文件> [--port <n>]`（见 §7.4；由你后台起、由你停） |

- **建原型 MUST 用 `init`**，MUST NOT 手工 `cp` 再逐个替换——`init` 同时落好标题与副标题，少三次易错的整行替换。
- **加屏 MUST 用 `screen`**：`.device-wrap` / `.device-name` 的位置、`.app-bar`、五个状态层的类名、以及**屏注解区的状态切换按钮**全部由它保证。这些正是手写时最容易错、错了又不报错的地方——按钮的属性名尤其如此（见 §7.6）。
- **改稿 MUST 用 `slot`**，MUST NOT 直接编辑原型文件（判据见 §7.1）。
- 界面内容较长时先写成片段文件再 `--from` 送进去，比在命令行里拼长字符串可靠。

下表是插槽的完整清单，`slot --set` 的取值与它们一一对应（`title` 同时写 `<title>` 与页头大标题，一次填两处）。**片段里只写外壳内部的内容**——外壳（`<div class="devices">` / `<style id="proto-custom">` 之类）由容器提供，片段再写一层就会嵌套；工具检测到重复外壳会剥掉并出声，但 MUST NOT 依赖这条兜底：

| 插槽名 | 装什么 |
|---|---|
| `title` | 文档标题（`init --title` 已经填好） |
| `subtitle` | 页头一句话：样式依据 + 覆盖路径 |
| `screens` | 全部界面（结构见 §8.2；用 `screen` 命令加屏后往各状态层里填） |
| `notes` | 设计说明面板（顶部工具栏入口，默认收起）：样式依据 / 覆盖范围 / 开放问题三段 |
| `theme` | 项目真实样式 token 覆盖（§8.4） |
| `custom` | 组件表里没有的控件样式、hover、动画、媒体查询（§8.4） |
| `script` | 本次原型特有的交互演示（与原型同文件，MUST NOT 引外部脚本）。**屏注解区的状态切换按钮 MUST NOT 写进这里**——`screen` 已生成按钮、容器已内置行为，再写一份就是重复绑定（§7.6）|

`MUST NOT 改动插槽之外的任何一行`——`THEME` / `DESIGN-SYSTEM` / `ICONS` / `ANNO-FRAMEWORK` / `ANNOTATIONS` 各区都是固定实现，改写一次就会让批注读不回来、样式失效，而且不会有任何报错。

### 8.2 界面区的结构

一屏的骨架由 `screen` 命令生成，形如：

```html
<section class="device-wrap">          <!-- 桌面端界面加 is-desktop -->
  <p class="device-name">真实屏幕名</p>  <!-- MUST 在 .device 外：批注按它区分是哪一屏 -->
  <div class="device">
    <div class="app-bar">…顶栏…</div>
    <div class="screen">
      <div class="status is-default">…正常态…</div>
      <div class="status loading">…</div>
      <div class="status empty">…</div>
      <div class="status error">…</div>
      <div class="status success">…</div>
    </div>
  </div>
</section>
```

- 上面这段就是写进 `screens` 插槽的片段内容本身：**MUST NOT 再包一层 `<div class="devices">`**（外壳由容器提供）。缩进怎么写都行——替换区间由容器的 `SCREENS:BEGIN/END` 标记判定，不看缩进。
- 各 `.status` 层 MUST 是 `.screen` 的**直接子元素**——容器靠这层关系控制显隐，放到 `.screen` 外面就永远不显示。用 `screen` 命令加屏则天然满足。
- 状态切换按屏进行，入口在各屏的注解区。某一屏没有当前状态的层时会**回落到默认态**（不会空白），所以多屏原型各屏只需写自己关心的状态，`screen --states` 按需选。
- 设计说明全篇只有一个，MUST NOT 每屏配一份（**每屏自己的话写进该屏的屏注解区**，见 §7.6）。

### 8.3 可用的 class 与交互 hook

**先看这一条：下面那张表分两半——标了「结构层，恒可用」的那几行恒在，其余各行默认不存在。**

容器分两层装配。**结构层恒装配**——画布、设备壳、屏、状态层、屏注解区、图标尺寸、`.fill` / `.scroll-y` 两个布局原语，它们是批注框架与 `check` 的锚点，与视觉风格无关。**外观层（按钮 / 表单 / 卡片 / 徽标 / 提示条 / 空态 / 列表 / 导航 / 浮层，即下面表里未标「结构层，恒可用」的那些行）默认不装配**，只有 `init --with-baseline` 才追加。

这么分的判据：**原型的视觉风格 MUST 由本次项目的真实样式来源决定，MUST NOT 由容器替产出方定死**。容器塞一套完整控件库进去，产出方就会照它画——它长什么样，原型就长什么样，而那套样子与本次项目毫无关系。风格来源的取法在 §1 的自查清单，优先级也在那里。

- **棕地项目**：MUST 按 §1 自查清单继承现有设计（token / 组件库 / 同类页面），**MUST NOT 开基线**——项目已经有风格了，开基线等于往里掺一套无关的。
- **绿地项目**：风格 MUST 与用户确认后再画（品牌色、字体、圆角、控件形态至少确认到这四项），确认结果写进 `theme` 与 `custom` 插槽。
- **确实查不到任何来源、且用户也给不出**：才可以 `--with-baseline` 用中性兜底，并 MUST 在 PRD 的 UI 原型节写明"视觉为临时假设，开发前需替换为真实样式依据"。**MUST NOT 因为它省事就默认开**。

下面这张表里，标着「**结构层，恒可用**」的那几行任何时候都在（它们随结构层恒装配）；**其余各行要开了基线才存在**。整张表管的只是**这份原型怎么画**，**MUST NOT 被读成"要求项目采用某个 UI 框架或组件库"**——项目用什么技术栈由工程侧决定；PRD 里也 MUST NOT 因为容器长这样就写进任何框架名。

| 用途 | class |
|---|---|
| 排版（**结构层，恒可用**）| `.stack` `.stack-sm` `.row` `.row-between` `.grow` `.muted` `.text-sm` `.text-xs` `.font-medium` `.font-semibold` `.truncate` `.mono` |
| 按钮 | `.btn` `.btn-secondary` `.btn-outline` `.btn-ghost` `.btn-destructive` `.btn-link` `.btn-sm` `.btn-lg` `.btn-icon` `.btn-block` |
| 表单 | `.field` `.label` `.input` `.textarea` `.select-wrap` `.select` `.input-group` `.field-hint` `.field-error` `.checkbox` `.switch` |
| 容器 | `.card` `.card-compact` `.card-flush` `.card-header` `.card-title` `.card-description` `.card-content` `.card-footer` |
| 数据 | `.table` `.list` `.list-item` `.kv` `.kv-row` `.avatar` `.avatar-sm` `.separator` |
| 状态 | `.badge` `.badge-secondary` `.badge-outline` `.badge-destructive` `.badge-success` `.badge-warning`；`.alert` `.alert-destructive` `.alert-success` `.alert-warning` `.alert-info` `.alert-title` `.alert-description`；`.empty` `.empty-icon` `.empty-title` `.empty-description`；`.skeleton`；`.progress` `.progress-bar` |
| 导航 | `.tabs-list` `.tabs-trigger` `.nav` `.nav-item` |
| 页面（**结构层，恒可用**）| `.app-bar` `.app-title` `.screen` `.device` `.device-wrap` `.device-name` `.devices` `.fill` `.scroll-y` |
| 浮层 | `.toast`；`.dialog` `.dialog-header` `.dialog-title` `.dialog-body` `.dialog-footer`；`.kbd` |
| 图标（**结构层，恒可用**）| `<svg class="icon"><use href="#i-search"/></svg>`，尺寸用 `.icon-sm` / `.icon-lg` |

图标 id：`i-check` `i-x` `i-plus` `i-minus` `i-search` `i-chevron-right` `i-chevron-down` `i-chevron-left` `i-arrow-right` `i-arrow-left` `i-menu` `i-more` `i-bell` `i-user` `i-users` `i-home` `i-file` `i-inbox` `i-trash` `i-edit` `i-settings` `i-filter` `i-download` `i-upload` `i-eye` `i-lock` `i-star` `i-calendar` `i-clock` `i-info` `i-alert` `i-alert-triangle` `i-check-circle` `i-x-circle` `i-loader` `i-message` `i-sun` `i-moon` `i-external` `i-save` `i-copy`

**有子元素结构要求的控件**（写错了页面不报错、只是版式塌掉，`check` 会抓）：

| class | 结构 |
|---|---|
| `.kv` | `<dl class="kv"><div class="kv-row"><dt>名</dt><dd>值</dd></div></dl>`，MUST 用 `dt`/`dd` |
| `.alert` | 图标、`.alert-title`、`.alert-description` MUST 都是 `.alert` 的**直接子元素**（它是 grid 布局） |
| `.checkbox` | `<button class="checkbox" aria-checked="false"><svg class="icon"><use href="#i-check"/></svg></button>`，MUST NOT 用原生 `<input type="checkbox">` |
| `.switch` | `<button class="switch" aria-checked="false"></button>` |
| `.tabs-list` | `.tabs-trigger` MUST 在 `.tabs-list` 内，且各带 `aria-selected` |
| `.empty` | `.empty-icon` / `.empty-title` / `.empty-description` 都是 `.empty` 的直接子元素 |
| `.input-group` | `<div class="input-group"><svg class="icon">…</svg><input class="input" /></div>`，图标在前 |
| `.select-wrap` | `<div class="select-wrap"><select class="select">…</select><svg class="icon"><use href="#i-chevron-down"/></svg></div>` |

**交互 hook**（容器已绑好行为，写上就能点，MUST NOT 自己写脚本重造）：

| 属性 | 加在哪 | 点下去会怎样 |
|---|---|---|
| `data-submit` | 主行动按钮 | 演示"提交 → 处理中 → 成功"，用来体现业务结果 |
| `role="tablist"` + 子元素 `role="tab"` `aria-selected` | 页签容器与各页签 | 点谁谁选中 |
| `aria-checked` | `.switch` / `.checkbox` | 点击切换开关态 |

- 表里有的控件 MUST 直接用，**MUST NOT 另写一套行内样式重造**。
- 尺寸类的行内样式（`height` / `width` / `grid-template-columns` 等）不在此限——`.skeleton` 这类本就需要按位置给尺寸。
- **MUST NOT 在行内样式里写死颜色**：写死的颜色绕过 `project-theme` 覆盖，换项目主题时不会跟着变。取色一律用 `var(--primary)` / `var(--border)` / `var(--muted-foreground)` 这类 token。
- 图标 MUST NOT 写行内宽高（尺寸由 class 定）。需要库里没有的图标时 MUST 写内联 `<svg>` 元素（HTML 里的内联 SVG 不需要 `xmlns`），**MUST NOT 用 `background-image: url("data:image/svg+xml,…")`**——那种写法里的 `xmlns="http://…"` 会让零外链自检判红。

### 8.4 项目样式与自定义控件

**项目真实样式** → `theme` 插槽，**MUST 只覆盖取值、MUST NOT 改变量名**（全部组件靠这些名字取色）：

```css
/* 片段内容——外层 <style id="project-theme"> 由容器提供，MUST NOT 自己再写一层 */
:root { --primary: #1a73e8; --primary-foreground: #ffffff; --radius: 8px; }
```

可覆盖：`--background` `--foreground` `--card` `--card-foreground` `--popover` `--popover-foreground` `--primary` `--primary-foreground` `--secondary` `--secondary-foreground` `--muted` `--muted-foreground` `--accent` `--accent-foreground` `--destructive` `--destructive-foreground` `--border` `--input` `--ring` `--success` `--success-foreground` `--warning` `--warning-foreground` `--radius` `--font-sans` `--font-mono`。

- 查不到样式来源时本插槽 MUST 整段留空（判据同 §4），**MUST NOT 填臆造的品牌色冒充既有样式**。
- 容器只有**一套中性亮色基线**，**MUST NOT 假设产品有暗色模式**，也 MUST NOT 为暗色另做一套屏幕。产品本身就是暗色的，直接在本插槽里把 token 覆盖成暗色取值即可，**MUST NOT 在原型里另加主题切换装置**。

**控件外观一律 → `custom` 插槽**（开了 `--with-baseline` 时，则只写组件表没有的那些）。它排在设计系统之后，覆盖得掉容器样式，且写的是真正的 `<style>`，因此 `:hover`、`::before`、`@keyframes`、`@media` 都能用：

```css
/* 同样只写内容，外层 <style id="proto-custom"> 由容器提供 */
.date-range { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.date-range > button:hover { background: var(--accent); border-radius: var(--radius-sm); }
```

- 自定义控件的取色同样 MUST 用 token 变量，理由同上。
- 类名 MUST NOT 与容器已有的 class 重名，否则会盖掉组件样式；`check` 会报出没有样式定义的 class，但重名它看不出来，起名时自己避开 §8.3 那张表。
- **SHOULD 用类选择器，不用裸标签选择器**（`button { … }` / `.card button { … }`）：批注框架的图钉是挂进你的元素**内部**的 `<button>`，标签选择器会一并命中它。框架已把图钉与注解区按钮的尺寸盒锁死（那些属性带 `!important`），所以不会再被撑变形；但你的样式仍会白写一遍，且**框架自己**若日后新增控件就未必都在保护范围内。用类选择器是零成本的稳妥做法。
- **满高布局用 `.fill` + `.scroll-y`，MUST NOT 写死 `max-height` 像素**：`.device` → `.screen` → 状态层是打通的 flex 链，`.fill` 吃满剩余高度、`.scroll-y` 在内部滚动。写死像素会让内容区缩成一条、设备壳下方留出大片空白，而页面照常打开、`check` 也看不出来。
- **绝对定位的控件可以照写**（拓扑图 / 流程图 / 座位图这类画布）：批注框架只把**本来是 `static`** 的元素提升为 `position: relative`，`absolute` / `relative` / `fixed` / `sticky` 的元素打了批注也不会被改写定位，MUST NOT 为此另加提权选择器。
- **自定义样式的 `z-index` 上限是 880**（MUST 严格小于它）：880 起是批注框架的自留层（图钉 880，其上还有设计说明面板、工具栏、批注弹窗与拾取光标）。写到这个区间里会盖住图钉，用户看不见图钉就会以为批注没保存成功。

### 8.5 走一遍：一份原型从建到收批注

**这是示例不是判据**，每步规则以上面各节原文为准。需求："给学生端加『错题重练』入口与练习页。"棕地项目、已在 §1 自查到项目用的是自家 token（**因此不开基线**）。

```
P=<系统临时目录>/错题重练-prototype.html          # 预览副本落项目外（§2），不进 docs/
S=<skills 根>/dw-prd/scripts/preview.mjs

node $S init   "$P" --title "错题重练" --subtitle "沿用 design/tokens.css；覆盖 我的-错题本-重练三屏"
node $S screen "$P" --name "我的"      --states is-default
node $S screen "$P" --name "错题本"    --states is-default,empty,loading
node $S screen "$P" --name "重练中"    --states is-default,success
node $S slot   "$P" --set theme  --from theme.css       # 项目真实 token（§8.4）
node $S slot   "$P" --set custom --from controls.css    # 控件外观自己写：没开基线（§8.3）
node $S slot   "$P" --set screens --from screens.html   # 三屏内容 + data-anno 说明
node $S slot   "$P" --set notes  --text "样式依据：design/tokens.css｜覆盖：错题本→重练｜开放问题：每次重练多少题未定"
node $S check  "$P"                                     # 必须无 P0（§6）
node $S serve  "$P" &                                   # 你后台起，用户零操作批注（§7.4）
```

用户看完提了两条意见 → `node $S annotations "$P"` 取回**三类 + 回复**：一条元素批注挂在"开始重练"按钮上、一条全局反馈说"错题本要能按学科筛"、外加你自己写的一条 `data-anno-kind="question"`（每次重练多少题）用户已就地回复"20 题"。三条处理完各 `reply` 一句（如 `--to g1 --text "本期不做，进 TODO"`），开头的待处理数归零。

改稿时"开始重练"按钮那一屏要重画 → **把它身上的 `data-anno-user` 锚点抄进新片段**再 `slot --set screens`；漏抄的话 `slot` 会拒绝写入并列出会失联的批注（§7.7）。**本例锚点原样带过去、批注指向的控件语义没变，因此不触发 §7.7 的逐条约定**；真要动到批注所指的那条意见本身（落实了 / 作废 / 挪到别的元素），MUST 先按 §7.7 与用户逐条约定再带 `--agreed --agreed-plan` 放行。筛选功能属"这次不做、以后想做" → 进 `docs/TODO.md`，不写进非目标。

定稿后：**先停掉 serve**（§7.4），再派复核子代理；落盘时**整份以预览副本为准**写进 `docs/spec/`，批注和锚点一起进库（`00-prd生成流程.md` §组稿 第 7 步）。
