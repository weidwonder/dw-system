// cards.js — Engineering Context 的读取与解析层（零依赖，跨平台）
import fs from 'node:fs';
import path from 'node:path';

/**
 * 把一份 markdown 按 `## 标题` 切成段落映射。
 * @returns {Record<string,string>} 标题 -> 段落正文
 */
function splitSections(raw) {
  const sections = {};
  const lines = raw.split(/\r?\n/);
  let current = null;
  let buf = [];
  const flush = () => {
    if (current !== null) sections[current] = buf.join('\n').trim();
  };
  for (const line of lines) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m) {
      flush();
      current = m[1].trim();
      buf = [];
    } else if (current !== null) {
      buf.push(line);
    }
  }
  flush();
  return sections;
}

/**
 * 读取 engineering-context/cards/*.md 下的全部 card。
 * @param {string} ctxDir engineering-context 目录
 * @returns {Array<{service:string, path:string, sections:Record<string,string>, raw:string}>}
 */
export function loadCards(ctxDir) {
  const cardsDir = path.join(ctxDir, 'cards');
  if (!fs.existsSync(cardsDir)) return [];
  // 读失败 MUST NOT 冒泡成 Node 栈：一张 card 权限不对、被别的进程占住、或是坏软链，
  // 抛出去的样子是 `Error: EACCES ... at loadCards (cards.js:…)` —— 对着栈没人知道
  // 该做什么，而 agent 见到 ctx 崩了就直接退回裸 grep（本层要消灭的正是这个行为）。
  // 读不出的当作不存在跳过；目录本身读不出时按"没有 cards"处理，诊断由各命令自己给。
  let entries;
  try {
    entries = fs.readdirSync(cardsDir);
  } catch {
    return [];
  }
  const cards = [];
  for (const f of entries) {
    if (!f.endsWith('.md')) continue;
    let raw;
    try {
      raw = fs.readFileSync(path.join(cardsDir, f), 'utf8');
    } catch {
      continue;
    }
    cards.push({
      service: path.basename(f, '.md'),
      path: path.join('cards', f),
      sections: splitSections(raw),
      raw,
    });
  }
  return cards;
}

/**
 * cards/ 目录里读不出来的 card 文件名（权限/编码问题）。**只用于人类可读的提示**：
 * `loadCards` 静默跳过它们，不报的话使用者会看到"这个仓没登记"而真相是"这张卡读不出来"。
 * @returns {string[]}
 */
export function unreadableCards(ctxDir) {
  const cardsDir = path.join(ctxDir, 'cards');
  if (!fs.existsSync(cardsDir)) return [];
  let entries;
  try {
    entries = fs.readdirSync(cardsDir);
  } catch {
    return [];
  }
  const bad = [];
  for (const f of entries) {
    if (!f.endsWith('.md')) continue;
    try {
      fs.readFileSync(path.join(cardsDir, f), 'utf8');
    } catch {
      bad.push(f);
    }
  }
  return bad;
}

/**
 * registry 各字段可接受的表头写法。**按表头名取列，不按列序**——最小合法 schema 只有
 * `Capability` / `权威实现` / `陷阱项（废弃或中间产物）` 三列，其余列 MAY 缺席（留空），
 * 完整模板则有十列；两种形态必须都能解析。匹配按本数组顺序，先到先得。
 */
const REGISTRY_FIELDS = [
  ['capability', [/capability/i, /能力/]],
  ['businessMeaning', [/业务含义/, /含义/]],
  ['canonicalRepo', [/权威仓库/, /仓库/, /repo/i]],
  ['canonicalApi', [/权威实现/, /权威接口/, /实现/, /接口/]],
  ['deprecated', [/陷阱/, /废弃/, /中间产物/]],
  ['compatWindow', [/兼容/]],
  ['owner', [/owner/i, /负责人/]],
  ['testEntry', [/测试/]],
  ['freshness', [/freshness/i, /新鲜/, /最近确认/]],
  ['reason', [/理由/]],
];

