// probe.js — ctx probe：Frozen Probe Set 防腐门禁（零依赖、可打分、跨平台）
//
// 理念（与 references/capability/context-engineering.md 一致，务必保留）：
//   · 冻结题集，每发布周期重跑，检测 context 层"衰减"，不当回归基线。
//   · 门禁自检：真跑前先植入必然失败的样本，抓不到 → 门禁形同虚设 → 流水线红。
//   · 棘轮：容忍的腐化债登记为基线；新增失败 = RED；只许变短。
//
// 机器可判题型（两类）：
//   A. context 层题型（读 cards/registry）
//     capability-mapping  输入=能力名，期望=`权威实现` 或 `权威仓库 :: 权威实现`。按 registry 求解比对；
//                         该能力在 registry 里有互相矛盾的登记时直接判 FAIL（此时这道题没有正确答案）。
//     deprecated-trap     输入=接口/实体，期望=`deprecated`（或 canonical）。按 cards/registry 判定其权威状态。
//   B. 零上下文交接题型（读项目自身文件，见 eng-spec §3.6 四项可达性检查）
//     requirement-reachable    输入=需求真相源（`路径` 或 `路径#小节`），期望含跳数上限（默认 ≤2 跳）
//     architecture-reachable   同上，指向架构真相源
//     implementation-usable    模块路径**无条件**校验（架构节列出的路径都存在），
//                              再按探测到的每个能力位**叠加**一项——MUST 叠加，MUST NOT 择一：
//                              三行 registry 不该让实现层门禁整个变绿。
//     rationale-traceable      输入=索引路径（默认 docs/index.md），现行区各 spec 的 authority_refs 均非空
//
//   B 类题型需要项目根目录：由 evaluateGate 的 `options.root`（默认 process.cwd()）给出，
//   与 A 类共用同一套 severity/weight/status/authority_refs 自防腐与棘轮机制。

import fs from 'node:fs';
import path from 'node:path';
import { listServices } from './commands.js';
import { isRegistryPlaceholder, registryConflicts } from './cards.js';

const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const normTight = (s) => norm(s).replace(/\s+/g, '');
const includesTight = (hay, needle) => normTight(hay).includes(normTight(needle));

/** 解析一行 markdown 表格；非表格行返回 null。 */
function parseRow(line) {
  const t = line.trim();
  if (!t.startsWith('|')) return null;
  return t.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}
// 与 cards.js 的 isSeparatorRow 同一判据：GFM 只要求每格 ≥1 个 `-`。
// 认不出分隔行，这里的后果是把 `|-|-|` 当数据行 → 多出一道编号为 `-` 的假探针。
const isSeparator = (cells) => cells.every((c) => /^:?-+:?$/.test(c.replace(/\s/g, '')) || c === '');

/**
 * 基线段里"一个探针编号"的写法：行首（可带 `-`/`*`/`+` 列表符）+ 可选 `#` + 数字，
 * 且数字后面不能紧跟 `0-9 . - / :`——后者把日期（`2026-08-16`）、小数、时刻挡在外面。
 *
 * MUST NOT 退化成"收集本段所有整数"。基线段里写带日期的复核记录
 * （`> 2026-08-16 复核：暂时容忍 #1，见 issue 4321。`）是必然会发生的事，
 * 而整数通吃会把 2026/08/16/4321 全登记成基线编号 → 它们都不在失败集合里 →
 * staleBaseline 非空 → **假 RED**，还会提示"基线 #2026 已不再失败，必须删除"。
 */
