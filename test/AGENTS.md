# test/ — 机器闸说明

改动或新增 `test/` 下的文件前读本文。测试与 fixtures 只住在这里，MUST NOT 放进任何 skill 目录——安装器整目录复制 skill，放进去就会装进每个目标项目。按 RFC 2119 解释规范词。

## 文件

`*.test.mjs` 是用例，`node --test test/*.test.mjs` 按这个后缀收集。不带 `.test.` 的是共用模块：`skill-files.mjs`（按文件名在 skills 树里定位分册）、`counter-word-exempt.mjs`（计数词豁免清单）、`doc-budgets-lib.mjs`（体积检查实现）。`doc-budgets.json` 是体积上限清单，`single-home.allow.json` 是就地重复的白名单，`fixtures/ctx-engineering-context/` 是 `ctx` 的样例事实层。

## 写闸的约定

- 每条新闸 MUST 做反向自检：植入一个它该拦的样本确认判红，撤掉确认转绿；MUST NOT 靠放宽词表、扩豁免清单让它绿。
- 锁契约不锁措辞：换措辞、调表格列序、合法改写不该判红；MUST NOT 把会变的步骤号、字节数、条数写死进断言，能现场解析的就现场解析。
- 按小节切段再匹配，MUST NOT 退回全文匹配：同一个词在别的小节也出现，全文匹配对"该在的那一节漏了一行"恒绿。
- 切段 MUST 走"锚点找不到当场红"的帮手：`indexOf` 返回 -1 时 `slice` 会静默退化成整个文件，段内断言就变成了整文件断言。
- 抽取类的闸要自带一条"抽得到东西"的断言：抽不到引用 / 链接 / 门名会让整条闸凭空全绿。
- 断言"命令成功了"MUST NOT 用退出码代替"文件真的变了"；留意 JS 对 `undefined` 正则的容忍（`match` 给空匹配、`replace` 当字面串）会把失效静默接住。
- 断言问"这条判据在它的家里"（用 `skill-files.mjs` 的 `readSkillFile` / `skillCorpus` 按文件名或按 skill 取文本），MUST NOT 写死分册住在哪个目录。
- 相对路径统一成正斜杠再比对；`path.relative` 在 Windows 上给反斜杠。
- 共用常量放不带 `.test.` 的模块：`node --test test/*.test.mjs` 按后缀收集用例，从另一份 `.test.mjs` import 会把那份的用例再注册一遍。
- 豁免 MUST 显式枚举并逐条写理由，MUST NOT 用启发式猜（猜错就是静默放宽检查面）。
- 假 CLI 的 shebang 钉 `process.execPath`：PATH 被收窄后 `#!/usr/bin/env node` 找不到解释器。
- 原型预览服务的测试起真进程真端口，不 mock。
- 查出现位置的闸与查取值的闸要成对：只查取值，数字会被复制到别处；只查出现位置，权威处写错照样全绿。
- 会调用安装器的测试 MUST 带 `--no-companions`、`--no-codegraph`、`--no-ctx-link`：这三段会动本机的用户级 skills 目录、全局 npm 安装与全局 `ctx` 命令。要测这三段本身，用"假 CLI + 假 npm 放进收窄的 PATH"加临时 HOME，MUST NOT 让任何测试碰真实全局安装。
- 同一类机械可判的问题被评审门报到第二次，就固化成一条闸：闸每次查全量，子代理只看它这次读到的那部分。"已经有闸"MUST NOT 被读成"这一轴可以不派"。
- 闸只守机械可判的那一半：全绿 MUST NOT 被读成各处描述都正确。

## 每条闸守什么