const EMPTY_ROW = Object.fromEntries(REGISTRY_FIELDS.map(([k]) => [k, '']));

// 表头首列的判据 MUST 复用 capability 字段自己的模式表，MUST NOT 另写一套只认英文的正则：
// 三列最小形态的另两列列名本来就是中文，首列写「能力」是最自然的写法。只认 /capability/i
// 的后果不是"少认一种别名"，而是整张表不被识别 → 权威位探测为假 → curated 分册不加载 →
// agent 静默退回直读，而输出还会把原因说成"只有模板行"。
const CAPABILITY_HEADER_PATTERNS = REGISTRY_FIELDS[0][1];

const isCapabilityHeader = (cell) => CAPABILITY_HEADER_PATTERNS.some((p) => p.test(cell || ''));

/** 分隔行 `|---|---|`。 */
// GFM 只要求每格 **≥1** 个 `-`，`|-|-|` 与 `|:-:|` 都是合法分隔行。
// MUST NOT 写成 `-{2,}`：表头要靠分隔行确认，认不出分隔行 → 整张 registry 被丢弃 →
// 权威位探测为假 → agent 静默退回裸 grep，而诊断还会把原因说成"表头没写对"。
const isSeparatorRow = (cells) => cells.every((c) => /^:?-+:?$/.test(c.replace(/\s/g, '')) || c === '');

/** 表头单元格 → 字段名映射；认不出的列直接忽略。 */
function mapRegistryHeader(cells) {
  const map = new Map();
  const used = new Set();
  cells.forEach((cell, i) => {
    for (const [field, patterns] of REGISTRY_FIELDS) {
      if (used.has(field)) continue;
      if (patterns.some((p) => p.test(cell))) {
        map.set(field, i);
        used.add(field);
        return;
      }
    }
  });
  return map;
}

/**
 * 切出文件里**每一张**表头首列命中能力列的表。
 *
 * MUST 收集全部而非第一张：`assets/context-layer/capability-registry.md` 自己就有两张
 * 能力表（三列最小形态 + 十列完整形态），用户填哪张全凭直觉。只解析第一张的后果不是
 * "少认几行"，而是**填了第二张表的人拿到 0 行且零提示**——权威位探测为假，agent 静默退回裸 grep。
 * 列映射本来就按表头名取，天然支持不同 schema 的多张表合并。
 *
 * 表头 MUST 由紧随其后的分隔行（`|---|---|`）确认。这一条同时替掉了旧实现里
 * "首列命中就当表头"的隐患：一张表进入数据区后，它的数据行（如占位行 `| 【能力】 |`，
 * 首列同样命中 /能力/）不再有机会被误判成新表的表头。
 *
 * @returns {{tables: Array<{cols: Map<string,number>, rows: string[][]}>, unconfirmedHeader: boolean}}
 *          `unconfirmedHeader` 供 `diagnoseRegistry` 区分"表头没写对"与"表头对、缺分隔行"。
 */
function capabilityTables(raw) {
  const tables = [];
  let unconfirmedHeader = false; // 首列命中能力列、但没被分隔行确认 → 诊断要指向分隔行
  let cur = null;      // 已确认表头、正在收数据行的表
  let pending = null;  // 候选表头，待分隔行确认
  for (const line of raw.split(/\r?\n/)) {
    const cells = parseTableRow(line);
    if (!cells) {
      // 非表格行 → 当前表结束，继续找下一张。候选表头在这里被丢弃时同样要置位：
      // 「表头 + 空行」和「表头 + 正文」都是分隔行缺失的常见形态（分隔行忘了写，
      // 或被编辑器的自动换行拆开），丢了这个信号诊断就退回 no-header，
      // 把人指向"首列表头请写 Capability"——而表头本来就是对的，照提示改永远改不好。
      if (pending) unconfirmedHeader = true;
      cur = null;
      pending = null;
      continue;
    }
    if (pending) {
      if (isSeparatorRow(cells)) {
        cur = { cols: mapRegistryHeader(pending), rows: [] };
        tables.push(cur);
      } else {
        unconfirmedHeader = true;
      }
      pending = null;
      continue;
    }
    if (!cur) {
      if (isCapabilityHeader(cells[0])) pending = cells;
      continue;
    }
    if (isSeparatorRow(cells)) continue;
    cur.rows.push(cells);
  }
  // 候选表头正好是文件最后一行时循环内没有机会判它——同样是分隔行缺失，MUST 一并置位。
  if (pending) unconfirmedHeader = true;
  return { tables, unconfirmedHeader };
}