const BASELINE_NUM =
  /^\s*(?:[-*+]\s*)?(?:\d+[.)]\s*)?(?:\[[ xX]?\]\s*)?(?:[*_`]{0,2})#?(\d+)(?![\d.\-/:])/;

/**
 * 基线段里"看起来像编号、但没被 BASELINE_NUM 收进去"的行。
 *
 * 存在的理由：漏解析的后果是**假 RED**——被容忍的失败变成"新增失败"，而提示只会说
 * "新增失败 #3"，不会说"你的基线没被读出来"。写法只要偏离一点（编号夹在句子中间，
 * 如 `- 探针 #3：容忍到 2026-09`）就会静默失效。
 *
 * 判据 MUST 排除**本来就不承载编号**的行：基线段里写复核记录（`2026-08-16 复核：…`）、
 * 引用 issue / PR、写"见 X 的讨论"都是被明确允许的写法，对它们报警告等于把正常用法变成噪音。
 * 剩下的"列表形态 + 含数字 + 没解析出来"才报——`- 探针 3：容忍到 2026-09` 这种
 * 编号夹在句子里的写法就落在这里。
 */
function looksLikeBaselineEntry(line) {
  if (!/^\s*[-*+]\s/.test(line)) return false;          // 只看列表形态
  if (/(见|详见|参见)/.test(line)) return false;          // "见 PR #88 的讨论"是说明，不承载编号
  // 日期与 issue/PR 号先剥掉再看还剩不剩数字：`- 探针 3：容忍到 2026-09` 里真正的编号是 3，
  // 不能因为句尾有个日期就把整行放过（那正是最容易被漏读、最容易变成假 RED 的写法）。
  const rest = line
    .replace(/\d{4}-\d{2}(-\d{2})?/g, '')
    .replace(/(issue|pr)\s*#?\s*\d+/gi, '');
  return /\d/.test(rest);
}

/**
 * 解析 probe-set.md：探针表（表头首列 '#'，次列含 类型/type）+ 基线（棘轮）段的编号。
 * 模板占位行（`【…】`）不算探针，单列在 skipped 里供 CLI 提示——不提示的话
 * "6 道题只跑了 0 道"会被读成解析坏了。
 * @returns {{probes:Array<{n,type,input,expected}>, baseline:Set<string>, skipped:string[], baselineUnparsed:string[]}}
 */
export function loadProbes(ctxDir) {
  const file = path.join(ctxDir, 'probe-set.md');
  if (!fs.existsSync(file)) return { probes: [], baseline: new Set(), skipped: [], baselineUnparsed: [] };
  const raw = fs.readFileSync(file, 'utf8');
  const lines = raw.split(/\r?\n/);

  const probes = [];
  const skipped = [];
  const baselineUnparsed = [];
  let inTable = false;
  let headerCols = null;
  let baselineMode = false;
  let baselineLevel = 0;   // 进入基线段时的标题层级；更深的子标题不解除
  const baseline = new Set();

  for (const line of lines) {
    // 标题按**层级**判，MUST NOT 见标题就退出基线段：
    //   · 认任意层级的基线标题（`## 基线` 与 `### 基线（棘轮）` 都常见）；
    //   · 但基线段内部的**更深层**子标题（`### 2026 Q3 复核`）MUST NOT 终止它——
    //     终止的后果是其后的编号全被丢掉，且丢得静默（那些行压根不进 baselineMode，
    //     baselineUnparsed 也抓不到），表现为假 RED。
    // 与本文件 currentSpecLinks 的归档区判定同一套写法：只有同级或更高级标题才解除。
    const head = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (head) {
      const level = head[1].length;
      if (baselineLevel && level <= baselineLevel) baselineLevel = 0;
      if (!baselineLevel && /基线|baseline|棘轮|ratchet/i.test(head[2])) baselineLevel = level;
      baselineMode = baselineLevel > 0;
      inTable = false;
      continue;
    }
    if (baselineMode) {
      // 只认**独立成行**的编号（见 BASELINE_NUM）与表格首列；散在句子里的数字一律不算。
      // "（空）"/None 这类写法自然不含合法编号 → 空基线。
      const cells = parseRow(line);
      if (cells) {
        if (!isSeparator(cells)) {
          const first = cells[0] || '';
          const m = /^#?(\d+)$/.exec(first);
          if (m) baseline.add(m[1]);
          // 首列带注解（`探针 #12`、`12（blocking）`）时同样报出来：表格首列是模板明确
          // 推荐的写法，加注解是必然发生的；静默丢掉就是假 RED，而 README 承诺了不会静默。
          else if (/\d/.test(first)) baselineUnparsed.push(line.trim());
        }
        continue;
      }
      const m = BASELINE_NUM.exec(line);
      if (m) baseline.add(m[1]);
      else if (line.trim() && looksLikeBaselineEntry(line)) baselineUnparsed.push(line.trim());
      continue;
    }
    const cells = parseRow(line);
    if (!cells) { inTable = false; continue; }
    if (!inTable) {
      // 表头：首列 '#'，次列 类型/type。记录列名，按名取值（兼容可选的 severity/weight/status/authority 列）。
      if (cells[0] === '#' && /类型|type/i.test(cells[1] || '')) {
        inTable = true;
        headerCols = cells.map((c) => c.toLowerCase());
      }
      continue;
    }
    if (isSeparator(cells)) continue;
    if (!cells[0]) continue;
    const pick = (...names) => {
      const i = headerCols.findIndex((h) => names.some((n) => h.includes(n)));
      return i >= 0 ? (cells[i] || '') : '';
    };
    const weight = Number(pick('weight', '权重'));
    const rawInput = pick('输入', 'input', '示例') || cells[2] || '';
    const rawExpected = pick('期望', 'expected') || cells[3] || '';
    // 模板占位行（`ctx init` 脚手架里的 `【…】`）不是真探针，MUST 跳过。
    // 不跳的后果不是"多几条红"，而是**基线被污染**：开箱即红会训练用户把 1..N 整批塞进
    // 棘轮基线，此后基线只许变短的约束就永远卡在那批假题上，真腐化再也顶不出来——
    // 一个看起来在工作的门禁比没有门禁更危险。与 cards.js 对 registry 占位行的处理同一判据。
    if (isRegistryPlaceholder(rawInput) || isRegistryPlaceholder(rawExpected)) {
      skipped.push(cells[0]);
      continue;
    }
    probes.push({
      n: cells[0],
      type: (pick('类型', 'type') || cells[1] || '').toLowerCase(),
      input: rawInput,
      expected: rawExpected,
      severity: /block|阻断/i.test(pick('severity', '严重')) ? 'blocking' : 'scored',
      weight: Number.isFinite(weight) && weight > 0 ? weight : 1,
      status: pick('status', '状态').toLowerCase(),
      authorityRefs: pick('authority', 'refs', '权威'),
    });
  }
  return { probes, baseline, skipped, baselineUnparsed };
}

// 废弃行里指向替代物的措辞。
// ASCII 词 MUST 带词边界：判据跑在 norm() 之后的串上，裸 `use` 会命中 `UserRepository`、
// `because`、`abuse`、`reuse` 内部。那不是"多认一种写法"，而是让真·废弃项被漏判，
// 严重时还会把它归成 canonical（见下方 isDeprecationSubject 的注释）。
const REDIRECT_MARKER =
  /(改用|请用|请调用|改为|换成|替换为|替代为|替代|取代|迁移到|迁移至|请走|务必走|统一走|参见|详见|见 |新接口|新版本|权威实现是|→|->|=>|(?:^|[^a-z])(?:use|instead|replaced\s+by|superseded\s+by|moved\s+to|switch\s+to)(?![a-z]))/i;

// 筛选"哪些行算废弃行"。classifyEntity 与 semantic.js 都复用它，MUST NOT 再抄一份字面量。
// 「已下线 / 已弃用 / 已移除」只认带状态前缀的形态：裸的「移除」「下线」会命中
// "移除了字段校验""下线了灰度开关"这类描述改动的普通句子，把权威接口误判成废弃。
// **停用 MUST NOT 进本表**（哪怕带前缀）——"本功能已停用于灰度"是常见写法，
// 它只在下面的 DEPRECATION_ANCHOR 里参与"已确认是废弃行"之后的就近归属。
const DEPRECATION_KEYWORD =
  /(废弃|中间产物|不可用|deprecated|(?:已|现已|即将)(?:下线|弃用|移除))/i;

/**
 * 一行文本是否带废弃标记。**行级**判据，MUST NOT 拿去判一整段：
 * card 的「对外接口」表里通常一行废弃、其余行权威，整段判会把同表的权威接口一起打成废弃。
 * 导出是为了让 `semantic.js` 复用同一套字面量——废弃判据每多一套，就多一处
 * "这里说废弃、那里说权威"的分歧，而这正是权威位要消灭的东西。
 */
export const hasDeprecationKeyword = (line) => DEPRECATION_KEYWORD.test(line);

/**
 * 段落标题是否宣告"这一整节都是废弃物"（card 模板里的「废弃/中间产物标记 ★防误用」节）。
 * 与 `hasDeprecationKeyword` 的分工：标题命中 → 整节都是废弃项；标题不命中 → 只能逐行判。
 */
export const isDeprecationSectionTitle = (title) => /废弃|中间产物|deprecat/i.test(title || '');

// 就近归属时给"被废弃的那个"用的锚点词，比上面宽。放宽是安全的：本表只在**已确认是废弃行**
// 的行内用于定位（要么整段是废弃段，要么该行已被 DEPRECATION_KEYWORD 选中），
// MUST NOT 拿它去筛选行——那会把"本功能已停用于灰度"之类的普通句子也当成废弃声明。
const DEPRECATION_ANCHOR = /(废弃|中间产物|不可用|deprecated|停用|下线|弃用|移除)/i;

/**
 * 判断一行里出现的 entity 是"被废弃的那个"还是"该改用的那个"。
 *
 * card 最标准的废弃写法就是把两者写在同一行（`assets/context-layer/card.md` 的模板正是这么诱导的）：
 *   - `POST /v1/word/record`（已废弃，请改用 `POST /v2/word/record`）
 * 只判"这一行含废弃关键词且含 entity"会把 **v2 也判成 deprecated**——权威位的核心承诺
 * "信哪个"当场反过来：问 canonical 接口，`ctx` 告诉你它已废弃。所以这不是边缘情况。
 *
 * 判据 MUST NOT 写成"在指向词之后即替代物"：那只覆盖「旧（已废弃，请改用 新）」一种句序。
 * 「请改用 `POST /v2/x`；`POST /v1/x` 已废弃」是同样常见的写法，指向词在最前，按位置判会把
 * **已废弃的 v1 漏判**；它又落在「对外接口」节里，于是被下游归成 **canonical**——问权威接口，
 * `ctx` 把废弃的那个给你。方向与上面那个 bug 相同，危害更大（静默）。
 *
 * 改用**就近归属**：废弃关键词与指向词都在行内时，entity 离谁近就归谁。两种句序都成立，
 * 因为中文英文都把"被废弃的那个"写在废弃词旁、"该改用的那个"写在指向词旁。
 * 距离相等时判 deprecated——宁可多报一次废弃，也不把废弃的说成权威的。
 *
 * **行内没有指向词时 MUST NOT 整行通吃。** 指向词表再长也是闭表，
 * 「权威实现是 X」「已被 X 取代」「| 废弃项 | 替代 |」这类写法必然漏在表外；
 * 一旦漏出，行内的**替代物**也会被判 deprecated，自检植入的必错样本（把 canonical
 * 谎称废弃）于是"通过"，门禁判自己 GATE-BROKEN——而报错说的是"门禁形同虚设"，
 * 真因却是使用者 card 里的一句措辞，照提示永远查不出来。
 * 所以无指向词时改判**离废弃锚点最近的那个候选实体**：候选取行内的反引号代码片段，
 * 表格行再补上单元格。只有一个候选（或认不出候选）时才回到"整行判废弃"。
 */

/** 行内"看起来是实体"的位置区间：反引号代码片段。 */
function entitySpans(hay) {
  return [...hay.matchAll(/`[^`\n]+`/g)].map((m) => [m.index, m.index + m[0].length]);
}

/** 表格行的非空单元格区间（不含首尾竖线外的空片段）。 */
function tableCells(hay) {
  if (!hay.trim().startsWith('|')) return [];
  const cells = [];
  let pos = 0;
  for (const part of hay.split('|')) {
    if (part.trim()) cells.push([pos, pos + part.length]);
    pos += part.length + 1;
  }
  return cells;
}

/** span 到某个位置的距离（位置落在区间内记 0）。 */
const spanDist = (idx, [a, b]) => (idx < a ? a - idx : idx >= b ? idx - b : 0);

/**
 * 一行里首个非空单元格（表格行的"主语"列）。非表格行返回 null。
 * card 的「对外接口」表每行描述的是**第一列那个接口**，后面的"备注"列是对它的说明；
 * 说明里提到别的接口（"替代 `POST /v1/x`（已废弃）"）不代表这一行在声明那个接口的状态。
 */
function subjectCell(hay) {
  const cells = tableCells(hay);
  return cells.length >= 2 ? cells[0] : null;
}

/**
 * @param {boolean} inDeprecationContext 该行是否处在**已确认的废弃语境**里
 *        （card 的废弃段内，或 registry 的「废弃/中间产物替代」列内）。
 *        只有此时表格行才能按列序判——因为那种表的第一列**约定**就是被废弃项。
 *        普通段落里的表格行（典型是「对外接口」表）第一列是**权威**接口，
 *        按列序判会让权威与废弃**双向反转**：问 canonical 得到 deprecated、
 *        问 deprecated 得到 canonical，且 probe 自检会因此判自己 GATE-BROKEN。
 */
function isDeprecationSubject(line, entity, inDeprecationContext = false) {
  const hay = norm(line);
  const needle = norm(entity);
  if (!needle) return false;
  const at = hay.indexOf(needle);
  // norm 保留空格，entity 与 card 里的空格写法偶有出入；去空格后仍匹配得上就保守判废弃
  // （拿不到可比的位置，此时 MUST 倒向"多报废弃"这一侧）。
  if (at < 0) return normTight(line).includes(normTight(entity));

  // 废弃语境下的表格行 MUST 按**列序**判，MUST NOT 按距离：`| 废弃项 | 替代 | 原因 |`
  // 里的废弃锚点落在最后的"原因"列，离替代物反而更近，按距离判会把两者判反。
  const subject = subjectCell(hay);
  if (subject && inDeprecationContext) {
    const [a, b] = subject;
    return at >= a && at < b;
  }
  // 普通段落里的表格行：只有落在**主语列**的实体才可能是本行声明的废弃对象；
  // 出现在备注列里的其它接口，由它自己那一行（或废弃段）去判。
  if (subject && (at < subject[0] || at >= subject[1])) return false;

  const kw = DEPRECATION_ANCHOR.exec(hay);
  const marker = REDIRECT_MARKER.exec(hay);
  const spans = entitySpans(hay);
  const owning = spans.find(([a, b]) => at >= a && at < b);

  // 行内只有一个反引号实体、且 entity 就是它：无需消歧——调用方已确认这是废弃行，
  // 那唯一的实体就是被废弃的那个。位置与措辞（`已废弃：X` / `迁移到新网关前请先停用 X` /
  // `X — …请先停用它`）在这里都不影响结论，套距离或前后规则反而会判反。
  if (owning && spans.length === 1) return true;

  if (marker && kw) return Math.abs(at - kw.index) <= Math.abs(at - marker.index);

  if (marker) {
    // 有指向词、无废弃锚点。区分点是**指向词后面还有没有实体**，不是距离：
    //   · `X（replaced by Y）`——指向词之后有 Y，那 Y 就是替代物 → 沿用"指向词之前即被废弃"；
    //   · `X 已被 Y 取代`——指向词在所有实体之后，此时紧挨它的最后一个实体才是替代物。
    // 按距离判会把第一种判反（`（replaced by` 里指向词其实离 X 更近）。
    if (spans.some(([a]) => a > marker.index)) return at < marker.index;
    if (spans.length >= 2 && owning) {
      const lastStart = Math.max(...spans.map(([a]) => a));
      return owning[0] < lastStart;
    }
    return at < marker.index;
  }

  // 无指向词：MUST NOT 整行通吃（指向词表再长也是闭表，漏在表外的写法会让替代物一起被判废弃，
  // 进而让自检的必错样本"通过"、门禁判自己 GATE-BROKEN）。只有离废弃锚点最近的候选算被废弃。
  if (!kw) return true;
  if (spans.length < 2 || !owning) return true;
  const nearest = Math.min(...spans.map((sp) => spanDist(kw.index, sp)));
  return spanDist(kw.index, owning) <= nearest;
}

/**
 * 判定一个实体在 context 层里的权威状态：deprecated / canonical / unknown。
 * 先判废弃（废弃段/含废弃标记的行/registry 废弃列），再判 canonical（registry 权威接口/card 接口行）。
 */
export function classifyEntity(cards, registry, entity) {
  const e = entity;
  for (const card of cards) {
    for (const [title, body] of Object.entries(card.sections)) {
      if (!isDeprecationSectionTitle(title)) continue;
      // MUST 按行判，MUST NOT 整段判：废弃段里几乎必然写着"改用哪个"，
      // 整段判会把段里提到的替代物一起打成废弃。
      for (const line of body.split(/\r?\n/)) {
        if (isDeprecationSubject(line, e, true)) return 'deprecated';
      }
    }
    for (const line of card.raw.split(/\r?\n/)) {
      if (hasDeprecationKeyword(line) && isDeprecationSubject(line, e, false)) return 'deprecated';
    }
  }
  // registry 的「废弃/中间产物替代」列本身就是废弃语境，但列里同样可能一格写全"旧废弃、改用新"
  // （README §card 格式约定 把这称作推荐写法），所以 MUST NOT 裸 includes——那会把替代物
  // 一起判废弃，进而让自检的必错样本"通过"、门禁判自己 GATE-BROKEN。
  // 同一行的权威接口列点名了该实体时优先判 canonical：本行自己就声明了它是权威的。
  for (const r of registry) {
    if (!r.deprecated || !isDeprecationSubject(r.deprecated, e, true)) continue;
    if (r.canonicalApi && includesTight(r.canonicalApi, e)) return 'canonical';
    return 'deprecated';
  }
  for (const r of registry) if (r.canonicalApi && includesTight(r.canonicalApi, e)) return 'canonical';
  for (const card of cards) {
    const sec = card.sections['对外接口'] || '';
    for (const line of sec.split(/\r?\n/)) {
      // MUST 判该实体是不是这一行的**主语**：`| \`/v2/x\` | … | 替代 \`/v1/x\`（已废弃）|`
      // 整行含 "v2"，裸 includes 会把备注列里的 **/v1/x 也判成 canonical**——问废弃接口，
      // ctx 回答"权威"，正是本层要消灭的失效。
      if (!includesTight(line, e)) continue;
      const subject = subjectCell(norm(line));
      const at = norm(line).indexOf(norm(e));
      if (subject && !(at >= subject[0] && at < subject[1])) continue;
      if (/canonical|v2|v3/i.test(line)) return 'canonical';
    }
  }
  return 'unknown';
}

/**
 * 回答一道 probe，返回 {actual, pass}。
 * @param {object} [ctx] 交接题型（B 类）用的上下文：`{root: 项目根, ctxDir: engineering-context 目录}`。
 *                       A 类题型不读它，老调用方三参数照旧。
 */
export function answerProbe(cards, registry, probe, ctx = {}) {
  if (probe.type === 'capability-mapping') {
    const row = registry.find((r) => norm(r.capability) === norm(probe.input))
      || registry.find((r) => norm(r.capability).includes(norm(probe.input)) && norm(probe.input).length > 0);
    if (!row) return { actual: 'NOT-FOUND', pass: false };
    // 该能力被登记了多条互相矛盾的权威实现时 MUST 判 FAIL，MUST NOT 让 `registry.find` 静默取第一条。
    // 这道题问的就是"这个能力信哪个"，registry 里并列着两个答案时它已经没有正确答案了；
    // 取第一条会让门禁在权威位失效的当口显示绿色——而"同一能力多处实现时信哪个"正是权威位
    // 唯一的承诺，它失效的直接证据就是这种冲突，最该在门禁里红的就是它。
    // 判据 MUST 复用 cards.js 的 registryConflicts，MUST NOT 另写一套：那边刻意只比权威实现列
    // （最小表升级到完整表时同一行留在两处只有仓库列差异，拼起来比会误报），两套判据一漂移，
    // discover 报冲突而门禁全绿（或反过来），使用者无从判断该信谁。
    const conflict = registryConflicts(registry).find((c) => norm(c.capability) === norm(row.capability));
    if (conflict) {
      return {
        actual: `CONFLICT：registry 里有 ${conflict.canonicals.length} 条互相矛盾的登记（${conflict.canonicals.join(' / ')}），先收敛`,
        pass: false,
      };
    }
    // 期望串两种写法：`权威仓库 :: 权威实现`（完整 schema）与 `权威实现`（最小 schema 只有三列）。
    const parts = String(probe.expected || '').split('::').map((x) => x.trim());
    const wantApi = parts.length > 1 ? parts.slice(1).join('::').trim() : parts[0];
    const wantRepo = parts.length > 1 ? parts[0] : '';
    // registry 没有"权威仓库"列时（最小 schema），仓库维度根本不存在，无从比对 → 只判权威实现。
    // 否则期望串一写 `repo :: api` 就恒失败，一道好题变成永久红点，污染棘轮基线。
    const repoComparable = Boolean(norm(row.canonicalRepo)) && Boolean(norm(wantRepo));
    const actual = row.canonicalRepo
      ? `${row.canonicalRepo} :: ${row.canonicalApi}`
      : `${row.canonicalApi}（registry 未声明权威仓库列，仓库维度不参与比对）`;
    const pass = Boolean(normTight(wantApi))
      && (!repoComparable || norm(row.canonicalRepo) === norm(wantRepo))
      && includesTight(row.canonicalApi, wantApi);
    return { actual, pass };
  }
  if (probe.type === 'deprecated-trap') {
    const actual = classifyEntity(cards, registry, probe.input);
    return { actual, pass: actual === norm(probe.expected) };
  }
  if (handoffKind(probe.type)) return answerHandoffProbe(probe, ctx);
  return { actual: `UNSUPPORTED-TYPE(${probe.type})`, pass: false };
}

// ─────────────── 零上下文交接题型（eng-spec §3.6 四项可达性检查） ───────────────
// 目标（eng-spec §3.1）：项目对任何接手者都做到零上下文交接——需求 / 架构 / 实现三层真相源
// 都能从项目自身定位。目标不可验证就等于没有，所以四项全部做成机器可判定的可达性检查。

/** 题型别名 → 规范名；表里可写中文题名。认不出返回 null。 */
export function handoffKind(type) {
  const t = norm(type);
  const alias = {
    'requirement-reachable': 'requirement-reachable',
    '需求真相源可达': 'requirement-reachable',
    'architecture-reachable': 'architecture-reachable',
    '架构真相源可达': 'architecture-reachable',
    'implementation-usable': 'implementation-usable',
    '实现真相源可用': 'implementation-usable',
    'rationale-traceable': 'rationale-traceable',
    '设计理由可追': 'rationale-traceable',
  };
  return alias[t] || null;
}

const DEFAULT_HOPS = 2;
const DEFAULT_INDEX = 'docs/index.md';

/** 期望串里的跳数上限（`≤2 跳` / `2`）；没写按 §3.6 的 ≤2 跳。 */
function hopLimit(expected) {
  const m = /(\d+)/.exec(String(expected || ''));
  return m ? Number(m[1]) : DEFAULT_HOPS;
}

/** 仓内相对路径统一用 `/`；解析 `.` / `..`，去掉前导 `./`。 */
function normRel(rel) {
  const parts = [];
  for (const seg of String(rel || '').replace(/\\/g, '/').split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') { parts.pop(); continue; }
    parts.push(seg);
  }
  return parts.join('/');
}
/** 相对路径 → 绝对路径（跨平台：按 `/` 切段后交给 path.join）。 */
const absOf = (root, rel) => path.join(root, ...normRel(rel).split('/').filter(Boolean));
const existsRel = (root, rel) => Boolean(normRel(rel)) && fs.existsSync(absOf(root, rel));
function readRel(root, rel) {
  try { return fs.readFileSync(absOf(root, rel), 'utf8'); } catch { return null; }
}
/** `路径#锚点` → {file, anchor}。 */
function splitAnchor(spec) {
  const s = String(spec || '').trim();
  const i = s.indexOf('#');
  return i < 0 ? { file: s, anchor: '' } : { file: s.slice(0, i).trim(), anchor: s.slice(i + 1).trim() };
}
const isExternalTarget = (t) => /^[a-z][a-z0-9+.-]*:/i.test(t) || t.startsWith('//');

/** 交接入口文档：仓库根的 README*.md 与 docs/index.md（§3.4 需求层"二选一即可"）。 */
export function entryDocs(root) {
  const out = [];
  let names = [];
  try { names = fs.readdirSync(root); } catch { return out; }
  for (const n of names.sort()) if (/^readme.*\.md$/i.test(n)) out.push(n);
  if (existsRel(root, DEFAULT_INDEX)) out.push(DEFAULT_INDEX);
  return out;
}

/** 抽 markdown 链接目标（行内式 + 引用式），不含外链判定。 */
function linkTargets(raw) {
  const out = [];
  for (const m of String(raw).matchAll(/\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g)) out.push(m[1]);
  for (const m of String(raw).matchAll(/^\s*\[[^\]]+\]:\s*(\S+)/gm)) out.push(m[1]);
  return out;
}

/** 把某文档里的链接解析成仓内相对路径；外链/无法解析返回 null。 */
function resolveLink(fromRel, target) {
  const { file, anchor } = splitAnchor(target);
  if (!file) return { rel: normRel(fromRel), anchor };
  if (isExternalTarget(file)) return null;
  const dir = fromRel.includes('/') ? fromRel.slice(0, fromRel.lastIndexOf('/')) : '';
  const joined = file.startsWith('/') ? file : (dir ? `${dir}/${file}` : file);
  const rel = normRel(joined);
  return rel ? { rel, anchor } : null;
}

/** 锚点是否在该文档里对应到一个标题（兼容 `中文小节` 与 `github-style-slug`）。 */
function hasAnchor(raw, anchor) {
  if (!anchor) return true;
  let want = anchor;
  try { want = decodeURIComponent(anchor); } catch { /* 保留原串 */ }
  const key = normTight(want).replace(/-/g, '');
  if (!key) return true;
  for (const line of String(raw).split(/\r?\n/)) {
    const m = /^#{1,6}\s+(.+?)\s*$/.exec(line);
    if (m && normTight(m[1]).replace(/-/g, '').includes(key)) return true;
  }
  return false;
}

/** 取某个小节正文：从命中的标题起，到下一个同级或更高级标题止。 */
function sectionOf(raw, anchor) {
  const lines = String(raw).split(/\r?\n/);
  const key = normTight(anchor).replace(/-/g, '');
  const out = [];
  let level = 0;
  let inSection = false;
  for (const line of lines) {
    const m = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (m) {
      const head = normTight(m[2]).replace(/-/g, '');
      if (!inSection) { if (head.includes(key)) { inSection = true; level = m[1].length; } continue; }
      if (m[1].length <= level) break;
    }
    if (inSection) out.push(line);
  }
  return out.join('\n');
}

/**
 * 从入口文档出发做 BFS，判定真相源是否在 maxHops 跳内可达。
 * @returns {{hops:number|null, reason:string}} hops=null 表示不可达，reason 说明原因（进 actual）。
 */
export function reachTruthSource(root, targetSpec, maxHops = DEFAULT_HOPS) {
  const entries = entryDocs(root).map(normRel);
  if (!entries.length) return { hops: null, reason: 'NO-ENTRY-DOC：仓库根没有 README*.md，也没有 docs/index.md' };
  const { file, anchor } = splitAnchor(targetSpec);
  const targetRel = normRel(file);
  if (!targetRel) return { hops: null, reason: 'BAD-TARGET：探针未指定真相源路径' };
  if (!existsRel(root, targetRel)) return { hops: null, reason: `MISSING:${targetRel}` };
  if (anchor) {
    const raw = readRel(root, targetRel);
    if (raw === null || !hasAnchor(raw, anchor)) return { hops: null, reason: `ANCHOR-MISSING:${targetRel}#${anchor}` };
  }
  let frontier = entries;
  const seen = new Set(frontier);
  for (let depth = 0; depth <= maxHops; depth++) {
    if (frontier.includes(targetRel)) return { hops: depth, reason: '' };
    if (depth === maxHops) break;
    const next = [];
    for (const rel of frontier) {
      if (!/\.md$/i.test(rel)) continue; // 只从 markdown 里继续跳
      const text = readRel(root, rel);
      if (text === null) continue;
      for (const t of linkTargets(text)) {
        const r = resolveLink(rel, t);
        if (!r || !r.rel || seen.has(r.rel) || !existsRel(root, r.rel)) continue;
        seen.add(r.rel);
        next.push(r.rel);
      }
    }
    if (!next.length) break;
    frontier = next;
  }
  return { hops: null, reason: `UNREACHABLE(>${maxHops} 跳)：${targetRel}` };
}

/**
 * 探测项目具备哪些能力位（eng-spec §3.2/§3.3；正交，不是有序三档）。
 * 权威位直接用 `ctx list-services` 是否非空判定——registry 只剩模板占位行时它为空。
 */
export function detectCapabilityBits(root, ctxDir) {
  let graph = false;
  let graphBytes = 0;
  try {
    const st = fs.statSync(path.join(root, '.codegraph', 'codegraph.db'));
    graph = st.isFile();
    graphBytes = st.size;
  } catch { /* 无索引 */ }
  let services = 0;
  try { services = listServices(ctxDir).length; } catch { services = 0; }
  return { graph, graphBytes, curated: services > 0, services };
}

/**
 * 单文件名可以在**没有目录分隔**时仍算路径的扩展名白名单。
 *
 * MUST 用白名单，MUST NOT 用"点号后 1-8 位字母数字就算扩展名"的启发式：架构小节里用反引号
 * 写 API 名是极常见的写法（`` 跨平台全程用 `path.join` 与 `os.tmpdir` ``），启发式会把
 * `path.join` / `os.tmpdir` 当成带扩展名的模块路径并判"模块路径缺失"。而这个题型是**无能力位
 * 项目唯一的实现层门禁**，误判会把它逼成永久红点（再叠加基线段的整数通吃就会被塞进棘轮基线）。
 */
const PATH_EXT = /\.(js|mjs|cjs|jsx|ts|tsx|mts|cts|py|pyi|go|rs|rb|php|java|kt|kts|scala|swift|m|mm|c|h|cc|cpp|hpp|cs|sh|bash|zsh|sql|proto|graphql|md|markdown|rst|txt|json|jsonc|yaml|yml|toml|ini|cfg|conf|xml|html|htm|css|scss|sass|less|vue|svelte|tf|tfvars|gradle|lock|cmake|mk|dockerfile|gemspec|podspec|csproj|sln)$/i;

/**
 * 没有扩展名、但确实是路径的裸文件名，以及点开头的配置文件。
 *
 * 白名单只按扩展名判会漏掉一整类真实路径（`Makefile` / `Dockerfile` / `.env.example`），
 * 而漏掉的后果**不是少报**：架构节列了三条不存在的路径，门禁照样绿，还反过来说"全部存在"——
 * 一个恒绿的门禁比没有门禁更危险。
 *
 * 同形风险的三条硬规则：
 *   · `.env` MUST 写成"点开头"才算——`env` 留在扩展名表里会让 `process.env` 被判成缺失路径；
 *   · `go.mod` / `go.sum` / `cargo.toml` MUST 按**整词**收进本表，MUST NOT 把 `.mod`/`.sum`
 *     当通用扩展名——那会让 `np.mod`、`df.sum`、`math.mod` 这类 API 名被判成缺失路径；
 *   · `readme` / `license` / `notice` 这类**裸词** MUST NOT 进本表——它们在架构散文里
 *     作为普通名词出现的概率远高于作为路径。真要指文件，写成 `README.md` 或带目录即可命中。
 * 判据是白名单，代价就是漏与误两侧都得逐条权衡；这一题是无能力位项目唯一的实现层门禁，
 * 误判即永久红点，漏判则让门禁恒绿——两边都不能凭"看着像"放宽。
 */
const BARE_PATH_NAME =
  /^(makefile|dockerfile|containerfile|gemfile|rakefile|procfile|jenkinsfile|vagrantfile|brewfile|justfile|go\.(mod|sum)|cargo\.(toml|lock)|\.env(\..+)?|\.[a-z][a-z0-9-]*(ignore|rc|config)(\..+)?)$/i;

/** 从架构节里抽"看起来是模块路径"的 token（反引号代码片段 + 相对链接）。 */
function modulePathCandidates(section) {
  const out = [];
  const add = (token) => {
    let s = String(token || '').trim().replace(/^\.\//, '').replace(/\/+$/, '');
    if (!s || /\s/.test(s)) return;
    if (isExternalTarget(s) || s.includes(':')) return;          // 外链与 `node:path` 一类不是路径
    if (/[*?<>|"'`（）()【】]/.test(s) || s.startsWith('#')) return;
    // 候选路径 MUST 含目录分隔，或以白名单扩展名结尾——把"点号后是已知扩展名"
    // 与"点号后是标识符（API 名）"区分开。
    if (!s.includes('/') && !PATH_EXT.test(s) && !BARE_PATH_NAME.test(s)) return;
    const rel = normRel(s);
    if (rel && !out.includes(rel)) out.push(rel);
  };
  for (const m of String(section).matchAll(/`([^`\n]+)`/g)) add(m[1]);
  for (const t of linkTargets(section)) add(splitAnchor(t).file);
  return out;
}

/** 基础条件：架构节列出的模块路径必须都存在。 */
function checkModulePaths(root, input) {
  const { file, anchor } = splitAnchor(input);
  const rel = normRel(file);
  if (!rel) return { ok: false, note: '模块路径：探针未指定架构节（输入应写 <架构文件>#<小节>）' };
  const raw = readRel(root, rel);
  if (raw === null) return { ok: false, note: `模块路径：架构真相源缺失 ${rel}` };
  if (anchor && !hasAnchor(raw, anchor)) return { ok: false, note: `模块路径：架构节缺失 ${rel}#${anchor}` };
  const section = anchor ? sectionOf(raw, anchor) : raw;
  const paths = modulePathCandidates(section);
  const where = anchor ? `${rel}#${anchor}` : rel;
  if (!paths.length) return { ok: false, note: `模块路径：架构节未列出任何模块路径（${where}）——零上下文接手者无从落地` };
  const missing = paths.filter((p) => !existsRel(root, p));
  return missing.length
    ? { ok: false, note: `模块路径：缺失 ${missing.join(', ')}` }
    : { ok: true, note: `模块路径：${where} 列出的 ${paths.length} 个全部存在` };
}

/**
 * 实现真相源可用：架构节列出的模块路径**始终**校验，探测到的每个能力位再**叠加**一项条件。
 *
 * MUST 叠加，MUST NOT 互斥。旧实现只在"既无权威位又无图谱位"时才校验模块路径，于是
 * 三行 registry 就能让实现层门禁永久变绿——与"探测到的每一位都要成立"的承诺相反，
 * 而 selfCheck 又从不为该题型植入必错样本，自检也抓不到。能力位回答的是"找得到/信哪个"，
 * 它不替代"架构节把模块位置讲清楚了"这件事，两者是并列条件。
 */
function checkImplementation(root, ctxDir, probe) {
  const bits = detectCapabilityBits(root, ctxDir);
  const notes = [];
  let ok = true;
  if (bits.curated) notes.push(`权威位：ctx list-services ${bits.services} 条`);
  if (bits.graph) {
    if (bits.graphBytes > 0) notes.push(`图谱位：.codegraph/codegraph.db ${bits.graphBytes} 字节，索引可查询`);
    else { ok = false; notes.push('图谱位：.codegraph/codegraph.db 为空，索引不可查询'); }
  }
  const r = checkModulePaths(root, probe.input);
  if (!r.ok) ok = false;
  notes.push(r.note);
  return { actual: notes.join('；'), pass: ok };
}

/** frontmatter 的 authority_refs 是否已填（空 / 模板占位 / TBD 都算没填）。 */
function hasAuthorityRefs(text) {
  const fm = /^﻿?---\r?\n([\s\S]*?)\r?\n---/.exec(String(text));
  if (!fm) return false;
  const lines = fm[1].split(/\r?\n/);
  const i = lines.findIndex((l) => /^authority_refs\s*:/.test(l));
  if (i < 0) return false;
  const items = [];
  let inline = lines[i].replace(/^authority_refs\s*:/, '');
  if (!/['"]/.test(inline)) inline = inline.replace(/\s#.*$/, '');
  inline = inline.trim();
  if (inline) {
    if (inline.startsWith('[')) items.push(...inline.replace(/^\[/, '').replace(/\]$/, '').split(','));
    else items.push(inline);
  }
  for (let j = i + 1; j < lines.length; j++) {
    const m = /^\s+-\s*(.*)$/.exec(lines[j]);
    if (!m) { if (lines[j].trim() === '') continue; break; }
    items.push(m[1]);
  }
  return items.some((raw) => {
    const v = String(raw).trim().replace(/^['"]/, '').replace(/['"]$/, '').trim();
    if (!v) return false;
    if (/[【】]/.test(v)) return false;                 // 模板占位不算已填
    if (/^(tbd|待填|待定|-|—)$/i.test(v)) return false;
    return true;
  });
}

/**
 * 索引"现行区"里链到的 spec（归档区不参与判定，见 文档治理.md §文档生命周期与索引门控）。
 *
 * 归档区的范围 MUST 按标题**层级**判定：记住命中「归档」时的层级，只有遇到**同级或更高级**
 * 标题才解除（与 sectionOf 的 `m[1].length <= level` 同一套逻辑）。旧实现每遇任意层级标题就
 * 重置，于是 `## 归档` 下按季度分 `### 2026 Q1` 时，`###` 一出现就解除归档，
 * 归档区里链到的文档又回来参与判定——而 README 承诺归档区不参与。
 */
function currentSpecLinks(raw, indexRel) {
  const out = [];
  let archivedLevel = 0;
  for (const line of String(raw).split(/\r?\n/)) {
    const m = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (m) {
      const level = m[1].length;
      if (archivedLevel && level <= archivedLevel) archivedLevel = 0;
      if (!archivedLevel && /归档|archive/i.test(m[2])) archivedLevel = level;
      continue;
    }
    if (archivedLevel) continue;
    for (const t of linkTargets(line)) {
      const r = resolveLink(indexRel, t);
      if (!r || !/\.md$/i.test(r.rel)) continue;
      // 只认 `spec/` 目录下的 .md：本体系的文档目录是固定约定（spec → docs/spec/、
      // plan → docs/plan/、report → docs/report/），索引现行区还会链到 plan/report/外部文档，
      // 全量校验 authority_refs 会误伤它们。这条约束是**判据的一部分**，README §rationale-traceable
      // 已写明；失败串也点明它，别让人对着 NO-SPEC-LINK 猜。
      if (!/(^|\/)spec\//.test(r.rel)) continue;
      if (!out.includes(r.rel)) out.push(r.rel);
    }
  }
  return out;
}

/** 设计理由可追：索引现行区各 spec 的 authority_refs 均非空。 */
function checkRationale(root, input) {
  const indexRel = normRel(splitAnchor(input).file) || DEFAULT_INDEX;
  const raw = readRel(root, indexRel);
  if (raw === null) return { actual: `MISSING:${indexRel}`, pass: false };
  const links = currentSpecLinks(raw, indexRel);
  // 零条目不得算通过——"没有题目所以全绿"正是假门禁。
  if (!links.length) {
    return {
      actual: `NO-SPEC-LINK:${indexRel} 现行区没有链到任何 spec/ 目录下的 .md`
        + '（本判据只认路径含 spec/ 段的 markdown；本项目的 spec 若放在别处，'
        + '请把它们移进 spec/ 目录，或把探针输入指向真正列 spec 的那份索引）',
      pass: false,
    };
  }
  const bad = [];
  for (const rel of links) {
    const text = readRel(root, rel);
    if (text === null) { bad.push(`${rel}（文件缺失）`); continue; }
    if (!hasAuthorityRefs(text)) bad.push(rel);
  }
  return bad.length
    ? { actual: `authority_refs 未填：${bad.join(', ')}`, pass: false }
    : { actual: `${links.length} 篇现行 spec 的 authority_refs 均非空`, pass: true };
}

/** B 类题型的统一入口。root 缺省用 cwd（`ctx probe` 在项目根跑）。 */
function answerHandoffProbe(probe, ctx = {}) {
  const root = ctx.root ? path.resolve(ctx.root) : process.cwd();
  const ctxDir = ctx.ctxDir ? path.resolve(ctx.ctxDir) : path.join(root, 'engineering-context');
  const kind = handoffKind(probe.type);
  if (kind === 'implementation-usable') return checkImplementation(root, ctxDir, probe);
  if (kind === 'rationale-traceable') return checkRationale(root, probe.input);
  const limit = hopLimit(probe.expected);
  const r = reachTruthSource(root, probe.input, limit);
  return r.hops === null
    ? { actual: r.reason, pass: false }
    : { actual: `hops=${r.hops}（限 ≤${limit} 跳）`, pass: r.hops <= limit };
}

/**
 * 门禁自检：植入"必然失败"的样本，验证门禁真的会判 FAIL（而非永远全绿）。
 * 抓不到 → 门禁失效。context 层为空且题集里没有交接题型 → 无法自检（也算失败）。
 * @param {{root?:string, ctxDir?:string}} [ctx] 传了 root 才植入交接题型样本（由 evaluateGate 按题集决定）
 * @returns {{ok:boolean, reason:string, planted:Array}}
 */
export function selfCheck(cards, registry, ctx = {}) {
  // ctx.root 由 evaluateGate 在"题集里确实有交接题型"时传入：交接题型不依赖 cards/registry，
  // 所以能在 context 层为空的项目上照样植入必错样本。没有交接题型时判据不变，不得放水。
  const canPlantHandoff = Boolean(ctx.root);
  if (registry.length === 0 && cards.length === 0 && !canPlantHandoff) {
    return { ok: false, reason: 'context 层为空（无 registry/cards），无法自检', planted: [] };
  }
  const planted = [];
  // 样本1：capability-mapping，给一个必然错误的权威映射 → 门禁应判 FAIL。
  if (registry.length) {
    const cap = registry[0].capability;
    const p = { n: 'self-map', type: 'capability-mapping', input: cap, expected: '__nonexistent-repo__ :: __nonexistent-api__' };
    planted.push({ ...p, ...answerProbe(cards, registry, p) });
  }
  // 样本2：deprecated-trap，把一个 canonical 接口谎称 deprecated → 门禁应判 FAIL。
  const canon = registry.find((r) => r.canonicalApi);
  if (canon) {
    const p = { n: 'self-dep', type: 'deprecated-trap', input: canon.canonicalApi, expected: 'deprecated' };
    planted.push({ ...p, ...answerProbe(cards, registry, p) });
  }
  // 样本3（交接题型）：指向一个必然不存在的真相源 → 门禁应判 FAIL。
  // 它只依赖项目文件，不依赖 context 层，所以直读项目也能有真门禁。
  if (canPlantHandoff) {
    const p = {
      n: 'self-reach',
      type: 'requirement-reachable',
      input: '__ai-dev-system-selfcheck__/__no-such-truth-source__.md',
      expected: '≤2 跳',
    };
    planted.push({ ...p, ...answerProbe(cards, registry, p, ctx) });
    // 样本4：implementation-usable，指向必然不存在的架构节 → 门禁应判 FAIL。
    // 这道样本此前无法成立：旧实现探测到任一能力位就无条件通过，植入什么都抓不到。
    // 模块路径校验改成叠加后它才有意义，也正是那条修复的自检保险。
    const q = {
      n: 'self-impl',
      type: 'implementation-usable',
      input: '__ai-dev-system-selfcheck__/__no-such-architecture__.md#__no-such-section__',
      expected: 'usable',
    };
    planted.push({ ...q, ...answerProbe(cards, registry, q, ctx) });
  }
  if (planted.length === 0) {
    return { ok: false, reason: '无法构造自检样本（registry 缺权威条目）', planted };
  }
  // 每个植入样本都必须 FAIL；若任一 PASS，说明门禁不会判错 → 形同虚设。
  const leaked = planted.filter((p) => p.pass);
  return leaked.length === 0
    ? { ok: true, reason: '植入的必错样本全部被判 FAIL，门禁有效', planted }
    : { ok: false, reason: `植入的必错样本竟通过（${leaked.map((p) => p.n).join(',')}），门禁形同虚设`, planted };
}

/**
 * 评估门禁（不依赖时钟；交接题型会读项目文件，除此之外无 IO）：自检 → 跑真实探针 → 加权打分 + 双向棘轮 → 定级。
 *
 * 规则（与 context-engineering.md §6 / probe-set.md 一致）：
 *   · blocking 探针失败 = 零容忍，直接 RED（不受基线豁免）。
 *   · scored 探针按 weight 计**加权通过率**；低于 floor（默认关闭，CLI 传 0.9）= RED。
 *   · 棘轮**双向**：基线外新失败 = RED；基线内已不再失败 = staleBaseline，必须删除，也 RED（只许变短）。
 *   · needs-reconfirm / quarantined 的探针 ground truth 可能过期，暂不计分，只报告（探针自防腐）。
 *   · 未暂停的探针数为 0（题集为空 / 全是占位行 / 全被暂停）= NO-PROBE，退出码同 RED。
 *     注意判据是 **active（未暂停）**，不是 scored：全 blocking 且全过时门禁是有效的，
 *     只是没有计分题 → passRate 为 null（CLI 打印成"—"，MUST NOT 当 0 参与运算）。
 * @returns {{selfCheck, results, failing, newFailures, blockingFailures, staleBaseline, needsReconfirm, passRate, floor, belowFloor, verdict, canTightenBaseline}}
 */
export function evaluateGate(cards, registry, probes, baseline, options = {}) {
  const floor = typeof options.floor === 'number' ? options.floor : 0;
  // 交接题型要读项目自身文件：root 默认 cwd（`ctx probe` 在项目根跑），ctxDir 默认 <root>/engineering-context。
  const root = options.root ? path.resolve(options.root) : process.cwd();
  const probeCtx = { root, ctxDir: options.ctxDir ? path.resolve(options.ctxDir) : path.join(root, 'engineering-context') };
  const hasHandoff = probes.some((p) => handoffKind(p.type));
  const sc = selfCheck(cards, registry, hasHandoff ? probeCtx : {});
  if (!sc.ok) {
    return { selfCheck: sc, results: [], failing: [], newFailures: [], blockingFailures: [], staleBaseline: [], needsReconfirm: [], passRate: null, floor, belowFloor: false, verdict: 'GATE-BROKEN', canTightenBaseline: false };
  }
  const results = probes.map((p) => ({ ...p, ...answerProbe(cards, registry, p, probeCtx) }));
  // needs-reconfirm / quarantined：权威面已变，ground truth 待重认，暂不计入打分。
  const needsReconfirm = results.filter((r) => r.status === 'needs-reconfirm' || r.status === 'quarantined');
  const active = results.filter((r) => r.status !== 'needs-reconfirm' && r.status !== 'quarantined');
  const failing = active.filter((r) => !r.pass);
  const newFailures = failing.filter((r) => !baseline.has(String(r.n)));
  const blockingFailures = failing.filter((r) => r.severity === 'blocking');
  // 双向棘轮：基线里已不再失败的编号必须删除。
  // 例外：needs-reconfirm/quarantined 的探针只是暂停计分（ground truth 待重认），
  // 不代表已修复，不得据此判基线过期。
  const failingSet = new Set(failing.map((r) => String(r.n)));
  const pausedSet = new Set(needsReconfirm.map((r) => String(r.n)));
  const staleBaseline = [...baseline].filter((n) => !failingSet.has(String(n)) && !pausedSet.has(String(n)));
  // 加权通过率：仅统计 scored 题（blocking 走零容忍，不进通过率分母）。
  const scored = active.filter((r) => r.severity !== 'blocking');
  const totalW = scored.reduce((s, r) => s + r.weight, 0);
  // 一道计分题都没有时 passRate MUST 为 null，MUST NOT 兜底成 1：
  // `ctx init` 的脚手架全是 `【…】` 占位行，整表被（正确地）跳过，旧实现于是判 GREEN 100%、
  // 退出 0——README 教的 CI 判据 `.verdict=="GREEN" or "AMBER"` 在一道题都没跑时通过，
  // 正是 README 自己点名的"没有题目所以全绿"假门禁。
  const passW = scored.filter((r) => r.pass).reduce((s, r) => s + r.weight, 0);
  const passRate = totalW ? passW / totalW : null;
  const belowFloor = floor > 0 && passRate !== null && passRate < floor;
  const noActiveProbe = active.length === 0;
  const verdict = noActiveProbe
    ? 'NO-PROBE'
    : blockingFailures.length || newFailures.length || staleBaseline.length || belowFloor
      ? 'RED'
      : failing.length
      ? 'AMBER'
      : 'GREEN';
  return { selfCheck: sc, results, failing, newFailures, blockingFailures, staleBaseline, needsReconfirm, passRate, floor, belowFloor, verdict, canTightenBaseline: staleBaseline.length > 0 || failing.length < baseline.size };
}

/** 读上周期通过率（.index/probe-history.json）。 */
export function readHistory(ctxDir) {
  const f = path.join(ctxDir, '.index', 'probe-history.json');
  if (!fs.existsSync(f)) return null;
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; }
}

/** 写本周期通过率（供下次算衰减）。at 由调用方传入（避免核心逻辑依赖时钟）。 */
export function writeHistory(ctxDir, passRate, at) {
  const dir = path.join(ctxDir, '.index');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'probe-history.json'), JSON.stringify({ passRate, at }, null, 2) + '\n', 'utf8');
}