- `cards-mandatory.test.mjs`：卡片层必备这条线——路由不探测 `engineering-context`、注入片段的 ctx 条目无条件、初始化建完整骨架并禁 `--minimal`、默认倾向无条件、补卡最小形态四项、护栏条数与实际条目一致；另查 skills 树内相对链接不断、每个 skill 有入口且被 `dw-workflow` 点名、入口点名的 references 与实际文件双向一致。红了通常是删改了无条件表述，或新增 / 改名 references 没同步入口。
- `change-awareness.test.mjs`：CHANGELOG 五类闭集、不兼容条目三项必填、条目写在评审门之前、依赖声明五项、升级顺序与子代理上限、`ctx init` 真建 `dependencies/README.md`、stub 与模板同讲一套、本仓库根 `CHANGELOG.md` 结构。红了通常是压缩时丢了某条，或 stub 与 `dependency.md` 漂移。
- `codegraph.test.mjs`：安装器的 codegraph 段（未装→npm 装、有新版→`upgrade`、已最新跳过、盲升不谎报、太旧退回 npm、已有索引不重建、`init` 没建成补 `index`、`--codegraph-location`、`--no-codegraph`、`--dry-run`、失败只警告）。全程假 CLI。
- `companion-skill.test.mjs`：伴生 skill 装到用户级两个入口、不进目标项目；已最新跳过、有新版更新、symlink 与 git 工作区不覆盖、远端不可达降级、无版本号的按内容判；`COMPANION_SKILLS` 指向真实仓库与子目录。红了通常是改了 `COMPANION_SKILLS` 或参数名。
- `counter-word.test.mjs`：受检计数词只出现在权威文件与豁免目录；权威映射有效；豁免路径真实存在。红了通常是往别处写回了数字。
- `cross-reference.test.mjs`：skills 树与 `CLAUDE.md`、`AGENTS.md`、`docs/index.md`、`docs/REQUIREMENTS.md`、`docs/TODO.md` 里每条 `` `x.md` §y `` 的目标文件与小节都存在；另有一条守"抽取本身没有静默失效"；不带 `§` 的 `<skills 根>/…​.md` 纯文件指针另查目标文件存在。红了通常是改了标题或搬了文件没改引用方。MUST NOT 靠放宽 `STOP_CHARS` 或扩 `EXEMPT_TARGETS` 变绿。
- `ctx-cards.test.mjs`：`cards.js` 解析层——`loadCards`、`loadRegistry`（按表头名取列、最小三列、跳占位行、认中文表头「能力」、认 GFM 分隔行）、`diagnoseRegistry` 把各种"读不出数据行"分开报、`registryConflicts`、读不出文件不抛栈。
- `ctx-cli.test.mjs`：命令层与 CLI——`discover` / `getCard` / `findScenes` / `listServices` / `initScaffold` 行为、`--help` 首行签名串、`--json` 经管道不截断、`--json` 带 `diagnosis`、目录不存在与登记表为空分开报、失败给中文提示不抛栈。
- `ctx-link.test.mjs`：安装器的 ctx 全局链接段——实跑 `--help` 验证、link 失败只警告并给兜底、不顶掉别人的同名 `ctx`、EEXIST 三种归属处置、回显 npm 原文、`--no-ctx-link`、`--dry-run`。全程假 npm + 假 ctx。
- `ctx-probe.test.mjs`：`probe.js`——探针解析、`classifyEntity` 判定矩阵、门禁自检、棘轮（新增失败 RED / 基线内 AMBER / 基线过期 RED）、blocking 与加权、四类交接题型、init 骨架不产生可跑探针。红了通常是改了废弃判定词表或 probe-set stub。
- `ctx-semantic.test.mjs`：`semantic.js`——排序结果带 cite / freshness / 权威标记、废弃标记按行判不连坐、`--as-of` 过期降权、未声明新鲜度不假定新鲜、synonyms 扩展。
- `doc-axis.test.mjs`：文档轴这条线——D 是文档轴 E 是 agent 架构轴、D 轴触发条件没被放回主会话判断、完成门只核对 D 轴报告、权威面清单只有一份、probe 定位只有一处权威定义、「待归并」例外与它修饰的判据同处。断言问的是"判据在它的家里"，不问在哪一份分册。
- `doc-budgets.test.mjs`：每份受管文本在 `doc-budgets.json` 的上限以内（单文件、类上限、按 skill 合计、索引单条行长、`CLAUDE.md` 扣掉标记块）；清单点名的文件不存在、glob 零命中也判红。红了按顺序处置：搬回它的家 → 压缩 → 经拍板人同意才抬上限并写理由。
- `doc-index.test.mjs`：`docs/spec|plan|report` 每篇带 `lifecycle` 且取值在闭集内；`active` 的在 `index.md`，归档的在 `index-archive.md` 且不在现行索引；索引链接不断链。按文件路径匹配不按标题；`collectDocs()` MUST 保持递归。刻意不判"active 文档出现在归档索引"（那是指路不是收录）。
- `gate-sync.test.mjs`：总纲门全景表的每个门名在 Lean 一页的 §顺序 表里字面在场；表行数与标题计数词一致。门名从总纲现场解析，不在测试里写死。红了通常是加了一道门没同步 Lean 一页。
- `install-and-doc-governance.test.mjs`：安装器主干——Codex 约束块与全局卸载各失败路径目标零改动、`.gitignore` 标记块幂等、`--keep` 撤销旧约束、settings 损坏先中止、入口软链接三种情形、源获取与失败零改动、`docs` 入库决定只问一次；另守几条 skill 文本契约（三个文档目录、业务语言、worktree 全程）。
- `installer-legacy-upgrade.test.mjs`：旧名字安装升级——旧目录与旧戳删除、字段与入库决定逐字保留、新块不含 `mode`、二次运行零改写、`--dry-run` 字节不变、符号链接只删链接、旧名字只出现在 `LEGACY` 表内、ctx 归属判定认新旧两个 skill 路径段。
- `installer-migration.test.mjs`：`VERSION` 是 x.y.z；`migrations/` 每份指南合法命名、含「需要的动作」、≤45 行；`VERSION` 不低于最高指南；无 stamp 的旧安装打印指南；全新安装写 stamp；同版本重装不提示。当前版本没有同名指南不算违规。
- `npm-entrypoint.test.mjs`：`package.json` 的 `bin` / `files`、默认 ref 绑定自带 `VERSION`、显式 `--ref` 不回退、真打包到临时目录执行 `--help`。
- `object-surface.test.mjs`：对象面 → 轴集合——三类面闭集、面→轴映射各处一致且取并集、伴生轴加载伴生 skill、文档说的伴生 skill 与 `COMPANION_SKILLS` 是同两个、D 轴触发与零对象面出口、档位无厂商型号、轴集合不可裁剪、判定结论写报告首行；Lean 一页与注入块只指过去。
- `packaging.test.mjs`：ctx 的测试与 fixtures 不在 skill 目录里、确实在仓库根 `test/`。
- `prd-review-gate.test.mjs`：`dw-prd` 三门顺序、定稿前禁派复核、落盘确认门退化规则、各处接线、组稿步骤号全仓一致（按门名动态取号）、prompt 模板三条硬约束、标签枚举三处同步、三个出口。
- `prototype-annotations.test.mjs`：纪律与容器的一致性——插槽探针逐字一致、固定区标记成对、容器无示例业务内容、批注数据块可解析、零外链、内联脚本语法可解析、§8.3 class 表与图标 id 双向一致（用基线装配）；跨 skill 接线（下游每个打开原型的执行点都给了取批注命令）；图钉定位与层级。
- `prototype-framework.test.mjs`：容器六个固定区为空、装配表每项对应的源文件存在且非空、装配结果每区正文逐字节等于源文件、外观层默认不装、缺源文件时 `init` 报错不留残页、`icons.svg` 不含 `xmlns`、框架 UI 对产出方样式免疫、框架 JS 只用私有 class。MUST NOT 改成断言"与某个历史字节相等"。
- `prototype-preview.test.mjs`：`preview.mjs` 全部子命令的行为，真进程真端口不 mock——写回落盘、非原型 payload 拒绝、只服务回环、版本校验与并发写、`slot` 保批注与锚点、丢锚点拒写与 `--agreed` 放行、`check` 各类结构问题、`extract`、已废除参数报错、`import` 无副作用、并发写临时文件名唯一。
- `requirements-layering.test.mjs`：需求真相源只写现状、两层承载禁二级目录、拆分阈值只在权威处、归并落点表与"清单没变化不等于无需归并"、归并时机只在准出门、TODO 四类闭集与模板逐字一致、AI 不得自删条目、本仓库自己也有真相源与 TODO。
- `review-backlog.test.mjs`：积压通路——阈值只在 `dw-review-gate` 一处、五个阈值取值与比较方向、单次与累计是两个范围、禁止积压三类且不看行数、积压三件事、只豁免评审门一道、结算后才移动 tag、tag 缺失是降级不是错误、旧措辞零残留；配套测试不单独构成 P 面的两条口径与反向条款；注入片段里没有字段声明形态。
- `rule-destinations.test.mjs`：分支起点（与 `main` / `origin/main` 的 merge-base）里每个含 MUST / SHOULD 的小节，要么仍在原处，要么在 `docs/report/*规范去向清单.md` 的「原位置 | 去向 | 说明」表里有交代（去向存在；`删除` 必须写理由）。粒度是小节不是句子。取不到分支起点时本闸不生效，只打印一行提示。
- `template-contract.test.mjs`：模板 / README ↔ 解析器往返——原样新建的 card 不输出可信新鲜度、说明行不变废弃项、未填 spec 判 `authority_refs` 未填、probe-set 与 registry 模板表头与 `ctx init` stub 同构、test-coverage 模板行要么空骨架要么标示例、README 教的失败串与判级表与实现一致。
- `workflow-block.test.mjs`：标记块字段模型——新块幂等、`mode` 只映射协作维度、两条迁移路径正文差异只在协作语义、四种混合状态以 `CLAUDE.md` 为准、字段值非法报错中止零改动、读不出已知字段中止、stamp 落后于新字段格式时显式报告。
- `ctx-domain-cards.test.mjs`：域卡读取（`get-card <仓库> <域>` 先读域卡文件、`discover` 与 `search-semantic` 覆盖域卡、`list-services` 只列地图卡）、`lint-cards` 七条规则各一个必红样本与基线的"只减不增"、probe 题型 `authority-unique`。红了通常是改了卡片固定小节名或体积上限没同步 `lint.js` 与两份卡片模板。
- `single-home.test.mjs`：含 MUST / SHOULD 的句子归一化后出现在两个以上 skill 文件即判红；确需就地重复的关键一句登记在 `single-home.allow.json` 并写理由，白名单里已不再重复的条目同样判红。红了的处置是留家里那份、其余改成指针。