/**
 * 解析 capability-registry.md 的 markdown 表格。
 * 合并文件里**所有**表头首列含 `Capability`（或「能力」）的表，按表头名取列，缺列留空。
 * **模板占位行（含【】）不算已登记能力**——否则一份没填过的 registry 会被误当作已启用权威位。
 * @returns {Array<{capability, businessMeaning, canonicalRepo, canonicalApi, deprecated, compatWindow, owner, testEntry, freshness, reason}>}
 */
export function loadRegistry(ctxDir) {
  const file = path.join(ctxDir, 'capability-registry.md');
  if (!fs.existsSync(file)) return [];
  // 与 loadCards 同一条理由：读失败 MUST 退化成"权威位未启用"，MUST NOT 抛栈。
  // 抛栈还有个副作用——`diagnoseRegistry` 的 'unreadable' 分支永远走不到（它在这行之后才跑）。
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  const rows = [];
  for (const { cols, rows: cells } of capabilityTables(raw).tables) {
    for (const cell of cells) {
      const row = { ...EMPTY_ROW };
      for (const [field, i] of cols) row[field] = cell[i] || '';
      if (!row.capability) continue;
      if (isRegistryPlaceholder(row.capability)) continue;
      rows.push(row);
    }
  }
  return rows;
}

/**
 * 找出 registry 里**同一能力被登记了多个不同权威实现**的情况。
 *
 * 合并全文件所有能力表之后，这种冲突才可能出现（旧实现只读第一张表，撞不上）。
 * 它 MUST 被显式报出来：权威位的全部承诺就是"同一能力多处实现时**信哪个**"，
 * 两条并列输出等于把这个问题原样退还给使用者，而且是**静默**退还——
 * agent 会随手取第一条，看起来还很权威。
 *
 * @returns {Array<{capability:string, canonicals:string[]}>}
 */
