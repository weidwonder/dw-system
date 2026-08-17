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
  return fs
    .readdirSync(cardsDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const full = path.join(cardsDir, f);
      const raw = fs.readFileSync(full, 'utf8');
      return {
        service: path.basename(f, '.md'),
        path: path.join('cards', f),
        sections: splitSections(raw),
        raw,
      };
    });
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
 * 解析 capability-registry.md 的 markdown 表格。
 * 取第一张表（表头首列含 "Capability"），按表头名取列，缺列留空。
 * **模板占位行（含【】）不算已登记能力**——否则一份没填过的 registry 会被误当作已启用权威位。
 * @returns {Array<{capability, businessMeaning, canonicalRepo, canonicalApi, deprecated, compatWindow, owner, testEntry, freshness, reason}>}
 */
export function loadRegistry(ctxDir) {
  const file = path.join(ctxDir, 'capability-registry.md');
  if (!fs.existsSync(file)) return [];
  const raw = fs.readFileSync(file, 'utf8');
  const lines = raw.split(/\r?\n/);
  const rows = [];
  let cols = null;
  for (const line of lines) {
    const cells = parseTableRow(line);
    if (!cells) {
      if (cols) break; // 表格结束
      continue;
    }
    // 表头行
    if (!cols) {
      if (isCapabilityHeader(cells[0])) cols = mapRegistryHeader(cells);
      continue;
    }
    // 分隔行 |---|---|
    if (cells.every((c) => /^:?-{2,}:?$/.test(c.replace(/\s/g, '')) || c === '')) {
      continue;
    }
    const row = { ...EMPTY_ROW };
    for (const [field, i] of cols) row[field] = cells[i] || '';
    if (!row.capability) continue;
    if (isRegistryPlaceholder(row.capability)) continue;
    rows.push(row);
  }
  return rows;
}

/**
 * 诊断 registry 为什么解析不出数据行——**只用于人类可读的提示**，不参与任何路由判定。
 * 存在的理由：`loadRegistry` 返回空数组时，"文件没建"/"表头没被认出"/"只有模板行" 三种原因
 * 的处置动作完全不同（建文件 / 改表头 / 填内容）。把三者都报成"只有模板行"会把人引向
 * 错误的修复方向——曾经真的发生过：表头写「能力」时表整张没被识别，提示却说行是模板行。
 * @returns {'no-file'|'unreadable'|'no-header'|'placeholder-only'|'no-row'|'ok'}
 */
export function diagnoseRegistry(ctxDir) {
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
  const tableRows = raw.split(/\r?\n/).map(parseTableRow).filter(Boolean);
  // MUST 用"第一个命中的行下标"定位表头，MUST NOT 用 isCapabilityHeader 过滤掉所有命中的行：
  // 模板占位行的首列是 `【能力】`，同样命中 /能力/，按模式过滤会把它当表头排掉，
  // 于是"只有模板行"被误报成"没有数据行"——恰好是本次要修的那类错误诊断。
  const headerAt = tableRows.findIndex((cells) => isCapabilityHeader(cells[0]));
  if (headerAt < 0) return tableRows.length ? 'no-header' : 'no-row';
  const isSeparator = (cells) => cells.every((c) => /^:?-{2,}:?$/.test(c.replace(/\s/g, '')) || c === '');
  const dataRows = tableRows.slice(headerAt + 1).filter((cells) => !isSeparator(cells));
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
