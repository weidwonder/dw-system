// probe.js — ctx probe：Frozen Probe Set 防腐门禁（零依赖、可打分、跨平台）
//
// 理念（与 references/capability/context-engineering.md 一致，务必保留）：
//   · 冻结题集，每发布周期重跑，检测 context 层"衰减"，不当回归基线。
//   · 门禁自检：真跑前先植入必然失败的样本，抓不到 → 门禁形同虚设 → 流水线红。
//   · 棘轮：容忍的腐化债登记为基线；新增失败 = RED；只许变短。
//
// 机器可判题型（两类）：
//   A. context 层题型（读 cards/registry）
//     capability-mapping  输入=能力名，期望=`权威实现` 或 `权威仓库 :: 权威实现`。按 registry 求解比对。
//     deprecated-trap     输入=接口/实体，期望=`deprecated`（或 canonical）。按 cards/registry 判定其权威状态。
//   B. 零上下文交接题型（读项目自身文件，见 eng-spec §3.6 四项可达性检查）
//     requirement-reachable    输入=需求真相源（`路径` 或 `路径#小节`），期望含跳数上限（默认 ≤2 跳）
//     architecture-reachable   同上，指向架构真相源
//     implementation-usable    按探测到的能力位分支：无 → 架构节列出的模块路径均存在；
//                              图谱位 → `.codegraph/codegraph.db` 可查询；权威位 → `ctx list-services` 非空
//     rationale-traceable      输入=索引路径（默认 docs/index.md），现行区各 spec 的 authority_refs 均非空
//
//   B 类题型需要项目根目录：由 evaluateGate 的 `options.root`（默认 process.cwd()）给出，
//   与 A 类共用同一套 severity/weight/status/authority_refs 自防腐与棘轮机制。

import fs from 'node:fs';
import path from 'node:path';
import { listServices } from './commands.js';
import { isRegistryPlaceholder } from './cards.js';

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
const BASELINE_NUM = /^\s*(?:[-*+]\s*)?#?(\d+)(?![\d.\-/:])/;

/**
 * 解析 probe-set.md：探针表（表头首列 '#'，次列含 类型/type）+ 基线（棘轮）段的编号。
 * 模板占位行（`【…】`）不算探针，单列在 skipped 里供 CLI 提示——不提示的话
 * "6 道题只跑了 0 道"会被读成解析坏了。
 * @returns {{probes:Array<{n,type,input,expected}>, baseline:Set<string>, skipped:string[]}}
 */
export function loadProbes(ctxDir) {
  const file = path.join(ctxDir, 'probe-set.md');
  if (!fs.existsSync(file)) return { probes: [], baseline: new Set(), skipped: [] };
  const raw = fs.readFileSync(file, 'utf8');
  const lines = raw.split(/\r?\n/);

  const probes = [];
  const skipped = [];
  let inTable = false;
  let headerCols = null;
  let baselineMode = false;
  const baseline = new Set();

  for (const line of lines) {
    if (/^##\s/.test(line)) {
      baselineMode = /基线|baseline|棘轮|ratchet/i.test(line);
      inTable = false;
      continue;
    }
    if (baselineMode) {
      // 只认**独立成行**的编号（见 BASELINE_NUM）与表格首列；散在句子里的数字一律不算。
      // "（空）"/None 这类写法自然不含合法编号 → 空基线。
      const cells = parseRow(line);
      if (cells) {
        if (!isSeparator(cells)) {
          const m = /^#?(\d+)$/.exec(cells[0] || '');
          if (m) baseline.add(m[1]);
        }
        continue;
      }
      const m = BASELINE_NUM.exec(line);
      if (m) baseline.add(m[1]);
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
  return { probes, baseline, skipped };
}

// 废弃行里指向替代物的措辞。
// ASCII 词 MUST 带词边界：判据跑在 norm() 之后的串上，裸 `use` 会命中 `UserRepository`、
// `because`、`abuse`、`reuse` 内部。那不是"多认一种写法"，而是让真·废弃项被漏判，
// 严重时还会把它归成 canonical（见下方 isDeprecationSubject 的注释）。
const REDIRECT_MARKER =
  /(改用|请用|改为|换成|替换为|替代为|迁移到|迁移至|请走|务必走|→|->|=>|(?:^|[^a-z])(?:use|instead)(?![a-z]))/i;

// 筛选"哪些行算废弃行"。classifyEntity 复用它，MUST NOT 再抄一份字面量。
const DEPRECATION_KEYWORD = /(废弃|中间产物|不可用|deprecated)/i;

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
 */
function isDeprecationSubject(line, entity) {
  const hay = norm(line);
  const needle = norm(entity);
  if (!needle) return false;
  const at = hay.indexOf(needle);
  // norm 保留空格，entity 与 card 里的空格写法偶有出入；去空格后仍匹配得上就保守判废弃
  // （拿不到可比的位置，此时 MUST 倒向"多报废弃"这一侧）。
  if (at < 0) return normTight(line).includes(normTight(entity));
  const marker = REDIRECT_MARKER.exec(hay);
  if (!marker) return true;
  const kw = DEPRECATION_ANCHOR.exec(hay);
  // 废弃段内的行可以不含废弃关键词（整段就是废弃段），此时沿用"指向词之前"。
  if (!kw) return at < marker.index;
  return Math.abs(at - kw.index) <= Math.abs(at - marker.index);
}

/**
 * 判定一个实体在 context 层里的权威状态：deprecated / canonical / unknown。
 * 先判废弃（废弃段/含废弃标记的行/registry 废弃列），再判 canonical（registry 权威接口/card 接口行）。
 */
export function classifyEntity(cards, registry, entity) {
  const e = entity;
  for (const card of cards) {
    for (const [title, body] of Object.entries(card.sections)) {
      if (!/废弃|中间产物|deprecat/i.test(title)) continue;
      // MUST 按行判，MUST NOT 整段判：废弃段里几乎必然写着"改用哪个"，
      // 整段判会把段里提到的替代物一起打成废弃。
      for (const line of body.split(/\r?\n/)) {
        if (isDeprecationSubject(line, e)) return 'deprecated';
      }
    }
    for (const line of card.raw.split(/\r?\n/)) {
      if (DEPRECATION_KEYWORD.test(line) && isDeprecationSubject(line, e)) return 'deprecated';
    }
  }
  for (const r of registry) if (r.deprecated && includesTight(r.deprecated, e)) return 'deprecated';
  for (const r of registry) if (r.canonicalApi && includesTight(r.canonicalApi, e)) return 'canonical';
  for (const card of cards) {
    const sec = card.sections['对外接口'] || '';
    for (const line of sec.split(/\r?\n/)) {
      if (includesTight(line, e) && /canonical|v2|v3/i.test(line)) return 'canonical';
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
const PATH_EXT = /\.(js|mjs|cjs|jsx|ts|tsx|mts|cts|py|pyi|go|rs|rb|php|java|kt|kts|scala|swift|m|mm|c|h|cc|cpp|hpp|cs|sh|bash|zsh|sql|proto|graphql|md|markdown|rst|txt|json|jsonc|yaml|yml|toml|ini|cfg|conf|env|xml|html|htm|css|scss|sass|less|vue|svelte|tf|tfvars|gradle|lock|cmake|mk|dockerfile)$/i;

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
    if (!s.includes('/') && !PATH_EXT.test(s)) return;
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
 *   · 计分探针数为 0（题集为空 / 全是占位行 / 全被暂停）= NO-PROBE，passRate 为 null，退出码同 RED。
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