export function registryConflicts(rows) {
  // 比较键 MUST 只看**权威实现**，MUST NOT 把 `repo :: api` 拼起来比：
  // 模板同时给了三列最小表与十列完整表并写着"填哪张都算"，从最小表升级到完整表时
  // 把同一行留在两处是常见做法，此时只有"权威仓库"列一个填了一个没填——
  // 拼起来比会把它报成"权威层自相矛盾、必须先收敛"。这条警告语气很重，
  // 误报会训练使用者忽略它，而它正是为真冲突准备的。
  // 归一化也 MUST 与分组键同一套（都走 norm），否则反引号或大小写差异会被判成冲突。
  const norm = (t) => (t || '').trim().toLowerCase().replace(/`/g, '').replace(/\s+/g, ' ');
  const byCap = new Map();
  for (const r of rows) {
    const key = norm(r.capability);
    if (!key) continue;
    const api = norm(r.canonicalApi);
    if (!api) continue;
    if (!byCap.has(key)) byCap.set(key, { capability: r.capability.trim(), byApi: new Map() });
    const g = byCap.get(key);
    if (!g.byApi.has(api)) {
      g.byApi.set(api, [r.canonicalRepo, r.canonicalApi].filter(Boolean).join(' :: ').trim());
    }
  }
  return [...byCap.values()]
    .filter((g) => g.byApi.size > 1)
    .map((g) => ({ capability: g.capability, canonicals: [...g.byApi.values()] }));
}

/**
 * 诊断 registry 为什么解析不出数据行——**只用于人类可读的提示**，不参与任何路由判定。
 * 存在的理由：`loadRegistry` 返回空数组时，"文件没建"/"表头没被认出"/"只有模板行" 三种原因
 * 的处置动作完全不同（建文件 / 改表头 / 填内容）。把三者都报成"只有模板行"会把人引向
 * 错误的修复方向——曾经真的发生过：表头写「能力」时表整张没被识别，提示却说行是模板行。
 * `no-dir`（engineering-context 目录本身不存在）MUST 与 `no-file` 分开报：前者的修复动作是
 * "改 --dir / 换个目录跑"，后者才是"建 registry"。合报的后果实测过——`--dir` 打错字时
 * 输出与"这个项目真没建权威位"**一字不差**且都退出 0，使用者据此判定"本项目没有权威位"，
 * 于是退回裸 grep。
 * @returns {'no-dir'|'no-file'|'unreadable'|'no-header'|'no-separator'|'placeholder-only'|'no-row'|'ok'}
 */
export function diagnoseRegistry(ctxDir) {
  if (!fs.existsSync(ctxDir)) return 'no-dir';
  const file = path.join(ctxDir, 'capability-registry.md');
  if (!fs.existsSync(file)) return 'no-file';
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return 'unreadable';
  }
  const rows = loadRegistry(ctxDir);
  if (rows.length) return 'ok';
  // MUST 与 loadRegistry 走同一套切表逻辑（`capabilityTables`），否则诊断与解析会漂移：
  // 诊断说"只有模板行"而解析其实压根没认出表头（或反过来），两种情况的修复动作完全不同。
  // 数据区里的占位行首列是 `【能力】`，同样命中 /能力/——它是数据行不是表头，
  // 由 capabilityTables 的"表头须由分隔行确认"保证不被误判。
  const { tables, unconfirmedHeader } = capabilityTables(raw);
  const anyTableRow = raw.split(/\r?\n/).some((l) => parseTableRow(l));
  // 表头写对了、只是分隔行没被认出，与"表头没写对"的修复动作完全不同，MUST 分开报。
  if (!tables.length && unconfirmedHeader) return 'no-separator';
  if (!tables.length) return anyTableRow ? 'no-header' : 'no-row';
  const dataRows = tables.flatMap((t) => t.rows);
  if (!dataRows.length) return 'no-row';
  return dataRows.some((cells) => cells.some((c) => isRegistryPlaceholder(c))) ? 'placeholder-only' : 'no-row';
}

/** 模板占位（【…】）判定：registry 的空模板行不得被当成真实数据行。 */
export function isRegistryPlaceholder(text) {
  return /[【】]/.test(text || '');
}

/** 解析一行 markdown 表格；非表格行返回 null。 */
function parseTableRow(line) {
  const t = line.trim();
  if (!t.startsWith('|')) return null;
  // 去掉首尾 | 再按 | 切；不处理转义 |（card 内容避免裸 |）
  return t
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

/**
 * 未声明新鲜度时统一的标注文案。**不得退化成 "unknown" 或留空**：
 * "一个看起来权威但已过期的来源，比没有来源更危险"——没声明就必须在输出里说没声明，
 * 不假定新鲜（见 references/capability/context-engineering.md）。
 */
export const UNDECLARED_FRESHNESS = '未声明新鲜度';

/**
 * 从任意文本里抽一个 YYYY-MM-DD 作为确认时间；抽不到返回 UNDECLARED_FRESHNESS。
 * @returns {string}
 */
export function confirmedAtOf(text) {
  const m = /(\d{4}-\d{2}-\d{2})/.exec(text || '');
  return m ? m[1] : UNDECLARED_FRESHNESS;
}

/**
 * 生成 cite：path + anchor + 最近确认时间。
 * @returns {string}
 */
export function makeCite(cardPath, anchorText, confirmedAt) {
  return `[cite: ${cardPath}#${anchorText} @${confirmedAt}]`;
}
